/**
 * AI 모델 아카이브 사이드바
 * 생성된 3D 모델 및 업로드된 파일 아카이브 관리
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ModelArchive from "./ModelArchive";
import UploadArchive from "./UploadArchive";
import { PrinterCard } from "@/components/PrinterCard";
import { FolderOpen, Type, Image as ImageFile, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AIGeneratedModel } from "@shared/types/aiModelType";
import { UploadedFile } from "@shared/hooks/useAIImageUpload";
import { PrinterData } from "@/types/ai";
import { toast } from "@/components/ui/use-toast";
import { deleteAIModel } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";

export interface AIModelArchiveSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    archiveViewMode: 'raw' | '3d';
    setArchiveViewMode: (mode: 'raw' | '3d') => void;
    archiveFilter: 'all' | 'text-to-3d' | 'image-to-3d';
    setArchiveFilter: (filter: 'all' | 'text-to-3d' | 'image-to-3d') => void;
    uploadedFiles: UploadedFile[];
    generatedModels: AIGeneratedModel[];
    selectedImageId: number | null;
    selectImage: (id: number) => void;
    setModelViewerUrl: (url: string | null) => void;
    setSelectedImageHasModel: (has: boolean) => void;
    setCurrentModelId: (id: string | null) => void;
    setCurrentGlbUrl: (url: string | null) => void;
    setCurrentStlUrl: (url: string | null) => void;
    setCurrentGCodeUrl: (url: string | null) => void;
    setTextPrompt: (prompt: string) => void;
    reloadModels: () => Promise<void>;

    // Printer related props
    printers: PrinterData[];
    connectedCount: number;
    totalPrinters: number;
    printingCount: number;
    printerAreaHeight: number;
    handleResizeStart: (e: React.MouseEvent) => void;
    openPrinterSettings: (printer: PrinterData) => void;
    targetPrinterModelId: string | null;
    currentGCodeUrl: string | null;
    handleModelDelete: (item: { id: string | number; name: string }) => Promise<void>;

    modelViewerUrl: string | null; // For logging/checking

    // 왼쪽 사이드바 모드용 props
    isLeftSidebar?: boolean;
    onToggle?: () => void;
}

export function AIModelArchiveSidebar({
    activeTab,
    setActiveTab,
    archiveViewMode,
    setArchiveViewMode,
    archiveFilter,
    setArchiveFilter,
    uploadedFiles,
    generatedModels,
    selectedImageId,
    selectImage,
    setModelViewerUrl,
    setSelectedImageHasModel,
    setCurrentModelId,
    setCurrentGlbUrl,
    setCurrentStlUrl,
    setCurrentGCodeUrl,
    setTextPrompt,
    reloadModels,
    printers,
    connectedCount,
    totalPrinters,
    printingCount,
    printerAreaHeight,
    handleResizeStart,
    openPrinterSettings,
    targetPrinterModelId,
    currentGCodeUrl,
    handleModelDelete,
    modelViewerUrl,
    isLeftSidebar = false,
    onToggle
}: AIModelArchiveSidebarProps) {
    const { t } = useTranslation();

    return (
        <div className={`${isLeftSidebar ? 'w-full border-r-2' : 'w-80 border-l-2'} border-border bg-muted/5 flex flex-col overflow-hidden h-full`}>
            {/* 왼쪽 사이드바 모드일 때 상단 헤더 추가 */}
            {isLeftSidebar && (
                <div className="h-14 px-3 flex items-center border-b border-border/50 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={onToggle}
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                </div>
            )}
            {/* 모델 아카이브 영역 (동적 높이) */}
            <div
                className="flex flex-col px-2 py-4 overflow-hidden"
                style={{ height: (activeTab === 'text-to-3d' || activeTab === 'image-to-3d') ? `${100 - printerAreaHeight}%` : '100%' }}
            >
                <div className="flex items-center justify-between mb-4 px-2">
                    {/* 제목 - 왼쪽 */}
                    <h2 className="text-lg font-semibold">{t('ai.modelArchive').toUpperCase()}</h2>
                    {/* RAW / 3D/2D 모델 토글 - 오른쪽 (탭에 따라 레이블 변경) */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Button
                            variant={archiveViewMode === 'raw' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => setArchiveViewMode('raw')}
                        >
                            RAW
                        </Button>
                        <Button
                            variant={archiveViewMode === '3d' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => setArchiveViewMode('3d')}
                        >
                            3D
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {archiveViewMode === 'raw' ? (
                        // RAW 모드: 입력 데이터 보여주기
                        (archiveFilter === 'image-to-3d') ? (
                            // 이미지→3D: 업로드된 이미지 목록
                            <UploadArchive
                                items={uploadedFiles.map(file => ({
                                    ...file,
                                    has3DModel: generatedModels.some(
                                        model => model.source_image_url === file.storagePath || model.source_image_url === file.url
                                    ),
                                }))}
                                selectedId={selectedImageId}
                                onSelect={(fileId) => {
                                    selectImage(fileId);
                                    const file = uploadedFiles.find(f => f.id === fileId);
                                    if (file) {
                                        const linkedModel = generatedModels.find(
                                            model => model.source_image_url === file.storagePath || model.source_image_url === file.url
                                        );
                                        if (linkedModel?.download_url) {
                                            // 캐시 무효화를 위해 updated_at 타임스탬프 추가
                                            const cacheBustedUrl = `${linkedModel.download_url}${linkedModel.download_url.includes('?') ? '&' : '?'}t=${new Date(linkedModel.updated_at || linkedModel.created_at).getTime()}`;
                                            setModelViewerUrl(cacheBustedUrl);
                                            setSelectedImageHasModel(true);
                                            toast({ title: t('ai.imageSelected'), description: file.name });
                                        } else {
                                            setSelectedImageHasModel(false);
                                            setModelViewerUrl(null);
                                        }
                                    }
                                }}
                            />
                        ) : (
                            // 텍스트→3D 또는 텍스트→이미지: 프롬프트 목록 표시
                            <ModelArchive
                                items={generatedModels
                                    .filter(model => {
                                        switch (archiveFilter) {
                                            case 'all':
                                                return true;
                                            case 'text-to-3d':
                                                return model.generation_type === 'text_to_3d';
                                            case 'image-to-3d':
                                                return model.generation_type === 'image_to_3d';
                                            default:
                                                return true;
                                        }
                                    })
                                    .map(model => ({
                                        id: model.id,
                                        name: model.prompt || model.model_name, // 프롬프트 우선 표시
                                        createdAt: model.created_at,
                                        download_url: undefined, // RAW 모드에서는 다운로드 URL 숨김
                                        thumbnail_url: undefined,
                                        gcode_url: model.gcode_url,
                                        isGenerating: model.status === 'processing',
                                    }))}
                                onSelect={(model) => {
                                    toast({
                                        title: t('ai.rawData'),
                                        description: t('ai.inputTextPrompt')
                                    });
                                }}
                            />
                        )
                    ) : (
                        // 3D/2D 모드: 생성된 모델 보여주기
                        <ModelArchive
                            items={generatedModels
                                .filter(model => {
                                    let typeMatch = false;
                                    switch (archiveFilter) {
                                        case 'all': typeMatch = true; break;
                                        case 'text-to-3d': typeMatch = model.generation_type === 'text_to_3d'; break;
                                        case 'image-to-3d': typeMatch = model.generation_type === 'image_to_3d'; break;
                                        default: typeMatch = true;
                                    }

                                    if (!typeMatch) return false;

                                    if (model.generation_type === 'image_to_3d') {
                                        return !!model.source_image_url;
                                    } else if (model.generation_type === 'text_to_3d') {
                                        return !!model.prompt;
                                    }
                                    return true;
                                })
                                .map(model => {
                                    const isSupabaseUrl = model.download_url?.includes('supabase.co') ||
                                        model.download_url?.includes('localhost') ||
                                        model.download_url?.includes('127.0.0.1');
                                    const isThumbnailSupabaseUrl = model.thumbnail_url?.includes('supabase.co') ||
                                        model.thumbnail_url?.includes('localhost') ||
                                        model.thumbnail_url?.includes('127.0.0.1');

                                    return {
                                        id: model.id,
                                        name: model.model_name,
                                        createdAt: model.created_at,
                                        download_url: isSupabaseUrl ? model.download_url : undefined,
                                        thumbnail_url: isThumbnailSupabaseUrl ? model.thumbnail_url : undefined,
                                        gcode_url: model.gcode_url,
                                        isGenerating: model.status === 'processing',
                                        _originalModel: model,
                                    };
                                })
                            }
                            onSelect={async (item: { id: string | number; _originalModel?: AIGeneratedModel; download_url?: string; name?: string }) => {
                                const model = item._originalModel;

                                if (item.download_url && model) {
                                    // 모델 ID 설정
                                    setCurrentModelId(model.id);

                                    // GLB 우선
                                    const viewerUrl = model.download_url || model.stl_download_url;
                                    const cacheBustedViewerUrl = viewerUrl ?
                                        `${viewerUrl}${viewerUrl.includes('?') ? '&' : '?'}t=${new Date(model.updated_at || model.created_at).getTime()}` :
                                        viewerUrl;

                                    setModelViewerUrl(cacheBustedViewerUrl);

                                    // 다운로드 버튼용 URL 설정
                                    setCurrentGlbUrl(model.download_url || null);
                                    setCurrentStlUrl(model.stl_download_url || null);
                                    setCurrentGCodeUrl(model.gcode_url || null);

                                    // 탭 전환 등
                                    if (model.generation_type === 'image_to_3d') {
                                        const matchedFile = uploadedFiles.find(
                                            f => f.storagePath === model.source_image_url || f.url === model.source_image_url
                                        );
                                        if (matchedFile) {
                                            selectImage(matchedFile.id);
                                            setActiveTab('image-to-3d');
                                            toast({ title: t('ai.modelLoad'), description: `${item.name} ${t('ai.modelAndImageSelected')}` });
                                        }
                                    } else if (model.generation_type === 'text_to_3d') {
                                        if (model.prompt) {
                                            setTextPrompt(model.prompt);
                                            setActiveTab('text-to-3d');
                                            toast({ title: t('ai.modelLoad'), description: `${item.name} ${t('ai.modelAndPromptRestored')}` });
                                        }
                                    } else {
                                        toast({ title: t('ai.modelLoad'), description: `${item.name} ${t('ai.rendering')}` });
                                    }
                                } else {
                                    // 모델 삭제
                                    try {
                                        setModelViewerUrl(null);
                                        await deleteAIModel(supabase, item.id.toString());
                                        await reloadModels();
                                        toast({ title: t('ai.modelDeleted'), description: t('ai.modelNotFound'), variant: 'default' });
                                    } catch (error) {
                                        console.error('[AI] Failed to delete model:', error);
                                        toast({ title: t('ai.modelDeleteFailed'), description: t('ai.modelDeleteError'), variant: 'destructive' });
                                    }
                                }
                            }}
                            onDelete={handleModelDelete}
                        />
                    )}
                </div>

                {/* 컨트롤 버튼 */}
                <div className="flex items-center justify-center gap-2 mt-4 p-2 bg-muted/5 rounded-lg shrink-0">
                    <Button
                        variant={'ghost'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setArchiveFilter('all')}
                        title="전체 보기"
                    >
                        <FolderOpen className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={archiveFilter === 'text-to-3d' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                            setArchiveFilter('text-to-3d');
                            setActiveTab('text-to-3d');
                        }}
                        title="텍스트→3D"
                    >
                        <Type className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={archiveFilter === 'image-to-3d' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                            setArchiveFilter('image-to-3d');
                            setActiveTab('image-to-3d');
                        }}
                        title="이미지→3D"
                    >
                        <ImageFile className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* 연결된 프린터 영역 (높이 조절 가능) - 3D 관련 탭에서만 표시 */}
            {(activeTab === 'text-to-3d' || activeTab === 'image-to-3d') && (
                <div
                    className="flex flex-col border-t overflow-hidden relative"
                    style={{ height: `${printerAreaHeight}%` }}
                >
                    {/* 리사이저 핸들 */}
                    <div
                        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 transition-colors z-10 group"
                        onMouseDown={handleResizeStart}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-border group-hover:bg-primary rounded-full transition-colors" />
                    </div>

                    <div className="flex flex-col p-6 pt-8 h-full overflow-hidden">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <h3 className="font-medium">{t('ai.connectedPrinters')}</h3>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                                    {t('ai.connection')}: {connectedCount}/{totalPrinters}
                                </Badge>
                                <Badge className="rounded-full px-3 py-1 text-xs">
                                    {t('ai.printing')}: {printingCount}
                                </Badge>
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3 pr-4">
                                {printers.map((printer) => (
                                    <PrinterCard
                                        key={printer.id}
                                        id={printer.id}
                                        name={printer.name}
                                        status={printer.state as any}
                                        temperature={printer.temperature}
                                        progress={printer.completion}
                                        onClick={() => openPrinterSettings(printer)}
                                        isAvailable={
                                            // G-code URL이 있거나, 모델 URL(GLB/STL)이 있으면 슬라이싱 가능
                                            (!!currentGCodeUrl || !!modelViewerUrl) &&
                                            (printer.state === 'idle' || printer.state === 'disconnected') &&
                                            (!targetPrinterModelId || printer.manufacture_id === targetPrinterModelId)
                                        }
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AIModelArchiveSidebar;
