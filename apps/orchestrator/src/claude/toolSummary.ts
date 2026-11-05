import path from 'node:path';

function short(text: string, max = 90): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max - 1) + '…' : one;
}

function rel(root: string, file: unknown): string {
  if (typeof file !== 'string') return '?';
  const r = path.relative(root, path.resolve(root, file));
  return r.startsWith('..') ? file : r || '.';
}

/** Frase curta em português para o histórico e o balão do agente. */
export function summarizeTool(tool: string, input: Record<string, unknown>, root: string): string {
  switch (tool) {
    case 'Read':
      return `Lendo ${rel(root, input.file_path)}`;
    case 'Write':
      return `Escrevendo ${rel(root, input.file_path)}`;
    case 'Edit':
    case 'MultiEdit':
      return `Editando ${rel(root, input.file_path)}`;
    case 'NotebookEdit':
      return `Editando notebook ${rel(root, input.notebook_path)}`;
    case 'Glob':
      return `Procurando arquivos: ${short(String(input.pattern ?? ''), 60)}`;
    case 'Grep':
      return `Buscando "${short(String(input.pattern ?? ''), 50)}"`;
    case 'Bash':
      return `Executando: ${short(String(input.command ?? ''))}`;
    case 'WebFetch':
      return `Acessando ${short(String(input.url ?? ''), 70)}`;
    case 'WebSearch':
      return `Pesquisando na web: ${short(String(input.query ?? ''), 60)}`;
    case 'TodoWrite':
      return 'Organizando a lista de passos';
    default:
      return `Usando ${tool}`;
  }
}

/** Parâmetros da ferramenta para o histórico, sem conteúdo extenso de arquivos. */
export function compactInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') out[k] = v.length > 400 ? `${v.slice(0, 400)}… (${v.length} caracteres)` : v;
    else if (Array.isArray(v)) out[k] = `[${v.length} itens]`;
    else out[k] = v;
  }
  return out;
}

export function textOfToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('\n');
  return '';
}

export { short };
