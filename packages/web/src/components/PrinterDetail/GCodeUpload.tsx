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
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mqttConnect, publishSdUploadChunkFirst, publishSdUploadChunk, publishSdUploadCommit, waitForSdUploadResult, onDashStatusMessage, publishGcodePrint } from "@shared/services/mqttService";
import { supabase } from "@shared/integrations/supabase/client";
import { useTranslation } from "react-i18next";

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

      await mqttConnect();

      const uploadId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const total = bytes.length;
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

      const resultPromise = waitForSdUploadResult(
        deviceUuid!,
        (progress) => {
          setUploadProgress(Math.min(99, progress.percent));
        }
      );

      let sent = 0;
      let index = 0;
      while (sent < total) {
        const next = Math.min(sent + chunkSize, total);
        await sendChunk(index, sent, next);
        sent = next;
        index += 1;
        setUploadProgress(Math.min(99, Math.round((sent / total) * 100)));
      }

      await publishSdUploadCommit(deviceUuid!, uploadId, fileSource === 'SDCARD' ? 'sd' : 'local');

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

  useEffect(() => {
    loadFiles();
  }, []);

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

  return (
    <Card className="h-full flex flex-col border border-border/50 shadow-md bg-card rounded-2xl">
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
                  localMqttFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-background">
                        <FileCode2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {file.display || file.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePrint(file.name || file.display || '', 'local')}
                        disabled={isPrinting || !isConnected}
                        className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
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
    </Card>
  );
};
