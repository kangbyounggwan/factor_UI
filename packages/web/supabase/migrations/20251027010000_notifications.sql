-- notifications 테이블 생성
-- 사용자에게 전송되는 알림 메시지를 저장합니다.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_id TEXT,
  related_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- RLS 정책 활성화
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 알림만 업데이트 가능 (읽음 상태 변경)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 시스템(서비스 롤)에서 알림 생성 가능
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- 사용자는 자신의 알림 삭제 가능
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 코멘트 추가
COMMENT ON TABLE public.notifications IS '사용자 알림 메시지를 저장하는 테이블';
COMMENT ON COLUMN public.notifications.id IS '알림 고유 ID';
COMMENT ON COLUMN public.notifications.user_id IS '알림을 받는 사용자 ID';
COMMENT ON COLUMN public.notifications.title IS '알림 제목';
COMMENT ON COLUMN public.notifications.message IS '알림 내용';
COMMENT ON COLUMN public.notifications.type IS '알림 타입 (ai_model_complete, print_complete, print_error, payment_success, etc.)';
COMMENT ON COLUMN public.notifications.read IS '읽음 여부';
COMMENT ON COLUMN public.notifications.related_id IS '관련 항목 ID (optional)';
COMMENT ON COLUMN public.notifications.related_type IS '관련 항목 타입 (ai_model, print_job, payment, subscription 등)';
COMMENT ON COLUMN public.notifications.metadata IS '추가 메타데이터 (JSON)';
COMMENT ON COLUMN public.notifications.created_at IS '알림 생성 시간';
COMMENT ON COLUMN public.notifications.read_at IS '알림 읽은 시간';
