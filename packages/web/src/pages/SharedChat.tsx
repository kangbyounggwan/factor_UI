/**
 * Shared Chat Page
 * 공유된 채팅 대화 조회 페이지
 * URL: /share/:shareId
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSharedChat, type SharedChat, type SharedReferenceImage, type SharedPriceComparisonData } from '@shared/services/supabaseService/sharedChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ArrowLeft, Eye, Calendar, ExternalLink, Activity, MessageCircle, User, Cpu, ImageIcon, ZoomIn, X, File, Star, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useIsMobile } from '@/hooks/use-mobile';
import { SharedBottomNavigation } from '@/components/shared/SharedBottomNavigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/**
 * 마크다운 렌더링 전 ~ 문자를 이스케이프
 * remarkGfm의 strikethrough(~~text~~) 문법과 충돌 방지
 * 예: "190~220°C" → "190\~220°C"
 */
function escapeMarkdownTildes(content: string): string {
  return content.replace(/(?<!\\)~(?!~)/g, '\\~');
}

/**
 * 출처 정보 타입
 */
interface SourceInfo {
  title: string;
  url: string;
}

/**
 * 마크다운에서 출처/참고 자료 링크를 추출하고 본문과 분리
 * GPT 스타일: 본문에서 출처를 제거하고 하단에 별도 섹션으로 표시
 *
 * 주의: 인라인 출처 텍스트 (예: "출처: [official] 텍스트...")는 제거하지 않음
 * 마크다운 링크 형식 [title](url)이 포함된 경우만 추출 및 하단 이동
 */
function extractSources(content: string): { cleanContent: string; sources: SourceInfo[] } {
  const sources: SourceInfo[] = [];

  // 마크다운 링크가 포함된 출처 섹션만 추출
  // 인라인 텍스트 출처는 건드리지 않음
  const sourcePatterns = [
    // === 한국어 패턴 (마크다운 링크 필수) ===
    /📚\s*참고\s*자료:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*\*\*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*📚\s*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*📎\s*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*더\s*알아보기:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*관련\s*링크:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // === 영어 패턴 (마크다운 링크 필수) ===
    /📚\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*References?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*\*\*Sources?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /🔗\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Sources?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*References?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Learn More:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Related Links?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
  ];

  let cleanContent = content;

  for (const pattern of sourcePatterns) {
    cleanContent = cleanContent.replace(pattern, (match, sourceText) => {
      // [Title](URL) 패턴 추출 - 반드시 마크다운 링크가 있어야 함
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      let hasValidLinks = false;
      while ((linkMatch = linkPattern.exec(sourceText)) !== null) {
        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        // 중복 체크 및 유효한 URL만 추가
        if (url.startsWith('http') && !sources.some(s => s.url === url)) {
          sources.push({ title, url });
          hasValidLinks = true;
        }
      }
      // 마크다운 링크가 있는 경우에만 본문에서 제거
      return hasValidLinks ? '' : match;
    });
  }

  // 정리: 잔여물 제거
  cleanContent = cleanContent.replace(/\*\*\s*\*\*/g, '');
  cleanContent = cleanContent.replace(/\*\*\s*\n\s*\*\*/g, '');
  cleanContent = cleanContent.replace(/^\s*\*\*\s*$/gm, '');
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanContent, sources };
}

/**
 * 마크다운 컴포넌트 설정 (ChatMessage.tsx와 동일)
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-bold mt-6 mb-4 pb-2 border-b border-border">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-bold mt-6 mb-3 pb-1.5 border-b border-border/50">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold mt-5 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const isBoldOnlyLine = childArray.length === 1 &&
      typeof childArray[0] === 'object' &&
      childArray[0] !== null &&
      (childArray[0] as React.ReactElement).type === 'strong';

    if (isBoldOnlyLine) {
      return (
        <p className="my-4 mt-6 text-base font-bold leading-relaxed">
          {children}
        </p>
      );
    }
    return (
      <p className="my-3 leading-relaxed">
        {children}
      </p>
    );
  },
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={cn("block bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto", className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg overflow-x-auto my-4">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 space-y-2 my-4">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 space-y-2 my-4">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const hasContent = childArray.some(child => {
      if (typeof child === 'string') return child.trim().length > 0;
      if (typeof child === 'object' && child !== null) return true;
      return false;
    });

    if (!hasContent) {
      return null;
    }

    return (
      <li className="my-1.5 leading-relaxed [&>p]:inline [&>p]:my-0 [&>strong]:font-bold">
        {children}
      </li>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-5">
      <table className="min-w-full border-collapse border border-border">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-3 py-2">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="my-8 border-t-2 border-border/60" />
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 my-5 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg">
      {children}
    </blockquote>
  ),
};

/**
 * 가격비교 카드 컴포넌트 (SharedChat 전용)
 */
const MARKETPLACE_COLORS: Record<string, string> = {
  naver: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  coupang: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  amazon: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  ebay: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface SharedPriceComparisonCardProps {
  data: SharedPriceComparisonData;
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
}

function SharedPriceComparisonCard({ data, t }: SharedPriceComparisonCardProps) {
  const [showAll, setShowAll] = useState(false);
  const { products, query } = data;

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
    <div className="space-y-4 my-6 p-4 bg-muted/30 rounded-lg border">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">
            {t('priceComparison.title', '가격 비교 결과')}
          </h3>
        </div>
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
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                    <div className="flex items-baseline gap-2 flex-wrap">
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
}

export default function SharedChatPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<SharedChat | null>(null);
  const [selectedImage, setSelectedImage] = useState<SharedReferenceImage | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function loadSharedChat() {
      if (!shareId) {
        setError('invalidLink');
        setLoading(false);
        return;
      }

      try {
        const data = await getSharedChat(shareId);

        if (!data) {
          setError('expired');
          setLoading(false);
          return;
        }

        setChatData(data);
      } catch (err) {
        console.error('[SharedChatPage] Error:', err);
        setError('loadFailed');
      } finally {
        setLoading(false);
      }
    }

    loadSharedChat();
  }, [shareId]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('shared.loadingChat', 'Loading conversation...')}</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !chatData) {
    // 에러 타입에 따른 메시지 결정
    const getErrorTitle = () => {
      if (error === 'expired') return t('shared.chatExpired', 'Chat Not Found');
      if (error === 'invalidLink') return t('shared.invalidLink', 'Invalid Link');
      if (error === 'loadFailed') return t('shared.loadFailed', 'Failed to Load');
      return t('shared.chatNotFound', 'Chat Not Found');
    };

    const getErrorDesc = () => {
      if (error === 'expired') return t('shared.chatExpiredDesc', 'This share link has expired or been deleted.');
      if (error === 'invalidLink') return t('shared.invalidLinkDesc', 'The share link is invalid.');
      if (error === 'loadFailed') return t('shared.loadFailedDesc', 'Failed to load the conversation. Please try again.');
      return t('shared.chatNotFoundDesc', 'The shared conversation could not be found.');
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-2">
                {getErrorTitle()}
              </h1>
              <p className="text-muted-foreground">
                {getErrorDesc()}
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('shared.goHome', 'Go Home')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background", isMobile && "pb-20")}>
      {/* 공유 헤더 - 모바일/데스크탑 반응형 */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <Link to="/ai-chat" className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Activity className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-lg md:text-xl font-bold font-orbitron text-primary tracking-wide">
                  FACTOR
                </span>
              </Link>
              {/* 데스크탑에서만 구분선과 레이블 표시 */}
              {!isMobile && (
                <>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    {t('shared.sharedChat', 'Shared Chat')}
                  </div>
                </>
              )}
            </div>

            {/* 모바일: 간소화된 헤더, 데스크탑: 풀 헤더 */}
            <div className="flex items-center gap-2 md:gap-4 text-sm text-muted-foreground">
              {/* 조회수/날짜는 데스크탑에서만 */}
              {!isMobile && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    <span>{chatData.view_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(chatData.created_at).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              {/* 언어 변경 버튼 */}
              <LanguageSwitcher />
              {/* 모바일에서는 아이콘만, 데스크탑에서는 전체 버튼 */}
              <Link to="/ai-chat">
                <Button size="sm" className={cn("gap-2", isMobile && "px-3")}>
                  <MessageCircle className="w-4 h-4" />
                  {!isMobile && t('shared.tryFactor', 'Try FACTOR')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 대화 콘텐츠 */}
      <main className={cn(
        "container mx-auto px-4 max-w-4xl",
        isMobile ? "py-4" : "py-8"
      )}>
        {/* 제목 */}
        <div className={cn("mb-4", !isMobile && "mb-8")}>
          <h1 className={cn(
            "font-bold mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            {chatData.title || t('shared.chatConversation', 'Printer Troubleshooting Conversation')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('shared.generatedByFactor', 'Conversation with FACTOR AI Assistant')}
          </p>
          {/* 모바일에서 조회수/날짜 표시 */}
          {isMobile && (
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{chatData.view_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(chatData.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* 메시지 목록 */}
        <div className="space-y-6">
          {chatData.messages.map((message, index) => (
            <div key={index}>
              {message.role === 'user' ? (
                /* 사용자 메시지 - ChatMessage.tsx UserMessage와 동일 */
                <div className="flex flex-col items-end">
                  {/* 이미지 미리보기 */}
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 justify-end">
                      {message.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`uploaded-${imgIdx}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  )}
                  {/* 파일 미리보기 */}
                  {message.files && message.files.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground justify-end">
                      <File className="w-4 h-4" />
                      {message.files.map((f, fIdx) => (
                        <span key={fIdx} className="bg-muted px-2 py-1 rounded">{f.name}</span>
                      ))}
                    </div>
                  )}
                  {/* 메시지 내용 */}
                  <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] overflow-hidden">
                    <div className="text-base leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : (
                /* AI 메시지 - ChatMessage.tsx AssistantMessage와 동일 */
                (() => {
                  // 출처 추출 및 본문 분리
                  const { cleanContent, sources } = extractSources(message.content);
                  // ~ 문자 이스케이프 (ChatMessage.tsx와 동일하게 fixMarkdownLineBreaks 제거)
                  const escapedContent = escapeMarkdownTildes(cleanContent);
                  // API에서 받은 참고 자료가 있으면 그것을 사용, 없으면 본문에서 추출한 sources 사용
                  const displayReferences = message.references && message.references.length > 0
                    ? message.references
                    : sources;

                  return (
                    <div>
                      {/* 역할 라벨 */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                          <Cpu className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-base font-bold text-foreground">
                          FACTOR AI
                        </span>
                      </div>

                      {/* 메시지 내용 - 마크다운 렌더링 */}
                      <div className="prose prose-base max-w-none text-foreground pl-8 dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-p:my-3 prose-headings:my-4 prose-headings:mt-6">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {escapedContent}
                        </ReactMarkdown>
                      </div>

                      {/* 가격비교 섹션 */}
                      {message.priceComparisonData && message.priceComparisonData.products && message.priceComparisonData.products.length > 0 && (
                        <div className="pl-8">
                          <SharedPriceComparisonCard data={message.priceComparisonData} t={t} />
                        </div>
                      )}

                      {/* 참고 자료 섹션 - GPT 스타일 (하단 별도 표시) */}
                      {displayReferences.length > 0 && (
                        <div className="pl-8 mt-6 pt-4 border-t border-border/50">
                          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                            <ExternalLink className="w-4 h-4" />
                            <span>{t('shared.references', 'References')}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {displayReferences.map((ref, idx) => (
                              <a
                                key={`ref-${idx}-${ref.url}`}
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-full transition-colors group"
                                title={'snippet' in ref ? ref.snippet : undefined}
                              >
                                <span className="max-w-[200px] truncate">{ref.title}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 참조 이미지 섹션 - 문제진단 결과 이미지 */}
                      {message.referenceImages && message.referenceImages.length > 0 && (
                        <div className="pl-8 mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                            <span>{t('shared.referenceImages', 'Reference Images')}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {message.referenceImages.slice(0, 8).map((img, idx) => (
                              <button
                                key={`ref-img-${idx}-${img.source_url}`}
                                onClick={() => setSelectedImage(img)}
                                className="group relative block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all hover:shadow-md text-left"
                              >
                                <img
                                  src={img.thumbnail_url}
                                  alt={img.title}
                                  className="w-full h-24 object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                  <span className="text-[10px] text-white line-clamp-2 font-medium leading-tight">{img.title}</span>
                                </div>
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ZoomIn className="w-3 h-3 text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          ))}
        </div>

        {/* 이미지 확대 보기 모달 */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
            {selectedImage && (
              <div className="relative flex flex-col h-full">
                {/* 닫기 버튼 */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* 이미지 */}
                <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                  <img
                    src={selectedImage.thumbnail_url}
                    alt={selectedImage.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>

                {/* 하단 정보 */}
                <div className="p-4 bg-black/80 border-t border-white/10">
                  <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">{selectedImage.title}</h3>
                  <a
                    href={selectedImage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('shared.viewOriginal', 'View on original site')}
                  </a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* CTA - 모바일에서는 작게, 데스크탑에서는 크게 */}
        <div className={cn("text-center", isMobile ? "mt-6" : "mt-12")}>
          <Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
            <CardContent className={cn(isMobile ? "py-5 px-4" : "py-8")}>
              <h2 className={cn("font-bold mb-2", isMobile ? "text-lg" : "text-xl")}>
                {t('shared.tryFactorCTA', 'Solve Your 3D Printing Problems with FACTOR')}
              </h2>
              <p className={cn("text-muted-foreground mb-4", isMobile && "text-sm")}>
                {t('shared.tryFactorDesc', 'AI diagnoses your 3D printer issues and provides solutions.')}
              </p>
              <Link to="/ai-chat">
                <Button size={isMobile ? "default" : "lg"} className="gap-2">
                  <MessageCircle className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
                  {t('shared.startChat', 'Get Started Free')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 푸터 - 모바일에서는 숨기고 하단 네비게이션 표시 */}
      {!isMobile && (
        <footer className="border-t mt-12 py-8">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p className="mb-2">
              {t('shared.poweredBy', 'Powered by FACTOR - AI-Powered 3D Printing Assistant')}
            </p>
            <Link to="/" className="text-primary hover:underline">
              {t('shared.learnMore', 'Learn More About FACTOR')}
            </Link>
          </div>
        </footer>
      )}

      {/* 모바일 하단 네비게이션 */}
      {isMobile && <SharedBottomNavigation />}
    </div>
  );
}
