// 3D 모델 뷰어 담당 컴포넌트
//
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { Suspense, useMemo, useEffect, useState } from "react";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";

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

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);

  useEffect(() => {
    if (geometry) {
      // 지오메트리 중심 및 정규화
      geometry.computeBoundingBox();
      const boundingBox = geometry.boundingBox!;
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // 스케일 계산 (모델을 화면에 맞춤)
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      geometry.scale(scale, scale, scale);

      // 노멀 계산
      geometry.computeVertexNormals();
    }
  }, [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#6ee7b7" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

export default function ModelViewer({ className, height, showDemo = false, placeholderMessage = "모델을 생성하거나 불러오세요", stlUrl }: ModelViewerProps) {
  const style: React.CSSProperties = { width: '100%' };
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  style.position = 'relative';

  const hasContent = showDemo || stlUrl;

  return (
    <div className={className} style={style}>
      <Canvas shadows camera={{ position: [3, 3, 5], fov: 50 }}>
        <color attach="background" args={["#0b0f17"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          {showDemo && <SpinningObject />}
          {stlUrl && <STLModel url={stlUrl} />}
          <Environment preset="city" />
        </Suspense>
        <Grid infiniteGrid cellColor="#2a2f3a" sectionColor="#3b4252" args={[20, 20]} />
        <OrbitControls enableDamping dampingFactor={0.05} />
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
}
