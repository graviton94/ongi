# [문서 02] 인프라 자격증명 및 환경변수 셋업 가이드

* **목적:** 실제 코딩 착수 전, 개발자가 확보해야 할 5대 플랫폼 계정, API 키, 서버리스 비밀키 격리 원칙.

---

## 1. 지금 개발자가 확보해야 할 필수 자격증명 5선

| 서비스명 | 발급 항목 / 파일 | 용도 | 비고 |
| :--- | :--- | :--- | :--- |
| **Google Play Console** | 개발자 계정 등록 ($25 1회) | 안드로이드 배포, 라이선스 테스터 IAP 테스트 | 14일 비공개 테스트 대비 최우선 |
| **Firebase Console** | `google-services.json` | Android 앱 등록, Firestore DB, FCM 무료 푸시 | Spark(무료) 플랜 시작 |
| **Anthropic Console** | `ANTHROPIC_API_KEY` | Claude 3.5 Haiku 기반 1인칭 감성 대화 엔진 | 한국어 감성/어조 모사 1위 |
| **OpenAI Platform** | `OPENAI_API_KEY` | GPT-4o-mini 기반 Strict JSON KV (JEV) 추출 | 스키마 준수율 100% |
| **Irys (Arweave)** | `IRYS_PRIVATE_KEY` (지갑 개인키) | Arweave 가스리스 영구 보존 스튜디오 대납용 | 테스트 기간은 Devnet(무료) 사용 |

*(Apple Developer $99는 안드로이드 14일 테스트 및 출시 후 iOS 포팅 직전에 결제)*

---

## 2. 보안 환경변수 격리 및 서버리스 중계 구조

```
[Flutter App Client] ──(Firebase ID Token)──> [Serverless Edge Gateway] ──> [External APIs]
 (AES-256 암호화만 수행)                       (Irys 대납 릴레이)            (Arweave, Claude, OpenAI)
 (마스터 복구 키는 단말 보관)                  (Private Key 보관)
```

### 2.1 서버리스 백엔드 Secret (.env)
```env
IRYS_NETWORK=devnet
IRYS_TOKEN=matic
IRYS_PRIVATE_KEY=0xYourPrivateKeyHere...

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

### 2.2 Flutter 클라이언트 (.env.local)
```env
API_BASE_URL=https://your-serverless-api.net
APP_ENV=development
APP_NAME="온기"
```
