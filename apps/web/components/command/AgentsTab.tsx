'use client';
import { useEffect, useMemo, useState } from 'react';
import { isEngagedState } from '@acc/shared';
import { STATE_LABELS } from '@/game/agents/behavior';
import { TASK_STATUS_LABEL, formatDuration, toneForStatus } from '@/lib/format';
import { selectAgent, useAcc } from '@/lib/store';
import { Badge, Card } from '../ui';

export function AgentsTab() {
  const agents = useAcc((s) => s.agents);
  const tasks = useAcc((s) => s.tasks);
  const projects = useAcc((s) => s.projects);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const list = useMemo(
    () => Object.values(agents).sort((a, b) => Number(isEngagedState(b.state)) - Number(isEngagedState(a.state)) || b.floor - a.floor),
    [agents],
  );
  return (
    <Card title="Agentes">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="agent-cards">
        {list.map((a) => {
          const task = a.currentTaskId ? tasks[a.currentTaskId] : undefined;
          const project = a.currentProjectId ? projects[a.currentProjectId] : undefined;
          const engaged = isEngagedState(a.state);
          const tone = a.state === 'error' ? 'bad' : a.state === 'awaiting_approval' || a.state === 'paused' ? 'warn' : a.state === 'done' ? 'ok' : engaged ? 'info' : 'neutral';
          return (
            <li key={a.id}>
              <button onClick={() => selectAgent(a.id)} className={`h-full w-full rounded-xl border p-4 text-left transition hover:border-slate-400 ${engaged ? 'border-sky-400/40 bg-sky-400/5' : 'border-line'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-slate-400">
                      {a.title} · {a.floor}º andar
                    </p>
                  </div>
                  <Badge tone={tone}>{STATE_LABELS[a.state]}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{a.stateDetail ?? (engaged ? '' : 'Sem execução ativa')}</p>
                {task && (
                  <p className="mt-2 text-xs text-slate-400">
                    Tarefa: <span className="text-slate-200">{task.title}</span>
                    {project && <> · {project.name}</>}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">neste estado há {formatDuration(now - Date.parse(a.stateSince))}</p>
                {task && <Badge tone={toneForStatus(task.status)}>Tarefa: {TASK_STATUS_LABEL[task.status]}</Badge>}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
