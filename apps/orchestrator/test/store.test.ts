import { describe, expect, it } from 'vitest';
import { openSqlite } from '../src/store/sqlite.ts';
import type { Project } from '@acc/shared';

const project = (id: string, createdAt: string): Project => ({
  id, name: id, description: 'd', status: 'planning', mode: 'demo', createdAt, updatedAt: createdAt,
  budgetUsd: 1, costUsd: null, estimatedCostUsd: null, planSummary: null, statusReason: null,
});

describe('repositório SQLite', () => {
  it('grava, atualiza e lista entidades em ordem', () => {
    const repo = openSqlite(':memory:');
    repo.upsertProject(project('b', '2026-01-02'));
    repo.upsertProject(project('a', '2026-01-01'));
    repo.upsertProject({ ...project('a', '2026-01-01'), status: 'running' });
    expect(repo.listProjects().map((p) => [p.id, p.status])).toEqual([['a', 'running'], ['b', 'planning']]);
    expect(repo.getProject('zzz')).toBeNull();
  });

  it('numera eventos em sequência e filtra', () => {
    const repo = openSqlite(':memory:');
    const base = { ts: 'x', source: 'demo' as const, agentId: null, taskId: null, runId: null };
    const e1 = repo.appendEvent({ ...base, projectId: 'p1', type: 'log', level: 'info', message: 'um' });
    const e2 = repo.appendEvent({ ...base, projectId: 'p2', type: 'log', level: 'info', message: 'dois' });
    expect(e2.seq).toBe(e1.seq + 1);
    expect(repo.lastSeq()).toBe(e2.seq);
    expect(repo.listEvents({ after: e1.seq }).map((e) => e.seq)).toEqual([e2.seq]);
    expect(repo.listEvents({ projectId: 'p1' })).toHaveLength(1);
  });

  it('desfaz a transação em caso de erro', () => {
    const repo = openSqlite(':memory:');
    expect(() =>
      repo.transaction(() => {
        repo.upsertProject(project('a', '1'));
        throw new Error('falha');
      }),
    ).toThrow('falha');
    expect(repo.listProjects()).toHaveLength(0);
  });
});

describe('paginação e filtros do histórico', () => {
  it('"before" devolve os mais recentes antes do limite, em ordem crescente; "types" filtra', () => {
    const repo = openSqlite(':memory:');
    const base = { ts: 'x', source: 'demo' as const, projectId: null, agentId: null, taskId: null, runId: null };
    for (let i = 1; i <= 10; i++) repo.appendEvent({ ...base, type: 'log', level: 'info', message: String(i) });
    repo.appendEvent({ ...base, type: 'run.activity', activity: { kind: 'tool', state: 'typing', summary: 's', tool: 'Edit', detail: null } });
    expect(repo.listEvents({ before: 8, limit: 3 }).map((e) => e.seq)).toEqual([5, 6, 7]);
    expect(repo.listEvents({ types: ['run.activity'] }).map((e) => e.type)).toEqual(['run.activity']);
  });
});
