import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  File,
  Play,
  Trash2,
  Clock,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@shared/hooks/useWebSocket";
import { supabase } from "@shared/integrations/supabase/client";
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';

interface GCodeFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  print_time_estimate?: number;
  filament_estimate?: number;
  status: string;
}

interface GCodeUploadProps {
  deviceUuid?: string | null;
  isConnected?: boolean;
}

export const GCodeUpload = ({ deviceUuid, isConnected = false }: GCodeUploadProps) => {
  const { t } = useTranslation();
  const { printerStatus } = useWebSocket();
  const [files, setFiles] = useState<GCodeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isPrinting = printerStatus.printing;

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return t('gcode.noFiles');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}${t('printerDetail.hours')} ${minutes}${t('printerDetail.minutes')}` : `${minutes}${t('printerDetail.minutes')}`;
  };

  const handleFileSelect = async (event?: React.ChangeEvent<HTMLInputElement>) => {
    // 네이티브 플랫폼에서는 Capacitor File Picker 사용
    if (Capacitor.isNativePlatform() && !event) {
      try {
        const result = await FilePicker.pickFiles({
          types: ['*/*'], // GCode는 특정 MIME type이 없으므로 모든 파일 허용
          multiple: false,
        });

        if (!result.files || result.files.length === 0) return;

        const pickedFile = result.files[0];

        // Check file extension
        if (!pickedFile.name?.toLowerCase().endsWith('.gcode')) {
          toast({
            title: t('errors.unsupportedFormat'),
            description: t('errors.unsupportedFormat'),
            variant: "destructive"
          });
          return;
        }

        // Blob 데이터 생성
        const blob = pickedFile.blob || (pickedFile.data ? new Blob([new Uint8Array(atob(pickedFile.data).split('').map(c => c.charCodeAt(0)))]) : null);

        if (!blob) {
          throw new Error(t('errors.loadFailed'));
        }

        // File 객체로 변환
        const file = new File([blob], pickedFile.name || 'unknown.gcode', {
          type: pickedFile.mimeType || 'text/plain',
        });

        handleUpload(file);
      } catch (error) {
        console.error('File picker error:', error);
        toast({
          title: t('errors.fileNotSelected'),
          description: t('errors.general'),
          variant: "destructive"
        });
      }
    } else if (event) {
      // 웹에서는 기존 파일 업로드 방식
      const file = event.target.files?.[0];
      if (!file) return;

      // Check file extension
      if (!file.name.toLowerCase().endsWith('.gcode')) {
        toast({
          title: t('errors.unsupportedFormat'),
          description: t('errors.unsupportedFormat'),
          variant: "destructive"
        });
        return;
      }

      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Simulate progress (in real implementation, use actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `user-files/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('gcode-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('errors.general'));

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('gcode_files')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: filePath,
          file_size: file.size,
          print_time_estimate: null, // TODO: 실제 G-code 분석으로 추정 시간 계산
          filament_estimate: null, // TODO: 실제 G-code 분석으로 필라멘트 사용량 계산
        });

      if (dbError) throw dbError;

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: t('gcode.uploadSuccess'),
        description: `${file.name}`,
      });

      // Refresh file list
      loadFiles();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: t('gcode.uploadFailed'),
        description: t('gcode.uploadFailed'),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('gcode_files')
        .select('*')
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handlePrintFile = (file: GCodeFile) => {
    console.log(`Starting print for file: ${file.filename}`);
    toast({
      title: t('gcode.printStart'),
      description: t('gcode.printStartDesc', { file: file.filename }),
    });
  };

  const handleDeleteFile = async (file: GCodeFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('gcode-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('gcode_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({
        title: t('gcode.deleteSuccess'),
        description: `${file.filename}`,
      });

      loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t('gcode.deleteFailed'),
        description: t('gcode.deleteFailed'),
        variant: "destructive"
      });
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <Card className="h-full flex flex-col">{/* Remove mt-6 and add height/flex */}
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <File className="h-4 w-4" />
          {t('gcode.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 파일 업로드 */}
        <div className="space-y-2">
          <Label className="text-xs">{t('gcode.uploadGcode')}</Label>
          <div className="flex gap-2">
            {!Capacitor.isNativePlatform() && (
              <Input
                ref={fileInputRef}
                type="file"
                accept=".gcode"
                onChange={handleFileSelect}
                disabled={uploading || !isConnected}
                className="h-8 text-xs"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (Capacitor.isNativePlatform()) {
                  handleFileSelect();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploading || !isConnected}
              className={Capacitor.isNativePlatform() ? "h-8 px-3 flex-1" : "h-8 px-3"}
            >
              <Upload className="h-3 w-3 mr-1" />
              {t('common.search')}
            </Button>
          </div>
          
          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">{t('common.uploading')} {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* 파일 목록 */}
        <div className="flex-1 flex flex-col space-y-2 min-h-0">
          <Label className="text-xs">{t('gcode.uploadedFiles')}</Label>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t('gcode.noFiles')}
              </p>
            ) : (
              files.map((file) => (
                <div key={file.id} className="flex items-center gap-2 p-2 border rounded text-xs">
                  <File className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file.filename}</div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-2 w-2" />
                        {formatFileSize(file.file_size)}
                      </span>
                      {file.print_time_estimate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2 w-2" />
                          {formatTime(file.print_time_estimate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {file.status === 'uploaded' ? t('common.waiting') : file.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintFile(file)}
                    disabled={!isConnected || isPrinting}
                    className="h-6 w-6 p-0"
                  >
                    <Play className="h-2 w-2" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteFile(file)}
                    disabled={!isConnected}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-2 w-2" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};