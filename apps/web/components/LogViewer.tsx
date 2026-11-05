'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AccEvent } from '@acc/shared';
import { LOG_CATEGORIES, dedupeKey, describeLogEvent } from '@/lib/format';
import { accStore, api, useAcc } from '@/lib/store';
import { Button, Card, Empty } from './ui';

const PAGE = 200;

function eventKeyOf(e: AccEvent): string | null {
  const k = dedupeKey(e);
  return k ? k.slice(0, k.lastIndexOf(':')) : null;
}

/** Histórico completo de eventos gravados, com filtros e atualização em tempo real. */
export function LogViewer({ projectId, title = 'Histórico e logs', problemsOnly = false }: { projectId?: string; title?: string; problemsOnly?: boolean }) {
  const agents = useAcc((s) => s.agents);
  const projects = useAcc((s) => s.projects);
  const seq = useAcc((s) => s.seq);
  const [category, setCategory] = useState('all');
  const [agentId, setAgentId] = useState('');
  const [projectFilter, setProjectFilter] = useState(projectId ?? '');
  const [text, setText] = useState('');
  const [events, setEvents] = useState<AccEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Último número de sequência já coberto pela lista (-1 = ainda carregando).
  const lastSeq = useRef(-1);

  const query = useMemo(() => {
    const types = LOG_CATEGORIES.find((c) => c.id === category)!.types.join(',');
    const params = new URLSearchParams({ types, limit: String(PAGE) });
    if (projectFilter) params.set('projectId', projectFilter);
    if (agentId) params.set('agentId', agentId);
    return params;
  }, [category, projectFilter, agentId]);

  // Carga inicial (e sempre que os filtros mudam): os eventos mais recentes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    lastSeq.current = -1;
    const p = new URLSearchParams(query);
    p.set('before', String(Number.MAX_SAFE_INTEGER));
    const seqAtRequest = accStore.getState().seq;
    api<AccEvent[]>(`events?${p}`)
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        setHasMore(list.length === PAGE);
        lastSeq.current = Math.max(list.at(-1)?.seq ?? 0, seqAtRequest);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Novos eventos: busca o que chegou depois do último carregado.
  useEffect(() => {
    if (lastSeq.current < 0 || seq <= lastSeq.current) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(query);
      p.set('after', String(lastSeq.current));
      api<AccEvent[]>(`events?${p}`)
        .then((list) => {
          lastSeq.current = Math.max(lastSeq.current, seq);
          if (!list.length) return;
          setEvents((prev) => [...prev, ...list.filter((e) => e.seq > (prev.at(-1)?.seq ?? 0))]);
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [seq, query]);

  const loadOlder = useCallback(async () => {
    const first = events[0]?.seq;
    if (!first) return;
    setLoading(true);
    try {
      const p = new URLSearchParams(query);
      p.set('before', String(first));
      const older = await api<AccEvent[]>(`events?${p}`);
      setEvents((prev) => [...older, ...prev]);
      setHasMore(older.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [events, query]);

  const rows = useMemo(() => {
    const seen = new Map<string, string>();
    const out: { e: AccEvent; text: string; tone: string }[] = [];
    for (const e of events) {
      const key = dedupeKey(e);
      const entity = eventKeyOf(e);
      if (key && entity) {
        if (seen.get(entity) === key) continue;
        seen.set(entity, key);
      }
      const d = describeLogEvent(e);
      if (!d) continue;
      if (problemsOnly && d.tone !== 'bad' && d.tone !== 'warn') continue;
      const who = e.agentId ? agents[e.agentId]?.name : null;
      const line = `${who ? who + ': ' : ''}${d.text}`;
      if (text && !line.toLowerCase().includes(text.toLowerCase())) continue;
      out.push({ e, text: line, tone: d.tone });
    }
    return out.reverse();
  }, [events, agents, text, problemsOnly]);

  const select = 'rounded-lg border border-line bg-ink px-2 py-1.5 text-sm outline-none focus:border-teal-400';
  return (
    <Card title={title}>
      <div className="mb-3 flex flex-wrap gap-2" data-testid="log-filters">
        <select aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} className={select}>
          {LOG_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select aria-label="Agente" value={agentId} onChange={(e) => setAgentId(e.target.value)} className={select}>
          <option value="">Todos os agentes</option>
          {Object.values(agents).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.title})
            </option>
          ))}
        </select>
        {!projectId && (
          <select aria-label="Projeto" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={select}>
            <option value="">Todos os projetos</option>
            {Object.values(projects).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input aria-label="Buscar" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar texto…" className={`${select} min-w-0 flex-1`} />
      </div>
      {error && <p className="mb-2 text-sm text-rose-300">{error}</p>}
      {rows.length === 0 ? (
        <Empty>{loading ? 'Carregando…' : 'Nenhum evento para os filtros escolhidos.'}</Empty>
      ) : (
        <ol className="max-h-[480px] space-y-1 overflow-y-auto pr-1 text-sm scrollbar-thin" data-testid="log-list">
          {rows.map(({ e, text: line, tone }) => (
            <li key={e.seq} className="flex gap-2">
              <span className="shrink-0 font-mono text-xs text-slate-500">
                #{e.seq} {new Date(e.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-200' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-200'}>{line}</span>
            </li>
          ))}
        </ol>
      )}
      {hasMore && (
        <Button variant="ghost" className="mt-3 w-full" disabled={loading} onClick={loadOlder}>
          Carregar eventos anteriores
        </Button>
      )}
    </Card>
  );
}
