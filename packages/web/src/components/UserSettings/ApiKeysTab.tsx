/**
 * ApiKeysTab - API 키 관리 탭
 */
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Shield,
  Key,
  Loader2,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  Check,
  Copy,
  AlertTriangle,
} from "lucide-react";
import type { ApiKey } from "@shared/services/supabaseService/apiKeys";

export interface ApiKeysTabProps {
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
  setNewlyCreatedKey: (key: string | null) => void;
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

// Format date helper
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const ApiKeysTab = ({
  apiKeys,
  loadingApiKeys,
  showCreateApiKeyModal,
  setShowCreateApiKeyModal,
  newApiKeyName,
  setNewApiKeyName,
  creatingApiKey,
  newlyCreatedKey,
  showNewKeyModal,
  setShowNewKeyModal,
  setNewlyCreatedKey,
  editingKeyId,
  setEditingKeyId,
  editingKeyName,
  setEditingKeyName,
  deletingKeyId,
  setDeletingKeyId,
  onCreateApiKey,
  onDeleteApiKey,
  onToggleApiKey,
  onRenameApiKey,
  onCopyToClipboard,
}: ApiKeysTabProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("apiKeys.title", "API Keys")}
          </h2>
          <p className="text-muted-foreground">
            {t(
              "apiKeys.description",
              "Manage API keys for external access to your FACTOR data."
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreateApiKeyModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("apiKeys.createNew", "Create API Key")}
        </Button>
      </div>

      {/* API Key Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {t("apiKeys.securityInfo", "Security Information")}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t(
                  "apiKeys.securityDesc",
                  "API keys provide access to your data. Keep them secure and never share them publicly. You can deactivate or delete keys at any time."
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeys.yourKeys", "Your API Keys")}</CardTitle>
          <CardDescription>
            {t(
              "apiKeys.keysDescription",
              "Use these keys to authenticate API requests from external applications."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingApiKeys ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                {t(
                  "apiKeys.noKeys",
                  "No API keys yet. Create one to get started."
                )}
              </p>
              <Button
                variant="outline"
                onClick={() => setShowCreateApiKeyModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("apiKeys.createFirst", "Create your first API key")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    key.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-md ${
                        key.is_active ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <Key
                        className={`h-4 w-4 ${
                          key.is_active ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingKeyId === key.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingKeyName}
                            onChange={(e) => setEditingKeyName(e.target.value)}
                            className="h-8 w-48"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onRenameApiKey(key.id);
                              if (e.key === "Escape") {
                                setEditingKeyId(null);
                                setEditingKeyName("");
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRenameApiKey(key.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {key.name}
                            </span>
                            {!key.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                {t("apiKeys.inactive", "Inactive")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                              {key.key_prefix}...
                            </code>
                            <span>•</span>
                            <span>
                              {t("apiKeys.created", "Created")}:{" "}
                              {formatDate(key.created_at)}
                            </span>
                            {key.last_used_at && (
                              <>
                                <span>•</span>
                                <span>
                                  {t("apiKeys.lastUsed", "Last used")}:{" "}
                                  {formatDate(key.last_used_at)}
                                </span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingKeyId(key.id);
                          setEditingKeyName(key.name);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("common.rename", "Rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onToggleApiKey(key.id, !key.is_active)}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        {key.is_active
                          ? t("apiKeys.deactivate", "Deactivate")
                          : t("apiKeys.activate", "Activate")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingKeyId(key.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("common.delete", "Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeys.howToUse", "How to use API Keys")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {t(
                "apiKeys.authHeader",
                "Include your API key in the request header:"
              )}
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                X-API-Key: fk_live_xxxxxxxx...
              </code>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("apiKeys.exampleRequest", "Example API request:")}
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-foreground whitespace-pre-wrap">{`curl -X GET "https://factor.io.kr/api/v1/printers" \\
  -H "X-API-Key: YOUR_API_KEY"`}</pre>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">
              {t("apiKeys.availableEndpoints", "Available Endpoints:")}
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/me
                </code>{" "}
                - {t("apiKeys.endpoint.me", "Get user profile")}
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/printers
                </code>{" "}
                - {t("apiKeys.endpoint.printers", "List your printers")}
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/printers/:uuid
                </code>{" "}
                - {t("apiKeys.endpoint.printer", "Get printer details")}
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/cameras
                </code>{" "}
                - {t("apiKeys.endpoint.cameras", "List your cameras")}
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/subscription
                </code>{" "}
                - {t("apiKeys.endpoint.subscription", "Get subscription info")}
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">
                  GET /api/v1/overview
                </code>{" "}
                - {t("apiKeys.endpoint.overview", "Get dashboard overview")}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateApiKeyModal} onOpenChange={setShowCreateApiKeyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("apiKeys.createTitle", "Create API Key")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "apiKeys.createDescription",
                "Give your API key a memorable name to help you identify it later."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">
                {t("apiKeys.keyName", "Key Name")}
              </Label>
              <Input
                id="api-key-name"
                placeholder={t(
                  "apiKeys.keyNamePlaceholder",
                  "e.g., Home Server, Production App"
                )}
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreateApiKey();
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCreateApiKeyModal(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={onCreateApiKey} disabled={creatingApiKey}>
              {creatingApiKey && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("apiKeys.create", "Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New API Key Display Dialog */}
      <Dialog
        open={showNewKeyModal}
        onOpenChange={(open) => {
          if (!open) setNewlyCreatedKey(null);
          setShowNewKeyModal(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              {t("apiKeys.keyCreated", "API Key Created")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "apiKeys.copyWarning",
                "Copy your API key now. You won't be able to see it again!"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
              <code className="flex-1 font-mono text-sm break-all">
                {newlyCreatedKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => newlyCreatedKey && onCopyToClipboard(newlyCreatedKey)}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t(
                    "apiKeys.saveKeyWarning",
                    "Make sure to copy and save this key securely. For security reasons, we cannot show it again."
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewlyCreatedKey(null);
              }}
            >
              {t("common.done", "Done")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete API Key Confirmation */}
      <AlertDialog
        open={!!deletingKeyId}
        onOpenChange={(open) => !open && setDeletingKeyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("apiKeys.deleteConfirm", "Delete API Key?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "apiKeys.deleteWarning",
                "This action cannot be undone. Any applications using this API key will no longer be able to access your data."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingKeyId && onDeleteApiKey(deletingKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApiKeysTab;
