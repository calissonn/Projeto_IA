'use client';
import { useState } from 'react';
import type { Project } from '@acc/shared';
import { api } from '@/lib/store';
import { Button } from './ui';

/** Pausar, retomar e cancelar um projeto. */
export function ProjectControls({ project, compact = false }: { project: Project; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'pause' | 'resume' | 'cancel') {
    if (action === 'cancel' && !window.confirm(`Cancelar o projeto "${project.name}"? As tarefas em andamento serão interrompidas.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`projects/${project.id}/${action}`, {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const finished = ['completed', 'failed', 'cancelled'].includes(project.status);
  if (finished) return null;
  const size = compact ? 'px-2 py-1 text-xs' : '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {project.status === 'running' && (
        <Button variant="ghost" className={size} disabled={busy} onClick={() => run('pause')}>
          ⏸ Pausar
        </Button>
      )}
      {project.status === 'paused' && (
        <Button variant="ok" className={size} disabled={busy} onClick={() => run('resume')}>
          ▶ Retomar
        </Button>
      )}
      <Button variant="danger" className={size} disabled={busy} onClick={() => run('cancel')}>
        Cancelar
      </Button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
