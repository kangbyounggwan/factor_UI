import { useState, useCallback, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  uploadSourceImage,
  listUserSourceImages,
  deleteStorageFile,
} from '../services/supabaseService/aiStorage';
import { validateImageFile } from '../utils/imageValidation';

export interface UploadedFile {
  id: number;
  name: string;
  size: number;
  type: string;
  url: string;
  file?: File;
  storagePath?: string;
  created_at?: string;
}

export interface UseAIImageUploadProps {
  supabase: SupabaseClient;
  userId?: string;
  onSuccess?: (file: UploadedFile) => void;
  onError?: (error: Error) => void;
  onDelete?: (fileId: number) => void;
}

export interface UseAIImageUploadReturn {
  uploadedFiles: UploadedFile[];
  selectedImageId: number | null;
  isUploading: boolean;
  handleFileUpload: (file: File) => Promise<UploadedFile>;
  handleFilesUpload: (files: FileList | File[]) => Promise<void>;
  removeFile: (fileId: number) => Promise<void>;
  selectImage: (id: number) => void;
  getSelectedFile: () => UploadedFile | null;
  loadStoredImages: () => Promise<void>;
  clearFiles: () => void;
}

/**
 * AI 이미지 업로드 관리를 위한 커스텀 훅
 * 웹과 모바일에서 공통으로 사용
 */
export function useAIImageUpload({
  supabase,
  userId,
  onSuccess,
  onError,
  onDelete,
}: UseAIImageUploadProps): UseAIImageUploadReturn {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Supabase Storage에서 저장된 이미지 로드
   */
  const loadStoredImages = useCallback(async () => {
    if (!userId) return;

    try {
      const images = await listUserSourceImages(supabase, userId);
      const mappedFiles: UploadedFile[] = images.map((img, index) => ({
        id: Date.now() + index,
        name: img.name,
        size: img.size,
        type: 'image/jpeg', // 기본값, 확장자로 추론 가능
        url: img.url,
        storagePath: img.path,
        created_at: img.created_at,
      }));

      setUploadedFiles(mappedFiles);
      if (mappedFiles.length > 0 && !selectedImageId) {
        setSelectedImageId(mappedFiles[0].id);
      }
    } catch (error) {
      console.error('[useAIImageUpload] Failed to load stored images:', error);

      // HTML 응답이 온 경우 더 자세한 로그
      if (error instanceof Error && error.message.includes('HTML')) {
        console.error('[useAIImageUpload] Received HTML instead of JSON - possible Storage bucket issue');
        console.error('[useAIImageUpload] Check if "ai-models" bucket exists and has correct permissions');
      }

      onError?.(error as Error);
    }
  }, [supabase, userId, selectedImageId, onError]);

  /**
   * 단일 파일 업로드
   */
  const handleFileUpload = useCallback(
    async (file: File) => {
      // 파일 검증
      const validation = validateImageFile(file);
      if (!validation.valid) {
        const error = new Error(validation.error);
        onError?.(error);
        throw error;
      }

      if (!userId) {
        const error = new Error('로그인이 필요합니다.');
        onError?.(error);
        throw error;
      }

      setIsUploading(true);

      try {
        // Supabase Storage에 업로드
        const { path, url } = await uploadSourceImage(supabase, userId, file);

        const newFile: UploadedFile = {
          id: Date.now(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: url,
          file: file,
          storagePath: path,
          created_at: new Date().toISOString(),
        };

        setUploadedFiles((prev) => [...prev, newFile]);
        setSelectedImageId(newFile.id);

        onSuccess?.(newFile);

        return newFile;
      } catch (error) {
        console.error('[useAIImageUpload] Upload failed:', error);
        onError?.(error as Error);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [supabase, userId, onSuccess, onError]
  );

  /**
   * 여러 파일 업로드
   */
  const handleFilesUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        await handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  /**
   * 파일 삭제
   */
  const removeFile = useCallback(
    async (fileId: number) => {
      const fileToRemove = uploadedFiles.find((file) => file.id === fileId);

      if (!fileToRemove) return;

      try {
        // Supabase Storage에서 삭제
        if (fileToRemove.storagePath) {
          await deleteStorageFile(supabase, fileToRemove.storagePath);
        }

        // 메모리 누수 방지: Object URL 해제 (blob URL인 경우)
        if (fileToRemove.url && fileToRemove.url.startsWith('blob:')) {
          URL.revokeObjectURL(fileToRemove.url);
        }

        const next = uploadedFiles.filter((file) => file.id !== fileId);
        setUploadedFiles(next);

        // 선택된 파일을 지웠다면 마지막 항목으로 선택 재설정
        if (selectedImageId === fileId) {
          setSelectedImageId(next.length > 0 ? next[next.length - 1].id : null);
        }

        onDelete?.(fileId);
      } catch (error) {
        console.error('[useAIImageUpload] Delete failed:', error);
        onError?.(error as Error);
        throw error;
      }
    },
    [supabase, uploadedFiles, selectedImageId, onDelete, onError]
  );

  /**
   * 이미지 선택
   */
  const selectImage = useCallback((id: number) => {
    setSelectedImageId(id);
  }, []);

  /**
   * 선택된 파일 가져오기
   */
  const getSelectedFile = useCallback(() => {
    if (selectedImageId === null) {
      return uploadedFiles.length > 0 ? uploadedFiles[uploadedFiles.length - 1] : null;
    }
    return uploadedFiles.find((f) => f.id === selectedImageId) || null;
  }, [uploadedFiles, selectedImageId]);

  /**
   * 모든 파일 클리어
   */
  const clearFiles = useCallback(() => {
    // blob URL 메모리 해제
    uploadedFiles.forEach((file) => {
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
      }
    });

    setUploadedFiles([]);
    setSelectedImageId(null);
  }, [uploadedFiles]);

  // 컴포넌트 마운트 시 저장된 이미지 로드
  useEffect(() => {
    loadStoredImages();
  }, [userId]); // loadStoredImages를 의존성에서 제거하여 무한 루프 방지

  // 컴포넌트 언마운트 시 메모리 정리
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
    };
  }, []); // 빈 배열로 언마운트 시에만 실행

  return {
    uploadedFiles,
    selectedImageId,
    isUploading,
    handleFileUpload,
    handleFilesUpload,
    removeFile,
    selectImage,
    getSelectedFile,
    loadStoredImages,
    clearFiles,
  };
}
