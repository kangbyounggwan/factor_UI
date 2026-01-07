/**
 * 채팅 입력 컴포저 훅
 *
 * 책임:
 * - 입력 텍스트 상태 관리
 * - 파일 업로드 상태 (이미지, G-code)
 * - 선택된 도구/모델 상태
 * - 전송 가능 여부 판단
 */

import { useState, useCallback, useMemo } from 'react';
import type { ChatTool, ChatMode, SelectedModel } from '../types';

export interface UseChatComposerOptions {
  defaultTool?: ChatTool;
  defaultModel?: SelectedModel;
}

export interface UseChatComposerReturn {
  // 입력 상태
  input: string;
  setInput: (value: string) => void;

  // 파일 상태
  uploadedImages: string[];
  imageFiles: File[];
  gcodeFile: File | null;
  gcodeContent: string | null;

  // 도구/모델 선택
  selectedTool: ChatTool | null;
  selectedModel: SelectedModel;
  setSelectedTool: (tool: ChatTool | null) => void;
  setSelectedModel: (model: SelectedModel) => void;

  // 파일 관리
  addImages: (images: string[], files: File[]) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  setGcodeFile: (file: File | null, content?: string | null) => void;
  clearGcodeFile: () => void;

  // 유틸리티
  canSend: (isLoading: boolean) => boolean;
  getChatMode: () => ChatMode;
  getToolType: () => ChatTool;
  clearAll: () => void;

  // 전송 후 초기화
  resetAfterSend: () => void;
}

/**
 * 도구 타입 결정
 */
const detectToolType = (
  selectedTool: ChatTool | null,
  uploadedImages: string[],
  gcodeFile: File | null
): ChatTool => {
  if (selectedTool === 'modeling') return 'modeling';
  if (selectedTool === 'price_comparison') return 'price_comparison';
  if (selectedTool === 'troubleshoot' || uploadedImages.length > 0) return 'troubleshoot';
  if (selectedTool === 'gcode' || gcodeFile) return 'gcode';
  return 'general';
};

/**
 * 채팅 모드 결정
 */
const determineChatMode = (
  selectedTool: ChatTool | null,
  hasImages: boolean,
  hasGcode: boolean
): ChatMode => {
  if (selectedTool === 'modeling') return 'modeling';
  if (hasImages || selectedTool === 'troubleshoot') return 'troubleshoot';
  if (hasGcode || selectedTool === 'gcode') return 'gcode';
  return 'general';
};

/**
 * 채팅 입력 컴포저 훅
 */
export function useChatComposer({
  defaultTool = null,
  defaultModel = { provider: 'google', model: 'gemini-2.5-flash-lite' },
}: UseChatComposerOptions = {}): UseChatComposerReturn {
  // 입력 상태
  const [input, setInput] = useState('');

  // 파일 상태
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [gcodeFile, setGcodeFileState] = useState<File | null>(null);
  const [gcodeContent, setGcodeContent] = useState<string | null>(null);

  // 도구/모델 선택
  const [selectedTool, setSelectedTool] = useState<ChatTool | null>(defaultTool);
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(defaultModel);

  /**
   * 이미지 추가
   */
  const addImages = useCallback((images: string[], files: File[]) => {
    setUploadedImages((prev) => [...prev, ...images]);
    setImageFiles((prev) => [...prev, ...files]);
  }, []);

  /**
   * 이미지 제거
   */
  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * 이미지 전체 제거
   */
  const clearImages = useCallback(() => {
    setUploadedImages([]);
    setImageFiles([]);
  }, []);

  /**
   * G-code 파일 설정
   */
  const setGcodeFile = useCallback((file: File | null, content?: string | null) => {
    setGcodeFileState(file);
    setGcodeContent(content ?? null);
  }, []);

  /**
   * G-code 파일 제거
   */
  const clearGcodeFile = useCallback(() => {
    setGcodeFileState(null);
    setGcodeContent(null);
  }, []);

  /**
   * 전송 가능 여부 확인
   */
  const canSend = useCallback(
    (isLoading: boolean): boolean => {
      const hasContent = input.trim() || uploadedImages.length > 0 || gcodeFile;
      return Boolean(hasContent) && !isLoading;
    },
    [input, uploadedImages.length, gcodeFile]
  );

  /**
   * 채팅 모드 반환
   */
  const getChatMode = useCallback((): ChatMode => {
    return determineChatMode(
      selectedTool,
      imageFiles.length > 0,
      gcodeFile !== null
    );
  }, [selectedTool, imageFiles.length, gcodeFile]);

  /**
   * 도구 타입 반환
   */
  const getToolType = useCallback((): ChatTool => {
    return detectToolType(selectedTool, uploadedImages, gcodeFile);
  }, [selectedTool, uploadedImages, gcodeFile]);

  /**
   * 전체 초기화
   */
  const clearAll = useCallback(() => {
    setInput('');
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFileState(null);
    setGcodeContent(null);
    setSelectedTool(null);
  }, []);

  /**
   * 전송 후 초기화
   */
  const resetAfterSend = useCallback(() => {
    setInput('');
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFileState(null);
    setGcodeContent(null);
    // 도구 선택은 유지할 수 있음 (사용자 경험 향상)
  }, []);

  return {
    input,
    setInput,
    uploadedImages,
    imageFiles,
    gcodeFile,
    gcodeContent,
    selectedTool,
    selectedModel,
    setSelectedTool,
    setSelectedModel,
    addImages,
    removeImage,
    clearImages,
    setGcodeFile,
    clearGcodeFile,
    canSend,
    getChatMode,
    getToolType,
    clearAll,
    resetAfterSend,
  };
}

export default useChatComposer;
