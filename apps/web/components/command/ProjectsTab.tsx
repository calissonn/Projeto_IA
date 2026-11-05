'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PROJECT_STATUSES } from '@acc/shared';
import { PROJECT_STATUS_LABEL, formatUsd, toneForStatus } from '@/lib/format';
import { useAcc } from '@/lib/store';
import { NewProject } from '../NewProject';
import { ProjectControls } from '../ProjectControls';
import { Badge, Card, Empty } from '../ui';

export function ProjectsTab() {
  const projects = useAcc((s) => s.projects);
  const tasks = useAcc((s) => s.tasks);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      Object.values(projects)
        .filter((p) => (!status || p.status === status) && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [projects, status, q],
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Projetos">
        <div className="mb-3 flex flex-wrap gap-2">
          <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-ink px-2 py-1.5 text-sm">
            <option value="">Todas as situações</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input aria-label="Buscar projeto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar projeto…" className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-2 py-1.5 text-sm" />
        </div>
        {list.length === 0 ? (
          <Empty>Nenhum projeto encontrado.</Empty>
        ) : (
          <ul className="divide-y divide-line" data-testid="project-list">
            {list.map((p) => {
              const pt = Object.values(tasks).filter((t) => t.projectId === p.id);
              const done = pt.filter((t) => t.status === 'done').length;
              const failed = pt.filter((t) => t.status === 'failed').length;
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/command/projects/${p.id}`} className="font-medium text-teal-200 hover:underline">
                        {p.name}
                      </Link>
                      <Badge tone={toneForStatus(p.status)}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                    </div>
                    <p className="truncate text-xs text-slate-400">{p.description}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {pt.length ? `${done}/${pt.length} tarefas concluídas` : 'Plano em elaboração'}
                      {failed > 0 && <span className="text-rose-300"> · {failed} com erro</span>} · estimado {formatUsd(p.estimatedCostUsd)} · medido {formatUsd(p.costUsd)} ·{' '}
                      {new Date(p.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ProjectControls project={p} compact />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <NewProject />
    </div>
  );
}
