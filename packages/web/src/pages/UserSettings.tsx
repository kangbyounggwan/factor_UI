import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar, type SettingsTab } from "@/components/common/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import { type SubscriptionPlan } from "@shared/types/subscription";
import { getUserPaymentHistory, upsertUserSubscription, type PaymentHistory } from "@shared/services/supabaseService/subscription";
import { getUserPaymentMethods, formatCardDisplay, formatCardExpiry, type PaymentMethod } from "@shared/services/supabaseService/paymentMethod";
import {
  initializePaddleService,
  openPaddleCheckout,
  getPaddlePriceId,
} from "@/lib/paddleService";
import {
  Check,
  Crown,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Mail,
  RefreshCw,
} from "lucide-react";
// Tab Components
import { ProfileTab } from "@/components/UserSettings/ProfileTab";
import { AccountTab } from "@/components/UserSettings/AccountTab";
import { SubscriptionTab } from "@/components/UserSettings/SubscriptionTab";
import { NotificationsTab } from "@/components/UserSettings/NotificationsTab";
import { ApiKeysTab } from "@/components/UserSettings/ApiKeysTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createApiKey,
  getApiKeys,
  deleteApiKey,
  toggleApiKeyStatus,
  renameApiKey,
  type ApiKey,
} from "@shared/services/supabaseService/apiKeys";
import { useSidebarState } from "@/hooks/useSidebarState";

// 한국 사용자 감지 (언어 또는 타임존 기반)
const isKoreanUser = () => {
  const lang = navigator.language || navigator.languages?.[0] || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  return lang.startsWith('ko') || timezone === 'Asia/Seoul';
};

// 통화별 가격 설정
const PLAN_PRICES = {
  USD: {
    starter: { monthly: 3.5, yearly: 35, monthlyEquivalent: 2.92 },
    pro: { monthly: 15, yearly: 150, monthlyEquivalent: 12.50 },
  },
  KRW: {
    starter: { monthly: 4900, yearly: 49000, monthlyEquivalent: 4083 },
    pro: { monthly: 22900, yearly: 229000, monthlyEquivalent: 19083 },
  },
};

const UserSettings = () => {
  const { user, signOut, linkGoogleAccount, unlinkProvider } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isKorea] = useState(() => isKoreanUser()); // 한국 사용자 여부

  // 통화에 따른 가격 포맷팅
  const formatPlanPrice = (amount: number) => {
    if (isKorea) {
      return `₩${amount.toLocaleString('ko-KR')}`;
    }
    return `$${amount.toLocaleString('en-US')}`;
  };

  const prices = isKorea ? PLAN_PRICES.KRW : PLAN_PRICES.USD;

  // Get tab from URL parameter, default to 'profile'
  const defaultTab = (searchParams.get('tab') || 'profile') as SettingsTab;
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  // URL 파라미터로 플랜 모달 자동 열기 (Subscription 페이지에서 업그레이드 클릭 시)
  const shouldOpenPlanModal = searchParams.get('openPlanModal') === 'true';

  // Form states
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [originalProfile, setOriginalProfile] = useState({ fullName: "", displayName: "", phone: "" });

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [printCompleteNotif, setPrintCompleteNotif] = useState(true);
  const [errorNotif, setErrorNotif] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);

  // Original notification settings for cancel functionality
  const [originalNotifications, setOriginalNotifications] = useState({
    email: false,
    push: true,
    printComplete: true,
    error: true,
    weekly: false,
  });

  // Check if Google is linked
  const googleIdentity = user?.identities?.find(
    (id) => id.provider === "google",
  );
  const isGoogleLinked = !!googleIdentity;

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('free');
  const [subscriptionData, setSubscriptionData] = useState<{
    price: number;
    billingCycle: string;
    nextBillingDate: string | null;
  } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Modal states
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showBillingHistoryModal, setShowBillingHistoryModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showDowngradeWarningModal, setShowDowngradeWarningModal] = useState(false);

  // Payment data states
  const [allPaymentHistory, setAllPaymentHistory] = useState<PaymentHistory[]>([]); // 전체 데이터 캐시
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Paddle states
  const [paddleReady, setPaddleReady] = useState(false);
  const [paddleLoading, setPaddleLoading] = useState(false);
  const [starterBillingCycle, setStarterBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [proBillingCycle, setProBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // API Keys states
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [showCreateApiKeyModal, setShowCreateApiKeyModal] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState("");
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  // 클라이언트 사이드 페이지네이션 - 현재 페이지의 데이터만 계산
  const paginatedPaymentHistory = allPaymentHistory.slice(
    (paymentHistoryPage - 1) * ITEMS_PER_PAGE,
    paymentHistoryPage * ITEMS_PER_PAGE
  );

  // URL 파라미터로 플랜 모달 자동 열기
  useEffect(() => {
    if (shouldOpenPlanModal && !loadingPlan) {
      setShowChangePlanModal(true);
      // URL에서 파라미터 제거 (뒤로가기 시 다시 열리지 않도록)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('openPlanModal');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [shouldOpenPlanModal, loadingPlan]);

  // 플랜 모달이 열릴 때 paddleLoading 리셋 (결제창에서 돌아왔을 때)
  useEffect(() => {
    if (showChangePlanModal) {
      setPaddleLoading(false);
    }
  }, [showChangePlanModal]);

  // Load profile data from DB (including phone)
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      try {
        setLoadingProfile(true);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, display_name, phone, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && profile) {
          const fn = profile.full_name || user.user_metadata?.full_name || "";
          const dn = profile.display_name || "";
          const ph = profile.phone || "";
          setFullName(fn);
          setDisplayName(dn);
          setPhone(ph);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          setOriginalProfile({ fullName: fn, displayName: dn, phone: ph });
        } else {
          // Fallback to user_metadata
          const fn = user.user_metadata?.full_name || "";
          setFullName(fn);
          setDisplayName("");
          if (user.user_metadata?.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
          setOriginalProfile({ fullName: fn, displayName: "", phone: "" });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  // Load subscription data from Supabase
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user) return;

      try {
        setLoadingPlan(true);

        const { data: subscription, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error || !subscription) {
          // No active subscription - use free plan
          setCurrentPlan('free');
          setSubscriptionData({
            price: 0,
            billingCycle: "free",
            nextBillingDate: null,
          });
          return;
        }

        // Map plan from database to SubscriptionPlan type
        const planName = subscription.plan_name?.toLowerCase() || 'free';
        const validPlan: SubscriptionPlan = ['free', 'pro', 'enterprise'].includes(planName)
          ? planName as SubscriptionPlan
          : 'free';

        // Plan pricing info (USD)
        const planPricing = {
          free: { price: 0 },
          pro: { price: 19 }, // $19/month
          enterprise: { price: -1 } // Contact Sales
        };

        setCurrentPlan(validPlan);
        setSubscriptionData({
          price: planPricing[validPlan].price,
          billingCycle: subscription.current_period_end ? "month" : "free",
          nextBillingDate: subscription.current_period_end,
        });
      } catch (error) {
        console.error("Error loading subscription:", error);
        setCurrentPlan('free');
        setSubscriptionData({
          price: 0,
          billingCycle: "free",
          nextBillingDate: null,
        });
      } finally {
        setLoadingPlan(false);
      }
    };

    loadSubscription();
  }, [user]);

  // Load payment data (history and methods) - 한 번만 로드
  useEffect(() => {
    const loadPaymentData = async () => {
      if (!user) {
        setAllPaymentHistory([]);
        setPaymentMethods([]);
        return;
      }

      try {
        setLoadingPaymentData(true);

        // 결제 내역은 항상 로드 (과거 결제 기록 표시를 위해)
        const historyResult = await getUserPaymentHistory(user.id, 100, 0);
        setAllPaymentHistory(historyResult.data);

        // 결제 수단은 유료 구독이 있을 때만 로드
        if (subscriptionData && subscriptionData.price > 0) {
          const methodsResult = await getUserPaymentMethods();
          setPaymentMethods(methodsResult);
        } else {
          setPaymentMethods([]);
        }
      } catch (error) {
        console.error("Error loading payment data:", error);
      } finally {
        setLoadingPaymentData(false);
      }
    };

    loadPaymentData();
  }, [user, subscriptionData]); // paymentHistoryPage 제거 - 페이지 변경 시 재로드 안함

  // Load notification settings from Supabase
  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!user) return;

      try {
        setLoadingNotifications(true);

        const { data, error } = await supabase
          .from("user_notification_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error loading notification settings:", error);
          return;
        }

        if (data) {
          const settings = {
            push: data.push_notifications ?? true,
            printComplete: data.print_complete_notifications ?? true,
            error: data.error_notifications ?? true,
            email: data.email_notifications ?? false,
            weekly: data.weekly_report ?? false,
          };

          setPushNotifications(settings.push);
          setPrintCompleteNotif(settings.printComplete);
          setErrorNotif(settings.error);
          setEmailNotifications(settings.email);
          setWeeklyReport(settings.weekly);
          setOriginalNotifications(settings);
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
      } finally {
        setLoadingNotifications(false);
      }
    };

    loadNotificationSettings();
  }, [user]);

  // Paddle checkout handlers
  const handlePaddleCheckoutComplete = useCallback(() => {
    console.log('[UserSettings] Paddle checkout completed');
    setShowChangePlanModal(false);
    setPaddleLoading(false);
    toast({
      title: t("pricing.success.title", "Subscription activated!"),
      description: t("pricing.success.description", "Thank you for subscribing. Your plan is now active."),
    });
    // Refresh subscription data
    window.location.reload();
  }, [toast, t]);

  const handlePaddleCheckoutClose = useCallback(() => {
    console.log('[UserSettings] Paddle checkout closed');
    setPaddleLoading(false);
  }, []);

  const handlePaddleCheckoutError = useCallback(() => {
    console.error('[UserSettings] Paddle checkout error');
    setPaddleLoading(false);
    toast({
      title: t("payment.error", "Payment failed"),
      description: t("payment.requestFailed", "Please try again or contact support."),
      variant: "destructive",
    });
  }, [toast, t]);

  // Initialize Paddle
  useEffect(() => {
    const initPaddle = async () => {
      const paddle = await initializePaddleService({
        onCheckoutComplete: handlePaddleCheckoutComplete,
        onCheckoutClose: handlePaddleCheckoutClose,
        onCheckoutError: handlePaddleCheckoutError,
      });
      setPaddleReady(!!paddle);
    };

    initPaddle();
  }, [handlePaddleCheckoutComplete, handlePaddleCheckoutClose, handlePaddleCheckoutError]);

  // Load API Keys
  useEffect(() => {
    const loadApiKeys = async () => {
      if (!user) {
        setLoadingApiKeys(false);
        return;
      }

      try {
        setLoadingApiKeys(true);
        const keys = await getApiKeys();
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
      } finally {
        setLoadingApiKeys(false);
      }
    };

    loadApiKeys();
  }, [user]);

  // API Key handlers
  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast({
        title: t("apiKeys.error.nameRequired", "Name required"),
        description: t("apiKeys.error.enterName", "Please enter a name for the API key."),
        variant: "destructive",
      });
      return;
    }

    setCreatingApiKey(true);
    try {
      const result = await createApiKey(newApiKeyName.trim());
      if (result.success && result.apiKey) {
        setNewlyCreatedKey(result.apiKey);
        setShowCreateApiKeyModal(false);
        setShowNewKeyModal(true);
        setNewApiKeyName("");
        // Reload API keys
        const keys = await getApiKeys();
        setApiKeys(keys);
        toast({
          title: t("apiKeys.created", "API key created"),
          description: t("apiKeys.createdDesc", "Your new API key has been created successfully."),
        });
      } else {
        toast({
          title: t("apiKeys.error.createFailed", "Failed to create"),
          description: result.error || t("apiKeys.error.tryAgain", "Please try again."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: t("apiKeys.error.createFailed", "Failed to create"),
        description: t("apiKeys.error.tryAgain", "Please try again."),
        variant: "destructive",
      });
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      const result = await deleteApiKey(keyId);
      if (result.success) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
        toast({
          title: t("apiKeys.deleted", "API key deleted"),
          description: t("apiKeys.deletedDesc", "The API key has been deleted."),
        });
      } else {
        toast({
          title: t("apiKeys.error.deleteFailed", "Failed to delete"),
          description: result.error || t("apiKeys.error.tryAgain", "Please try again."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
    setDeletingKeyId(null);
  };

  const handleToggleApiKey = async (keyId: string, isActive: boolean) => {
    try {
      const result = await toggleApiKeyStatus(keyId, isActive);
      if (result.success) {
        setApiKeys(prev => prev.map(k =>
          k.id === keyId ? { ...k, is_active: isActive } : k
        ));
        toast({
          title: isActive ? t("apiKeys.activated", "API key activated") : t("apiKeys.deactivated", "API key deactivated"),
        });
      }
    } catch (error) {
      console.error('Error toggling API key:', error);
    }
  };

  const handleRenameApiKey = async (keyId: string) => {
    if (!editingKeyName.trim()) return;

    try {
      const result = await renameApiKey(keyId, editingKeyName.trim());
      if (result.success) {
        setApiKeys(prev => prev.map(k =>
          k.id === keyId ? { ...k, name: editingKeyName.trim() } : k
        ));
        toast({
          title: t("apiKeys.renamed", "API key renamed"),
        });
      } else {
        toast({
          title: t("apiKeys.error.renameFailed", "Failed to rename"),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error renaming API key:', error);
    }
    setEditingKeyId(null);
    setEditingKeyName("");
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t("common.copied", "Copied!"),
        description: t("apiKeys.copiedToClipboard", "API key copied to clipboard."),
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Handle Starter plan upgrade with Paddle
  const handleStarterUpgrade = async (cycle: 'monthly' | 'yearly' = 'monthly') => {
    if (!paddleReady) {
      toast({
        title: t("pricing.error.notReady", "Payment system loading"),
        description: t("pricing.error.tryAgain", "Please wait a moment and try again."),
        variant: "destructive",
      });
      return;
    }

    const priceId = getPaddlePriceId('starter', cycle === 'yearly');

    if (!priceId) {
      toast({
        title: t("pricing.error.configError", "Configuration error"),
        description: t("pricing.error.contactSupport", "Please contact support."),
        variant: "destructive",
      });
      return;
    }

    setPaddleLoading(true);

    try {
      await openPaddleCheckout({
        priceId,
        customerEmail: user?.email,
        customData: user?.id ? { user_id: user.id } : undefined,
        locale: 'en',
        successUrl: `${window.location.origin}/payment/success?provider=paddle&plan=starter`,
      });
    } catch (error) {
      console.error('[UserSettings] Failed to open Paddle checkout:', error);
      setPaddleLoading(false);
      toast({
        title: t("payment.error", "Payment failed"),
        description: t("payment.requestFailed", "Please try again or contact support."),
        variant: "destructive",
      });
    }
  };

  // Handle Pro plan upgrade with Paddle
  const handleProUpgrade = async (cycle: 'monthly' | 'yearly' = 'monthly') => {
    if (!paddleReady) {
      toast({
        title: t("pricing.error.notReady", "Payment system loading"),
        description: t("pricing.error.tryAgain", "Please wait a moment and try again."),
        variant: "destructive",
      });
      return;
    }

    const priceId = getPaddlePriceId('pro', cycle === 'yearly');

    if (!priceId) {
      toast({
        title: t("pricing.error.configError", "Configuration error"),
        description: t("pricing.error.contactSupport", "Please contact support."),
        variant: "destructive",
      });
      return;
    }

    setPaddleLoading(true);

    try {
      await openPaddleCheckout({
        priceId,
        customerEmail: user?.email,
        customData: user?.id ? { user_id: user.id } : undefined,
        locale: 'en',
        successUrl: `${window.location.origin}/payment/success?provider=paddle&plan=pro`,
      });
    } catch (error) {
      console.error('[UserSettings] Failed to open Paddle checkout:', error);
      setPaddleLoading(false);
      toast({
        title: t("payment.error", "Payment failed"),
        description: t("payment.requestFailed", "Please try again or contact support."),
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "최대 2MB까지 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error updating profile avatar:', profileError);
      }

      // Refresh user metadata
      await supabase.auth.getUser();

      setAvatarUrl(publicUrl);
      toast({
        title: "프로필 사진 업데이트 완료",
        description: "프로필 사진이 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "업로드 실패",
        description: "프로필 사진 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      // 1. Update auth user_metadata (실명 저장)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
        }
      });

      if (authError) throw authError;

      // 2. Update profiles table (실명 + 닉네임 + 전화번호)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName,
          display_name: displayName || null,
          phone: phone || null,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      setOriginalProfile({ fullName, displayName, phone });
      setIsEditingProfile(false);
      toast({
        title: t("userSettings.profileUpdated"),
        description: t("userSettings.profileUpdatedDesc"),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "업데이트 실패",
        description: "프로필 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleLinkGoogle = async () => {
    const { error } = await linkGoogleAccount();
    if (error) {
      console.error("Failed to link Google account:", error);
      toast({
        title: t("userSettings.linkFailed"),
        description: t("userSettings.linkFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleUnlinkGoogle = async () => {
    const { error } = await unlinkProvider("google");
    if (error) {
      console.error("Failed to unlink Google account:", error);
      toast({
        title: t("userSettings.unlinkFailed"),
        description: t("userSettings.unlinkFailedDescription"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("userSettings.unlinkSuccess"),
        description: t("userSettings.unlinkSuccessDescription"),
      });
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleDeleteAccount = async () => {
    console.log("Deleting account...");
    await signOut();
    navigate("/", { replace: true });
  };

  // Save notification settings to Supabase
  const handleSaveNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_notification_settings")
        .update({
          push_notifications: pushNotifications,
          print_complete_notifications: printCompleteNotif,
          error_notifications: errorNotif,
          email_notifications: emailNotifications,
          weekly_report: weeklyReport,
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating notification settings:", error);
        toast({
          title: t("common.error"),
          description: "알림 설정 업데이트에 실패했습니다.",
          variant: "destructive",
        });
      } else {
        setOriginalNotifications({
          email: emailNotifications,
          push: pushNotifications,
          printComplete: printCompleteNotif,
          error: errorNotif,
          weekly: weeklyReport,
        });
        setIsEditingNotifications(false);
        toast({
          title: t("common.success"),
          description: "알림 설정이 저장되었습니다.",
        });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  // 사이드바 상태 (페이지 간 공유)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* App Sidebar with Settings Menu */}
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        onSignOut={signOut}
        mode="settings"
        activeSettingsTab={activeTab}
        onSettingsTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* App Header */}
        <AppHeader sidebarOpen={sidebarOpen} />

        {/* Main Content Area */}
        <div className="flex-1 flex justify-center overflow-y-auto">
          <div className="py-8 px-8 w-full max-w-5xl">

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            fullName={fullName}
            setFullName={setFullName}
            displayName={displayName}
            setDisplayName={setDisplayName}
            email={email}
            phone={phone}
            setPhone={setPhone}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            isEditingProfile={isEditingProfile}
            setIsEditingProfile={setIsEditingProfile}
            uploadingAvatar={uploadingAvatar}
            setUploadingAvatar={setUploadingAvatar}
            originalProfile={originalProfile}
            onSaveProfile={handleSaveProfile}
            onAvatarUpload={handleAvatarUpload}
          />
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <AccountTab
            user={user}
            isGoogleLinked={isGoogleLinked}
            googleIdentity={googleIdentity}
            onLinkGoogle={handleLinkGoogle}
            onUnlinkGoogle={handleUnlinkGoogle}
            onDeleteAccount={handleDeleteAccount}
            onSignOut={signOut}
          />
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-8">
            {loadingPlan ? (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <div className="text-sm text-muted-foreground">
                    {t("userSettings.loadingSubscription")}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Current Plan Section */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">{t("userSettings.currentPlan")}</h2>
                    <p className="text-muted-foreground">
                      {t("userSettings.subscriptionDescription")}
                    </p>
                  </div>

                  <Card className="overflow-hidden border-2">
                    <CardContent className="p-0">
                      <div className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center justify-between mb-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge className="text-base px-4 py-1.5 capitalize bg-primary hover:bg-primary">
                                <Crown className="h-4 w-4 mr-2" />
                                {currentPlan} {t("userSettings.plan")}
                              </Badge>
                            </div>
                            {subscriptionData && subscriptionData.price > 0 ? (
                              <>
                                <p className="text-3xl font-bold">
                                  ₩{subscriptionData.price.toLocaleString()}
                                  <span className="text-base font-normal text-muted-foreground ml-2">
                                    /{" "}
                                    {subscriptionData.billingCycle === "year"
                                      ? t("userSettings.perYear")
                                      : t("userSettings.perMonth")}
                                  </span>
                                </p>
                                {subscriptionData.nextBillingDate && (
                                  <p className="text-sm text-muted-foreground">
                                    {t("userSettings.nextBillingDate")}:{" "}
                                    {new Date(
                                      subscriptionData.nextBillingDate,
                                    ).toLocaleDateString("ko-KR")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-3xl font-bold">
                                ₩0
                                <span className="text-base font-normal text-muted-foreground ml-2">
                                  / 월
                                </span>
                              </p>
                            )}
                          </div>
                          <Button size="lg" onClick={() => setShowChangePlanModal(true)} className="h-11">
                            {currentPlan === 'free' ? t("userSettings.upgradePlan") : t("subscription.viewAllPlans")}
                          </Button>
                        </div>

                        {/* Plan Features */}
                        <div className="border-t pt-6">
                          <h4 className="font-semibold mb-4 text-sm text-muted-foreground">플랜 포함 사항</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {currentPlan === 'free' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>기본 AI 모델</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>60분 이상 감지 간격</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>최대 1대 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>월 5개 3D 모델링</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>API 일부 제한</span>
                                </div>
                              </>
                            )}
                            {currentPlan === 'starter' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-amber-500 shrink-0" />
                                  <span className="font-medium text-amber-700 dark:text-amber-400">고급 AI 모델</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-amber-500 shrink-0" />
                                  <span className="font-medium text-amber-700 dark:text-amber-400">60분 이상 감지 간격</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>최대 1대 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>월 20개 3D 모델링</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>API 일부 제한</span>
                                </div>
                              </>
                            )}
                            {currentPlan === 'pro' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span className="font-medium text-blue-700 dark:text-blue-400">고급 AI 모델</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span className="font-medium text-blue-700 dark:text-blue-400">10분 이상 감지 간격</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>최대 5대 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>월 50개 3D 모델링</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>API 전체 접근</span>
                                </div>
                              </>
                            )}
                            {currentPlan === 'enterprise' && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-purple-500 shrink-0" />
                                  <span className="font-medium text-purple-700 dark:text-purple-400">고급 AI 모델</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-purple-500 shrink-0" />
                                  <span className="font-medium text-purple-700 dark:text-purple-400">실시간 이상 감지</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 프린터 연결</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>무제한 3D 모델링</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                  <span>API 전체 접근</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Refund Policy Link */}
                  <div className="flex justify-center">
                    <Button
                      variant="link"
                      className="text-sm text-muted-foreground"
                      onClick={() => navigate('/refund-policy')}
                    >
                      {t('userSettings.refundPolicyButton')}
                    </Button>
                  </div>
                </div>

                {/* Billing Management Section */}
                {subscriptionData && (
                  <>
                    {/* Past Invoices */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.billingHistory')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.billingHistoryDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-0">
                          {loadingPaymentData ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.loadingPaymentData')}
                            </div>
                          ) : allPaymentHistory.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.noPaymentHistory')}
                            </div>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.date')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.amount')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.invoiceNumber')}</th>
                                      <th className="text-left p-4 font-medium text-sm">{t('userSettings.status')}</th>
                                      <th className="text-right p-4 font-medium text-sm"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedPaymentHistory.map((payment) => (
                                      <tr key={payment.id} className="border-b hover:bg-muted/30">
                                        <td className="p-4 text-sm">
                                          {new Date(payment.paid_at || payment.created_at).toLocaleDateString("ko-KR", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric"
                                          })}
                                        </td>
                                        <td className="p-4 text-sm">
                                          ₩{payment.amount.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm font-mono">
                                          {payment.order_id || payment.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="p-4">
                                          <Badge
                                            variant={
                                              payment.status === 'success' ? 'default' :
                                              payment.status === 'pending' ? 'secondary' :
                                              payment.status === 'failed' ? 'destructive' :
                                              payment.status === 'refunded' ? 'outline' :
                                              'secondary'
                                            }
                                            className="text-xs"
                                          >
                                            {payment.status === 'success' ? '완료' :
                                             payment.status === 'pending' ? '대기중' :
                                             payment.status === 'failed' ? '실패' :
                                             payment.status === 'refunded' ? '환불' :
                                             payment.status === 'canceled' ? '취소' :
                                             payment.status}
                                          </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                          {payment.receipt_url && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => window.open(payment.receipt_url!, '_blank')}
                                            >
                                              영수증
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="p-4 border-t">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-muted-foreground">
                                    Showing {((paymentHistoryPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(paymentHistoryPage * ITEMS_PER_PAGE, allPaymentHistory.length)} out of {allPaymentHistory.length} invoices
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPaymentHistoryPage(prev => Math.max(1, prev - 1))}
                                      disabled={paymentHistoryPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPaymentHistoryPage(prev => prev + 1)}
                                      disabled={paymentHistoryPage * ITEMS_PER_PAGE >= allPaymentHistory.length}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.paymentMethods')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.paymentMethodsDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6">
                          {loadingPaymentData ? (
                            <div className="p-8 text-center text-muted-foreground">
                              {t('userSettings.loadingPaymentMethods')}
                            </div>
                          ) : paymentMethods.length === 0 ? (
                            <div className="p-8 text-center">
                              <p className="text-muted-foreground mb-4">{t('userSettings.noPaymentMethods')}</p>
                              <Button
                                variant="outline"
                                onClick={() => setShowPaymentMethodModal(true)}
                              >
                                {t('userSettings.addPaymentMethod')}
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3">
                                {paymentMethods.map((method) => (
                                  <div
                                    key={method.id}
                                    className="flex items-center justify-between p-4 rounded-lg border"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                                        <CreditCard className="h-5 w-5 text-white" />
                                      </div>
                                      <div>
                                        <p className="font-medium">{formatCardDisplay(method)}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {method.card_type && `${method.card_type} · `}{formatCardExpiry(method) && `만료: ${formatCardExpiry(method)}`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button variant="ghost" size="icon">
                                        <span className="text-xl">⋯</span>
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Button
                                variant="outline"
                                className="w-full mt-4"
                                onClick={() => setShowPaymentMethodModal(true)}
                              >
                                + 새 카드 추가
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Credit Balance */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{t('userSettings.creditBalance')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('userSettings.creditBalanceDesc')}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">잔액</p>
                              <p className="text-3xl font-bold">₩0.00</p>
                            </div>
                            <Button variant="outline">충전하기</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Email Recipient */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">이메일 수신자</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          모든 청구 관련 안내는 이 이메일로 발송됩니다.
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-6 space-y-4">
                          <div>
                            <Label htmlFor="email">이메일 주소</Label>
                            <Input
                              id="email"
                              type="email"
                              value={user?.email || ''}
                              disabled
                              className="mt-2"
                            />
                          </div>

                          <div>
                            <Label htmlFor="additional-emails">추가 이메일</Label>
                            <Input
                              id="additional-emails"
                              type="email"
                              placeholder="추가 수신자 입력"
                              className="mt-2"
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-4">
                            <Button variant="outline">취소</Button>
                            <Button>저장</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <NotificationsTab
            currentPlan={currentPlan}
            emailNotifications={emailNotifications}
            setEmailNotifications={setEmailNotifications}
            pushNotifications={pushNotifications}
            setPushNotifications={setPushNotifications}
            printCompleteNotif={printCompleteNotif}
            setPrintCompleteNotif={setPrintCompleteNotif}
            errorNotif={errorNotif}
            setErrorNotif={setErrorNotif}
            weeklyReport={weeklyReport}
            setWeeklyReport={setWeeklyReport}
            loadingNotifications={loadingNotifications}
            isEditingNotifications={isEditingNotifications}
            setIsEditingNotifications={setIsEditingNotifications}
            originalNotifications={originalNotifications}
            onSaveNotifications={handleSaveNotifications}
          />
        )}

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <ApiKeysTab
            apiKeys={apiKeys}
            loadingApiKeys={loadingApiKeys}
            showCreateApiKeyModal={showCreateApiKeyModal}
            setShowCreateApiKeyModal={setShowCreateApiKeyModal}
            newApiKeyName={newApiKeyName}
            setNewApiKeyName={setNewApiKeyName}
            creatingApiKey={creatingApiKey}
            newlyCreatedKey={newlyCreatedKey}
            showNewKeyModal={showNewKeyModal}
            setShowNewKeyModal={setShowNewKeyModal}
            setNewlyCreatedKey={setNewlyCreatedKey}
            editingKeyId={editingKeyId}
            setEditingKeyId={setEditingKeyId}
            editingKeyName={editingKeyName}
            setEditingKeyName={setEditingKeyName}
            deletingKeyId={deletingKeyId}
            setDeletingKeyId={setDeletingKeyId}
            onCreateApiKey={handleCreateApiKey}
            onDeleteApiKey={handleDeleteApiKey}
            onToggleApiKey={handleToggleApiKey}
            onRenameApiKey={handleRenameApiKey}
            onCopyToClipboard={copyToClipboard}
          />
        )}

      {/* Downgrade Warning Dialog */}
      <Dialog open={showDowngradeWarningModal} onOpenChange={setShowDowngradeWarningModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Free 플랜으로 다운그레이드 확인</DialogTitle>
            <DialogDescription>
              Free 플랜으로 변경 시 일부 기능이 제한됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">

            <Separator />

            {/* Warning Boxes */}
            <div className="space-y-4">
              {/* Main Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Free 플랜으로 다운그레이드 시 제한 사항
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      현재 사용 중인 리소스가 Free 플랜의 제한을 초과할 경우, 일부 프린터가 비활성화되거나 읽기 전용 모드로 전환될 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Affected Features */}
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold">영향을 받는 기능</h3>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li>• <strong className="text-foreground">프린터 연결:</strong> 최대 1대로 제한 (현재 {currentPlan === 'pro' ? '5대' : '무제한'} 사용 가능)</li>
                      <li>• <strong className="text-foreground">AI 모델 생성:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">고급 분석:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">API 액세스:</strong> 사용 불가</li>
                      <li>• <strong className="text-foreground">우선 지원:</strong> 커뮤니티 지원으로 전환</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">다운그레이드 전 고려사항:</h3>
              <ul className="space-y-2 text-muted-foreground ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>연결된 프린터가 2대 이상인 경우, 1대만 활성 상태로 유지됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>프리미엄 기능을 사용하는 프로젝트는 읽기 전용으로 전환될 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-foreground mt-0.5">•</span>
                  <span>다운그레이드 후에도 현재 결제 주기가 끝날 때까지 프리미엄 기능을 사용할 수 있습니다.</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDowngradeWarningModal(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!user) return;

                  try {
                    // Free 플랜으로 다운그레이드
                    const now = new Date();
                    const periodEnd = new Date(now);
                    periodEnd.setFullYear(periodEnd.getFullYear() + 100); // 무료 플랜은 무기한

                    const result = await upsertUserSubscription(
                      user.id,
                      'free',
                      now,
                      periodEnd
                    );

                    if (result) {
                      setCurrentPlan('free');
                      toast({
                        title: "플랜 변경 완료",
                        description: "Free 플랜으로 변경되었습니다.",
                      });
                    } else {
                      throw new Error('플랜 변경 실패');
                    }
                  } catch (error) {
                    console.error('Downgrade error:', error);
                    toast({
                      title: "오류",
                      description: "플랜 변경 중 오류가 발생했습니다.",
                      variant: "destructive",
                    });
                  }

                  setShowDowngradeWarningModal(false);
                }}
              >
                확인 및 다운그레이드
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Plan Sheet - Supabase Style */}
      <Sheet open={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto z-50 px-4 sm:px-6">
          <SheetHeader className="mb-6 pb-2">
            <SheetTitle className="text-xl">플랜 선택</SheetTitle>
            <SheetDescription className="text-sm mt-1">
              필요에 맞는 플랜을 선택하세요. 언제든지 변경 가능합니다.
            </SheetDescription>
          </SheetHeader>

          {/* 3-column grid layout like Supabase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Free Plan */}
            <div className={`relative border rounded-xl p-4 flex flex-col transition-all ${currentPlan === 'free' ? 'border-primary border-2 bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'}`}>
              {currentPlan === 'free' && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-xs">현재 플랜</Badge>
              )}

              <div className="mb-3">
                <h3 className="text-base font-bold text-muted-foreground">FREE</h3>
                <p className="text-xl font-bold mt-1">₩0<span className="text-sm font-normal text-muted-foreground">/월</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">개인 사용자용</p>
              </div>

              {currentPlan !== 'free' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mb-3 h-8"
                  onClick={() => setShowDowngradeWarningModal(true)}
                >
                  다운그레이드
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="w-full mb-3 h-8" disabled>
                  현재 플랜
                </Button>
              )}

              <div className="space-y-1.5 text-sm flex-1">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>기본 AI 모델</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>60분 이상 감지 간격</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>최대 1대 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>월 5개 3D 모델링</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>API 일부 제한</span>
                </div>
              </div>
            </div>

            {/* Starter Plan */}
            <div className={`relative border rounded-xl p-4 flex flex-col transition-all ${currentPlan === 'starter' ? 'border-primary border-2 bg-primary/5 shadow-md' : 'border-amber-500 border-2 hover:shadow-lg'}`}>
              {currentPlan === 'starter' ? (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-xs">현재 플랜</Badge>
              ) : (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-xs">Best Value</Badge>
              )}

              <div className="mb-3">
                <h3 className="text-base font-bold">STARTER</h3>
                {/* 결제 주기 토글 */}
                {currentPlan !== 'starter' && (
                  <div className="flex rounded-md border border-border p-0.5 bg-muted/30 mt-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setStarterBillingCycle('monthly')}
                      className={`flex-1 py-1 px-2 text-xs font-medium rounded transition-colors ${
                        starterBillingCycle === 'monthly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      월간
                    </button>
                    <button
                      type="button"
                      onClick={() => setStarterBillingCycle('yearly')}
                      className={`flex-1 py-1 px-2 text-xs font-medium rounded transition-colors ${
                        starterBillingCycle === 'yearly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      연간
                    </button>
                  </div>
                )}
                {starterBillingCycle === 'monthly' ? (
                  <p className="text-xl font-bold">{formatPlanPrice(prices.starter.monthly)}<span className="text-sm font-normal text-muted-foreground">/월</span></p>
                ) : (
                  <>
                    <p className="text-xl font-bold">{formatPlanPrice(prices.starter.yearly)}<span className="text-sm font-normal text-muted-foreground">/년</span></p>
                    <p className="text-xs text-green-500">월 {formatPlanPrice(prices.starter.monthlyEquivalent)} (17% 할인)</p>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">취미 사용자 및 소규모 제작자</p>
              </div>

              {currentPlan !== 'starter' ? (
                <Button
                  size="sm"
                  className="w-full mb-3 h-8 bg-amber-500 hover:bg-amber-600"
                  onClick={() => handleStarterUpgrade(starterBillingCycle)}
                  disabled={paddleLoading || !paddleReady}
                >
                  {paddleLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : '업그레이드'}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="w-full mb-3 h-8" disabled>
                  현재 플랜
                </Button>
              )}

              <div className="space-y-1.5 text-sm flex-1">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">고급 AI 모델</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">60분 이상 감지 간격</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>최대 1대 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>월 20개 3D 모델링</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>API 일부 제한</span>
                </div>
              </div>
            </div>

            {/* Pro Plan */}
            <div className={`relative border rounded-xl p-4 flex flex-col transition-all ${currentPlan === 'pro' ? 'border-primary border-2 bg-primary/5 shadow-md' : 'border-blue-500 border-2 hover:shadow-lg'}`}>
              {currentPlan === 'pro' ? (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-xs">현재 플랜</Badge>
              ) : (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-xs">Pro</Badge>
              )}

              <div className="mb-3">
                <h3 className="text-base font-bold">PRO</h3>
                {/* 결제 주기 토글 */}
                {currentPlan !== 'pro' && (
                  <div className="flex rounded-md border border-border p-0.5 bg-muted/30 mt-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setProBillingCycle('monthly')}
                      className={`flex-1 py-1 px-2 text-xs font-medium rounded transition-colors ${
                        proBillingCycle === 'monthly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      월간
                    </button>
                    <button
                      type="button"
                      onClick={() => setProBillingCycle('yearly')}
                      className={`flex-1 py-1 px-2 text-xs font-medium rounded transition-colors ${
                        proBillingCycle === 'yearly'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      연간
                    </button>
                  </div>
                )}
                {proBillingCycle === 'monthly' ? (
                  <p className="text-xl font-bold">{formatPlanPrice(prices.pro.monthly)}<span className="text-sm font-normal text-muted-foreground">/월</span></p>
                ) : (
                  <>
                    <p className="text-xl font-bold">{formatPlanPrice(prices.pro.yearly)}<span className="text-sm font-normal text-muted-foreground">/년</span></p>
                    <p className="text-xs text-green-500">월 {formatPlanPrice(prices.pro.monthlyEquivalent)} (17% 할인)</p>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">전문가 및 프린터 팜</p>
              </div>

              {currentPlan !== 'pro' ? (
                <Button
                  size="sm"
                  className="w-full mb-3 h-8 bg-blue-500 hover:bg-blue-600"
                  onClick={() => handleProUpgrade(proBillingCycle)}
                  disabled={paddleLoading || !paddleReady}
                >
                  {paddleLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : '업그레이드'}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="w-full mb-3 h-8" disabled>
                  현재 플랜
                </Button>
              )}

              <div className="space-y-1.5 text-sm flex-1">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-medium text-blue-700 dark:text-blue-400">고급 AI 모델</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-medium text-blue-700 dark:text-blue-400">10분 이상 감지 간격</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>최대 5대 프린터 연결</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>월 50개 3D 모델링</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>API 전체 접근</span>
                </div>
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div className="my-6 border-t border-border" />

          {/* 플랜별 세부 사항 비교 테이블 - 독립 섹션 */}
          <div className="space-y-4 pb-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold">플랜별 세부 사항</h3>
              <p className="text-sm text-muted-foreground">모든 기능을 자세히 비교해보세요</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold min-w-[120px]">항목</th>
                    <th className="text-center py-3 px-3 font-bold min-w-[80px] text-slate-600 dark:text-slate-400">무료</th>
                    <th className="text-center py-3 px-3 font-bold min-w-[80px] text-amber-600 dark:text-amber-400">스타터</th>
                    <th className="text-center py-3 px-3 font-bold min-w-[80px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-x border-blue-500/20">프로</th>
                    <th className="text-center py-3 px-3 font-bold min-w-[90px] text-purple-700 dark:text-purple-300">엔터프라이즈</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. 고급 분석 및 대화 */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium">고급 분석 및 대화</td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">기본 모델</td>
                    <td className="py-3 px-3 text-center font-medium text-amber-600 dark:text-amber-400">고급 모델</td>
                    <td className="py-3 px-3 text-center bg-blue-500/5 font-medium text-blue-700 dark:text-blue-300 border-x border-blue-500/20">고급 모델</td>
                    <td className="py-3 px-3 text-center font-medium text-purple-700 dark:text-purple-300">고급 모델</td>
                  </tr>
                  {/* 2. 이상 감지 간격 */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium">이상 감지 간격</td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">60분</td>
                    <td className="py-3 px-3 text-center font-medium text-amber-600 dark:text-amber-400">60분</td>
                    <td className="py-3 px-3 text-center bg-blue-500/5 font-medium text-blue-700 dark:text-blue-300 border-x border-blue-500/20">10분</td>
                    <td className="py-3 px-3 text-center font-medium text-purple-700 dark:text-purple-300">실시간</td>
                  </tr>
                  {/* 3. 최대 프린터 연결 */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium">최대 프린터 연결</td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">1대</td>
                    <td className="py-3 px-3 text-center font-medium text-amber-600 dark:text-amber-400">1대</td>
                    <td className="py-3 px-3 text-center bg-blue-500/5 font-medium text-blue-700 dark:text-blue-300 border-x border-blue-500/20">5대</td>
                    <td className="py-3 px-3 text-center font-medium text-purple-700 dark:text-purple-300">무제한</td>
                  </tr>
                  {/* 4. 3D 모델링 사용 */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium">3D 모델링 사용</td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">월 20개</td>
                    <td className="py-3 px-3 text-center font-medium text-amber-600 dark:text-amber-400">무제한</td>
                    <td className="py-3 px-3 text-center bg-blue-500/5 font-medium text-blue-700 dark:text-blue-300 border-x border-blue-500/20">월 50개</td>
                    <td className="py-3 px-3 text-center font-medium text-purple-700 dark:text-purple-300">무제한</td>
                  </tr>
                  {/* 5. API 접근 */}
                  <tr>
                    <td className="py-3 px-4 font-medium">API 접근</td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">일부 제한</td>
                    <td className="py-3 px-3 text-center font-medium text-amber-600 dark:text-amber-400">일부 제한</td>
                    <td className="py-3 px-3 text-center bg-blue-500/5 font-medium text-blue-700 dark:text-blue-300 border-x border-blue-500/20">전체</td>
                    <td className="py-3 px-3 text-center font-medium text-purple-700 dark:text-purple-300">전체</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Billing History Modal */}
      <Dialog open={showBillingHistoryModal} onOpenChange={setShowBillingHistoryModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("userSettings.viewBillingHistory")}</DialogTitle>
            <DialogDescription>
              View your past invoices and payment history
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No billing history available yet</p>
              <p className="text-sm mt-2">Your payment history will appear here once you make a purchase</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Modal */}
      <Dialog open={showPaymentMethodModal} onOpenChange={setShowPaymentMethodModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("userSettings.managePaymentMethod")}</DialogTitle>
            <DialogDescription>
              Add or update your payment method
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment method added</p>
              <p className="text-sm mt-2">Add a payment method to manage your subscription</p>
            </div>
            <Button className="w-full" onClick={() => {
              toast({
                title: "Coming Soon",
                description: "Payment method management will be available soon",
              });
            }}>
              Add Payment Method
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </div>
        {/* End py-8 px-8 container */}
      </div>
      {/* End flex-1 overflow-y-auto */}
    </div>
    {/* End flex-1 flex-col */}
    </div>
  );
};

export default UserSettings;
