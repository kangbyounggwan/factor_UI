/**
 * 로그인 유도 모달
 * 비로그인 사용자가 저장/히스토리 등의 기능을 사용하려 할 때 표시
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

interface LoginPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  feature?: 'save' | 'history' | 'download' | 'compare' | 'general';
}

export function LoginPromptModal({
  open,
  onOpenChange,
  title,
  description,
  feature = 'general',
}: LoginPromptModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 기능별 기본 메시지
  const getDefaultMessages = () => {
    switch (feature) {
      case 'save':
        return {
          title: t('loginPrompt.saveTitle', '분석 결과를 저장하시겠어요?'),
          description: t('loginPrompt.saveDescription', '로그인하면 분석 결과를 저장하고 언제든 다시 확인할 수 있어요.'),
        };
      case 'history':
        return {
          title: t('loginPrompt.historyTitle', '분석 히스토리를 확인하시겠어요?'),
          description: t('loginPrompt.historyDescription', '로그인하면 이전 분석 결과들을 모두 확인할 수 있어요.'),
        };
      case 'download':
        return {
          title: t('loginPrompt.downloadTitle', '리포트를 다운로드하시겠어요?'),
          description: t('loginPrompt.downloadDescription', '로그인하면 상세 리포트를 PDF로 다운로드할 수 있어요.'),
        };
      case 'compare':
        return {
          title: t('loginPrompt.compareTitle', '분석 결과를 비교하시겠어요?'),
          description: t('loginPrompt.compareDescription', '로그인하면 여러 분석 결과를 비교할 수 있어요.'),
        };
      default:
        return {
          title: t('loginPrompt.generalTitle', '로그인이 필요합니다'),
          description: t('loginPrompt.generalDescription', '이 기능을 사용하려면 로그인이 필요해요.'),
        };
    }
  };

  const messages = getDefaultMessages();

  const handleLogin = () => {
    onOpenChange(false);
    navigate('/auth', { state: { returnTo: window.location.pathname } });
  };

  const handleLater = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            {title || messages.title}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {description || messages.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex flex-col gap-3">
            {/* 로그인 혜택 안내 */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-2">
                {t('loginPrompt.benefits', '로그인하면 이런 기능을 사용할 수 있어요')}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('loginPrompt.benefit1', '분석 결과 저장 및 관리')}</li>
                <li>• {t('loginPrompt.benefit2', '분석 히스토리 조회')}</li>
                <li>• {t('loginPrompt.benefit3', '상세 리포트 다운로드')}</li>
                <li>• {t('loginPrompt.benefit4', '프린터 등록 및 관리')}</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleLater}
            className="flex-1 sm:flex-none"
          >
            {t('loginPrompt.later', '나중에')}
          </Button>
          <Button
            onClick={handleLogin}
            className="flex-1 sm:flex-none gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t('loginPrompt.login', '로그인하기')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LoginPromptModal;
