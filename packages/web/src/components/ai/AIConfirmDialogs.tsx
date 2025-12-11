import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { PrinterData } from "@/types/ai";

// 1. Upgrade Prompt Dialog
interface UpgradePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    monthlyAiUsage: number;
    aiLimit: number | string;
    userPlan: string;
}

export function UpgradePromptDialog({
    open,
    onOpenChange,
    monthlyAiUsage,
    aiLimit,
    userPlan
}: UpgradePromptDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('ai.upgradeRequired')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('ai.upgradeDescription', {
                            limit: aiLimit === 'unlimited' ? '∞' : aiLimit,
                            used: monthlyAiUsage,
                            plan: userPlan.toUpperCase()
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => window.location.href = '/user-settings?tab=subscription'}>
                        {t('ai.upgradePlan')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// 2. Printer Selection Confirm Dialog
interface PrinterConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    printer: PrinterData | null;
    onConfirm: () => void;
}

export function PrinterConfirmDialog({
    open,
    onOpenChange,
    printer,
    onConfirm
}: PrinterConfirmDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('ai.printPreparation')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('ai.printPreparationMessage', {
                            printer: printer?.model || printer?.name
                        })}
                        <br /><br />
                        {t('ai.continueQuestion')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        {t('common.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// 3. Delete Image Confirm Dialog
interface DeleteImageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    linkedModelsCount: number;
    onConfirm: () => void;
}

export function DeleteImageDialog({
    open,
    onOpenChange,
    linkedModelsCount,
    onConfirm
}: DeleteImageDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('ai.deleteImageConfirm')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {linkedModelsCount > 0 ? (
                            <>
                                {t('ai.imageWithModelsDeleted')} {linkedModelsCount}{t('ai.linkedModelsWillBeDeleted')}
                                <br />
                                <span className="text-destructive font-semibold mt-2 block">
                                    {t('ai.linkedModelsDeleteWarning2')}
                                </span>
                            </>
                        ) : (
                            t('ai.fileDeletedDescription')
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
                        {t('common.delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
