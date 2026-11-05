'use client';
import { AgentLegend } from './AgentLegend';
import { Approvals } from './Approvals';
import { Feed } from './Feed';
import { NewProject } from './NewProject';
import { PhaserGame } from './PhaserGame';
import { Projects } from './Projects';

export function Dashboard() {
  return (
    <main className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <PhaserGame />
        <AgentLegend />
        <p className="text-xs text-slate-400">Clique num personagem para ver o que ele está fazendo. As animações refletem somente o estado real informado pelo orquestrador.</p>
      </div>
      <div className="min-w-0 space-y-4">
        <Approvals />
        <NewProject />
        <Projects />
        <Feed />
      </div>
    </main>
  );
}
