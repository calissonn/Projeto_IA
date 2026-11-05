'use client';
import { useState } from 'react';
import type { Project } from '@acc/shared';
import { api } from '@/lib/store';
import { ConfirmButton } from './ConfirmButton';
import { Button } from './ui';

/** Pausar, retomar e cancelar um projeto. */
export function ProjectControls({ project, compact = false }: { project: Project; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'pause' | 'resume' | 'cancel') {
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
      <ConfirmButton className={size} disabled={busy} confirmLabel="Toque de novo para cancelar" onConfirm={() => run('cancel')}>
        Cancelar
      </ConfirmButton>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
