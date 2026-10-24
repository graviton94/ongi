import type { FactSheet, PersonaCore } from "./types.js";

// 짧은 별칭("애", "형")은 다른 단어 속에 흔해서 바꾸면 문장이 깨진다. 두 글자 이상만 바꾼다.
const MIN_ALIAS_LENGTH = 2;

const PHONE = /01[016789]-?\d{3,4}-?\d{4}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;

/** 가족 이름·별명을 {id} 자리표시자로 바꾼다. 긴 별칭부터 바꿔 "민수야"가 "민수"보다 먼저 잡히게 한다. */
export function toPlaceholders(text: string, facts: FactSheet): string {
  const pairs = facts.family
    .flatMap((m) => m.aliases.map((alias) => ({ alias: alias.trim(), id: m.id })))
    .filter((p) => p.alias.length >= MIN_ALIAS_LENGTH)
    .sort((a, b) => b.alias.length - a.alias.length);
  let out = text;
  for (const { alias, id } of pairs) out = out.split(alias).join(`{${id}}`);
  return out;
}

/** 자리표시자를 그분이 부르던 호칭으로 되돌린다. 대화할 때만 쓰고, 봉인 데이터에는 쓰지 않는다. */
export function fromPlaceholders(text: string, facts: FactSheet): string {
  let out = text;
  for (const m of facts.family) out = out.split(`{${m.id}}`).join(m.howCalled);
  return out;
}

/**
 * 인격 코어에 살아 있는 사람을 알아볼 수 있는 정보가 남았는지 검사한다(문서 06 D11).
 * 봉인 전에 반드시 통과해야 한다. 문제가 된 값의 종류만 돌려주고 값 자체는 돌려주지 않는다.
 */
export function findIdentifiers(core: PersonaCore, facts: FactSheet): string[] {
  const text = JSON.stringify(core);
  const problems: string[] = [];
  for (const m of facts.family) {
    for (const alias of m.aliases) {
      if (alias.trim().length >= MIN_ALIAS_LENGTH && text.includes(alias.trim())) {
        problems.push(`가족 별칭 (${m.id})`);
      }
    }
  }
  if (PHONE.test(text)) problems.push("전화번호");
  if (EMAIL.test(text)) problems.push("이메일");
  return [...new Set(problems)];
}
