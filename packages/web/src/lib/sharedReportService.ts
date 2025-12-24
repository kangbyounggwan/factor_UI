/**
 * Shared Report Service
 * 분석 보고서 공유 기능을 위한 서비스
 */

import { supabase } from '@shared/integrations/supabase/client';

// 짧은 공유 ID 생성 (12자)
function generateShareId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface SharedReport {
  id: string;
  share_id: string;
  user_id: string;
  report_id: string;
  title: string | null;
  created_at: string;
  expires_at: string | null;
  view_count: number;
  is_public: boolean;
}

export interface CreateShareOptions {
  title?: string;
  expiresInDays?: number; // null이면 영구
}

/**
 * 분석 보고서 공유 링크 생성
 */
export async function createReportShare(
  userId: string,
  reportId: string,
  options?: CreateShareOptions
): Promise<{ data: SharedReport | null; shareUrl: string | null; error: Error | null }> {
  try {
    // 기존 공유 링크가 있는지 확인
    const { data: existing } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_id', reportId)
      .eq('is_public', true)
      .maybeSingle();

    // 기존 링크가 있고 만료되지 않았으면 재사용
    if (existing) {
      const isExpired = existing.expires_at && new Date(existing.expires_at) < new Date();
      if (!isExpired) {
        const shareUrl = `${window.location.origin}/shared/report/${existing.share_id}`;
        return { data: existing as SharedReport, shareUrl, error: null };
      }
    }

    const shareId = generateShareId();
    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('shared_reports')
      .insert({
        share_id: shareId,
        user_id: userId,
        report_id: reportId,
        title: options?.title,
        expires_at: expiresAt,
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[sharedReportService] Create share error:', error);
      return { data: null, shareUrl: null, error: new Error(error.message) };
    }

    const shareUrl = `${window.location.origin}/shared/report/${shareId}`;
    return { data: data as SharedReport, shareUrl, error: null };
  } catch (err) {
    console.error('[sharedReportService] Create share exception:', err);
    return { data: null, shareUrl: null, error: err as Error };
  }
}

// 세그먼트 데이터 타입 (3D 뷰어용)
export interface SharedSegmentData {
  metadata: Record<string, unknown>;
  temperatures: Record<string, unknown>[];
  layersStoragePath: string | null;
}

/**
 * 공유 ID로 보고서 조회 (공개 접근)
 */
export async function getSharedReport(shareId: string): Promise<{
  data: {
    share: SharedReport;
    report: Record<string, unknown>;
    segmentData?: SharedSegmentData;
  } | null;
  error: Error | null;
}> {
  try {
    // 공유 정보 조회
    const { data: share, error: shareError } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_public', true)
      .single();

    if (shareError || !share) {
      console.error('[sharedReportService] Get share error:', shareError);
      return { data: null, error: new Error('Share not found') };
    }

    // 만료 확인
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { data: null, error: new Error('Share link expired') };
    }

    // 보고서 데이터 조회 (상세 필드)
    const { data: report, error: reportError } = await supabase
      .from('gcode_analysis_reports')
      .select(`
        id,
        file_name,
        status,
        analyzed_at,
        print_time_seconds,
        print_time_formatted,
        filament_length_mm,
        filament_weight_g,
        layer_count,
        layer_height,
        retraction_count,
        support_percentage,
        speed_travel,
        speed_infill,
        speed_perimeter,
        speed_support,
        speed_max,
        speed_avg,
        speed_min,
        temp_nozzle,
        temp_bed,
        temp_nozzle_first_layer,
        temp_bed_first_layer,
        overall_score,
        overall_grade,
        total_issues_count,
        critical_issues_count,
        high_issues_count,
        medium_issues_count,
        low_issues_count,
        analysis_warnings,
        analysis_cautions,
        analysis_suggestions,
        analysis_good_points,
        diagnosis_summary,
        issue_statistics,
        detailed_issues,
        patch_suggestions,
        solution_guides,
        expected_improvements,
        llm_summary,
        llm_recommendation,
        printing_info,
        created_at
      `)
      .eq('id', share.report_id)
      .single();

    if (reportError || !report) {
      console.error('[sharedReportService] Get report error:', reportError);
      return { data: null, error: new Error('Report not found') };
    }

    // 세그먼트 데이터 조회 (3D 뷰어용)
    let segmentData: SharedSegmentData | undefined;

    const { data: segment, error: segmentError } = await supabase
      .from('gcode_segment_data')
      .select('metadata, temperatures, layers_storage_path, status')
      .eq('report_id', share.report_id)
      .eq('status', 'ready')
      .maybeSingle();

    if (!segmentError && segment) {
      segmentData = {
        metadata: segment.metadata as Record<string, unknown>,
        temperatures: segment.temperatures as Record<string, unknown>[],
        layersStoragePath: segment.layers_storage_path,
      };
      console.log('[sharedReportService] Segment data found for report:', share.report_id);
    } else {
      console.log('[sharedReportService] No segment data for report:', share.report_id);
    }

    // 조회수 증가
    await supabase.rpc('increment_report_share_view_count', { p_share_id: shareId });

    return {
      data: {
        share: share as SharedReport,
        report: report as Record<string, unknown>,
        segmentData,
      },
      error: null,
    };
  } catch (err) {
    console.error('[sharedReportService] Get shared report exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * 공유 보고서의 레이어 데이터 로드 (Storage에서)
 */
export async function loadSharedReportLayers(storagePath: string): Promise<{
  data: Record<string, unknown>[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.storage
      .from('gcode-segments')
      .download(storagePath);

    if (error) throw error;

    const text = await data.text();
    const layers = JSON.parse(text) as Record<string, unknown>[];

    return { data: layers, error: null };
  } catch (error) {
    console.error('[sharedReportService] Load layers error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 사용자의 공유 보고서 목록 조회
 */
export async function getUserSharedReports(userId: string): Promise<{
  data: SharedReport[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sharedReportService] Get user shares error:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as SharedReport[], error: null };
  } catch (err) {
    console.error('[sharedReportService] Get user shares exception:', err);
    return { data: [], error: err as Error };
  }
}

/**
 * 공유 링크 삭제 (비활성화)
 */
export async function deleteReportShare(shareId: string, userId: string): Promise<{
  error: Error | null;
}> {
  try {
    const { error } = await supabase
      .from('shared_reports')
      .delete()
      .eq('share_id', shareId)
      .eq('user_id', userId);

    if (error) {
      console.error('[sharedReportService] Delete share error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[sharedReportService] Delete share exception:', err);
    return { error: err as Error };
  }
}

/**
 * 공유 링크 복사를 위한 URL 생성
 */
export function getShareUrl(shareId: string): string {
  return `${window.location.origin}/shared/report/${shareId}`;
}
