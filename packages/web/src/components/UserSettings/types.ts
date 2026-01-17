/**
 * UserSettings 공통 타입 정의
 */
import type { User, UserIdentity } from "@supabase/supabase-js";
import type { SubscriptionPlan } from "@shared/types/subscription";
import type { PaymentHistory } from "@shared/services/supabaseService/subscription";
import type { PaymentMethod } from "@shared/services/supabaseService/paymentMethod";
import type { ApiKey } from "@shared/services/supabaseService/apiKeys";

// Profile Tab Props
export interface ProfileTabProps {
  user: User | null;
  fullName: string;
  setFullName: (name: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  email: string;
  phone: string;
  setPhone: (phone: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
  uploadingAvatar: boolean;
  setUploadingAvatar: (uploading: boolean) => void;
  originalProfile: { fullName: string; displayName: string; phone: string };
  onSaveProfile: () => Promise<void>;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

// Account Tab Props
export interface AccountTabProps {
  user: User | null;
  isGoogleLinked: boolean;
  googleIdentity: UserIdentity | undefined;
  onLinkGoogle: () => Promise<void>;
  onUnlinkGoogle: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
}

// Subscription Tab Props
export interface SubscriptionTabProps {
  user: User | null;
  currentPlan: SubscriptionPlan;
  subscriptionData: {
    price: number;
    billingCycle: string;
    nextBillingDate: string | null;
  } | null;
  loadingPlan: boolean;
  showChangePlanModal: boolean;
  setShowChangePlanModal: (show: boolean) => void;
  showBillingHistoryModal: boolean;
  setShowBillingHistoryModal: (show: boolean) => void;
  showPaymentMethodModal: boolean;
  setShowPaymentMethodModal: (show: boolean) => void;
  showDowngradeWarningModal: boolean;
  setShowDowngradeWarningModal: (show: boolean) => void;
  allPaymentHistory: PaymentHistory[];
  paymentMethods: PaymentMethod[];
  loadingPaymentData: boolean;
  paymentHistoryPage: number;
  setPaymentHistoryPage: (page: number) => void;
  paddleReady: boolean;
  paddleLoading: boolean;
  starterBillingCycle: 'monthly' | 'yearly';
  setStarterBillingCycle: (cycle: 'monthly' | 'yearly') => void;
  proBillingCycle: 'monthly' | 'yearly';
  setProBillingCycle: (cycle: 'monthly' | 'yearly') => void;
  onStarterUpgrade: (cycle: 'monthly' | 'yearly') => Promise<void>;
  onProUpgrade: (cycle: 'monthly' | 'yearly') => Promise<void>;
  isKorea: boolean;
  formatPlanPrice: (amount: number) => string;
  prices: {
    starter: { monthly: number; yearly: number; monthlyEquivalent: number };
    pro: { monthly: number; yearly: number; monthlyEquivalent: number };
  };
}

// Notifications Tab Props
export interface NotificationsTabProps {
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  pushNotifications: boolean;
  setPushNotifications: (value: boolean) => void;
  printCompleteNotif: boolean;
  setPrintCompleteNotif: (value: boolean) => void;
  errorNotif: boolean;
  setErrorNotif: (value: boolean) => void;
  weeklyReport: boolean;
  setWeeklyReport: (value: boolean) => void;
  loadingNotifications: boolean;
  isEditingNotifications: boolean;
  setIsEditingNotifications: (editing: boolean) => void;
  originalNotifications: {
    email: boolean;
    push: boolean;
    printComplete: boolean;
    error: boolean;
    weekly: boolean;
  };
  onSaveNotifications: () => Promise<void>;
  onResetNotifications: () => void;
}

// API Keys Tab Props
export interface ApiKeysTabProps {
  user: User | null;
  currentPlan: SubscriptionPlan;
  apiKeys: ApiKey[];
  loadingApiKeys: boolean;
  showCreateApiKeyModal: boolean;
  setShowCreateApiKeyModal: (show: boolean) => void;
  newApiKeyName: string;
  setNewApiKeyName: (name: string) => void;
  creatingApiKey: boolean;
  newlyCreatedKey: string | null;
  showNewKeyModal: boolean;
  setShowNewKeyModal: (show: boolean) => void;
  editingKeyId: string | null;
  setEditingKeyId: (id: string | null) => void;
  editingKeyName: string;
  setEditingKeyName: (name: string) => void;
  deletingKeyId: string | null;
  setDeletingKeyId: (id: string | null) => void;
  onCreateApiKey: () => Promise<void>;
  onDeleteApiKey: (keyId: string) => Promise<void>;
  onToggleApiKey: (keyId: string, isActive: boolean) => Promise<void>;
  onRenameApiKey: (keyId: string) => Promise<void>;
  onCopyToClipboard: (text: string) => Promise<void>;
}
