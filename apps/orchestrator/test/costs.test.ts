import { describe, expect, it } from 'vitest';
import { TYPICAL_TOKENS, estimateTaskCost } from '../src/costs/estimator.ts';
import { autoApprove, makeEngine, waitFor } from './helpers.ts';

const SONNET = { inputPerMTok: 2, outputPerMTok: 10 };

describe('estimativa de custo', () => {
  it('calcula pelo consumo típico e pelo preço do modelo', () => {
    const t = TYPICAL_TOKENS.programmer;
    expect(estimateTaskCost('programmer', SONNET)).toBeCloseTo((t.input / 1e6) * 2 + (t.output / 1e6) * 10, 4);
    expect(estimateTaskCost('designer', { inputPerMTok: 0, outputPerMTok: 0 })).toBe(0);
  });

  it('o plano mostra o custo estimado de cada tarefa e do projeto', async () => {
    const { engine, repo } = makeEngine({ estimateTask: (role) => estimateTaskCost(role, SONNET) });
    const p = engine.createProject({ name: 'Estimado', description: 'Página institucional com formulário' });
    const ap = await waitFor(() => repo.listApprovals({ status: 'pending' })[0], 3000);
    const tasks = repo.listTasks(p.id);
    const sum = tasks.reduce((s, t) => s + t.estimatedCostUsd!, 0);
    expect(tasks.every((t) => t.estimatedCostUsd! > 0)).toBe(true);
    expect(repo.getProject(p.id)!.estimatedCostUsd).toBeCloseTo(sum, 6);
    expect(ap.detail).toMatch(/Custo estimado: US\$ \d+\.\d{2}/);
  });

  it('no modo demo não há estimativa', async () => {
    const { engine, repo } = makeEngine();
    const p = engine.createProject({ name: 'Demo', description: 'Página institucional com formulário' });
    await waitFor(() => repo.listApprovals({ status: 'pending' })[0], 3000);
    expect(repo.getProject(p.id)!.estimatedCostUsd).toBeNull();
    expect(repo.listTasks(p.id).every((t) => t.estimatedCostUsd === null)).toBe(true);
  });
});

describe('pausar tudo', () => {
  it('pausa todos os projetos em execução', async () => {
    const { engine, repo } = makeEngine({ speed: 50, maxConcurrency: 3 });
    const a = engine.createProject({ name: 'Projeto A', description: 'Página institucional com formulário' });
    const b = engine.createProject({ name: 'Projeto B', description: 'Página institucional com formulário' });
    const stop = autoApprove(engine, repo);
    await waitFor(() => repo.listRuns({ status: 'running' }).length >= 1 && repo.getProject(b.id)!.status === 'running', 5000, 'execuções');
    stop();
    const running = repo.listProjects().filter((p) => p.status === 'running').map((p) => p.id).sort();
    const paused = engine.pauseAll();
    expect(running.length).toBeGreaterThan(0);
    expect(paused.map((p) => p.id).sort()).toEqual(running);
    expect(paused.every((p) => p.status === 'paused')).toBe(true);
    await waitFor(() => repo.listRuns({ status: 'running' }).length === 0, 3000, 'interrupção');
    expect(repo.listProjects().filter((p) => p.status === 'running')).toHaveLength(0);
    for (const p of [a, b]) engine.cancelProject(p.id);
    await engine.idle();
  });
});

describe('estimativa calibrada', () => {
  it('usa o consumo típico até ter execuções reais suficientes, depois a média real', async () => {
    const { calibratedEstimate, CALIBRATION_MIN_SAMPLES } = await import('../src/costs/estimator.ts');
    const typical = estimateTaskCost('tester', SONNET);
    expect(calibratedEstimate('tester', SONNET, [{ role: 'tester', costUsd: 1 }])).toEqual({ value: typical, basis: 'typical', samples: 1 });
    const history: { role: 'tester' | 'programmer'; costUsd: number | null }[] = Array.from({ length: CALIBRATION_MIN_SAMPLES }, (_, i) => ({ role: 'tester' as const, costUsd: 0.1 * (i + 1) }));
    history.push({ role: 'programmer', costUsd: 9 }, { role: 'tester', costUsd: null });
    expect(calibratedEstimate('tester', SONNET, history)).toEqual({ value: 0.2, basis: 'history', samples: 3 });
  });
});

describe('desligamento limpo', () => {
  it('pausa projetos em execução e encerra as execuções', async () => {
    const { engine, repo } = makeEngine({ speed: 20 });
    const p = engine.createProject({ name: 'Desligar', description: 'Página institucional com formulário' });
    const stop = autoApprove(engine, repo);
    await waitFor(() => repo.listRuns({ status: 'running' })[0], 3000, 'execução');
    stop();
    await engine.shutdown(2000);
    expect(repo.getProject(p.id)!.status).toBe('paused');
    expect(repo.getProject(p.id)!.statusReason).toMatch(/Orquestrador encerrado/);
    expect(repo.listRuns({ status: 'running' })).toHaveLength(0);
  });
});
