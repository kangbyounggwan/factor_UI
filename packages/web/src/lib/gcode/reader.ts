/**
 * G-code Reader
 * OctoPrint gcodeviewer/static/js/viewer/reader.js에서 이식
 */

import * as pako from 'pako';
import type {
  GCodeCommand,
  GCodeModel,
  BoundingBox,
  ModelInfo,
  LayerInfo,
  ReaderOptions,
  ParseProgressCallback,
} from './types';

export class GCodeReader {
  private gcode: Array<{ line: string; percentage: number }> = [];
  private model: Array<GCodeCommand[] | Uint8Array> = [];
  private emptyLayers: boolean[] = [];
  private percentageByLayer: number[] = [];

  private max = { x: 0, y: 0, z: 0 };
  private min = { x: 0, y: 0, z: 0 };
  private boundingBox: BoundingBox = {
    minX: 0, maxX: 0,
    minY: 0, maxY: 0,
    minZ: 0, maxZ: 0,
  };

  private filamentByLayer: { [layer: number]: number } = {};
  private filamentByExtruder: { [extruder: number]: number } = {};
  private printTimeByLayer: { [layer: number]: number } = {};
  private totalFilament = 0;
  private printTime = 0;
  private speeds: { [speed: number]: boolean } = {};

  private options: ReaderOptions = {
    purgeEmptyLayers: true,
    ignoreOutsideBed: false,
    bed: { x: 200, y: 200 },
    toolOffsets: [{ x: 0, y: 0 }],
    g90InfluencesExtruder: false,
    bedZ: 0,
    alwaysCompress: false,
    compressionSizeThreshold: 200 * 1024 * 1024,
    forceCompression: false,
  };

  constructor(options?: Partial<ReaderOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * G-code 파일 파싱
   */
  async parseGCode(
    gcodeText: string,
    onProgress?: ParseProgressCallback
  ): Promise<GCodeModel> {
    const lines = gcodeText.split('\n');
    const totalSize = gcodeText.length;

    // 1단계: 라인 준비 및 진행률 계산
    this.prepareGCode(lines, totalSize);

    if (onProgress) {
      onProgress({ percentage: 10, type: 'parsing' });
    }

    // 2단계: G-code 분석
    await this.analyzeGCode(onProgress);

    if (onProgress) {
      onProgress({ percentage: 100, type: 'done' });
    }

    // 3단계: 모델 정리 및 압축
    const cleanedModel = this.cleanModel();

    return {
      layers: cleanedModel,
      emptyLayers: this.emptyLayers,
      percentageByLayer: this.percentageByLayer,
      modelInfo: this.getModelInfo(),
    };
  }

  /**
   * G-code 라인 준비
   */
  private prepareGCode(lines: string[], totalSize: number): void {
    this.gcode = [];
    let byteCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      byteCount += line.length + 1; // +1 for '\n'
      this.gcode.push({
        line,
        percentage: (byteCount * 100) / totalSize,
      });
    }
  }

  /**
   * G-code 분석
   */
  private async analyzeGCode(onProgress?: ParseProgressCallback): Promise<void> {
    let currentLayer: GCodeCommand[] = [];
    let currentZ = 0;
    let currentX = 0, currentY = 0, currentE = 0;
    let layerNum = 0;
    let absoluteMode = true;
    let absoluteEMode = true;
    let currentTool = 0;
    let lastPercentage = 0;

    for (let i = 0; i < this.gcode.length; i++) {
      const { line, percentage } = this.gcode[i];
      const trimmed = line.trim();

      // 주석 제거
      const commentIndex = trimmed.indexOf(';');
      const code = commentIndex !== -1 ? trimmed.substring(0, commentIndex).trim() : trimmed;

      if (!code) continue;

      // 레이어 변경 감지 (;LAYER: 주석 또는 Z 변경)
      if (trimmed.startsWith(';LAYER:')) {
        if (currentLayer.length > 0) {
          this.finalizeLayer(layerNum, currentLayer);
          layerNum++;
          currentLayer = [];
        }
        continue;
      }

      // G-code 명령어 파싱
      const cmd = this.parseCommand(code, {
        currentX, currentY, currentZ, currentE,
        absoluteMode, absoluteEMode, currentTool,
        percentage,
      });

      if (cmd) {
        // Z 변경 시 새 레이어
        if (cmd.z !== undefined && cmd.z !== currentZ) {
          if (currentLayer.length > 0) {
            this.finalizeLayer(layerNum, currentLayer);
            layerNum++;
            currentLayer = [];
          }
          currentZ = cmd.z;
        }

        currentLayer.push(cmd);

        // 상태 업데이트
        if (cmd.x !== undefined) currentX = cmd.x;
        if (cmd.y !== undefined) currentY = cmd.y;
        if (cmd.z !== undefined) currentZ = cmd.z;
        if (cmd.e !== undefined) currentE = cmd.e;
      }

      // 모드 변경 (G90/G91)
      if (code.startsWith('G90')) {
        absoluteMode = true;
        if (!this.options.g90InfluencesExtruder) absoluteEMode = true;
      } else if (code.startsWith('G91')) {
        absoluteMode = false;
        if (!this.options.g90InfluencesExtruder) absoluteEMode = false;
      } else if (code.startsWith('M82')) {
        absoluteEMode = true;
      } else if (code.startsWith('M83')) {
        absoluteEMode = false;
      }

      // 툴 변경 (T0, T1, ...)
      const toolMatch = code.match(/^T(\d+)/);
      if (toolMatch) {
        currentTool = parseInt(toolMatch[1]);
      }

      // 진행률 업데이트
      if (onProgress && percentage - lastPercentage > 1) {
        onProgress({
          percentage: 10 + (percentage * 0.8),
          type: 'analyzing',
          layer: layerNum,
        });
        lastPercentage = percentage;

        // UI 업데이트를 위한 yield
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 마지막 레이어
    if (currentLayer.length > 0) {
      this.finalizeLayer(layerNum, currentLayer);
    }
  }

  /**
   * G-code 명령어 파싱
   */
  private parseCommand(
    code: string,
    context: {
      currentX: number;
      currentY: number;
      currentZ: number;
      currentE: number;
      absoluteMode: boolean;
      absoluteEMode: boolean;
      currentTool: number;
      percentage: number;
    }
  ): GCodeCommand | null {
    const { currentX, currentY, currentZ, currentE, absoluteMode, absoluteEMode, currentTool, percentage } = context;

    // G0, G1, G2, G3 명령어만 처리
    const moveMatch = code.match(/^G([0-3])\s/);
    if (!moveMatch) return null;

    const gcode = parseInt(moveMatch[1]);

    const cmd: GCodeCommand = {
      prevX: currentX,
      prevY: currentY,
      prevZ: currentZ,
      prevE: currentE,
      extrude: false,
      percentage,
      tool: currentTool,
    };

    // 좌표 추출
    const xMatch = code.match(/X([-\d.]+)/);
    const yMatch = code.match(/Y([-\d.]+)/);
    const zMatch = code.match(/Z([-\d.]+)/);
    const eMatch = code.match(/E([-\d.]+)/);
    const fMatch = code.match(/F([-\d.]+)/);

    if (xMatch) {
      cmd.x = absoluteMode ? parseFloat(xMatch[1]) : currentX + parseFloat(xMatch[1]);
    }
    if (yMatch) {
      cmd.y = absoluteMode ? parseFloat(yMatch[1]) : currentY + parseFloat(yMatch[1]);
    }
    if (zMatch) {
      cmd.z = absoluteMode ? parseFloat(zMatch[1]) : currentZ + parseFloat(zMatch[1]);
    }
    if (eMatch) {
      const eValue = parseFloat(eMatch[1]);
      cmd.e = absoluteEMode ? eValue : currentE + eValue;

      // 압출/리트랙션 판단
      if (absoluteEMode) {
        const eDiff = cmd.e - currentE;
        if (eDiff > 0) {
          cmd.extrude = true;
          cmd.extruding = true;
        } else if (eDiff < 0) {
          cmd.retract = Math.abs(eDiff);
        }
      } else {
        if (eValue > 0) {
          cmd.extrude = true;
          cmd.extruding = true;
        } else if (eValue < 0) {
          cmd.retract = Math.abs(eValue);
        }
      }
    }

    if (fMatch) {
      cmd.speed = parseFloat(fMatch[1]);
      this.speeds[cmd.speed] = true;
    }

    // G2/G3 (호 그리기)
    if (gcode === 2 || gcode === 3) {
      const iMatch = code.match(/I([-\d.]+)/);
      const jMatch = code.match(/J([-\d.]+)/);

      if (iMatch) cmd.i = parseFloat(iMatch[1]);
      if (jMatch) cmd.j = parseFloat(jMatch[1]);

      cmd.direction = gcode === 2 ? -1 : 1; // G2=CW(-1), G3=CCW(1)
    }

    return cmd;
  }

  /**
   * 레이어 마무리 및 압축
   */
  private finalizeLayer(layerNum: number, layer: GCodeCommand[]): void {
    // 빈 레이어 체크 (압출이 하나도 없는 경우)
    const hasExtrusion = layer.some(cmd => cmd.extrude);
    this.emptyLayers[layerNum] = !hasExtrusion;

    // 첫 번째 명령어의 진행률 저장
    if (layer.length > 0) {
      this.percentageByLayer[layerNum] = layer[0].percentage;
    }

    // 필라멘트 사용량 계산
    let filament = 0;
    for (const cmd of layer) {
      if (cmd.extrude && cmd.e !== undefined) {
        const eDiff = cmd.e - cmd.prevE;
        if (eDiff > 0) filament += eDiff;
      }
    }
    this.filamentByLayer[layerNum] = filament;
    this.totalFilament += filament;

    // 바운딩 박스 업데이트
    this.updateBoundingBox(layer);

    // 압축 여부 결정
    const shouldCompress = this.options.forceCompression ||
      this.options.alwaysCompress ||
      (layer.length * 200 > this.options.compressionSizeThreshold);

    if (shouldCompress) {
      const compressed = pako.deflate(JSON.stringify(layer));
      this.model[layerNum] = compressed;
    } else {
      this.model[layerNum] = layer;
    }
  }

  /**
   * 바운딩 박스 업데이트
   */
  private updateBoundingBox(layer: GCodeCommand[]): void {
    for (const cmd of layer) {
      if (!cmd.extrude) continue;

      const x = cmd.x ?? cmd.prevX;
      const y = cmd.y ?? cmd.prevY;
      const z = cmd.z ?? cmd.prevZ;

      if (this.boundingBox.minX === 0 && this.boundingBox.maxX === 0) {
        // 첫 초기화
        this.boundingBox.minX = this.boundingBox.maxX = x;
        this.boundingBox.minY = this.boundingBox.maxY = y;
        this.boundingBox.minZ = this.boundingBox.maxZ = z;
      } else {
        this.boundingBox.minX = Math.min(this.boundingBox.minX, x);
        this.boundingBox.maxX = Math.max(this.boundingBox.maxX, x);
        this.boundingBox.minY = Math.min(this.boundingBox.minY, y);
        this.boundingBox.maxY = Math.max(this.boundingBox.maxY, y);
        this.boundingBox.minZ = Math.min(this.boundingBox.minZ, z);
        this.boundingBox.maxZ = Math.max(this.boundingBox.maxZ, z);
      }
    }
  }

  /**
   * 빈 레이어 제거
   */
  private cleanModel(): Array<GCodeCommand[] | Uint8Array> {
    if (!this.options.purgeEmptyLayers) {
      return this.model;
    }

    const cleaned: Array<GCodeCommand[] | Uint8Array> = [];
    for (let i = 0; i < this.model.length; i++) {
      if (!this.emptyLayers[i]) {
        cleaned.push(this.model[i]);
      }
    }

    return cleaned;
  }

  /**
   * 레이어 압축 해제
   */
  decompressLayer(layer: GCodeCommand[] | Uint8Array): GCodeCommand[] {
    if (layer instanceof Uint8Array) {
      const inflated = pako.inflate(layer, { to: 'string' });
      return JSON.parse(inflated);
    }
    return layer;
  }

  /**
   * 모델 정보 반환
   */
  getModelInfo(): ModelInfo {
    return {
      modelSize: {
        x: this.boundingBox.maxX - this.boundingBox.minX,
        y: this.boundingBox.maxY - this.boundingBox.minY,
        z: this.boundingBox.maxZ - this.boundingBox.minZ,
      },
      boundingBox: this.boundingBox,
      totalFilament: this.totalFilament,
      totalFilamentByExtruder: this.filamentByExtruder,
      printTime: this.printTime,
      layerCount: this.model.length - this.emptyLayers.filter(e => e).length,
      speeds: this.speeds,
    };
  }

  /**
   * 레이어 정보 반환
   */
  getLayerInfo(layerNum: number): LayerInfo | null {
    if (layerNum < 0 || layerNum >= this.model.length) {
      return null;
    }

    const layer = this.decompressLayer(this.model[layerNum]);
    const z = layer.length > 0 ? (layer[0].z ?? layer[0].prevZ) : 0;

    return {
      layerNum,
      z,
      filament: this.filamentByLayer[layerNum] || 0,
      printTime: this.printTimeByLayer[layerNum] || 0,
      segmentCount: layer.length,
      isEmpty: this.emptyLayers[layerNum] || false,
    };
  }

  /**
   * 진행률로 레이어/명령어 찾기
   */
  searchByPercentage(percentage: number): { layer: number; cmd: number } | null {
    // 레이어 찾기
    let layer = 0;
    for (let i = 0; i < this.percentageByLayer.length; i++) {
      if (this.percentageByLayer[i] <= percentage) {
        layer = i;
      } else {
        break;
      }
    }

    // 명령어 찾기
    const cmds = this.decompressLayer(this.model[layer]);
    let cmd = 0;
    for (let i = 0; i < cmds.length; i++) {
      if (cmds[i].percentage <= percentage) {
        cmd = i;
      } else {
        break;
      }
    }

    return { layer, cmd };
  }

  /**
   * 옵션 업데이트
   */
  updateOptions(options: Partial<ReaderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 초기화
   */
  clear(): void {
    this.gcode = [];
    this.model = [];
    this.emptyLayers = [];
    this.percentageByLayer = [];
    this.max = { x: 0, y: 0, z: 0 };
    this.min = { x: 0, y: 0, z: 0 };
    this.boundingBox = {
      minX: 0, maxX: 0,
      minY: 0, maxY: 0,
      minZ: 0, maxZ: 0,
    };
    this.filamentByLayer = {};
    this.filamentByExtruder = {};
    this.printTimeByLayer = {};
    this.totalFilament = 0;
    this.printTime = 0;
    this.speeds = {};
  }
}
