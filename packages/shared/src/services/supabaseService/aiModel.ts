import { SupabaseClient } from '@supabase/supabase-js';
import {
  AIGeneratedModel,
  ModelPrintHistory,
  UserModelStats,
  CreateModelRequest,
  PrintSettings,
  PrintStatus,
} from '../../types/aiModelType';
import { Paginated } from '../../types/commonType';

/**
 * AI 생성 모델 관련 Supabase 서비스
 * Web과 Mobile에서 공통으로 사용
 */

// ============================================================================
// AI Generated Models CRUD
// ============================================================================

/**
 * AI 모델 생성
 */
export async function createAIModel(
  supabase: SupabaseClient,
  data: CreateModelRequest,
  userId: string
): Promise<AIGeneratedModel> {
  const { data: model, error } = await supabase
    .from('ai_generated_models')
    .insert({
      user_id: userId,
      generation_type: data.generation_type,
      prompt: data.prompt,
      source_image_url: data.source_image_url,
      art_style: data.art_style,
      target_polycount: data.target_polycount,
      symmetry_mode: data.symmetry_mode,
      model_name: data.model_name,
      file_format: 'glb',
      storage_path: '', // 초기에는 빈 값, 파일 업로드 후 업데이트
      status: 'processing',
    })
    .select()
    .single();

  if (error) throw error;
  return model;
}

/**
 * AI 모델 조회 (단일)
 */
export async function getAIModel(
  supabase: SupabaseClient,
  modelId: string
): Promise<AIGeneratedModel | null> {
  const { data, error } = await supabase
    .from('ai_generated_models')
    .select('*')
    .eq('id', modelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * AI 모델 목록 조회 (페이지네이션)
 */
export async function listAIModels(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    generation_type?: string;
    is_favorite?: boolean;
    tags?: string[];
  }
): Promise<Paginated<AIGeneratedModel>> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('ai_generated_models')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.generation_type) {
    query = query.eq('generation_type', options.generation_type);
  }

  if (options?.is_favorite !== undefined) {
    query = query.eq('is_favorite', options.is_favorite);
  }

  if (options?.tags && options.tags.length > 0) {
    query = query.contains('tags', options.tags);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * 공개 AI 모델 목록 조회 (갤러리용)
 */
export async function listPublicAIModels(
  supabase: SupabaseClient,
  options?: {
    page?: number;
    pageSize?: number;
    generation_type?: string;
  }
): Promise<Paginated<AIGeneratedModel>> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('ai_generated_models')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (options?.generation_type) {
    query = query.eq('generation_type', options.generation_type);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * AI 모델 업데이트
 */
export async function updateAIModel(
  supabase: SupabaseClient,
  modelId: string,
  updates: Partial<AIGeneratedModel>
): Promise<AIGeneratedModel> {
  const { data, error } = await supabase
    .from('ai_generated_models')
    .update(updates)
    .eq('id', modelId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * AI 모델 삭제
 */
export async function deleteAIModel(
  supabase: SupabaseClient,
  modelId: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_generated_models')
    .delete()
    .eq('id', modelId);

  if (error) throw error;
}

/**
 * AI 모델 즐겨찾기 토글
 */
export async function toggleFavoriteAIModel(
  supabase: SupabaseClient,
  modelId: string,
  isFavorite: boolean
): Promise<void> {
  const { error } = await supabase
    .from('ai_generated_models')
    .update({ is_favorite: isFavorite })
    .eq('id', modelId);

  if (error) throw error;
}

// ============================================================================
// Model Print History
// ============================================================================

/**
 * 출력 이력 생성
 */
export async function createPrintHistory(
  supabase: SupabaseClient,
  data: {
    model_id: string;
    printer_id?: string;
    user_id: string;
    print_settings?: PrintSettings;
    gcode_file_id?: string;
  }
): Promise<ModelPrintHistory> {
  const { data: history, error } = await supabase
    .from('model_print_history')
    .insert({
      model_id: data.model_id,
      printer_id: data.printer_id,
      user_id: data.user_id,
      print_settings: data.print_settings,
      gcode_file_id: data.gcode_file_id,
      print_status: 'queued',
    })
    .select()
    .single();

  if (error) throw error;

  // 모델의 출력 횟수 증가
  await incrementPrintCount(supabase, data.model_id);

  return history;
}

/**
 * 출력 이력 조회 (특정 모델)
 */
export async function getModelPrintHistory(
  supabase: SupabaseClient,
  modelId: string
): Promise<ModelPrintHistory[]> {
  const { data, error } = await supabase
    .from('model_print_history')
    .select('*')
    .eq('model_id', modelId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * 출력 이력 조회 (사용자 전체)
 */
export async function getUserPrintHistory(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<Paginated<ModelPrintHistory>> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('model_print_history')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * 출력 이력 상태 업데이트
 */
export async function updatePrintHistoryStatus(
  supabase: SupabaseClient,
  historyId: string,
  status: PrintStatus,
  updates?: {
    print_time?: string;
    filament_used?: number;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
  }
): Promise<ModelPrintHistory> {
  const { data, error } = await supabase
    .from('model_print_history')
    .update({
      print_status: status,
      ...updates,
    })
    .eq('id', historyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 모델 출력 횟수 증가
 */
async function incrementPrintCount(
  supabase: SupabaseClient,
  modelId: string
): Promise<void> {
  const { error } = await supabase.rpc('increment_print_count', {
    model_id: modelId,
  });

  if (error) throw error;
}

/**
 * 사용자 모델 통계 조회
 */
export async function getUserModelStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserModelStats> {
  const { data, error } = await supabase.rpc('get_user_model_stats', {
    p_user_id: userId,
  });

  if (error) throw error;

  return data[0] || {
    total_models: 0,
    total_storage_bytes: 0,
    favorite_count: 0,
    public_count: 0,
    total_prints: 0,
  };
}

/**
 * 태그로 모델 검색
 */
export async function searchModelsByTag(
  supabase: SupabaseClient,
  userId: string,
  tag: string
): Promise<AIGeneratedModel[]> {
  const { data, error } = await supabase
    .from('ai_generated_models')
    .select('*')
    .eq('user_id', userId)
    .contains('tags', [tag])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * 모델 이름으로 검색
 */
export async function searchModelsByName(
  supabase: SupabaseClient,
  userId: string,
  searchTerm: string
): Promise<AIGeneratedModel[]> {
  const { data, error } = await supabase
    .from('ai_generated_models')
    .select('*')
    .eq('user_id', userId)
    .ilike('model_name', `%${searchTerm}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
