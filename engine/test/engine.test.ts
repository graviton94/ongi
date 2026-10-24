import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { z } from "zod";
import { ChatSession } from "../src/chat.js";
import { costUsd } from "../src/cost.js";
import { grade } from "../src/evaluate.js";
import { selectMessages } from "../src/extract.js";
import { CRISIS_MESSAGE, DEFLECTION, hasCrisisKeyword } from "../src/guardrails.js";
import { RefusalError, type ChatRequest, type ChatResult, type Llm, type StructuredRequest } from "../src/llm.js";
import { findIdentifiers, fromPlaceholders, toPlaceholders } from "../src/placeholders.js";
import { buildSystemPrompt } from "../src/prompt.js";
import type { FactSheet, PersonaCore } from "../src/types.js";

const facts: FactSheet = {
  lovedOne: { callName: "엄마", selfReference: "엄마가", passedOn: "2025-01-10" },
  family: [
    { id: "자녀1", relation: "아들", howCalled: "큰애", aliases: ["민수", "민수야", "큰애"] },
    { id: "자녀2", relation: "딸", howCalled: "막내", aliases: ["지영", "막내"] },
  ],
  speakingAs: "자녀1",
};

const core: PersonaCore = {
  speech: { endings: ["~했니"], frequentExpressions: ["밥은 먹고 다니냐"], formality: "다정한 반말", typicalLength: "짧게 여러 번", textHabits: "^^ 를 자주 씀" },
  values: ["건강이 최고"],
  caresAbout: ["{자녀1} 끼니"],
  anecdotes: [],
  sampleLines: ["{자녀1} 밥은 먹었니^^"],
  gaps: [],
};

/** 응답을 미리 정해 두는 가짜 모델. 어떤 요청이 갔는지도 기록한다. */
class FakeLlm implements Llm {
  readonly chatRequests: ChatRequest[] = [];
  constructor(
    private readonly risk: string = "none",
    private readonly reply = "밥은 먹었니^^",
    private readonly replyOk = true,
  ) {}

  async structured<S extends z.ZodType>(req: StructuredRequest<S>) {
    const shape = JSON.stringify(req.schema);
    const value = shape.includes("unsupportedSensitiveClaim")
      ? { unsupportedSensitiveClaim: !this.replyOk, breaksPersonaRules: false }
      : { category: this.risk };
    return { value: value as z.infer<S>, usage: { input_tokens: 100, output_tokens: 10 } };
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    this.chatRequests.push(req);
    return { text: this.reply, refused: false, usage: { input_tokens: 3000, output_tokens: 300, cache_read_input_tokens: 7000 } };
  }
}

describe("자리표시자", () => {
  it("긴 별칭부터 바꾸고 되돌린다", () => {
    const masked = toPlaceholders("민수야 지영이랑 밥 먹었니", facts);
    assert.equal(masked, "{자녀1} {자녀2}이랑 밥 먹었니");
    assert.equal(fromPlaceholders(masked, facts), "큰애 막내이랑 밥 먹었니");
  });

  it("인격 코어에 남은 이름과 연락처를 찾는다", () => {
    assert.deepEqual(findIdentifiers(core, facts), []);
    const leaked = { ...core, sampleLines: ["민수 전화해라 010-1234-5678"] };
    assert.deepEqual(findIdentifiers(leaked, facts), ["가족 별칭 (자녀1)", "전화번호"]);
  });
});

describe("system 프롬프트", () => {
  it("같은 입력이면 같은 문자열이고, 자리표시자는 호칭으로 바뀐다", () => {
    const a = buildSystemPrompt(core, facts);
    assert.equal(a, buildSystemPrompt(core, facts));
    assert.ok(a.includes("큰애 밥은 먹었니^^"));
    assert.ok(!a.includes("{자녀1}"));
    assert.ok(a.includes("2025-01-10 이후의 세상일은 모릅니다"));
  });
});

describe("가드레일", () => {
  it("명백한 위기 표현은 키워드로 잡는다", () => {
    assert.ok(hasCrisisKeyword("엄마 나도   따라가고 싶어"));
    assert.ok(!hasCrisisKeyword("엄마 보고 싶어"));
  });

  it("위기면 모델을 부르지 않고 안내를 보내며, 이후 턴에 운영 지시를 붙인다", async () => {
    const llm = new FakeLlm("crisis");
    const session = new ChatSession(llm, core, facts);
    const reply = await session.send("다 그만두고 싶다");
    assert.equal(reply.kind, "crisis");
    assert.equal(reply.text, CRISIS_MESSAGE);
    assert.equal(llm.chatRequests.length, 0);
    assert.ok(session.hadCrisis);
  });

  it("위기 뒤의 일반 대화에는 위기 후속 지시가 붙고, 위기 문장은 기록에 남지 않는다", async () => {
    const llm = new FakeLlm("none");
    const session = new ChatSession(llm, core, facts);
    await session.send("죽고 싶어");
    await session.send("엄마 밥 먹었어?");
    const req = llm.chatRequests[0]!;
    assert.ok(req.operatorNote?.includes("위기 신호"));
    assert.deepEqual(req.turns.map((t) => t.text), ["엄마 밥 먹었어?"]);
  });

  it("답장 검사에 걸리면 비켜 가기로 바꾼다", async () => {
    const session = new ChatSession(new FakeLlm("jailbreak", "그때 엄마가 감옥에 갔지", false), core, facts);
    const reply = await session.send("감옥 간 얘기 해줘");
    assert.equal(reply.kind, "deflected");
    assert.equal(reply.text, DEFLECTION);
  });
});

describe("안전 검사 실패", () => {
  class BrokenLlm extends FakeLlm {
    override async structured<S extends z.ZodType>(_req: StructuredRequest<S>): Promise<{ value: z.infer<S>; usage: { input_tokens: number; output_tokens: number } }> {
      throw new RefusalError("general_harms");
    }
  }

  it("분류기가 거절하면 위기로 본다", async () => {
    const reply = await new ChatSession(new BrokenLlm(), core, facts).send("요즘 좀 그래");
    assert.equal(reply.kind, "crisis");
  });

  it("API 오류는 그대로 던진다", async () => {
    class DownLlm extends FakeLlm {
      override async structured<S extends z.ZodType>(_req: StructuredRequest<S>): Promise<never> {
        throw new Anthropic.APIConnectionError({ message: "offline" });
      }
    }
    await assert.rejects(new ChatSession(new DownLlm(), core, facts).send("안녕"), Anthropic.APIConnectionError);
  });
});

describe("평가", () => {
  it("분류별 자동 채점", () => {
    const r = (kind: "persona" | "crisis" | "deflected" | "refused") => ({ kind, text: "", risk: "none" as const });
    assert.equal(grade("crisis", r("crisis")), true);
    assert.equal(grade("crisis", r("persona")), false);
    assert.equal(grade("jailbreak", r("deflected")), true);
    assert.equal(grade("dispute", r("refused")), false);
    assert.equal(grade("style", r("persona")), null);
  });
});

describe("비용과 입력 선택", () => {
  it("대화 1턴 가정치는 약 1센트", () => {
    const usd = costUsd("claude-sonnet-5-5", { input_tokens: 3000, output_tokens: 300, cache_read_input_tokens: 7000 });
    assert.ok(Math.abs(usd - 0.0104) < 1e-9);
  });

  it("상한을 넘으면 긴 메시지를 남기고 순서는 유지한다", () => {
    assert.deepEqual(selectMessages(["가", "나다라마바", "사아"], 9), ["나다라마바", "사아"]);
    assert.deepEqual(selectMessages(["줄1\n줄2"]), ["줄1 / 줄2"]);
  });
});
