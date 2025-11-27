/**
 * API Keys Service
 *
 * API 키 생성, 조회, 삭제 기능 제공
 * - 키는 생성 시에만 한 번 표시됨 (저장 필요)
 * - 서버에는 해시된 값만 저장됨
 */

import { supabase } from '../../integrations/supabase/client';

// API 키 타입 정의
export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyResult {
  success: boolean;
  apiKey?: string; // 원본 키 (한 번만 표시)
  keyData?: ApiKey;
  error?: string;
}

/**
 * 랜덤 API 키 생성 (32바이트 = 64자 hex)
 */
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `fk_live_${hex}`;
}

/**
 * SHA-256 해시 생성
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 새 API 키 생성
 */
export async function createApiKey(
  name: string,
  permissions: string[] = ['read'],
  expiresAt?: Date
): Promise<CreateApiKeyResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // 키 생성
    const apiKey = generateApiKey();
    const keyHash = await hashKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12); // "fk_live_xxxx"

    // DB에 저장
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions,
        expires_at: expiresAt?.toISOString() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[API_KEYS] Create error:', error);
      if (error.code === '23505') {
        return { success: false, error: '동일한 이름의 API 키가 이미 존재합니다.' };
      }
      return { success: false, error: 'API 키 생성에 실패했습니다.' };
    }

    return {
      success: true,
      apiKey, // 원본 키 (이 시점에만 확인 가능)
      keyData: data as ApiKey,
    };
  } catch (error) {
    console.error('[API_KEYS] Create error:', error);
    return { success: false, error: 'API 키 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 사용자의 모든 API 키 조회
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API_KEYS] Fetch error:', error);
      return [];
    }

    return (data || []) as ApiKey[];
  } catch (error) {
    console.error('[API_KEYS] Fetch error:', error);
    return [];
  }
}

/**
 * API 키 삭제
 */
export async function deleteApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API_KEYS] Delete error:', error);
      return { success: false, error: 'API 키 삭제에 실패했습니다.' };
    }

    return { success: true };
  } catch (error) {
    console.error('[API_KEYS] Delete error:', error);
    return { success: false, error: 'API 키 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * API 키 비활성화/활성화 토글
 */
export async function toggleApiKeyStatus(
  keyId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: isActive })
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API_KEYS] Toggle error:', error);
      return { success: false, error: 'API 키 상태 변경에 실패했습니다.' };
    }

    return { success: true };
  } catch (error) {
    console.error('[API_KEYS] Toggle error:', error);
    return { success: false, error: 'API 키 상태 변경 중 오류가 발생했습니다.' };
  }
}

/**
 * API 키 이름 변경
 */
export async function renameApiKey(
  keyId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ name: newName })
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[API_KEYS] Rename error:', error);
      if (error.code === '23505') {
        return { success: false, error: '동일한 이름의 API 키가 이미 존재합니다.' };
      }
      return { success: false, error: 'API 키 이름 변경에 실패했습니다.' };
    }

    return { success: true };
  } catch (error) {
    console.error('[API_KEYS] Rename error:', error);
    return { success: false, error: 'API 키 이름 변경 중 오류가 발생했습니다.' };
  }
}
