// 100만 토큰당 달러. 2026-10 기준 공시가. 캐시 쓰기는 5분 TTL 기준 입력가의 1.25배.
// Haiku 5.5 캐시 단가는 확인하지 못해 입력가의 0.1배로 가정한다.
export const PRICES = {
  "claude-sonnet-5-5": { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
} as const;

export type PricedModel = keyof typeof PRICES;

export const KRW_PER_USD = 1400;

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: PricedModel, usage: Usage): number {
  const p = PRICES[model];
  return (
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/** 여러 호출의 비용을 모은다. 1턴 원가 측정(문서 08 1단계)에 쓴다. */
export class CostMeter {
  private totalUsd = 0;
  private calls = 0;

  add(model: PricedModel, usage: Usage): void {
    this.totalUsd += costUsd(model, usage);
    this.calls++;
  }

  get usd(): number {
    return this.totalUsd;
  }

  get krw(): number {
    return this.totalUsd * KRW_PER_USD;
  }

  get callCount(): number {
    return this.calls;
  }
}
