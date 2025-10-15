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
  Trash2,
  Eye,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import { generateSTLThumbnail, getSTLInfo } from "@shared/utils/stlThumbnail";

interface STLFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  storage_url?: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  upload_date: string;
  triangle_count?: number;
  bounding_box?: { x: number; y: number; z: number };
  status: string;
}

interface STLUploadProps {
  onFileSelect?: (file: STLFile) => void;
}

export const STLUpload = ({ onFileSelect }: STLUploadProps) => {
  const [files, setFiles] = useState<STLFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!/\.stl$/i.test(file.name)) {
      toast({
        title: "파일 형식 오류",
        description: "STL 파일(.stl)만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "파일 크기는 100MB 이하여야 합니다.",
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
      setUploadProgress(10);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('로그인이 필요합니다.');
      }

      // Generate thumbnail (required)
      toast({ title: '썸네일 생성 중...', description: '잠시만 기다려주세요.' });
      setUploadProgress(20);

      const thumbnailBlob = await generateSTLThumbnail(file, 400, 400);
      setUploadProgress(40);

      // Get STL info
      const stlInfo = await getSTLInfo(file);
      setUploadProgress(50);

      // Upload STL file to storage
      const stlFileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: stlUploadError } = await supabase.storage
        .from('stl-files')
        .upload(stlFileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (stlUploadError) throw stlUploadError;
      setUploadProgress(70);

      // Upload thumbnail to storage (required)
      const thumbnailFileName = `${user.id}/${Date.now()}_thumbnail.png`;
      const { error: thumbnailUploadError } = await supabase.storage
        .from('stl-thumbnails')
        .upload(thumbnailFileName, thumbnailBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png'
        });

      if (thumbnailUploadError) throw thumbnailUploadError;
      setUploadProgress(80);

      // Get public URL for thumbnail
      const { data: thumbnailUrlData } = supabase.storage
        .from('stl-thumbnails')
        .getPublicUrl(thumbnailFileName);

      // Get signed URL for STL file
      const { data: stlUrlData } = supabase.storage
        .from('stl-files')
        .getPublicUrl(stlFileName);

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('stl_files')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: stlFileName,
          file_size: file.size,
          storage_url: stlUrlData.publicUrl,
          thumbnail_path: thumbnailFileName,
          thumbnail_url: thumbnailUrlData.publicUrl,
          triangle_count: stlInfo.triangleCount,
          bounding_box: stlInfo.boundingBox,
          status: 'ready'
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast({
        title: "업로드 완료",
        description: `${file.name}이 성공적으로 업로드되었습니다.`,
      });

      // Reload files
      await loadFiles();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다.",
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
        .from('stl_files')
        .select('*')
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "파일 로드 실패",
        description: "파일 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteFile = async (file: STLFile) => {
    try {
      // Delete STL file from storage
      const { error: stlStorageError } = await supabase.storage
        .from('stl-files')
        .remove([file.file_path]);

      if (stlStorageError) throw stlStorageError;

      // Delete thumbnail from storage
      if (file.thumbnail_path) {
        const { error: thumbnailStorageError } = await supabase.storage
          .from('stl-thumbnails')
          .remove([file.thumbnail_path]);

        if (thumbnailStorageError) console.error('Thumbnail delete error:', thumbnailStorageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('stl_files')
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

  const handleDownloadFile = async (file: STLFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('stl-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 시작",
        description: `${file.filename}을 다운로드합니다.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "다운로드 실패",
        description: "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <File className="h-4 w-4" />
          STL 파일 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 text-xs overflow-hidden">
        {/* 파일 목록 */}
        <div className="flex-1 flex flex-col space-y-2 min-h-0">
          <Label className="text-xs">업로드된 파일 ({files.length})</Label>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">업로드된 파일이 없습니다</p>
            ) : (
              files.map((file) => (
                <div key={file.id} className="flex items-center gap-2 p-2 border rounded text-xs">
                  {file.thumbnail_url && (
                    <img
                      src={file.thumbnail_url}
                      alt={file.filename}
                      className="h-12 w-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file.filename}</div>
                    <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{formatFileSize(file.file_size)}</span>
                      {file.triangle_count && (
                        <Badge variant="secondary" className="text-xs">
                          {file.triangle_count.toLocaleString()} 삼각형
                        </Badge>
                      )}
                      {file.bounding_box && (
                        <span className="text-xs">
                          {file.bounding_box.x.toFixed(1)} × {file.bounding_box.y.toFixed(1)} × {file.bounding_box.z.toFixed(1)} mm
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFileSelect?.(file)}
                      className="h-6 w-6 p-0"
                      title="보기"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadFile(file)}
                      className="h-6 w-6 p-0"
                      title="다운로드"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteFile(file)}
                      className="h-6 w-6 p-0"
                      title="삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 파일 업로드 */}
        <div className="space-y-2">
          <Label className="text-xs">파일 업로드</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".stl"
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
              {uploading ? '처리중...' : selectedFile ? '전송' : '선택'}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">
                {uploadProgress < 40 ? '썸네일 생성 중...' :
                 uploadProgress < 70 ? '파일 업로드 중...' :
                 uploadProgress < 90 ? '메타데이터 저장 중...' : '완료 중...'}
                {' '}({uploadProgress}%)
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
