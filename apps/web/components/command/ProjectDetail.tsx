'use client';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import type { Task } from '@acc/shared';
import { PROJECT_STATUS_LABEL, ROLE_LABEL, TASK_STATUS_LABEL, formatDuration, formatUsd, toneForStatus } from '@/lib/format';
import { selectAgent, useAcc } from '@/lib/store';
import { ApprovalHistory, Approvals } from '../Approvals';
import { LogViewer } from '../LogViewer';
import { ProjectControls } from '../ProjectControls';
import { RunDetails } from '../RunDetails';
import { Badge, Button, Card, Empty } from '../ui';

function TaskExtra({ t, onRun }: { t: Task; onRun: (id: string) => void }) {
  const mode = useAcc((s) => s.mode);
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">Descrição</p>
        <p className="text-slate-200">{t.description}</p>
        {t.acceptanceCriteria.length > 0 && (
          <>
            <p className="mt-2 text-xs uppercase tracking-wider text-slate-400">Critérios de aceite</p>
            <ul className="list-disc pl-5 text-slate-300">
              {t.acceptanceCriteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}
        {t.summary && <p className="mt-2 text-slate-300">{t.summary}</p>}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">Arquivos {mode === 'demo' && <span className="normal-case text-amber-300">(demonstração)</span>}</p>
        {t.filesChanged.length ? (
          <ul className="font-mono text-xs text-slate-300">
            {t.filesChanged.map((f) => (
              <li key={f.path + f.change}>
                {f.change === 'created' ? '+' : f.change === 'deleted' ? '−' : '~'} {f.path}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">nenhum</p>
        )}
        {t.tests && (
          <p className="mt-2">
            Testes: <span className="text-emerald-300">{t.tests.passed} passaram</span>, <span className={t.tests.failed ? 'text-rose-300' : ''}>{t.tests.failed} falharam</span> de {t.tests.total}
          </p>
        )}
        {t.error && <p className="mt-2 text-rose-300">{t.error}</p>}
        {t.runId && (
          <Button variant="ghost" className="mt-2 px-2 py-1 text-xs" onClick={() => onRun(t.runId!)}>
            Ver detalhes da execução
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const project = useAcc((s) => s.projects[id]);
  const synced = useAcc((s) => s.synced);
  const allTasks = useAcc((s) => s.tasks);
  const agents = useAcc((s) => s.agents);
  const [open, setOpen] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const tasks = useMemo(() => Object.values(allTasks).filter((t) => t.projectId === id).sort((a, b) => a.order - b.order), [allTasks, id]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  if (!project) {
    return (
      <main className="mx-auto max-w-[1500px] px-4 sm:px-6">
        <Empty>{synced ? 'Projeto não encontrado.' : 'Carregando…'}</Empty>
        <Link href="/command" className="mt-2 inline-block text-sm text-teal-300 hover:underline">
          ← Voltar à Central de Comando
        </Link>
      </main>
    );
  }
  const done = tasks.filter((t) => t.status === 'done').length;
  const now = Date.now();
  return (
    <main className="mx-auto max-w-[1500px] space-y-4 px-4 pb-10 sm:px-6" data-testid="project-detail">
      <Link href="/command" className="text-sm text-teal-300 hover:underline">
        ← Central de Comando
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{project.name}</h2>
            <Badge tone={toneForStatus(project.status)}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">{project.description}</p>
          {project.statusReason && <p className="mt-1 text-xs text-slate-400">{project.statusReason}</p>}
        </div>
        <ProjectControls project={project} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Progresso', tasks.length ? `${done}/${tasks.length} tarefas` : '—'],
          ['Orçamento', formatUsd(project.budgetUsd)],
          ['Custo estimado', formatUsd(project.estimatedCostUsd)],
          ['Custo medido', formatUsd(project.costUsd)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-panel px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">{l}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {project.planSummary && (
        <Card title="Plano da coordenadora">
          <p className="text-sm text-slate-300">{project.planSummary}</p>
        </Card>
      )}

      <Card title="Tarefas">
        {tasks.length === 0 ? (
          <Empty>A coordenadora ainda está montando o plano.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm" data-testid="task-table">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Tarefa</th>
                  <th className="py-2 pr-3">Cargo / agente</th>
                  <th className="py-2 pr-3">Depende de</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3">Tempo</th>
                  <th className="py-2 pr-3 text-right">Custo</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tasks.map((t, i) => (
                  <Fragment key={t.id}>
                    <tr>
                      <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">{t.title}</td>
                      <td className="py-2 pr-3 text-slate-300">
                        {ROLE_LABEL[t.role]}
                        {t.agentId && (
                          <button className="ml-1 text-teal-200 hover:underline" onClick={() => selectAgent(t.agentId)}>
                            · {agents[t.agentId]?.name}
                          </button>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">{t.dependsOn.length ? t.dependsOn.map((d) => `#${tasks.indexOf(byId.get(d)!) + 1}`).join(', ') : '—'}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={toneForStatus(t.status)}>{TASK_STATUS_LABEL[t.status]}</Badge>
                        {t.attempts > 1 && <span className="ml-1 text-xs text-slate-400">{t.attempts} tentativas</span>}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-slate-300">
                        {t.startedAt ? formatDuration((t.finishedAt ? Date.parse(t.finishedAt) : now) - Date.parse(t.startedAt)) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs tabular-nums text-slate-300">
                        {formatUsd(t.costUsd)}
                        <span className="block text-slate-500">est. {formatUsd(t.estimatedCostUsd)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" className="px-2 py-1 text-xs" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
                          {open === t.id ? 'Fechar' : 'Detalhes'}
                        </Button>
                      </td>
                    </tr>
                    {open === t.id && (
                      <tr>
                        <td colSpan={8} className="bg-black/20 px-3 py-3">
                          <TaskExtra t={t} onRun={setRunId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Approvals projectId={id} title="Aprovações pendentes deste projeto" />
        <ApprovalHistory projectId={id} />
      </div>
      <LogViewer projectId={id} title="Histórico do projeto" />
      {runId && <RunDetails runId={runId} onClose={() => setRunId(null)} />}
    </main>
  );
}
