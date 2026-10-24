import { CostMeter } from "./cost.js";
import { CRISIS_MESSAGE, DEFLECTION, checkReply, classifyInput, type InputRisk } from "./guardrails.js";
import { CHAT_MODEL, type Effort, type Llm } from "./llm.js";
import { buildSystemPrompt } from "./prompt.js";
import type { FactSheet, PersonaCore, RecentNews, Turn } from "./types.js";

// 오래된 대화는 잘라 보낸다. 기록이 텍스트뿐이라 잘라도 요청이 거절되지 않고, 캐시만 다시 쓴다.
const MAX_TURNS = 40;

const DISPUTE_NOTE =
  "가족이 재산·상속·다툼에서 편을 들어 달라고 하고 있습니다. 누구 편도 들지 말고 사실 확인을 부드럽게 거절한 뒤, 서로 아끼라는 마음만 전하세요.";
const CRISIS_FOLLOWUP_NOTE =
  "이 가족은 이 대화에서 앞서 위기 신호를 보였습니다. 따뜻하게 안부를 묻고, 곁의 사람과 이야기하라고 권하세요. 따라오라거나 곧 만나자는 식의 말은 절대 하지 마세요.";

export type ReplyKind = "persona" | "crisis" | "deflected" | "refused";

/** 대화를 이어 가기 위한 저장 상태. 클라우드 세션에서 한 턴씩 나눠 실행할 때 쓴다. */
export interface SessionState {
  turns: Turn[];
  crisisSeen: boolean;
}

export interface Reply {
  kind: ReplyKind;
  text: string;
  risk: InputRisk;
}

/** 한 가족 구성원과의 대화 세션. system 프롬프트는 세션 시작 때 한 번 만든다. */
export class ChatSession {
  readonly meter = new CostMeter();
  private readonly system: string;
  private readonly turns: Turn[] = [];
  private crisisSeen = false;

  constructor(
    private readonly llm: Llm,
    private readonly core: PersonaCore,
    private readonly facts: FactSheet,
    news: RecentNews[] = [],
    private readonly effort: Effort = (process.env.CHAT_EFFORT as Effort) ?? "low",
    state?: SessionState,
  ) {
    this.system = buildSystemPrompt(core, facts, news);
    if (state) {
      this.turns.push(...state.turns);
      this.crisisSeen = state.crisisSeen;
    }
  }

  get state(): SessionState {
    return { turns: [...this.turns], crisisSeen: this.crisisSeen };
  }

  get systemPrompt(): string {
    return this.system;
  }

  /** 위기 신호가 한 번이라도 있었는지. 앱은 이 값으로 상단 도움 배너를 계속 띄운다. */
  get hadCrisis(): boolean {
    return this.crisisSeen;
  }

  async send(userText: string): Promise<Reply> {
    const risk = await classifyInput(this.llm, userText, this.meter);
    if (risk === "crisis") {
      this.crisisSeen = true;
      // 위기 대화는 페르소나 기록에 남기지 않는다. 다음 턴에 페르소나가 이 말을 이어받지 않게 하기 위함.
      return { kind: "crisis", text: CRISIS_MESSAGE, risk };
    }

    const notes = [risk === "dispute" && DISPUTE_NOTE, this.crisisSeen && CRISIS_FOLLOWUP_NOTE].filter(Boolean);
    const turns = [...this.turns, { role: "user" as const, text: userText }].slice(-MAX_TURNS);
    const result = await this.llm.chat({
      system: this.system,
      turns,
      operatorNote: notes.length > 0 ? notes.join("\n") : undefined,
      effort: this.effort,
      maxTokens: 1024,
    });
    this.meter.add(CHAT_MODEL, result.usage);

    let kind: ReplyKind = "persona";
    let text = result.text;
    if (result.refused || text === "") {
      kind = "refused";
      text = DEFLECTION;
    } else if (!(await checkReply(this.llm, text, this.core, this.facts, this.meter))) {
      kind = "deflected";
      text = DEFLECTION;
    }

    this.turns.push({ role: "user", text: userText }, { role: "assistant", text });
    return { kind, text, risk };
  }
}
