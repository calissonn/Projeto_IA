'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { PROJECT_STATUS_LABEL, ROLE_LABEL, formatUsd, toneForStatus } from '@/lib/format';
import { useAcc } from '@/lib/store';
import { Badge, Card, Empty } from '../ui';

export function CostsTab() {
  const projects = useAcc((s) => s.projects);
  const tasks = useAcc((s) => s.tasks);
  const mode = useAcc((s) => s.mode);
  const list = useMemo(() => Object.values(projects).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [projects]);
  const byRole = useMemo(() => {
    const out: Record<string, { estimated: number | null; measured: number | null }> = {};
    for (const t of Object.values(tasks)) {
      const r = (out[t.role] ??= { estimated: null, measured: null });
      if (t.estimatedCostUsd !== null) r.estimated = (r.estimated ?? 0) + t.estimatedCostUsd;
      if (t.costUsd !== null) r.measured = (r.measured ?? 0) + t.costUsd;
    }
    return out;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <Card title="Como os custos são calculados">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>
            <strong>Estimado</strong>: calculado ao montar o plano, pelo consumo típico de cada cargo × preço do modelo configurado
            (padrão Claude Sonnet 5.5: US$ 2 por milhão de tokens de entrada e US$ 10 por milhão de saída). É uma ordem de grandeza.
          </li>
          <li>
            <strong>Medido</strong>: informado pelo Claude Agent SDK ao final de cada execução. É a estimativa do próprio SDK, não uma fatura.
          </li>
          <li>Ao atingir o orçamento, o projeto é pausado automaticamente.</li>
          {mode === 'demo' && <li className="text-amber-200">Modo demonstração: nenhuma IA é chamada, portanto não há custo — os valores aparecem como “—”.</li>}
        </ul>
      </Card>
      <Card title="Custos por projeto">
        {list.length === 0 ? (
          <Empty>Nenhum projeto.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm" data-testid="cost-table">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Projeto</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3 text-right">Orçamento</th>
                  <th className="py-2 pr-3 text-right">Estimado</th>
                  <th className="py-2 pr-3 text-right">Medido</th>
                  <th className="py-2">Uso do orçamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => {
                  const pct = p.costUsd !== null && p.budgetUsd > 0 ? Math.min(100, (p.costUsd / p.budgetUsd) * 100) : null;
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-3">
                        <Link href={`/command/projects/${p.id}`} className="text-teal-200 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={toneForStatus(p.status)}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatUsd(p.budgetUsd)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatUsd(p.estimatedCostUsd)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatUsd(p.costUsd)}</td>
                      <td className="py-2">
                        {pct === null ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-700">
                              <div className={`h-full ${pct >= 90 ? 'bg-rose-400' : pct >= 60 ? 'bg-amber-400' : 'bg-teal-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-slate-400">{pct.toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Custos por cargo">
        <dl className="grid gap-3 sm:grid-cols-3">
          {(['programmer', 'designer', 'tester'] as const).map((r) => (
            <div key={r} className="rounded-lg border border-line p-3">
              <dt className="text-sm font-medium">{ROLE_LABEL[r]}</dt>
              <dd className="mt-1 text-xs text-slate-400">
                estimado {formatUsd(byRole[r]?.estimated ?? null)} · medido {formatUsd(byRole[r]?.measured ?? null)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
