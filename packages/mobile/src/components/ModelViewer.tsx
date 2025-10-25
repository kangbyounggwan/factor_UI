// 3D 모델 뷰어 담당 컴포넌트
//
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Suspense, useMemo, useEffect, useState } from "react";
import { STLLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";
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
  // GLB/GLTF 파일 URL (선택적)
  modelUrl?: string;
  // 사용자 회전 컨트롤 활성화 여부
  enableRotationControls?: boolean;
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

function GLBModel({ url, rotation = [0, 0, 0] }: { url: string; rotation?: [number, number, number] }) {
  const gltf = useLoader(GLTFLoader, url);
  const [modelGroup] = useState(() => new THREE.Group());

  useEffect(() => {
    if (gltf && gltf.scene) {
      // 기존 자식 제거
      while (modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0]);
      }

      // GLTF 씬 복제
      const scene = gltf.scene.clone(true);

      // 바운딩 박스 계산
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // 중심 이동
      scene.position.sub(center);

      // 스케일 정규화 (화면에 맞춤)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      scene.scale.multiplyScalar(scale);

      // 그룹에 추가
      modelGroup.add(scene);
    }
  }, [gltf, modelGroup]);

  return (
    <group rotation={rotation}>
      <primitive object={modelGroup} castShadow receiveShadow />
    </group>
  );
}

export default function ModelViewer({ className, height, showDemo = false, placeholderMessage = "모델을 생성하거나 불러오세요", stlUrl, modelUrl, enableRotationControls = false }: ModelViewerProps) {
  const style: React.CSSProperties = { width: '100%' };
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  style.position = 'relative';

  // 사용자 회전 컨트롤
  const [userRotation, setUserRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [showControls, setShowControls] = useState(false);

  const hasContent = showDemo || stlUrl || modelUrl;

  return (
    <div className={className} style={style}>
      <Canvas shadows camera={{ position: [3, 3, 5], fov: 50 }}>
        <color attach="background" args={["#0b0f17"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-5, -5, -5]} intensity={0.6} />
        <directionalLight position={[0, 5, 0]} intensity={0.4} />
        <Suspense fallback={null}>
          {showDemo && <SpinningObject />}
          {stlUrl && <STLModel url={stlUrl} />}
          {modelUrl && <GLBModel url={modelUrl} rotation={userRotation} />}
        </Suspense>
        {/* 그리드: 10mm 작은 셀, 50mm 큰 섹션 (3D 프린팅 모델에 적합) */}
        <Grid
          infiniteGrid
          cellSize={10}
          cellThickness={0.5}
          cellColor="#2a2f3a"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#3b4252"
          fadeDistance={2000}
          fadeStrength={1}
        />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      {/* 회전 컨트롤 */}
      {enableRotationControls && hasContent && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 8,
            padding: showControls ? 12 : 8,
            backdropFilter: 'blur(4px)',
          }}
        >
          <button
            onClick={() => setShowControls(!showControls)}
            style={{
              width: '100%',
              padding: 8,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {showControls ? '▼' : '▲'} Model Rotation
          </button>

          {showControls && (
            <div style={{ marginTop: 8, color: '#fff' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 11 }}>
                X축: {(userRotation[0] * 180 / Math.PI).toFixed(0)}°
                <input
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step={Math.PI / 36}
                  value={userRotation[0]}
                  onChange={(e) => setUserRotation([Number(e.target.value), userRotation[1], userRotation[2]])}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 8, fontSize: 11 }}>
                Y축: {(userRotation[1] * 180 / Math.PI).toFixed(0)}°
                <input
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step={Math.PI / 36}
                  value={userRotation[1]}
                  onChange={(e) => setUserRotation([userRotation[0], Number(e.target.value), userRotation[2]])}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 8, fontSize: 11 }}>
                Z축: {(userRotation[2] * 180 / Math.PI).toFixed(0)}°
                <input
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step={Math.PI / 36}
                  value={userRotation[2]}
                  onChange={(e) => setUserRotation([userRotation[0], userRotation[1], Number(e.target.value)])}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>

              <button
                onClick={() => setUserRotation([0, 0, 0])}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  background: '#374151',
                  border: '1px solid #4b5563',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                초기화
              </button>
            </div>
          )}
        </div>
      )}

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
