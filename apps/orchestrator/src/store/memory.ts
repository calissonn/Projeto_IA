import type { AccEvent, Agent, Approval, Project, Run, Task, UnsequencedEvent } from '@acc/shared';
import type { EventQuery, Repository } from './repository.ts';

/**
 * Repositório em memória, com o mesmo comportamento do SQLite.
 * Usado pela versão standalone (navegador/celular) do modo demonstração.
 */
export function openMemory(): Repository {
  const agents = new Map<string, Agent>();
  const projects = new Map<string, Project>();
  const tasks = new Map<string, Task>();
  const approvals = new Map<string, Approval>();
  const runs = new Map<string, Run>();
  const events: AccEvent[] = [];
  const clone = <T>(v: T): T => structuredClone(v);
  const byCreated = <T>(list: T[], key: (v: T) => string) => list.sort((a, b) => key(a).localeCompare(key(b)));

  return {
    listAgents: () => byCreated([...agents.values()].map(clone), (a) => a.id),
    getAgent: (id) => (agents.has(id) ? clone(agents.get(id)!) : null),
    upsertAgent: (a) => void agents.set(a.id, clone(a)),

    listProjects: () => byCreated([...projects.values()].map(clone), (p) => p.createdAt),
    getProject: (id) => (projects.has(id) ? clone(projects.get(id)!) : null),
    upsertProject: (p) => void projects.set(p.id, clone(p)),

    listTasks: (projectId) => [...tasks.values()].filter((t) => !projectId || t.projectId === projectId).map(clone).sort((a, b) => a.order - b.order),
    getTask: (id) => (tasks.has(id) ? clone(tasks.get(id)!) : null),
    upsertTask: (t) => void tasks.set(t.id, clone(t)),

    listApprovals: (f = {}) =>
      byCreated(
        [...approvals.values()].filter((a) => (!f.status || a.status === f.status) && (!f.projectId || a.projectId === f.projectId)).map(clone),
        (a) => a.createdAt,
      ),
    getApproval: (id) => (approvals.has(id) ? clone(approvals.get(id)!) : null),
    upsertApproval: (a) => void approvals.set(a.id, clone(a)),

    listRuns: (f = {}) => byCreated([...runs.values()].filter((r) => (!f.status || r.status === f.status) && (!f.taskId || r.taskId === f.taskId)).map(clone), (r) => r.startedAt),
    getRun: (id) => (runs.has(id) ? clone(runs.get(id)!) : null),
    upsertRun: (r) => void runs.set(r.id, clone(r)),

    appendEvent(event: UnsequencedEvent) {
      const e = { ...clone(event), seq: events.length + 1 } as AccEvent;
      events.push(e);
      return clone(e);
    },
    listEvents(q: EventQuery = {}) {
      const limit = Math.min(Math.max(q.limit ?? 1000, 1), 5000);
      const match = events.filter(
        (e) =>
          e.seq > (q.after ?? 0) &&
          (q.before === undefined || e.seq < q.before) &&
          (!q.types?.length || q.types.includes(e.type)) &&
          (!q.projectId || e.projectId === q.projectId) &&
          (!q.agentId || e.agentId === q.agentId) &&
          (!q.taskId || e.taskId === q.taskId) &&
          (!q.runId || e.runId === q.runId),
      );
      const page = q.before !== undefined ? match.slice(-limit) : match.slice(0, limit);
      return page.map(clone);
    },
    lastSeq: () => events.length,
    transaction: (fn) => fn(),
    close: () => undefined,
  };
}
