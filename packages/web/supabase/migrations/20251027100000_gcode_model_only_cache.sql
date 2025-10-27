-- GCode 캐싱 로직 변경: 프린터와 무관하게 모델별로 하나의 GCode만 저장
-- 같은 모델은 프린터가 달라도 동일한 슬라이싱 결과를 공유

-- print_time_seconds 컬럼 추가 (시간 정렬/필터링용)
ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS print_time_seconds INTEGER;

-- 기존 unique index 삭제 (model_id + printer_id)
DROP INDEX IF EXISTS idx_gcode_files_unique;

-- 중복된 model_id가 있는 경우, 가장 최근 것만 남기고 삭제
DELETE FROM public.gcode_files
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY model_id ORDER BY created_at DESC) as rn
    FROM public.gcode_files
    WHERE model_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- 새로운 unique index 생성 (model_id만 사용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcode_files_model_unique
ON public.gcode_files(model_id)
WHERE model_id IS NOT NULL;

-- printer_id는 참고용으로만 남겨둠 (nullable)
COMMENT ON COLUMN public.gcode_files.printer_id IS 'Reference printer ID - GCode is shared across all printers for same model';
