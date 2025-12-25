/**
 * G-code Analysis Database Service
 * Supabase를 통한 분석 보고서 CRUD 서비스
 * - 스토리지 업로드
 * - gcode_files 테이블 저장
 * - gcode_analysis_reports 테이블 저장
 */

import { supabase } from '@shared/integrations/supabase/client';
import type {
  GCodeAnalysisReport,
  GCodeAnalysisReportInsert,
  GCodeAnalysisReportUpdate,
  GCodeAnalysisReportListItem,
  AnalysisReportFilters,
  AnalysisReportSortOption,
  GCodeIssueType,
  GCodeIssueEdit,
  GCodeIssueEditInsert,
  GCodeIssueEditUpdate,
  IssueEditItem,
} from '@shared/types/gcodeAnalysisDbTypes';
import type { GCodeAnalysisData } from '@/components/ai/GCodeAnalytics';
import type { AnalysisResult } from '@shared/types/gcodeAnalysisTypes';

export const GCODE_BUCKET = 'gcode-files';

// ============================================================================
// 스토리지 업로드 및 gcode_files 테이블 저장
// ============================================================================

/**
 * G-code 파일을 스토리지에 업로드하고 gcode_files 테이블에 저장
 * 경로: {userId}/gcode_analysis/{filename}
 */
export async function uploadGCodeForAnalysis(
  userId: string,
  file: File
): Promise<{
  gcodeFileId: string;
  storagePath: string;
  publicUrl: string;
  error: Error | null;
}> {
  try {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/gcode_analysis/${timestamp}_${sanitizedName}`;

    console.log('[gcodeAnalysisDbService] Uploading G-code to storage:', storagePath);

    // 1. 파일을 ArrayBuffer로 읽어서 Blob으로 변환 (MIME type 문제 회피)
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'text/plain' });

    // 2. 스토리지에 업로드
    const { error: uploadError } = await supabase.storage
      .from(GCODE_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[gcodeAnalysisDbService] Storage upload error:', uploadError);
      return {
        gcodeFileId: '',
        storagePath: '',
        publicUrl: '',
        error: new Error(uploadError.message)
      };
    }

    // 3. Public URL 생성
    const { data: urlData } = supabase.storage
      .from(GCODE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 4. gcode_files 테이블에 저장
    const { data: gcodeFile, error: dbError } = await supabase
      .from('gcode_files')
      .insert({
        user_id: userId,
        filename: file.name,
        short_filename: file.name,
        file_path: storagePath,
        file_size: file.size,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[gcodeAnalysisDbService] DB insert error:', dbError);
      // 스토리지에서 삭제 (롤백)
      await supabase.storage.from(GCODE_BUCKET).remove([storagePath]);
      return {
        gcodeFileId: '',
        storagePath: '',
        publicUrl: '',
        error: new Error(dbError.message)
      };
    }

    console.log('[gcodeAnalysisDbService] G-code uploaded successfully:', {
      gcodeFileId: gcodeFile.id,
      storagePath,
      publicUrl,
    });

    return {
      gcodeFileId: gcodeFile.id,
      storagePath,
      publicUrl,
      error: null,
    };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Upload exception:', err);
    return {
      gcodeFileId: '',
      storagePath: '',
      publicUrl: '',
      error: err as Error
    };
  }
}

// ============================================================================
// 분석 보고서 저장
// ============================================================================

/**
 * UI 보고서 데이터 → DB Insert 데이터 변환
 */
export function convertReportToDbInsert(
  userId: string,
  fileName: string,
  reportData: GCodeAnalysisData,
  apiResult?: AnalysisResult
): GCodeAnalysisReportInsert {
  const { metrics, support, speedDistribution, temperature, analysis, overallScore, detailedAnalysis } = reportData;

  // 이슈 카운트 계산
  const detailedIssues = detailedAnalysis?.detailedIssues || [];
  const highCount = detailedIssues.filter(i => i.severity === 'high').length;
  const mediumCount = detailedIssues.filter(i => i.severity === 'medium').length;
  const lowCount = detailedIssues.filter(i => i.severity === 'low').length;

  return {
    user_id: userId,
    file_name: fileName,
    status: 'completed',
    analyzed_at: new Date().toISOString(),

    // 주요 메트릭
    print_time_seconds: metrics.printTime.seconds,
    print_time_formatted: metrics.printTime.value,
    filament_length_mm: parseFloat(metrics.filamentUsage.length?.replace(/[^\d.]/g, '') || '0') * 1000,
    filament_weight_g: parseFloat(metrics.filamentUsage.weight?.replace(/[^\d.]/g, '') || '0'),
    layer_count: metrics.layerCount.value,
    layer_height: metrics.layerCount.layerHeight,
    retraction_count: metrics.retractionCount.value,

    // 서포트
    support_percentage: support.percentage,

    // 속도
    speed_travel: speedDistribution?.travel,
    speed_infill: speedDistribution?.infill,
    speed_perimeter: speedDistribution?.perimeter,
    speed_support: speedDistribution?.support,
    speed_max: reportData.printSpeed?.max,
    speed_avg: reportData.printSpeed?.avg,
    speed_min: reportData.printSpeed?.min,

    // 온도
    temp_nozzle: temperature.nozzle,
    temp_bed: temperature.bed,
    temp_nozzle_first_layer: temperature.firstLayer?.nozzle,
    temp_bed_first_layer: temperature.firstLayer?.bed,

    // 점수
    overall_score: overallScore?.value,
    overall_grade: overallScore?.grade,

    // 이슈 카운트
    total_issues_count: detailedIssues.length,
    critical_issues_count: 0, // API에서 critical이 없으면 0
    high_issues_count: highCount,
    medium_issues_count: mediumCount,
    low_issues_count: lowCount,

    // 분석 요약
    analysis_warnings: analysis.warnings.map(w => ({
      title: w.title,
      description: w.description,
      impact: w.impact,
    })),
    analysis_cautions: analysis.cautions.map(c => ({
      title: c.title,
      description: c.description,
      impact: c.impact,
    })),
    analysis_suggestions: analysis.suggestions.map(s => ({
      title: s.title,
      description: s.description,
      impact: s.impact,
    })),
    analysis_good_points: analysis.goodPoints.map(g => ({
      title: g.title,
      description: g.description,
      impact: g.impact,
    })),

    // AI 상세 분석
    diagnosis_summary: detailedAnalysis?.diagnosisSummary ? {
      keyIssue: detailedAnalysis.diagnosisSummary.keyIssue,
      totalIssues: detailedAnalysis.diagnosisSummary.totalIssues,
      severity: detailedAnalysis.diagnosisSummary.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      recommendation: detailedAnalysis.diagnosisSummary.recommendation,
    } : undefined,

    issue_statistics: detailedAnalysis?.issueStatistics?.map(stat => ({
      type: stat.type,
      label: stat.label,
      count: stat.count,
      percentage: stat.percentage,
      color: stat.color,
      description: stat.description,
    })) || [],

    // 완전한 이슈 구조 저장 (gcode_context 포함)
    detailed_issues: detailedIssues.map(issue => ({
      // 필수 필드
      id: issue.id,
      type: issue.type || issue.issueType,
      issueType: issue.issueType || issue.type,
      severity: issue.severity,
      is_grouped: issue.is_grouped ?? false,
      count: issue.count ?? 1,
      lines: issue.lines || (issue.line !== undefined ? [Number(issue.line)] : []),
      title: issue.title || '',
      description: issue.description || '',
      // all_issues (gcode_context 포함)
      all_issues: (issue.all_issues || []).map(ai => ({
        line: ai.line,
        cmd: ai.cmd,
        temp: ai.temp,
        min_temp: ai.min_temp,
        type: ai.type,
        severity: ai.severity,
        description: ai.description,
        gcode_context: ai.gcode_context,
      })),
      // 선택적 필드
      line: issue.line !== undefined ? Number(issue.line) : undefined,
      line_index: issue.line_index !== undefined ? Number(issue.line_index) : undefined,
      code: issue.code,
      impact: issue.impact,
      suggestion: issue.suggestion,
      layer: issue.layer,
      section: issue.section,
      gcode_context: issue.gcode_context,
    })),

    patch_suggestions: detailedAnalysis?.patchSuggestions?.map(patch => ({
      line: patch.line,
      line_index: patch.line_index,
      action: patch.action,
      original: patch.original,
      modified: patch.modified,
      reason: patch.reason,
    })) || [],

    solution_guides: detailedAnalysis?.solutionGuides?.map(guide => ({
      title: guide.title,
      description: guide.description,
      steps: guide.steps,
    })) || [],

    expected_improvements: detailedAnalysis?.expectedImprovements?.map(imp => ({
      label: imp.label,
      value: imp.value,
      progress: imp.progress,
    })) || [],

    llm_summary: detailedAnalysis?.llmSummary,
    llm_recommendation: detailedAnalysis?.llmRecommendation,
    printing_info: detailedAnalysis?.printingInfo as unknown as import('@shared/types/gcodeAnalysisDbTypes').PrintingInfoDb,

    // 원본 데이터 백업
    raw_analysis_data: reportData as unknown as Record<string, unknown>,  // UI 변환 데이터
    raw_api_response: apiResult as unknown as Record<string, unknown>,    // API 원본 응답 전체
    // issues_found는 사용하지 않음 (detailed_issues에 gcode_context 포함)
  };
}

/**
 * 새 분석 보고서 저장
 * @param gcodeFileId - gcode_files 테이블의 ID (스토리지에 업로드된 파일)
 * @param storagePath - 스토리지 경로
 */
export async function saveAnalysisReport(
  userId: string,
  fileName: string,
  reportData: GCodeAnalysisData,
  options?: {
    gcodeFileId?: string;
    storagePath?: string;
    apiResult?: AnalysisResult;
    segmentDataId?: string;
  }
): Promise<{ data: GCodeAnalysisReport | null; error: Error | null }> {
  try {
    const insertData = convertReportToDbInsert(userId, fileName, reportData, options?.apiResult);

    // gcode_file_id와 storage_path 추가
    if (options?.gcodeFileId) {
      insertData.gcode_file_id = options.gcodeFileId;
    }
    if (options?.storagePath) {
      insertData.file_storage_path = options.storagePath;
    }
    // segment_data_id 추가
    if (options?.segmentDataId) {
      (insertData as any).segment_data_id = options.segmentDataId;
    }

    console.log('[DEBUG] gcodeAnalysisDbService.saveAnalysisReport - segmentDataId received:', options?.segmentDataId);
    console.log('[DEBUG] gcodeAnalysisDbService.saveAnalysisReport - insertData.segment_data_id:', (insertData as any).segment_data_id);

    const { data, error } = await supabase
      .from('gcode_analysis_reports')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.log('[DEBUG] gcodeAnalysisDbService INSERT FAILED:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    console.log('[DEBUG] gcodeAnalysisDbService INSERT SUCCESS - reportId:', data?.id, 'segment_data_id in DB:', (data as any)?.segment_data_id);
    return { data: data as GCodeAnalysisReport, error: null };
  } catch (err) {
    console.log('[DEBUG] gcodeAnalysisDbService exception:', err);
    return { data: null, error: err as Error };
  }
}

// ============================================================================
// 분석 보고서 조회
// ============================================================================

/**
 * 사용자의 분석 보고서 목록 조회
 */
export async function getAnalysisReportsList(
  userId: string,
  options?: {
    filters?: AnalysisReportFilters;
    sort?: AnalysisReportSortOption;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: GCodeAnalysisReportListItem[]; count: number; error: Error | null }> {
  try {
    let query = supabase
      .from('gcode_analysis_reports')
      .select(
        `
        id,
        file_name,
        status,
        overall_score,
        overall_grade,
        total_issues_count,
        high_issues_count,
        print_time_formatted,
        filament_length_mm,
        filament_weight_g,
        layer_count,
        created_at
        `,
        { count: 'exact' }
      )
      .eq('user_id', userId);

    // 필터 적용
    const filters = options?.filters;
    if (filters) {
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.grade) {
        query = query.eq('overall_grade', filters.grade);
      }
      if (filters.minScore !== undefined) {
        query = query.gte('overall_score', filters.minScore);
      }
      if (filters.maxScore !== undefined) {
        query = query.lte('overall_score', filters.maxScore);
      }
      if (filters.hasIssues !== undefined) {
        if (filters.hasIssues) {
          query = query.gt('total_issues_count', 0);
        } else {
          query = query.eq('total_issues_count', 0);
        }
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
    }

    // 정렬 적용
    const sort = options?.sort || { field: 'created_at', direction: 'desc' };
    query = query.order(sort.field, { ascending: sort.direction === 'asc' });

    // 페이지네이션 적용
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[gcodeAnalysisDbService] List error:', error);
      return { data: [], count: 0, error: new Error(error.message) };
    }

    return {
      data: (data || []) as GCodeAnalysisReportListItem[],
      count: count || 0,
      error: null,
    };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] List exception:', err);
    return { data: [], count: 0, error: err as Error };
  }
}

/**
 * 단일 분석 보고서 상세 조회
 * raw_analysis_data, raw_api_response, issues_found 제외 (너무 큼)
 * detailed_issues에 gcode_context 포함
 */
export async function getAnalysisReportById(
  reportId: string
): Promise<{ data: GCodeAnalysisReport | null; error: Error | null }> {
  try {
    // raw_analysis_data, raw_api_response, issues_found 제외하고 조회 (너무 큼)
    const { data, error } = await supabase
      .from('gcode_analysis_reports')
      .select(`
        id,
        user_id,
        gcode_file_id,
        file_name,
        file_storage_path,
        status,
        analyzed_at,
        print_time_seconds,
        print_time_formatted,
        filament_length_mm,
        filament_weight_g,
        filament_cost,
        layer_count,
        layer_height,
        retraction_count,
        support_percentage,
        support_volume_cm3,
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
        created_at,
        updated_at
      `)
      .eq('id', reportId)
      .single();

    if (error) {
      console.error('[gcodeAnalysisDbService] Get by ID error:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as GCodeAnalysisReport, error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Get by ID exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * DB 보고서 → UI 보고서 데이터 변환
 * raw_analysis_data, issues_found 사용 안함 - detailed_issues에 gcode_context 포함
 */
export function convertDbReportToUiData(report: GCodeAnalysisReport): GCodeAnalysisData {
  // DB 필드에서 복원
  const uiData: GCodeAnalysisData = {
    reportId: report.id,
    fileName: report.file_name,
    storagePath: report.file_storage_path,
    analyzedAt: report.analyzed_at,
    metrics: {
      printTime: {
        value: report.print_time_formatted || '',
        seconds: report.print_time_seconds,
      },
      filamentUsage: {
        length: report.filament_length_mm ? `${(report.filament_length_mm / 1000).toFixed(1)}m` : '',
        weight: report.filament_weight_g ? `${report.filament_weight_g}g` : undefined,
      },
      layerCount: {
        value: report.layer_count || 0,
        layerHeight: report.layer_height,
      },
      retractionCount: {
        value: report.retraction_count || 0,
      },
    },
    support: {
      percentage: report.support_percentage || 0,
    },
    speedDistribution: {
      travel: report.speed_travel || 0,
      infill: report.speed_infill || 0,
      perimeter: report.speed_perimeter || 0,
      support: report.speed_support,
    },
    temperature: {
      nozzle: report.temp_nozzle || 0,
      bed: report.temp_bed || 0,
      firstLayer: {
        nozzle: report.temp_nozzle_first_layer,
        bed: report.temp_bed_first_layer,
      },
    },
    analysis: {
      warnings: report.analysis_warnings || [],
      cautions: report.analysis_cautions || [],
      suggestions: report.analysis_suggestions || [],
      goodPoints: report.analysis_good_points || [],
    },
    overallScore: report.overall_score ? {
      value: report.overall_score,
      grade: report.overall_grade || 'C',
    } : undefined,
    printSpeed: {
      max: report.speed_max || 0,
      avg: report.speed_avg || 0,
      min: report.speed_min,
    },
    detailedAnalysis: {
      diagnosisSummary: report.diagnosis_summary as GCodeAnalysisData['detailedAnalysis']['diagnosisSummary'],
      issueStatistics: report.issue_statistics,
      // detailed_issues에서 직접 로드 (gcode_context 포함)
      detailedIssues: convertDetailedIssuesFromDb(report.detailed_issues),
      patchSuggestions: report.patch_suggestions,
      solutionGuides: report.solution_guides,
      expectedImprovements: report.expected_improvements,
      llmSummary: report.llm_summary,
      llmRecommendation: report.llm_recommendation,
      printingInfo: report.printing_info,
    },
  };

  // Layer 기준 오름차순 정렬
  if (uiData.detailedAnalysis?.detailedIssues) {
    uiData.detailedAnalysis.detailedIssues.sort((a, b) => {
      const layerA = a.layer ?? Number.MAX_SAFE_INTEGER;
      const layerB = b.layer ?? Number.MAX_SAFE_INTEGER;
      return layerA - layerB;
    });
  }

  return uiData;
}

/**
 * DB detailed_issues → UI DetailedIssue[] 변환
 * detailed_issues에 gcode_context 포함 (issues_found 사용 안함)
 */
function convertDetailedIssuesFromDb(
  detailedIssues: GCodeAnalysisReport['detailed_issues']
): NonNullable<GCodeAnalysisData['detailedAnalysis']>['detailedIssues'] {
  if (!detailedIssues || !Array.isArray(detailedIssues) || detailedIssues.length === 0) {
    return [];
  }

  return detailedIssues.map((issue) => {
    // DB에서 로드된 이슈 (새 구조 또는 레거시 구조)
    const dbIssue = issue as {
      // 새 구조 필드
      id?: string;
      type?: string;
      issueType?: string;
      severity?: string;
      is_grouped?: boolean;
      count?: number;
      lines?: number[];
      title?: string;
      description?: string;
      all_issues?: Array<{
        line: number;
        cmd?: string;
        temp?: number;
        min_temp?: number;
        type?: string;
        severity?: string;
        description?: string;
        gcode_context?: string;
      }>;
      // 레거시/선택적 필드
      line?: number;
      line_index?: number;
      code?: string;
      impact?: string;
      suggestion?: string;
      layer?: number;
      section?: string;
      gcode_context?: string;
    };

    // lines 배열 결정
    const lines = dbIssue.lines && Array.isArray(dbIssue.lines) && dbIssue.lines.length > 0
      ? dbIssue.lines
      : dbIssue.line !== undefined
        ? [Number(dbIssue.line)]
        : [];

    // count 결정
    const count = dbIssue.count ?? dbIssue.all_issues?.length ?? 1;

    // ID 결정 (없으면 생성)
    const issueId = dbIssue.id || `ISSUE-${Math.random().toString(36).substring(2, 11)}`;

    // all_issues 그대로 사용 (gcode_context 이미 포함)
    const allIssues = dbIssue.all_issues || [];

    return {
      id: issueId,
      type: dbIssue.type || dbIssue.issueType || 'other',
      issueType: dbIssue.issueType || dbIssue.type || 'other',
      severity: (dbIssue.severity || 'medium') as 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning',
      is_grouped: dbIssue.is_grouped ?? count > 1,
      count,
      lines,
      line: lines[0],
      title: dbIssue.title || dbIssue.description || '',
      description: dbIssue.description || '',
      all_issues: allIssues,
      impact: dbIssue.impact,
      suggestion: dbIssue.suggestion,
      layer: dbIssue.layer,
      section: dbIssue.section,
      code: dbIssue.code,
      gcode_context: dbIssue.gcode_context || allIssues[0]?.gcode_context,
    };
  });
}

// ============================================================================
// 분석 보고서 삭제
// ============================================================================

/**
 * 분석 보고서 삭제
 */
export async function deleteAnalysisReport(
  reportId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gcode_analysis_reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      console.error('[gcodeAnalysisDbService] Delete error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Delete exception:', err);
    return { error: err as Error };
  }
}

/**
 * 여러 분석 보고서 일괄 삭제
 */
export async function deleteMultipleReports(
  reportIds: string[]
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gcode_analysis_reports')
      .delete()
      .in('id', reportIds);

    if (error) {
      console.error('[gcodeAnalysisDbService] Bulk delete error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Bulk delete exception:', err);
    return { error: err as Error };
  }
}

// ============================================================================
// 이슈 타입 마스터 조회
// ============================================================================

/**
 * 활성화된 이슈 타입 목록 조회
 */
export async function getActiveIssueTypes(): Promise<{
  data: GCodeIssueType[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('gcode_issue_types')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('type_code');

    if (error) {
      console.error('[gcodeAnalysisDbService] Get issue types error:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as GCodeIssueType[], error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Get issue types exception:', err);
    return { data: [], error: err as Error };
  }
}

// ============================================================================
// G-code 파일 다운로드
// ============================================================================

/**
 * 스토리지에서 G-code 파일 내용 다운로드
 */
export async function downloadGCodeContent(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(GCODE_BUCKET)
      .download(storagePath);

    if (error) {
      console.error('[gcodeAnalysisDbService] Download error:', error);
      return null;
    }

    if (!data) return null;

    return await data.text();
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Download exception:', err);
    return null;
  }
}

/**
 * G-code 파일 내용을 업데이트 (덮어쓰기)
 */
export async function updateGCodeFileContent(
  storagePath: string,
  newContent: string
): Promise<{ error: Error | null }> {
  try {
    const blob = new Blob([newContent], { type: 'text/plain' });

    const { error: uploadError } = await supabase.storage
      .from(GCODE_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: true, // 덮어쓰기 허용
      });

    if (uploadError) {
      console.error('[gcodeAnalysisDbService] Update (upload) error:', uploadError);
      return { error: new Error(uploadError.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] Update exception:', err);
    return { error: err as Error };
  }
}

// ============================================================================
// 이슈별 수정 내역 관리 (gcode_issue_edits)
// ============================================================================

/**
 * 이슈별 수정 내역 저장 또는 업데이트 (upsert)
 */
export async function saveIssueEdit(
  userId: string,
  reportId: string,
  issueIndex: number,
  issueType: string,
  edits: IssueEditItem[],
  options?: {
    issueLine?: number;
    issueLineIndex?: number;
    note?: string;
    // 피드백 관련 옵션
    patchIndex?: number;
    feedback?: 'like' | 'dislike';
    patchId?: string;
  }
): Promise<{ data: GCodeIssueEdit | null; error: Error | null }> {
  try {
    console.log('[gcodeAnalysisDbService] saveIssueEdit called:', {
      userId,
      reportId,
      issueIndex,
      issueType,
      editsCount: edits.length,
    });

    const insertData: GCodeIssueEditInsert = {
      user_id: userId,
      report_id: reportId,
      issue_index: issueIndex,
      issue_type: issueType,
      issue_line: options?.issueLine,
      issue_line_index: options?.issueLineIndex,
      edits,
      status: 'pending',
      note: options?.note,
    };

    // Upsert: report_id + issue_index 조합으로 기존 레코드 있으면 업데이트
    const { data, error } = await supabase
      .from('gcode_issue_edits')
      .upsert(insertData, {
        onConflict: 'report_id,issue_index',
      })
      .select()
      .single();

    if (error) {
      console.error('[gcodeAnalysisDbService] saveIssueEdit error:', error);
      return { data: null, error: new Error(error.message) };
    }

    console.log('[gcodeAnalysisDbService] saveIssueEdit success:', data?.id);
    return { data: data as GCodeIssueEdit, error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] saveIssueEdit exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * 특정 보고서의 모든 이슈 수정 내역 조회
 */
export async function getIssueEditsByReportId(
  reportId: string
): Promise<{ data: GCodeIssueEdit[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('gcode_issue_edits')
      .select('*')
      .eq('report_id', reportId)
      .order('issue_index', { ascending: true });

    if (error) {
      console.error('[gcodeAnalysisDbService] getIssueEditsByReportId error:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as GCodeIssueEdit[], error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] getIssueEditsByReportId exception:', err);
    return { data: [], error: err as Error };
  }
}

/**
 * 특정 이슈의 수정 내역 조회
 */
export async function getIssueEdit(
  reportId: string,
  issueIndex: number
): Promise<{ data: GCodeIssueEdit | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('gcode_issue_edits')
      .select('*')
      .eq('report_id', reportId)
      .eq('issue_index', issueIndex)
      .single();

    if (error) {
      // Not found는 에러가 아님
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      console.error('[gcodeAnalysisDbService] getIssueEdit error:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as GCodeIssueEdit, error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] getIssueEdit exception:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * 이슈 수정 내역 상태 업데이트 (applied, reverted 등)
 */
export async function updateIssueEditStatus(
  editId: string,
  status: 'pending' | 'applied' | 'reverted'
): Promise<{ error: Error | null }> {
  try {
    const updateData: GCodeIssueEditUpdate = {
      status,
      applied_at: status === 'applied' ? new Date().toISOString() : undefined,
    };

    const { error } = await supabase
      .from('gcode_issue_edits')
      .update(updateData)
      .eq('id', editId);

    if (error) {
      console.error('[gcodeAnalysisDbService] updateIssueEditStatus error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] updateIssueEditStatus exception:', err);
    return { error: err as Error };
  }
}

/**
 * 이슈 수정 내역 삭제
 */
export async function deleteIssueEdit(editId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gcode_issue_edits')
      .delete()
      .eq('id', editId);

    if (error) {
      console.error('[gcodeAnalysisDbService] deleteIssueEdit error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] deleteIssueEdit exception:', err);
    return { error: err as Error };
  }
}

/**
 * 특정 보고서의 모든 이슈 수정 내역 삭제
 */
export async function deleteAllIssueEdits(reportId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('gcode_issue_edits')
      .delete()
      .eq('report_id', reportId);

    if (error) {
      console.error('[gcodeAnalysisDbService] deleteAllIssueEdits error:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[gcodeAnalysisDbService] deleteAllIssueEdits exception:', err);
    return { error: err as Error };
  }
}
