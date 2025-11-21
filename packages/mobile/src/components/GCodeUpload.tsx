import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Upload,
  File as FileIcon,
  Play,
  Trash2,
  Clock,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mqttConnect, publishSdUploadChunkFirst, publishSdUploadChunk, publishSdUploadCommit, waitForSdUploadResult, onDashStatusMessage,  publishGcodePrint } from "@shared/services/mqttService";
import { supabase } from "@shared/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';

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
  const [files, setFiles] = useState<GCodeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [sdFiles, setSdFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [localMqttFiles, setLocalMqttFiles] = useState<Array<{ name: string; display?: string; size?: number; date?: number | string | null; estimatedPrintTime?: number; user?: string; path?: string }>>([]);
  const [fileSource, setFileSource] = useState<'LOCAL' | 'SDCARD'>('LOCAL');

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
        });

        if (!result.files || result.files.length === 0) return;

        const pickedFile = result.files[0];

        // Check file extension
        if (!/\.(gcode|gco)$/i.test(pickedFile.name || '')) {
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

        setSelectedFile(file);
        toast({ title: t('gcode.selectFile'), description: `${file.name}` });
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
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      if (!deviceUuid) {
        throw new Error(t('errors.deviceNotSelected'));
      }

      await mqttConnect();

      const uploadId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const total = bytes.length;
      const chunkSize = 32 * 1024; // 32KB

      const toB64 = (chunk: Uint8Array) => {
        let binary = '';
        for (let i = 0; i < chunk.length; i += 1) binary += String.fromCharCode(chunk[i]);
        // btoa expects binary string
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
            // sd/local 선택값을 시작 메시지에 포함
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

      // 결과 대기 프라미스 (진행률 콜백 포함)
      const resultPromise = waitForSdUploadResult(
        deviceUuid!,
        (progress) => {
          // 실제 디바이스 진행률로 업데이트
          setUploadProgress(Math.min(99, progress.percent));
        }
      );

      // Send chunks
      let sent = 0;
      let index = 0;
      while (sent < total) {
        const next = Math.min(sent + chunkSize, total);
        // eslint-disable-next-line no-await-in-loop
        await sendChunk(index, sent, next);
        sent = next;
        index += 1;
        setUploadProgress(Math.min(99, Math.round((sent / total) * 100)));
      }

      // Commit (end target matches start's upload_traget)
      await publishSdUploadCommit(deviceUuid!, uploadId, fileSource === 'SDCARD' ? 'sd' : 'local');

      // Wait for result
      const result = await resultPromise;
      setUploadProgress(100);
      if (result.ok) {
        toast({ title: t('gcode.uploadSuccess'), description: `${file.name}` });
      } else {
        toast({ title: t('gcode.uploadFailed'), description: result.message || t('gcode.uploadFailed'), variant: 'destructive' });
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

  // octoprint/status 수신 → sd.local / sd.sdcard, printing 상태 반영 (현재 디바이스만)
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

  // 초기 마운트 및 디바이스 변경 시 최신 상태 요청 (sd 리스트 강제 갱신)


  return (
    <Card className="h-full flex flex-col">{/* Remove mt-6 and add height/flex */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileIcon className="h-4 w-4" />
            {t('gcode.title')}
          </CardTitle>
          <div className="flex items-center gap-4">
            <RadioGroup value={fileSource} onValueChange={async (v) => {
              const next = v as 'LOCAL' | 'SDCARD';
              setFileSource(next);
              try {
                if (deviceUuid) await mqttConnect();
              } catch (error) {
                console.warn('[GCODE] Failed to connect MQTT on source change:', error);
              }
            }} disabled={!isConnected} className="flex flex-row gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="gc-local" value="LOCAL" disabled={!isConnected} />
                <Label htmlFor="gc-local" className={`text-xs ${!isConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>{t('gcode.localFiles')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="gc-sd" value="SDCARD" disabled={!isConnected} />
                <Label htmlFor="gc-sd" className={`text-xs ${!isConnected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>{t('gcode.sdCard')}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 파일 목록 */}
        <div className="flex-1 flex flex-col space-y-2 min-h-0">
          <Label className="text-xs">{t('gcode.uploadGcode')} ({fileSource === 'LOCAL' ? t('gcode.localFiles') : t('gcode.sdCard')})</Label>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {fileSource === 'LOCAL' ? (
              localMqttFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">{t('gcode.noFiles')}</p>
              ) : (
                localMqttFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-2 p-2 border rounded text-xs">
                    <FileIcon className="h-3 w-3 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.display || file.name}</div>
                      <div className="text-muted-foreground flex items-center gap-2">
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (!deviceUuid) {
                            toast({ title: t('errors.general'), description: t('errors.general'), variant: 'destructive' });
                            return;
                          }
                          await mqttConnect();
                          const origin = 'local';
                          const filename = file.name || file.display;
                          if (!filename) {
                            toast({ title: t('errors.general'), description: t('errors.fileNotSelected'), variant: 'destructive' });
                            return;
                          }
                          const jobId = filename.replace(/\.[^/.]+$/, '');
                          await publishGcodePrint(deviceUuid, { filename, origin, job_id: jobId });
                          toast({ title: t('gcode.printStart'), description: `${filename} (${origin})` });
                        } catch (error) {
                          console.error(error);
                          const message = error instanceof Error ? error.message : String(error);
                          toast({ title: t('errors.uploadFailed'), description: message, variant: 'destructive' });
                        }
                      }}
                      disabled={isPrinting || !isConnected}
                      className="h-6 w-6 p-0"
                    >
                      <Play className="h-2 w-2" />
                    </Button>
                  </div>
                ))
              )
            ) : (
              sdFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">{t('gcode.noFiles')}</p>
              ) : (
                sdFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-2 p-2 border rounded text-xs">
                    <FileIcon className="h-3 w-3 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-muted-foreground flex items-center gap-2">
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (!deviceUuid) {
                            toast({ title: t('errors.general'), description: t('errors.general'), variant: 'destructive' });
                            return;
                          }
                          await mqttConnect();
                          const origin = 'sdcard';
                          const filename = file.name;
                          const jobId = filename.replace(/\.[^/.]+$/, '');
                          await publishGcodePrint(deviceUuid, { filename, origin, job_id: jobId });
                          toast({ title: t('gcode.printStart'), description: `${filename} (${origin})` });
                        } catch (error) {
                          console.error(error);
                          const message = error instanceof Error ? error.message : String(error);
                          toast({ title: t('errors.uploadFailed'), description: message, variant: 'destructive' });
                        }
                      }}
                      disabled={isPrinting || !isConnected}
                      className="h-6 w-6 p-0"
                    >
                      <Play className="h-2 w-2" />
                    </Button>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        <div className="space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            {!Capacitor.isNativePlatform() && (
              <Input
                ref={fileInputRef}
                type="file"
                accept=".gcode,.gco"
                onChange={handleFileSelect}
                disabled={uploading || !isConnected}
                className="h-8 text-xs flex-1"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (Capacitor.isNativePlatform()) {
                  if (selectedFile) {
                    handleUpload(selectedFile);
                  } else {
                    handleFileSelect();
                  }
                } else if (selectedFile) {
                  handleUpload(selectedFile);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploading || !isConnected}
              className={Capacitor.isNativePlatform() ? "h-8 px-3 flex-1 whitespace-nowrap" : "h-8 px-3 whitespace-nowrap flex-shrink-0"}
            >
              <Upload className="h-3 w-3 mr-1" />
              {selectedFile ? t('common.upload') : t('common.search')}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">{t('common.uploading')} {uploadProgress}%</p>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};
