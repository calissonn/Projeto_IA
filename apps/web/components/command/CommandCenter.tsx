'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, useAcc } from '@/lib/store';
import { ApprovalHistory, Approvals } from '../Approvals';
import { LogViewer } from '../LogViewer';
import { Button } from '../ui';
import { AgentsTab } from './AgentsTab';
import { CostsTab } from './CostsTab';
import { ErrorsTab } from './ErrorsTab';
import { Kpis } from './Kpis';
import { ProjectsTab } from './ProjectsTab';

const TABS = [
  { id: 'projetos', label: 'Projetos' },
  { id: 'agentes', label: 'Agentes' },
  { id: 'aprovacoes', label: 'Aprovações' },
  { id: 'erros', label: 'Erros' },
  { id: 'custos', label: 'Custos' },
  { id: 'logs', label: 'Histórico e logs' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function CommandCenter() {
  const [tab, setTab] = useState<TabId>('projetos');
  const approvals = useAcc((s) => s.approvals);
  const tasks = useAcc((s) => s.tasks);
  const projects = useAcc((s) => s.projects);
  const [pausing, setPausing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const counts = useMemo(
    () => ({
      aprovacoes: Object.values(approvals).filter((a) => a.status === 'pending').length,
      erros: Object.values(tasks).filter((t) => t.status === 'failed').length,
    }),
    [approvals, tasks],
  );
  const anyRunning = useMemo(() => Object.values(projects).some((p) => p.status === 'running'), [projects]);

  // A aba fica no endereço (#aprovacoes) para poder ser compartilhada e restaurada.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  const choose = (id: TabId) => {
    setTab(id);
    history.replaceState(null, '', `#${id}`);
  };

  async function pauseAll() {
    if (!window.confirm('Pausar todas as execuções em andamento?')) return;
    setPausing(true);
    setMessage(null);
    try {
      const r = await api<{ paused: unknown[] }>('pause-all', {});
      setMessage(`${r.paused.length} projeto(s) pausado(s).`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPausing(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Central de Comando</h2>
          <p className="text-sm text-slate-400">Crie projetos, acompanhe agentes e tarefas, decida aprovações e controle custos.</p>
        </div>
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-slate-300">{message}</span>}
          <Button variant="danger" disabled={pausing || !anyRunning} onClick={pauseAll} title={anyRunning ? '' : 'Nenhum projeto em execução'}>
            ⏸ Pausar todas as execuções
          </Button>
        </div>
      </div>
      <Kpis />
      <div role="tablist" aria-label="Seções da Central de Comando" className="flex gap-1 overflow-x-auto border-b border-line scrollbar-thin">
        {TABS.map((t) => {
          const count = t.id === 'aprovacoes' ? counts.aprovacoes : t.id === 'erros' ? counts.erros : 0;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => choose(t.id)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'border-teal-400 text-teal-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
              {count > 0 && <span className={`ml-1.5 rounded px-1.5 text-xs font-bold ${t.id === 'erros' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-amber-950'}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {tab === 'projetos' && <ProjectsTab />}
        {tab === 'agentes' && <AgentsTab />}
        {tab === 'aprovacoes' && (
          <div className="space-y-4">
            <Approvals title="Aguardando sua decisão" />
            <ApprovalHistory />
          </div>
        )}
        {tab === 'erros' && <ErrorsTab />}
        {tab === 'custos' && <CostsTab />}
        {tab === 'logs' && <LogViewer />}
      </div>
    </main>
  );
}
