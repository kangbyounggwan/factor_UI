import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
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

const SocialAccountLinking = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [providerToUnlink, setProviderToUnlink] = useState<string | null>(null);

  const socialProviders = [
    {
      id: "google",
      name: "Google",
      icon: "https://www.google.com/favicon.ico",
      description: t("userSettings.linkGoogleDescription", "구글 계정으로 간편하게 로그인하세요"),
    },
  ];

  useEffect(() => {
    loadLinkedProviders();
  }, [user]);

  const loadLinkedProviders = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.getUserIdentities();

      if (error) throw error;

      const providers = data?.identities?.map(identity => identity.provider) || [];
      setLinkedProviders(providers);
    } catch (error) {
      console.error('Error loading linked providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAccount = async (provider: string) => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as any,
      });

      if (error) throw error;

      toast({
        title: t("common.success", "성공"),
        description: t("userSettings.linkSuccess", "소셜 계정이 연동되었습니다."),
      });

      await loadLinkedProviders();
    } catch (error: any) {
      console.error('Error linking account:', error);
      toast({
        title: t("userSettings.linkFailed", "연동 실패"),
        description: error.message || t("userSettings.linkFailedDescription", "소셜 계정 연동에 실패했습니다."),
        variant: "destructive",
      });
    }
  };

  const handleUnlinkAccount = async (provider: string) => {
    setProviderToUnlink(provider);
    setShowUnlinkDialog(true);
  };

  const confirmUnlink = async () => {
    if (!providerToUnlink) return;

    try {
      setUnlinkingProvider(providerToUnlink);

      const { data } = await supabase.auth.getUserIdentities();
      const identity = data?.identities?.find(i => i.provider === providerToUnlink);

      if (!identity) throw new Error("Identity not found");

      const { error } = await supabase.auth.unlinkIdentity(identity);

      if (error) throw error;

      toast({
        title: t("userSettings.unlinkSuccess", "연동 해제 완료"),
        description: t("userSettings.unlinkSuccessDescription", "소셜 계정 연동이 해제되었습니다."),
      });

      await loadLinkedProviders();
    } catch (error: any) {
      console.error('Error unlinking account:', error);
      toast({
        title: t("userSettings.unlinkFailed", "연동 해제 실패"),
        description: error.message || t("userSettings.unlinkFailedDescription", "소셜 계정 연동 해제에 실패했습니다."),
        variant: "destructive",
      });
    } finally {
      setUnlinkingProvider(null);
      setShowUnlinkDialog(false);
      setProviderToUnlink(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">
          {t("userSettings.socialAccounts", "소셜 계정 연동")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("userSettings.socialAccountsDescription", "소셜 계정을 연동하여 간편하게 로그인하세요")}
        </p>
      </div>

      {/* 소셜 계정 목록 */}
      <div className="flex-1 px-6 pb-8">
        <div className="space-y-4">
          {socialProviders.map((provider) => {
            const isLinked = linkedProviders.includes(provider.id);
            const isUnlinking = unlinkingProvider === provider.id;

            return (
              <div
                key={provider.id}
                className="bg-card rounded-xl border p-6 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* 프로바이더 아이콘 */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <img src={provider.icon} alt={provider.name} className="w-6 h-6" />
                    </div>

                    {/* 프로바이더 정보 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold mb-1">{provider.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {provider.description}
                      </p>

                      {/* 상태 표시 */}
                      {isLinked && (
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Check className="h-4 w-4" />
                          <span>{t("userSettings.linkedAccount", "연동됨")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 연동/해제 버튼 */}
                  <div className="flex-shrink-0">
                    {isLinked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlinkAccount(provider.id)}
                        disabled={isUnlinking}
                        className="min-w-[80px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300"
                      >
                        {isUnlinking ? (
                          <>
                            <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            {t("common.loading", "처리중")}
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            {t("userSettings.unlinkAccount", "연동 해제")}
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleLinkAccount(provider.id)}
                        className="min-w-[80px]"
                      >
                        {t("userSettings.linkAccount", "연동")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 안내 문구 */}
        <div className="mt-6 p-4 bg-muted/50 rounded-xl border">
          <p className="text-sm text-muted-foreground">
            💡 {t("userSettings.socialAccountNote", "소셜 계정을 연동하면 이메일과 비밀번호 없이도 간편하게 로그인할 수 있습니다.")}
          </p>
        </div>
      </div>

      {/* 연동 해제 확인 다이얼로그 */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("userSettings.unlinkConfirmTitle", "소셜 계정 연동을 해제하시겠습니까?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("userSettings.unlinkConfirmDescription", "연동을 해제하면 이메일과 비밀번호로 로그인해야 합니다.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlink}>
              {t("userSettings.unlinkAccount", "연동 해제")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SocialAccountLinking;
