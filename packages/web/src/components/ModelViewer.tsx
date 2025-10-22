// 3D 모델 뷰어 담당 컴포넌트
//
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { Suspense, useMemo, useLayoutEffect, useRef, useState } from "react";
import { Box3, Group, Vector3, Object3D, BufferGeometry, BufferAttribute, Mesh, SkinnedMesh } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

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

  // useGLTF는 항상 호출되어야 함 (React Hooks 규칙)
  // 유효하지 않은 URL은 에러를 발생시킬 수 있으므로, 상위에서 유효성 검증 후 렌더링해야 함
  const gltf = useGLTF(url);
  const scene = gltf?.scene;

  useLayoutEffect(() => {
    // scene이나 group이 유효하지 않으면 조기 종료
    if (!scene || !group.current) {
      return;
    }

    try {
      // 모델의 바운딩 박스를 계산해 바닥(z=0)에 접지되도록 오프셋 적용 (Z-up)
      const box = new Box3().setFromObject(group.current);
      if (!isFinite(box.min.z) || !isFinite(box.max.z)) return;
      const zOffset = box.min.z; // 바닥이 z=0이 되도록
      // 수평(XY) 중앙 정렬은 유지(요청사항은 바닥 접지만)
      group.current.position.z -= zOffset;

      // 크기(mm) 계산 및 보고 (현재 scale 적용된 상태로 계산됨)
      const scaledSize = new Vector3();
      box.getSize(scaledSize);

      // 원본(추가 스케일 미적용) 크기 계산
      const baseBox = new Box3().setFromObject(scene);
      const baseSizeVec = new Vector3();
      baseBox.getSize(baseSizeVec);
      onSize?.({ x: scaledSize.x, y: scaledSize.y, z: scaledSize.z }, { x: baseSizeVec.x, y: baseSizeVec.y, z: baseSizeVec.z });
      onReady?.(group.current, scene);
    } catch (error) {
      console.error('[ModelViewer] Error in GLBModel layout effect:', error);
    }
  }, [scene, scale, version, url, onSize, onReady]);

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

  // useLoader는 항상 호출되어야 함 (React Hooks 규칙)
  // 유효하지 않은 URL은 에러를 발생시킬 수 있으므로, 상위에서 유효성 검증 후 렌더링해야 함
  const geometry = useLoader(STLLoader, url);

  useLayoutEffect(() => {
    // geometry나 group이 유효하지 않으면 조기 종료
    if (!geometry || !group.current) {
      return;
    }

    try {
      // 기본 지오메트리 정보 계산
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const box = new Box3().setFromObject(group.current);
      if (!isFinite(box.min.z) || !isFinite(box.max.z)) return;
      const zOffset = box.min.z;
      group.current.position.z -= zOffset;

      const scaledSizeVec = new Vector3();
      box.getSize(scaledSizeVec);

      const baseBox = geometry.boundingBox ?? new Box3().setFromObject(group.current);
      const baseSizeVec = new Vector3();
      baseBox.getSize(baseSizeVec);
      onSize?.({ x: scaledSizeVec.x, y: scaledSizeVec.y, z: scaledSizeVec.z }, { x: baseSizeVec.x, y: baseSizeVec.y, z: baseSizeVec.z });
      onReady?.(group.current);
    } catch (error) {
      console.error('[ModelViewer] Error in STLModel layout effect:', error);
    }
  }, [geometry, scale, version, url, onSize, onReady]);

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

  // stlUrl이 제공되면 modelUrl보다 우선 사용
  const urlToUse = stlUrl || modelUrl;

  // URL 유효성 검증 강화
  const effectiveUrl = (urlToUse && urlToUse.trim().length > 0 && (urlToUse.startsWith('http://') || urlToUse.startsWith('https://') || urlToUse.startsWith('/')))
    ? urlToUse
    : undefined;

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
        <Grid rotation={[Math.PI / 2, 0, 0]} infiniteGrid cellColor="#3a3f47" sectionColor="#596273" args={[20, 20]} />
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
                    if (!modelRoot) return;
                    try {
                      // 회전과 스케일이 적용된 복사본 생성
                      const exportGroup = new Group();
                      const clonedModel = modelRoot.clone(true);

                      // 사용자 회전 적용
                      clonedModel.rotation.set(userRotation[0], userRotation[1], userRotation[2]);

                      // 스케일 적용
                      clonedModel.scale.set(uniformScale, uniformScale, uniformScale);

                      // Matrix를 업데이트하여 변환을 적용
                      clonedModel.updateMatrixWorld(true);

                      // 모든 메시에 변환을 베이킹
                      clonedModel.traverse((child) => {
                        if ((child as Mesh).isMesh) {
                          const mesh = child as Mesh;
                          if (mesh.geometry) {
                            // Geometry를 복제하고 변환 적용
                            const geometry = mesh.geometry.clone();
                            geometry.applyMatrix4(mesh.matrixWorld);
                            mesh.geometry = geometry;

                            // 변환을 리셋
                            mesh.position.set(0, 0, 0);
                            mesh.rotation.set(0, 0, 0);
                            mesh.scale.set(1, 1, 1);
                            mesh.updateMatrix();
                          }
                        }
                      });

                      // exportGroup 변환도 리셋
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
                            } catch (error) {
                              console.error('[ModelViewer] Save to DB failed:', error);
                            }
                          } else {
                            console.warn('[ModelViewer] No onSave callback provided');
                          }
                        },
                        (error) => {
                          console.error('[ModelViewer] GLB export failed:', error);
                        },
                        { binary: true }
                      );
                    } catch (error) {
                      console.error('[ModelViewer] Save failed:', error);
                    }
                  }}
                  disabled={!modelRoot}
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
