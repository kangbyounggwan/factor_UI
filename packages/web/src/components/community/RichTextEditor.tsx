/**
 * RichTextEditor 컴포넌트
 * 네이버 카페 스타일의 리치 텍스트 에디터
 * - 이미지 크기 조절 지원
 * - 첨부 영역 동기화
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Youtube from '@tiptap/extension-youtube';
import { Model3DNode } from './Model3DNode';
import { ResizableImageNode } from './ResizableImageNode';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Highlighter,
  Palette,
  Minus,
  Box,
  X,
  ImagePlus,
  Loader2,
  FileCode,
  Youtube as YoutubeIcon,
  ExternalLink,
} from 'lucide-react';

// 폰트 사이즈 옵션
const FONT_SIZES = [
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
  { value: '24px', label: '24' },
  { value: '28px', label: '28' },
  { value: '32px', label: '32' },
];

// 색상 프리셋
const COLOR_PRESETS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff',
  '#9933ff', '#ff3399', '#00cccc', '#663300', '#336600',
];

// 하이라이트 색상 프리셋
const HIGHLIGHT_PRESETS = [
  '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff6600',
  '#ffcc99', '#ccff99', '#99ccff', '#ff99cc', '#ffffcc',
];

// 첨부 이미지 타입
export interface AttachedImage {
  url: string;
  file?: File;
  isInContent: boolean;
}

// 3D 모델 파일 타입
export interface Attached3DFile {
  url: string;
  filename: string;
  filetype: string;
  isLoading?: boolean;
}

// G-code 파일 타입
export interface AttachedGCodeFile {
  gcodeEmbedId: string;
  segmentId: string;
  url: string;
  filename: string;
  isLoading?: boolean;
}

// 에디터 API를 외부에 노출
export interface RichTextEditorApi {
  removeModel3DByUrl: (url: string) => void;
  removeGCodeByUrl: (url: string) => void;
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  on3DUpload?: (file: File) => Promise<{ url: string; thumbnail?: string } | null>;
  onGCodeUpload?: (file: File) => Promise<{ url: string; id: string } | null>;
  minHeight?: string;
  // 첨부 이미지 관련 props
  attachedImages?: AttachedImage[];
  onAttachedImagesChange?: (images: AttachedImage[]) => void;
  showAttachmentSection?: boolean;
  maxImages?: number;
  // 3D 모델/G-code 동기화 관련 props
  attached3DFiles?: Attached3DFile[];
  on3DFilesChange?: (files: Attached3DFile[]) => void;
  attachedGCodeFiles?: AttachedGCodeFile[];
  onGCodeFilesChange?: (files: AttachedGCodeFile[]) => void;
  // 에디터 API 콜백 (에디터 준비되면 호출)
  onEditorReady?: (api: RichTextEditorApi) => void;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요',
  onImageUpload,
  on3DUpload,
  onGCodeUpload,
  minHeight = '300px',
  attachedImages = [],
  onAttachedImagesChange,
  showAttachmentSection = true,
  maxImages = 5,
  attached3DFiles = [],
  on3DFilesChange,
  attachedGCodeFiles = [],
  onGCodeFilesChange,
  onEditorReady,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [uploading, setUploading] = useState(false);

  // YouTube URL 감지 함수
  const isYoutubeUrl = useCallback((url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i;
    return youtubeRegex.test(url);
  }, []);

  // YouTube Video ID 추출 함수
  const extractYoutubeVideoId = useCallback((url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
      /(?:youtu\.be\/)([^?\s]+)/,
      /(?:youtube\.com\/embed\/)([^?\s]+)/,
      /(?:youtube\.com\/shorts\/)([^?\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }, []);

  // 현재 입력된 URL이 YouTube인지 확인
  const isCurrentUrlYoutube = isYoutubeUrl(linkUrl);
  const youtubeVideoId = isCurrentUrlYoutube ? extractYoutubeVideoId(linkUrl) : null;

  // 확장 배열을 메모이제이션하여 중복 경고 방지
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    ResizableImageNode,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary underline',
      },
    }),
    Placeholder.configure({
      placeholder,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    Model3DNode,
    Youtube.configure({
      inline: false,
      nocookie: true, // privacy-enhanced mode
      allowFullscreen: true,
      HTMLAttributes: {
        class: 'youtube-embed rounded-lg overflow-hidden my-4',
      },
    }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);

      // 첨부 이미지 동기화 - 콘텐츠 내 이미지 상태 업데이트
      if (onAttachedImagesChange) {
        syncAttachedImages(html);
      }

      // 3D 파일 동기화 - 에디터에서 삭제 시 첨부 목록에서도 삭제
      if (on3DFilesChange) {
        sync3DFiles(html);
      }

      // G-code 파일 동기화 - 에디터에서 삭제 시 첨부 목록에서도 삭제
      if (onGCodeFilesChange) {
        syncGCodeFiles(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
        style: `min-height: ${minHeight}; padding: 1rem;`,
      },
    },
  });

  // 콘텐츠 내 이미지 URL 추출
  const extractImagesFromContent = useCallback((html: string): string[] => {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  }, []);

  // 콘텐츠 내 3D 모델 URL 추출 (G-code 제외)
  const extract3DModelsFromContent = useCallback((html: string): string[] => {
    // model-3d-embed 클래스를 가진 div에서 data-url과 data-type 추출
    // G-code가 아닌 3D 모델만 추출 (stl, obj, gltf, glb, 3mf)
    const urls: string[] = [];

    // 각 model-3d-embed 블록을 찾아서 분석
    const blockRegex = /<div[^>]*class="model-3d-embed"[^>]*>/gi;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const block = blockMatch[0];
      const urlMatch = block.match(/data-url="([^"]+)"/i);
      const typeMatch = block.match(/data-type="([^"]+)"/i);

      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('temp_')) {
        const fileType = typeMatch ? typeMatch[1].toLowerCase() : '';
        // G-code 타입이 아닌 경우만 포함
        if (!['gcode', 'nc', 'ngc'].includes(fileType)) {
          urls.push(urlMatch[1]);
        }
      }
    }
    return [...new Set(urls)]; // 중복 제거
  }, []);

  // 콘텐츠 내 G-code URL 추출
  const extractGCodesFromContent = useCallback((html: string): string[] => {
    // model-3d-embed 클래스를 가진 div에서 G-code 타입만 추출
    const urls: string[] = [];

    // 각 model-3d-embed 블록을 찾아서 분석
    const blockRegex = /<div[^>]*class="model-3d-embed"[^>]*>/gi;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const block = blockMatch[0];
      const urlMatch = block.match(/data-url="([^"]+)"/i);
      const typeMatch = block.match(/data-type="([^"]+)"/i);

      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('temp_')) {
        const fileType = typeMatch ? typeMatch[1].toLowerCase() : '';
        // G-code 타입인 경우만 포함
        if (['gcode', 'nc', 'ngc'].includes(fileType)) {
          urls.push(urlMatch[1]);
        }
      }
    }
    return [...new Set(urls)]; // 중복 제거
  }, []);

  // 첨부 이미지와 콘텐츠 동기화
  const syncAttachedImages = useCallback((html: string) => {
    if (!onAttachedImagesChange) return;

    const contentUrls = extractImagesFromContent(html);
    const updatedImages = attachedImages.map(img => ({
      ...img,
      isInContent: contentUrls.includes(img.url),
    }));

    // 상태가 변경된 경우만 업데이트
    const hasChanged = attachedImages.some((img, i) =>
      img.isInContent !== updatedImages[i].isInContent
    );

    if (hasChanged) {
      onAttachedImagesChange(updatedImages);
    }
  }, [attachedImages, onAttachedImagesChange, extractImagesFromContent]);

  // 첨부 3D 파일과 콘텐츠 동기화 (에디터에서 삭제 시 첨부 목록에서도 삭제)
  const sync3DFiles = useCallback((html: string) => {
    if (!on3DFilesChange || attached3DFiles.length === 0) return;

    const contentUrls = extract3DModelsFromContent(html);
    // 에디터에 없는 3D 파일은 첨부 목록에서 제거 (로딩 중인 파일은 유지)
    const updatedFiles = attached3DFiles.filter(f =>
      f.isLoading || contentUrls.includes(f.url)
    );

    if (updatedFiles.length !== attached3DFiles.length) {
      on3DFilesChange(updatedFiles);
    }
  }, [attached3DFiles, on3DFilesChange, extract3DModelsFromContent]);

  // 첨부 G-code 파일과 콘텐츠 동기화 (에디터에서 삭제 시 첨부 목록에서도 삭제)
  const syncGCodeFiles = useCallback((html: string) => {
    if (!onGCodeFilesChange || attachedGCodeFiles.length === 0) return;

    const contentUrls = extractGCodesFromContent(html);
    // 에디터에 없는 G-code 파일은 첨부 목록에서 제거 (로딩 중인 파일은 유지)
    const updatedFiles = attachedGCodeFiles.filter(f =>
      f.isLoading || contentUrls.includes(f.url)
    );

    if (updatedFiles.length !== attachedGCodeFiles.length) {
      onGCodeFilesChange(updatedFiles);
    }
  }, [attachedGCodeFiles, onGCodeFilesChange, extractGCodesFromContent]);

  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (file?: File) => {
    if (!onImageUpload) return;

    const processFile = async (f: File) => {
      if (f.size > 5 * 1024 * 1024) {
        alert('이미지가 너무 큽니다 (최대 5MB)');
        return;
      }

      setUploading(true);
      try {
        const url = await onImageUpload(f);
        if (url) {
          // 에디터에 이미지 삽입
          if (editor) {
            editor.chain().focus().setResizableImage({ src: url }).run();
          }

          // 첨부 이미지 목록에 추가
          if (onAttachedImagesChange) {
            const newImage: AttachedImage = {
              url,
              file: f,
              isInContent: true,
            };
            onAttachedImagesChange([...attachedImages, newImage]);
          }
        }
      } catch (error) {
        console.error('[RichTextEditor] Error uploading image:', error);
      } finally {
        setUploading(false);
      }
    };

    if (file) {
      await processFile(file);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
          for (const f of Array.from(files)) {
            if (attachedImages.length >= maxImages) break;
            await processFile(f);
          }
        }
      };
      input.click();
    }
  }, [editor, onImageUpload, attachedImages, onAttachedImagesChange, maxImages]);

  // 3D 모델 업로드 핸들러
  const handle3DUpload = useCallback(async () => {
    if (!on3DUpload) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl,.obj,.3mf,.gltf,.glb';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editor) {
        const fileName = file.name;
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        const tempUrl = `temp_3d_${Date.now()}`;

        // 1. 먼저 로딩 상태로 노드 삽입
        editor.chain().focus().setModel3D({
          url: tempUrl,
          filename: fileName,
          filetype: fileExt,
          isLoading: true,
        }).run();

        // 2. 실제 업로드 수행 (썸네일 포함)
        const result = await on3DUpload(file);

        if (result) {
          // 3. 업로드 완료 - 노드 업데이트 (썸네일 포함)
          editor.commands.updateModel3DLoading(tempUrl, result.url, result.thumbnail);
        } else {
          // 업로드 실패 - 노드 제거
          const { state } = editor;
          let posToDelete: number | null = null;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === tempUrl) {
              posToDelete = pos;
              return false;
            }
            return true;
          });
          if (posToDelete !== null) {
            editor.chain().focus().deleteRange({ from: posToDelete, to: posToDelete + 1 }).run();
          }
        }
      }
    };
    input.click();
  }, [editor, on3DUpload]);

  // GCode 업로드 핸들러
  const handleGCodeUpload = useCallback(async () => {
    if (!onGCodeUpload) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gcode,.nc,.ngc';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editor) {
        const fileName = file.name;
        const fileExt = fileName.split('.').pop()?.toLowerCase() || 'gcode';
        const tempUrl = `temp_gcode_${Date.now()}`;

        // 1. 먼저 로딩 상태로 노드 삽입
        editor.chain().focus().setModel3D({
          url: tempUrl,
          filename: fileName,
          filetype: fileExt,
          isLoading: true,
        }).run();

        // 2. 실제 업로드 수행
        const result = await onGCodeUpload(file);

        if (result) {
          // 3. 업로드 완료 - gcodeId도 함께 업데이트
          const { state, view } = editor;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === tempUrl) {
              const tr = state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                url: result.url,
                gcodeId: result.id,
                isLoading: false,
              });
              view.dispatch(tr);
              return false;
            }
            return true;
          });
        } else {
          // 업로드 실패 - 노드 제거
          const { state } = editor;
          let posToDelete: number | null = null;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'model3d' && node.attrs.url === tempUrl) {
              posToDelete = pos;
              return false;
            }
            return true;
          });
          if (posToDelete !== null) {
            editor.chain().focus().deleteRange({ from: posToDelete, to: posToDelete + 1 }).run();
          }
        }
      }
    };
    input.click();
  }, [editor, onGCodeUpload]);

  // 링크 추가 핸들러
  const handleAddLink = useCallback(() => {
    if (!editor || !linkUrl) return;

    if (linkUrl === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkUrl('');
    setShowLinkPopover(false);
  }, [editor, linkUrl]);

  // YouTube 임베드 핸들러
  const handleAddYoutubeEmbed = useCallback(() => {
    if (!editor || !linkUrl) return;

    const videoId = extractYoutubeVideoId(linkUrl);
    if (!videoId) return;

    // YouTube URL을 정규화
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

    editor.commands.setYoutubeVideo({
      src: normalizedUrl,
      width: 640,
      height: 360,
    });

    setLinkUrl('');
    setShowLinkPopover(false);
  }, [editor, linkUrl, extractYoutubeVideoId]);

  // 첨부 이미지 삭제 (목록에서만)
  const handleRemoveAttachedImage = useCallback((index: number) => {
    if (!onAttachedImagesChange) return;

    const imageToRemove = attachedImages[index];
    const newImages = attachedImages.filter((_, i) => i !== index);
    onAttachedImagesChange(newImages);

    // 콘텐츠에서 해당 이미지 제거
    if (editor && imageToRemove.isInContent) {
      const { state } = editor;
      const { doc } = state;
      let posToDelete: number | null = null;

      doc.descendants((node, pos) => {
        if (node.type.name === 'resizableImage' && node.attrs.src === imageToRemove.url) {
          posToDelete = pos;
          return false;
        }
        return true;
      });

      if (posToDelete !== null) {
        editor.chain().focus().deleteRange({ from: posToDelete, to: posToDelete + 1 }).run();
      }
    }
  }, [editor, attachedImages, onAttachedImagesChange]);

  // 3D 파일을 에디터에서 삭제하는 헬퍼 함수
  const removeModel3DFromEditor = useCallback((url: string) => {
    if (!editor) return;
    // TipTap 커맨드 사용하여 삭제
    editor.commands.removeModel3DByUrl(url);
  }, [editor]);

  // G-code 파일을 에디터에서 삭제하는 헬퍼 함수 (URL 기반)
  const removeGCodeFromEditor = useCallback((url: string) => {
    if (!editor) return;
    // 3D 모델과 동일한 노드 타입(model3d) 사용
    editor.commands.removeModel3DByUrl(url);
  }, [editor]);

  // 에디터 준비 완료 시 API 제공
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady({
        removeModel3DByUrl: removeModel3DFromEditor,
        removeGCodeByUrl: removeGCodeFromEditor,
      });
    }
  }, [editor, onEditorReady, removeModel3DFromEditor, removeGCodeFromEditor]);

  // 첨부 이미지를 콘텐츠에 삽입
  const insertImageToContent = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().setResizableImage({ src: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* 툴바 */}
      <div className="border-b bg-muted/30">
        {/* 상단 툴바 - 미디어 버튼 */}
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleImageUpload()}
            className="h-8 px-2 text-xs gap-1"
            disabled={!onImageUpload || uploading}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            이미지
          </Button>

          <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-xs gap-1",
                  editor.isActive('link') && "bg-muted"
                )}
              >
                <LinkIcon className="w-4 h-4" />
                링크
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
              <div className="space-y-3">
                {/* URL 입력 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">URL을 입력하세요</label>
                  <Input
                    placeholder="https://example.com 또는 YouTube 링크"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (isCurrentUrlYoutube) {
                          handleAddYoutubeEmbed();
                        } else {
                          handleAddLink();
                        }
                      }
                    }}
                    className="h-9"
                  />
                </div>

                {/* YouTube 감지 시 미리보기 및 옵션 */}
                {isCurrentUrlYoutube && youtubeVideoId && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                      <YoutubeIcon className="w-4 h-4" />
                      YouTube 영상 감지됨
                    </div>
                    {/* 썸네일 미리보기 */}
                    <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black/10">
                      <img
                        src={`https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`}
                        alt="YouTube 썸네일"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                          <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                        </div>
                      </div>
                    </div>
                    {/* 임베드 버튼 */}
                    <Button
                      size="sm"
                      onClick={handleAddYoutubeEmbed}
                      className="w-full gap-2 bg-red-600 hover:bg-red-700"
                    >
                      <YoutubeIcon className="w-4 h-4" />
                      영상 삽입
                    </Button>
                  </div>
                )}

                {/* 일반 링크 버튼 */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isCurrentUrlYoutube ? "outline" : "default"}
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim()}
                    className="gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {isCurrentUrlYoutube ? '링크로 추가' : '적용'}
                  </Button>
                  {editor.isActive('link') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        editor.chain().focus().unsetLink().run();
                        setShowLinkPopover(false);
                      }}
                    >
                      링크 제거
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={handle3DUpload}
            className="h-8 px-2 text-xs gap-1"
            disabled={!on3DUpload}
          >
            <Box className="w-4 h-4" />
            3D
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleGCodeUpload}
            className="h-8 px-2 text-xs gap-1"
            disabled={!onGCodeUpload}
          >
            <FileCode className="w-4 h-4" />
            GCode
          </Button>
        </div>

        {/* 하단 툴바 - 서식 버튼 */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
          {/* 폰트 크기 */}
          <Select
            value="16px"
            onValueChange={(value) => {
              editor.chain().focus().setMark('textStyle', { fontSize: value }).run();
            }}
          >
            <SelectTrigger className="w-16 h-8 text-xs">
              <SelectValue placeholder="크기" />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* 텍스트 스타일 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8", editor.isActive('bold') && "bg-muted")}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8", editor.isActive('italic') && "bg-muted")}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn("h-8 w-8", editor.isActive('underline') && "bg-muted")}
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn("h-8 w-8", editor.isActive('strike') && "bg-muted")}
          >
            <Strikethrough className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* 색상 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Palette className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                색상 초기화
              </Button>
            </PopoverContent>
          </Popover>

          {/* 하이라이트 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('highlight') && "bg-muted")}
              >
                <Highlighter className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_PRESETS.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setHighlight({ color }).run()}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
              >
                하이라이트 제거
              </Button>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* 리스트 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("h-8 w-8", editor.isActive('bulletList') && "bg-muted")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("h-8 w-8", editor.isActive('orderedList') && "bg-muted")}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* 정렬 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={cn("h-8 w-8", editor.isActive({ textAlign: 'left' }) && "bg-muted")}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={cn("h-8 w-8", editor.isActive({ textAlign: 'center' }) && "bg-muted")}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={cn("h-8 w-8", editor.isActive({ textAlign: 'right' }) && "bg-muted")}
          >
            <AlignRight className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* 인용, 코드 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("h-8 w-8", editor.isActive('blockquote') && "bg-muted")}
          >
            <Quote className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn("h-8 w-8", editor.isActive('codeBlock') && "bg-muted")}
          >
            <Code className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="h-8 w-8"
          >
            <Minus className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 에디터 영역 */}
      <EditorContent editor={editor} className="overflow-auto" />

      {/* 첨부 영역 */}
      {showAttachmentSection && onAttachedImagesChange && (
        <div className="border-t bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">첨부</span>
            <span className="text-xs text-muted-foreground">
              최대 {maxImages}장, 각 5MB 이하
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* 첨부된 이미지들 */}
            {attachedImages.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "relative group w-20 h-20 rounded-lg overflow-hidden border-2",
                  image.isInContent
                    ? "border-primary/50 bg-primary/5"
                    : "border-dashed border-muted-foreground/30"
                )}
              >
                <img
                  src={image.url}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => !image.isInContent && insertImageToContent(image.url)}
                  title={image.isInContent ? "본문에 삽입됨" : "클릭하여 본문에 삽입"}
                />

                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleRemoveAttachedImage(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="삭제"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* 상태 표시 */}
                {image.isInContent && (
                  <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-[10px] text-center py-0.5">
                    삽입됨
                  </div>
                )}
              </div>
            ))}

            {/* 추가 버튼 */}
            {attachedImages.length < maxImages && (
              <button
                onClick={() => handleImageUpload()}
                disabled={uploading}
                className={cn(
                  "w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1",
                  "text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                )}
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs">추가</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RichTextEditor;
