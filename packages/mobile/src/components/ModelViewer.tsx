// 3D 모델 뷰어 담당 컴포넌트
//
import React, { Suspense, useMemo, useEffect, useState, useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import { GLTFLoader, GLTFExporter } from "three-stdlib";
import * as THREE from "three";
import { calculateBoundingBox, getBoundingBoxCenter, getBoundingBoxSize, groundModelToZero, fitCameraToModel, logCameraAdjustment } from "@shared/utils/modelViewerUtils";
import {
  CAMERA_CONFIG,
  LIGHTING_CONFIG,
  GRID_CONFIG,
  BACKGROUND_COLOR,
  AXES_HELPER_CONFIG,
  GIZMO_CONFIG,
  ORBIT_CONTROLS_CONFIG,
  MATERIAL_CONFIG,
} from "@shared/config/modelViewerConfig";

interface ModelViewerProps {
  className?: string;
  // 선택적 높이. 전달하지 않으면 부모의 클래스(height)로 제어합니다.
  height?: number | string;
  // 데모 오브젝트 표시 여부. 기본은 false로, 모델이 없을 때는 안내 문구만 표시합니다.
  showDemo?: boolean;
  // 모델이 없을 때 표시할 안내 문구
  placeholderMessage?: string;
  // STL 파일 URL (선택적)
  stlUrl?: string;
  // GLB/GLTF 파일 URL (선택적)
  modelUrl?: string;
  // 모델 스케일 (기본 1)
  modelScale?: number;
  // 모델 회전 (라디안)
  rotation?: [number, number, number];
  // 모델 ID (DB 업데이트용)
  modelId?: string;
  // 모델 크기 변경 콜백
  onSize?: (size: { x: number; y: number; z: number }) => void;
  // 저장 콜백 함수 (DEPRECATED - 사용하지 않음)
  onSave?: (data: {
    rotation: [number, number, number];
    scale: number;
    optimized: boolean;
    blob: Blob;
    format: 'stl' | 'glb';
  }) => Promise<void>;
}

// Export 핸들 타입 정의
export interface ModelViewerHandle {
  exportGLB: () => Promise<Blob>;
}

function SpinningObject() {
  // Simple demo geometry
  const color = useMemo(() => MATERIAL_CONFIG.demo.color, []);
  return (
    <mesh rotation={[0.4, 0.6, 0]} castShadow receiveShadow>
      <torusKnotGeometry args={[1.1, 0.35, 220, 32]} />
      <meshStandardMaterial
        color={color}
        metalness={MATERIAL_CONFIG.demo.metalness}
        roughness={MATERIAL_CONFIG.demo.roughness}
      />
    </mesh>
  );
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  const groupRef = React.useRef<THREE.Group>(null);
  const { camera, controls } = useThree();

  useLayoutEffect(() => {
    if (!geometry || !groupRef.current) return;

    // 지오메트리 정보 계산
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // 모델을 Z=0 평면에 접지
    groundModelToZero(groupRef.current);

    // 카메라를 모델에 맞춤
    const result = fitCameraToModel(camera, controls, groupRef.current);
    if (result) {
      const targetPosition = new THREE.Vector3(0, 0, result.size.z / 2);
      logCameraAdjustment(
        'STL',
        result.size,
        camera.position,
        targetPosition,
        result.distance,
        camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
        !!controls
      );
    }
  }, [geometry, camera, controls]);

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={MATERIAL_CONFIG.stl.color}
          metalness={MATERIAL_CONFIG.stl.metalness}
          roughness={MATERIAL_CONFIG.stl.roughness}
        />
      </mesh>
    </group>
  );
}

function GLBModel({
  url,
  rotation = [0, 0, 0],
  scale = 1,
  onSize,
  sceneRef
}: {
  url: string;
  rotation?: [number, number, number];
  scale?: number;
  onSize?: (size: { x: number; y: number; z: number }) => void;
  sceneRef?: React.MutableRefObject<THREE.Group | null>;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const sceneGroupRef = React.useRef<THREE.Group>(null);
  const outerGroupRef = React.useRef<THREE.Group>(null); // 회전/스케일이 적용된 외부 그룹
  const { camera, controls } = useThree();

  // outerGroupRef를 부모에게 전달 (회전/스케일 포함)
  useEffect(() => {
    if (sceneRef && outerGroupRef.current) {
      sceneRef.current = outerGroupRef.current;
    }
  }, [sceneRef]);

  useEffect(() => {
    if (!gltf?.scene || !sceneGroupRef.current) return;

    // scene이 렌더링된 후 다음 프레임에서 계산
    const timeoutId = setTimeout(() => {
      if (!sceneGroupRef.current) return;

      // 모델을 Z=0 평면에 접지
      groundModelToZero(sceneGroupRef.current);

      // 카메라를 모델에 맞춤
      const result = fitCameraToModel(camera, controls, sceneGroupRef.current);
      if (result) {
        const targetPosition = new THREE.Vector3(0, 0, result.size.z / 2);
        logCameraAdjustment(
          'GLB',
          result.size,
          camera.position,
          targetPosition,
          result.distance,
          camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
          !!controls
        );

        // 모델 크기 콜백
        if (onSize) {
          onSize({
            x: result.size.x,
            y: result.size.y,
            z: result.size.z,
          });
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, camera, controls, url]);

  if (!gltf?.scene) return null;

  return (
    <group ref={outerGroupRef} scale={scale} rotation={rotation} castShadow receiveShadow>
      <group ref={sceneGroupRef}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

const ModelViewer = forwardRef<ModelViewerHandle, ModelViewerProps>(
  ({ className, height, showDemo = false, placeholderMessage = "모델을 생성하거나 불러오세요", stlUrl, modelUrl, modelScale = 1, rotation = [0, 0, 0], modelId, onSize, onSave }, ref) => {
    const style: React.CSSProperties = { width: '100%' };
    if (height !== undefined) {
      style.height = typeof height === 'number' ? `${height}px` : height;
    }
    style.position = 'relative';

    const hasContent = showDemo || stlUrl || modelUrl;
    const sceneRef = useRef<THREE.Group | null>(null);

    // 부모 컴포넌트에 exportGLB 메서드 노출
    useImperativeHandle(ref, () => ({
      exportGLB: async (): Promise<Blob> => {
        if (!sceneRef.current) {
          throw new Error('No model loaded');
        }

        // 내보내기 전에 모델을 바닥에 맞춤 (Z=0)
        console.log('[ModelViewer] Grounding model to Z=0 before export');
        groundModelToZero(sceneRef.current);

        return new Promise((resolve, reject) => {
          const exporter = new GLTFExporter();
          exporter.parse(
            sceneRef.current!,
            (result) => {
              if (result instanceof ArrayBuffer) {
                resolve(new Blob([result], { type: 'model/gltf-binary' }));
              } else {
                // result is a JSON object
                const jsonString = JSON.stringify(result);
                resolve(new Blob([jsonString], { type: 'application/json' }));
              }
            },
            (error) => {
              reject(error);
            },
            { binary: true } // Export as .glb (binary format)
          );
        });
      },
    }));

    return (
      <div className={className} style={style}>
        <Canvas
          shadows
          frameloop="demand"
          camera={{
            position: CAMERA_CONFIG.position,
            fov: CAMERA_CONFIG.fov,
          }}
          onCreated={({ camera }) => {
            camera.up.copy(CAMERA_CONFIG.up);
          }}
        >
          <color attach="background" args={[BACKGROUND_COLOR]} />
          <ambientLight intensity={LIGHTING_CONFIG.ambientIntensity} />
          <directionalLight
            position={LIGHTING_CONFIG.mainDirectional.position}
            intensity={LIGHTING_CONFIG.mainDirectional.intensity}
            castShadow={LIGHTING_CONFIG.mainDirectional.castShadow}
          />
          <directionalLight
            position={LIGHTING_CONFIG.fillDirectional1.position}
            intensity={LIGHTING_CONFIG.fillDirectional1.intensity}
            castShadow={LIGHTING_CONFIG.fillDirectional1.castShadow}
          />
          <directionalLight
            position={LIGHTING_CONFIG.fillDirectional2.position}
            intensity={LIGHTING_CONFIG.fillDirectional2.intensity}
            castShadow={LIGHTING_CONFIG.fillDirectional2.castShadow}
          />
          <Suspense fallback={null}>
            {showDemo && <SpinningObject />}
            {stlUrl && <STLModel url={stlUrl} />}
            {modelUrl && <GLBModel url={modelUrl} rotation={rotation} scale={modelScale} onSize={onSize} sceneRef={sceneRef} />}
          </Suspense>
        {/* Z-up: 그리드를 XY 평면으로 회전 */}
        <Grid
          rotation={GRID_CONFIG.rotation}
          infiniteGrid={GRID_CONFIG.infiniteGrid}
          cellSize={GRID_CONFIG.cellSize}
          cellThickness={GRID_CONFIG.cellThickness}
          cellColor={GRID_CONFIG.cellColor}
          sectionSize={GRID_CONFIG.sectionSize}
          sectionThickness={GRID_CONFIG.sectionThickness}
          sectionColor={GRID_CONFIG.sectionColor}
          fadeDistance={GRID_CONFIG.fadeDistance}
          fadeStrength={GRID_CONFIG.fadeStrength}
        />
        {/* 원점 3축 화살표 (X:red, Y:green, Z:blue) */}
        <axesHelper args={[AXES_HELPER_CONFIG.size]} position={AXES_HELPER_CONFIG.position} />
        {/* 화면 하단-우측 3축 위젯 */}
        <GizmoHelper alignment={GIZMO_CONFIG.alignment} margin={GIZMO_CONFIG.margin}>
          <GizmoViewport
            axisColors={GIZMO_CONFIG.axisColors}
            labelColor={GIZMO_CONFIG.labelColor}
          />
        </GizmoHelper>
        <OrbitControls
          enableDamping={ORBIT_CONTROLS_CONFIG.enableDamping}
          dampingFactor={ORBIT_CONTROLS_CONFIG.dampingFactor}
        />
      </Canvas>

      {!hasContent && (
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
            {placeholderMessage}
          </div>
        </div>
      )}
    </div>
  );
});

ModelViewer.displayName = 'ModelViewer';

export default ModelViewer;
