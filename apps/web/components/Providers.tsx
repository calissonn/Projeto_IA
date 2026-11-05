'use client';
import { useEffect, type ReactNode } from 'react';
import { startSync } from '@/lib/store';
import { AgentPanel } from './AgentPanel';
import { Header } from './Header';

/** Uma única conexão de eventos para todas as páginas. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => startSync(), []);
  return (
    <div className="min-h-screen">
      <Header />
      {children}
      <AgentPanel />
    </div>
  );
}
