// 1단계 대화 엔진 검증용 명령 (문서 08).
//
//   npm run cli -- prompt  <core.json> <facts.json>                    system 프롬프트 확인 (API 호출 없음)
//   npm run cli -- extract <loved_one.json> <facts.json> [--out core.json]
//   npm run cli -- chat    <core.json> <facts.json> [--news news.json]
//   npm run cli -- eval    <core.json> <facts.json> <cases.json> [--out report.md]
//
// API 호출 명령은 ANTHROPIC_API_KEY(또는 `ant auth login` 프로필)가 필요하고 실제 비용이 든다.
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { ChatSession } from "./chat.js";
import { CostMeter } from "./cost.js";
import { renderBlindSheet, renderReport, runEval, type EvalCase } from "./evaluate.js";
import { extractPersonaCore } from "./extract.js";
import { AnthropicLlm } from "./llm.js";
import { buildSystemPrompt } from "./prompt.js";
import { PersonaCoreSchema, type FactSheet, type LovedOneExport, type RecentNews } from "./types.js";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const option = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const readCore = (path: string) => PersonaCoreSchema.parse(readJson(path));

async function main(argv: string[]) {
  const [command, ...args] = argv;
  switch (command) {
    case "prompt": {
      console.log(buildSystemPrompt(readCore(args[0]!), readJson<FactSheet>(args[1]!)));
      return;
    }
    case "extract": {
      const meter = new CostMeter();
      const facts = readJson<FactSheet>(args[1]!);
      const { core, identifierWarnings } = await extractPersonaCore(
        new AnthropicLlm(),
        readJson<LovedOneExport>(args[0]!),
        facts,
        meter,
      );
      const out = option(args, "--out") ?? "core.json";
      writeFileSync(out, JSON.stringify(core, null, 2));
      console.log(`인격 코어를 ${out}에 저장했습니다. 비용 약 ${meter.krw.toFixed(1)}원`);
      if (identifierWarnings.length > 0) {
        console.warn(`봉인 불가: 인격 코어에 식별 정보가 남아 있습니다 (${identifierWarnings.join(", ")}). 팩트 시트의 aliases를 보강하고 다시 추출하세요.`);
        process.exitCode = 2;
      }
      return;
    }
    case "chat": {
      const newsPath = option(args, "--news");
      const news = newsPath ? readJson<RecentNews[]>(newsPath) : [];
      const session = new ChatSession(new AnthropicLlm(), readCore(args[0]!), readJson<FactSheet>(args[1]!), news);
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      console.log("AI로 재현한 대화입니다. 빈 줄을 입력하면 끝납니다.\n");
      for (;;) {
        const text = (await rl.question("나: ")).trim();
        if (!text) break;
        const reply = await session.send(text);
        console.log(`\n${reply.kind === "crisis" ? "[온기 안내]" : "그분"}: ${reply.text}\n`);
      }
      rl.close();
      console.log(`이번 대화 비용: 약 ${session.meter.krw.toFixed(1)}원 (${session.meter.callCount}회 호출)`);
      return;
    }
    case "eval": {
      const results = await runEval(
        new AnthropicLlm(),
        readCore(args[0]!),
        readJson<FactSheet>(args[1]!),
        readJson<EvalCase[]>(args[2]!),
      );
      const out = option(args, "--out") ?? "report.md";
      writeFileSync(out, renderReport(results));
      writeFileSync(out.replace(/\.md$/, "") + ".blind.md", renderBlindSheet(results));
      const failed = results.filter((r) => r.passed === false).length;
      console.log(`평가 결과를 ${out}에 저장했습니다. 가드레일 실패 ${failed}건`);
      if (failed > 0) process.exitCode = 1;
      return;
    }
    default:
      console.error("명령: prompt | extract | chat | eval (사용법은 src/cli.ts 상단 주석 참고)");
      process.exitCode = 64;
  }
}

await main(process.argv.slice(2));
