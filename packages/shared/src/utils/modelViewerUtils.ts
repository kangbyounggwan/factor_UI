import { Box3, Vector3, Camera, Object3D } from 'three';

export type Size3 = { x: number; y: number; z: number };

/**
 * 바운딩 박스 계산 및 검증
 */
export function calculateBoundingBox(object: Object3D): Box3 | null {
  const box = new Box3().setFromObject(object);

  if (!isFinite(box.min.x) || !isFinite(box.max.x) ||
      !isFinite(box.min.y) || !isFinite(box.max.y) ||
      !isFinite(box.min.z) || !isFinite(box.max.z)) {
    console.warn('[modelViewerUtils] Invalid bounding box');
    return null;
  }

  return box;
}

/**
 * 바운딩 박스 중심 계산
 */
export function getBoundingBoxCenter(box: Box3): Vector3 {
  const center = new Vector3();
  box.getCenter(center);
  return center;
}

/**
 * 바운딩 박스 크기 계산
 */
export function getBoundingBoxSize(box: Box3): Size3 {
  const sizeVec = new Vector3();
  box.getSize(sizeVec);
  return {
    x: sizeVec.x,
    y: sizeVec.y,
    z: sizeVec.z
  };
}

/**
 * 카메라 거리 계산
 * @param size 모델 크기
 * @param fov 카메라 FOV (라디안)
 * @param marginMultiplier 여유 공간 배수 (기본 1.5)
 */
export function calculateCameraDistance(
  size: Size3,
  fov: number,
  marginMultiplier: number = 1.5
): number {
  const maxDim = Math.max(size.x, size.y, size.z);
  let distance = Math.abs(maxDim / Math.tan(fov / 2)) * marginMultiplier;

  // 최소 거리 보장
  distance = Math.max(distance, maxDim * 2);

  return distance;
}

/**
 * 등각 뷰 카메라 위치 계산
 * @param distance 카메라 거리
 * @param centerZ 모델 중심 Z 좌표
 * @param angleXY XY 평면 각도 (기본 45도)
 * @param angleZ Z축 각도 (기본 30도)
 */
export function calculateIsometricCameraPosition(
  distance: number,
  centerZ: number,
  angleXY: number = Math.PI / 4,
  angleZ: number = Math.PI / 6
): Vector3 {
  return new Vector3(
    distance * Math.cos(angleXY) * Math.cos(angleZ),
    distance * Math.sin(angleXY) * Math.cos(angleZ),
    centerZ + distance * Math.sin(angleZ)
  );
}

/**
 * 모델에 카메라 피팅
 */
export function fitCameraToModel(
  camera: Camera,
  controls: any,
  object: Object3D,
  options: {
    marginMultiplier?: number;
    angleXY?: number;
    angleZ?: number;
  } = {}
): { size: Size3; center: Vector3; distance: number } | null {
  const box = calculateBoundingBox(object);
  if (!box) return null;

  const center = getBoundingBoxCenter(box);
  const size = getBoundingBoxSize(box);

  if (!('fov' in camera)) {
    console.warn('[modelViewerUtils] Camera does not have FOV property');
    return { size, center, distance: 0 };
  }

  const fov = (camera as any).fov * (Math.PI / 180);
  const distance = calculateCameraDistance(
    size,
    fov,
    options.marginMultiplier
  );

  const modelCenterZ = size.z / 2;
  const targetPosition = new Vector3(0, 0, modelCenterZ);

  if (controls) {
    controls.target.copy(targetPosition);
  }

  const cameraPosition = calculateIsometricCameraPosition(
    distance,
    modelCenterZ,
    options.angleXY,
    options.angleZ
  );

  camera.position.copy(cameraPosition);
  camera.lookAt(targetPosition);
  (camera as any).updateProjectionMatrix?.();

  if (controls) {
    controls.update?.();
  }

  return { size, center, distance };
}

/**
 * 모델을 Z=0 평면에 접지
 */
export function groundModelToZero(object: Object3D): void {
  const box = calculateBoundingBox(object);
  if (!box) return;

  const center = getBoundingBoxCenter(box);

  // X, Y 중심을 원점으로
  object.position.x -= center.x;
  object.position.y -= center.y;

  // Z축: 바닥(min.z)이 Z=0이 되도록
  object.position.z -= box.min.z;
}

/**
 * 로그 출력 헬퍼
 */
export function logCameraAdjustment(
  modelType: 'GLB' | 'STL',
  size: Size3,
  cameraPosition: Vector3,
  targetPosition: Vector3,
  distance: number,
  fov: number,
  hasControls: boolean
): void {
  console.log(`[${modelType}Model] ========== CAMERA ADJUSTMENT ==========`);
  console.log(`[${modelType}Model] Model Size (mm):`, {
    x: size.x.toFixed(2),
    y: size.y.toFixed(2),
    z: size.z.toFixed(2)
  });
  console.log(`[${modelType}Model] Max Dimension:`, Math.max(size.x, size.y, size.z).toFixed(2) + 'mm');
  console.log(`[${modelType}Model] Camera Distance:`, distance.toFixed(2) + 'mm');
  console.log(`[${modelType}Model] Camera Position:`, {
    x: cameraPosition.x.toFixed(2),
    y: cameraPosition.y.toFixed(2),
    z: cameraPosition.z.toFixed(2)
  });
  console.log(`[${modelType}Model] Camera Target:`, {
    x: targetPosition.x.toFixed(2),
    y: targetPosition.y.toFixed(2),
    z: targetPosition.z.toFixed(2)
  });
  console.log(`[${modelType}Model] Camera FOV:`, fov + '°');
  console.log(`[${modelType}Model] Controls available:`, hasControls);
  console.log(`[${modelType}Model] ==========================================`);
}
