import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  ChevronRight,
  Camera,
  Mail,
  Phone,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullScreenInput } from "@/components/FullScreenInput";

const UserProfile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || user?.email?.split('@')[0] || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 사용자 정보 변경 시 아바타 URL 동기화 (Google 로그인 등)
  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      setAvatarUrl(user.user_metadata.avatar_url);
    }
    if (user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name);
    }
  }, [user?.user_metadata?.avatar_url, user?.user_metadata?.full_name]);

  // 전체 화면 입력 모달 상태
  const [editingField, setEditingField] = useState<{
    key: string;
    title: string;
    label: string;
    value: string;
    placeholder: string;
    type: string;
    onChange: (value: string) => void;
  } | null>(null);

  const handleAvatarUpload = async () => {
    if (!user) return;

    try {
      setUploadingAvatar(true);

      // 네이티브 플랫폼에서는 Capacitor Camera 사용
      if (Capacitor.isNativePlatform()) {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Base64,
          source: CameraSource.Prompt, // Camera or Gallery 선택
        });

        if (!image.base64String) {
          throw new Error('이미지 데이터를 가져올 수 없습니다.');
        }

        // Base64를 Blob으로 변환
        const base64Response = await fetch(`data:image/${image.format};base64,${image.base64String}`);
        const blob = await base64Response.blob();

        const fileName = `${user.id}-${Date.now()}.${image.format}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: `image/${image.format}`,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

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

        // 업데이트된 사용자 정보 가져오기 (메타데이터 새로고침)
        await supabase.auth.getUser();

        setAvatarUrl(publicUrl);
        toast({
          title: t("profile.photoChangeComplete", "프로필 사진 변경 완료"),
          description: t("profile.photoChangeSuccess", "프로필 사진이 성공적으로 변경되었습니다."),
        });
      } else {
        // 웹에서는 기존 파일 업로드 방식 사용
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          if (file.size > 2 * 1024 * 1024) {
            toast({
              title: t("profile.fileSizeExceeded", "파일 크기 초과"),
              description: t("profile.fileSizeLimit", "프로필 사진은 2MB 이하여야 합니다."),
              variant: "destructive",
            });
            return;
          }

          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);

            const publicUrl = urlData.publicUrl;

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

            // 업데이트된 사용자 정보 가져오기 (메타데이터 새로고침)
            await supabase.auth.getUser();

            setAvatarUrl(publicUrl);
            toast({
              title: t("profile.photoChangeComplete", "프로필 사진 변경 완료"),
              description: t("profile.photoChangeSuccess", "프로필 사진이 성공적으로 변경되었습니다."),
            });
          } catch (error) {
            console.error('Avatar upload error:', error);
            toast({
              title: t("profile.uploadFailed", "업로드 실패"),
              description: t("profile.uploadFailedDesc", "프로필 사진 업로드에 실패했습니다."),
              variant: "destructive",
            });
          } finally {
            setUploadingAvatar(false);
          }
        };
        input.click();
        return; // 웹에서는 여기서 종료
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: t("profile.uploadFailed", "업로드 실패"),
        description: t("profile.uploadFailedDesc", "프로필 사진 업로드에 실패했습니다."),
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const profileFields = [
    {
      key: "name",
      label: t("profile.name", "이름"),
      value: displayName,
      onChange: setDisplayName,
      icon: User,
      placeholder: t("profile.enterName", "이름을 입력하세요"),
      type: "text",
      readOnly: false,
    },
    {
      key: "phone",
      label: t("profile.phone", "휴대폰 번호"),
      value: phone,
      onChange: setPhone,
      icon: Phone,
      placeholder: t("profile.enterPhone", "010-0000-0000"),
      type: "tel",
      readOnly: false,
    },
    {
      key: "email",
      label: t("profile.email", "이메일"),
      value: user?.email || "",
      onChange: null,
      icon: Mail,
      placeholder: "",
      type: "email",
      readOnly: true,
    },
    {
      key: "bio",
      label: t("profile.company", "회사"),
      value: bio,
      onChange: setBio,
      icon: FileText,
      placeholder: t("profile.enterCompany", "회사명 또는 소속을 입력하세요"),
      type: "text",
      readOnly: false,
    },
  ];

  const handleFieldClick = (field: typeof profileFields[0]) => {
    if (field.readOnly || !field.onChange) return;

    setEditingField({
      key: field.key,
      title: `${field.label}${t("common.input", "을 입력해주세요")}`,
      label: field.label,
      value: field.value,
      placeholder: field.placeholder,
      type: field.type,
      onChange: field.onChange,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {displayName || user?.email?.split('@')[0] || t("common.user", "사용자")} INFO
          </h1>
          <div className="w-9" /> {/* 균형을 위한 빈 공간 */}
        </div>
      </div>

      {/* 프로필 사진 섹션 */}
      <div className="flex flex-col items-center py-8 bg-background border-b">
        <button onClick={handleAvatarUpload} className="relative cursor-pointer group">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-2 border-primary/20 transition-opacity group-hover:opacity-80"
            />
          ) : (
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 transition-opacity group-hover:opacity-80">
              <span className="text-4xl font-bold text-white">
                {displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
            {uploadingAvatar ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </div>
        </button>
      </div>

      {/* 프로필 필드 */}
      <div className="px-4 py-4">
        {profileFields.map((field, index) => (
          <div key={index}>
            <button
              className="w-full flex items-center py-4 hover:bg-accent transition-colors"
              onClick={() => handleFieldClick(field)}
              disabled={field.readOnly}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {field.icon && <field.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                  {field.label}
                </span>
                <span className={`text-sm flex-1 text-right truncate ${field.value ? "text-foreground" : "text-muted-foreground"}`}>
                  {field.value || field.placeholder}
                </span>
              </div>
              {!field.readOnly && <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />}
            </button>
            {index < profileFields.length - 1 && (
              <div className="border-b border-border/50" />
            )}
          </div>
        ))}
      </div>

      {/* 전체 화면 입력 모달 */}
      {editingField && (
        <FullScreenInput
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onConfirm={async (value) => {
            // 로컬 상태 업데이트
            editingField.onChange(value);

            // DB에 즉시 저장
            try {
              const updateData: { [key: string]: string } = {};
              const profileUpdateData: { [key: string]: string } = {};

              if (editingField.key === 'name') {
                updateData.full_name = value;
                profileUpdateData.full_name = value;  // 실명만 업데이트 (display_name은 닉네임이므로 별도 관리)
              } else if (editingField.key === 'phone') {
                updateData.phone = value;
                profileUpdateData.phone = value;
              } else if (editingField.key === 'bio') {
                updateData.bio = value;
              }

              // user_metadata 업데이트
              const { error } = await supabase.auth.updateUser({
                data: updateData
              });

              if (error) throw error;

              // profiles 테이블 업데이트
              if (Object.keys(profileUpdateData).length > 0 && user) {
                const { error: profileError } = await supabase
                  .from('profiles')
                  .update(profileUpdateData)
                  .eq('user_id', user.id);

                if (profileError) {
                  console.error('Profile table update error:', profileError);
                }
              }

              // 업데이트된 사용자 정보 가져오기 (메타데이터 새로고침)
              await supabase.auth.getUser();

              toast({
                title: t("common.success", "저장 완료"),
                description: t("userSettings.profileUpdatedDesc", "프로필 정보가 저장되었습니다."),
              });
            } catch (error) {
              console.error('Profile save error:', error);
              toast({
                title: t("common.error", "저장 실패"),
                description: t("errors.uploadFailed", "프로필 정보 저장에 실패했습니다."),
                variant: "destructive",
              });
            }

            setEditingField(null);
          }}
          title={editingField.title}
          label={editingField.label}
          value={editingField.value}
          placeholder={editingField.placeholder}
          type={editingField.type}
        />
      )}
    </div>
  );
};

export default UserProfile;
