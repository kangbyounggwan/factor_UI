// 3D 모델 뷰어 담당 컴포넌트
//
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { Suspense, useMemo, useLayoutEffect, useRef, useState, useEffect } from "react";
import { Box3, Group, Vector3, Object3D, BufferGeometry, BufferAttribute, Mesh, SkinnedMesh, Matrix4, Euler } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@shared/integrations/supabase/client";

interface ModelViewerProps {
  className?: string;
  // 선택적 높이. 전달하지 않으면 부모의 클래스(height)로 제어합니다.
  height?: number | string;
  // 데모 오브젝트 표시 여부. 기본은 false로, 모델이 없을 때는 안내 문구만 표시합니다.
  showDemo?: boolean;
  // 모델이 없을 때 표시할 안내 문구
  placeholderMessage?: string;
  // GLB/GLTF/STL 파일 경로(URL). 지정 시 그리드 위에 모델을 렌더링합니다.
  modelUrl?: string;
  // STL 파일 경로(URL) - modelUrl의 alias
  stlUrl?: string;
  // 모델 스케일 (기본 1)
  modelScale?: number;
  // 사용자 회전 컨트롤 활성화 여부
  enableRotationControls?: boolean;
  // 모델 ID (DB 업데이트용)
  modelId?: string;
  // 저장 콜백 함수
  onSave?: (data: {
    rotation: [number, number, number];
    scale: number;
    optimized: boolean;
    blob: Blob;
    format: 'stl' | 'glb';
  }) => Promise<void>;
}

function SpinningObject() {
  // Simple demo geometry
  const color = useMemo(() => "#6ee7b7", []); // matches semantic accent-ish tint
  return (
    <mesh rotation={[0.4, 0.6, 0]} castShadow receiveShadow>
      <torusKnotGeometry args={[1.1, 0.35, 220, 32]} />
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.2} />
    </mesh>
  );
}

type Size3 = { x: number; y: number; z: number };

// 메쉬 최적화 옵션/도구
type OptimizeOptions = {
  maxTriangles: number | null;
  flatOnly: boolean;
};

const simplifyModifier = new SimplifyModifier();

function toIndexed(geo: BufferGeometry): BufferGeometry {
  if (!geo || !geo.getAttribute) return geo;
  const pos = geo.getAttribute("position");
  if (!pos || pos.count < 3) return geo;

  // 이미 인덱싱되어 있으면 그대로 반환
  if (geo.index) return geo;

  try {
    // mergeVertices로 인덱스 생성
    const merged = (BufferGeometryUtils as { mergeVertices: (geometry: BufferGeometry, tolerance?: number) => BufferGeometry }).mergeVertices(geo, 1e-4);
    return merged && merged.index ? merged : geo;
  } catch (error) {
    console.warn("[ModelViewer] Failed to merge vertices:", error);
    return geo;
  }
}

function triangleCount(geo: BufferGeometry): number {
  const g = toIndexed(geo);
  const pos = g?.getAttribute?.("position");
  if (!pos || pos.count < 3) return 0;
  return (g.index ? g.index.count : pos.count) / 3;
}

function applySimplify(geo: BufferGeometry, maxTris: number): BufferGeometry {
  const indexed = toIndexed(geo);
  const nowTris = triangleCount(indexed);
  if (nowTris <= maxTris) return indexed;
  const currentVerts = indexed.attributes.position.count;
  const ratio = Math.max(0.05, Math.min(1, maxTris / nowTris));
  const targetVerts = Math.max(3, Math.floor(currentVerts * ratio));
  const simplified = simplifyModifier.modify(indexed, targetVerts);
  simplified.computeVertexNormals();
  simplified.computeBoundingSphere();
  simplified.computeBoundingBox();
  return simplified;
}

function optimizeObject3D(root: Object3D, opt: OptimizeOptions): void {
  const { maxTriangles, flatOnly } = opt;
  root.traverse((obj: Object3D) => {
    if (!((obj as Mesh).isMesh || (obj as SkinnedMesh).isSkinnedMesh)) return;
    const meshObj = obj as Mesh | SkinnedMesh;
    let g = meshObj.geometry;
    if (!g) return;

    // maxTriangles 설정이 있으면 메시 단순화
    if (typeof maxTriangles === 'number' && maxTriangles > 0) {
      g = applySimplify(g, maxTriangles);
    }

    meshObj.geometry = g;
  });
}

function GLBModel({ url, scale = 1, version = 0, rotation = [0, 0, 0], onSize, onReady }: { url: string; scale?: number; version?: number; rotation?: [number, number, number]; onSize?: (scaled: Size3, base?: Size3) => void; onReady?: (group: Group, scene: Object3D) => void }) {
  const group = useRef<Group>(null);
  const { camera, controls } = useThree();

  // useGLTF는 항상 호출되어야 함 (React Hooks 규칙)
  // 유효하지 않은 URL은 에러를 발생시킬 수 있으므로, 상위에서 유효성 검증 후 렌더링해야 함
  const gltf = useGLTF(url);
  const scene = gltf?.scene;

  // URL 변경 감지
  useLayoutEffect(() => {
    console.log('[GLBModel] URL changed:', url);
  }, [url]);

  useLayoutEffect(() => {
    console.log('[GLBModel] useLayoutEffect triggered - scene:', !!scene, 'group:', !!group.current);

    // scene이나 group이 유효하지 않으면 조기 종료
    if (!scene || !group.current) {
      console.log('[GLBModel] Early return - scene or group not ready');
      return;
    }

    console.log('[GLBModel] Processing camera adjustment...');
    try {
      // 모델의 바운딩 박스를 계산해 원점(0,0,0)에 중심을 맞춤
      const box = new Box3().setFromObject(group.current);
      console.log('[GLBModel] Bounding box calculated:', {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z }
      });

      if (!isFinite(box.min.x) || !isFinite(box.max.x) ||
          !isFinite(box.min.y) || !isFinite(box.max.y) ||
          !isFinite(box.min.z) || !isFinite(box.max.z)) {
        console.log('[GLBModel] Invalid bounding box - skipping camera adjustment');
        return;
      }

      // 바운딩 박스의 중심 계산
      const center = new Vector3();
      box.getCenter(center);

      // 모델을 원점으로 이동 (바닥은 Z=0에 맞춤)
      group.current.position.x -= center.x;
      group.current.position.y -= center.y;
      group.current.position.z -= box.min.z; // 바닥이 Z=0이 되도록

      // 크기(mm) 계산 및 보고 (현재 scale 적용된 상태로 계산됨)
      const scaledSize = new Vector3();
      box.getSize(scaledSize);
      console.log('[GLBModel] Scaled size calculated:', {
        x: scaledSize.x.toFixed(2),
        y: scaledSize.y.toFixed(2),
        z: scaledSize.z.toFixed(2)
      });

      // 원본(추가 스케일 미적용) 크기 계산
      const baseBox = new Box3().setFromObject(scene);
      const baseSizeVec = new Vector3();
      baseBox.getSize(baseSizeVec);
      onSize?.({ x: scaledSize.x, y: scaledSize.y, z: scaledSize.z }, { x: baseSizeVec.x, y: baseSizeVec.y, z: baseSizeVec.z });

      // 카메라를 모델에 맞춤 - 모델이 로드될 때마다 초기화
      console.log('[GLBModel] Checking camera adjustment conditions - controls:', !!controls, 'camera has fov:', 'fov' in camera);
      if ('fov' in camera) {
        console.log('[GLBModel] Starting camera position calculation...');
        // 실제 모델 크기 사용
        const maxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
        const fov = (camera as any).fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5; // 1.5배 여유

        // 최소 거리 보장
        cameraDistance = Math.max(cameraDistance, maxDim * 2);

        // OrbitControls의 target을 모델 중심(높이의 중간)으로 설정
        const modelCenterZ = scaledSize.z / 2;
        const targetPosition = new Vector3(0, 0, modelCenterZ);
        if (controls) {
          (controls as any).target.copy(targetPosition);
        }

        // 카메라를 등각 뷰 위치에 배치
        const angleXY = Math.PI / 4; // 45도
        const angleZ = Math.PI / 6;   // 30도 위에서

        camera.position.set(
          cameraDistance * Math.cos(angleXY) * Math.cos(angleZ),
          cameraDistance * Math.sin(angleXY) * Math.cos(angleZ),
          modelCenterZ + cameraDistance * Math.sin(angleZ)
        );

        camera.lookAt(targetPosition);
        camera.updateProjectionMatrix();
        if (controls) {
          (controls as any).update();
        }

        console.log('[GLBModel] ========== CAMERA ADJUSTMENT ==========');
        console.log('[GLBModel] Model Size (mm):', {
          x: scaledSize.x.toFixed(2),
          y: scaledSize.y.toFixed(2),
          z: scaledSize.z.toFixed(2)
        });
        console.log('[GLBModel] Max Dimension:', maxDim.toFixed(2) + 'mm');
        console.log('[GLBModel] Camera Distance:', cameraDistance.toFixed(2) + 'mm');
        console.log('[GLBModel] Camera Position:', {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        });
        console.log('[GLBModel] Camera Target:', {
          x: targetPosition.x.toFixed(2),
          y: targetPosition.y.toFixed(2),
          z: targetPosition.z.toFixed(2)
        });
        console.log('[GLBModel] Camera FOV:', (camera as any).fov + '°');
        console.log('[GLBModel] Controls available:', !!controls);
        console.log('[GLBModel] ==========================================');
      }

      onReady?.(group.current, scene);
    } catch (error) {
      console.error('[ModelViewer] Error in GLBModel layout effect:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, scale, version, url]);

  // scene이 없으면 아무것도 렌더링하지 않음
  if (!scene) {
    return null;
  }

  return (
    <group ref={group} scale={scale} castShadow receiveShadow>
      {/* 사용자 회전 적용 */}
      <group rotation={rotation}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

// STL 로더 (Z-up 접지 및 크기 보고)
function STLModel({ url, scale = 1, version = 0, onSize, onReady }: { url: string; scale?: number; version?: number; onSize?: (scaled: Size3, base?: Size3) => void; onReady?: (group: Group) => void }) {
  const group = useRef<Group>(null);
  const { camera, controls } = useThree();

  // useLoader는 항상 호출되어야 함 (React Hooks 규칙)
  // 유효하지 않은 URL은 에러를 발생시킬 수 있으므로, 상위에서 유효성 검증 후 렌더링해야 함
  const geometry = useLoader(STLLoader, url);

  // URL 변경 감지
  useLayoutEffect(() => {
    console.log('[STLModel] URL changed:', url);
  }, [url]);

  useLayoutEffect(() => {
    console.log('[STLModel] useLayoutEffect triggered - geometry:', !!geometry, 'group:', !!group.current);

    // geometry나 group이 유효하지 않으면 조기 종료
    if (!geometry || !group.current) {
      console.log('[STLModel] Early return - geometry or group not ready');
      return;
    }

    console.log('[STLModel] Processing camera adjustment...');
    try {
      // 기본 지오메트리 정보 계산
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const box = new Box3().setFromObject(group.current);
      if (!isFinite(box.min.x) || !isFinite(box.max.x) ||
          !isFinite(box.min.y) || !isFinite(box.max.y) ||
          !isFinite(box.min.z) || !isFinite(box.max.z)) return;

      // 바운딩 박스의 중심 계산
      const center = new Vector3();
      box.getCenter(center);

      // 모델을 원점으로 이동 (바닥은 Z=0에 맞춤)
      group.current.position.x -= center.x;
      group.current.position.y -= center.y;
      group.current.position.z -= box.min.z; // 바닥이 Z=0이 되도록

      const scaledSizeVec = new Vector3();
      box.getSize(scaledSizeVec);

      const baseBox = geometry.boundingBox ?? new Box3().setFromObject(group.current);
      const baseSizeVec = new Vector3();
      baseBox.getSize(baseSizeVec);
      onSize?.({ x: scaledSizeVec.x, y: scaledSizeVec.y, z: scaledSizeVec.z }, { x: baseSizeVec.x, y: baseSizeVec.y, z: baseSizeVec.z });

      // 카메라를 모델에 맞춤 - 모델이 로드될 때마다 초기화
      if ('fov' in camera) {
        // 실제 모델 크기 사용
        const maxDim = Math.max(scaledSizeVec.x, scaledSizeVec.y, scaledSizeVec.z);
        const fov = (camera as any).fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5; // 1.5배 여유

        // 최소 거리 보장
        cameraDistance = Math.max(cameraDistance, maxDim * 2);

        // OrbitControls의 target을 모델 중심(높이의 중간)으로 설정
        const modelCenterZ = scaledSizeVec.z / 2;
        const targetPosition = new Vector3(0, 0, modelCenterZ);
        if (controls) {
          (controls as any).target.copy(targetPosition);
        }

        // 카메라를 등각 뷰 위치에 배치
        const angleXY = Math.PI / 4; // 45도
        const angleZ = Math.PI / 6;   // 30도 위에서

        camera.position.set(
          cameraDistance * Math.cos(angleXY) * Math.cos(angleZ),
          cameraDistance * Math.sin(angleXY) * Math.cos(angleZ),
          modelCenterZ + cameraDistance * Math.sin(angleZ)
        );

        camera.lookAt(targetPosition);
        camera.updateProjectionMatrix();
        if (controls) {
          (controls as any).update();
        }

        console.log('[STLModel] ========== CAMERA ADJUSTMENT ==========');
        console.log('[STLModel] Model Size (mm):', {
          x: scaledSizeVec.x.toFixed(2),
          y: scaledSizeVec.y.toFixed(2),
          z: scaledSizeVec.z.toFixed(2)
        });
        console.log('[STLModel] Max Dimension:', maxDim.toFixed(2) + 'mm');
        console.log('[STLModel] Camera Distance:', cameraDistance.toFixed(2) + 'mm');
        console.log('[STLModel] Camera Position:', {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        });
        console.log('[STLModel] Camera Target:', {
          x: targetPosition.x.toFixed(2),
          y: targetPosition.y.toFixed(2),
          z: targetPosition.z.toFixed(2)
        });
        console.log('[STLModel] Camera FOV:', (camera as any).fov + '°');
        console.log('[STLModel] Controls available:', !!controls);
        console.log('[STLModel] ==========================================');
      }

      onReady?.(group.current);
    } catch (error) {
      console.error('[ModelViewer] Error in STLModel layout effect:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, scale, version, url]);

  // geometry가 없으면 아무것도 렌더링하지 않음
  if (!geometry) {
    return null;
  }

  return (
    <group ref={group} scale={scale} castShadow receiveShadow>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#bfc7d5" roughness={0.85} metalness={0.0} />
      </mesh>
    </group>
  );
}

export default function ModelViewer({ className, height, showDemo = false, placeholderMessage, modelUrl, stlUrl, modelScale = 1, enableRotationControls = false, modelId, onSave }: ModelViewerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const style: React.CSSProperties = { width: '100%' };
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  style.position = 'relative';

  // 모델 크기 상태 저장 (mm)
  const [dimensions, setDimensions] = useState<Size3 | null>(null);
  const [baseSize, setBaseSize] = useState<Size3 | null>(null);
  const [uniformScale, setUniformScale] = useState<number>(1);
  const [modelRoot, setModelRoot] = useState<Group | null>(null);
  const [optVersion, setOptVersion] = useState<number>(0);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [opt, setOpt] = useState<OptimizeOptions>({
    maxTriangles: 100000,
    flatOnly: false,
  });

  // 사용자 회전 컨트롤
  const [userRotation, setUserRotation] = useState<[number, number, number]>([0, 0, 0]);

  // DB 저장된 변환값 로드 (새로고침/초기 렌더 시 적용)
  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('ai_generated_models')
          .select('generation_metadata')
          .eq('id', modelId)
          .single();
        if (cancelled || error || !data) return;

        // generation_metadata에서 저장된 변환 정보 읽기
        const saved: any = (data as any)?.generation_metadata;
        if (saved) {
          // 스케일과 회전 모두 복원하지 않음 - 이미 GLB에 베이킹되어 있음
          // if (Array.isArray(saved.rotation) && saved.rotation.length === 3) {
          //   const [rx, ry, rz] = saved.rotation.map((v: number) => (typeof v === 'number' && isFinite(v) ? v : 0)) as [number, number, number];
          //   setUserRotation([rx, ry, rz]);
          // }
          // if (typeof saved.scale === 'number' && isFinite(saved.scale)) {
          //   setUniformScale(saved.scale);
          // }

          // saved_at이 있으면 스케일과 회전이 베이킹된 모델임을 표시
          if (saved.saved_at) {
            console.log('[ModelViewer] Loaded baked model (scale and rotation already applied), saved at:', saved.saved_at);
          }
        }
      } catch (e) {
        console.error('[ModelViewer] Failed to load saved transform:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [modelId]);

  // GLB/GLTF(modelUrl) 우선, 없으면 STL(stlUrl) 사용
  const urlToUse = modelUrl || stlUrl;

  // URL 유효성 검증 강화
  const effectiveUrl = (urlToUse && urlToUse.trim().length > 0 && (urlToUse.startsWith('http://') || urlToUse.startsWith('https://') || urlToUse.startsWith('/')))
    ? urlToUse
    : undefined;

  // 새 모델 URL 로드 시, 뷰어 변환 상태(회전/스케일) 초기화하여 중복 적용 방지
  useEffect(() => {
    if (!effectiveUrl) return;
    setUserRotation([0, 0, 0]);
    setUniformScale(1);
  }, [effectiveUrl]);

  return (
    <div className={className} style={style}>
      <Canvas
        shadows
        camera={{ position: [3, 3, 5], fov: 50 }}
        onCreated={({ camera }) => { camera.up.set(0, 0, 1); }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={["#2e323a"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          {effectiveUrl ? (
            (() => {
              const lower = effectiveUrl.toLowerCase();
              const commonProps = {
                scale: (modelScale ?? 1) * (uniformScale ?? 1),
                version: optVersion,
                onSize: (scaled: Size3, base?: Size3) => {
                  setDimensions(scaled);
                  if (base) setBaseSize(base);
                },
              } as const;
              if (lower.endsWith('.stl')) {
                return (
                  <STLModel
                    url={effectiveUrl}
                    {...commonProps}
                    onReady={(g: Group) => setModelRoot(g)}
                  />
                );
              }
              return (
                <GLBModel
                  url={effectiveUrl}
                  {...commonProps}
                  rotation={userRotation}
                  onReady={(g: Group) => setModelRoot(g)}
                />
              );
            })()
          ) : (
            showDemo && <SpinningObject />
          )}
          {/* 기본 조명 설정 - 외부 HDR 의존성 제거 */}
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
          <directionalLight position={[-10, -10, -5]} intensity={0.6} />
          <directionalLight position={[0, 10, 0]} intensity={0.4} />
        </Suspense>
        {/* Z-up: 그리드를 XY 평면으로 회전 (법선 +Z) */}
        {/* 그리드: 10mm 작은 셀, 50mm 큰 섹션 (3D 프린팅 모델에 적합) */}
        <Grid
          rotation={[Math.PI / 2, 0, 0]}
          infiniteGrid
          cellSize={10}
          cellThickness={0.5}
          cellColor="#3a3f47"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#596273"
          fadeDistance={2000}
          fadeStrength={1}
        />
        {/* 원점 3축 화살표 (X:red, Y:green, Z:blue) - Z가 수직으로 보이도록 */}
        <axesHelper args={[50]} position={[0, 0, 0.001]} />
        {/* 화면 하단-우측 3축 위젯 */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={["#ff6b6b", "#51cf66", "#4dabf7"]} labelColor="#e5e7eb" />
        </GizmoHelper>
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      {/* 3개 메인 섹션 아코디언 */}
      {effectiveUrl && (
        <div
          style={{
            position: 'absolute', left: 12, top: 15,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            padding: '8px 10px', borderRadius: 8, width: 260,
            backdropFilter: 'blur(2px)'
          }}
        >
          <Accordion type="single" collapsible className="w-full">
            {/* 모델 회전 섹션 */}
            {enableRotationControls && (
              <AccordionItem value="rotation" className="border-b border-white/10">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  {t('modelViewer.modelRotation')}
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                    {t('modelViewer.xAxisRotation')}: {(userRotation[0] * 180 / Math.PI).toFixed(0)}°
                    <input
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step={Math.PI / 36}
                      value={userRotation[0]}
                      onChange={(e) => setUserRotation([Number(e.target.value), userRotation[1], userRotation[2]])}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                    {t('modelViewer.yAxisRotation')}: {(userRotation[1] * 180 / Math.PI).toFixed(0)}°
                    <input
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step={Math.PI / 36}
                      value={userRotation[1]}
                      onChange={(e) => setUserRotation([userRotation[0], Number(e.target.value), userRotation[2]])}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                    {t('modelViewer.zAxisRotation')}: {(userRotation[2] * 180 / Math.PI).toFixed(0)}°
                    <input
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step={Math.PI / 36}
                      value={userRotation[2]}
                      onChange={(e) => setUserRotation([userRotation[0], userRotation[1], Number(e.target.value)])}
                      style={{ width: '100%' }}
                    />
                  </label>

                  <button
                    onClick={() => setUserRotation([0, 0, 0])}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: '#2b2f36',
                      border: '1px solid #3a3f47',
                      color: '#fff',
                      cursor: 'pointer',
                      marginTop: 4
                    }}
                  >
                    {t('modelViewer.reset')}
                  </button>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Uniform Scale 섹션 */}
            {dimensions && baseSize && (
              <AccordionItem value="scale" className="border-b border-white/10">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  {t('modelViewer.uniformScale')}
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{t('modelViewer.scale')}</span>
                    <strong style={{ fontSize: 13 }}>{uniformScale.toFixed(2)}x</strong>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={10}
                    step={0.01}
                    value={uniformScale}
                    onChange={(e) => setUniformScale(Number(e.target.value))}
                    disabled={isOptimizing}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {(['x','y','z'] as const).map(axis => (
                      <div
                        key={axis}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          cursor: isOptimizing ? 'not-allowed' : 'pointer',
                          userSelect: 'none',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 6,
                          padding: '6px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          width: 80,
                          minWidth: 80
                        }}
                        title={`더블클릭하여 ${axis.toUpperCase()} 목표(mm) 입력`}
                        onDoubleClick={() => {
                          if (isOptimizing) return;
                          const current = dimensions[axis];
                          const input = prompt(`${axis.toUpperCase()} 목표 크기(mm)를 입력하세요`, current.toFixed(2));
                          if (!input) return;
                          const target = Number(input);
                          if (!isFinite(target) || target <= 0) return;
                          const base = baseSize[axis];
                          if (!isFinite(base) || base <= 0) return;
                          const newScale = target / base / (modelScale || 1);
                          const clamped = Math.min(10, Math.max(0.05, newScale));
                          setUniformScale(Number(clamped.toFixed(4)));
                        }}
                      >
                        <div style={{ fontSize: 13, opacity: 0.95 }}>{axis.toUpperCase()}</div>
                        <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: 'nowrap' }}>{dimensions[axis].toFixed(2)}mm</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Mesh Optimize 섹션 */}
            {modelRoot && (
              <AccordionItem value="mesh" className="border-b border-white/10">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  {t('modelViewer.meshOptimize')}
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                    maxTriangles: {opt.maxTriangles ? opt.maxTriangles.toLocaleString() : 'off'}
                    <input type="range" min={20000} max={300000} step={1000}
                      value={opt.maxTriangles ?? 100000}
                      onChange={(e)=>setOpt(o=>({...o, maxTriangles: Number(e.target.value)}))}
                      disabled={isOptimizing}
                      style={{ width: '100%' }} />
                    <button
                      onClick={()=>setOpt(o=>({...o, maxTriangles: null}))}
                      disabled={isOptimizing}
                      style={{ marginTop: 4, fontSize: 12, padding: '2px 6px', borderRadius: 4, background: '#2b2f36', border: '1px solid #3a3f47', color: '#fff' }}
                    >
                      Off
                    </button>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={opt.flatOnly}
                      onChange={(e)=>setOpt(o=>({...o, flatOnly: e.target.checked}))}
                      disabled={isOptimizing}
                    />
                    flatOnly (평면 위주)
                  </label>
                  <button
                    onClick={async ()=>{
                      if (!modelRoot) return;
                      try {
                        setIsOptimizing(true);
                        optimizeObject3D(modelRoot, opt);
                        setOptVersion(v=>v+1);
                      } finally {
                        setIsOptimizing(false);
                      }
                    }}
                    disabled={isOptimizing}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: isOptimizing ? '#444' : '#2b2f36', border: '1px solid #3a3f47', color: '#fff', fontSize: 13 }}
                  >{isOptimizing ? t('modelViewer.optimizing') : t('modelViewer.apply')}</button>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 모델 저장 섹션 */}
            <AccordionItem value="export" className="border-b border-white/10">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                {t('modelViewer.saveModel') || 'Save Model'}
              </AccordionTrigger>
              <AccordionContent className="pb-3 space-y-2">
                <button
                  onClick={async () => {
                    console.log('[ModelViewer] Save button clicked');
                    console.log('[ModelViewer] onSave callback exists?', typeof onSave === 'function');

                    if (!modelRoot) {
                      toast({
                        title: t('modelViewer.saveFailed') || '저장 불가',
                        description: t('modelViewer.modelNotLoaded') || '모델이 로드되지 않았습니다.',
                        variant: 'destructive'
                      });
                      return;
                    }
                    try {
                      // 스케일과 회전을 모두 GLB에 베이킹
                      const exportGroup = new Group();
                      const clonedModel = modelRoot.clone(true);

                      // 스케일과 회전 적용
                      clonedModel.scale.set(uniformScale, uniformScale, uniformScale);
                      clonedModel.rotation.set(userRotation[0], userRotation[1], userRotation[2]);
                      clonedModel.updateMatrixWorld(true);

                      // 모든 메시에 스케일과 회전 베이킹
                      clonedModel.traverse((child) => {
                        if ((child as Mesh).isMesh) {
                          const mesh = child as Mesh;
                          if (mesh.geometry) {
                            // Geometry를 복제
                            const geometry = mesh.geometry.clone();

                            // 회전 행렬 생성
                            const rotationMatrix = new Matrix4();
                            rotationMatrix.makeRotationFromEuler(new Euler(userRotation[0], userRotation[1], userRotation[2]));

                            // 스케일 행렬 생성
                            const scaleMatrix = new Matrix4();
                            scaleMatrix.makeScale(uniformScale, uniformScale, uniformScale);

                            // 변환 적용: 기존 mesh matrix → rotation → scale
                            geometry.applyMatrix4(mesh.matrix);
                            geometry.applyMatrix4(rotationMatrix);
                            geometry.applyMatrix4(scaleMatrix);

                            mesh.geometry = geometry;

                            // 변환을 리셋
                            mesh.position.set(0, 0, 0);
                            mesh.rotation.set(0, 0, 0);
                            mesh.scale.set(1, 1, 1);
                            mesh.updateMatrix();
                          }
                        }
                      });

                      // clonedModel 변환도 리셋
                      clonedModel.position.set(0, 0, 0);
                      clonedModel.rotation.set(0, 0, 0);
                      clonedModel.scale.set(1, 1, 1);
                      clonedModel.updateMatrix();

                      exportGroup.add(clonedModel);

                      // GLB로 내보내기 (DB 저장용)
                      const exporter = new GLTFExporter();
                      exporter.parse(
                        exportGroup,
                        async (gltf) => {
                          const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });

                          // onSave 콜백이 있으면 DB 업데이트만 수행
                          if (onSave) {
                            try {
                              await onSave({
                                rotation: userRotation,
                                scale: uniformScale,
                                optimized: optVersion > 0,
                                blob,
                                format: 'glb'
                              });
                              console.log('[ModelViewer] Model saved to DB successfully');
                              // 저장된 GLB에는 변환이 이미 베이킹되었으므로,
                              // 뷰어 상태를 초기화하여 재적용(중복)되지 않도록 함
                              setUserRotation([0, 0, 0]);
                              setUniformScale(1);
                            } catch (error) {
                              toast({
                                title: t('modelViewer.saveFailed') || '저장 실패',
                                description: error instanceof Error ? error.message : '모델 저장에 실패했습니다.',
                                variant: 'destructive'
                              });
                              console.error('[ModelViewer] Save to DB failed:', error);
                            }
                          } else {
                            console.warn('[ModelViewer] No onSave callback provided');
                          }
                        },
                        (error) => {
                          toast({
                            title: t('modelViewer.saveFailed') || '저장 실패',
                            description: t('modelViewer.exportFailed') || 'GLB 내보내기에 실패했습니다.',
                            variant: 'destructive'
                          });
                          console.error('[ModelViewer] GLB export failed:', error);
                        },
                        { binary: true }
                      );
                    } catch (error) {
                      toast({
                        title: t('modelViewer.saveFailed') || '저장 실패',
                        description: error instanceof Error ? error.message : '예상치 못한 오류가 발생했습니다.',
                        variant: 'destructive'
                      });
                      console.error('[ModelViewer] Save failed:', error);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: modelRoot ? '#3b82f6' : '#2b2f36',
                    border: '1px solid #3a3f47',
                    color: '#fff',
                    cursor: modelRoot ? 'pointer' : 'not-allowed',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: modelRoot ? 1 : 0.5
                  }}
                >
                  {t('modelViewer.saveButton') || 'Save'}
                </button>

                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                  {t('modelViewer.saveInfo') || 'Saves the model with current rotation, scale, and mesh optimizations applied.'}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}


      {isOptimizing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>{t('modelViewer.meshOptimizing')}</div>
        </div>
      )}
      {!effectiveUrl && !showDemo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: '14px',
              letterSpacing: '0.02em',
            }}
          >
            {placeholderMessage || t('modelViewer.placeholder')}
          </div>
        </div>
      )}
    </div>
  );
}
