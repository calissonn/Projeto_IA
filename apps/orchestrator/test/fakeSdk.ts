import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { QueryFn, QueryOptions, SdkMessage } from '../src/claude/sdk.ts';

export type FakeStep =
  | { tool: string; input: Record<string, unknown>; output?: string; isError?: boolean }
  | { text: string };

export interface FakeScript {
  steps: FakeStep[];
  result?: { subtype?: string; costUsd?: number; turns?: number; structured?: unknown; result?: string; errors?: string[] };
  /** Pausa entre passos (ms), para testes de interrupção. */
  delayMs?: number;
}

export interface FakeCall {
  prompt: string;
  options: QueryOptions;
  decisions: { tool: string; behavior: 'allow' | 'deny'; message?: string }[];
}

/**
 * Simula o Claude Agent SDK: emite tool_use, consulta canUseTool como o SDK real faz
 * e, se permitido, aplica o efeito (Write grava o arquivo de verdade no cwd).
 */
export function fakeQuery(script: (prompt: string, options: QueryOptions) => FakeScript): { query: QueryFn; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const query: QueryFn = (params) => {
    const call: FakeCall = { prompt: params.prompt, options: params.options, decisions: [] };
    calls.push(call);
    const s = script(params.prompt, params.options);
    const signal = params.options.abortController?.signal;
    async function* run(): AsyncGenerator<SdkMessage> {
      let n = 0;
      for (const step of s.steps) {
        if (s.delayMs) await new Promise((r) => setTimeout(r, s.delayMs));
        if (signal?.aborted) throw new Error('Operation aborted');
        if ('text' in step) {
          yield { type: 'assistant', message: { content: [{ type: 'text', text: step.text }] } };
          continue;
        }
        const id = `toolu_${++n}`;
        yield { type: 'assistant', message: { content: [{ type: 'tool_use', id, name: step.tool, input: step.input }] } };
        const decision = await params.options.canUseTool!(step.tool, step.input, { signal: signal ?? new AbortController().signal, toolUseID: id } as never);
        if (!decision) throw new Error('canUseTool não respondeu');
        const message = decision.behavior === 'deny' ? decision.message : undefined;
        call.decisions.push({ tool: step.tool, behavior: decision.behavior, message });
        if (decision.behavior === 'deny') {
          yield { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: message, is_error: true }] } };
          continue;
        }
        if ((step.tool === 'Write' || step.tool === 'Edit') && typeof step.input.file_path === 'string') {
          const file = path.resolve(params.options.cwd!, step.input.file_path);
          mkdirSync(path.dirname(file), { recursive: true });
          writeFileSync(file, String(step.input.content ?? step.input.new_string ?? 'conteúdo'));
        }
        yield { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: step.output ?? 'ok', is_error: !!step.isError }] } };
      }
      if (signal?.aborted) throw new Error('Operation aborted');
      const r = s.result ?? {};
      // Como no SDK real, a saída estruturada é entregue por uma chamada de ferramenta que também passa por canUseTool.
      if (r.structured !== undefined) {
        const id = `toolu_${++n}`;
        yield { type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'StructuredOutput', input: r.structured as Record<string, unknown> }] } };
        const d = await params.options.canUseTool!('StructuredOutput', r.structured as Record<string, unknown>, { signal: signal ?? new AbortController().signal, toolUseID: id } as never);
        call.decisions.push({ tool: 'StructuredOutput', behavior: d!.behavior, message: d!.behavior === 'deny' ? d!.message : undefined });
        if (d!.behavior === 'deny') {
          yield { type: 'result', subtype: 'error_max_structured_output_retries', is_error: true, num_turns: n, total_cost_usd: r.costUsd ?? 0.05, errors: ['structured output negado'] };
          return;
        }
      }
      yield {
        type: 'result',
        subtype: r.subtype ?? 'success',
        is_error: (r.subtype ?? 'success') !== 'success',
        num_turns: r.turns ?? s.steps.length + 1,
        total_cost_usd: r.costUsd ?? 0.05,
        result: r.result ?? 'Pronto.',
        structured_output: r.structured,
        errors: r.errors,
      };
    }
    return run();
  };
  return { query, calls };
}
