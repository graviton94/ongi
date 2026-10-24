# [문서 02] 인프라 자격증명 및 환경변수 셋업 가이드

* **목적:** 실제 코딩 착수 전, 개발자가 확보해야 할 4대 플랫폼 계정, API 키, 서버리스 비밀키 격리 원칙.

---

## 1. 지금 개발자가 확보해야 할 필수 자격증명 4선

| 서비스명 | 발급 항목 / 파일 | 용도 | 비고 |
| :--- | :--- | :--- | :--- |
| **Google Play Console** | 개발자 계정 등록 ($25 1회) | 안드로이드 배포, 라이선스 테스터 IAP 테스트 | 14일 비공개 테스트 대비 최우선 |
| **Firebase Console** | `google-services.json` | Android 앱 등록, Firestore DB, FCM 무료 푸시 | Spark(무료) 플랜 시작 |
| **Claude Console** | `ANTHROPIC_API_KEY` | 1인칭 대화, 기억 추출(구조화 JSON), 위험도 분류 | AI 제공사를 Claude 하나로 통일 |
| **Arweave 지갑 + Turbo(ar.io)** | 지갑 키 파일(JWK) + Turbo 크레딧 | 기억 코어 영구 봉인 업로드 대납 | 크레딧은 카드 충전 가능(충전 수수료 있음, 환불 불가). 착수 시 최신 수수료 확인 |

*(Apple Developer $99는 안드로이드 14일 테스트 및 출시 후 iOS 포팅 직전에 결제)*

---

## 2. 보안 환경변수 격리 및 서버리스 중계 구조

```
[Flutter App Client] ──(Firebase ID Token)──> [Serverless Edge Gateway] ──> [External APIs]
 (AES-256 암호화만 수행)                       (Turbo 업로드 대납)           (Arweave, Claude)
 (마스터 복구 키는 단말 보관)                  (지갑 키 보관, 대화 미저장)
```

### 2.1 서버리스 백엔드 Secret (.env)
```env
# Arweave 지갑 키 파일(JWK) 경로. 저장소에 절대 커밋하지 않음
ARWEAVE_JWK_PATH=/secrets/arweave-wallet.json

ANTHROPIC_API_KEY=sk-ant-...
# 모델 ID는 코드에 박지 않고 환경변수로 관리 (단종 대응)
CHAT_MODEL=claude-sonnet-5-5
UTILITY_MODEL=claude-haiku-5-5
```

### 2.2 Flutter 클라이언트 (.env.local)
```env
API_BASE_URL=https://your-serverless-api.net
APP_ENV=development
APP_NAME="온기"
```
