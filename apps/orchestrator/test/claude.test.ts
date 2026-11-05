import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isEngagedState, type Activity, type Agent, type Project, type Task } from '@acc/shared';
import { buildApp } from '../src/app.ts';
import { ClaudePlanner } from '../src/claude/claudePlanner.ts';
import { ClaudeRunner } from '../src/claude/claudeRunner.ts';
import { agentEnvironment } from '../src/claude/environment.ts';
import { loadConfig } from '../src/config.ts';
import type { ApprovalOutcome, ApprovalRequest, RunContext } from '../src/runners/runner.ts';
import { fakeQuery, type FakeScript } from './fakeSdk.ts';
import { waitFor } from './helpers.ts';

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'acc-claude-'));

const project: Project = {
  id: 'prj_1', name: 'Agenda', description: 'Agenda simples de contatos', status: 'running', mode: 'real',
  createdAt: '', updatedAt: '', budgetUsd: 2, costUsd: 0, estimatedCostUsd: null, planSummary: null, statusReason: null,
};
const task = (role: Task['role'], over: Partial<Task> = {}): Task => ({
  id: 'tsk_1', projectId: 'prj_1', order: 0, title: 'Implementar agenda', description: 'Criar a página', role, dependsOn: [],
  acceptanceCriteria: ['Lista contatos'], status: 'running', agentId: 'ag-programmer', runId: 'run_1', attempts: 1,
  startedAt: null, finishedAt: null, costUsd: null, estimatedCostUsd: null, filesChanged: [], tests: null, summary: null, error: null, ...over,
});

function context(role: Task['role'], approve: (r: ApprovalRequest) => ApprovalOutcome = () => ({ approved: true, reason: null })) {
  const activities: Activity[] = [];
  const approvals: ApprovalRequest[] = [];
  const abort = new AbortController();
  const ctx: RunContext = {
    project,
    task: task(role),
    agent: { id: `ag-${role}` } as Agent,
    dependencies: [task('designer', { id: 'tsk_0', title: 'Protótipo', status: 'done', summary: 'Layout pronto', filesChanged: [{ path: 'design/a.css', change: 'created' }] })],
    workspaceDir: tmp(),
    signal: abort.signal,
    report: (a) => activities.push({ tool: null, detail: null, ...a }),
    requestApproval: async (r) => {
      approvals.push(r);
      return approve(r);
    },
  };
  return { ctx, activities, approvals, abort };
}

const runner = (script: (p: string) => FakeScript, extra: Partial<ConstructorParameters<typeof ClaudeRunner>[0]> = {}) => {
  const fake = fakeQuery((p) => script(p));
  return { fake, runner: new ClaudeRunner({ query: fake.query, model: 'sonnet', taskBudgetUsd: 0.5, maxTurns: 30, sandbox: 'auto', env: { PATH: '/usr/bin', HOME: '/home/x', ACC_TOKEN: 'segredo', ANTHROPIC_API_KEY: 'sk-test' }, ...extra }) };
};

describe('ClaudeRunner (SDK simulado)', () => {
  it('traduz as ferramentas reais em estados, registra arquivos alterados de fato e o custo', async () => {
    const { ctx, activities } = context('programmer');
    writeFileSync(path.join(ctx.workspaceDir, 'existente.txt'), 'antes');
    const { runner: r, fake } = runner(() => ({
      steps: [
        { tool: 'Read', input: { file_path: 'existente.txt' } },
        { text: 'Vou criar a página principal.' },
        { tool: 'Write', input: { file_path: 'src/index.html', content: '<h1>Agenda</h1>' } },
        { tool: 'Edit', input: { file_path: 'existente.txt', old_string: 'antes', new_string: 'depois' } },
        { tool: 'Bash', input: { command: 'npm test' }, output: '3 passed' },
      ],
      result: { costUsd: 0.12, turns: 6, structured: { summary: 'Página criada.', tests: { command: 'npm test', total: 3, passed: 3, failed: 0 } } },
    }));
    const res = await r.run(ctx);
    expect(res).toMatchObject({ status: 'succeeded', summary: 'Página criada.', costUsd: 0.12, turns: 6 });
    expect(res.filesChanged).toEqual([
      { path: 'existente.txt', change: 'modified' },
      { path: 'src/index.html', change: 'created' },
    ]);
    expect(res.tests).toMatchObject({ total: 3, passed: 3, failed: 0, output: '3 passed' });
    expect(activities.map((a) => a.state)).toEqual(['analyzing', 'analyzing', 'typing', 'typing', 'testing', 'analyzing']);
    expect(activities.at(-1)!.summary).toBe('Entregando o relatório final');
    expect(activities[2]!.summary).toBe('Escrevendo src/index.html');
    expect(existsSync(path.join(ctx.workspaceDir, '.git'))).toBe(true);

    const opts = fake.calls[0]!.options;
    expect(opts).toMatchObject({ cwd: ctx.workspaceDir, model: 'sonnet', permissionMode: 'default', allowedTools: [], settingSources: [], maxBudgetUsd: 0.5, maxTurns: 30 });
    expect(opts.sandbox).toMatchObject({ enabled: true, allowUnsandboxedCommands: false, filesystem: { allowWrite: [ctx.workspaceDir] } });
    expect(opts.env).not.toHaveProperty('ACC_TOKEN');
    expect(opts.env).toMatchObject({ ANTHROPIC_API_KEY: 'sk-test', PATH: '/usr/bin' });
    expect(fake.calls[0]!.prompt).toContain('Protótipo');
    expect(fake.calls[0]!.prompt).toContain('design/a.css');
  });

  it('ação de risco vai para a aprovação; recusa é devolvida ao agente e a execução continua', async () => {
    const { ctx, approvals } = context('programmer', () => ({ approved: false, reason: 'sem dependências novas' }));
    const { runner: r, fake } = runner(() => ({
      steps: [
        { tool: 'Bash', input: { command: 'npm install express' } },
        { tool: 'Write', input: { file_path: 'server.js', content: 'ok' } },
      ],
      result: { structured: { summary: 'Feito sem express.', tests: null } },
    }));
    const res = await r.run(ctx);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({ category: 'install', title: 'Executando: npm install express' });
    expect(fake.calls[0]!.decisions).toEqual([
      { tool: 'Bash', behavior: 'deny', message: 'Ação negada pelo administrador: sem dependências novas. Continue sem ela.' },
      { tool: 'Write', behavior: 'allow', message: undefined },
      { tool: 'StructuredOutput', behavior: 'allow', message: undefined },
    ]);
    // A entrega do relatório final nunca pede aprovação.
    expect(approvals.every((a) => !a.title.includes('StructuredOutput'))).toBe(true);
    expect(res.status).toBe('succeeded');
  });

  it('escrita fora do workspace exige aprovação', async () => {
    const { ctx, approvals } = context('designer', () => ({ approved: false, reason: null }));
    const { runner: r } = runner(() => ({ steps: [{ tool: 'Write', input: { file_path: '/etc/hosts', content: 'x' } }], result: { structured: { summary: 'ok', tests: null } } }));
    await r.run(ctx);
    expect(approvals[0]).toMatchObject({ category: 'other' });
    expect(approvals[0]!.detail).toContain('fora do workspace');
  });

  it('testes com falha marcam a tarefa como falha, com a saída real do comando', async () => {
    const { ctx } = context('tester');
    const { runner: r } = runner(() => ({
      steps: [{ tool: 'Bash', input: { command: 'npx vitest run' }, output: 'FAIL tests/a.test.ts\n2 failed | 5 passed', isError: true }],
      result: { structured: { summary: 'Dois testes falham.', tests: { command: 'npx vitest run', total: 7, passed: 5, failed: 2 } } },
    }));
    const res = await r.run(ctx);
    expect(res).toMatchObject({ status: 'failed', error: '2 de 7 testes falharam' });
    expect(res.tests?.output).toContain('2 failed');
  });

  it('limite de custo e de turnos viram erros claros', async () => {
    for (const [subtype, msg] of [
      ['error_max_budget_usd', /Limite de custo atingido/],
      ['error_max_turns', /Limite de turnos/],
    ] as const) {
      const { ctx } = context('programmer');
      const { runner: r } = runner(() => ({ steps: [], result: { subtype, costUsd: 0.51 } }));
      const res = await r.run(ctx);
      expect(res.status).toBe('failed');
      expect(res.error).toMatch(msg);
      expect(res.costUsd).toBe(0.51);
    }
  });

  it('interromper encerra o SDK e devolve "aborted"', async () => {
    const { ctx, abort } = context('programmer');
    const { runner: r } = runner(() => ({ delayMs: 20, steps: Array.from({ length: 20 }, (_, i) => ({ tool: 'Read', input: { file_path: `a${i}` } })) }));
    const p = r.run(ctx);
    setTimeout(() => abort.abort(), 50);
    expect((await p).status).toBe('aborted');
  });

  it('sandbox desligado não envia configuração de sandbox', async () => {
    const { ctx } = context('programmer');
    const { runner: r, fake } = runner(() => ({ steps: [], result: { structured: { summary: 'ok', tests: null } } }), { sandbox: 'off' });
    await r.run(ctx);
    expect(fake.calls[0]!.options.sandbox).toBeUndefined();
  });
});

describe('ClaudePlanner (SDK simulado)', () => {
  it('pede o plano estruturado sem ferramentas e devolve o custo', async () => {
    const plan = { summary: 'Plano', tasks: [{ key: 'a', title: 'Tarefa A', description: 'Fazer A', role: 'programmer', dependsOn: [], acceptanceCriteria: [] }] };
    const fake = fakeQuery(() => ({ steps: [], result: { structured: plan, costUsd: 0.03 } }));
    const planner = new ClaudePlanner({ query: fake.query, model: 'sonnet', budgetUsd: 0.3, cwd: tmp() });
    const out = await planner.plan({ name: 'X', description: 'Descrição longa o suficiente' }, new AbortController().signal);
    expect(out).toEqual({ plan, costUsd: 0.03 });
    expect(fake.calls[0]!.decisions).toEqual([{ tool: 'StructuredOutput', behavior: 'allow', message: undefined }]);
    expect(fake.calls[0]!.options).toMatchObject({ tools: [], maxBudgetUsd: 0.3, settingSources: [] });
    expect(fake.calls[0]!.options.outputFormat?.type).toBe('json_schema');
  });

  it('erro do SDK vira exceção com o custo gasto', async () => {
    const fake = fakeQuery(() => ({ steps: [], result: { subtype: 'error_max_budget_usd', costUsd: 0.31 } }));
    const planner = new ClaudePlanner({ query: fake.query, model: 'sonnet', budgetUsd: 0.3, cwd: tmp() });
    await expect(planner.plan({ name: 'X', description: 'Descrição longa' }, new AbortController().signal)).rejects.toMatchObject({ costUsd: 0.31 });
  });
});

describe('ambiente dos agentes', () => {
  it('só repassa variáveis necessárias', () => {
    const env = agentEnvironment({ PATH: '/bin', ACC_TOKEN: 'x', DATABASE_URL: 'postgres://segredo', ANTHROPIC_API_KEY: 'k', GITHUB_TOKEN: 'g' });
    expect(Object.keys(env).sort()).toEqual(['ANTHROPIC_API_KEY', 'CLAUDE_AGENT_SDK_CLIENT_APP', 'PATH']);
  });
});

describe('modo real de ponta a ponta (SDK simulado)', () => {
  it('planeja, executa no workspace, pede aprovação e soma custos reais', async () => {
    const dir = tmp();
    const plan = {
      summary: 'Agenda em HTML',
      tasks: [
        { key: 'ui', title: 'Layout', description: 'Criar layout', role: 'designer', dependsOn: [], acceptanceCriteria: ['Tem cabeçalho'] },
        { key: 'code', title: 'Código', description: 'Criar app', role: 'programmer', dependsOn: ['ui'], acceptanceCriteria: [] },
        { key: 'test', title: 'Testes', description: 'Testar', role: 'tester', dependsOn: ['code'], acceptanceCriteria: [] },
      ],
    };
    const fake = fakeQuery((prompt, options) => {
      if (options.tools && (options.tools as string[]).length === 0) return { steps: [], result: { structured: plan, costUsd: 0.02 } };
      if (prompt.includes('Sua tarefa: Layout')) return { steps: [{ tool: 'Write', input: { file_path: 'index.html', content: '<h1>Agenda</h1>' } }], result: { costUsd: 0.1, structured: { summary: 'Layout feito', tests: null } } };
      if (prompt.includes('Sua tarefa: Código'))
        return {
          steps: [
            { tool: 'Bash', input: { command: 'npm install lodash' } },
            { tool: 'Write', input: { file_path: 'app.js', content: 'console.log(1)' } },
          ],
          result: { costUsd: 0.2, structured: { summary: 'App feito', tests: null } },
        };
      return { steps: [{ tool: 'Bash', input: { command: 'node --test' }, output: 'ok 1' }], result: { costUsd: 0.05, structured: { summary: 'Testado', tests: { command: 'node --test', total: 1, passed: 1, failed: 0 } } } };
    });
    const config = { ...loadConfig({ ACC_MODE: 'real', ACC_DATA_DIR: path.join(dir, 'data'), ACC_WORKSPACES_DIR: path.join(dir, 'ws') }), dataDir: path.join(dir, 'data'), workspacesDir: path.join(dir, 'ws') };
    const { engine, repo } = buildApp(config, { dbFile: ':memory:', query: fake.query });

    const p = engine.createProject({ name: 'Agenda', description: 'Agenda simples de contatos' });
    const planAp = await waitFor(() => repo.listApprovals({ status: 'pending' })[0], 3000, 'plano');
    expect(repo.getProject(p.id)!.estimatedCostUsd).toBeGreaterThan(0);
    expect(repo.getProject(p.id)!.costUsd).toBeCloseTo(0.02);
    engine.decide(planAp.id, 'approve');

    const install = await waitFor(() => repo.listApprovals({ status: 'pending' }).find((a) => a.category === 'install'), 3000, 'aprovação de instalação');
    expect(repo.getAgent('ag-programmer')!.state).toBe('awaiting_approval');
    engine.decide(install.id, 'approve');

    await waitFor(() => repo.getProject(p.id)!.status === 'completed', 3000, 'conclusão');
    await engine.idle();
    const ws = path.join(dir, 'ws', p.id);
    expect(repo.getProject(p.id)!.workspacePath).toBe(ws);
    expect(readFileSync(path.join(ws, 'index.html'), 'utf8')).toContain('Agenda');
    expect(existsSync(path.join(ws, 'app.js'))).toBe(true);
    expect(repo.getProject(p.id)!.costUsd).toBeCloseTo(0.37);
    const tasks = repo.listTasks(p.id);
    expect(tasks.map((t) => t.filesChanged.map((f) => f.path))).toEqual([['index.html'], ['app.js'], []]);
    expect(tasks[2]!.tests).toMatchObject({ passed: 1, failed: 0 });
    const events = repo.listEvents({ limit: 5000 });
    expect(events.every((e) => e.source === 'real')).toBe(true);
    expect(events.some((e) => e.type === 'run.activity' && e.activity.tool === 'Write' && e.activity.state === 'typing')).toBe(true);
    expect(repo.listAgents().every((a) => !isEngagedState(a.state))).toBe(true);
  });

  it('pausa o projeto quando o custo real atinge o orçamento', async () => {
    const dir = tmp();
    const plan = { summary: 'Plano curto', tasks: [{ key: 'a', title: 'Tarefa A', description: 'Fazer A', role: 'programmer', dependsOn: [], acceptanceCriteria: [] }, { key: 'b', title: 'Tarefa B', description: 'Fazer B', role: 'programmer', dependsOn: ['a'], acceptanceCriteria: [] }] };
    const fake = fakeQuery((_p, o) => ((o.tools as string[]).length === 0 ? { steps: [], result: { structured: plan, costUsd: 0.01 } } : { steps: [], result: { costUsd: 0.6, structured: { summary: 'ok', tests: null } } }));
    const config = { ...loadConfig({ ACC_MODE: 'real' }), dataDir: path.join(dir, 'data'), workspacesDir: path.join(dir, 'ws') };
    const { engine, repo } = buildApp(config, { dbFile: ':memory:', query: fake.query });
    const p = engine.createProject({ name: 'Caro', description: 'Projeto com orçamento curto', budgetUsd: 0.5 });
    engine.decide((await waitFor(() => repo.listApprovals({ status: 'pending' })[0], 3000)).id, 'approve');
    await waitFor(() => repo.getProject(p.id)!.status === 'paused', 3000, 'pausa por orçamento');
    expect(repo.getProject(p.id)!.statusReason).toMatch(/Orçamento/);
    expect(repo.listTasks(p.id).map((t) => t.status)).toEqual(['done', 'pending']);
  });
});

describe('esquema do plano', () => {
  it('as regras do esquema enviado ao Claude batem com a validação do orquestrador', async () => {
    const { PLAN_SCHEMA } = await import('../src/claude/claudePlanner.ts');
    const item = PLAN_SCHEMA.properties.tasks.items.properties;
    expect(PLAN_SCHEMA.properties.summary.minLength).toBe(3);
    expect(item.title.minLength).toBe(3);
    expect(item.key.pattern).toBe('^[a-z0-9-]{1,40}$');
    expect(item.role.enum).toEqual(['programmer', 'designer', 'tester']);
  });
});
