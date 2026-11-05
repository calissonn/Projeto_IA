'use client';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h2 className="text-xl font-bold">Algo deu errado nesta tela</h2>
      <p className="mt-2 text-sm text-slate-400">Os agentes e os dados não foram afetados: o orquestrador continua rodando separadamente.</p>
      <p className="mt-4 rounded bg-black/40 p-3 font-mono text-xs text-rose-300">{error.message}</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-400">
        Tentar de novo
      </button>
    </main>
  );
}
