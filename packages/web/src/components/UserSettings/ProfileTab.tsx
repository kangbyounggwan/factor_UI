/**
 * ProfileTab - 프로필 설정 탭
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { User, Camera, Check, RefreshCw } from "lucide-react";
import type { ProfileTabProps } from "./types";

export const ProfileTab = ({
  displayName,
  setDisplayName,
  email,
  phone,
  setPhone,
  avatarUrl,
  isEditingProfile,
  setIsEditingProfile,
  uploadingAvatar,
  originalProfile,
  onSaveProfile,
  onAvatarUpload,
}: ProfileTabProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{t("userSettings.profileInfo")}</h2>
        <p className="text-muted-foreground">
          {t("userSettings.profileDescription")}
        </p>
      </div>

      <Card className="overflow-hidden border-2">
        <CardContent className="p-8 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <input
              type="file"
              id="avatar-upload"
              accept="image/*"
              className="hidden"
              onChange={onAvatarUpload}
              disabled={uploadingAvatar}
            />
            <label htmlFor="avatar-upload" className="cursor-pointer">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                  />
                ) : (
                  <div className="flex items-center justify-center w-24 h-24 bg-primary rounded-full border-2 border-primary">
                    <User className="w-12 h-12 text-primary-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </label>
            <div className="space-y-2">
              <h3 className="font-medium">
                {t("userSettings.profilePicture")}
              </h3>
              <p className="text-sm text-muted-foreground">
                JPG, PNG or GIF format (max 2MB)
              </p>
              <p className="text-xs text-muted-foreground">
                {t("userSettings.clickToChangePhoto", "Click profile picture to change")}
              </p>
            </div>
          </div>

          <Separator />

          {/* Form */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("userSettings.name")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setIsEditingProfile(true);
                }}
                placeholder={t("userSettings.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("userSettings.email")}</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="pr-24"
                />
                <Badge
                  variant="secondary"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {t("userSettings.verified")}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("userSettings.phone", "Phone")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setIsEditingProfile(true);
                }}
                placeholder="010-0000-0000"
              />
            </div>
          </div>

          {isEditingProfile && (
            <div className="flex justify-between items-center pt-6 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("common.reset", "Reset")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("userSettings.resetProfileTitle", "Reset Profile")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("userSettings.resetProfileDescription", "Are you sure you want to reset? All changes will be discarded.")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setDisplayName(originalProfile.displayName);
                        setPhone(originalProfile.phone);
                        setIsEditingProfile(false);
                      }}
                    >
                      {t("common.reset", "Reset")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={onSaveProfile}>
                {t("userSettings.saveChanges")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileTab;
