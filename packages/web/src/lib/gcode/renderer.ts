/**
 * G-code Renderer (Canvas 2D)
 * OctoPrint gcodeviewer/static/js/viewer/renderer.js에서 이식
 */

import type { GCodeCommand, GCodeModel, BoundingBox } from './types';
import { GCodeReader } from './reader';

export interface RendererOptions {
  showMoves: boolean;
  showRetracts: boolean;
  showHead: boolean;
  showBoundingBox: boolean;
  showLayerBoundingBox: boolean;
  showFullSize: boolean;
  showNextLayer: boolean;
  showCurrentLayer: boolean;
  showPreviousLayer: boolean;
  extrusionWidth: number;
  bed: { x: number; y: number };
  moveModel: boolean;
  zoomInOnModel: boolean;
  centerViewport: boolean;
  colorLine: string[];
  colorMove: string;
  colorRetract: string;
  colorHead: string;
  colorGrid: string;
  bgColorGrid: string;
  bgColorOffGrid: string;
}

export class GCodeRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private reader: GCodeReader | null = null;
  private model: GCodeModel | null = null;

  private currentLayer = 0;
  private currentProgress = { from: 0, to: -1 };

  private scale = { x: 1, y: 1 };
  private offset = { x: 0, y: 0 };
  private pixelRatio = window.devicePixelRatio || 1;

  private options: RendererOptions = {
    showMoves: true,
    showRetracts: true,
    showHead: false,
    showBoundingBox: false,
    showLayerBoundingBox: false,
    showFullSize: false,
    showNextLayer: false,
    showCurrentLayer: false,
    showPreviousLayer: false,
    extrusionWidth: 2,
    bed: { x: 200, y: 200 },
    moveModel: true,
    zoomInOnModel: false,
    centerViewport: false,
    // 다크 테마에 맞춘 색상
    colorLine: ['#00ffff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#c44dff'],
    colorMove: '#666666',
    colorRetract: '#ff4444',
    colorHead: '#00ff00',
    colorGrid: '#444444',
    bgColorGrid: '#1a1a1a',
    bgColorOffGrid: '#0d0d0d',
  };

  /**
   * 초기화
   */
  initialize(canvas: HTMLCanvasElement, reader: GCodeReader): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reader = reader;

    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
    }

    // 고해상도 디스플레이 지원
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * this.pixelRatio;
    canvas.height = rect.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

    // Canvas transform 설정
    this.setupTransform();
  }

  /**
   * Canvas transform 설정
   */
  private setupTransform(): void {
    if (!this.ctx) return;

    // Y축 반전 (3D 프린터 좌표계)
    this.ctx.setTransform(1, 0, 0, -1, 0, this.canvas!.height / this.pixelRatio);
  }

  /**
   * 모델 설정
   */
  setModel(model: GCodeModel): void {
    this.model = model;
    this.currentLayer = 0;
    this.currentProgress = { from: 0, to: -1 };

    // 초기 뷰포트 설정 - 항상 베드 크기에 맞게 스케일 조정
    this.fitToBed();
  }

  /**
   * 베드 크기에 맞게 뷰포트 조정
   */
  private fitToBed(): void {
    if (!this.canvas) return;

    const canvasWidth = this.canvas.width / this.pixelRatio;
    const canvasHeight = this.canvas.height / this.pixelRatio;

    const bedX = this.options.bed.x;
    const bedY = this.options.bed.y;

    // 베드가 캔버스에 맞도록 스케일 계산 (여백 10% 포함)
    const scaleX = (canvasWidth * 0.9) / bedX;
    const scaleY = (canvasHeight * 0.9) / bedY;
    const scale = Math.min(scaleX, scaleY);

    this.scale.x = scale;
    this.scale.y = scale;

    // 베드 중앙 정렬
    this.offset.x = (canvasWidth - bedX * scale) / 2;
    this.offset.y = (canvasHeight - bedY * scale) / 2;

    this.applyTransform();
  }

  /**
   * 렌더링
   */
  render(layer?: number, progress?: { from: number; to: number }): void {
    if (!this.ctx || !this.model) {
      console.log('[GCodeRenderer] render() skipped: ctx=', !!this.ctx, 'model=', !!this.model);
      return;
    }

    console.log('[GCodeRenderer] render() called, layers:', this.model.layers.length, 'currentLayer:', this.currentLayer);

    if (layer !== undefined) {
      this.currentLayer = Math.max(0, Math.min(layer, this.model.layers.length - 1));
    }

    if (progress !== undefined) {
      this.currentProgress = progress;
    }

    // 캔버스 클리어
    this.clear();

    // 그리드 그리기
    this.drawGrid();

    // 바운딩 박스 그리기
    if (this.options.showBoundingBox || this.options.showFullSize) {
      this.drawBoundingBox();
    }

    // 레이어 그리기
    if (this.options.showPreviousLayer && this.currentLayer > 0) {
      this.drawLayer(this.currentLayer - 1, 0, -1, true);
    }

    if (this.options.showCurrentLayer) {
      this.drawLayer(this.currentLayer, 0, -1, true);
    }

    if (this.options.showNextLayer && this.currentLayer < this.model.layers.length - 1) {
      this.drawLayer(this.currentLayer + 1, 0, -1, true);
    }

    // 현재 레이어 (진행률 포함)
    this.drawLayer(
      this.currentLayer,
      this.currentProgress.from,
      this.currentProgress.to
    );
  }

  /**
   * 캔버스 클리어
   */
  private clear(): void {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 배경색으로 채우기
    this.ctx.fillStyle = this.options.bgColorOffGrid;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  /**
   * 그리드 그리기
   */
  private drawGrid(): void {
    if (!this.ctx) return;

    const bedX = this.options.bed.x;
    const bedY = this.options.bed.y;
    const gridStep = 10;

    this.ctx.save();

    // 베드 배경
    this.ctx.fillStyle = this.options.bgColorGrid;
    this.ctx.fillRect(0, 0, bedX, bedY);

    // 그리드 라인
    this.ctx.strokeStyle = this.options.colorGrid;
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();

    // 세로선
    for (let x = 0; x <= bedX; x += gridStep) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, bedY);
    }

    // 가로선
    for (let y = 0; y <= bedY; y += gridStep) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(bedX, y);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * 바운딩 박스 그리기
   */
  private drawBoundingBox(): void {
    if (!this.ctx || !this.model) return;

    const bbox = this.model.modelInfo.boundingBox;

    this.ctx.save();
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    this.ctx.strokeRect(
      bbox.minX,
      bbox.minY,
      bbox.maxX - bbox.minX,
      bbox.maxY - bbox.minY
    );

    this.ctx.restore();
  }

  /**
   * 레이어 그리기
   */
  private drawLayer(
    layerNum: number,
    fromSegment: number,
    toSegment: number,
    faded = false
  ): void {
    if (!this.ctx || !this.model || !this.reader) return;
    if (layerNum < 0 || layerNum >= this.model.layers.length) return;

    const layer = this.reader.decompressLayer(this.model.layers[layerNum]);
    const alpha = faded ? 0.3 : 1.0;
    const start = Math.max(0, fromSegment);
    const end = toSegment === -1 ? layer.length : Math.min(toSegment, layer.length);

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    for (let i = start; i < end; i++) {
      const cmd = layer[i];
      this.drawSegment(cmd, layerNum);
    }

    this.ctx.restore();
  }

  /**
   * 세그먼트 그리기
   */
  private drawSegment(cmd: GCodeCommand, layerNum: number): void {
    if (!this.ctx) return;

    const x1 = cmd.prevX;
    const y1 = cmd.prevY;
    const x2 = cmd.x ?? x1;
    const y2 = cmd.y ?? y1;

    // 이동 명령어 (비압출)
    if (!cmd.extrude) {
      if (this.options.showMoves) {
        this.ctx.strokeStyle = this.options.colorMove;
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([2, 2]);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // 리트랙션 표시
      if (cmd.retract && this.options.showRetracts) {
        this.ctx.fillStyle = this.options.colorRetract;
        this.ctx.beginPath();
        this.ctx.arc(x1, y1, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }

      return;
    }

    // 압출 라인
    const tool = cmd.tool || 0;
    const colorIndex = layerNum % this.options.colorLine.length;
    this.ctx.strokeStyle = this.options.colorLine[colorIndex];
    this.ctx.lineWidth = this.options.extrusionWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    if (cmd.direction !== undefined && cmd.i !== undefined && cmd.j !== undefined) {
      // 호 그리기 (G2/G3)
      this.drawArc(cmd);
    } else {
      // 직선 그리기 (G1)
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
    }

    this.ctx.stroke();
  }

  /**
   * 호 그리기 (G2/G3)
   */
  private drawArc(cmd: GCodeCommand): void {
    if (!this.ctx) return;

    const x1 = cmd.prevX;
    const y1 = cmd.prevY;
    const x2 = cmd.x ?? x1;
    const y2 = cmd.y ?? y1;

    const centerX = x1 + (cmd.i || 0);
    const centerY = y1 + (cmd.j || 0);

    const radius = Math.sqrt((cmd.i || 0) ** 2 + (cmd.j || 0) ** 2);
    const startAngle = Math.atan2(y1 - centerY, x1 - centerX);
    const endAngle = Math.atan2(y2 - centerY, x2 - centerX);

    const anticlockwise = cmd.direction === 1; // CCW

    this.ctx.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise);
  }

  /**
   * 모델에 줌
   */
  private zoomToModel(): void {
    if (!this.model || !this.canvas) return;

    const bbox = this.model.modelInfo.boundingBox;
    const canvasWidth = this.canvas.width / this.pixelRatio;
    const canvasHeight = this.canvas.height / this.pixelRatio;

    const modelWidth = bbox.maxX - bbox.minX;
    const modelHeight = bbox.maxY - bbox.minY;

    const scaleX = (canvasWidth * 0.9) / modelWidth;
    const scaleY = (canvasHeight * 0.9) / modelHeight;
    const scale = Math.min(scaleX, scaleY);

    this.scale.x = scale;
    this.scale.y = scale;

    this.centerOnModel();
  }

  /**
   * 모델 중앙 정렬
   */
  private centerOnModel(): void {
    if (!this.model || !this.canvas) return;

    const bbox = this.model.modelInfo.boundingBox;
    const canvasWidth = this.canvas.width / this.pixelRatio;
    const canvasHeight = this.canvas.height / this.pixelRatio;

    const modelCenterX = (bbox.minX + bbox.maxX) / 2;
    const modelCenterY = (bbox.minY + bbox.maxY) / 2;

    this.offset.x = canvasWidth / 2 - modelCenterX * this.scale.x;
    this.offset.y = canvasHeight / 2 - modelCenterY * this.scale.y;

    this.applyTransform();
  }

  /**
   * Transform 적용
   */
  private applyTransform(): void {
    if (!this.ctx || !this.canvas) return;

    const height = this.canvas.height / this.pixelRatio;

    this.ctx.setTransform(
      this.scale.x,
      0,
      0,
      -this.scale.y,
      this.offset.x,
      height - this.offset.y
    );
  }

  /**
   * 레이어 설정
   */
  setLayer(layer: number): void {
    this.currentLayer = layer;
    this.render();
  }

  /**
   * 진행률 설정 (0-100)
   */
  setProgress(percentage: number): void {
    if (!this.model || !this.reader) return;

    const result = this.reader.searchByPercentage(percentage);
    if (result) {
      this.currentLayer = result.layer;
      this.currentProgress = { from: 0, to: result.cmd };
      this.render();
    }
  }

  /**
   * 옵션 업데이트
   */
  updateOptions(options: Partial<RendererOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  /**
   * 확대
   */
  zoomIn(): void {
    this.scale.x *= 1.1;
    this.scale.y *= 1.1;
    this.applyTransform();
    this.render();
  }

  /**
   * 축소
   */
  zoomOut(): void {
    this.scale.x /= 1.1;
    this.scale.y /= 1.1;
    this.applyTransform();
    this.render();
  }

  /**
   * 이동
   */
  pan(dx: number, dy: number): void {
    this.offset.x += dx;
    this.offset.y += dy;
    this.applyTransform();
    this.render();
  }

  /**
   * 뷰포트 리셋
   */
  resetViewport(): void {
    this.fitToBed();
    this.render();
  }

  /**
   * 리사이즈
   */
  resize(): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = rect.width * this.pixelRatio;
    this.canvas.height = rect.height * this.pixelRatio;

    if (this.ctx) {
      this.ctx.scale(this.pixelRatio, this.pixelRatio);
    }

    // 리사이즈 시 베드 크기에 맞게 재조정
    this.fitToBed();
    this.render();
  }

  /**
   * 레이어 개수 반환
   */
  getLayerCount(): number {
    return this.model?.layers.length || 0;
  }

  /**
   * 현재 레이어 반환
   */
  getCurrentLayer(): number {
    return this.currentLayer;
  }
}
