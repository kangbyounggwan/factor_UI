import { useEffect } from 'react';

export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

const BASE_URL = 'https://factor.io.kr';
const DEFAULT_IMAGE = `${BASE_URL}/FACTOR_LOGO.png`;
const SITE_NAME = 'FACTOR';

// 공통 키워드 (모든 페이지에 포함)
const COMMON_KEYWORDS = [
  'FACTOR',
  '3D 프린터',
  '스마트 팩토리',
  'smart factory',
  '3D printing',
  '3D 프린팅',
];

// 페이지별 SEO 데이터 사전 정의
export const SEO_DATA: Record<string, SEOData> = {
  home: {
    title: 'FACTOR - 3D 프린터 스마트 팩토리 솔루션 | AI 기반 원격 모니터링 플랫폼',
    description: 'FACTOR는 3D 프린터를 실시간으로 모니터링하고 AI로 제어하는 스마트 팩토리 솔루션입니다. OctoPrint, SimplyPrint 대안으로 원격 제어, 실시간 모니터링, AI 고장 진단, G-code 분석 기능을 제공합니다.',
    keywords: [
      ...COMMON_KEYWORDS,
      // 핵심 서비스 키워드
      '3D 프린터 모니터링',
      '3D printer monitoring',
      '원격 모니터링',
      'remote monitoring',
      '실시간 모니터링',
      'real-time monitoring',
      // 경쟁 제품 대안 키워드
      'OctoPrint 대안',
      'OctoPrint alternative',
      'SimplyPrint 대안',
      '3DPrinterOS 대안',
      'AstroPrint 대안',
      // 기술 키워드
      'AI 제조',
      'IoT 제조',
      '제조 자동화',
      '적층 제조',
      'additive manufacturing',
      // 기능 키워드
      '원격 제어',
      'remote control',
      '클라우드 3D 프린팅',
      'cloud 3D printing',
      '웹캠 모니터링',
      'webcam monitoring',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'FACTOR',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: '3D Printer Management Software',
      operatingSystem: 'Web, iOS, Android',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'KRW',
        description: '무료 플랜 제공',
      },
      featureList: [
        '실시간 3D 프린터 모니터링',
        'AI 기반 고장 진단 및 예측',
        '원격 프린터 제어',
        'G-code 분석 및 최적화',
        '멀티 프린터 관리',
        '웹캠 실시간 스트리밍',
      ],
    },
  },

  subscription: {
    title: 'FACTOR 요금제 - 3D 프린터 모니터링 구독 플랜 | 무료 시작',
    description: 'FACTOR의 합리적인 요금제를 확인하세요. 무료 플랜으로 시작하고 AI 고장 진단, 무제한 프린터 연결, 고급 분석 기능이 포함된 Pro 플랜으로 업그레이드하세요. 3D 프린터 SaaS 구독 서비스.',
    keywords: [
      ...COMMON_KEYWORDS,
      // 요금제 키워드
      '3D 프린터 구독',
      '3D printer subscription',
      'SaaS 요금제',
      'SaaS pricing',
      '월 구독',
      'monthly subscription',
      '무료 플랜',
      'free plan',
      'Pro 플랜',
      // 가격 관련
      '3D 프린터 소프트웨어 가격',
      '3D printer software pricing',
      '모니터링 서비스 요금',
      // 경쟁 비교
      'OctoPrint vs FACTOR',
      'SimplyPrint 가격',
      '3DPrinterOS 가격',
      // 기능별 요금
      'AI 분석 요금',
      '원격 제어 구독',
      '클라우드 스토리지',
    ],
    ogType: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'FACTOR Pro 구독',
      description: '3D 프린터 원격 모니터링 및 AI 분석 Pro 플랜',
      brand: {
        '@type': 'Brand',
        name: 'FACTOR',
      },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '29900',
        priceCurrency: 'KRW',
        offerCount: '3',
      },
    },
  },

  'supported-printers': {
    title: '지원 프린터 목록 - Bambu Lab, Creality, Prusa 호환 | FACTOR',
    description: 'FACTOR가 지원하는 3D 프린터 전체 목록입니다. Bambu Lab P1S/X1C, Creality Ender/K1, Prusa MK4, Anycubic, Elegoo 등 100개 이상의 FDM/SLA 프린터와 호환됩니다. OctoPrint, Klipper, Marlin 펌웨어 지원.',
    keywords: [
      ...COMMON_KEYWORDS,
      // 브랜드별 키워드
      'Bambu Lab 호환',
      'Bambu Lab P1S',
      'Bambu Lab X1 Carbon',
      'Bambu Lab A1',
      'Creality 호환',
      'Creality Ender 3',
      'Creality K1',
      'Creality K1 Max',
      'Prusa 호환',
      'Prusa MK4',
      'Prusa Mini',
      'Anycubic 호환',
      'Anycubic Kobra',
      'Elegoo 호환',
      'Elegoo Neptune',
      'Voron',
      // 펌웨어 키워드
      'OctoPrint 호환',
      'Klipper 호환',
      'Marlin 호환',
      'Mainsail',
      'Fluidd',
      // 프린터 타입
      'FDM 프린터',
      'FDM printer',
      'SLA 프린터',
      'SLA printer',
      '레진 프린터',
      'resin printer',
      // 호환성 관련
      '3D 프린터 호환성',
      '3D printer compatibility',
      '지원 프린터 목록',
      'supported printers list',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'FACTOR 지원 3D 프린터 목록',
      description: 'FACTOR와 호환되는 3D 프린터 브랜드 및 모델 목록',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bambu Lab' },
        { '@type': 'ListItem', position: 2, name: 'Creality' },
        { '@type': 'ListItem', position: 3, name: 'Prusa' },
        { '@type': 'ListItem', position: 4, name: 'Anycubic' },
        { '@type': 'ListItem', position: 5, name: 'Elegoo' },
      ],
    },
  },

  'ai-chat': {
    title: 'AI 3D 프린터 진단 - 고장 분석 & G-code 최적화 | FACTOR',
    description: 'AI가 3D 프린터 문제를 실시간 진단합니다. 사진 업로드로 레이어 분리, 노즐 막힘, 베드 접착 문제를 분석하고 해결책을 제안합니다. G-code 분석, 출력 설정 최적화, 예측 유지보수 기능 제공.',
    keywords: [
      ...COMMON_KEYWORDS,
      // AI 진단 키워드
      'AI 3D 프린터 진단',
      'AI 3D printer diagnosis',
      'AI 고장 진단',
      'AI fault diagnosis',
      '3D 프린터 문제 해결',
      '3D printer troubleshooting',
      // 문제 유형 키워드
      '레이어 분리',
      'layer separation',
      '노즐 막힘',
      'nozzle clogging',
      'clogged nozzle',
      '베드 접착',
      'bed adhesion',
      '필라멘트 문제',
      'filament issues',
      '스트링잉',
      'stringing',
      '고스팅',
      'ghosting',
      '언더익스트루전',
      'under extrusion',
      // G-code 키워드
      'G-code 분석',
      'G-code analysis',
      'G-code 시각화',
      'G-code visualization',
      'G-code 최적화',
      '슬라이서 설정',
      'slicer settings',
      // 예측 유지보수
      '예측 유지보수',
      'predictive maintenance',
      '예지보전',
      '고장 예측',
      'failure prediction',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'FACTOR AI 진단',
      applicationCategory: 'UtilityApplication',
      description: 'AI 기반 3D 프린터 고장 진단 및 G-code 분석 도구',
      featureList: [
        '이미지 기반 고장 진단',
        'G-code 파일 분석',
        '출력 설정 최적화 제안',
        '실시간 AI 채팅 지원',
      ],
    },
  },

  create: {
    title: 'AI 3D 모델 생성 - Text to 3D & Image to 3D | FACTOR',
    description: '텍스트나 이미지로 3D 모델을 무료로 생성하세요. AI가 설명을 3D 프린팅 가능한 STL/OBJ 파일로 변환합니다. Meshy, Tripo3D 대안으로 Text-to-3D, Image-to-3D 기능을 제공합니다.',
    keywords: [
      ...COMMON_KEYWORDS,
      // AI 3D 생성 키워드
      'AI 3D 모델 생성',
      'AI 3D model generator',
      'AI 3D 생성기',
      '3D 모델 생성',
      '3D model generation',
      // Text to 3D
      'Text to 3D',
      '텍스트 투 3D',
      '텍스트로 3D 모델',
      'text to 3D model',
      '프롬프트 3D',
      // Image to 3D
      'Image to 3D',
      '이미지 투 3D',
      '사진으로 3D 모델',
      '2D to 3D',
      '이미지 3D 변환',
      // 경쟁 제품 대안
      'Meshy 대안',
      'Meshy alternative',
      'Tripo3D 대안',
      'Sloyd 대안',
      '무료 AI 3D 생성',
      'free AI 3D generator',
      // 파일 형식
      'STL 생성',
      'STL generation',
      'OBJ 생성',
      '3D 프린팅 모델',
      '3D printable model',
      // 용도
      '게임 3D 모델',
      '3D 프린팅용 모델',
      '커스텀 3D 모델',
      'custom 3D model',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'FACTOR AI 3D 모델 생성기',
      applicationCategory: 'DesignApplication',
      description: 'AI 기반 Text-to-3D 및 Image-to-3D 모델 생성 도구',
      featureList: [
        '텍스트 설명으로 3D 모델 생성',
        '이미지에서 3D 모델 추출',
        'STL/OBJ 파일 내보내기',
        '3D 프린팅 최적화',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'KRW',
        description: '무료 크레딧 제공',
      },
    },
  },

  community: {
    title: '3D 프린팅 커뮤니티 - 팁, 질문, 트러블슈팅 | FACTOR',
    description: '3D 프린터 사용자들의 커뮤니티입니다. 출력 팁, 트러블슈팅 해결법, 모델 쇼케이스, 장비 리뷰를 공유하세요. 초보자부터 전문가까지 함께하는 3D 프린팅 커뮤니티.',
    keywords: [
      ...COMMON_KEYWORDS,
      // 커뮤니티 키워드
      '3D 프린팅 커뮤니티',
      '3D printing community',
      '3D 프린터 포럼',
      '3D printer forum',
      '3D 프린터 커뮤니티',
      // 콘텐츠 유형
      '3D 프린터 팁',
      '3D printing tips',
      '3D 프린터 트러블슈팅',
      '3D printer troubleshooting',
      '출력 문제 해결',
      'print quality issues',
      // 쇼케이스
      '3D 프린팅 작품',
      '3D print showcase',
      '출력물 갤러리',
      // 리뷰
      '3D 프린터 리뷰',
      '3D printer review',
      '필라멘트 리뷰',
      'filament review',
      // 질문/답변
      '3D 프린팅 질문',
      '3D printing Q&A',
      '초보자 가이드',
      'beginner guide',
    ],
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      name: 'FACTOR 3D 프린팅 커뮤니티',
      description: '3D 프린터 사용자들의 지식 공유 커뮤니티',
      publisher: {
        '@type': 'Organization',
        name: 'FACTOR',
        url: 'https://factor.io.kr',
      },
    },
  },
};

// 커뮤니티 게시물용 동적 SEO 데이터 생성 함수
export function createCommunityPostSEO(post: {
  title: string;
  category: string;
  content?: string;
  author?: string;
  created_at?: string;
  thumbnail?: string;
}): SEOData {
  const categoryLabels: Record<string, string> = {
    showcase: '쇼케이스',
    question: '질문',
    tip: '팁',
    review: '리뷰',
    free: '자유',
    troubleshooting: '트러블슈팅',
  };

  const categoryLabel = categoryLabels[post.category] || post.category;
  const description = post.content
    ? post.content.replace(/<[^>]*>/g, '').slice(0, 150) + '...'
    : `${categoryLabel} 카테고리의 게시물입니다.`;

  return {
    title: `${post.title} - ${categoryLabel} | FACTOR 커뮤니티`,
    description,
    keywords: [
      ...COMMON_KEYWORDS,
      '3D 프린팅 커뮤니티',
      categoryLabel,
      post.category,
      '3D 프린터',
    ],
    ogType: 'article',
    ogImage: post.thumbnail || DEFAULT_IMAGE,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      headline: post.title,
      description,
      author: post.author ? {
        '@type': 'Person',
        name: post.author,
      } : undefined,
      datePublished: post.created_at,
      publisher: {
        '@type': 'Organization',
        name: 'FACTOR',
        url: 'https://factor.io.kr',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://factor.io.kr/community`,
      },
    },
  };
}

/**
 * SEO 메타 태그를 동적으로 업데이트하는 훅
 */
export function useSEO(pageKey: keyof typeof SEO_DATA | SEOData) {
  useEffect(() => {
    const data = typeof pageKey === 'string' ? SEO_DATA[pageKey] : pageKey;
    if (!data) return;

    // Title 업데이트
    document.title = data.title;

    // 기존 동적 메타 태그 제거
    document.querySelectorAll('meta[data-dynamic="true"]').forEach(el => el.remove());
    document.querySelectorAll('script[data-dynamic="true"]').forEach(el => el.remove());

    const setMeta = (name: string, content: string, property = false) => {
      const meta = document.createElement('meta');
      meta.setAttribute(property ? 'property' : 'name', name);
      meta.setAttribute('content', content);
      meta.setAttribute('data-dynamic', 'true');
      document.head.appendChild(meta);
    };

    // 기본 메타 태그
    setMeta('description', data.description);
    setMeta('keywords', data.keywords.join(', '));

    // Canonical URL
    const canonical = data.canonical || `${BASE_URL}${window.location.pathname}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonicalLink) {
      canonicalLink.href = canonical;
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      canonicalLink.href = canonical;
      canonicalLink.setAttribute('data-dynamic', 'true');
      document.head.appendChild(canonicalLink);
    }

    // Open Graph 태그
    setMeta('og:title', data.ogTitle || data.title, true);
    setMeta('og:description', data.ogDescription || data.description, true);
    setMeta('og:image', data.ogImage || DEFAULT_IMAGE, true);
    setMeta('og:url', canonical, true);
    setMeta('og:type', data.ogType || 'website', true);
    setMeta('og:site_name', SITE_NAME, true);
    setMeta('og:locale', 'ko_KR', true);

    // Twitter Card 태그
    setMeta('twitter:card', data.twitterCard || 'summary_large_image');
    setMeta('twitter:title', data.ogTitle || data.title);
    setMeta('twitter:description', data.ogDescription || data.description);
    setMeta('twitter:image', data.ogImage || DEFAULT_IMAGE);

    // Robots 태그 (noindex인 경우)
    if (data.noindex) {
      setMeta('robots', 'noindex, nofollow');
    }

    // JSON-LD 구조화 데이터
    if (data.jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-dynamic', 'true');
      script.textContent = JSON.stringify(data.jsonLd);
      document.head.appendChild(script);
    }

    // Cleanup
    return () => {
      document.querySelectorAll('[data-dynamic="true"]').forEach(el => el.remove());
    };
  }, [pageKey]);
}

export default useSEO;
