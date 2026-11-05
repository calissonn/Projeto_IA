import { DecisionInput, type AccEvent } from '@acc/shared';
import { DemoPlanner } from '../../orchestrator/src/coordinator/demoPlanner.ts';
import { EventBus } from '../../orchestrator/src/events/bus.ts';
import { DemoRunner } from '../../orchestrator/src/runners/demoRunner.ts';
import { Engine, EngineError } from '../../orchestrator/src/scheduler/engine.ts';
import { openMemory } from '../../orchestrator/src/store/memory.ts';
import { systemClock, uuidIds } from '../../orchestrator/src/util/runtime.ts';
import type { Workspaces } from '../../orchestrator/src/workspace/workspace.ts';
import { applyEvent, applySnapshot } from '../lib/reducer';
import { accStore, type Transport } from '../lib/store';

/**
 * O orquestrador inteiro rodando no navegador, em modo demonstração:
 * mesmo motor, mesmo planejador e executor de demonstração, banco em memória.
 */
export function createLocalTransport(speed = 1): Transport {
  const repo = openMemory();
  const bus = new EventBus(repo, 'demo', systemClock);
  const workspaces = { pathFor: (id: string) => `demo/${id}`, ensure: (id: string) => `demo/${id}` } as unknown as Workspaces;
  const engine = new Engine({
    mode: 'demo',
    repo,
    bus,
    planner: new DemoPlanner(speed),
    runner: new DemoRunner(speed),
    workspaces,
    clock: systemClock,
    ids: uuidIds,
    maxConcurrency: 2,
    projectBudgetUsd: 2,
  });
  engine.init();

  function route(path: string, body: unknown): unknown {
    const [p = '', qs = ''] = path.split('?');
    const q = new URLSearchParams(qs);
    const post = body !== undefined;
    let m: RegExpExecArray | null;
    if (!post && p === 'snapshot') return engine.snapshot();
    if (!post && p === 'health') return { ok: true, mode: 'demo' };
    if (!post && p === 'events') {
      return repo.listEvents({
        after: Number(q.get('after') ?? 0) || 0,
        before: q.get('before') ? Number(q.get('before')) || undefined : undefined,
        types: q.get('types')?.split(',').filter(Boolean),
        projectId: q.get('projectId') ?? undefined,
        agentId: q.get('agentId') ?? undefined,
        taskId: q.get('taskId') ?? undefined,
        runId: q.get('runId') ?? undefined,
        limit: Number(q.get('limit') ?? 1000) || 1000,
      });
    }
    if (post && p === 'projects') return engine.createProject(body);
    if (post && p === 'pause-all') return { paused: engine.pauseAll() };
    if (post && (m = /^projects\/([\w-]+)\/(pause|resume|cancel)$/.exec(p))) {
      const id = m[1]!;
      return m[2] === 'pause' ? engine.pauseProject(id) : m[2] === 'resume' ? engine.resumeProject(id) : engine.cancelProject(id);
    }
    if (!post && (m = /^projects\/([\w-]+)$/.exec(p))) {
      const project = repo.getProject(m[1]!);
      if (!project) throw new EngineError('Projeto não encontrado', 404);
      return { project, tasks: repo.listTasks(project.id), approvals: repo.listApprovals({ projectId: project.id }) };
    }
    if (post && (m = /^approvals\/([\w-]+)$/.exec(p))) {
      const parsed = DecisionInput.safeParse(body);
      if (!parsed.success) throw new EngineError('Decisão inválida');
      return engine.decide(m[1]!, parsed.data.decision, parsed.data.reason);
    }
    if (!post && (m = /^agents\/([\w-]+)$/.exec(p))) {
      const agent = repo.getAgent(m[1]!);
      if (!agent) throw new EngineError('Agente não encontrado', 404);
      return { agent, history: repo.listEvents({ agentId: agent.id, limit: 5000 }).filter((e) => e.type !== 'agent.upserted').slice(-300) };
    }
    if (!post && (m = /^runs\/([\w-]+)$/.exec(p))) {
      const run = repo.getRun(m[1]!);
      if (!run) throw new EngineError('Execução não encontrada', 404);
      return { run, events: repo.listEvents({ runId: run.id, limit: 5000 }) };
    }
    throw new EngineError('Rota não encontrada', 404);
  }

  return {
    async api<T>(path: string, body?: unknown): Promise<T> {
      // Assíncrono e com cópia, como uma chamada de rede de verdade.
      return structuredClone(route(path, body)) as T;
    },
    startSync() {
      const snap = engine.snapshot();
      const feed: AccEvent[] = repo.listEvents({ after: Math.max(0, snap.seq - 400), limit: 400 });
      accStore.setState({ ...applySnapshot(accStore.getState(), snap, feed), connected: true });
      return bus.subscribe((e) => accStore.setState(applyEvent(accStore.getState(), structuredClone(e))));
    },
  };
}
