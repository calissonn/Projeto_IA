'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RUN_STATUS_LABEL, TASK_STATUS_LABEL, formatTime, toneForStatus } from '@/lib/format';
import { selectAgent, useAcc } from '@/lib/store';
import { LogViewer } from '../LogViewer';
import { RunDetails } from '../RunDetails';
import { Badge, Button, Card, Empty } from '../ui';

export function ErrorsTab() {
  const tasks = useAcc((s) => s.tasks);
  const runs = useAcc((s) => s.runs);
  const agents = useAcc((s) => s.agents);
  const projects = useAcc((s) => s.projects);
  const [runId, setRunId] = useState<string | null>(null);
  const problems = useMemo(
    () => Object.values(tasks).filter((t) => t.status === 'failed' || t.status === 'blocked' || (t.tests?.failed ?? 0) > 0).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')),
    [tasks],
  );
  const badRuns = useMemo(() => Object.values(runs).filter((r) => r.status === 'failed' || r.status === 'aborted').sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [runs]);

  return (
    <div className="space-y-4">
      <Card title={<>Tarefas com problema {problems.length > 0 && <Badge tone="bad">{problems.length}</Badge>}</>}>
        {problems.length === 0 ? (
          <Empty>Nenhum erro encontrado.</Empty>
        ) : (
          <ul className="space-y-3" data-testid="error-list">
            {problems.map((t) => (
              <li key={t.id} className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={toneForStatus(t.status)}>{TASK_STATUS_LABEL[t.status]}</Badge>
                  <span className="font-medium">{t.title}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  <Link className="hover:underline" href={`/command/projects/${t.projectId}`}>
                    {projects[t.projectId]?.name}
                  </Link>
                  {t.agentId && (
                    <>
                      {' · '}
                      <button className="hover:underline" onClick={() => selectAgent(t.agentId)}>
                        {agents[t.agentId]?.name}
                      </button>
                    </>
                  )}
                  {t.finishedAt && <> · {formatTime(t.finishedAt)}</>}
                </p>
                {t.error && <p className="mt-2 text-sm text-rose-200">{t.error}</p>}
                {t.tests && t.tests.failed > 0 && (
                  <p className="mt-1 text-sm text-rose-200">
                    Testes: {t.tests.failed} de {t.tests.total} falharam {t.tests.output ? `— ${t.tests.output}` : ''}
                  </p>
                )}
                {t.runId && (
                  <Button variant="ghost" className="mt-2 px-2 py-1 text-xs" onClick={() => setRunId(t.runId)}>
                    Ver detalhes da execução
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Execuções interrompidas ou com falha">
        {badRuns.length === 0 ? (
          <Empty>Nenhuma.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {badRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Badge tone={r.status === 'failed' ? 'bad' : 'warn'}>{RUN_STATUS_LABEL[r.status]}</Badge> <span className="ml-1">{tasks[r.taskId]?.title}</span>
                  <span className="ml-1 text-xs text-slate-400">
                    · {agents[r.agentId]?.name} · {formatTime(r.startedAt)}
                  </span>
                  {r.error && <span className="block text-xs text-slate-400">{r.error}</span>}
                </span>
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setRunId(r.id)}>
                  Detalhes
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <LogViewer title="Eventos de erro e alerta" problemsOnly />
      {runId && <RunDetails runId={runId} onClose={() => setRunId(null)} />}
    </div>
  );
}
