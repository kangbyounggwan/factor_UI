# 토스페이먼츠 결제위젯 V2 테스트 가이드

## 📋 개요

이 프로젝트는 **토스페이먼츠 Payment Widget SDK V2**를 사용하여 결제 시스템을 구현했습니다.

## 🔧 설치된 패키지

```json
{
  "@tosspayments/payment-widget-sdk": "^0.12.0",
  "@tosspayments/tosspayments-sdk": "^2.4.0"
}
```

## 🔑 테스트 환경

### 환경 변수 (.env)
```env
VITE_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
VITE_TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
```

> ⚠️ **중요**: 현재 테스트 키를 사용 중입니다. 실제 운영 환경에서는 토스페이먼츠와 계약 후 발급받은 **라이브 키**로 변경해야 합니다.

## 🧪 테스트 방법

### 방법 0: 진단 도구 (문제가 있을 때)

위젯이 로딩되지 않는 경우 먼저 진단 도구를 실행하세요:

1. 개발 서버 시작:
```bash
cd packages/web
npm run dev
```

2. 브라우저에서 진단 페이지 열기:
```
http://localhost:5173/diagnostic.html
```

3. "전체 진단 실행" 버튼 클릭

4. 각 항목의 결과 확인:
   - ✅ 모두 통과: 정상 작동
   - ❌ 실패: 해당 항목의 에러 메시지 확인

### 방법 1: 단독 HTML 테스트 페이지

1. 개발 서버 시작:
```bash
cd packages/web
npm run dev
```

2. 브라우저에서 테스트 페이지 열기:
```
http://localhost:5173/test-payment-widget.html
```

3. 테스트 흐름:
   - 페이지 로드 시 자동으로 결제 위젯이 초기화됩니다
   - 결제 수단을 선택합니다 (카드, 계좌이체, 간편결제 등)
   - "결제하기" 버튼을 클릭합니다
   - 테스트 결제 정보를 입력합니다 (실제 결제 안 됨)

**중요**: 개발자 도구(F12)의 콘솔 탭을 열어두고 로그를 확인하세요.

### 방법 2: React 애플리케이션 테스트

1. 개발 서버 시작:
```bash
cd packages/web
npm run dev
```

2. 구독 페이지로 이동:
```
http://localhost:5173/subscription
```

3. 플랜 선택 후 "Subscribe" 버튼 클릭

4. PaymentDialog에서 테스트:
   - 고객 정보 입력
   - 결제 수단 선택
   - "결제하기" 버튼 클릭

## 📝 V2 SDK 사용 패턴

### 1. 위젯 초기화
```javascript
// V2: loadPaymentWidget 사용
const paymentWidget = await loadPaymentWidget(CLIENT_KEY, customerKey);
```

### 2. 금액 설정
```javascript
// V2: setAmount 메서드로 금액 설정
await paymentWidget.setAmount({
  currency: "KRW",
  value: 50000,
});
```

### 3. 결제 UI 렌더링
```javascript
// V2: renderPaymentMethods로 결제 수단 UI 렌더링
await paymentWidget.renderPaymentMethods({
  selector: "#payment-method",
  variantKey: "DEFAULT",
});
```

### 4. 약관 UI 렌더링 (선택)
```javascript
// V2: renderAgreement로 약관 UI 렌더링
await paymentWidget.renderAgreement({
  selector: "#agreement",
  variantKey: "AGREEMENT",
});
```

### 5. 결제 요청
```javascript
// V2: requestPayment로 결제 요청
await paymentWidget.requestPayment({
  orderId: "ORDER_123",
  orderName: "상품명",
  successUrl: window.location.origin + "/payment/success",
  failUrl: window.location.origin + "/payment/fail",
  customerEmail: "test@example.com",
  customerName: "홍길동",
});
```

## 🎯 주요 개선 사항 (V2)

### 이전 패턴 (잘못된 방식)
```javascript
// ❌ 잘못된 패턴 - renderPaymentMethods에 금액 직접 전달
await paymentWidget.renderPaymentMethods(
  selector,
  { value: amount },
  { variantKey: "DEFAULT" }
);
```

### V2 최신 패턴 (올바른 방식)
```javascript
// ✅ V2 패턴 - setAmount와 renderPaymentMethods 분리
await paymentWidget.setAmount({
  currency: "KRW",
  value: amount,
});

await paymentWidget.renderPaymentMethods({
  selector: "#payment-method",
  variantKey: "DEFAULT",
});
```

## 📂 주요 파일 구조

```
packages/web/
├── src/
│   ├── lib/
│   │   └── tossPaymentsService.ts       # V2 SDK 통합 서비스
│   ├── components/
│   │   └── PaymentDialog.tsx            # 결제 다이얼로그 컴포넌트
│   ├── pages/
│   │   ├── PaymentSuccess.tsx           # 결제 성공 페이지
│   │   └── PaymentFail.tsx              # 결제 실패 페이지
│   └── .env                              # 환경 변수
└── public/
    └── test-payment-widget.html         # 단독 테스트 페이지
```

## 🔍 테스트 카드 정보

토스페이먼츠 테스트 키를 사용하면 **실제로 결제가 되지 않습니다**. 아래 정보로 테스트할 수 있습니다:

### 카드 결제
- **카드번호**: 아무 16자리 숫자
- **유효기간**: 미래 날짜
- **CVC**: 아무 3자리 숫자
- **비밀번호**: 앞 2자리 아무 숫자

### 간편결제
- 토스페이, 네이버페이, 카카오페이 등 테스트 계정으로 로그인

## ✅ 체크리스트

### 개발 환경
- [x] Payment Widget SDK v0.12.0 설치
- [x] 테스트 클라이언트 키 설정
- [x] V2 패턴으로 코드 업데이트
- [x] 테스트 HTML 페이지 작성
- [ ] 결제 승인 API 구현 (백엔드)

### 운영 환경 배포 전
- [ ] 토스페이먼츠와 전자결제 계약 완료
- [ ] 라이브 클라이언트 키 발급
- [ ] 라이브 시크릿 키 발급
- [ ] 환경 변수를 라이브 키로 변경
- [ ] successUrl, failUrl 도메인 확인
- [ ] 결제위젯 어드민에서 UI 커스터마이징
- [ ] 결제 승인 API 서버 구현
- [ ] 웹훅 엔드포인트 등록
- [ ] 실제 결제 테스트

## 🚨 주의사항

1. **customerKey 보안**
   - UUID 형식 사용 권장
   - 이메일, 전화번호 등 유추 가능한 값 사용 금지
   - 다른 사용자가 탈취 시 악의적 사용 가능

2. **금액 검증**
   - successUrl의 쿼리 파라미터 `amount`와 요청 시 `amount` 비교 필수
   - 클라이언트에서 금액 조작 방지

3. **결제 승인**
   - 결제 요청 후 10분 이내에 승인 API 호출 필요
   - 10분 경과 시 결제 데이터 유실

4. **시크릿 키**
   - 절대 클라이언트 코드에 노출 금지
   - GitHub 등 공개 저장소에 커밋 금지
   - 서버 사이드에서만 사용

## 📚 참고 문서

- [토스페이먼츠 개발자 문서](https://docs.tosspayments.com/)
- [결제위젯 가이드](https://docs.tosspayments.com/guides/payment-widget/overview)
- [Payment Widget SDK v2](https://docs.tosspayments.com/sdk/v2/js)
- [결제위젯 어드민](https://developers.tosspayments.com/widget)

## 🐛 문제 해결

### 위젯이 렌더링되지 않는 경우
1. 콘솔에서 에러 메시지 확인
2. DOM 요소가 생성되었는지 확인 (`#payment-method`)
3. SDK 스크립트가 정상 로드되었는지 확인

### 결제 요청이 실패하는 경우
1. 네트워크 탭에서 API 호출 확인
2. customerKey 형식 확인 (2-50자, 특수문자 제한)
3. 클라이언트 키가 올바른지 확인

### 결제 승인이 실패하는 경우
1. 시크릿 키 인코딩 확인 (`:` 포함)
2. paymentKey, orderId, amount 값 일치 여부 확인
3. 10분 타임아웃 체크

## 📞 지원

- 토스페이먼츠 고객센터: 1544-7772
- 이메일: support@tosspayments.com
- 실시간 기술지원: [채팅 상담](https://docs.tosspayments.com/)
