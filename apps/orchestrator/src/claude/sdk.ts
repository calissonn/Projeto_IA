import type { Options } from '@anthropic-ai/claude-agent-sdk';

/**
 * Subconjunto das mensagens do Claude Agent SDK que o orquestrador usa.
 * Mantido mínimo para que os testes possam simular o SDK sem chamar a IA.
 */
export interface SdkContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export type SdkMessage =
  | { type: 'assistant'; message: { content: SdkContentBlock[] } }
  | { type: 'user'; message: { content: string | SdkContentBlock[] } }
  | {
      type: 'result';
      subtype: string;
      is_error: boolean;
      num_turns: number;
      total_cost_usd: number;
      result?: string;
      structured_output?: unknown;
      errors?: string[];
    }
  | { type: 'system' | 'stream_event' | string; [key: string]: unknown };

export type QueryOptions = Options;
export type QueryFn = (params: { prompt: string; options: QueryOptions }) => AsyncIterable<SdkMessage>;

/** Carrega o SDK real só quando necessário (modo real). */
export async function loadClaudeQuery(): Promise<QueryFn> {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  return (params) => sdk.query(params) as unknown as AsyncIterable<SdkMessage>;
}

/** Ferramenta interna que o SDK usa para entregar a saída estruturada (relatório final / plano). */
export const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput';

export function isResult(m: SdkMessage): m is Extract<SdkMessage, { type: 'result' }> {
  return m.type === 'result';
}
export function isAssistant(m: SdkMessage): m is Extract<SdkMessage, { type: 'assistant' }> {
  return m.type === 'assistant';
}
export function isUser(m: SdkMessage): m is Extract<SdkMessage, { type: 'user' }> {
  return m.type === 'user';
}

/** Mensagens de erro do resultado, em português. */
export function describeResultError(r: Extract<SdkMessage, { type: 'result' }>): string {
  switch (r.subtype) {
    case 'error_max_budget_usd':
      return `Limite de custo atingido (US$ ${r.total_cost_usd.toFixed(2)})`;
    case 'error_max_turns':
      return `Limite de turnos atingido (${r.num_turns})`;
    case 'error_max_structured_output_retries':
      return 'O agente não conseguiu entregar o relatório final no formato esperado';
    default:
      return r.errors?.length ? r.errors.join('; ').slice(0, 500) : 'Erro durante a execução do Claude Code';
  }
}
