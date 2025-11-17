/**
 * AI 모델 관련 React Query hooks
 * Web과 Mobile에서 공통으로 사용
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  AIGeneratedModel,
  ModelPrintHistory,
  UserModelStats,
  CreateModelRequest,
  ProcessModellingRequest,
  OptimizeModelRequest,
  GenerateGcodeRequest,
  PrintStatus,
  AIWorkflowState,
  WorkflowStep,
  WorkflowStepStatus,
} from '../types/aiModelType';
import { Paginated } from '../types/commonType';
import * as aiModelService from '../services/supabaseService/aiModel';
import * as aiWorkflowApi from '../api/aiWorkflow';

// ============================================================================
// Query Keys
// ============================================================================

export const aiModelKeys = {
  all: ['aiModels'] as const,
  lists: () => [...aiModelKeys.all, 'list'] as const,
  list: (userId: string, filters?: any) => [...aiModelKeys.lists(), userId, filters] as const,
  details: () => [...aiModelKeys.all, 'detail'] as const,
  detail: (id: string) => [...aiModelKeys.details(), id] as const,
  stats: (userId: string) => [...aiModelKeys.all, 'stats', userId] as const,
  printHistory: (modelId: string) => [...aiModelKeys.all, 'printHistory', modelId] as const,
  userPrintHistory: (userId: string) => [...aiModelKeys.all, 'userPrintHistory', userId] as const,
  publicModels: (filters?: any) => [...aiModelKeys.all, 'public', filters] as const,
  workflow: (modelId: string) => [...aiModelKeys.all, 'workflow', modelId] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * AI 모델 목록 조회
 */
export function useAIModels(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    generation_type?: string;
    is_favorite?: boolean;
    tags?: string[];
  }
) {
  return useQuery({
    queryKey: aiModelKeys.list(userId, options),
    queryFn: () => aiModelService.listAIModels(supabase, userId, options),
    enabled: !!userId,
  });
}

/**
 * AI 모델 상세 조회
 */
export function useAIModel(
  supabase: SupabaseClient,
  modelId: string,
  options?: UseQueryOptions<AIGeneratedModel | null>
) {
  return useQuery({
    queryKey: aiModelKeys.detail(modelId),
    queryFn: () => aiModelService.getAIModel(supabase, modelId),
    enabled: !!modelId,
    ...options,
  });
}

/**
 * 공개 AI 모델 목록 조회 (갤러리)
 */
export function usePublicAIModels(
  supabase: SupabaseClient,
  options?: {
    page?: number;
    pageSize?: number;
    generation_type?: string;
  }
) {
  return useQuery({
    queryKey: aiModelKeys.publicModels(options),
    queryFn: () => aiModelService.listPublicAIModels(supabase, options),
  });
}

/**
 * 사용자 모델 통계 조회
 */
export function useUserModelStats(supabase: SupabaseClient, userId: string) {
  return useQuery({
    queryKey: aiModelKeys.stats(userId),
    queryFn: () => aiModelService.getUserModelStats(supabase, userId),
    enabled: !!userId,
  });
}

/**
 * 모델 출력 이력 조회
 */
export function useModelPrintHistory(supabase: SupabaseClient, modelId: string) {
  return useQuery({
    queryKey: aiModelKeys.printHistory(modelId),
    queryFn: () => aiModelService.getModelPrintHistory(supabase, modelId),
    enabled: !!modelId,
  });
}

/**
 * 사용자 출력 이력 조회
 */
export function useUserPrintHistory(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
) {
  return useQuery({
    queryKey: aiModelKeys.userPrintHistory(userId),
    queryFn: () => aiModelService.getUserPrintHistory(supabase, userId, options),
    enabled: !!userId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * AI 모델 생성
 */
export function useCreateAIModel(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, userId }: { data: CreateModelRequest; userId: string }) =>
      aiModelService.createAIModel(supabase, data, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.list(variables.userId) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.stats(variables.userId) });
    },
  });
}

/**
 * AI 모델 업데이트
 */
export function useUpdateAIModel(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modelId, updates }: { modelId: string; updates: Partial<AIGeneratedModel> }) =>
      aiModelService.updateAIModel(supabase, modelId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.lists() });
    },
  });
}

/**
 * AI 모델 삭제
 */
export function useDeleteAIModel(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: string) => aiModelService.deleteAIModel(supabase, modelId),
    onSuccess: (_, modelId) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.lists() });
      queryClient.removeQueries({ queryKey: aiModelKeys.detail(modelId) });
    },
  });
}

/**
 * 즐겨찾기 토글
 */
export function useToggleFavoriteAIModel(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modelId, isFavorite }: { modelId: string; isFavorite: boolean }) =>
      aiModelService.toggleFavoriteAIModel(supabase, modelId, isFavorite),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.detail(variables.modelId) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.lists() });
    },
  });
}

/**
 * 출력 이력 생성
 */
export function useCreatePrintHistory(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      model_id: string;
      printer_id?: string;
      user_id: string;
      print_settings?: any;
      gcode_file_id?: string;
    }) => aiModelService.createPrintHistory(supabase, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.printHistory(variables.model_id) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.userPrintHistory(variables.user_id) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.detail(variables.model_id) });
    },
  });
}

/**
 * 출력 이력 상태 업데이트
 */
export function useUpdatePrintHistoryStatus(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      historyId,
      status,
      updates,
    }: {
      historyId: string;
      status: PrintStatus;
      updates?: any;
    }) => aiModelService.updatePrintHistoryStatus(supabase, historyId, status, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: aiModelKeys.printHistory(data.model_id) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.userPrintHistory(data.user_id) });
    },
  });
}

// ============================================================================
// AI Workflow Mutations
// ============================================================================

/**
 * Step 1: 3D 모델 생성
 */
export function useProcessModelling() {
  return useMutation({
    mutationFn: (request: ProcessModellingRequest) => aiWorkflowApi.processModelling(request),
  });
}

/**
 * Step 2: 모델 최적화
 */
export function useOptimizeModel() {
  return useMutation({
    mutationFn: (request: OptimizeModelRequest) => aiWorkflowApi.optimizeModel(request),
  });
}

/**
 * Step 3: G-code 생성
 */
export function useGenerateGcode() {
  return useMutation({
    mutationFn: (request: GenerateGcodeRequest) => aiWorkflowApi.generateGcode(request),
  });
}

/**
 * AI 모델 생성 워크플로우 (비동기 처리)
 *
 * 변경 사항:
 * - DB 저장은 AI 서버에서 자동으로 처리
 * - 프론트엔드는 AI 서버에 비동기 요청만 전송
 * - MQTT 알림으로 완료 확인 (ai/model/completed/{user_id} 토픽 구독)
 * - 완료되면 DB에서 조회
 */
export function useAIWorkflow(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      request,
      userId,
      modelName,
    }: {
      request: ProcessModellingRequest & { printer_id: string };
      userId: string;
      modelName: string;
    }) => {
      // AI 서버에 비동기 모델 생성 요청
      // AI 서버가 자동으로 DB에 저장하고 MQTT로 알림
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('인증이 필요합니다');
      }

      const formData = new FormData();

      if (request.generation_type === 'text_to_3d' && request.prompt) {
        formData.append('task', 'text_to_3d');
        formData.append('prompt', request.prompt);
      } else if (request.generation_type === 'image_to_3d' && request.image) {
        formData.append('task', 'image_to_3d');
        if (request.image instanceof File) {
          formData.append('image_file', request.image);
        }
      }

      // 메타데이터 추가
      const metadata = {
        model_name: modelName,
      };
      formData.append('json', JSON.stringify(metadata));

      const AI_API_BASE_URL = import.meta.env?.VITE_AI_PYTHON_URL || 'http://127.0.0.1:7000';

      const response = await fetch(`${AI_API_BASE_URL}/v1/process/modelling?async_mode=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`AI 모델 생성 요청 실패: ${error.message || response.statusText}`);
      }

      const result = await response.json();
      const taskId = result.data?.task_id;

      if (!taskId) {
        throw new Error('task_id를 받지 못했습니다');
      }

      // AI 모델 목록 캐시 무효화 (백그라운드에서 새로운 모델이 추가될 예정)
      queryClient.invalidateQueries({ queryKey: aiModelKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: aiModelKeys.stats(userId) });

      return {
        task_id: taskId,
        message: '모델 생성이 시작되었습니다. MQTT 알림으로 완료를 확인하세요.',
      };
    },
  });
}
