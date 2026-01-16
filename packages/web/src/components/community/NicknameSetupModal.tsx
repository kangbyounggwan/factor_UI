/**
 * NicknameSetupModal
 * 닉네임이 설정되지 않은 사용자에게 닉네임 입력을 요청하는 모달
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@shared/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NicknameSetupModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentFullName?: string; // 실명이 있으면 초기값으로 사용
  onSuccess?: (nickname: string) => void;
}

export function NicknameSetupModal({
  open,
  onClose,
  userId,
  currentFullName,
  onSuccess,
}: NicknameSetupModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [nickname, setNickname] = useState(currentFullName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      toast({
        title: t('community.nicknameRequired', '닉네임을 입력해주세요'),
        variant: 'destructive',
      });
      return;
    }

    if (nickname.trim().length < 2) {
      toast({
        title: t('community.nicknameTooShort', '닉네임은 2자 이상이어야 합니다'),
        variant: 'destructive',
      });
      return;
    }

    if (nickname.trim().length > 20) {
      toast({
        title: t('community.nicknameTooLong', '닉네임은 20자 이하여야 합니다'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // profiles 테이블에 닉네임 업데이트
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: nickname.trim() })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: t('community.nicknameSet', '닉네임이 설정되었습니다'),
      });

      onSuccess?.(nickname.trim());
      onClose();
    } catch (error) {
      console.error('[NicknameSetupModal] Error setting nickname:', error);
      toast({
        title: t('community.nicknameSetFailed', '닉네임 설정 실패'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('community.setNickname', '닉네임 설정')}
          </DialogTitle>
          <DialogDescription>
            {t('community.setNicknameDesc', '커뮤니티에서 사용할 닉네임을 설정해주세요. 닉네임은 다른 사용자에게 공개됩니다.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">
              {t('community.nickname', '닉네임')}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('community.nicknamePlaceholder', '닉네임을 입력하세요')}
              maxLength={20}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {t('community.nicknameHint', '2~20자, 특수문자 사용 가능')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', '취소')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !nickname.trim()}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('common.save', '저장')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NicknameSetupModal;
