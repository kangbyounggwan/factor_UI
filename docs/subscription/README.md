# 결제 및 구독 시스템 문서

FACTOR 결제/구독 시스템에 대한 기술 문서입니다.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [STATUS.md](./STATUS.md) | 구독 상태(status) 값 정의 및 규칙 |
| [PLANS.md](./PLANS.md) | 플랜 구성 및 기능 제한 |
| [PAYMENT_FLOW.md](./PAYMENT_FLOW.md) | 결제 플로우 및 Paddle 연동 |
| [DATABASE.md](./DATABASE.md) | DB 스키마 및 테이블 구조 |
| [WEBHOOK.md](./WEBHOOK.md) | Paddle 웹훅 처리 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 문제 해결 가이드 |
| [PAGE_LAYOUT.md](./PAGE_LAYOUT.md) | 페이지별 AppSidebar/AppHeader 구성 |
| [PROFILE_SETUP.md](./PROFILE_SETUP.md) | 프로필 초기 설정 페이지 |

## 빠른 참조

### 구독 상태 (Status)

```
active    → 정상 활성 구독
cancelled → 취소됨 (기간 종료 시 만료 예정)
expired   → 만료됨 (Free로 전환됨)
past_due  → 결제 실패 (재시도 중)
```

### 플랜 종류 (Plan Name)

```
free       → 무료 플랜
starter    → 스타터 플랜 (₩9,900/월)
pro        → 프로 플랜 (₩29,900/월)
enterprise → 엔터프라이즈 (문의)
```

### 주요 파일 위치

```
packages/shared/src/
├── types/subscription.ts              # 타입 정의 및 상수
├── services/supabaseService/
│   └── subscription.ts                # 구독 서비스 함수
└── hooks/useUserPlan.ts               # 플랜 조회 훅

packages/web/src/
├── pages/
│   ├── Subscription.tsx               # 플랜 선택 페이지
│   ├── UserSettings.tsx               # 구독 관리
│   ├── PaymentCheckout.tsx            # 체크아웃
│   └── PaymentSuccess.tsx             # 결제 완료
└── lib/paddleService.ts               # Paddle SDK 연동
```

---

*마지막 업데이트: 2026-01-17*
