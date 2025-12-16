/**
 * G-code 3D Path Renderer (백엔드 API 사용)
 * Float32Array 형식의 세그먼트 데이터를 받아 렌더링
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { LayerSegmentData } from '@/lib/api/gcode';
import { decodeFloat32Array } from '@/lib/api/gcode';

interface GCodePath3DFromAPIProps {
  layers: LayerSegmentData[];
  maxLayer?: number;
  isDarkMode?: boolean;
  showCurrentLayer?: boolean;
  showPreviousLayers?: boolean;
  showWipePath?: boolean;
  showTravelPath?: boolean;
  showSupports?: boolean;
}

export function GCodePath3DFromAPI({
  layers,
  maxLayer,
  isDarkMode = true,
  showCurrentLayer = true,
  showPreviousLayers = true,
  showWipePath = true,
  showTravelPath = true,
  showSupports = true
}: GCodePath3DFromAPIProps) {
  const { previousLayersGeometry, currentLayerGeometry, travelGeometry, wipeGeometry, supportsGeometry } = useMemo(() => {
    const previousModelFloats: number[] = [];
    const currentModelFloats: number[] = [];
    const travelFloats: number[] = [];
    const wipeFloats: number[] = [];
    const supportsFloats: number[] = [];

    // maxLayer까지만 렌더링
    const layersToRender = layers.slice(0, maxLayer !== undefined ? maxLayer + 1 : undefined);

    for (let idx = 0; idx < layersToRender.length; idx++) {
      const layer = layersToRender[idx];
      const isCurrentLayer = (maxLayer !== undefined && idx === maxLayer);
      // Base64 → Float32Array 디코딩
      let extrusionArray: Float32Array | null = null;
      let travelArray: Float32Array | null = null;
      let wipeArray: Float32Array | null = null;
      let supportsArray: Float32Array | null = null;

      try {
        if (layer.extrusionData) {
          extrusionArray = decodeFloat32Array(layer.extrusionData);
        }
        if (layer.travelData) {
          travelArray = decodeFloat32Array(layer.travelData);
        }
        if (layer.wipeData) {
          wipeArray = decodeFloat32Array(layer.wipeData);
        }
        if (layer.supportData) {
          supportsArray = decodeFloat32Array(layer.supportData);
        }
      } catch (error) {
        console.error('[GCodePath3DFromAPI] Decode error:', error);
        continue;
      }

      // 압출 경로: G-code (X,Y,Z) → Three.js (X,Z,Y)
      if (extrusionArray && extrusionArray.length >= 6) {
        // 현재 레이어인지 이전 레이어인지에 따라 다른 배열에 추가
        const targetArray = isCurrentLayer ? currentModelFloats : previousModelFloats;

        for (let i = 0; i < extrusionArray.length; i += 6) {
          const x1 = extrusionArray[i];
          const y1 = extrusionArray[i + 1];
          const z1 = extrusionArray[i + 2];
          const x2 = extrusionArray[i + 3];
          const y2 = extrusionArray[i + 4];
          const z2 = extrusionArray[i + 5];

          // 좌표 변환: (X, Y, Z) → (X, Z, Y)
          targetArray.push(x1, z1, y1);
          targetArray.push(x2, z2, y2);
        }
      }

      // 이동 경로
      if (travelArray && travelArray.length >= 6) {
        for (let i = 0; i < travelArray.length; i += 6) {
          const x1 = travelArray[i];
          const y1 = travelArray[i + 1];
          const z1 = travelArray[i + 2];
          const x2 = travelArray[i + 3];
          const y2 = travelArray[i + 4];
          const z2 = travelArray[i + 5];

          travelFloats.push(x1, z1, y1);
          travelFloats.push(x2, z2, y2);
        }
      }

      // Wipe 경로 (Bambu Lab 슬라이서)
      if (wipeArray && wipeArray.length >= 6) {
        for (let i = 0; i < wipeArray.length; i += 6) {
          const x1 = wipeArray[i];
          const y1 = wipeArray[i + 1];
          const z1 = wipeArray[i + 2];
          const x2 = wipeArray[i + 3];
          const y2 = wipeArray[i + 4];
          const z2 = wipeArray[i + 5];

          wipeFloats.push(x1, z1, y1);
          wipeFloats.push(x2, z2, y2);
        }
      }

      // Support 경로 (서포트 구조물)
      if (supportsArray && supportsArray.length >= 6) {
        for (let i = 0; i < supportsArray.length; i += 6) {
          const x1 = supportsArray[i];
          const y1 = supportsArray[i + 1];
          const z1 = supportsArray[i + 2];
          const x2 = supportsArray[i + 3];
          const y2 = supportsArray[i + 4];
          const z2 = supportsArray[i + 5];

          supportsFloats.push(x1, z1, y1);
          supportsFloats.push(x2, z2, y2);
        }
      }
    }

    // BufferGeometry 생성
    const previousLayersGeometry = new THREE.BufferGeometry();
    if (previousModelFloats.length > 0) {
      previousLayersGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(previousModelFloats, 3)
      );
    }

    const currentLayerGeometry = new THREE.BufferGeometry();
    if (currentModelFloats.length > 0) {
      currentLayerGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(currentModelFloats, 3)
      );
    }

    const travelGeometry = new THREE.BufferGeometry();
    if (travelFloats.length > 0) {
      travelGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(travelFloats, 3)
      );
    }

    const wipeGeometry = new THREE.BufferGeometry();
    if (wipeFloats.length > 0) {
      wipeGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(wipeFloats, 3)
      );
    }

    const supportsGeometry = new THREE.BufferGeometry();
    if (supportsFloats.length > 0) {
      supportsGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(supportsFloats, 3)
      );
    }

    return { previousLayersGeometry, currentLayerGeometry, travelGeometry, wipeGeometry, supportsGeometry };
  }, [layers, maxLayer]);

  // 색상
  const previousLayerColor = isDarkMode ? 0x00ffff : 0x2563eb; // 이전 레이어: 시안/파란색
  const currentLayerColor = isDarkMode ? 0xff6600 : 0xff0000; // 현재 레이어: 주황/빨강
  const travelColor = isDarkMode ? 0x999999 : 0xaaaaaa; // 이동: 회색
  const wipeColor = isDarkMode ? 0xff00ff : 0xcc00cc; // Wipe: 마젠타/보라
  const supportsColor = isDarkMode ? 0xffff00 : 0xffa500; // Supports: 노란색/주황색

  return (
    <>
      {/* 이전 레이어들 - 반투명 */}
      {showPreviousLayers && (
        <lineSegments geometry={previousLayersGeometry}>
          <lineBasicMaterial
            color={previousLayerColor}
            transparent={true}
            opacity={0.3}
          />
        </lineSegments>
      )}

      {/* 현재 레이어 - 밝고 선명하게 */}
      {showCurrentLayer && (
        <lineSegments geometry={currentLayerGeometry}>
          <lineBasicMaterial
            color={currentLayerColor}
            transparent={false}
            opacity={1.0}
            linewidth={2}
          />
        </lineSegments>
      )}

      {/* 이동 경로 (비압출) - 회색, 매우 투명 */}
      {showTravelPath && (
        <lineSegments geometry={travelGeometry}>
          <lineBasicMaterial
            color={travelColor}
            transparent={true}
            opacity={0.1}
          />
        </lineSegments>
      )}

      {/* Wipe 경로 (노즐 닦기) - 마젠타, 반투명 */}
      {showWipePath && (
        <lineSegments geometry={wipeGeometry}>
          <lineBasicMaterial
            color={wipeColor}
            transparent={true}
            opacity={0.5}
          />
        </lineSegments>
      )}

      {/* Support 경로 (서포트 구조물) - 노란색, 반투명 */}
      {showSupports && (
        <lineSegments geometry={supportsGeometry}>
          <lineBasicMaterial
            color={supportsColor}
            transparent={true}
            opacity={0.4}
          />
        </lineSegments>
      )}
    </>
  );
}
