import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@shared/contexts/AuthContext';
import { useDeleteAccount, useAccountDeletionSummary } from '@shared/queries/account';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');

  const { data: summary } = useAccountDeletionSummary(user?.id || '', open);
  const deleteAccount = useDeleteAccount();

  const handleDelete = async () => {
    // Check confirmation text (supports both Korean and English)
    if (confirmText !== 'DELETE' && confirmText !== '삭제') {
      toast({
        title: t('account.deleteError'),
        description: t('account.deleteConfirmError'),
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t('account.deleteError'),
        description: t('account.userNotFound'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await deleteAccount.mutateAsync(user.id);

      if (result.success) {
        toast({
          title: t('account.deleteSuccess'),
          description: t('account.deleteSuccessMessage'),
        });

        // Close dialog
        onOpenChange(false);

        // Sign out and redirect to home
        await signOut();
        navigate('/', { replace: true });
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[DeleteAccountDialog] Error:', error);
      toast({
        title: t('account.deleteError'),
        description: error.message || t('account.deleteGenericError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md mx-4 max-h-[85vh] p-4 sm:p-6 flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('account.deleteTitle')}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <AlertDialogDescription className="space-y-3 text-left">
            <p className="text-xs sm:text-sm">{t('account.deleteWarning')}</p>

            {summary && (summary.printersCount > 0 || summary.clientsCount > 0 || summary.aiImagesCount > 0 || summary.camerasCount > 0) && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>
                  <div className="space-y-1 text-xs sm:text-sm">
                    <p className="font-semibold">{t('account.deleteWillRemove')}:</p>
                    <ul className="list-disc list-inside space-y-0.5 mt-1.5">
                      {summary.printersCount > 0 && (
                        <li>{t('account.printersCount', { count: summary.printersCount })}</li>
                      )}
                      {summary.clientsCount > 0 && (
                        <li>{t('account.clientsCount', { count: summary.clientsCount })}</li>
                      )}
                      {summary.aiImagesCount > 0 && (
                        <li>{t('account.aiImagesCount', { count: summary.aiImagesCount })}</li>
                      )}
                      {summary.camerasCount > 0 && (
                        <li>{t('account.camerasCount', { count: summary.camerasCount })}</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5 mt-3">
              <Label htmlFor="confirm-delete" className="text-xs sm:text-sm font-medium">
                {t('account.deleteConfirmLabel')}
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('account.deleteConfirmPlaceholder')}
                className="border-destructive focus:ring-destructive h-9 sm:h-10 text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {t('account.deleteConfirmHint')}
              </p>
            </div>
          </AlertDialogDescription>
        </div>

        <AlertDialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel disabled={deleteAccount.isPending} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
            className="w-full sm:w-auto h-9 sm:h-10 text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {deleteAccount.isPending && (
              <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            )}
            {t('account.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
