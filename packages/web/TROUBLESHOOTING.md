# 토스페이먼츠 결제위젯 문제 해결 가이드

## 현재 증상: "Loading payment widget..." 무한 로딩

결제 다이얼로그에서 위젯이 "Loading payment widget..." 상태에서 멈춰있는 경우입니다.

## 🔍 진단 단계

### 1. 브라우저 콘솔 확인

개발자 도구를 열어 콘솔을 확인하세요:

**Chrome/Edge**: `F12` 또는 `Ctrl + Shift + I`
**Firefox**: `F12` 또는 `Ctrl + Shift + K`

#### 예상되는 로그:
```
V2 결제 위젯 초기화 시작... {customerKey: "...", amount: 214920}
V2 결제 위젯 초기화 완료
V2 결제 위젯 렌더링 시작...
렌더링 파라미터: {amount: 214920, selector: "#payment-methods", domExists: true}
V2 결제 위젯 렌더링 완료
```

#### 에러가 발생한 경우:
에러 메시지를 확인하고 아래 섹션을 참고하세요.

### 2. 네트워크 탭 확인

개발자 도구 > Network 탭에서:
- `tosspayments` 관련 요청이 있는지 확인
- 실패한 요청(빨간색)이 있는지 확인
- 상태 코드가 200인지 확인

### 3. DOM 요소 확인

콘솔에서 다음 명령어 실행:
```javascript
document.querySelector("#payment-methods")
```

결과가 `null`이면 DOM이 렌더링되지 않은 것입니다.

## 🐛 일반적인 문제 및 해결책

### 문제 1: SDK가 로드되지 않음

**증상:**
```
Uncaught ReferenceError: loadPaymentWidget is not defined
```

**원인:** `@tosspayments/payment-widget-sdk` 패키지 문제

**해결책:**
```bash
cd packages/web
npm install @tosspayments/payment-widget-sdk@latest
npm run dev
```

### 문제 2: 잘못된 클라이언트 키

**증상:**
```
Error: Invalid client key
UNAUTHORIZED_KEY
```

**원인:** 클라이언트 키가 잘못되었거나 환경 변수가 설정되지 않음

**해결책:**
1. `.env` 파일 확인:
```env
VITE_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
```

2. 개발 서버 재시작:
```bash
npm run dev
```

### 문제 3: DOM이 준비되지 않음

**증상:**
```
DOM이 준비되지 않음
```

**원인:** `#payment-methods` 요소가 없음

**해결책:**
이미 수정되었습니다. DOM 요소가 항상 렌더링되도록 변경했습니다.

### 문제 4: CORS 오류

**증상:**
```
Access to fetch at 'https://...' from origin '...' has been blocked by CORS policy
```

**원인:** 로컬 개발 환경에서 CORS 제한

**해결책:**
테스트 키를 사용하는 경우 발생하지 않아야 합니다. 발생한다면:
1. 브라우저 캐시 삭제
2. 시크릿/프라이빗 모드에서 테스트
3. 개발 서버 재시작

### 문제 5: Amount가 0원

**증상:**
```
Error: Amount must be greater than 0
```

**원인:** 금액이 0으로 설정됨 (Basic 플랜)

**해결책:**
Pro 또는 Enterprise 플랜을 선택하세요. Basic 플랜은 무료(₩0)입니다.

### 문제 6: renderPaymentMethods 실패

**증상:**
```
Error: Failed to render payment methods
NOT_FOUND_PAYMENT_SESSION
```

**원인:**
- 잘못된 variantKey
- 토스페이먼츠 서버 문제

**해결책:**
1. variantKey를 "DEFAULT"로 변경
2. 토스페이먼츠 개발자센터에서 상태 확인
3. 몇 분 후 다시 시도

## 🧪 디버깅 체크리스트

단계별로 확인하세요:

- [ ] 개발 서버가 실행 중인가? (`npm run dev`)
- [ ] 브라우저 콘솔에 에러가 있는가?
- [ ] 네트워크 탭에서 API 요청이 실패했는가?
- [ ] `.env` 파일에 클라이언트 키가 있는가?
- [ ] `#payment-methods` DOM 요소가 존재하는가?
- [ ] 선택한 플랜의 금액이 0보다 큰가?
- [ ] 브라우저 확장 프로그램(애드블록 등)을 비활성화했는가?

## 🔧 고급 디버깅

### 콘솔에서 직접 테스트

브라우저 콘솔에서 다음을 실행:

```javascript
// 1. SDK 로드 확인
console.log(typeof loadPaymentWidget);
// 예상 결과: "function"

// 2. DOM 확인
console.log(document.querySelector("#payment-methods"));
// 예상 결과: <div id="payment-methods"></div>

// 3. 환경 변수 확인 (Vite 앱에서만)
console.log(import.meta.env.VITE_TOSS_CLIENT_KEY);
// 예상 결과: "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
```

### 수동으로 위젯 초기화

```javascript
const { loadPaymentWidget } = await import('@tosspayments/payment-widget-sdk');

const widget = await loadPaymentWidget(
  'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',
  'test_customer_123'
);

await widget.setAmount({
  currency: "KRW",
  value: 50000,
});

await widget.renderPaymentMethods({
  selector: "#payment-methods",
  variantKey: "DEFAULT",
});
```

## 📞 도움 요청

위 해결책으로 문제가 해결되지 않으면:

1. **브라우저 콘솔 스크린샷** 찍기
2. **네트워크 탭 스크린샷** 찍기
3. **재현 단계** 정리하기
4. 토스페이먼츠 지원팀에 문의:
   - 전화: 1544-7772
   - 이메일: support@tosspayments.com
   - 실시간 채팅: https://docs.tosspayments.com/

## 🎯 빠른 테스트 방법

단독 HTML 테스트 페이지로 SDK 자체를 테스트:

```bash
npm run dev
```

브라우저에서:
```
http://localhost:5173/test-payment-widget.html
```

이 페이지에서도 같은 문제가 발생하면 SDK 자체의 문제일 수 있습니다.

## ✅ 해결되었는지 확인

다음과 같이 표시되면 성공:
- ✅ 로딩 스피너가 사라짐
- ✅ 결제 수단 선택 UI가 보임 (카드, 계좌이체, 간편결제 등)
- ✅ "₩214,920 Pay" 버튼이 활성화됨
- ✅ 콘솔에 "V2 결제 위젯 렌더링 완료" 메시지

## 📝 로그 수집 요청

문제가 계속되면 다음 정보를 수집해주세요:

1. 브라우저 종류 및 버전
2. 운영체제
3. 콘솔 전체 로그 (복사)
4. 네트워크 요청/응답
5. 선택한 플랜 (Basic/Pro/Enterprise)
6. 연간/월간 결제 선택
7. 사용자 로그인 여부

이 정보가 있으면 문제를 더 빠르게 해결할 수 있습니다.
