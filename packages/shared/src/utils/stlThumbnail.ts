import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';

/**
 * STL 파일을 렌더링하여 썸네일 이미지를 생성합니다.
 * @param file - STL 파일 (File 객체)
 * @param width - 썸네일 너비 (기본: 400)
 * @param height - 썸네일 높이 (기본: 400)
 * @returns 썸네일 이미지 Blob
 */
export async function generateSTLThumbnail(
  file: File,
  width: number = 400,
  height: number = 400
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;

        // STL 로더 생성
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);

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

        // 씬 설정
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0f17); // 다크 배경

        // 메시 생성
        const material = new THREE.MeshStandardMaterial({
          color: 0x6ee7b7,
          metalness: 0.3,
          roughness: 0.4,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight1.position.set(5, 5, 5);
        scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, -5, -5);
        scene.add(directionalLight2);

        // 카메라 설정
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);

        // 렌더러 설정 (오프스크린)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
        });
        renderer.setSize(width, height);
        renderer.render(scene, camera);

        // Canvas를 Blob으로 변환
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail blob'));
          }

          // 메모리 정리
          geometry.dispose();
          material.dispose();
          renderer.dispose();
        }, 'image/png');

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read STL file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * STL 파일의 기본 정보를 추출합니다.
 * @param file - STL 파일
 * @returns 파일 정보 (삼각형 개수, 바운딩 박스 크기 등)
 */
export async function getSTLInfo(file: File): Promise<{
  triangleCount: number;
  boundingBox: { x: number; y: number; z: number };
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);

        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        resolve({
          triangleCount: geometry.attributes.position.count / 3,
          boundingBox: {
            x: size.x,
            y: size.y,
            z: size.z,
          },
        });

        geometry.dispose();
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read STL file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
