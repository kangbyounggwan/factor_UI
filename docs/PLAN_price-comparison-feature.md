# 가격비교 기능 구현 계획

## 개요
3D 프린터 관련 제품(프린터, 부품, 필라멘트 등)의 가격을 여러 마켓플레이스에서 비교하는 기능

## 기술 스택
- **API**: SerpAPI (Google Shopping, Naver Shopping 등)
- **백엔드**: Python (FastAPI)
- **프론트엔드**: React + TypeScript

## 구현 범위

### 1단계: 백엔드 (Python)
- [ ] SerpAPI 연동 서비스 구현
- [ ] 가격비교 엔드포인트 추가 (`/api/chat` 내 intent 처리)
- [ ] 마켓플레이스별 결과 정규화
- [ ] 환율 변환 로직 (USD → KRW)
- [ ] 캐싱 전략 (Redis 또는 메모리)

### 2단계: 프론트엔드 (완료)
- [x] 타입 정의 (`PriceComparisonProduct`, `PriceComparisonData`)
- [x] `PriceComparisonCard` 컴포넌트
- [x] `ChatMessage`에서 가격비교 카드 렌더링
- [x] 다국어 지원 (ko/en)

### 3단계: 통합
- [ ] 백엔드에서 가격비교 의도 자동 감지
- [ ] 응답에 `priceComparisonData` 포함
- [ ] 프론트엔드에서 자동 렌더링

## 데이터 구조

### API 요청 (Frontend → Python Backend)

```json
{
  "user_id": "uuid-or-anonymous_xxxxx",
  "user_plan": "free" | "starter" | "pro" | "enterprise",
  "message": "Ender 3 V2 가격 비교해줘",
  "selected_tool": "price_comparison",
  "selected_model": "gemini-2.5-flash-lite",
  "language": "ko" | "en",
  "conversation_id": "session-uuid (optional)",
  "conversation_history": [
    { "role": "user", "content": "이전 메시지" },
    { "role": "assistant", "content": "이전 응답" }
  ],
  "price_comparison_options": {
    "marketplaces": ["naver", "coupang", "amazon", "ebay"],
    "min_price": 100000,
    "max_price": 500000,
    "sort_by": "price_asc" | "price_desc" | "rating" | "review_count" | "relevance",
    "max_results": 10,
    "category": "3d_printer" | "filament" | "parts" | "accessories",
    "in_stock_only": true
  }
}
```

#### 필드 설명
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_id` | string | O | 사용자 ID (비로그인: `anonymous_xxxxx`) |
| `user_plan` | string | O | 구독 플랜 |
| `message` | string | O | 검색할 제품명 또는 키워드 |
| `selected_tool` | string | O | `"price_comparison"` 고정 |
| `selected_model` | string | X | AI 모델 (가격비교에서는 미사용) |
| `language` | string | O | 응답 언어 |
| `conversation_id` | string | X | 대화 세션 ID |
| `conversation_history` | array | X | 이전 대화 컨텍스트 |
| `price_comparison_options` | object | X | 상세 검색 옵션 (아래 참조) |

#### price_comparison_options 상세
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `marketplaces` | string[] | 전체 | 검색할 마켓플레이스 |
| `min_price` | number | - | 최소 가격 (KRW) |
| `max_price` | number | - | 최대 가격 (KRW) |
| `sort_by` | string | `"relevance"` | 정렬 기준 |
| `max_results` | number | 10 | 최대 결과 수 |
| `category` | string | - | 카테고리 필터 |
| `in_stock_only` | boolean | false | 재고 있는 상품만 |

### API 응답 (Python Backend → Frontend)

```json
{
  "success": true,
  "response": "'Ender 3 V2'에 대한 가격 비교 결과입니다. 총 4개의 상품을 찾았습니다.",
  "intent": "price_comparison",
  "tool_result": {
    "tool_name": "price_comparison",
    "success": true,
    "data": {
      "query": "Ender 3 V2",
      "results_count": 4,
      "markets_searched": ["naver", "coupang", "amazon", "ebay"],
      "products": [
        {
          "id": "prod_001",
          "title": "Creality Ender 3 V2 3D 프린터",
          "price": 189.99,
          "currency": "USD",
          "price_krw": 249000,
          "original_price": 219.99,
          "discount_percent": 14,
          "marketplace": "amazon",
          "product_url": "https://amazon.com/...",
          "image_url": "https://images.../product.jpg",
          "rating": 4.5,
          "review_count": 12543,
          "in_stock": true
        }
      ]
    }
  }
}
```

### TypeScript 타입 정의 (참조용)
```typescript
interface PriceComparisonData {
  query: string;
  results_count: number;
  products: PriceComparisonProduct[];
  markets_searched: string[];
}

interface PriceComparisonProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  price_krw: number;
  original_price?: number;
  discount_percent?: number;
  marketplace: 'naver' | 'coupang' | 'amazon' | 'ebay';
  product_url: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  in_stock: boolean;
}
```

## 지원 마켓플레이스
- 네이버 쇼핑 (한국)
- 쿠팡 (한국)
- Amazon (글로벌)
- eBay (글로벌)

## 사용 시나리오
1. 사용자가 "Ender 3 V2 가격 비교해줘" 입력
2. 백엔드에서 가격비교 의도 감지
3. SerpAPI로 각 마켓플레이스 검색
4. 결과 정규화 및 KRW 환산
5. 프론트엔드에서 카드 형태로 표시

## 주의사항
- SerpAPI 비용 관리 (월별 쿼리 제한)
- 가격 정보 실시간성 vs 캐싱 트레이드오프
- 제품 이미지 저작권 이슈

## 참고
- 도구 버튼 제거됨 - 백엔드에서 자동 감지 방식으로 변경
- 프론트엔드 UI 컴포넌트는 구현 완료 상태
