-- ============================================================================
-- G-code 분석 결과 저장을 위한 테이블 구조
-- Migration: 20251211000000_gcode_analysis_tables.sql
-- Description: AI G-code 분석 결과를 단일 row로 저장하는 테이블
-- Created: 2025-12-11
-- ============================================================================

-- ============================================================================
-- 1. gcode_issue_types (에러/이슈 유형 마스터 테이블)
-- 룰 엔진에서 정의하는 이슈 유형을 관리 (참조용)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gcode_issue_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 이슈 유형 식별자 (룰 엔진에서 사용)
  type_code TEXT NOT NULL UNIQUE,          -- e.g., 'cold_extrusion', 'early_temp_off'

  -- 표시 정보
  label TEXT NOT NULL,                      -- e.g., '압출 불량 (Cold Extrusion)'
  label_en TEXT,                            -- e.g., 'Cold Extrusion'
  description TEXT,                         -- 이슈에 대한 상세 설명

  -- 분류
  category TEXT NOT NULL DEFAULT 'temperature', -- temperature, speed, retraction, layer, other
  severity_default TEXT DEFAULT 'medium' CHECK (severity_default IN ('critical', 'high', 'medium', 'low', 'info')),

  -- 색상 및 아이콘 (UI 표시용)
  color TEXT DEFAULT 'red',                 -- red, orange, yellow, green, blue
  icon TEXT DEFAULT 'alert-triangle',       -- lucide icon name

  -- 룰 엔진 메타데이터
  rule_metadata JSONB,                      -- 룰 엔진에서 사용하는 추가 정보

  -- 활성화 여부
  is_active BOOLEAN DEFAULT true,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 이슈 유형 데이터 삽입
INSERT INTO public.gcode_issue_types (type_code, label, label_en, description, category, severity_default, color, icon) VALUES
  ('cold_extrusion', '압출 불량', 'Cold Extrusion', '노즐 온도가 녹는점보다 낮아 압출이 불가능한 위험 상태', 'temperature', 'high', 'red', 'snowflake'),
  ('early_temp_off', '조기 온도 차단', 'Early Temp Off', '출력 완료 전 히팅 베드 또는 노즐 전원이 꺼지는 현상', 'temperature', 'high', 'orange', 'power'),
  ('extreme_cold', '극저온 상태', 'Extreme Cold', '노즐 온도가 극도로 낮은 상태', 'temperature', 'critical', 'red', 'snowflake'),
  ('early_bed_off', '베드 조기 차단', 'Early Bed Off', '출력 완료 전 베드 히터가 꺼지는 현상', 'temperature', 'medium', 'orange', 'power'),
  ('high_retraction', '과도한 리트렉션', 'Excessive Retraction', '리트렉션 횟수가 과도하게 많음', 'retraction', 'medium', 'yellow', 'repeat'),
  ('speed_mismatch', '속도 불일치', 'Speed Mismatch', '이동 속도와 출력 속도의 비율이 부적절', 'speed', 'low', 'blue', 'activity'),
  ('layer_adhesion_risk', '레이어 접착 위험', 'Layer Adhesion Risk', '첫 레이어 온도 설정이 부적절', 'temperature', 'medium', 'yellow', 'layers'),
  ('nozzle_clog_risk', '노즐 막힘 위험', 'Nozzle Clog Risk', '온도 변화가 급격하여 노즐 막힘 위험', 'temperature', 'high', 'red', 'alert-triangle')
ON CONFLICT (type_code) DO NOTHING;

-- ============================================================================
-- 2. gcode_analysis_reports (분석 보고서 - 단일 row per 분석)
-- G-code 파일별 분석 결과 저장 (모든 데이터를 하나의 row에)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gcode_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- =====================================
  -- 연결 정보
  -- =====================================
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gcode_file_id UUID REFERENCES gcode_files(id) ON DELETE CASCADE,

  -- 파일 정보
  file_name TEXT,
  file_storage_path TEXT,                   -- Storage 경로

  -- 분석 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  analyzed_at TIMESTAMPTZ,

  -- =====================================
  -- 주요 메트릭 (정규화된 컬럼 - 쿼리/필터용)
  -- =====================================
  -- 출력 시간
  print_time_seconds INTEGER,
  print_time_formatted TEXT,                -- e.g., "4시간 31분"

  -- 필라멘트 사용량
  filament_length_mm NUMERIC,               -- mm 단위
  filament_weight_g NUMERIC,                -- gram 단위
  filament_cost NUMERIC,                    -- 비용

  -- 레이어 정보
  layer_count INTEGER,
  layer_height NUMERIC,                     -- mm

  -- 리트렉션
  retraction_count INTEGER,

  -- 서포트
  support_percentage NUMERIC,               -- 0-100
  support_volume_cm3 NUMERIC,               -- cm³

  -- =====================================
  -- 속도 정보
  -- =====================================
  speed_travel NUMERIC,                     -- mm/s
  speed_infill NUMERIC,                     -- mm/s
  speed_perimeter NUMERIC,                  -- mm/s
  speed_support NUMERIC,                    -- mm/s
  speed_max NUMERIC,
  speed_avg NUMERIC,
  speed_min NUMERIC,

  -- =====================================
  -- 온도 정보
  -- =====================================
  temp_nozzle NUMERIC,                      -- °C
  temp_bed NUMERIC,                         -- °C
  temp_nozzle_first_layer NUMERIC,
  temp_bed_first_layer NUMERIC,

  -- =====================================
  -- 분석 점수
  -- =====================================
  overall_score INTEGER,                    -- 0-100
  overall_grade TEXT CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),

  -- =====================================
  -- 이슈 카운트 (빠른 조회용)
  -- =====================================
  total_issues_count INTEGER DEFAULT 0,
  critical_issues_count INTEGER DEFAULT 0,
  high_issues_count INTEGER DEFAULT 0,
  medium_issues_count INTEGER DEFAULT 0,
  low_issues_count INTEGER DEFAULT 0,

  -- =====================================
  -- 분석 요약 (JSONB - 간단한 목록)
  -- =====================================
  -- [{title, description, impact}]
  analysis_warnings JSONB DEFAULT '[]',
  analysis_cautions JSONB DEFAULT '[]',
  analysis_suggestions JSONB DEFAULT '[]',
  analysis_good_points JSONB DEFAULT '[]',

  -- =====================================
  -- AI 상세 분석 결과 (JSONB)
  -- =====================================
  -- 진단 요약: {keyIssue: {title, description}, totalIssues, severity, recommendation}
  diagnosis_summary JSONB,

  -- 문제 유형별 통계: [{type, label, count, percentage, color, description}]
  issue_statistics JSONB DEFAULT '[]',

  -- 상세 이슈 목록: [{issueType, severity, line, code, description, impact, suggestion}]
  detailed_issues JSONB DEFAULT '[]',

  -- 패치 제안: [{line, action, original, modified, reason}]
  patch_suggestions JSONB DEFAULT '[]',

  -- 솔루션 가이드: [{title, description, steps[]}]
  solution_guides JSONB DEFAULT '[]',

  -- 예상 개선 효과: [{label, value, progress}]
  expected_improvements JSONB DEFAULT '[]',

  -- LLM 텍스트
  llm_summary TEXT,
  llm_recommendation TEXT,

  -- 프린팅 정보 (LLM 요약)
  printing_info JSONB,

  -- =====================================
  -- 전체 원본 데이터 (백업/디버깅용)
  -- =====================================
  raw_analysis_data JSONB,                  -- 전체 GCodeAnalysisData 원본

  -- =====================================
  -- 타임스탬프
  -- =====================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_user_id ON public.gcode_analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_gcode_file_id ON public.gcode_analysis_reports(gcode_file_id);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_status ON public.gcode_analysis_reports(status);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_created_at ON public.gcode_analysis_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_overall_score ON public.gcode_analysis_reports(overall_score);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_overall_grade ON public.gcode_analysis_reports(overall_grade);

-- JSONB 인덱스 (이슈 유형별 검색용)
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_issue_statistics ON public.gcode_analysis_reports USING GIN (issue_statistics);
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_detailed_issues ON public.gcode_analysis_reports USING GIN (detailed_issues);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

-- gcode_issue_types: 모든 사용자 읽기 가능
ALTER TABLE public.gcode_issue_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issue types are viewable by everyone"
  ON public.gcode_issue_types FOR SELECT
  TO authenticated
  USING (true);

-- gcode_analysis_reports: 본인 데이터만 접근
ALTER TABLE public.gcode_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analysis reports"
  ON public.gcode_analysis_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis reports"
  ON public.gcode_analysis_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis reports"
  ON public.gcode_analysis_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis reports"
  ON public.gcode_analysis_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_gcode_issue_types_updated_at ON public.gcode_issue_types;
CREATE TRIGGER update_gcode_issue_types_updated_at
  BEFORE UPDATE ON public.gcode_issue_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gcode_analysis_reports_updated_at ON public.gcode_analysis_reports;
CREATE TRIGGER update_gcode_analysis_reports_updated_at
  BEFORE UPDATE ON public.gcode_analysis_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.gcode_issue_types IS 'G-code 분석 이슈 유형 마스터 테이블 - 룰 엔진에서 정의하는 이슈 타입 관리';
COMMENT ON TABLE public.gcode_analysis_reports IS 'G-code 분석 보고서 - 보고서 1건당 1 row, 모든 분석 결과를 JSONB로 저장';

COMMENT ON COLUMN public.gcode_analysis_reports.issue_statistics IS '문제 유형별 통계 배열: [{type, label, count, percentage, color, description}]';
COMMENT ON COLUMN public.gcode_analysis_reports.detailed_issues IS '상세 이슈 목록: [{issueType, severity, line, line_index, code, description, impact, suggestion}]';
COMMENT ON COLUMN public.gcode_analysis_reports.patch_suggestions IS '패치 제안 목록: [{line, line_index, action, original, modified, reason}]';
COMMENT ON COLUMN public.gcode_analysis_reports.raw_analysis_data IS '전체 GCodeAnalysisData 원본 JSON (프론트엔드 호환용)';
