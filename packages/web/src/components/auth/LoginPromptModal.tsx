/**
 * 로그인 프롬프트 모달
 * 비로그인 사용자가 특정 기능 사용 시 표시
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone } from "lucide-react";
import { useAuth } from "@shared/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Google Logo SVG (컬러)
const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple Logo SVG
const AppleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// Microsoft Logo SVG
const MicrosoftLogo = () => (
  <svg width="20" height="20" viewBox="0 0 23 23">
    <path fill="#F35325" d="M1 1h10v10H1z"/>
    <path fill="#81BC06" d="M12 1h10v10H12z"/>
    <path fill="#05A6F0" d="M1 12h10v10H1z"/>
    <path fill="#FFBA08" d="M12 12h10v10H12z"/>
  </svg>
);

interface LoginPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function LoginPromptModal({
  open,
  onOpenChange,
  title,
  description,
}: LoginPromptModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [focusedButton, setFocusedButton] = useState<string | null>("google");

  const handleGoogleLogin = async () => {
    setIsLoading("google");
    try {
      await signInWithGoogle();
      onOpenChange(false);
    } catch (error) {
      console.error("Google login error:", error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading("apple");
    try {
      await signInWithApple();
      onOpenChange(false);
    } catch (error) {
      console.error("Apple login error:", error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleEmailContinue = () => {
    if (email.trim()) {
      navigate(`/auth?email=${encodeURIComponent(email)}`);
      onOpenChange(false);
    } else {
      navigate("/auth");
      onOpenChange(false);
    }
  };

  // 소셜 로그인 버튼 스타일
  const socialButtonClass = (id: string, disabled: boolean = false) =>
    cn(
      "w-full h-[52px] text-[15px] font-medium justify-start px-5 gap-4 rounded-full border-2 transition-all duration-200",
      "bg-card hover:bg-muted/50",
      focusedButton === id && !disabled
        ? "border-primary ring-2 ring-primary/20 shadow-sm"
        : "border-border hover:border-muted-foreground/30",
      disabled && "opacity-40 cursor-not-allowed hover:bg-card"
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        {/* 헤더 */}
        <DialogHeader className="px-8 pt-8 pb-2 text-left">
          <DialogTitle className="text-[26px] font-bold tracking-tight text-foreground">
            {title || t('auth.loginRequired', '로그인이 필요합니다')}
          </DialogTitle>
          <DialogDescription className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
            {description || t('auth.loginModalDescription', 'AI 모델을 생성하려면 로그인이 필요합니다. 로그인하시면 더 많은 기능을 이용하실 수 있습니다.')}
          </DialogDescription>
        </DialogHeader>

        {/* 소셜 로그인 버튼들 */}
        <div className="px-8 pt-6 pb-4 space-y-3">
          {/* Google 로그인 - 강조 */}
          <Button
            variant="outline"
            className={socialButtonClass("google")}
            onClick={handleGoogleLogin}
            onMouseEnter={() => setFocusedButton("google")}
            disabled={isLoading !== null}
          >
            {isLoading === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleLogo />
            )}
            <span>{t('auth.continueWithGoogle', 'Google로 계속하기')}</span>
          </Button>

          {/* Apple 로그인 */}
          <Button
            variant="outline"
            className={socialButtonClass("apple")}
            onClick={handleAppleLogin}
            onMouseEnter={() => setFocusedButton("apple")}
            disabled={isLoading !== null}
          >
            {isLoading === "apple" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <AppleLogo />
            )}
            <span>{t('auth.continueWithApple', 'Apple로 계속하기')}</span>
          </Button>

          {/* Microsoft 로그인 (비활성화) */}
          <Button
            variant="outline"
            className={socialButtonClass("microsoft", true)}
            disabled
          >
            <MicrosoftLogo />
            <span>{t('auth.continueWithMicrosoft', 'Microsoft로 계속하기')}</span>
          </Button>

          {/* 전화번호 로그인 (비활성화) */}
          <Button
            variant="outline"
            className={socialButtonClass("phone", true)}
            disabled
          >
            <Phone className="h-5 w-5" />
            <span>{t('auth.continueWithPhone', '폰으로 계속하기')}</span>
          </Button>
        </div>

        {/* 구분선 */}
        <div className="px-8 py-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-4 text-sm text-muted-foreground">
              {t('auth.or', '또는')}
            </span>
          </div>
        </div>

        {/* 이메일 입력 */}
        <div className="px-8 pt-2 pb-8 space-y-4">
          <Input
            type="email"
            placeholder={t('auth.emailPlaceholder', '이메일 주소')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] rounded-full px-5 text-[15px] border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleEmailContinue();
              }
            }}
            onFocus={() => setFocusedButton(null)}
          />
          <Button
            variant="default"
            className="w-full h-[52px] text-[15px] font-semibold rounded-full bg-primary hover:bg-primary/90 transition-all"
            onClick={handleEmailContinue}
            disabled={isLoading !== null}
          >
            {t('auth.continue', '계속')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LoginPromptModal;
