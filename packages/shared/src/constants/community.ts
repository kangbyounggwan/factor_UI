/**
 * 커뮤니티 관련 공용 상수
 * - 카테고리, 색상, 아이콘
 * - 펌웨어, 필라멘트, 슬라이서 옵션
 * - 정렬 옵션
 */
import type { PostCategory } from '../services/supabaseService/community';

// ============================================================================
// 카테고리 관련
// ============================================================================

/**
 * 카테고리 아이콘 맵
 */
export const CATEGORY_ICONS: Record<PostCategory, string> = {
  showcase: '🎨',
  question: '❓',
  troubleshooting: '🔧',
  tip: '💡',
  review: '⭐',
  free: '💬',
};

/**
 * 카테고리 색상 맵 (Tailwind CSS 클래스)
 */
export const CATEGORY_COLORS: Record<PostCategory, string> = {
  showcase: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  question: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  troubleshooting: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  tip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  review: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  free: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

/**
 * 카테고리 i18n 키 맵
 */
export const CATEGORY_LABEL_KEYS: Record<PostCategory, string> = {
  showcase: 'community.category.showcase',
  question: 'community.category.question',
  troubleshooting: 'community.category.troubleshooting',
  tip: 'community.category.tip',
  review: 'community.category.review',
  free: 'community.category.free',
};

/**
 * 카테고리 설명 맵
 */
export const CATEGORY_DESCRIPTIONS: Record<PostCategory, string> = {
  showcase: '출력물 공유',
  question: '일반 질문',
  troubleshooting: '출력 문제 해결',
  tip: '노하우 공유',
  review: '장비/재료 리뷰',
  free: '자유 주제',
};

/**
 * 카테고리 목록 (글 작성용 - 'all' 제외)
 */
export const POST_CATEGORIES: PostCategory[] = [
  'showcase',
  'question',
  'troubleshooting',
  'tip',
  'review',
  'free',
];

/**
 * 카테고리 목록 (필터용 - 'all' 포함)
 */
export const FILTER_CATEGORIES: (PostCategory | 'all')[] = [
  'all',
  ...POST_CATEGORIES,
];

// ============================================================================
// 정렬 옵션
// ============================================================================

export type SortOption = 'latest' | 'popular' | 'views';

export const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: 'latest', labelKey: 'community.sort.latest' },
  { value: 'popular', labelKey: 'community.sort.popular' },
  { value: 'views', labelKey: 'community.sort.views' },
];

// ============================================================================
// 트러블슈팅 관련 옵션
// ============================================================================

/**
 * 펌웨어 옵션
 */
export const FIRMWARE_OPTIONS = [
  'Klipper',
  'Marlin',
  'RRF (RepRapFirmware)',
  'Prusa Firmware',
  'Other',
] as const;

export type FirmwareOption = typeof FIRMWARE_OPTIONS[number];

/**
 * 필라멘트 타입 옵션
 */
export const FILAMENT_OPTIONS = [
  'PLA',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'Nylon',
  'PC',
  'CF/GF 강화',
  'Other',
] as const;

export type FilamentOption = typeof FILAMENT_OPTIONS[number];

/**
 * 슬라이서 옵션
 */
export const SLICER_OPTIONS = [
  'Cura',
  'PrusaSlicer',
  'OrcaSlicer',
  'Bambu Studio',
  'SuperSlicer',
  'Simplify3D',
  'Other',
] as const;

export type SlicerOption = typeof SLICER_OPTIONS[number];

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 카테고리 정보 가져오기
 */
export function getCategoryInfo(category: PostCategory) {
  return {
    icon: CATEGORY_ICONS[category],
    color: CATEGORY_COLORS[category],
    labelKey: CATEGORY_LABEL_KEYS[category],
    description: CATEGORY_DESCRIPTIONS[category],
  };
}

/**
 * 카테고리 목록을 Select/Dropdown용 옵션으로 변환
 * @param includeAll 'all' 옵션 포함 여부
 */
export function getCategoryOptions(includeAll = false) {
  const categories = includeAll ? FILTER_CATEGORIES : POST_CATEGORIES;

  return categories.map(category => ({
    value: category,
    icon: category === 'all' ? '📋' : CATEGORY_ICONS[category as PostCategory],
    labelKey: category === 'all' ? 'community.category.all' : CATEGORY_LABEL_KEYS[category as PostCategory],
    description: category === 'all' ? undefined : CATEGORY_DESCRIPTIONS[category as PostCategory],
  }));
}
