import type { WorkerRole } from '@acc/shared';

export interface Prices {
  /** US$ por milhão de tokens de entrada. */
  inputPerMTok: number;
  /** US$ por milhão de tokens de saída. */
  outputPerMTok: number;
}

/**
 * Consumo típico por tarefa (tokens), usado só para a estimativa ANTES da execução.
 * Agentes releem contexto a cada passo, por isso a entrada domina. É uma ordem de grandeza;
 * o custo medido vem do SDK ao final de cada execução.
 */
export const TYPICAL_TOKENS: Record<WorkerRole, { input: number; output: number }> = {
  programmer: { input: 150_000, output: 12_000 },
  designer: { input: 100_000, output: 8_000 },
  tester: { input: 120_000, output: 8_000 },
};

export function estimateTaskCost(role: WorkerRole, prices: Prices): number {
  const t = TYPICAL_TOKENS[role];
  return round((t.input / 1e6) * prices.inputPerMTok + (t.output / 1e6) * prices.outputPerMTok);
}

export function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** Mínimo de execuções reais de um cargo para usar a média em vez do consumo típico. */
export const CALIBRATION_MIN_SAMPLES = 3;

export interface CostSample {
  role: WorkerRole;
  costUsd: number | null;
}

/**
 * Estimativa calibrada: com execuções reais suficientes do cargo, usa a média do custo medido;
 * senão, o consumo típico × preço do modelo.
 */
export function calibratedEstimate(role: WorkerRole, prices: Prices, history: CostSample[]): { value: number; basis: 'history' | 'typical'; samples: number } {
  const costs = history.filter((h) => h.role === role && h.costUsd !== null && h.costUsd > 0).map((h) => h.costUsd!);
  if (costs.length >= CALIBRATION_MIN_SAMPLES) {
    return { value: round(costs.reduce((a, b) => a + b, 0) / costs.length), basis: 'history', samples: costs.length };
  }
  return { value: estimateTaskCost(role, prices), basis: 'typical', samples: costs.length };
}
