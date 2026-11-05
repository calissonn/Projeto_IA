import { describe, expect, it } from 'vitest';
import { isEngagedState } from '@acc/shared';
import { openMemory } from '../src/store/memory.ts';
import { autoApprove, makeEngine, waitFor } from './helpers.ts';

describe('repositório em memória (versão para celular)', () => {
  it('roda o fluxo completo do motor igual ao SQLite', async () => {
    const { engine, repo } = makeEngine({ repo: openMemory() });
    const p = engine.createProject({ name: 'Na memória', description: 'Página institucional com formulário' });
    const stop = autoApprove(engine, repo);
    await waitFor(() => repo.getProject(p.id)!.status === 'completed', 5000, 'conclusão');
    stop();
    await engine.idle();
    expect(repo.listTasks(p.id).every((t) => t.status === 'done')).toBe(true);
    expect(repo.listAgents().every((a) => !isEngagedState(a.state))).toBe(true);
    const events = repo.listEvents({ limit: 5000 });
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(repo.listEvents({ before: 5, limit: 2 }).map((e) => e.seq)).toEqual([3, 4]);
    expect(repo.listEvents({ types: ['run.started'] }).length).toBe(3);
  });

  it('devolve cópias (alterar o objeto lido não altera o banco)', () => {
    const repo = openMemory();
    repo.upsertAgent({ id: 'a', name: 'A' } as never);
    const a = repo.getAgent('a')!;
    a.name = 'B';
    expect(repo.getAgent('a')!.name).toBe('A');
  });
});
