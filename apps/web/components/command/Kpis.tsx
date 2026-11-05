'use client';
import { useMemo } from 'react';
import { isEngagedState } from '@acc/shared';
import { formatUsd } from '@/lib/format';
import { useAcc } from '@/lib/store';

function Kpi({ label, value, hint, tone = 'text-slate-100' }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Kpis() {
  const projects = useAcc((s) => s.projects);
  const tasks = useAcc((s) => s.tasks);
  const agents = useAcc((s) => s.agents);
  const approvals = useAcc((s) => s.approvals);
  const mode = useAcc((s) => s.mode);
  const k = useMemo(() => {
    const ps = Object.values(projects);
    const ts = Object.values(tasks);
    const sum = (vals: (number | null)[]) => (vals.every((v) => v === null) ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0));
    return {
      active: ps.filter((p) => ['planning', 'awaiting_plan_approval', 'running', 'paused'].includes(p.status)).length,
      working: Object.values(agents).filter((a) => isEngagedState(a.state)).length,
      totalAgents: Object.keys(agents).length,
      pending: Object.values(approvals).filter((a) => a.status === 'pending').length,
      running: ts.filter((t) => t.status === 'running' || t.status === 'awaiting_approval').length,
      errors: ts.filter((t) => t.status === 'failed').length,
      estimated: sum(ps.map((p) => p.estimatedCostUsd)),
      measured: sum(ps.map((p) => p.costUsd)),
    };
  }, [projects, tasks, agents, approvals]);
  const costHint = mode === 'demo' ? 'modo demonstração: sem custo' : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7" data-testid="kpis">
      <Kpi label="Projetos ativos" value={k.active} />
      <Kpi label="Agentes trabalhando" value={`${k.working}/${k.totalAgents}`} />
      <Kpi label="Tarefas em andamento" value={k.running} />
      <Kpi label="Aprovações pendentes" value={k.pending} tone={k.pending ? 'text-amber-300' : undefined} />
      <Kpi label="Tarefas com erro" value={k.errors} tone={k.errors ? 'text-rose-300' : undefined} />
      <Kpi label="Custo estimado" value={formatUsd(k.estimated)} hint={costHint} />
      <Kpi label="Custo medido" value={formatUsd(k.measured)} hint={costHint ?? 'estimativa do SDK, não é fatura'} />
    </div>
  );
}
