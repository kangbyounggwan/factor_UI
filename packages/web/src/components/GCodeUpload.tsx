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
import { mqttConnect, publishSdUploadChunkFirst, publishSdUploadChunk, publishSdUploadCommit, waitForSdUploadResult } from "@shared/services/mqttService";
import { useWebSocket } from "@shared/hooks/useWebSocket";
import { supabase } from "@shared/integrations/supabase/client";

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
}

export const GCodeUpload = ({ deviceUuid }: GCodeUploadProps) => {
  const { isConnected, printerStatus } = useWebSocket();
  const [files, setFiles] = useState<GCodeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const isPrinting = printerStatus.printing;
  const [sdFiles, setSdFiles] = useState<Array<{ name: string; size: number }>>([]);

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return "미정";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!/\.(gcode|gco)$/i.test(file.name)) {
      toast({
        title: "파일 형식 오류",
        description: "G-code 파일(.gcode, .gco)만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    toast({ title: '파일 선택됨', description: `${file.name}` });
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      if (!deviceUuid) {
        throw new Error('디바이스가 선택되지 않았습니다.');
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

      // Commit
      await publishSdUploadCommit(deviceUuid!, uploadId);

      // Wait for result
      const result = await resultPromise;
      setUploadProgress(100);
      if (result.ok) {
        toast({ title: '업로드 완료', description: `${file.name} 전송이 완료되었습니다.` });
      } else {
        toast({ title: '업로드 실패', description: result.message || '업로드 처리 중 오류가 발생했습니다.', variant: 'destructive' });
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "업로드 실패",
        description: "파일 업로드 중 오류가 발생했습니다.",
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
      title: "프린트 시작",
      description: `${file.filename} 파일로 프린트를 시작합니다.`,
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
        title: "파일 삭제",
        description: `${file.filename}이 삭제되었습니다.`,
      });

      loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "삭제 실패",
        description: "파일 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // SD 카드 리스트 이벤트 수신 → 목록 반영 (현재 디바이스만)
  useEffect(() => {
    const onSdList = (e: Event) => {
      const ce = e as CustomEvent<{ deviceSerial: string; result: any }>;
      const detail = ce?.detail;
      if (!detail) return;
      if (deviceUuid && detail.deviceSerial !== deviceUuid) return;
      const res = detail.result || {};
      if (res.ok && Array.isArray(res.files)) {
        setSdFiles(res.files.map((f: any) => ({ name: String(f.name), size: Number(f.size) || 0 })));
      }
    };
    window.addEventListener('sd_list_result', onSdList as EventListener);
    return () => window.removeEventListener('sd_list_result', onSdList as EventListener);
  }, [deviceUuid]);

  return (
    <Card className="h-full flex flex-col">{/* Remove mt-6 and add height/flex */}
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <File className="h-4 w-4" />
          G-code 파일 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 파일 업로드 */}
        <div className="space-y-2">
          <Label className="text-xs">파일 업로드</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".gcode,.gco"
              onChange={handleFileSelect}
              disabled={uploading}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedFile) {
                  handleUpload(selectedFile);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploading}
              className="h-8 px-3"
            >
              <Upload className="h-3 w-3 mr-1" />
              {selectedFile ? '전송' : '선택'}
            </Button>
          </div>
          
          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">업로드 중... {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* 파일 목록 */}
        <div className="flex-1 flex flex-col space-y-2 min-h-0">
          <Label className="text-xs">업로드된 파일</Label>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {sdFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                업로드된 파일이 없습니다
              </p>
            ) : (
              sdFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded text-xs">
                  <File className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{typeof file === 'object' ? (file as any).filename || file.name : String(file)}</div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-2 w-2" />
                        {formatFileSize((file as any).file_size ?? (file as any).size ?? 0)}
                      </span>
                      {(file as any).print_time_estimate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2 w-2" />
                          {formatTime((file as any).print_time_estimate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {/* TODO: SD 파일 프린트 시작 퍼블리시 */}}
                    disabled={!isConnected || isPrinting}
                    className="h-6 w-6 p-0"
                  >
                    <Play className="h-2 w-2" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* 하단 별도 SD 카드 목록은 제거 (상단 목록에 통합) */}
        </div>
      </CardContent>
    </Card>
  );
};