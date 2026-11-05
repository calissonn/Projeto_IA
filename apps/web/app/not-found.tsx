import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h2 className="text-xl font-bold">Página não encontrada</h2>
      <p className="mt-2 text-sm text-slate-400">Este andar ainda não foi construído.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-400">
        Voltar ao prédio
      </Link>
    </main>
  );
}
