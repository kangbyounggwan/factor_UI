/**
 * 3D 모델 뷰어 공통 설정
 * 모바일과 웹에서 동일한 렌더링 환경을 제공합니다.
 */

import { Vector3 } from 'three';

/**
 * 카메라 설정
 */
export const CAMERA_CONFIG = {
  /** 초기 카메라 위치 */
  position: [3, 3, 5] as [number, number, number],
  /** 시야각 (FOV) */
  fov: 50,
  /** 카메라 상향 벡터 (Z-up 좌표계) */
  up: new Vector3(0, 0, 1),
} as const;

/**
 * 조명 설정
 */
export const LIGHTING_CONFIG = {
  /** 환경광 강도 */
  ambientIntensity: 0.8,
  /** 주 방향광 */
  mainDirectional: {
    position: [10, 10, 5] as [number, number, number],
    intensity: 1.5,
    castShadow: true,
  },
  /** 보조 방향광 1 */
  fillDirectional1: {
    position: [-10, -10, -5] as [number, number, number],
    intensity: 0.6,
    castShadow: false,
  },
  /** 보조 방향광 2 */
  fillDirectional2: {
    position: [0, 10, 0] as [number, number, number],
    intensity: 0.4,
    castShadow: false,
  },
} as const;

/**
 * 그리드 설정 (3D 프린팅에 최적화)
 */
export const GRID_CONFIG = {
  /** Z-up 좌표계를 위한 그리드 회전 (XY 평면) */
  rotation: [Math.PI / 2, 0, 0] as [number, number, number],
  /** 무한 그리드 사용 */
  infiniteGrid: true,
  /** 작은 셀 크기 (mm) */
  cellSize: 10,
  /** 작은 셀 두께 */
  cellThickness: 0.5,
  /** 작은 셀 색상 */
  cellColor: '#3a3f47',
  /** 큰 섹션 크기 (mm) */
  sectionSize: 50,
  /** 큰 섹션 두께 */
  sectionThickness: 1,
  /** 큰 섹션 색상 */
  sectionColor: '#596273',
  /** 페이드 거리 */
  fadeDistance: 2000,
  /** 페이드 강도 */
  fadeStrength: 1,
} as const;

/**
 * 배경 색상
 */
export const BACKGROUND_COLOR = '#2e323a';

/**
 * 축 헬퍼 설정
 */
export const AXES_HELPER_CONFIG = {
  /** 축 길이 (mm) */
  size: 50,
  /** 위치 (Z축 살짝 위로 올려서 그리드와 겹치지 않게) */
  position: [0, 0, 0.001] as [number, number, number],
} as const;

/**
 * Gizmo (3축 위젯) 설정
 */
export const GIZMO_CONFIG = {
  /** 화면 정렬 */
  alignment: 'bottom-right' as const,
  /** 여백 */
  margin: [80, 80] as [number, number],
  /** 축 색상 (X: 빨강, Y: 초록, Z: 파랑) */
  axisColors: ['#ff6b6b', '#51cf66', '#4dabf7'] as [string, string, string],
  /** 레이블 색상 */
  labelColor: '#e5e7eb',
} as const;

/**
 * OrbitControls 설정
 */
export const ORBIT_CONTROLS_CONFIG = {
  /** 댐핑 활성화 */
  enableDamping: true,
  /** 댐핑 계수 */
  dampingFactor: 0.05,
} as const;

/**
 * 재질 설정
 */
export const MATERIAL_CONFIG = {
  /** STL 기본 재질 */
  stl: {
    color: '#bfc7d5',
    roughness: 0.85,
    metalness: 0.0,
  },
  /** GLB 기본 재질 (데모용) */
  demo: {
    color: '#6ee7b7',
    metalness: 0.2,
    roughness: 0.2,
  },
} as const;
