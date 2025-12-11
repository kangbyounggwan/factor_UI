import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileCode2,
  Play,
  HardDrive,
  FolderOpen,
  Loader2,
  Eye,
  Cloud,
  Trash2,
  Pencil,
  MoreVertical,
  X,
  Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { mqttConnect, publishSdUploadChunkFirst, publishSdUploadChunk, publishSdUploadCommit, onDashStatusMessage, publishGcodePrint, subscribeGCodeUploadResult, waitForGCodeUploadResult, type GCodeUploadResult } from "@shared/services/mqttService";
import { supabase } from "@shared/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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

interface DbGCodeFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface GCodeUploadProps {
  deviceUuid?: string | null;
  isConnected?: boolean;
  onViewFile?: (fileId: string) => void; // 눈 버튼 클릭 시 파일관리 탭에서 미리보기
}

export const GCodeUpload = ({ deviceUuid, isConnected = false, onViewFile }: GCodeUploadProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [files, setFiles] = useState<GCodeFile[]>([]);
  const [dbFiles, setDbFiles] = useState<DbGCodeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [sdFiles, setSdFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [localMqttFiles, setLocalMqttFiles] = useState<Array<{ name: string; display?: string; size?: number; date?: number | string | null; estimatedPrintTime?: number; user?: string; path?: string }>>([]);
  const [fileSource, setFileSource] = useState<'LOCAL' | 'SDCARD'>('LOCAL');

  // 클라우드 파일 삭제/이름변경 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DbGCodeFile | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // DB에 저장된 파일명 Set (클라우드 아이콘 표시용)
  const dbFileNames = new Set(dbFiles.map(f => f.filename));

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!/\.(gcode|gco)$/i.test(file.name)) {
      toast({
        title: t('errors.unsupportedFormat'),
        description: t('errors.unsupportedFormat'),
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    toast({ title: t('gcode.selectFile'), description: `${file.name}` });
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      if (!deviceUuid) {
        throw new Error(t('errors.deviceNotSelected'));
      }

      // 1. 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // MQTT 업로드용 고유 ID
      const uploadId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const total = bytes.length;

      // 2. Supabase Storage에 파일 업로드 (뷰어용)
      // 구조: user_id/gcode_file/device_id/filename.gcode
      const deviceFolder = deviceUuid || 'unknown';
      const filePath = `${user.id}/gcode_file/${deviceFolder}/${file.name}`;
      // GCode 파일을 text/x-gcode Blob으로 변환 (Supabase Storage에서 허용된 MIME 타입)
      const fileBlob = new Blob([arrayBuf], { type: 'text/x-gcode' });
      const { error: storageError } = await supabase.storage
        .from('gcode-files')
        .upload(filePath, fileBlob, {
          cacheControl: '3600',
          upsert: true, // 같은 파일명이면 덮어쓰기
          contentType: 'text/x-gcode', // 명시적으로 MIME 타입 지정
        });

      if (storageError) {
        console.error('Storage upload error:', storageError);
        // Storage 실패해도 MQTT 업로드는 계속 진행
      }

      // 3. Storage URL 가져오기
      let storageUrl: string | undefined;
      if (!storageError) {
        const { data: urlData } = supabase.storage
          .from('gcode-files')
          .getPublicUrl(filePath);
        storageUrl = urlData?.publicUrl;
      }

      // 4. DB에 메타데이터 저장 (Storage 에러와 무관하게 항상 저장)
      const { error: dbError } = await supabase
        .from('gcode_files')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: filePath,
          file_size: total,
          printer_id: deviceUuid,
        });

      if (dbError) {
        console.error('DB insert error:', dbError);
      } else {
        // DB 파일 목록 새로고침
        loadDbFiles();
      }

      setUploadProgress(30);

      // 5. MQTT로 프린터에 전송
      await mqttConnect();

      const chunkSize = 32 * 1024;

      const toB64 = (chunk: Uint8Array) => {
        let binary = '';
        for (let i = 0; i < chunk.length; i += 1) binary += String.fromCharCode(chunk[i]);
        return btoa(binary);
      };

      const sendChunk = async (index: number, start: number, end: number) => {
        const slice = bytes.subarray(start, end);
        if (index === 0) {
          await publishSdUploadChunkFirst(deviceUuid!, {
            type: 'sd_upload_chunk',
            upload_id: uploadId,
            index,
            name: file.name,
            total_size: total,
            data_b64: toB64(slice),
            size: slice.length,
            upload_traget: fileSource === 'SDCARD' ? 'sd' : 'local',
          });
        } else {
          await publishSdUploadChunk(deviceUuid!, {
            type: 'sd_upload_chunk',
            upload_id: uploadId,
            index,
            data_b64: toB64(slice),
            size: slice.length,
          });
        }
      };

      let sent = 0;
      let index = 0;
      while (sent < total) {
        const next = Math.min(sent + chunkSize, total);
        await sendChunk(index, sent, next);
        sent = next;
        index += 1;
        // 30% ~ 90% 구간에서 청크 전송 진행률 표시
        setUploadProgress(30 + Math.min(60, Math.round((sent / total) * 60)));
      }

      // 업로드 완료 (commit) - end 메시지 전송
      await publishSdUploadCommit(deviceUuid!, uploadId, fileSource === 'SDCARD' ? 'sd' : 'local');
      setUploadProgress(95);
      console.log('[GCODE] Upload end message sent, waiting for result...');

      // OctoPrint에서 업로드 결과 대기 (60초 타임아웃)
      try {
        const uploadResult = await waitForGCodeUploadResult(deviceUuid!, uploadId, 60000);
        console.log('[GCODE] Upload result received:', uploadResult);
        setUploadProgress(100);

        if (uploadResult.success) {
          toast({
            title: t('gcode.uploadSuccess'),
            description: `${uploadResult.filename} → ${uploadResult.target === 'sd' ? 'SD Card' : 'Local'}`,
          });
        } else {
          toast({
            title: t('gcode.uploadFailed'),
            description: uploadResult.error || t('errors.general'),
            variant: 'destructive',
          });
        }
      } catch (timeoutError) {
        // 타임아웃 시 경고 표시
        console.warn('[GCODE] Upload result timeout:', timeoutError);
        setUploadProgress(100);
        toast({
          title: t('gcode.uploadSuccess'),
          description: `${file.name} (응답 대기 시간 초과)`,
        });
      }

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
      setSelectedFile(null);
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

  const loadDbFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('gcode_files')
        .select('id, filename, file_path, file_size, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbFiles(data || []);
    } catch (error) {
      console.error('Error loading DB files:', error);
    }
  };

  useEffect(() => {
    loadFiles();
    loadDbFiles();
  }, []);

  // GCode 업로드 결과 구독 (OctoPrint에서 업로드 완료 시 알림)
  useEffect(() => {
    if (!deviceUuid) return;

    let unsubscribe: (() => Promise<void>) | null = null;

    const setupSubscription = async () => {
      try {
        unsubscribe = await subscribeGCodeUploadResult(deviceUuid, (result: GCodeUploadResult) => {
          console.log('[GCODE][RESULT] Received:', result);

          if (result.success) {
            toast({
              title: t('gcode.uploadSuccess'),
              description: `${result.filename} → ${result.target === 'sd' ? 'SD Card' : 'Local'}`,
            });
            // 파일 목록 새로고침
            loadDbFiles();
          } else {
            toast({
              title: t('gcode.uploadFailed'),
              description: result.error || t('errors.general'),
              variant: 'destructive',
            });
          }
        });
      } catch (err) {
        console.error('[GCODE][RESULT] Subscription error:', err);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe().catch(() => {});
      }
    };
  }, [deviceUuid, t, toast]);

  useEffect(() => {
    const off = onDashStatusMessage((uuid, payload) => {
      if (deviceUuid && uuid !== deviceUuid) return;
      const sd = payload?.sd || {};
      const localArr: Array<{ name: string; display?: string; size?: number; date?: number | string | null; estimatedPrintTime?: number; user?: string; path?: string }> = Array.isArray(sd?.local) ? sd.local : [];
      const sdArr: Array<{ name?: string; display?: string; size?: number }> = Array.isArray(sd?.sdcard) ? sd.sdcard : [];
      setLocalMqttFiles(localArr);
      setSdFiles(sdArr.map((f) => ({ name: String(f?.name ?? f?.display ?? ''), size: Number(f?.size) || 0 })));
      const printing = Boolean(payload?.printer_status?.printing);
      setIsPrinting(printing);
    });
    return () => { off(); };
  }, [deviceUuid]);

  const handlePrint = async (filename: string, origin: 'local' | 'sdcard') => {
    try {
      if (!deviceUuid) {
        toast({ title: t('errors.general'), description: t('errors.general'), variant: 'destructive' });
        return;
      }
      await mqttConnect();
      const jobId = filename.replace(/\.[^/.]+$/, '');
      await publishGcodePrint(deviceUuid, { filename, origin, job_id: jobId });
      toast({ title: t('gcode.printStart'), description: `${filename} (${origin})` });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: t('errors.uploadFailed'), description: message, variant: 'destructive' });
    }
  };

  const currentFiles = fileSource === 'LOCAL' ? localMqttFiles : sdFiles;

  // 파일명으로 DB 파일 정보 찾기 (뷰어용)
  const getDbFileByName = (filename: string) => {
    return dbFiles.find(f => f.filename === filename);
  };

  const handleViewGcode = (fileId: string) => {
    // onViewFile 콜백이 있으면 파일관리 탭으로 전환하고 해당 파일 선택
    if (onViewFile) {
      onViewFile(fileId);
    } else {
      // 콜백이 없으면 기존처럼 별도 페이지로 이동
      navigate(`/gcode-viewer/${fileId}`);
    }
  };

  // 클라우드 파일 삭제
  const handleDeleteCloudFile = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeleting(true);

      // 1. Supabase Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('gcode-files')
        .remove([fileToDelete.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Storage 삭제 실패해도 DB 삭제는 진행
      }

      // 2. DB에서 메타데이터 삭제
      const { error: dbError } = await supabase
        .from('gcode_files')
        .delete()
        .eq('id', fileToDelete.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: t('common.delete'),
        description: `${fileToDelete.filename} ${t('common.success')}`,
      });

      // 파일 목록 새로고침
      loadDbFiles();

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t('errors.general'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  // 클라우드 파일 이름 변경
  const handleRenameCloudFile = async (file: DbGCodeFile) => {
    if (!newFileName.trim() || newFileName === file.filename) {
      setRenamingFileId(null);
      setNewFileName('');
      return;
    }

    // .gcode 확장자 확인 및 추가
    let finalName = newFileName.trim();
    if (!finalName.toLowerCase().endsWith('.gcode') && !finalName.toLowerCase().endsWith('.gco')) {
      finalName += '.gcode';
    }

    try {
      setIsRenaming(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // 1. 기존 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('gcode-files')
        .download(file.file_path);

      if (downloadError) {
        throw downloadError;
      }

      // 2. 새 경로로 파일 업로드
      const deviceFolder = deviceUuid || 'unknown';
      const newFilePath = `${user.id}/gcode_file/${deviceFolder}/${finalName}`;

      const { error: uploadError } = await supabase.storage
        .from('gcode-files')
        .upload(newFilePath, fileData, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'text/x-gcode',
        });

      if (uploadError) {
        throw uploadError;
      }

      // 3. 기존 파일 삭제 (새 경로와 다른 경우에만)
      if (file.file_path !== newFilePath) {
        await supabase.storage
          .from('gcode-files')
          .remove([file.file_path]);
      }

      // 4. DB 업데이트
      const { error: dbError } = await supabase
        .from('gcode_files')
        .update({
          filename: finalName,
          file_path: newFilePath,
        })
        .eq('id', file.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: t('common.rename'),
        description: `${file.filename} → ${finalName}`,
      });

      // 파일 목록 새로고침
      loadDbFiles();

    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: t('errors.general'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(false);
      setRenamingFileId(null);
      setNewFileName('');
    }
  };

  // 이름 변경 시작
  const startRenaming = (file: DbGCodeFile) => {
    setRenamingFileId(file.id);
    // 확장자를 제외한 이름으로 설정
    const nameWithoutExt = file.filename.replace(/\.(gcode|gco)$/i, '');
    setNewFileName(nameWithoutExt);
  };

  // 이름 변경 취소
  const cancelRenaming = () => {
    setRenamingFileId(null);
    setNewFileName('');
  };

  return (
    <Card className="h-full flex flex-col border border-border/50 shadow-card bg-card rounded-2xl">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileCode2 className="h-4 w-4 text-violet-500" />
            </div>
            {t('gcode.title')}
          </CardTitle>
          {/* 파일 소스 토글 */}
          <div className="flex rounded-lg bg-muted/50 p-1">
            <button
              onClick={async () => {
                setFileSource('LOCAL');
                try {
                  if (deviceUuid) await mqttConnect();
                } catch {}
              }}
              disabled={!isConnected}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                fileSource === 'LOCAL'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('gcode.localFiles')}
            </button>
            <button
              onClick={async () => {
                setFileSource('SDCARD');
                try {
                  if (deviceUuid) await mqttConnect();
                } catch {}
              }}
              disabled={!isConnected}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                fileSource === 'SDCARD'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t('gcode.sdCard')}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-4 overflow-hidden">
        {/* 파일 목록 */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t('gcode.uploadGcode')}
            </Label>
            <span className="text-xs text-muted-foreground">
              {currentFiles.length} {currentFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          <ScrollArea className="h-[calc(100%-2rem)] pr-3">
            {currentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileCode2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">{t('gcode.noFiles')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fileSource === 'LOCAL' ? (
                  localMqttFiles.map((file, idx) => {
                    const fileName = file.name || file.display || '';
                    const isInCloud = dbFileNames.has(fileName);
                    const dbFile = isInCloud ? getDbFileByName(fileName) : null;

                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-background relative">
                          <FileCode2 className="h-4 w-4 text-muted-foreground" />
                          {isInCloud && (
                            <Cloud className="h-3 w-3 text-blue-500 absolute -top-1 -right-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1.5">
                            {file.display || file.name}
                            {isInCloud && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                Cloud
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                        {/* 뷰어 버튼 (클라우드에 있을 때만) */}
                        {isInCloud && dbFile && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewGcode(dbFile.id)}
                            className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-500/10 hover:text-violet-600"
                            title={t('gcode.viewGcode')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrint(fileName, 'local')}
                          disabled={isPrinting || !isConnected}
                          className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500/10 hover:text-emerald-600"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        {/* 클라우드 파일 관리 메뉴 */}
                        {isInCloud && dbFile && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startRenaming(dbFile)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t('common.rename')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setFileToDelete(dbFile);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })
                ) : (
                  sdFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-background">
                        <FileCode2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePrint(file.name, 'sdcard')}
                        disabled={isPrinting || !isConnected}
                        className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 업로드 영역 */}
        <div className="pt-4 border-t border-border/50 mt-4 space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".gcode,.gco"
                onChange={handleFileSelect}
                disabled={uploading || !isConnected}
                className="h-10 text-sm file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium"
              />
            </div>
            <Button
              onClick={() => {
                if (selectedFile) {
                  handleUpload(selectedFile);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploading || !isConnected}
              className="h-10 px-4 gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {selectedFile ? t('common.upload') : t('common.search')}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('common.uploading')}</span>
                <span className="font-medium tabular-nums">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete?.filename} 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCloudFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 이름 변경 다이얼로그 */}
      <AlertDialog open={!!renamingFileId} onOpenChange={(open) => !open && cancelRenaming()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.rename')}</AlertDialogTitle>
            <AlertDialogDescription>
              새로운 파일명을 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="새 파일명"
              disabled={isRenaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRenaming) {
                  const file = dbFiles.find(f => f.id === renamingFileId);
                  if (file) handleRenameCloudFile(file);
                }
                if (e.key === 'Escape') cancelRenaming();
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              .gcode 확장자는 자동으로 추가됩니다.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming} onClick={cancelRenaming}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const file = dbFiles.find(f => f.id === renamingFileId);
                if (file) handleRenameCloudFile(file);
              }}
              disabled={isRenaming || !newFileName.trim()}
            >
              {isRenaming ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
