-- gcode_issue_types 코드북 동기화
-- 원본: factor_ai_server/gcode_analyzer/db/issue_types.py (DEFINED_ISSUE_TYPES, 58종)
-- 배경: 초기 시드가 10종만 반영되어 엔진이 실제로 배출하는 코드 대부분이 미등록 상태였다.
--       그 결과 산출물의 symptom_type을 10종으로 축약해야 했고 분류 granularity가 손실되었다.
-- 생성일: 2026-08-28

-- UNIQUE (type_code) 제약은 이미 존재함(gcode_issue_types_type_code_key) — 추가 불필요
-- severity_default CHECK: critical/high/medium/low/info — 58종 전부 통과 확인

INSERT INTO public.gcode_issue_types
  (type_code, label, label_en, description, category, severity_default, color, icon, is_active)
VALUES
  ('cold_extrusion', '압출 불량', 'Cold Extrusion', '노즐 온도가 녹는점보다 낮아 압출이 불가능한 위험 상태', 'temperature', 'high', 'red', 'snowflake', true),
  ('early_temp_off', '조기 온도 차단', 'Early Temp Off', '출력 완료 전 히팅 베드 또는 노즐 전원이 꺼지는 현상', 'temperature', 'high', 'orange', 'power', true),
  ('early_bed_off', '베드 조기 차단', 'Early Bed Off', '출력 완료 전 베드 히터가 꺼지는 현상', 'temperature', 'medium', 'orange', 'power', true),
  ('extreme_cold', '극저온 상태', 'Extreme Cold', '노즐 온도가 극도로 낮은 상태', 'temperature', 'critical', 'red', 'snowflake', true),
  ('nozzle_clog_risk', '노즐 막힘 위험', 'Nozzle Clog Risk', '온도 변화가 급격하여 노즐 막힘 위험', 'temperature', 'high', 'red', 'alert-triangle', true),
  ('layer_adhesion_risk', '레이어 접착 위험', 'Layer Adhesion Risk', '첫 레이어 온도 설정이 부적절', 'temperature', 'medium', 'yellow', 'layers', true),
  ('rapid_temp_change', '급격한 온도 변화', 'Rapid Temperature Change', '50°C 이상의 급격한 온도 변화 감지', 'temperature', 'medium', 'orange', 'thermometer', true),
  ('low_temp', '저온 상태', 'Low Temperature', '권장 최소 온도 미만의 설정', 'temperature', 'medium', 'yellow', 'thermometer', true),
  ('temp_wait_missing', '온도 대기 누락', 'Temperature Wait Missing', 'M104 설정 후 M109 대기 명령 누락', 'temperature', 'medium', 'yellow', 'clock', true),
  ('temp_zero', '온도 0 설정', 'Temperature Zero', '출력 중 온도가 0으로 설정됨', 'temperature', 'high', 'red', 'alert-circle', true),
  ('no_bed_temp', '베드 온도 미설정', 'No Bed Temperature', '베드 온도 설정이 없음', 'temperature', 'medium', 'yellow', 'thermometer', true),
  ('missing_bed_temp', '베드 온도 누락', 'Missing Bed Temperature', '베드 온도 설정이 누락됨', 'temperature', 'medium', 'yellow', 'thermometer', true),
  ('bed_temp_off_early', '베드 온도 조기 차단', 'Bed Temp Off Early', '출력 완료 전 M140 S0으로 베드 온도 차단', 'temperature', 'medium', 'orange', 'power', true),
  ('missing_warmup', '예열 대기 누락', 'Missing Warmup', 'M104 설정 후 M109 대기 없이 진행', 'temperature', 'medium', 'yellow', 'clock', true),
  ('excessive_temp', '과도한 온도', 'Excessive Temperature', '설정 온도가 권장 범위를 초과', 'temperature', 'high', 'red', 'flame', true),
  ('dangerous_temp', '위험 온도', 'Dangerous Temperature', '안전 범위를 벗어난 위험한 온도 설정', 'temperature', 'critical', 'red', 'alert-triangle', true),
  ('speed_mismatch', '속도 불일치', 'Speed Mismatch', '이동 속도와 출력 속도의 비율이 부적절', 'speed', 'low', 'blue', 'activity', true),
  ('excessive_speed', '과속', 'Excessive Speed', '출력 속도가 300mm/s를 초과', 'speed', 'high', 'red', 'zap', true),
  ('too_slow', '저속', 'Too Slow', '출력 속도가 5mm/s 미만으로 너무 느림', 'speed', 'low', 'blue', 'clock', true),
  ('no_feed_rate', '피드레이트 누락', 'No Feed Rate', 'F 파라미터(피드레이트)가 누락됨', 'speed', 'medium', 'yellow', 'alert-circle', true),
  ('rapid_accel', '급가속', 'Rapid Acceleration', '급격한 가속/감속이 감지됨', 'speed', 'medium', 'orange', 'trending-up', true),
  ('inconsistent_speed', '불규칙한 속도', 'Inconsistent Speed', '속도 변화가 불규칙하거나 일관성 없음', 'speed', 'low', 'blue', 'activity', true),
  ('zero_speed_extrusion', '0속도 압출', 'Zero Speed Extrusion', '속도가 정의되지 않은 상태에서 압출', 'speed', 'high', 'red', 'alert-circle', true),
  ('high_retraction', '과도한 리트렉션', 'Excessive Retraction', '리트렉션 횟수가 과도하게 많음', 'retraction', 'medium', 'yellow', 'repeat', true),
  ('excessive_retraction', '과다 리트렉션', 'Excessive Retraction', '리트렉션 설정이 과도함', 'retraction', 'medium', 'yellow', 'repeat', true),
  ('structure_abnormal', '비정상 구조', 'Abnormal Structure', 'G-code 구조 비율이 비정상적', 'structure', 'medium', 'purple', 'file-text', true),
  ('missing_end', '종료 코드 누락', 'Missing End Code', 'END_GCODE 섹션이 누락되거나 불완전', 'structure', 'medium', 'yellow', 'file-minus', true),
  ('excessive_body_temp', '과다 온도 명령', 'Excessive Body Temp Commands', 'BODY 섹션에 온도 명령이 너무 많음', 'structure', 'low', 'blue', 'thermometer', true),
  ('missing_setup', '설정 누락', 'Missing Setup', '필수 설정 명령어가 누락됨', 'structure', 'medium', 'yellow', 'settings', true),
  ('missing_temp_wait', '온도 대기 명령 누락', 'Missing Temperature Wait', 'M109 온도 대기 명령이 누락됨', 'structure', 'medium', 'yellow', 'clock', true),
  ('vendor_extension', '벤더 확장 코드', 'Vendor Extension', 'Bambu Lab/OrcaSlicer 등 벤더 고유 확장 코드 감지', 'vendor', 'info', 'gray', 'info', true),
  ('bed_adhesion', '베드 접착 불량', 'Bed Adhesion Issue', '첫 레이어 베드 접착 실패', 'print_quality', 'high', 'red', 'layers', true),
  ('stringing', '스트링잉', 'Stringing', '실 늘어짐/거미줄 현상', 'print_quality', 'medium', 'yellow', 'git-branch', true),
  ('warping', '뒤틀림', 'Warping', '출력물 뒤틀림/휘어짐', 'print_quality', 'high', 'orange', 'trending-down', true),
  ('layer_shifting', '레이어 밀림', 'Layer Shifting', '레이어 오프셋/밀림 현상', 'print_quality', 'high', 'red', 'move', true),
  ('under_extrusion', '언더익스트루전', 'Under Extrusion', '재료 부족으로 인한 압출 부족', 'print_quality', 'medium', 'yellow', 'minus-circle', true),
  ('over_extrusion', '오버익스트루전', 'Over Extrusion', '과다 재료로 인한 과압출', 'print_quality', 'medium', 'yellow', 'plus-circle', true),
  ('ghosting', '고스팅', 'Ghosting', '고스팅/링잉 현상', 'print_quality', 'low', 'blue', 'copy', true),
  ('z_banding', 'Z축 밴딩', 'Z-Banding', 'Z축 밴딩 패턴', 'print_quality', 'medium', 'yellow', 'bar-chart-2', true),
  ('blob', '블롭', 'Blob', '표면 블롭/돌기', 'print_quality', 'low', 'blue', 'circle', true),
  ('clogging', '노즐 막힘', 'Clogging', '노즐 막힘 현상', 'print_quality', 'high', 'red', 'x-circle', true),
  ('layer_separation', '레이어 분리', 'Layer Separation', '레이어 박리/분리', 'print_quality', 'high', 'red', 'layers', true),
  ('elephant_foot', '코끼리발', 'Elephant Foot', '하단 변형(코끼리발)', 'print_quality', 'medium', 'yellow', 'square', true),
  ('bridging_issue', '브릿징 불량', 'Bridging Issue', '브릿징 실패/처짐', 'print_quality', 'medium', 'yellow', 'minus', true),
  ('overhang_issue', '오버행 불량', 'Overhang Issue', '오버행 처짐', 'print_quality', 'medium', 'yellow', 'corner-down-right', true),
  ('surface_quality', '표면 품질 불량', 'Surface Quality Issue', '일반적인 표면 품질 문제', 'print_quality', 'low', 'blue', 'grid', true),
  ('bed_leveling', '베드 레벨링 문제', 'Bed Leveling Issue', '베드 수평 문제', 'equipment', 'high', 'orange', 'align-center', true),
  ('nozzle_damage', '노즐 손상', 'Nozzle Damage', '노즐 마모/손상', 'equipment', 'high', 'red', 'tool', true),
  ('extruder_skip', '익스트루더 스킵', 'Extruder Skip', '익스트루더 스테퍼 스킵', 'equipment', 'high', 'red', 'skip-forward', true),
  ('heating_failure', '히터 고장', 'Heating Failure', '히터 오작동', 'equipment', 'critical', 'red', 'alert-triangle', true),
  ('motor_issue', '모터 문제', 'Motor Issue', '모터 문제', 'equipment', 'high', 'red', 'settings', true),
  ('belt_tension', '벨트 장력 문제', 'Belt Tension Issue', '벨트 장력 문제', 'equipment', 'medium', 'yellow', 'link', true),
  ('filament_jam', '필라멘트 걸림', 'Filament Jam', '필라멘트 걸림/막힘', 'equipment', 'high', 'red', 'x-circle', true),
  ('slicer_settings', '슬라이서 설정 오류', 'Slicer Settings Issue', '잘못된 슬라이서 설정', 'software', 'medium', 'purple', 'sliders', true),
  ('gcode_error', 'G-code 오류', 'G-code Error', 'G-code 형식/구문 오류', 'software', 'high', 'red', 'code', true),
  ('firmware_issue', '펌웨어 문제', 'Firmware Issue', '펌웨어 문제', 'software', 'high', 'purple', 'cpu', true),
  ('unknown', '알 수 없는 문제', 'Unknown Issue', '분류되지 않은 문제', 'other', 'medium', 'gray', 'help-circle', true),
  ('other', '기타', 'Other', '기타 문제', 'other', 'low', 'gray', 'more-horizontal', true)
ON CONFLICT (type_code) DO UPDATE SET
  label            = EXCLUDED.label,
  label_en         = EXCLUDED.label_en,
  description      = EXCLUDED.description,
  category         = EXCLUDED.category,
  severity_default = EXCLUDED.severity_default,
  color            = EXCLUDED.color,
  icon             = EXCLUDED.icon,
  updated_at       = now();

-- 엔진 카탈로그에 없는 코드 (미정의 코드 유입 시 자동 생성된 플레이스홀더).
-- 기존 데이터가 참조하므로 삭제하지 않고 비활성만 검토할 것:
--   temp_zero_in_body