import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { Usage } from "./cost.js";
import type { Turn } from "./types.js";

// 모델 ID는 환경변수로 바꿀 수 있게 둔다(문서 03: 단종 대응).
export const CHAT_MODEL = (process.env.CHAT_MODEL ?? "claude-sonnet-5-5") as "claude-sonnet-5-5";
export const UTILITY_MODEL = (process.env.UTILITY_MODEL ?? "claude-haiku-5-5") as "claude-haiku-5-5";

export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  effort: Effort;
  maxTokens: number;
}

export interface ChatRequest {
  /** 세션 동안 바꾸지 않는다. 캐시가 이 앞부분을 재사용한다. */
  system: string;
  turns: Turn[];
  /** 세션 중간에 덧붙이는 운영 지시(예: 위기 감지 후). 기록을 고치지 않고 뒤에 붙인다. */
  operatorNote?: string;
  effort: Effort;
  maxTokens: number;
}

export interface ChatResult {
  text: string;
  refused: boolean;
  usage: Usage;
}

/** 엔진이 쓰는 모델 호출. 테스트에서는 가짜로 바꿔 끼운다. */
export interface Llm {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<{ value: z.infer<S>; usage: Usage }>;
  chat(req: ChatRequest): Promise<ChatResult>;
}

export class RefusalError extends Error {}

export class AnthropicLlm implements Llm {
  constructor(private readonly client = new Anthropic()) {}

  async structured<S extends z.ZodType>(req: StructuredRequest<S>) {
    // Haiku 5.5에는 서버 측 fallback이 없다. 거절되면 호출한 쪽에서 처리한다.
    const response = await this.client.messages.parse({
      model: UTILITY_MODEL,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      output_config: { effort: req.effort, format: zodOutputFormat(req.schema) },
    });
    if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category ?? "unknown");
    if (response.parsed_output == null) throw new Error(`구조화 출력 파싱 실패 (stop_reason: ${response.stop_reason})`);
    return { value: response.parsed_output as z.infer<S>, usage: response.usage };
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const messages: Anthropic.Beta.BetaMessageParam[] = req.turns.map((t) => ({ role: t.role, content: t.text }));
    if (req.operatorNote) messages.push({ role: "system", content: req.operatorNote } as never);

    const response = await this.client.beta.messages.create({
      model: CHAT_MODEL,
      max_tokens: req.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // 도구 없는 대화라 추론 없이 답한다. 기록이 텍스트뿐이라 대화 기록 검사(preserved thinking)와 충돌하지 않는다.
      thinking: { type: "between_tools" } as never,
      output_config: { effort: req.effort },
      // 고정된 system 끝과 대화 기록 끝을 캐시한다.
      cache_control: { type: "ephemeral" },
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages,
    });

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return { text, refused: response.stop_reason === "refusal", usage: response.usage };
  }
}
