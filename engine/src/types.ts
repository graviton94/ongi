import { z } from "zod";

/** packages/kakao_ingest 의 export 명령이 만든 입력. 그리운 분의 말만 들어 있다. */
export interface LovedOneExport {
  speaker: string;
  source: string;
  messages: { time: string; text: string }[];
}

/** 가족이 직접 입력하는 1분 팩트 시트 (문서 04 2절). 오프체인에만 둔다. */
export interface FactSheet {
  lovedOne: {
    /** 가족이 부르던 호칭. 예: "엄마" */
    callName: string;
    /** 그분이 스스로를 부르던 말. 예: "엄마가", "아빠는" */
    selfReference?: string;
    birthday?: string;
    /** 별이 되신 날. 이 날짜에 지식과 가치관을 고정한다(시공간 닻). */
    passedOn?: string;
    hometown?: string;
    facts?: string[];
  };
  /** 가족 구성원. id는 자리표시자 이름으로 쓴다. 예: "자녀1" */
  family: FamilyMember[];
  /** 지금 대화하는 사람의 family id */
  speakingAs: string;
}

export interface FamilyMember {
  id: string;
  relation: string;
  /** 그분이 이 사람을 부르던 말. 예: "큰애", "민수야" */
  howCalled: string;
  /** 대화 원문에 나오는 이 사람의 이름·별명. 자리표시자로 바꿀 대상 */
  aliases: string[];
}

/**
 * 봉인 대상인 인격 코어 (문서 06 D11). 가족을 가리키는 말은 {자녀1} 같은 자리표시자로만 들어간다.
 * 구조화 출력 스키마로 그대로 쓰므로 필드 설명이 곧 추출 지시다.
 */
export const PersonaCoreSchema = z.object({
  speech: z.object({
    endings: z.array(z.string()).describe("자주 쓰는 문장 끝맺음. 예: '~했니', '~하거라', '~해라잉'"),
    frequentExpressions: z.array(z.string()).describe("입버릇처럼 자주 쓰던 표현"),
    formality: z.string().describe("반말/존댓말, 말투의 온도를 한두 문장으로"),
    typicalLength: z.string().describe("메시지 길이와 끊어 보내는 습관"),
    textHabits: z.string().describe("'^^', '..', 띄어쓰기, 맞춤법 습관 등 글자 습관"),
  }),
  values: z.array(z.string()).describe("반복해서 드러나는 가치관과 당부"),
  caresAbout: z.array(z.string()).describe("자주 챙기고 걱정하던 것"),
  anecdotes: z
    .array(
      z.object({
        summary: z.string().describe("그분 본인이 말한 일화 요약"),
        quote: z.string().describe("근거가 된 원문 문장을 그대로 옮김"),
      }),
    )
    .describe("그분 본인이 직접 말한 일화만. 추측 금지"),
  sampleLines: z.array(z.string()).describe("말투를 잘 보여주는 원문 메시지 10~20개를 그대로"),
  gaps: z.array(z.string()).describe("원문에 없어 가족에게 물어봐야 할 것. 예: 좋아하던 음식, 인생의 자랑"),
});
export type PersonaCore = z.infer<typeof PersonaCoreSchema>;

/** Layer 2: 가족이 대화에서 전한 근황. 오프체인 전용 (문서 01 2.2). */
export interface RecentNews {
  date: string;
  text: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}
