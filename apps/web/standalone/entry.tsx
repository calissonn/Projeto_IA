import { createRoot } from 'react-dom/client';
import { Dashboard } from '../components/Dashboard';
import { Providers } from '../components/Providers';
import { CommandCenter } from '../components/command/CommandCenter';
import { ProjectDetail } from '../components/command/ProjectDetail';
import { setTransport } from '../lib/store';
import { createLocalTransport } from './localTransport';
import { useRoute } from './router';

setTransport(createLocalTransport(1));

function Page() {
  const route = useRoute();
  if (route.page === 'projeto' && route.projectId) return <ProjectDetail id={route.projectId} />;
  if (route.page === 'central') return <CommandCenter />;
  return <Dashboard />;
}

function App() {
  return (
    <Providers>
      <Page />
      <footer className="mx-auto max-w-[1500px] px-4 pb-8 text-xs text-slate-500 sm:px-6">
        Versão para celular do AI Command Center: o orquestrador e os agentes de demonstração rodam no seu navegador. Nada é
        enviado a servidores e nenhuma IA é chamada. Recarregar a página recomeça a demonstração.
      </footer>
    </Providers>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
