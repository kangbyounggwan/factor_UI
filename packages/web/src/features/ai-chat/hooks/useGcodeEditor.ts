/**
 * G-code 에디터 상태 관리 훅
 *
 * 책임:
 * - 에디터 콘텐츠 상태
 * - 수정 정보 (Fix Info) 관리
 * - 대기 중인 패치 관리
 * - 해결된 라인 추적
 * - 되돌리기 기능
 */

import { useState, useCallback, useMemo } from 'react';
import type { EditorFixInfo, PatchInfo } from '../types';

export interface UseGcodeEditorOptions {
  initialContent?: string;
}

export interface UseGcodeEditorReturn {
  // 에디터 상태
  editorContent: string | undefined;
  editorLoading: boolean;
  editorFixInfo: EditorFixInfo | undefined;

  // 패치 관리
  pendingPatches: Map<number, PatchInfo>;
  resolvedLines: Set<number>;

  // 되돌리기
  revertLineNumber: number | undefined;

  // 콘텐츠 관리
  setEditorContent: (content: string | undefined) => void;
  setEditorLoading: (loading: boolean) => void;
  loadGcodeContent: (content: string) => void;
  clearEditorContent: () => void;

  // 수정 정보 관리
  setEditorFixInfo: (fixInfo: EditorFixInfo | undefined) => void;
  clearEditorFixInfo: () => void;

  // 패치 관리
  addPendingPatch: (lineNumber: number, patch: PatchInfo) => void;
  removePendingPatch: (lineNumber: number) => void;
  clearPendingPatches: () => void;
  applyAllPatches: () => string | undefined;
  hasPendingPatches: boolean;

  // 해결된 라인 관리
  markLineResolved: (lineNumber: number) => void;
  markLinesResolved: (lineNumbers: number[]) => void;
  unmarkLineResolved: (lineNumber: number) => void;
  isLineResolved: (lineNumber: number) => boolean;
  clearResolvedLines: () => void;

  // 되돌리기
  setRevertLineNumber: (lineNumber: number | undefined) => void;
  revertLine: (lineNumber: number, originalCode: string) => void;

  // 초기화
  resetEditor: () => void;
}

/**
 * G-code 에디터 관리 훅
 */
export function useGcodeEditor({
  initialContent,
}: UseGcodeEditorOptions = {}): UseGcodeEditorReturn {
  // 에디터 상태
  const [editorContent, setEditorContent] = useState<string | undefined>(initialContent);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorFixInfo, setEditorFixInfo] = useState<EditorFixInfo | undefined>(undefined);

  // 패치 관리
  const [pendingPatches, setPendingPatches] = useState<Map<number, PatchInfo>>(new Map());
  const [resolvedLines, setResolvedLines] = useState<Set<number>>(new Set());

  // 되돌리기
  const [revertLineNumber, setRevertLineNumber] = useState<number | undefined>(undefined);

  /**
   * G-code 콘텐츠 로드
   */
  const loadGcodeContent = useCallback((content: string) => {
    setEditorContent(content);
    setEditorLoading(false);
  }, []);

  /**
   * 에디터 콘텐츠 초기화
   */
  const clearEditorContent = useCallback(() => {
    setEditorContent(undefined);
  }, []);

  /**
   * 수정 정보 초기화
   */
  const clearEditorFixInfo = useCallback(() => {
    setEditorFixInfo(undefined);
  }, []);

  /**
   * 대기 중인 패치 추가
   */
  const addPendingPatch = useCallback((lineNumber: number, patch: PatchInfo) => {
    setPendingPatches(prev => {
      const newMap = new Map(prev);
      newMap.set(lineNumber, patch);
      return newMap;
    });
  }, []);

  /**
   * 대기 중인 패치 제거
   */
  const removePendingPatch = useCallback((lineNumber: number) => {
    setPendingPatches(prev => {
      const newMap = new Map(prev);
      newMap.delete(lineNumber);
      return newMap;
    });
  }, []);

  /**
   * 모든 대기 중인 패치 제거
   */
  const clearPendingPatches = useCallback(() => {
    setPendingPatches(new Map());
  }, []);

  /**
   * 모든 패치 적용
   */
  const applyAllPatches = useCallback((): string | undefined => {
    if (!editorContent || pendingPatches.size === 0) {
      return editorContent;
    }

    const lines = editorContent.split('\n');

    // 라인 번호 내림차순 정렬 (뒤에서부터 적용해야 인덱스가 안 밀림)
    const sortedPatches = Array.from(pendingPatches.entries())
      .sort((a, b) => b[0] - a[0]);

    for (const [lineNumber, patch] of sortedPatches) {
      const index = lineNumber - 1; // 1-based to 0-based
      if (index >= 0 && index < lines.length) {
        lines[index] = patch.fixedCode;
      }
    }

    const newContent = lines.join('\n');
    setEditorContent(newContent);
    clearPendingPatches();

    return newContent;
  }, [editorContent, pendingPatches, clearPendingPatches]);

  /**
   * 대기 중인 패치 존재 여부
   */
  const hasPendingPatches = useMemo(() => pendingPatches.size > 0, [pendingPatches]);

  /**
   * 라인 해결됨으로 표시
   */
  const markLineResolved = useCallback((lineNumber: number) => {
    setResolvedLines(prev => {
      const newSet = new Set(prev);
      newSet.add(lineNumber);
      return newSet;
    });
  }, []);

  /**
   * 여러 라인 해결됨으로 표시
   */
  const markLinesResolved = useCallback((lineNumbers: number[]) => {
    setResolvedLines(prev => {
      const newSet = new Set(prev);
      lineNumbers.forEach(ln => newSet.add(ln));
      return newSet;
    });
  }, []);

  /**
   * 라인 해결 표시 제거
   */
  const unmarkLineResolved = useCallback((lineNumber: number) => {
    setResolvedLines(prev => {
      const newSet = new Set(prev);
      newSet.delete(lineNumber);
      return newSet;
    });
  }, []);

  /**
   * 라인 해결 여부 확인
   */
  const isLineResolved = useCallback((lineNumber: number): boolean => {
    return resolvedLines.has(lineNumber);
  }, [resolvedLines]);

  /**
   * 해결된 라인 목록 초기화
   */
  const clearResolvedLines = useCallback(() => {
    setResolvedLines(new Set());
  }, []);

  /**
   * 라인 되돌리기
   */
  const revertLine = useCallback((lineNumber: number, originalCode: string) => {
    if (!editorContent) return;

    const lines = editorContent.split('\n');
    const index = lineNumber - 1;

    if (index >= 0 && index < lines.length) {
      lines[index] = originalCode;
      setEditorContent(lines.join('\n'));
    }

    // 해결된 라인에서 제거
    unmarkLineResolved(lineNumber);

    // 대기 중인 패치에서도 제거
    removePendingPatch(lineNumber);

    // 되돌리기 상태 초기화
    setRevertLineNumber(undefined);
  }, [editorContent, unmarkLineResolved, removePendingPatch]);

  /**
   * 에디터 전체 초기화
   */
  const resetEditor = useCallback(() => {
    setEditorContent(undefined);
    setEditorLoading(false);
    setEditorFixInfo(undefined);
    setPendingPatches(new Map());
    setResolvedLines(new Set());
    setRevertLineNumber(undefined);
  }, []);

  return {
    // 에디터 상태
    editorContent,
    editorLoading,
    editorFixInfo,

    // 패치 관리
    pendingPatches,
    resolvedLines,

    // 되돌리기
    revertLineNumber,

    // 콘텐츠 관리
    setEditorContent,
    setEditorLoading,
    loadGcodeContent,
    clearEditorContent,

    // 수정 정보 관리
    setEditorFixInfo,
    clearEditorFixInfo,

    // 패치 관리
    addPendingPatch,
    removePendingPatch,
    clearPendingPatches,
    applyAllPatches,
    hasPendingPatches,

    // 해결된 라인 관리
    markLineResolved,
    markLinesResolved,
    unmarkLineResolved,
    isLineResolved,
    clearResolvedLines,

    // 되돌리기
    setRevertLineNumber,
    revertLine,

    // 초기화
    resetEditor,
  };
}

export default useGcodeEditor;
