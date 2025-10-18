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
    if (!seconds) return "미정";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.gcode')) {
      toast({
        title: "파일 형식 오류",
        description: "G-code 파일(.gcode)만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    handleUpload(file);
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
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

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
        title: "업로드 완료",
        description: `${file.name}이 성공적으로 업로드되었습니다.`,
      });

      // Refresh file list
      loadFiles();
      
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
              accept=".gcode"
              onChange={handleFileSelect}
              disabled={uploading}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3"
            >
              <Upload className="h-3 w-3 mr-1" />
              선택
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
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                업로드된 파일이 없습니다
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
                    {file.status === 'uploaded' ? '대기' : file.status}
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