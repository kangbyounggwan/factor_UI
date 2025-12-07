import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

interface GCodeLayerViewerProps {
  filePosition: number;
  fileSize: number;
  layerCount?: number;
  className?: string;
}

export const GCodeLayerViewer = ({ 
  filePosition, 
  fileSize, 
  layerCount = 100,
  className 
}: GCodeLayerViewerProps) => {
  const [currentLayer, setCurrentLayer] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 레이어 시뮬레이션 렌더링
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // 그리드 그리기
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=w; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
    for(let y=0; y<=h; y+=20) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
    ctx.stroke();

    // 가상의 경로 그리기 (현재 레이어에 따라 변화)
    ctx.strokeStyle = '#00ff00'; // G-code 경로 (녹색)
    ctx.lineWidth = 2;
    ctx.beginPath();
    // 레이어에 따라 다른 패턴 시뮬레이션
    const radius = Math.min(w, h) / 3;
    const angleStep = (Math.PI * 2) / (layerCount + 1);
    const startAngle = angleStep * currentLayer;
    
    ctx.arc(w/2, h/2, radius + (currentLayer % 10) * 2, 0, Math.PI * 2);
    ctx.stroke();

    // 실제 헤드 위치 (붉은 점) 시뮬레이션
    const progress = fileSize > 0 ? filePosition / fileSize : 0;
    const headAngle = progress * Math.PI * 10; // 진행률에 따라 회전
    const headX = w/2 + Math.cos(headAngle) * (radius + (currentLayer % 10) * 2);
    const headY = h/2 + Math.sin(headAngle) * (radius + (currentLayer % 10) * 2);

    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(headX, headY, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [currentLayer, filePosition, fileSize, layerCount]);

  return (
    <div className={`relative h-full bg-black/90 rounded-lg overflow-hidden flex flex-col ${className}`}>
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <Badge variant="outline" className="bg-background/50 backdrop-blur w-fit text-white border-none">
           Layer: {currentLayer} / {layerCount}
        </Badge>
        <Badge variant="outline" className="bg-background/50 backdrop-blur w-fit text-white border-none">
           Progress: {((filePosition/fileSize)*100 || 0).toFixed(1)}%
        </Badge>
      </div>

      {/* 캔버스 영역 */}
      <div className="flex-1 relative flex items-center justify-center min-h-0">
        <canvas ref={canvasRef} width={600} height={400} className="max-w-full max-h-full object-contain" />
      </div>

      {/* 레이어 컨트롤러 */}
      <div className="bg-card/10 p-4 border-t border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/70 font-mono">0</span>
          <Slider 
            value={[currentLayer]} 
            max={layerCount} 
            step={1} 
            onValueChange={(v) => setCurrentLayer(v[0])} 
            className="flex-1"
          />
          <span className="text-xs text-white/70 font-mono">{layerCount}</span>
        </div>
      </div>
    </div>
  );
};

