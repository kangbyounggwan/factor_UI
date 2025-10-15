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
 * 전체 워크플로우 실행 (3단계 통합)
 * 각 단계별 상태를 추적하는 커스텀 훅
 */
export function useAIWorkflow(supabase: SupabaseClient) {
  const queryClient = useQueryClient();
  const createModel = useCreateAIModel(supabase);
  const updateModel = useUpdateAIModel(supabase);

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
      // 1. DB에 모델 레코드 생성 (status: processing)
      const model = await createModel.mutateAsync({
        data: {
          generation_type: request.generation_type,
          prompt: request.prompt,
          source_image_url: typeof request.image === 'string' ? request.image : undefined,
          model_name: modelName,
        },
        userId,
      });

      // 2. 워크플로우 실행
      const result = await aiWorkflowApi.runCompleteWorkflow(request, {
        // Step 1 완료: 모델 URL 업데이트
        onModellingComplete: async (modellingResult) => {
          await updateModel.mutateAsync({
            modelId: model.id,
            updates: {
              storage_path: modellingResult.model_url,
              download_url: modellingResult.model_url,
              model_dimensions: modellingResult.dimensions,
              generation_metadata: modellingResult.metadata,
            },
          });
        },

        // Step 2 완료: 최적화된 모델 URL 업데이트
        onOptimizationComplete: async (optimizationResult) => {
          await updateModel.mutateAsync({
            modelId: model.id,
            updates: {
              storage_path: optimizationResult.optimized_url,
              download_url: optimizationResult.optimized_url,
              file_size: optimizationResult.file_size,
              file_format: optimizationResult.format,
            },
          });
        },

        // Step 3 완료: 상태를 completed로 변경
        onGcodeGenerationComplete: async () => {
          await updateModel.mutateAsync({
            modelId: model.id,
            updates: {
              status: 'completed',
            },
          });
        },

        // 에러 발생 시: 상태를 failed로 변경
        onError: async (error) => {
          await updateModel.mutateAsync({
            modelId: model.id,
            updates: {
              status: 'failed',
              generation_metadata: {
                error: error.message,
              },
            },
          });
        },
      });

      return {
        model,
        workflow: result,
      };
    },
  });
}
