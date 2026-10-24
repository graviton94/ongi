import type { CostMeter } from "./cost.js";
import { UTILITY_MODEL, type Llm } from "./llm.js";
import { findIdentifiers, toPlaceholders } from "./placeholders.js";
import { PersonaCoreSchema, type FactSheet, type LovedOneExport, type PersonaCore } from "./types.js";

// 추출 입력 상한(글자 수). 한국어는 대략 1~1.5글자가 1토큰이다. Haiku 5.5는 10만 토큰을 넘으면 단가가 오른다.
const MAX_INPUT_CHARS = 120_000;

const SYSTEM = `당신은 가족이 남긴 카카오톡 대화에서 한 사람의 말투와 인격을 기록하는 기록가입니다.

규칙:
- 입력은 그분 한 사람이 보낸 메시지뿐입니다. 상대가 한 말은 없습니다.
- 원문에 있는 것만 기록합니다. 추측하거나 보기 좋게 꾸미지 않습니다.
- quote와 sampleLines는 원문 문장을 한 글자도 바꾸지 않고 옮깁니다.
- {자녀1} 같은 중괄호 표기는 가족을 가리키는 자리표시자입니다. 그대로 두고, 실제 이름을 추측해 넣지 않습니다.
- 전화번호, 주소, 계좌, 이메일 같은 개인정보는 어디에도 옮기지 않습니다.
- 재산, 상속, 가족 간 다툼에 관한 일화는 기록하지 않습니다.
- 다른 곳에서 퍼온 글(뉴스, 좋은 글, 광고, 앱이 자동으로 붙인 공유 문구)은 그분의 말투가 아니므로 무시합니다.`;

/** 그분의 메시지에서 인격 코어를 뽑는다. 가족 이름은 보내기 전에 자리표시자로 바꾼다. */
export async function extractPersonaCore(
  llm: Llm,
  lovedOne: LovedOneExport,
  facts: FactSheet,
  meter?: CostMeter,
): Promise<{ core: PersonaCore; identifierWarnings: string[] }> {
  const lines = selectMessages(lovedOne.messages.map((m) => toPlaceholders(m.text, facts)));
  const { value, usage } = await llm.structured({
    system: SYSTEM,
    user: `그분을 가족은 "${facts.lovedOne.callName}"(이)라고 불렀습니다. 아래는 그분이 보낸 메시지입니다. 한 줄이 메시지 하나이고, 메시지 안의 줄바꿈은 " / "로 표시했습니다.\n\n${lines.join("\n")}`,
    schema: PersonaCoreSchema,
    effort: "medium",
    maxTokens: 16000,
  });
  meter?.add(UTILITY_MODEL, usage);
  return { core: value, identifierWarnings: findIdentifiers(value, facts) };
}

/**
 * 입력 상한을 넘으면 내용이 많은 메시지를 우선 남기되, 시간 순서는 유지한다.
 * 짧은 안부("밥 먹었니")도 말투를 보여주므로 상한 안에서는 모두 쓴다.
 */
export function selectMessages(texts: string[], maxChars = MAX_INPUT_CHARS): string[] {
  const lines = texts.map((t) => t.replaceAll("\n", " / "));
  const total = lines.reduce((sum, l) => sum + l.length + 1, 0);
  if (total <= maxChars) return lines;

  const byLength = lines.map((line, index) => ({ line, index })).sort((a, b) => b.line.length - a.line.length);
  const keep = new Set<number>();
  let used = 0;
  for (const { line, index } of byLength) {
    if (used + line.length + 1 > maxChars) continue;
    keep.add(index);
    used += line.length + 1;
  }
  return lines.filter((_, i) => keep.has(i));
}
