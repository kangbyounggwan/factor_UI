/**
 * PriceComparisonCard 컴포넌트
 * 가격비교 결과를 카드 형태로 표시
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PriceComparisonProduct } from '@shared/services/chatApiService';

const MARKETPLACE_COLORS: Record<string, string> = {
  naver: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  coupang: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  amazon: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  ebay: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface Props {
  products: PriceComparisonProduct[];
  query: string;
}

export const PriceComparisonCard: React.FC<Props> = ({ products, query }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  // 디버그 로그
  console.log('[PriceComparisonCard] Rendering with:', {
    query,
    productCount: products?.length,
    products: products?.map(p => ({
      id: p.id,
      title: p.title?.slice(0, 30),
      product_url: p.product_url,
      marketplace: p.marketplace,
      price: p.price,
    })),
  });

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('priceComparison.noResults', '검색 결과가 없습니다')}
      </div>
    );
  }

  const lowestPrice = Math.min(...products.map(p => p.price_krw));
  const displayProducts = showAll ? products : products.slice(0, 4);

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'KRW') {
      return `${price.toLocaleString()}원`;
    }
    return `$${price.toFixed(2)}`;
  };

  const getMarketplaceLabel = (marketplace: string) => {
    const labels: Record<string, string> = {
      naver: t('priceComparison.naver', '네이버'),
      coupang: t('priceComparison.coupang', '쿠팡'),
      amazon: t('priceComparison.amazon', '아마존'),
      ebay: t('priceComparison.ebay', 'eBay'),
    };
    return labels[marketplace] || marketplace;
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {t('priceComparison.title', '가격 비교 결과')}
        </h3>
        <span className="text-sm text-muted-foreground">
          {t('priceComparison.found', '{{count}}개 상품', { count: products.length })}
        </span>
      </div>

      {/* 검색어 표시 */}
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">"{query}"</span>
      </div>

      {/* 상품 목록 */}
      <div className="grid gap-3">
        {displayProducts.map((product) => {
          const isLowest = product.price_krw === lowestPrice;

          return (
            <Card
              key={product.id}
              className={cn(
                'transition-all hover:shadow-md',
                isLowest && 'ring-2 ring-amber-400 dark:ring-amber-500'
              )}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* 상품 이미지 */}
                  {product.image_url && (
                    <div className="shrink-0">
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-20 h-20 object-cover rounded-lg bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* 상품 정보 */}
                  <div className="flex-1 min-w-0">
                    {/* 마켓 뱃지 & 최저가 */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={MARKETPLACE_COLORS[product.marketplace] || 'bg-gray-100 text-gray-800'}>
                        {getMarketplaceLabel(product.marketplace)}
                      </Badge>
                      {isLowest && (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400">
                          {t('priceComparison.lowestPrice', '최저가')}
                        </Badge>
                      )}
                      {!product.in_stock && (
                        <Badge variant="secondary" className="text-muted-foreground">
                          {t('priceComparison.outOfStock', '품절')}
                        </Badge>
                      )}
                    </div>

                    {/* 상품명 */}
                    <h4 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.title}
                    </h4>

                    {/* 가격 */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-primary">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      {product.original_price && product.discount_percent && (
                        <>
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(product.original_price, product.currency)}
                          </span>
                          <span className="text-sm text-red-500 font-medium">
                            -{product.discount_percent}%
                          </span>
                        </>
                      )}
                    </div>

                    {/* 평점 & 리뷰 */}
                    {(product.rating || product.review_count) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {product.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {product.rating.toFixed(1)}
                          </span>
                        )}
                        {product.review_count && (
                          <span>
                            {t('priceComparison.reviews', '리뷰')} {product.review_count.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 링크 버튼 */}
                  <div className="shrink-0 flex items-start">
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title={t('priceComparison.goToProduct', '상품 페이지로 이동')}
                    >
                      <ExternalLink className="w-5 h-5 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 더보기/접기 버튼 */}
      {products.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              {t('common.showLess', '접기')}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              {t('priceComparison.showMore', '더보기')} ({products.length - 4})
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default PriceComparisonCard;
