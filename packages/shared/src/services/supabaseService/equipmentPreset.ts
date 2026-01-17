/**
 * 장비 프리셋 서비스
 * - 사용자별 프린터/필라멘트/슬라이서 정보 저장
 * - 트러블슈팅 글 작성 시 빠르게 불러오기
 */
import { supabase } from '../../integrations/supabase/client';

// crypto.randomUUID() 폴백 (HTTP 환경에서도 작동)
function generateUUID(): string {
  // crypto.randomUUID()가 사용 가능하면 사용 (HTTPS 환경)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 폴백: Math.random() 기반 UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// 타입 정의
// ============================================================================

/** 프린터 정보 */
export interface PrinterInfo {
  model?: string;       // 프린터 모델명 (예: "Ender 3 V2")
  firmware?: string;    // 펌웨어 (예: "Klipper", "Marlin")
  nozzle_size?: string; // 노즐 크기 (예: "0.4mm")
  bed_type?: string;    // 베드 타입 (예: "PEI", "Glass")
}

/** 필라멘트 정보 */
export interface FilamentInfo {
  type?: string;        // 필라멘트 종류 (예: "PLA", "PETG")
  brand?: string;       // 브랜드 (예: "eSUN")
  dried?: boolean;      // 건조 여부
}

/** 슬라이서 정보 */
export interface SlicerInfo {
  name?: string;        // 슬라이서 이름 (예: "OrcaSlicer")
  profile?: string;     // 프로필 이름 (예: "0.2mm Quality")
}

/** 장비 프리셋 */
export interface EquipmentPreset {
  id: string;           // UUID
  name: string;         // 프리셋 이름 (예: "메인 프린터", "출장용")
  is_default: boolean;  // 기본 프리셋 여부
  printer: PrinterInfo;
  filament: FilamentInfo;
  slicer: SlicerInfo;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}

/** 프리셋 생성/수정 입력 */
export interface EquipmentPresetInput {
  name: string;
  is_default?: boolean;
  printer?: PrinterInfo;
  filament?: FilamentInfo;
  slicer?: SlicerInfo;
}

// ============================================================================
// CRUD 함수
// ============================================================================

/**
 * 사용자의 모든 장비 프리셋 조회
 */
export async function getEquipmentPresets(userId: string): Promise<EquipmentPreset[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('equipment_presets')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[equipmentPreset] Failed to get presets:', error);
    return [];
  }

  return (data?.equipment_presets as EquipmentPreset[]) || [];
}

/**
 * 기본 프리셋 조회 (is_default: true)
 */
export async function getDefaultEquipmentPreset(userId: string): Promise<EquipmentPreset | null> {
  const presets = await getEquipmentPresets(userId);
  return presets.find(p => p.is_default) || presets[0] || null;
}

/**
 * 특정 프리셋 조회
 */
export async function getEquipmentPresetById(userId: string, presetId: string): Promise<EquipmentPreset | null> {
  const presets = await getEquipmentPresets(userId);
  return presets.find(p => p.id === presetId) || null;
}

/**
 * 새 프리셋 추가
 */
export async function addEquipmentPreset(userId: string, input: EquipmentPresetInput): Promise<EquipmentPreset | null> {
  const presets = await getEquipmentPresets(userId);

  const now = new Date().toISOString();
  const newPreset: EquipmentPreset = {
    id: generateUUID(),
    name: input.name,
    is_default: input.is_default ?? (presets.length === 0), // 첫 프리셋은 자동으로 기본값
    printer: input.printer || {},
    filament: input.filament || {},
    slicer: input.slicer || {},
    created_at: now,
    updated_at: now,
  };

  // 새 프리셋이 기본값이면 기존 기본값 해제
  let updatedPresets = presets;
  if (newPreset.is_default) {
    updatedPresets = presets.map(p => ({ ...p, is_default: false }));
  }
  updatedPresets.push(newPreset);

  const { error } = await supabase
    .from('profiles')
    .update({ equipment_presets: updatedPresets })
    .eq('user_id', userId);

  if (error) {
    console.error('[equipmentPreset] Failed to add preset:', error);
    return null;
  }

  return newPreset;
}

/**
 * 프리셋 수정
 */
export async function updateEquipmentPreset(
  userId: string,
  presetId: string,
  input: Partial<EquipmentPresetInput>
): Promise<EquipmentPreset | null> {
  const presets = await getEquipmentPresets(userId);
  const index = presets.findIndex(p => p.id === presetId);

  if (index === -1) {
    console.error('[equipmentPreset] Preset not found:', presetId);
    return null;
  }

  const now = new Date().toISOString();
  const updatedPreset: EquipmentPreset = {
    ...presets[index],
    ...(input.name !== undefined && { name: input.name }),
    ...(input.is_default !== undefined && { is_default: input.is_default }),
    ...(input.printer !== undefined && { printer: { ...presets[index].printer, ...input.printer } }),
    ...(input.filament !== undefined && { filament: { ...presets[index].filament, ...input.filament } }),
    ...(input.slicer !== undefined && { slicer: { ...presets[index].slicer, ...input.slicer } }),
    updated_at: now,
  };

  // 수정된 프리셋이 기본값이면 다른 프리셋의 기본값 해제
  let updatedPresets = [...presets];
  if (input.is_default) {
    updatedPresets = presets.map(p => ({ ...p, is_default: false }));
  }
  updatedPresets[index] = updatedPreset;

  const { error } = await supabase
    .from('profiles')
    .update({ equipment_presets: updatedPresets })
    .eq('user_id', userId);

  if (error) {
    console.error('[equipmentPreset] Failed to update preset:', error);
    return null;
  }

  return updatedPreset;
}

/**
 * 프리셋 삭제
 */
export async function deleteEquipmentPreset(userId: string, presetId: string): Promise<boolean> {
  const presets = await getEquipmentPresets(userId);
  const index = presets.findIndex(p => p.id === presetId);

  if (index === -1) {
    console.error('[equipmentPreset] Preset not found:', presetId);
    return false;
  }

  const deletedPreset = presets[index];
  const updatedPresets = presets.filter(p => p.id !== presetId);

  // 삭제된 프리셋이 기본값이었으면 첫 번째 프리셋을 기본값으로 설정
  if (deletedPreset.is_default && updatedPresets.length > 0) {
    updatedPresets[0].is_default = true;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ equipment_presets: updatedPresets })
    .eq('user_id', userId);

  if (error) {
    console.error('[equipmentPreset] Failed to delete preset:', error);
    return false;
  }

  return true;
}

/**
 * 프리셋을 기본값으로 설정
 */
export async function setDefaultEquipmentPreset(userId: string, presetId: string): Promise<boolean> {
  const presets = await getEquipmentPresets(userId);

  if (!presets.find(p => p.id === presetId)) {
    console.error('[equipmentPreset] Preset not found:', presetId);
    return false;
  }

  const now = new Date().toISOString();
  const updatedPresets = presets.map(p => ({
    ...p,
    is_default: p.id === presetId,
    updated_at: p.id === presetId ? now : p.updated_at,
  }));

  const { error } = await supabase
    .from('profiles')
    .update({ equipment_presets: updatedPresets })
    .eq('user_id', userId);

  if (error) {
    console.error('[equipmentPreset] Failed to set default preset:', error);
    return false;
  }

  return true;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 프리셋에서 TroubleshootingMeta 형태로 변환
 * CreatePost에서 바로 사용 가능
 */
export function presetToTroubleshootingMeta(preset: EquipmentPreset) {
  return {
    printer_model: preset.printer.model,
    firmware: preset.printer.firmware,
    nozzle_size: preset.printer.nozzle_size,
    bed_type: preset.printer.bed_type,
    filament_type: preset.filament.type,
    filament_brand: preset.filament.brand,
    filament_dried: preset.filament.dried,
    slicer: preset.slicer.name,
    slicer_profile: preset.slicer.profile,
  };
}

/**
 * TroubleshootingMeta에서 프리셋 형태로 변환
 * 현재 입력 내용을 프리셋으로 저장할 때 사용
 */
export function troubleshootingMetaToPresetInput(
  name: string,
  meta: {
    printer_model?: string;
    firmware?: string;
    nozzle_size?: string;
    bed_type?: string;
    filament_type?: string;
    filament_brand?: string;
    filament_dried?: boolean;
    slicer?: string;
    slicer_profile?: string;
  }
): EquipmentPresetInput {
  return {
    name,
    printer: {
      model: meta.printer_model,
      firmware: meta.firmware,
      nozzle_size: meta.nozzle_size,
      bed_type: meta.bed_type,
    },
    filament: {
      type: meta.filament_type,
      brand: meta.filament_brand,
      dried: meta.filament_dried,
    },
    slicer: {
      name: meta.slicer,
      profile: meta.slicer_profile,
    },
  };
}
