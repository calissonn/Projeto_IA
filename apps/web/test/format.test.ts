import { describe, expect, it } from 'vitest';
import type { AccEvent, Task } from '@acc/shared';
import { LOG_CATEGORIES, dedupeKey, describeLogEvent, formatDuration, formatUsd } from '../lib/format';

const meta = { seq: 1, ts: 't', source: 'demo' as const, projectId: 'p', agentId: null, taskId: null, runId: null };
const task = { id: 't1', title: 'Testes', status: 'failed' } as Task;

describe('formatação', () => {
  it('durações e valores', () => {
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(65_000)).toBe('1min 05s');
    expect(formatDuration(3_700_000)).toBe('1h 01min');
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(1.234)).toBe('US$ 1.23');
  });

  it('descreve mudanças de tarefa para os logs', () => {
    const e = { ...meta, type: 'task.upserted', task } as AccEvent;
    expect(describeLogEvent(e)).toEqual({ text: 'Tarefa "Testes": falhou', tone: 'bad' });
    expect(dedupeKey(e)).toBe('t:t1:failed');
  });

  it('toda categoria de log tem tipos e "Tudo" cobre as demais', () => {
    const all = new Set(LOG_CATEGORIES.find((c) => c.id === 'all')!.types);
    for (const c of LOG_CATEGORIES) {
      expect(c.types.length).toBeGreaterThan(0);
      for (const t of c.types) expect(all.has(t)).toBe(true);
    }
  });
});
