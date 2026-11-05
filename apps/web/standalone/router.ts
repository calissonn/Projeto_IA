import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/**
 * Navegação da versão standalone (sem servidor Next). Usa só "#nome" no endereço:
 * #predio, #central (e as abas da Central, como #aprovacoes). O detalhe de projeto fica em memória.
 */
const CENTRAL_HASHES = new Set(['central', 'projetos', 'agentes', 'aprovacoes', 'erros', 'custos', 'logs']);
type Route = { page: 'predio' | 'central' | 'projeto'; projectId: string | null };

function fromHash(): Route {
  const h = typeof location === 'undefined' ? '' : location.hash.slice(1);
  return { page: CENTRAL_HASHES.has(h) ? 'central' : 'predio', projectId: null };
}

export const routeStore = createStore<Route>(() => fromHash());
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => routeStore.setState(fromHash()));

export function useRoute() {
  return useStore(routeStore);
}

/** Converte os endereços do app Next ("/", "/command", "/command/projects/:id"). */
export function navigate(href: string) {
  const project = /^\/command\/projects\/([\w-]+)/.exec(href);
  if (project) {
    routeStore.setState({ page: 'projeto', projectId: project[1]! });
  } else if (href.startsWith('/command')) {
    if (location.hash !== '#central') location.hash = 'central';
    routeStore.setState({ page: 'central', projectId: null });
  } else {
    if (location.hash !== '#predio') location.hash = 'predio';
    routeStore.setState({ page: 'predio', projectId: null });
  }
  window.scrollTo({ top: 0 });
}

export function pathOf(r: Route): string {
  if (r.page === 'projeto') return `/command/projects/${r.projectId}`;
  return r.page === 'central' ? '/command' : '/';
}
