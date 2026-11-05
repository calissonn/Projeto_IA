import path from 'node:path';
import type { WorkerRole } from '@acc/shared';
import { ClaudePlanner } from './claude/claudePlanner.ts';
import { ClaudeRunner } from './claude/claudeRunner.ts';
import type { QueryFn } from './claude/sdk.ts';
import { DemoPlanner } from './coordinator/demoPlanner.ts';
import type { Planner } from './coordinator/planner.ts';
import { calibratedEstimate } from './costs/estimator.ts';
import type { Config } from './config.ts';
import { EventBus } from './events/bus.ts';
import { DemoRunner } from './runners/demoRunner.ts';
import type { Runner } from './runners/runner.ts';
import { Engine } from './scheduler/engine.ts';
import { openSqlite } from './store/sqlite.ts';
import { systemClock, uuidIds } from './util/runtime.ts';
import { Workspaces } from './workspace/workspace.ts';

export interface BuildOptions {
  dbFile?: string;
  /** SDK do Claude Code (modo real). Os testes passam uma versão simulada. */
  query?: QueryFn;
}

/** Monta o orquestrador. Demo e real usam bancos diferentes e nunca compartilham executores. */
export function buildApp(config: Config, opts: BuildOptions = {}) {
  let planner: Planner;
  let runner: Runner;
  let estimateTask: ((role: WorkerRole) => number) | undefined;
  const repo = openSqlite(opts.dbFile ?? path.join(config.dataDir, `${config.mode}.sqlite`));

  if (config.mode === 'real') {
    if (!opts.query) throw new Error('Modo real exige o Claude Agent SDK (use createRealApp)');
    const common = { query: opts.query, model: config.model, pathToClaudeCodeExecutable: config.claudePath };
    planner = new ClaudePlanner({ ...common, budgetUsd: config.planBudgetUsd, cwd: path.join(config.dataDir, 'planning') });
    runner = new ClaudeRunner({ ...common, taskBudgetUsd: config.taskBudgetUsd, maxTurns: config.maxTurns, sandbox: config.sandbox });
    const prices = { inputPerMTok: config.priceInputPerMTok, outputPerMTok: config.priceOutputPerMTok };
    // Usa a média real do cargo quando já houver execuções suficientes neste banco.
    estimateTask = (role) => calibratedEstimate(role, prices, repo.listTasks().filter((t) => t.status === 'done' || t.status === 'failed')).value;
  } else {
    // Modo demonstração: nada de IA, nada de custo, nenhum arquivo criado.
    planner = new DemoPlanner(config.demoSpeed);
    runner = new DemoRunner(config.demoSpeed);
  }

  const bus = new EventBus(repo, config.mode, systemClock);
  const engine = new Engine({
    mode: config.mode,
    repo,
    bus,
    planner,
    runner,
    workspaces: new Workspaces(config.workspacesDir),
    clock: systemClock,
    ids: uuidIds,
    maxConcurrency: config.maxConcurrency,
    projectBudgetUsd: config.projectBudgetUsd,
    estimateTask,
  });
  engine.init();
  return { repo, bus, engine };
}
