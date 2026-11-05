'use client';
import { useMemo, useState } from 'react';
import { RISK_LABELS, type Approval } from '@acc/shared';
import { formatTime, toneForStatus } from '@/lib/format';
import { api, useAcc } from '@/lib/store';
import { Badge, Button, Card, Empty } from './ui';

const STATUS_LABEL: Record<Approval['status'], string> = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada', expired: 'Expirada' };

function PendingItem({ a }: { a: Approval }) {
  const agents = useAcc((s) => s.agents);
  const projects = useAcc((s) => s.projects);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await api(`approvals/${a.id}`, { decision, reason: reason.trim() || undefined });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warn">{RISK_LABELS[a.category]}</Badge>
        <span className="text-xs text-slate-400">
          {agents[a.agentId]?.name} · {projects[a.projectId]?.name} · {formatTime(a.createdAt)}
        </span>
      </div>
      <p className="mt-2 font-medium">{a.title}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{a.detail}</p>
      {a.kind === 'action' && a.payload != null && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-400">Dados técnicos do pedido</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/40 p-2 text-slate-300">{JSON.stringify(a.payload, null, 2)}</pre>
        </details>
      )}
      {rejecting && (
        <label className="mt-3 block text-sm">
          <span className="text-slate-300">Motivo da rejeição (opcional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-1.5 outline-none focus:border-rose-400"
            placeholder="Ex.: escopo errado, use outra biblioteca…"
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!rejecting ? (
          <>
            <Button variant="ok" disabled={busy} onClick={() => decide('approve')}>
              Aprovar
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)}>
              Rejeitar
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" disabled={busy} onClick={() => decide('reject')}>
              Confirmar rejeição
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
              Voltar
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function Approvals({ projectId, title = 'Fila de aprovação' }: { projectId?: string; title?: string }) {
  const approvals = useAcc((s) => s.approvals);
  const pending = useMemo(
    () =>
      Object.values(approvals)
        .filter((a) => a.status === 'pending' && (!projectId || a.projectId === projectId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [approvals, projectId],
  );
  return (
    <Card title={<>{title} {pending.length > 0 && <Badge tone="warn">{pending.length}</Badge>}</>}>
      {pending.length === 0 ? (
        <Empty>Nada aguardando sua decisão.</Empty>
      ) : (
        <ul className="space-y-3" data-testid="approvals">
          {pending.map((a) => (
            <PendingItem key={a.id} a={a} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Histórico de decisões (aprovadas, rejeitadas e expiradas). */
export function ApprovalHistory({ projectId }: { projectId?: string }) {
  const approvals = useAcc((s) => s.approvals);
  const agents = useAcc((s) => s.agents);
  const projects = useAcc((s) => s.projects);
  const decided = useMemo(
    () =>
      Object.values(approvals)
        .filter((a) => a.status !== 'pending' && (!projectId || a.projectId === projectId))
        .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '')),
    [approvals, projectId],
  );
  return (
    <Card title="Histórico de aprovações">
      {decided.length === 0 ? (
        <Empty>Nenhuma decisão registrada.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="approval-history">
            <thead className="text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2 pr-3">Decisão</th>
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Agente / projeto</th>
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {decided.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <Badge tone={toneForStatus(a.status === 'expired' ? 'paused' : a.status)}>{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="py-2 pr-3">{a.title}</td>
                  <td className="py-2 pr-3 text-slate-300">{RISK_LABELS[a.category]}</td>
                  <td className="py-2 pr-3 text-slate-300">
                    {agents[a.agentId]?.name} · {projects[a.projectId]?.name}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{a.decidedAt ? formatTime(a.decidedAt) : '—'}</td>
                  <td className="py-2 text-slate-300">{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
