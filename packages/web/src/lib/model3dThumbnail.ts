/**
 * 3D 모델 썸네일 생성 유틸리티
 * Three.js를 사용하여 3D 모델의 스냅샷 이미지를 생성
 */
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ThumbnailOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

/**
 * 3D 모델 파일에서 썸네일 이미지를 생성합니다
 * @param file 3D 모델 파일 (STL, OBJ, GLTF, GLB)
 * @param options 썸네일 옵션
 * @returns Base64 인코딩된 PNG 이미지 데이터 URL
 */
export async function generateModel3DThumbnail(
  file: File,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  const { width = 200, height = 200, backgroundColor = '#f8fafc' } = options;

  const fileExt = file.name.split('.').pop()?.toLowerCase();

  // 지원되는 포맷 확인
  if (!['stl', 'obj', 'gltf', 'glb'].includes(fileExt || '')) {
    console.warn('[model3dThumbnail] Unsupported format:', fileExt);
    return null;
  }

  return new Promise((resolve) => {
    try {
      // Scene 설정
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);

      // Camera 설정
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

      // Renderer 설정 (오프스크린)
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);

      // 조명 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(1, 1, 1);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight2.position.set(-1, -1, -1);
      scene.add(directionalLight2);

      // 파일 읽기
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result;
          if (!content) {
            resolve(null);
            return;
          }

          let geometry: THREE.BufferGeometry | null = null;
          let mesh: THREE.Mesh | THREE.Group | null = null;

          if (fileExt === 'stl') {
            const loader = new STLLoader();
            geometry = loader.parse(content as ArrayBuffer);
            const material = new THREE.MeshPhongMaterial({
              color: 0x3b82f6,
              specular: 0x111111,
              shininess: 50,
            });
            mesh = new THREE.Mesh(geometry, material);
          } else if (fileExt === 'obj') {
            const loader = new OBJLoader();
            const text = new TextDecoder().decode(content as ArrayBuffer);
            mesh = loader.parse(text);
            // OBJ 파일에 기본 재질 적용
            mesh.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = new THREE.MeshPhongMaterial({
                  color: 0x3b82f6,
                  specular: 0x111111,
                  shininess: 50,
                });
              }
            });
          } else if (fileExt === 'gltf' || fileExt === 'glb') {
            const loader = new GLTFLoader();
            const blob = new Blob([content as ArrayBuffer]);
            const url = URL.createObjectURL(blob);

            try {
              const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) => {
                loader.load(url, res, undefined, rej);
              });
              mesh = gltf.scene;
            } finally {
              URL.revokeObjectURL(url);
            }
          }

          if (!mesh) {
            resolve(null);
            return;
          }

          scene.add(mesh);

          // 모델 중심으로 카메라 위치 조정
          const box = new THREE.Box3().setFromObject(mesh);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

          // 모델을 중심으로 이동
          mesh.position.sub(center);

          // 카메라 위치 설정 (정면 약간 위에서 보는 각도)
          camera.position.set(
            cameraDistance * 0.7,
            cameraDistance * 0.5,
            cameraDistance * 0.7
          );
          camera.lookAt(0, 0, 0);

          // 렌더링
          renderer.render(scene, camera);

          // 캔버스에서 이미지 추출
          const dataUrl = renderer.domElement.toDataURL('image/png');

          // 정리
          renderer.dispose();
          if (geometry) geometry.dispose();
          scene.clear();

          resolve(dataUrl);
        } catch (err) {
          console.error('[model3dThumbnail] Error processing model:', err);
          resolve(null);
        }
      };

      reader.onerror = () => {
        console.error('[model3dThumbnail] Error reading file');
        resolve(null);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('[model3dThumbnail] Error:', err);
      resolve(null);
    }
  });
}

/**
 * Base64 데이터 URL을 Blob으로 변환합니다
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Base64 데이터 URL을 File로 변환합니다
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}
