'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAcc } from '@/lib/store';

const NAV = [
  { href: '/', label: 'Prédio' },
  { href: '/command', label: 'Central de Comando' },
];

export function Header() {
  const mode = useAcc((s) => s.mode);
  const connected = useAcc((s) => s.connected);
  const synced = useAcc((s) => s.synced);
  const approvals = useAcc((s) => s.approvals);
  const pending = useMemo(() => Object.values(approvals).filter((a) => a.status === 'pending').length, [approvals]);
  const path = usePathname();
  return (
    <>
      {mode === 'demo' && (
        <div role="status" className="bg-amber-400 px-4 py-1.5 text-center text-sm font-bold text-amber-950" data-testid="demo-banner">
          MODO DEMONSTRAÇÃO — nada aqui é execução real: nenhuma IA é chamada, nenhum arquivo é criado e nenhum custo é gerado
        </div>
      )}
      {mode === 'real' && (
        <div role="status" className="bg-rose-600 px-4 py-1.5 text-center text-sm font-bold text-white">
          MODO REAL — os agentes executam o Claude Code de verdade e geram custos
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500/20 font-mono text-lg font-bold text-teal-300 ring-1 ring-teal-400/40">AI</div>
          <div>
            <h1 className="text-lg font-bold leading-tight">AI Command Center</h1>
            <p className="text-xs text-slate-400">Empresa virtual de agentes de IA com supervisão humana</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1 text-sm" aria-label="Navegação principal">
          {NAV.map((n) => {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 font-medium transition ${active ? 'bg-teal-500/20 text-teal-200' : 'text-slate-300 hover:bg-slate-700/40'}`}
              >
                {n.label}
                {n.href === '/command' && pending > 0 && <span className="ml-1.5 rounded bg-amber-400 px-1.5 text-xs font-bold text-amber-950">{pending}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-xs" data-testid="connection">
          <span className={`h-2.5 w-2.5 rounded-full ${connected && synced ? 'bg-emerald-400' : connected ? 'bg-amber-400' : 'bg-rose-500'}`} />
          {connected && synced ? 'Conectado ao orquestrador' : connected ? 'Sincronizando…' : 'Sem conexão com o orquestrador'}
        </div>
      </header>
    </>
  );
}
