/**
 * 파일 업로드 관리 훅
 * - 이미지 업로드/제거
 * - G-code 파일 업로드/제거
 * - 드래그 앤 드롭 핸들러
 * - 클립보드 붙여넣기 핸들러
 */

import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export interface UseFileUploadOptions {
  onImageUpload?: (images: string[], files: File[]) => void;
  onGcodeUpload?: (file: File, content: string) => void;
  onClear?: () => void;
}

export interface UseFileUploadReturn {
  // 이미지 상태
  uploadedImages: string[];
  imageFiles: File[];

  // G-code 상태
  gcodeFile: File | null;
  gcodeFileContent: string | null;

  // 드래그 상태
  isDragging: boolean;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  gcodeInputRef: React.RefObject<HTMLInputElement | null>;

  // 핸들러
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGcodeUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeImage: (index: number) => void;
  removeGcodeFile: () => void;
  clearAllFiles: () => void;

  // 드래그 앤 드롭 핸들러
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;

  // 붙여넣기 핸들러
  handlePaste: (e: React.ClipboardEvent) => void;

  // 상태 설정 (외부에서 초기화 필요 시)
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setGcodeFile: React.Dispatch<React.SetStateAction<File | null>>;
  setGcodeFileContent: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useFileUpload(options?: UseFileUploadOptions): UseFileUploadReturn {
  const { t } = useTranslation();
  const { toast } = useToast();

  // 이미지 상태
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // G-code 상태
  const [gcodeFile, setGcodeFile] = useState<File | null>(null);
  const [gcodeFileContent, setGcodeFileContent] = useState<string | null>(null);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gcodeInputRef = useRef<HTMLInputElement | null>(null);

  // 이미지 파일 처리 공통 함수
  const processImageFile = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      setImageFiles((prev) => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 이미지 업로드 처리
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      processImageFile(file);
    });

    e.target.value = "";
  }, [processImageFile]);

  // G-code 파일 업로드 처리
  const handleGcodeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.gcode') || file.name.endsWith('.gco'))) {
      setGcodeFile(file);
      // 파일 내용 읽기 (코드 수정 컨텍스트용)
      try {
        const content = await file.text();
        setGcodeFileContent(content);
        options?.onGcodeUpload?.(file, content);
      } catch (err) {
        console.error('[useFileUpload] Failed to read gcode file content:', err);
      }
      toast({
        title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
        description: file.name,
      });
    }
    e.target.value = "";
  }, [toast, t, options]);

  // 이미지 제거
  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // G-code 파일 제거
  const removeGcodeFile = useCallback(() => {
    setGcodeFile(null);
    setGcodeFileContent(null);
  }, []);

  // 모든 파일 초기화
  const clearAllFiles = useCallback(() => {
    setUploadedImages([]);
    setImageFiles([]);
    setGcodeFile(null);
    setGcodeFileContent(null);
    options?.onClear?.();
  }, [options]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else if (file.name.endsWith('.gcode') || file.name.endsWith('.gco')) {
        setGcodeFile(file);
        // 파일 내용 읽기 (코드 수정 컨텍스트용)
        try {
          const content = await file.text();
          setGcodeFileContent(content);
          options?.onGcodeUpload?.(file, content);
        } catch (err) {
          console.error('[useFileUpload] Failed to read gcode file content:', err);
        }
        toast({
          title: t('aiChat.gcodeUploaded', 'G-code 파일 업로드됨'),
          description: file.name,
        });
      }
    }
  }, [processImageFile, toast, t, options]);

  // 클립보드 붙여넣기 핸들러
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
        }
      }
    }
  }, [processImageFile]);

  return {
    // 상태
    uploadedImages,
    imageFiles,
    gcodeFile,
    gcodeFileContent,
    isDragging,

    // Refs
    fileInputRef,
    gcodeInputRef,

    // 핸들러
    handleImageUpload,
    handleGcodeUpload,
    removeImage,
    removeGcodeFile,
    clearAllFiles,

    // 드래그 앤 드롭
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,

    // 붙여넣기
    handlePaste,

    // 상태 설정 함수 (외부에서 직접 초기화 필요 시)
    setUploadedImages,
    setImageFiles,
    setGcodeFile,
    setGcodeFileContent,
  };
}
