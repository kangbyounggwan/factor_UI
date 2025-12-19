/**
 * G-code 수정 에디터 모달
 * - AI 해결 응답의 코드 수정을 직접 편집
 * - 앞뒤 30라인 (총 60라인) 컨텍스트 표시
 * - 인라인 편집 지원
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  FileCode2,
  Edit3,
  Check,
  XCircle,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// 코드 수정 정보 타입
export interface CodeFixInfo {
  line_number: number | null;
  original: string | null;
  fixed: string | null;
}

interface GCodeFixEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  codeFixes: CodeFixInfo[];
  gcodeContent: string;
  fileName?: string;
  onSave?: (newContent: string) => Promise<void>;
  initialFixIndex?: number;  // 특정 fix 항목으로 바로 이동
}

// 컨텍스트 라인 수 (문제 라인 앞뒤로)
const CONTEXT_LINES = 30;

// G-code 구문 하이라이팅
const highlightGCode = (line: string) => {
  if (line.trim().startsWith(';')) {
    return <span className="text-slate-400 italic">{line}</span>;
  }

  const parts = line.split(/(\s+)/);

  return parts.map((part, i) => {
    if (part.trim() === '') return part;

    // Command (G1, M104...) - Blue/Cyan
    if (/^[GM]\d+/.test(part)) {
      return <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">{part}</span>;
    }

    // Coordinates (X,Y,Z,E) - Orange/Yellow for axis, Green/LightBlue for value
    if (/^[XYZE]-?[\d.]+/.test(part)) {
      const axis = part.charAt(0);
      const val = part.substring(1);
      return (
        <span key={i}>
          <span className="text-orange-600 dark:text-orange-300 font-semibold">{axis}</span>
          <span className="text-emerald-600 dark:text-emerald-300">{val}</span>
        </span>
      );
    }

    // Parameters (F,S,P) - Purple/Pink for param, Green/LightBlue for value
    if (/^[FSP]-?[\d.]+/.test(part)) {
      const param = part.charAt(0);
      const val = part.substring(1);
      return (
        <span key={i}>
          <span className="text-purple-600 dark:text-purple-300 font-semibold">{param}</span>
          <span className="text-amber-600 dark:text-amber-300">{val}</span>
        </span>
      );
    }

    if (part.startsWith(';')) {
      return <span key={i} className="text-slate-400 dark:text-slate-500 italic">{part}</span>;
    }

    return <span key={i} className="text-slate-700 dark:text-slate-300">{part}</span>;
  });
};

export const GCodeFixEditorModal: React.FC<GCodeFixEditorModalProps> = ({
  isOpen,
  onClose,
  codeFixes,
  gcodeContent,
  fileName = 'gcode',
  onSave,
  initialFixIndex = 0
}) => {
  const { t } = useTranslation();

  // 현재 선택된 수정 인덱스
  const [currentFixIndex, setCurrentFixIndex] = useState(0);

  // 전체 라인 배열
  const [lines, setLines] = useState<string[]>([]);

  // 편집 상태
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  // 초기화
  useEffect(() => {
    if (isOpen && gcodeContent) {
      const newLines = gcodeContent.split('\n');
      setLines(newLines);
      // initialFixIndex가 유효하면 해당 인덱스로 설정
      const validIndex = Math.min(Math.max(0, initialFixIndex), codeFixes.length - 1);
      setCurrentFixIndex(validIndex);
      setEditingLineIndex(null);
      setEditingValue('');
      setHasChanges(false);
    }
  }, [isOpen, gcodeContent, initialFixIndex, codeFixes.length]);

  // 현재 수정 정보
  const currentFix = codeFixes[currentFixIndex];
  const targetLineNumber = currentFix?.line_number;
  const targetLineIndex = targetLineNumber ? targetLineNumber - 1 : -1;

  // 스니펫 범위 계산 (앞뒤 30라인)
  const snippetRange = {
    start: Math.max(0, targetLineIndex - CONTEXT_LINES),
    end: Math.min(lines.length, targetLineIndex + CONTEXT_LINES + 1)
  };

  // 타겟 라인으로 스크롤
  useEffect(() => {
    if (targetLineRef.current && targetLineIndex >= 0) {
      setTimeout(() => {
        targetLineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  }, [targetLineIndex, currentFixIndex]);

  // 편집 시작
  const handleStartEdit = useCallback((lineIndex: number) => {
    setEditingLineIndex(lineIndex);
    setEditingValue(lines[lineIndex] || '');
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, [lines]);

  // 편집 확인
  const handleConfirmEdit = useCallback(() => {
    if (editingLineIndex === null) return;

    const newLines = [...lines];
    newLines[editingLineIndex] = editingValue;
    setLines(newLines);
    setHasChanges(true);
    setEditingLineIndex(null);
    setEditingValue('');
  }, [editingLineIndex, editingValue, lines]);

  // 편집 취소
  const handleCancelEdit = useCallback(() => {
    setEditingLineIndex(null);
    setEditingValue('');
  }, []);

  // 키보드 이벤트
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleConfirmEdit, handleCancelEdit]);

  // 수정 제안 적용
  const handleApplyFix = useCallback(() => {
    if (!currentFix || targetLineIndex < 0) return;

    const newLines = [...lines];

    // fixed에서 실제 코드 추출 (라인번호: 코드 형식)
    const fixedCode = currentFix.fixed?.split('\n').map(line => {
      const match = line.match(/^\d+:\s*(.*)$/);
      return match ? match[1] : line;
    }).join('\n') || '';

    // 단일 라인 또는 멀티 라인 처리
    const fixedLines = fixedCode.split('\n');
    if (fixedLines.length === 1) {
      newLines[targetLineIndex] = fixedLines[0];
    } else {
      // 기존 라인 대체 + 추가 라인 삽입
      newLines.splice(targetLineIndex, 1, ...fixedLines);
    }

    setLines(newLines);
    setHasChanges(true);
  }, [currentFix, targetLineIndex, lines]);

  // 코드 복사
  const handleCopyCode = useCallback(() => {
    const content = lines.join('\n');
    navigator.clipboard.writeText(content);
  }, [lines]);

  // 파일 다운로드
  const handleDownload = useCallback(() => {
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.gcode') ? fileName : `${fileName}_modified.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lines, fileName]);

  // 저장
  const handleSave = useCallback(async () => {
    if (!onSave || !hasChanges) return;

    setIsSaving(true);
    try {
      await onSave(lines.join('\n'));
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, lines, hasChanges]);

  // 이전/다음 수정으로 이동
  const goToPrevFix = () => setCurrentFixIndex(prev => Math.max(0, prev - 1));
  const goToNextFix = () => setCurrentFixIndex(prev => Math.min(codeFixes.length - 1, prev + 1));

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        {/* 헤더 */}
        <DialogHeader className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileCode2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-lg font-semibold">
                  {t('aiChat.codeEditor', 'G-code 에디터')}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fileName}
                </p>
              </div>
            </DialogTitle>

            <div className="flex items-center gap-2">
              {/* 수정 네비게이션 */}
              {codeFixes.length > 1 && (
                <div className="flex items-center gap-1 mr-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToPrevFix}
                    disabled={currentFixIndex === 0}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="secondary" className="px-3">
                    {currentFixIndex + 1} / {codeFixes.length}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToNextFix}
                    disabled={currentFixIndex === codeFixes.length - 1}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button variant="ghost" size="icon" onClick={handleCopyCode} title={t('common.copy', '복사')}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload} title={t('common.download', '다운로드')}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 수정 제안 정보 */}
        {currentFix && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Line {targetLineNumber}
              </Badge>
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {t('aiChat.suggestedFix', '수정 제안')}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleApplyFix}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              {t('aiChat.applyFix', '수정 적용')}
            </Button>
          </div>
        )}

        {/* 에디터 본문 */}
        <div className="flex-1 overflow-auto font-mono text-sm bg-white dark:bg-[#0d1117]">
          {/* 에디터 헤더 */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-2 bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {t('aiChat.showingLines', '표시 중')}: {snippetRange.start + 1} - {snippetRange.end}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>UTF-8</span>
              <span>G-code</span>
              <Badge variant="outline" className="text-[10px]">
                SNIPPET
              </Badge>
            </div>
          </div>

          {/* 코드 라인들 */}
          <div className="leading-7">
            {lines.slice(snippetRange.start, snippetRange.end).map((line, idx) => {
              const actualLineIdx = snippetRange.start + idx;
              const isTarget = actualLineIdx === targetLineIndex;
              const lineNumber = actualLineIdx + 1;
              const isEditing = editingLineIndex === actualLineIdx;
              const isHovered = hoveredLineIndex === actualLineIdx;

              return (
                <div
                  key={actualLineIdx}
                  ref={isTarget ? targetLineRef : null}
                  onMouseEnter={() => setHoveredLineIndex(actualLineIdx)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                  className={cn(
                    "flex transition-all duration-150 border-l-4",
                    isTarget
                      ? "bg-amber-50/60 dark:bg-amber-900/30 border-amber-500"
                      : isHovered && !isEditing
                        ? "bg-slate-50/80 dark:bg-slate-700/30 border-transparent"
                        : isEditing
                          ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-400"
                          : "bg-transparent border-transparent"
                  )}
                >
                  {/* Line Number */}
                  <div className={cn(
                    "w-16 min-w-[64px] text-right select-none pr-4 border-r border-slate-200 dark:border-slate-700 py-0.5",
                    isTarget ? "text-amber-600 dark:text-amber-400 font-bold bg-amber-50/30 dark:bg-amber-900/30" :
                      isHovered ? "text-slate-500 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                  )}>
                    {lineNumber}
                  </div>

                  {/* Code Content */}
                  <div className={cn(
                    "flex-1 pl-4 whitespace-pre font-mono py-0.5 relative flex items-center",
                    isTarget ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
                  )}>
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-blue-100 mr-2"
                      />
                    ) : (
                      <span className="flex-1">{highlightGCode(line)}</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className={cn(
                    "flex items-center gap-1 pr-3 transition-opacity duration-150",
                    (isHovered || isEditing) ? "opacity-100" : "opacity-0"
                  )}>
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleConfirmEdit}
                          className="h-6 w-6 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600"
                          title="확인 (Enter)"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          title="취소 (Esc)"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(actualLineIdx)}
                        className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                        title="수정"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t bg-slate-50 dark:bg-slate-900 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            {hasChanges && (
              <span className="text-amber-600 dark:text-amber-400">
                {t('aiChat.unsavedChanges', '저장되지 않은 변경사항이 있습니다')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.close', '닫기')}
            </Button>
            {onSave && (
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="min-w-[80px]"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('common.save', '저장')
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GCodeFixEditorModal;
