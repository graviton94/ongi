# engine — 1단계 대화 엔진 검증

[문서 08](../documents/08_mvp_build_roadmap.md) 1단계용 스크립트입니다. 앱 없이 개발자 PC에서 기억 추출, 1인칭 대화, 가드레일, 평가를 돌립니다. 3단계에서 Firebase Functions 게이트웨이로 옮깁니다.

## 흐름

```
카톡 .txt ──(kakao_ingest export)──> loved_one.json ──(extract)──> core.json ──(chat / eval)──> 대화, 평가 결과
                                                        ↑
                                                   facts.json (팩트 시트, 직접 작성)
```

* 카톡 원문에서 **그분의 메시지만** `loved_one.json`으로 나옵니다. 다른 사람의 메시지는 저장되지 않습니다.
* `extract`는 팩트 시트의 `aliases`(가족 이름·별명)를 `{자녀1}` 같은 자리표시자로 바꾼 뒤 모델에 보냅니다. 결과 `core.json`에 식별 정보가 남아 있으면 경고하고 종료 코드 2를 돌려줍니다.
* `chat`, `eval`은 자리표시자를 팩트 시트의 호칭(`howCalled`)으로 되돌려 대화합니다.

## 클라우드 세션에서 실행 (기본 방법)

로컬 터미널 없이 진행합니다([문서 08](../documents/08_mvp_build_roadmap.md) 0-1절).

1. 클라우드 환경 설정에 `ANTHROPIC_API_KEY`를 등록하고 새 세션을 엽니다.
2. 세션 대화에 카톡 내보내기 `.txt`를 업로드하고, 팩트 시트 내용(호칭, 가족 이름·별명, 생신 등)을 대화로 알려 줍니다.
3. 세션이 아래 "실행 순서"를 대신 실행하고 보고서와 채점지를 파일로 돌려줍니다.
4. 대화 테스트는 세션에 "엄마에게: ..."처럼 보내면 `chat-turn`으로 한 턴씩 이어 갑니다.

## 준비 (터미널이 있는 경우)

```bash
cd engine && npm install
# API 키: ANTHROPIC_API_KEY 환경변수 또는 `ant auth login`
```

실제 데이터는 `engine/data/`에 둡니다. 이 폴더는 `.gitignore`에 들어 있어 저장소에 올라가지 않습니다.

## 실행 순서

```bash
# 1) 카톡 파일 → 그분의 메시지 (packages/kakao_ingest에서)
cd packages/kakao_ingest
dart run kakao_ingest:export ~/Downloads/엄마.txt                     # 화자 목록 확인
dart run kakao_ingest:export ~/Downloads/엄마.txt --speaker 엄마 --me 민수 \
  --out ../../engine/data/mom.loved_one.json
# 파싱이 안 되면: --shape-report 출력(내용 없이 줄 모양만)을 공유해 주세요.

# 2) 팩트 시트 작성: eval/facts.sample.json을 data/mom.facts.json으로 복사해 수정
#    aliases에는 대화에 나오는 가족 이름·별명을 빠짐없이 넣습니다(두 글자 이상).

# 3) 인격 코어 추출
cd ../../engine
npm run cli -- extract data/mom.loved_one.json data/mom.facts.json --out data/mom.core.json

# 4) system 프롬프트 눈으로 확인 (API 호출 없음)
npm run cli -- prompt data/mom.core.json data/mom.facts.json

# 5) 직접 대화 (터미널) / 한 턴씩 이어 가기 (클라우드 세션)
npm run cli -- chat data/mom.core.json data/mom.facts.json
npm run cli -- chat-turn data/mom.core.json data/mom.facts.json data/mom.state.json "엄마 밥 먹었어?"

# 6) 평가: eval/cases.sample.json을 복사해 실제 대화에서 뽑은 질문을 30~50개로 늘린 뒤
npm run cli -- eval data/mom.core.json data/mom.facts.json data/mom.cases.json --out data/mom.report.md
#    data/mom.report.md       가드레일 결과, 1턴 원가
#    data/mom.report.blind.md 가족 블라인드 채점지 (style 문항만)
```

단체방도 같은 방법입니다. `--speaker`로 그리운 분 한 명을 고르면 그분의 말만 남습니다.

## 1단계 통과 기준 (문서 08)

* 가족 3명 이상이 블라인드 채점지에서 "그분 같다"고 답한 비율이 기준 이상
* `report.md`의 가드레일 실패 0건
* 1턴 원가가 문서 06 6.2의 가정(약 14원)에서 크게 벗어나지 않음

## 구성

| 파일 | 역할 |
| :--- | :--- |
| `src/placeholders.ts` | 가족 이름 ↔ 자리표시자 변환, 인격 코어 식별 정보 검사 |
| `src/extract.ts` | 그분의 메시지 → 인격 코어 (Haiku 5.5 구조화 출력) |
| `src/prompt.ts` | 인격 코어 + 팩트 시트 + 근황 → system 프롬프트 (같은 입력이면 같은 문자열) |
| `src/guardrails.ts` | 위기 키워드, 입력 분류, 답장 검사. 검사에 실패하면 안전한 쪽으로 처리 |
| `src/chat.ts` | 대화 세션 (Sonnet 5.5, 추론 없이 `low` effort, 서버 측 fallback) |
| `src/evaluate.ts` | 평가 실행, 결과 보고서, 블라인드 채점지 |
| `src/cost.ts` | 호출별 비용 집계 |

모델은 `CHAT_MODEL`, `UTILITY_MODEL`, `CHAT_EFFORT` 환경변수로 바꿀 수 있습니다.
