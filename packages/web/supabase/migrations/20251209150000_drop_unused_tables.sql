-- ============================================
-- 미사용 테이블 삭제
-- 코드베이스 분석 결과 사용되지 않는 테이블들 정리
-- ============================================

-- 1. ai_usage_logs - user_usage 테이블로 대체됨
DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;

-- 2. failure_scenes - 미사용 (미래 기능으로 계획되었으나 미구현)
DROP TABLE IF EXISTS public.failure_scenes CASCADE;

-- 3. paddle_customers - paddle-webhook에서 직접 사용 안함
--    (user_subscriptions.paddle_customer_id로 관리)
DROP TABLE IF EXISTS public.paddle_customers CASCADE;

-- 4. paddle_subscriptions - paddle-webhook에서 직접 사용 안함
--    (user_subscriptions 테이블로 통합 관리)
DROP TABLE IF EXISTS public.paddle_subscriptions CASCADE;

-- 5. paddle_transactions - paddle-webhook에서 직접 사용 안함
--    (payment_history 테이블로 관리)
DROP TABLE IF EXISTS public.paddle_transactions CASCADE;

-- 6. print_jobs - 미사용 (출력 작업은 MQTT로 실시간 처리)
DROP TABLE IF EXISTS public.print_jobs CASCADE;

-- 7. printer_position_history - 미사용
DROP TABLE IF EXISTS public.printer_position_history CASCADE;

-- 8. printer_status - 미사용 (실시간 상태는 MQTT로 처리)
DROP TABLE IF EXISTS public.printer_status CASCADE;

-- 9. stl_files - 미사용 (STL은 Storage 버킷에 직접 저장)
DROP TABLE IF EXISTS public.stl_files CASCADE;

-- ============================================
-- 정리 완료 후 남은 테이블 (22개):
-- ============================================
-- 1.  ai_generated_models
-- 2.  api_keys
-- 3.  background_tasks
-- 4.  cameras
-- 5.  chat_messages
-- 6.  chat_sessions
-- 7.  clients
-- 8.  edge_devices
-- 9.  gcode_files
-- 10. manufacturing_printers
-- 11. model_print_history
-- 12. notifications
-- 13. payment_history
-- 14. payment_methods
-- 15. printer_groups
-- 16. printer_temperature_logs
-- 17. printer_temperature_sessions
-- 18. printers
-- 19. profiles
-- 20. subscription_plans (NEW)
-- 21. usage_logs (NEW)
-- 22. user_device_tokens
-- 23. user_notification_settings
-- 24. user_subscriptions
-- 25. user_usage (NEW)
-- ============================================
