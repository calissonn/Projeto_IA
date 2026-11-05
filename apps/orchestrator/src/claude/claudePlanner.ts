import { mkdirSync } from 'node:fs';
import { WORKER_ROLES } from '@acc/shared';
import type { PlanOutcome, PlanRequest, Planner } from '../coordinator/planner.ts';
import { agentEnvironment } from './environment.ts';
import { STRUCTURED_OUTPUT_TOOL, describeResultError, isResult, type QueryFn } from './sdk.ts';

export interface ClaudePlannerOptions {
  query: QueryFn;
  model: string;
  budgetUsd: number;
  /** Diretório neutro onde o planejamento roda (sem acesso a ferramentas). */
  cwd: string;
  pathToClaudeCodeExecutable?: string;
  env?: NodeJS.ProcessEnv;
}

/** Esquema do plano pedido à coordenadora (o resultado ainda passa por validatePlan). */
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tasks'],
  properties: {
    summary: { type: 'string', minLength: 3, maxLength: 2000, description: 'Resumo do plano em português, 1 a 3 frases.' },
    tasks: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'title', 'description', 'role', 'dependsOn', 'acceptanceCriteria'],
        properties: {
          key: { type: 'string', pattern: '^[a-z0-9-]{1,40}$', description: 'Identificador curto em kebab-case.' },
          title: { type: 'string', minLength: 3, maxLength: 120 },
          description: { type: 'string', minLength: 3, maxLength: 2000, description: 'O que fazer, com detalhes suficientes para executar sem perguntas.' },
          role: { type: 'string', enum: [...WORKER_ROLES] },
          dependsOn: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Chaves das tarefas que precisam terminar antes.' },
          acceptanceCriteria: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 6 },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `Você é Ada, a coordenadora do AI Command Center, uma empresa virtual de agentes de IA com supervisão humana.
Transforme a solicitação do administrador num plano de trabalho para a equipe:
- designer: protótipos de interface, layout, estilos (HTML/CSS ou componentes).
- programmer: implementação do código e da lógica.
- tester: testes automatizados e validação.

Regras do plano:
- Entre 2 e 6 tarefas, pequenas o bastante para um agente concluir em uma sessão.
- O sistema será criado do zero numa pasta vazia, rodando localmente, sem serviços pagos nem acesso à internet.
- Indique dependências reais (por exemplo, testes dependem da implementação). Não crie ciclos.
- Inclua ao final uma tarefa de testes para o tester.
- Critérios de aceite objetivos e verificáveis.
- Escreva tudo em português do Brasil.`;

/** Planejador do MODO REAL: a coordenadora usa o Claude (sem ferramentas) e devolve o plano estruturado. */
export class ClaudePlanner implements Planner {
  constructor(private readonly o: ClaudePlannerOptions) {}

  async plan(req: PlanRequest, signal: AbortSignal): Promise<PlanOutcome> {
    mkdirSync(this.o.cwd, { recursive: true });
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const prompt = `${INSTRUCTIONS}\n\nNome do projeto: ${req.name}\n\nSolicitação do administrador:\n${req.description}`;
      for await (const msg of this.o.query({
        prompt,
        options: {
          cwd: this.o.cwd,
          model: this.o.model,
          tools: [],
          allowedTools: [],
          settingSources: [],
          permissionMode: 'default',
          // Só a entrega do plano estruturado é permitida; nenhuma outra ferramenta.
          canUseTool: async (toolName, input) =>
            toolName === STRUCTURED_OUTPUT_TOOL ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'O planejamento não usa ferramentas.' },
          outputFormat: { type: 'json_schema', schema: PLAN_SCHEMA as unknown as Record<string, unknown> },
          maxTurns: 4,
          maxBudgetUsd: this.o.budgetUsd,
          abortController: abort,
          env: agentEnvironment(this.o.env),
          ...(this.o.pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable: this.o.pathToClaudeCodeExecutable } : {}),
        },
      })) {
        if (!isResult(msg)) continue;
        if (msg.subtype !== 'success' || msg.is_error) {
          const err = new Error(describeResultError(msg)) as Error & { costUsd?: number };
          err.costUsd = msg.total_cost_usd;
          throw err;
        }
        if (msg.structured_output === undefined) throw new Error('A coordenadora não devolveu o plano estruturado');
        return { plan: msg.structured_output, costUsd: msg.total_cost_usd };
      }
      throw new Error('O Claude Code encerrou sem resultado');
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
}
