/**
 * G-code 세그먼트 데이터 서비스
 * 3D 뷰어용 세그먼트 데이터 저장/조회
 */

import { supabase } from '@shared/integrations/supabase/client';
import type { GCodeAnalysisResponse, LayerSegmentData, TemperatureData } from '@/lib/api/gcode';

// ============================================================================
// Types
// ============================================================================

export interface SegmentMetadata {
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  layerCount: number;
  totalFilament: number;
  printTime: number;
  layerHeight: number;
  firstLayerHeight: number;
  estimatedTime: string;
  filamentType: string | null;
  slicer: string;
  slicerVersion: string | null;
}

export interface GCodeSegmentData {
  id: string;
  user_id: string;
  report_id: string | null;
  gcode_file_id: string | null;
  analysis_id: string | null;
  metadata: SegmentMetadata;
  temperatures: TemperatureData[];
  layers_storage_path: string | null;
  layer_count: number;
  total_extrusion_points: number;
  total_travel_points: number;
  has_wipe_data: boolean;
  has_support_data: boolean;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveSegmentDataInput {
  userId: string;
  reportId?: string;
  gcodeFileId?: string;
  analysisId?: string;
  segmentResponse: GCodeAnalysisResponse;
}

// ============================================================================
// Save Segment Data
// ============================================================================

/**
 * 세그먼트 데이터 저장
 * 1. 메타데이터와 온도 데이터는 DB에 직접 저장
 * 2. 레이어 데이터(Base64)는 Storage에 JSON으로 저장
 */
export async function saveSegmentData(input: SaveSegmentDataInput): Promise<{
  data: GCodeSegmentData | null;
  error: Error | null;
}> {
  const { userId, reportId, gcodeFileId, analysisId, segmentResponse } = input;

  try {
    const segments = segmentResponse.segments;

    // 레이어 통계 계산
    let totalExtrusionPoints = 0;
    let totalTravelPoints = 0;
    let hasWipeData = false;
    let hasSupportData = false;

    for (const layer of segments.layers) {
      totalExtrusionPoints += layer.extrusionCount || 0;
      totalTravelPoints += layer.travelCount || 0;
      if (layer.wipeData && layer.wipeCount && layer.wipeCount > 0) hasWipeData = true;
      if (layer.supportData && layer.supportCount && layer.supportCount > 0) hasSupportData = true;
    }

    // 1. DB에 메타데이터 레코드 생성 (Storage 경로는 나중에 업데이트)
    const { data: insertedData, error: insertError } = await supabase
      .from('gcode_segment_data')
      .insert({
        user_id: userId,
        report_id: reportId || null,
        gcode_file_id: gcodeFileId || null,
        analysis_id: analysisId || null,
        metadata: segments.metadata,
        temperatures: segments.temperatures || [],
        layer_count: segments.metadata.layerCount,
        total_extrusion_points: totalExtrusionPoints,
        total_travel_points: totalTravelPoints,
        has_wipe_data: hasWipeData,
        has_support_data: hasSupportData,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError || !insertedData) {
      console.error('[gcodeSegmentService] Insert error:', insertError);
      throw insertError || new Error('Failed to insert segment data');
    }

    const segmentId = insertedData.id;

    // 2. Storage에 레이어 데이터 저장
    const storagePath = `${userId}/${segmentId}.json`;
    const layersJson = JSON.stringify(segments.layers);
    const layersBlob = new Blob([layersJson], { type: 'application/json' });

    const { error: uploadError } = await supabase.storage
      .from('gcode-segments')
      .upload(storagePath, layersBlob, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error('[gcodeSegmentService] Storage upload error:', uploadError);
      // 업로드 실패 시 DB 레코드 상태 업데이트
      await supabase
        .from('gcode_segment_data')
        .update({ status: 'error', error_message: uploadError.message })
        .eq('id', segmentId);
      throw uploadError;
    }

    // 3. Storage 경로 업데이트 및 상태를 ready로 변경
    const { data: updatedData, error: updateError } = await supabase
      .from('gcode_segment_data')
      .update({
        layers_storage_path: storagePath,
        status: 'ready',
      })
      .eq('id', segmentId)
      .select()
      .single();

    if (updateError) {
      console.error('[gcodeSegmentService] Update error:', updateError);
      throw updateError;
    }

    // 4. report_id가 있으면 gcode_analysis_reports에 segment_data_id 연결
    if (reportId) {
      await supabase
        .from('gcode_analysis_reports')
        .update({ segment_data_id: segmentId })
        .eq('id', reportId);
    }

    console.log('[gcodeSegmentService] Segment data saved:', segmentId);

    return { data: updatedData as GCodeSegmentData, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Save error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================================================
// Get Segment Data
// ============================================================================

/**
 * 세그먼트 데이터 조회 (메타데이터만)
 */
export async function getSegmentDataById(segmentId: string): Promise<{
  data: GCodeSegmentData | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('gcode_segment_data')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (error) throw error;

    return { data: data as GCodeSegmentData, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Get by ID error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 보고서 ID로 세그먼트 데이터 조회
 * maybeSingle() 사용 - 데이터가 없으면 null 반환 (에러 없음)
 */
export async function getSegmentDataByReportId(reportId: string): Promise<{
  data: GCodeSegmentData | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('gcode_segment_data')
      .select('*')
      .eq('report_id', reportId)
      .maybeSingle();

    if (error) throw error;

    // 데이터가 없으면 null 반환 (정상 케이스)
    return { data: data as GCodeSegmentData | null, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Get by report ID error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 보고서 ID로 분석 ID만 조회 (AI 해결하기 API 호출용)
 */
export async function getAnalysisIdByReportId(reportId: string): Promise<{
  analysisId: string | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('gcode_segment_data')
      .select('analysis_id')
      .eq('report_id', reportId)
      .maybeSingle();

    if (error) throw error;

    return { analysisId: data?.analysis_id || null, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Get analysis ID error:', error);
    return { analysisId: null, error: error as Error };
  }
}

/**
 * 분석 ID로 세그먼트 데이터 ID 조회
 */
export async function getSegmentDataIdByAnalysisId(analysisId: string): Promise<{
  segmentDataId: string | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('gcode_segment_data')
      .select('id')
      .eq('analysis_id', analysisId)
      .maybeSingle();

    if (error) throw error;

    return { segmentDataId: data?.id || null, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Get segment data ID by analysis ID error:', error);
    return { segmentDataId: null, error: error as Error };
  }
}

/**
 * Storage에서 레이어 데이터 로드
 */
export async function loadLayersFromStorage(storagePath: string): Promise<{
  data: LayerSegmentData[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.storage
      .from('gcode-segments')
      .download(storagePath);

    if (error) throw error;

    const text = await data.text();
    const layers = JSON.parse(text) as LayerSegmentData[];

    return { data: layers, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Load layers error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 전체 세그먼트 데이터 로드 (메타데이터 + 레이어 데이터)
 */
export async function loadFullSegmentData(segmentId: string): Promise<{
  data: {
    metadata: SegmentMetadata;
    temperatures: TemperatureData[];
    layers: LayerSegmentData[];
  } | null;
  error: Error | null;
}> {
  try {
    // 1. DB에서 메타데이터 조회
    const { data: segmentData, error: dbError } = await getSegmentDataById(segmentId);
    if (dbError || !segmentData) {
      throw dbError || new Error('Segment data not found');
    }

    if (segmentData.status !== 'ready') {
      throw new Error(`Segment data not ready: ${segmentData.status}`);
    }

    // 2. Storage에서 레이어 데이터 로드
    if (!segmentData.layers_storage_path) {
      throw new Error('No layers storage path');
    }

    const { data: layers, error: storageError } = await loadLayersFromStorage(
      segmentData.layers_storage_path
    );

    if (storageError || !layers) {
      throw storageError || new Error('Failed to load layers');
    }

    return {
      data: {
        metadata: segmentData.metadata,
        temperatures: segmentData.temperatures,
        layers,
      },
      error: null,
    };
  } catch (error) {
    console.error('[gcodeSegmentService] Load full data error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 보고서 ID로 전체 세그먼트 데이터 로드
 */
export async function loadFullSegmentDataByReportId(reportId: string): Promise<{
  data: {
    metadata: SegmentMetadata;
    temperatures: TemperatureData[];
    layers: LayerSegmentData[];
    analysisId?: string;  // AI 해결하기 API 호출용
  } | null;
  error: Error | null;
}> {
  try {
    // 1. gcode_segment_data 테이블에서 report_id로 직접 조회 (효율적)
    const { data: segmentData, error: dbError } = await supabase
      .from('gcode_segment_data')
      .select('*')
      .eq('report_id', reportId)
      .maybeSingle();

    if (dbError || !segmentData) {
      console.log('[gcodeSegmentService] No segment data for report_id:', reportId);
      return { data: null, error: null };
    }

    if (segmentData.status !== 'ready') {
      console.log('[gcodeSegmentService] Segment data not ready:', segmentData.status);
      return { data: null, error: null };
    }

    // 2. Storage에서 레이어 데이터 로드
    if (!segmentData.layers_storage_path) {
      console.log('[gcodeSegmentService] No layers storage path');
      return { data: null, error: null };
    }

    const { data: layers, error: storageError } = await loadLayersFromStorage(
      segmentData.layers_storage_path
    );

    if (storageError || !layers) {
      throw storageError || new Error('Failed to load layers');
    }

    return {
      data: {
        metadata: segmentData.metadata,
        temperatures: segmentData.temperatures,
        layers,
        analysisId: segmentData.analysis_id || undefined,
      },
      error: null,
    };
  } catch (error) {
    console.error('[gcodeSegmentService] Load by report ID error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================================================
// Update Segment Data
// ============================================================================

/**
 * analysis_id로 세그먼트 데이터에 report_id 연결
 * 분석 완료 후 보고서가 저장되면 호출
 */
export async function linkSegmentToReport(
  analysisId: string,
  reportId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // 1. analysis_id로 세그먼트 데이터 찾기
    const { data: segmentData, error: findError } = await supabase
      .from('gcode_segment_data')
      .select('id')
      .eq('analysis_id', analysisId)
      .maybeSingle();

    if (findError) throw findError;

    if (!segmentData) {
      console.log('[gcodeSegmentService] No segment data found for analysis:', analysisId);
      return { success: false, error: null };
    }

    // 2. 세그먼트 데이터에 report_id 업데이트
    const { error: updateError } = await supabase
      .from('gcode_segment_data')
      .update({ report_id: reportId })
      .eq('id', segmentData.id);

    if (updateError) throw updateError;

    // 3. 보고서에 segment_data_id 업데이트
    const { error: reportUpdateError } = await supabase
      .from('gcode_analysis_reports')
      .update({ segment_data_id: segmentData.id })
      .eq('id', reportId);

    if (reportUpdateError) {
      console.error('[gcodeSegmentService] Report update error:', reportUpdateError);
      // 세그먼트 업데이트는 성공했으므로 에러를 throw하지 않음
    }

    console.log('[gcodeSegmentService] Linked segment to report:', {
      segmentId: segmentData.id,
      reportId,
      analysisId,
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Link error:', error);
    return { success: false, error: error as Error };
  }
}

// ============================================================================
// Delete Segment Data
// ============================================================================

/**
 * 세그먼트 데이터 삭제 (DB + Storage)
 */
export async function deleteSegmentData(segmentId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    // 1. DB에서 Storage 경로 조회
    const { data: segmentData, error: getError } = await getSegmentDataById(segmentId);
    if (getError || !segmentData) {
      throw getError || new Error('Segment data not found');
    }

    // 2. Storage에서 파일 삭제
    if (segmentData.layers_storage_path) {
      const { error: storageError } = await supabase.storage
        .from('gcode-segments')
        .remove([segmentData.layers_storage_path]);

      if (storageError) {
        console.error('[gcodeSegmentService] Storage delete error:', storageError);
        // Storage 삭제 실패해도 DB 삭제는 진행
      }
    }

    // 3. DB에서 레코드 삭제
    const { error: deleteError } = await supabase
      .from('gcode_segment_data')
      .delete()
      .eq('id', segmentId);

    if (deleteError) throw deleteError;

    return { success: true, error: null };
  } catch (error) {
    console.error('[gcodeSegmentService] Delete error:', error);
    return { success: false, error: error as Error };
  }
}
