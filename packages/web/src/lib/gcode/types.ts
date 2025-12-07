/**
 * G-code Viewer Types
 * OctoPrint에서 이식
 */

export interface GCodeCommand {
  x?: number;
  y?: number;
  z?: number;
  e?: number;
  i?: number;
  j?: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevE: number;
  extrude: boolean;
  retract?: number;
  extruding?: boolean;
  tool?: number;
  speed?: number;
  direction?: number; // G2/G3용 (1 = ccw, -1 = cw)
  percentage: number; // 파일 진행률 (0-100)
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface ModelInfo {
  modelSize: {
    x: number;
    y: number;
    z: number;
  };
  boundingBox: BoundingBox;
  totalFilament: number;
  totalFilamentByExtruder?: { [key: number]: number };
  printTime: number;
  layerCount: number;
  speeds: { [key: number]: boolean };
}

export interface LayerInfo {
  layerNum: number;
  z: number;
  filament: number;
  filamentByExtruder?: { [key: number]: number };
  printTime: number;
  segmentCount: number;
  isEmpty: boolean;
}

export interface GCodeModel {
  layers: Array<GCodeCommand[] | Uint8Array>; // 압축된 경우 Uint8Array
  emptyLayers: boolean[];
  percentageByLayer: number[];
  modelInfo: ModelInfo;
}

export interface ReaderOptions {
  purgeEmptyLayers: boolean;
  ignoreOutsideBed: boolean;
  bed: {
    x?: number;
    y?: number;
    r?: number;
    circular?: boolean;
    centeredOrigin?: boolean;
  };
  toolOffsets: Array<{ x: number; y: number }>;
  g90InfluencesExtruder: boolean;
  bedZ: number;
  alwaysCompress: boolean;
  compressionSizeThreshold: number;
  forceCompression: boolean;
}

export interface ParseProgress {
  percentage: number;
  type: 'parsing' | 'analyzing' | 'done';
  layer?: number;
}

export type ParseProgressCallback = (progress: ParseProgress) => void;
