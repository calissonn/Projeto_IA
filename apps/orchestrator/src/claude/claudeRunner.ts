import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { TestResult, WorkerRole } from '@acc/shared';
import { classifyAction } from '../policy/riskClassifier.ts';
import { ROLE_PROFILES } from '../policy/roles.ts';
import { isTestCommand, stateForTool } from '../policy/toolStates.ts';
import type { RunContext, RunResult, Runner } from '../runners/runner.ts';
import { agentEnvironment } from './environment.ts';
import { diffSnapshots, snapshot } from './fileSnapshot.ts';
import { STRUCTURED_OUTPUT_TOOL, describeResultError, isAssistant, isResult, isUser, type QueryFn, type QueryOptions } from './sdk.ts';
import { compactInput, short, summarizeTool, textOfToolResult } from './toolSummary.ts';

export type SandboxMode = 'auto' | 'required' | 'off';

export interface ClaudeRunnerOptions {
  query: QueryFn;
  model: string;
  taskBudgetUsd: number;
  maxTurns: number;
  sandbox: SandboxMode;
  pathToClaudeCodeExecutable?: string;
  env?: NodeJS.ProcessEnv;
}

/** Ferramentas disponíveis para cada cargo (o resto nem aparece para o agente). */
const ROLE_TOOLS: Record<WorkerRole, string[]> = {
  programmer: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
  designer: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
  tester: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
};

/** Relatório final que o agente entrega ao terminar (saída estruturada do SDK). */
export const FINAL_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tests'],
  properties: {
    summary: { type: 'string', description: 'Resumo em português do que foi feito e do que ficou pendente (até 5 frases).' },
    tests: {
      description: 'Resultado da ÚLTIMA execução de testes feita nesta tarefa, ou null se nenhum teste foi executado.',
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['command', 'total', 'passed', 'failed'],
          properties: {
            command: { type: 'string' },
            total: { type: 'integer', minimum: 0 },
            passed: { type: 'integer', minimum: 0 },
            failed: { type: 'integer', minimum: 0 },
          },
        },
      ],
    },
  },
} as const;

interface FinalReport {
  summary: string;
  tests: { command: string; total: number; passed: number; failed: number } | null;
}

function parseReport(v: unknown): FinalReport | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.summary !== 'string') return null;
  const t = r.tests as Record<string, unknown> | null | undefined;
  const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  const tests = t && typeof t.command === 'string' && ok(t.total) && ok(t.passed) && ok(t.failed) ? (t as FinalReport['tests']) : null;
  return { summary: r.summary, tests };
}

const ROLE_GUIDANCE: Record<WorkerRole, string> = {
  designer:
    'Você é a designer de interface. Produza protótipos e estilos concretos (por exemplo HTML/CSS ou componentes), com foco em clareza, acessibilidade e consistência visual. Documente as decisões em poucas linhas.',
  programmer:
    'Você é o programador. Implemente a funcionalidade de forma simples e funcional, reaproveitando o que já existe no workspace. Prefira bibliotecas padrão; só peça dependências novas se forem realmente necessárias.',
  tester:
    'Você é o analista de testes. Escreva testes automatizados para o fluxo principal, execute-os e corrija apenas os próprios testes. Se algo do sistema estiver quebrado, relate no resumo em vez de reescrever o sistema.',
};

export function buildTaskPrompt(ctx: Pick<RunContext, 'project' | 'task' | 'dependencies'>): string {
  const { project, task, dependencies } = ctx;
  const deps = dependencies.length
    ? dependencies
        .map((d) => `- "${d.title}" (concluída): ${d.summary ?? 'sem resumo'}${d.filesChanged.length ? `\n  Arquivos: ${d.filesChanged.map((f) => f.path).slice(0, 30).join(', ')}` : ''}`)
        .join('\n')
    : '- nenhuma';
  const criteria = task.acceptanceCriteria.length ? task.acceptanceCriteria.map((c) => `- ${c}`).join('\n') : '- (não informados)';
  return [
    `Projeto: ${project.name}`,
    `Descrição do sistema desejado:\n${project.description}`,
    '',
    `Sua tarefa: ${task.title}`,
    task.description,
    '',
    `Critérios de aceite:\n${criteria}`,
    '',
    `Resultados das tarefas anteriores:\n${deps}`,
    '',
    'Trabalhe apenas no diretório atual (o workspace do projeto). Ao terminar, entregue o relatório final pedido.',
  ].join('\n');
}

function systemAppend(role: WorkerRole): string {
  return [
    'Você é um agente do AI Command Center, uma empresa virtual com supervisão humana.',
    ROLE_GUIDANCE[role],
    'Regras:',
    '- Trabalhe somente dentro do diretório atual. Não leia nem altere arquivos fora dele.',
    '- Não acesse a internet. Instalar dependências, excluir arquivos, publicar, enviar código (git push) ou se comunicar com serviços externos exige aprovação humana: se for pedido e negado, siga sem a ação e registre isso no resumo.',
    '- Não exponha segredos nem variáveis de ambiente.',
    '- Responda e escreva comentários em português do Brasil.',
  ].join('\n');
}

/** Garante um repositório git próprio no workspace, para que comandos git não afetem outros projetos. */
function ensureGitRepo(dir: string) {
  if (existsSync(path.join(dir, '.git'))) return;
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  } catch {
    /* git ausente: o agente segue sem controle de versão */
  }
}

/**
 * Executor do MODO REAL: roda o Claude Code (Agent SDK) no workspace isolado do projeto.
 * Cada ferramenta passa pela política de permissões; ações de risco vão para a fila de aprovação.
 */
export class ClaudeRunner implements Runner {
  readonly kind = 'claude' as const;
  constructor(private readonly o: ClaudeRunnerOptions) {}

  async run(ctx: RunContext): Promise<RunResult> {
    const { task, workspaceDir: cwd } = ctx;
    const profile = ROLE_PROFILES[task.role];
    ensureGitRepo(cwd);
    const before = snapshot(cwd);
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    ctx.signal.addEventListener('abort', onAbort, { once: true });

    // Saída dos comandos de teste observados (para mostrar junto do resultado).
    const testCalls = new Map<string, string>();
    let lastTestOutput: { command: string; output: string; isError: boolean } | null = null;

    const options: QueryOptions = {
      cwd,
      model: this.o.model,
      tools: ROLE_TOOLS[task.role],
      permissionMode: 'default',
      // Nenhuma ferramenta é liberada automaticamente: tudo passa por canUseTool.
      allowedTools: [],
      settingSources: [],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: systemAppend(task.role) },
      outputFormat: { type: 'json_schema', schema: FINAL_REPORT_SCHEMA as unknown as Record<string, unknown> },
      maxTurns: this.o.maxTurns,
      maxBudgetUsd: this.o.taskBudgetUsd,
      abortController: abort,
      env: agentEnvironment(this.o.env),
      ...(this.o.pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable: this.o.pathToClaudeCodeExecutable } : {}),
      ...(this.o.sandbox === 'off'
        ? {}
        : {
            sandbox: {
              enabled: true,
              failIfUnavailable: this.o.sandbox === 'required',
              autoAllowBashIfSandboxed: false,
              allowUnsandboxedCommands: false,
              network: { allowedDomains: [] },
              filesystem: { allowWrite: [cwd] },
            },
          }),
      canUseTool: async (toolName, input) => {
        // Entrega do relatório final: não executa nada, sempre permitida.
        if (toolName === STRUCTURED_OUTPUT_TOOL) return { behavior: 'allow', updatedInput: input };
        const verdict = classifyAction(profile, toolName, input, cwd);
        if (!verdict.requiresApproval) return { behavior: 'allow', updatedInput: input };
        const outcome = await ctx.requestApproval({
          category: verdict.category ?? 'other',
          title: `${summarizeTool(toolName, input, cwd)}`,
          detail: `O agente quer usar ${toolName}: ${verdict.reason}.`,
          payload: { tool: toolName, input: compactInput(input) },
        });
        return outcome.approved
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: `Ação negada pelo administrador${outcome.reason ? `: ${outcome.reason}` : ''}. Continue sem ela.` };
      },
    };

    try {
      for await (const msg of this.o.query({ prompt: buildTaskPrompt(ctx), options })) {
        if (isAssistant(msg)) {
          for (const block of msg.message.content) {
            if (block.type === 'tool_use' && block.name === STRUCTURED_OUTPUT_TOOL) {
              ctx.report({ kind: 'message', state: 'analyzing', summary: 'Entregando o relatório final', detail: null });
            } else if (block.type === 'tool_use' && block.name) {
              const input = block.input ?? {};
              if (block.name === 'Bash' && isTestCommand(String(input.command ?? ''))) testCalls.set(block.id ?? '', String(input.command));
              ctx.report({ kind: 'tool', state: stateForTool(block.name, input), tool: block.name, summary: summarizeTool(block.name, input, cwd), detail: { input: compactInput(input) } });
            } else if (block.type === 'text' && block.text?.trim()) {
              ctx.report({ kind: 'message', state: 'analyzing', summary: short(block.text, 140), detail: { text: block.text.slice(0, 2000) } });
            }
          }
        } else if (isUser(msg) && Array.isArray(msg.message.content)) {
          for (const block of msg.message.content) {
            if (block.type === 'tool_result' && block.tool_use_id && testCalls.has(block.tool_use_id)) {
              const out = textOfToolResult(block.content);
              lastTestOutput = { command: testCalls.get(block.tool_use_id)!, output: out.slice(-2000), isError: !!block.is_error };
            }
          }
        } else if (isResult(msg)) {
          const filesChanged = diffSnapshots(before, snapshot(cwd));
          const base = { filesChanged, costUsd: msg.total_cost_usd, turns: msg.num_turns };
          if (abort.signal.aborted) return { ...base, status: 'aborted', summary: null, error: 'Interrompido pelo administrador', tests: null };
          if (msg.subtype !== 'success' || msg.is_error) {
            return { ...base, status: 'failed', summary: null, error: describeResultError(msg), tests: null };
          }
          const report = parseReport(msg.structured_output);
          let tests: TestResult | null = null;
          if (report?.tests) {
            tests = { ...report.tests, output: lastTestOutput?.output ?? null };
          } else if (lastTestOutput) {
            tests = null; // houve teste mas sem contagem confiável: a saída fica no histórico
          }
          const summary = report?.summary ?? (typeof msg.result === 'string' ? short(msg.result, 600) : null);
          if (tests && tests.failed > 0) {
            return { ...base, status: 'failed', summary, error: `${tests.failed} de ${tests.total} testes falharam`, tests };
          }
          return { ...base, status: 'succeeded', summary, error: null, tests };
        }
      }
      // O fluxo terminou sem mensagem de resultado.
      const filesChanged = diffSnapshots(before, snapshot(cwd));
      if (abort.signal.aborted) return { status: 'aborted', summary: null, error: 'Interrompido pelo administrador', filesChanged, tests: null, costUsd: null, turns: null };
      return { status: 'failed', summary: null, error: 'O Claude Code encerrou sem resultado', filesChanged, tests: null, costUsd: null, turns: null };
    } catch (err) {
      const filesChanged = diffSnapshots(before, snapshot(cwd));
      if (abort.signal.aborted) return { status: 'aborted', summary: null, error: 'Interrompido pelo administrador', filesChanged, tests: null, costUsd: null, turns: null };
      return { status: 'failed', summary: null, error: `Falha ao executar o Claude Code: ${err instanceof Error ? err.message : String(err)}`, filesChanged, tests: null, costUsd: null, turns: null };
    } finally {
      ctx.signal.removeEventListener('abort', onAbort);
    }
  }
}
