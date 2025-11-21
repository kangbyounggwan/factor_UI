import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Sparkles } from "lucide-react";

const ProfileSetup = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ""
  );
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!displayName.trim()) {
      toast({
        title: t("profileSetup.nameRequired", "이름을 입력해주세요"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. user_metadata 업데이트
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          phone: phone,
        }
      });

      if (authError) throw authError;

      // 2. profiles 테이블에 upsert (없으면 생성, 있으면 업데이트)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName,
          phone: phone || null,
          role: 'user',
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      // 3. user_notification_settings 생성 (없으면)
      const { error: notifError } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          push_notifications: true,
          print_complete_notifications: true,
          error_notifications: true,
          email_notifications: false,
          weekly_report: false,
          notification_sound: true,
          notification_frequency: 'immediate',
          quiet_hours_enabled: false,
        }, {
          onConflict: 'user_id'
        });

      if (notifError) {
        console.error('Notification settings error:', notifError);
      }

      // 4. user_subscriptions 생성 (없으면)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_name: 'basic',
          status: 'trial',
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
          cancel_at_period_end: false,
        }, {
          onConflict: 'user_id'
        });

      if (subError) {
        console.error('Subscription error:', subError);
      }

      toast({
        title: t("profileSetup.success", "프로필 설정 완료"),
        description: t("profileSetup.successDesc", "환영합니다! 서비스를 이용해보세요."),
      });

      // 메인 페이지로 이동
      navigate("/", { replace: true });

    } catch (error) {
      console.error('Profile setup error:', error);
      toast({
        title: t("common.error", "오류"),
        description: t("profileSetup.error", "프로필 설정 중 오류가 발생했습니다."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 safe-area-inset">
      {/* 아이콘 */}
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Sparkles className="h-10 w-10 text-primary" />
      </div>

      {/* 타이틀 */}
      <h1 className="text-2xl font-bold text-center mb-2">
        {t("profileSetup.welcome", "환영합니다!")}
      </h1>
      <p className="text-muted-foreground text-center mb-8">
        {t("profileSetup.description", "서비스 이용을 위해 간단한 정보를 입력해주세요.")}
      </p>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        {/* 이름 입력 */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t("profileSetup.name", "이름")}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("profileSetup.namePlaceholder", "이름을 입력하세요")}
            required
            autoFocus
            className="h-12"
          />
        </div>

        {/* 휴대폰 번호 입력 */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {t("profileSetup.phone", "휴대폰 번호")}
            <span className="text-muted-foreground text-xs">(선택)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profileSetup.phonePlaceholder", "010-0000-0000")}
            className="h-12"
          />
        </div>

        {/* 제출 버튼 */}
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={isSubmitting || !displayName.trim()}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {t("common.saving", "저장 중...")}
            </div>
          ) : (
            t("profileSetup.start", "시작하기")
          )}
        </Button>
      </form>
    </div>
  );
};

export default ProfileSetup;
