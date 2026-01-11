/**
 * ResizableImage 컴포넌트
 * TipTap 에디터 내에서 크기 조절 및 삭제가 가능한 이미지
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { X, Move, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// 이미지 크기 프리셋
const SIZE_PRESETS = [
  { label: 'S', width: 200 },
  { label: 'M', width: 400 },
  { label: 'L', width: 600 },
  { label: '원본', width: 0 }, // 0 means auto/original
];

export function ResizableImageComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { src, alt, width, height } = node.attrs;
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 드래그 리사이즈 시작
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!imageRef.current) return;

    setIsResizing(true);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: imageRef.current.offsetWidth,
      height: imageRef.current.offsetHeight,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const newWidth = Math.max(100, startPos.current.width + deltaX);
      updateAttributes({ width: newWidth });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateAttributes]);

  // 프리셋 크기 적용
  const applyPresetSize = useCallback((presetWidth: number) => {
    if (presetWidth === 0) {
      // 원본 크기
      updateAttributes({ width: null, height: null });
    } else {
      updateAttributes({ width: presetWidth });
    }
  }, [updateAttributes]);

  // 이미지 삭제
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  return (
    <NodeViewWrapper className="relative inline-block my-2">
      <div
        ref={containerRef}
        className={cn(
          "relative inline-block group",
          selected && "ring-2 ring-primary ring-offset-2",
          isResizing && "cursor-col-resize"
        )}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !isResizing && setShowControls(false)}
      >
        {/* 이미지 */}
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          style={{
            width: width ? `${width}px` : 'auto',
            maxWidth: '100%',
            height: 'auto',
          }}
          className="rounded-lg"
          draggable={false}
        />

        {/* 컨트롤 오버레이 */}
        {(showControls || selected) && (
          <>
            {/* 삭제 버튼 */}
            <button
              onClick={handleDelete}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors z-10"
              title="삭제"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 크기 조절 버튼들 */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 rounded-lg px-2 py-1 z-10">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPresetSize(preset.width)}
                  className={cn(
                    "px-2 py-0.5 text-xs text-white rounded hover:bg-white/20 transition-colors",
                    width === preset.width && "bg-white/30"
                  )}
                  title={preset.width ? `${preset.width}px` : '원본 크기'}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 우측 하단 리사이즈 핸들 */}
            <div
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-primary rounded-tl-md opacity-70 hover:opacity-100 transition-opacity z-10"
              title="드래그하여 크기 조절"
            >
              <Move className="w-3 h-3 text-white m-0.5" />
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export default ResizableImageComponent;
