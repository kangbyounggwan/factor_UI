import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const ChangePassword = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePassword = async () => {
    // 유효성 검사
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: t("common.error", "오류"),
        description: t("profile.fillAllFields", "모든 필드를 입력해주세요."),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t("common.error", "오류"),
        description: t("profile.passwordMismatch", "새 비밀번호가 일치하지 않습니다."),
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t("common.error", "오류"),
        description: t("profile.passwordTooShort", "비밀번호는 최소 6자 이상이어야 합니다."),
        variant: "destructive",
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast({
        title: t("common.error", "오류"),
        description: t("profile.samePassword", "새 비밀번호는 현재 비밀번호와 달라야 합니다."),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsChanging(true);

      // 현재 비밀번호 확인 (재인증)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: t("common.error", "오류"),
          description: t("profile.currentPasswordWrong", "현재 비밀번호가 올바르지 않습니다."),
          variant: "destructive",
        });
        return;
      }

      // 비밀번호 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: t("common.success", "성공"),
        description: t("profile.passwordChanged", "비밀번호가 성공적으로 변경되었습니다."),
      });

      // 입력 필드 초기화
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // 잠시 후 이전 페이지로 이동
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (error) {
      console.error("Password change error:", error);
      toast({
        title: t("common.error", "오류"),
        description: t("profile.passwordChangeFailed", "비밀번호 변경에 실패했습니다."),
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {t("profile.changePassword", "비밀번호 변경")}
          </h1>
          <div className="w-9" /> {/* 균형을 위한 빈 공간 */}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 px-6 py-8">
        <div className="space-y-6">
          {/* 현재 비밀번호 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("profile.currentPassword", "현재 비밀번호")}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("profile.enterCurrentPassword", "현재 비밀번호를 입력하세요")}
                className="w-full px-4 py-3 pr-12 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* 새 비밀번호 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("profile.newPassword", "새 비밀번호")}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("profile.enterNewPassword", "새 비밀번호를 입력하세요")}
                className="w-full px-4 py-3 pr-12 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full transition-colors"
              >
                {showNewPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("profile.passwordMinLength", "최소 6자 이상")}
            </p>
          </div>

          {/* 새 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("profile.confirmPassword", "새 비밀번호 확인")}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("profile.enterConfirmPassword", "새 비밀번호를 다시 입력하세요")}
                className="w-full px-4 py-3 pr-12 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">
              {t("profile.passwordRequirements", "비밀번호 요구사항")}
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• {t("profile.passwordReq1", "최소 6자 이상")}</li>
              <li>• {t("profile.passwordReq2", "영문, 숫자 조합 권장")}</li>
              <li>• {t("profile.passwordReq3", "이전 비밀번호와 달라야 함")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 변경 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <Button
          onClick={handleChangePassword}
          disabled={isChanging || !currentPassword || !newPassword || !confirmPassword}
          className="w-full h-12"
        >
          {isChanging ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              {t("common.processing", "처리중")}...
            </>
          ) : (
            t("profile.changePassword", "비밀번호 변경")
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChangePassword;
