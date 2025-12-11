import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@shared/integrations/supabase/client";
import {
    getManufacturers,
    getSeriesByManufacturer,
    getModelsByManufacturerAndSeries,
    getManufacturingPrinterById
} from "@shared/api/manufacturingPrinter";
import {
    createSlicingTask,
    processSlicingTask
} from "@shared/services/backgroundSlicing";
import {
    mqttConnect,
    publishSdUploadChunkFirst,
    publishSdUploadChunk,
    publishSdUploadCommit,
    waitForGCodeUploadResult
} from "@shared/services/mqttService";
import {
    uploadSTLAndSlice,
    SlicingSettings,
    PrinterDefinition
} from "@shared/services/aiService";
import {
    updateAIModel
} from "@shared/services/supabaseService/aiModel";
import {
    downloadAndUploadGCode, deleteModelFiles
} from "@shared/services/supabaseService/aiStorage";

import type { PrinterData as Printer, PrintSettings, GCodeInfo } from "@/types/ai";
import type { AIGeneratedModel } from "@shared/types/aiModelType";

interface UsePrintJobProps {
    user: any;
    printers: Printer[];
    currentModelId: string | null;
    currentGCodeUrl: string | null;
    setCurrentGCodeUrl: (url: string | null) => void;
    currentGlbUrl: string | null;
    generatedModels: AIGeneratedModel[];
}

export function usePrintJob({
    user,
    printers,
    currentModelId,
    currentGCodeUrl,
    setCurrentGCodeUrl,
    currentGlbUrl,
    generatedModels
}: UsePrintJobProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const navigate = useNavigate();

    // UI States
    const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
    const [printerConfirmDialogOpen, setPrinterConfirmDialogOpen] = useState<boolean>(false);
    const [printerToConfirm, setPrinterToConfirm] = useState<Printer | null>(null);
    const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
    const [printFileName, setPrintFileName] = useState<string>('');
    const [settingsTab, setSettingsTab] = useState<'printer' | 'file'>('printer');
    const [isSlicing, setIsSlicing] = useState<boolean>(false);
    const [gcodeInfo, setGcodeInfo] = useState<GCodeInfo | null>(null);
    const [targetPrinterModelId, setTargetPrinterModelId] = useState<string | null>(null);

    // Reslice States
    const [resliceManufacturer, setResliceManufacturer] = useState<string>('');
    const [resliceSeries, setResliceSeries] = useState<string>('');
    const [resliceModelId, setResliceModelId] = useState<string>('');
    const [manufacturers, setManufacturers] = useState<string[]>([]);
    const [seriesList, setSeriesList] = useState<string[]>([]);
    const [modelsList, setModelsList] = useState<Array<{ id: string; display_name: string }>>([]);
    const isLoadingDefaultPrinter = useRef<boolean>(false);

    // Print Settings State
    const [printSettings, setPrintSettings] = useState<PrintSettings>({
        support_enable: true,
        support_angle: 50,
        layer_height: 0.2,
        line_width: 0.4,
        speed_print: 50,
        material_diameter: 1.75,
        material_flow: 100,
        infill_sparse_density: 15,
        wall_line_count: 2,
        top_layers: 4,
        bottom_layers: 4,
        adhesion_type: 'none' as 'none' | 'skirt' | 'brim' | 'raft',
    });

    // Load Manufacturers
    const loadManufacturers = useCallback(async () => {
        try {
            const data = await getManufacturers();
            setManufacturers(data.map(m => m.manufacturer));
        } catch (error) {
            console.error('[AI] Failed to load manufacturers:', error);
        }
    }, []);

    // Load Series
    const loadSeriesByManufacturer = useCallback(async (manufacturer: string) => {
        try {
            const data = await getSeriesByManufacturer(manufacturer);
            setSeriesList(data.map(s => s.series));
        } catch (error) {
            console.error('[AI] Failed to load series:', error);
        }
    }, []);

    // Load Models
    const loadModelsByManufacturerAndSeries = useCallback(async (manufacturer: string, series: string) => {
        try {
            const data = await getModelsByManufacturerAndSeries(manufacturer, series);
            setModelsList(data);
        } catch (error) {
            console.error('[AI] Failed to load models:', error);
        }
    }, []);

    // Load Default Printer Settings
    const loadDefaultPrinterSettings = useCallback(async () => {
        if (!selectedPrinter) {
            return;
        }

        const printerExt = selectedPrinter as Printer & { manufacture_id?: string };
        if (printerExt.manufacture_id) {
            isLoadingDefaultPrinter.current = true;
            try {
                const { data: manufacturingPrinter, error } = await supabase
                    .from('manufacturing_printers')
                    .select('id, manufacturer, series, model, display_name')
                    .eq('id', printerExt.manufacture_id)
                    .single();

                if (error) {
                    console.error('[AI] Error loading manufacturing printer:', error);
                    isLoadingDefaultPrinter.current = false;
                    return;
                }

                if (manufacturingPrinter) {
                    setResliceManufacturer(manufacturingPrinter.manufacturer);
                    const seriesData = await getSeriesByManufacturer(manufacturingPrinter.manufacturer);
                    setSeriesList(seriesData.map(s => s.series));
                    setResliceSeries(manufacturingPrinter.series);
                    const modelsData = await getModelsByManufacturerAndSeries(
                        manufacturingPrinter.manufacturer,
                        manufacturingPrinter.series
                    );
                    setModelsList(modelsData);
                    setResliceModelId(manufacturingPrinter.id);
                }
            } catch (error) {
                console.error('[AI] Error in loadDefaultPrinterSettings:', error);
            } finally {
                isLoadingDefaultPrinter.current = false;
            }
        }
    }, [selectedPrinter]);

    // Effects for loading lists
    useEffect(() => {
        if (printDialogOpen) {
            loadManufacturers();
            loadDefaultPrinterSettings();
        } else {
            setResliceManufacturer('');
            setResliceSeries('');
            setResliceModelId('');
            setSeriesList([]);
            setModelsList([]);
        }
    }, [printDialogOpen, selectedPrinter, loadManufacturers, loadDefaultPrinterSettings]);

    useEffect(() => {
        if (isLoadingDefaultPrinter.current) return;
        if (resliceManufacturer) {
            loadSeriesByManufacturer(resliceManufacturer);
        } else {
            setSeriesList([]);
            setResliceSeries('');
            setModelsList([]);
            setResliceModelId('');
        }
    }, [resliceManufacturer, loadSeriesByManufacturer]);

    useEffect(() => {
        if (isLoadingDefaultPrinter.current) return;
        if (resliceManufacturer && resliceSeries) {
            loadModelsByManufacturerAndSeries(resliceManufacturer, resliceSeries);
        } else {
            setModelsList([]);
            setResliceModelId('');
        }
    }, [resliceManufacturer, resliceSeries, loadModelsByManufacturerAndSeries]);

    const openPrinterSettings = (printer: Printer) => {
        setPrinterToConfirm(printer);
        setPrinterConfirmDialogOpen(true);
    };

    const confirmPrinterSelection = async () => {
        const modelUrl = currentGlbUrl;
        if (!printerToConfirm || !modelUrl || !user?.id) {
            toast({
                title: '오류',
                description: '3D 모델 파일이나 프린터 정보가 없습니다.',
                variant: 'destructive',
            });
            setPrinterConfirmDialogOpen(false);
            return;
        }

        try {
            setPrinterConfirmDialogOpen(false);
            setSelectedPrinter(printerToConfirm);
            setIsSlicing(true);
            setPrintDialogOpen(true);

            // Fetch model file to verify or prep
            const modelResponse = await fetch(modelUrl);
            if (!modelResponse.ok) throw new Error('모델 파일 다운로드 실패');

            /*
             * Logic for checking Cache or starting Slicing Task
             * Reusing logic from AI.tsx
             */
            const curaSettings: SlicingSettings = {
                layer_height: printSettings.layer_height.toString(),
                line_width: printSettings.line_width.toString(),
                infill_sparse_density: printSettings.infill_sparse_density.toString(),
                wall_line_count: printSettings.wall_line_count.toString(),
                top_layers: printSettings.top_layers.toString(),
                bottom_layers: printSettings.bottom_layers.toString(),
                speed_print: printSettings.speed_print.toString(),
                support_enable: printSettings.support_enable.toString(),
                support_angle: printSettings.support_angle.toString(),
                adhesion_type: printSettings.adhesion_type,
                material_diameter: printSettings.material_diameter.toString(),
                material_flow: printSettings.material_flow.toString(),
            };

            let printerFilename = printerToConfirm.model || printerToConfirm.name;
            let printerInfoForGCode: any = {};

            if (printerToConfirm.manufacture_id) {
                const { data: manufacturingPrinter } = await supabase
                    .from('manufacturing_printers')
                    .select('filename, build_volume, manufacturer, series, display_name')
                    .eq('id', printerToConfirm.manufacture_id)
                    .single();

                if (manufacturingPrinter) {
                    printerFilename = manufacturingPrinter.filename.replace('.def.json', '');
                    printerInfoForGCode = {
                        manufacturer: manufacturingPrinter.manufacturer,
                        series: manufacturingPrinter.series,
                        model: manufacturingPrinter.display_name,
                        printer_name: printerToConfirm.name
                    };
                }
            }

            const printerDefinition: PrinterDefinition = {
                version: 2,
                overrides: {
                    machine_width: { default_value: 220 },
                    machine_depth: { default_value: 220 },
                    machine_height: { default_value: 250 },
                    machine_extruder_count: { default_value: 1 },
                    mesh_rotation_matrix: { default_value: "[[1,0,0], [0,1,0], [0,0,1]]" },
                },
            };

            // Check Cache
            if (currentModelId && printerToConfirm.manufacture_id) {
                const { data: existingGcode, error: gcodeError } = await supabase
                    .from('gcode_files')
                    .select('*')
                    .eq('model_id', currentModelId)
                    .single();

                if (existingGcode && !gcodeError) {
                    const { data: urlData, error: urlError } = await supabase.storage
                        .from('gcode-files')
                        .createSignedUrl(existingGcode.file_path, 86400);

                    if (urlError) throw urlError;

                    setGcodeInfo({
                        printTime: existingGcode.print_time_formatted,
                        filamentLength: existingGcode.filament_used_m ? `${existingGcode.filament_used_m.toFixed(2)}m` : undefined,
                        filamentWeight: existingGcode.filament_weight_g ? `${existingGcode.filament_weight_g.toFixed(1)}g` : undefined,
                        filamentCost: existingGcode.filament_cost ? `$${existingGcode.filament_cost.toFixed(2)}` : undefined,
                        layerCount: existingGcode.layer_count,
                        layerHeight: existingGcode.layer_height,
                        modelSize: existingGcode.bounding_box ? {
                            minX: existingGcode.bounding_box.min_x,
                            maxX: existingGcode.bounding_box.max_x,
                            minY: existingGcode.bounding_box.min_y,
                            maxY: existingGcode.bounding_box.max_y,
                            minZ: existingGcode.bounding_box.min_z,
                            maxZ: existingGcode.bounding_box.max_z,
                        } : undefined,
                        nozzleTemp: existingGcode.nozzle_temp,
                        bedTemp: existingGcode.bed_temp,
                        printerName: existingGcode.printer_name,
                    });

                    setCurrentGCodeUrl(urlData.signedUrl);
                    setIsSlicing(false);
                    return;
                }
            }

            // Create Task
            const currentModel = generatedModels.find(m => m.id === currentModelId);
            const modelName = currentModel?.model_name || currentModel?.prompt || currentModelId;
            const modelPrompt = currentModel?.prompt;

            const taskId = await createSlicingTask(
                supabase,
                currentModelId!, // Assert non-null if checked above (checked currentModelId valid in cache step, but here strictly speaking it could be null if not checked properly? But confirmPrinterSelection checks currentGlbUrl. currentModelId might be null if manually uploaded?)
                printerToConfirm.id,
                printerToConfirm.manufacture_id,
                modelUrl,
                {
                    curaSettings,
                    printerDefinition,
                    printerName: printerFilename,
                    modelName,
                    printerInfo: printerInfoForGCode,
                    prompt: modelPrompt,
                }
            );

            toast({ title: t('ai.slicingBackgroundStart'), description: t('ai.slicingBackgroundDescription') });

            processSlicingTask(supabase, {
                id: taskId,
                user_id: user.id,
                task_type: 'slicing',
                status: 'pending',
                model_id: currentModelId,
                printer_id: printerToConfirm.id,
                printer_model_id: printerToConfirm.manufacture_id,
                input_url: modelUrl,
                input_params: {
                    curaSettings,
                    printerDefinition,
                    printerName: printerFilename,
                    modelName,
                    printerInfo: printerInfoForGCode,
                    prompt: modelPrompt,
                },
                output_url: null,
                output_metadata: null,
                error_message: null,
                retry_count: 0,
                max_retries: 3,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                started_at: null,
                completed_at: null,
            }).catch(e => console.error(e));

        } catch (error: any) {
            console.error(error);
            setIsSlicing(false);
            toast({ title: '슬라이싱 실패', description: error.message, variant: 'destructive' });
        }
    };

    const handleReslice = async () => {
        const currentModel = currentModelId ? generatedModels.find(m => m.id === currentModelId) : null;
        if (!resliceModelId || !selectedPrinter || !currentModel || !currentGlbUrl) {
            toast({ title: t('ai.resliceFailed'), description: t('ai.resliceFailedDesc'), variant: 'destructive' });
            return;
        }

        try {
            setIsSlicing(true);
            toast({ title: t('ai.resliceStart'), description: t('ai.resliceStartDesc') });

            const manufacturingPrinter = await getManufacturingPrinterById(resliceModelId);
            if (!manufacturingPrinter) throw new Error('선택한 프린터 정보를 찾을 수 없습니다.');

            const printerFilename = manufacturingPrinter.filename.replace('.def.json', '');
            const buildVolume = manufacturingPrinter.build_volume || { x: 220, y: 220, z: 250 };
            const printerInfoForGCode = {
                manufacturer: manufacturingPrinter.manufacturer,
                series: manufacturingPrinter.series,
                model: manufacturingPrinter.display_name
            };

            const printerDefinition: PrinterDefinition = {
                version: 2,
                overrides: {
                    machine_width: { default_value: buildVolume.x },
                    machine_depth: { default_value: buildVolume.y },
                    machine_height: { default_value: buildVolume.z },
                },
            };

            const curaSettings: SlicingSettings = {
                layer_height: printSettings.layer_height.toString(),
                line_width: printSettings.line_width.toString(),
                infill_sparse_density: printSettings.infill_sparse_density.toString(),
                wall_line_count: printSettings.wall_line_count.toString(),
                top_layers: printSettings.top_layers.toString(),
                bottom_layers: printSettings.bottom_layers.toString(),
                speed_print: printSettings.speed_print.toString(),
                support_enable: printSettings.support_enable.toString(),
                support_angle: printSettings.support_angle.toString(),
                adhesion_type: printSettings.adhesion_type,
                material_diameter: printSettings.material_diameter.toString(),
                material_flow: printSettings.material_flow.toString(),
            };

            const response = await fetch(currentGlbUrl);
            if (!response.ok) throw new Error(`모델 다운로드 실패`);
            const modelBlob = await response.blob();
            const fileExtension = currentGlbUrl.endsWith('.stl') ? 'stl' : 'glb';
            const fileName = currentModel.model_name ? `${currentModel.model_name}.${fileExtension}` : `model.${fileExtension}`;

            const slicingResult = await uploadSTLAndSlice(modelBlob, fileName, curaSettings, printerDefinition, printerFilename);

            if (slicingResult.status === 'error' || !slicingResult.data) throw new Error(slicingResult.error || '슬라이싱 실패');

            const gcodeUrl = slicingResult.data.gcode_url;
            let uploadedGcodeUrl = gcodeUrl;

            if (gcodeUrl && user?.id) {
                const modelName = currentModel.model_name || currentModel.prompt || currentModel.id;
                const uploaded = await downloadAndUploadGCode(
                    supabase, user.id, currentModel.id, gcodeUrl, resliceModelId, modelName, printerInfoForGCode, slicingResult.data.gcode_metadata
                );
                if (uploaded) {
                    uploadedGcodeUrl = uploaded.publicUrl;
                    if (uploaded.metadata) {
                        setGcodeInfo({
                            printTime: uploaded.metadata.print_time_formatted,
                            filamentLength: uploaded.metadata.filament_used_m ? `${uploaded.metadata.filament_used_m.toFixed(2)}m` : undefined,
                            filamentWeight: uploaded.metadata.filament_weight_g ? `${uploaded.metadata.filament_weight_g.toFixed(1)}g` : undefined,
                            filamentCost: uploaded.metadata.filament_cost ? `$${uploaded.metadata.filament_cost.toFixed(2)}` : undefined,
                            layerCount: uploaded.metadata.layer_count,
                            layerHeight: uploaded.metadata.layer_height,
                            modelSize: uploaded.metadata.bounding_box ? {
                                minX: uploaded.metadata.bounding_box.min_x,
                                maxX: uploaded.metadata.bounding_box.max_x,
                                minY: uploaded.metadata.bounding_box.min_y,
                                maxY: uploaded.metadata.bounding_box.max_y,
                                minZ: uploaded.metadata.bounding_box.min_z,
                                maxZ: uploaded.metadata.bounding_box.max_z,
                            } : undefined,
                            nozzleTemp: uploaded.metadata.nozzle_temp,
                            bedTemp: uploaded.metadata.bed_temp,
                            printerName: uploaded.metadata.printer_name,
                        });
                    }
                }
            }

            if (user?.id && uploadedGcodeUrl) {
                await updateAIModel(supabase, currentModel.id, { gcode_url: uploadedGcodeUrl });
            }

            const gcodeUrlWithTimestamp = uploadedGcodeUrl ? `${uploadedGcodeUrl}${uploadedGcodeUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : null;
            setCurrentGCodeUrl(gcodeUrlWithTimestamp);
            toast({ title: t('ai.resliceComplete'), description: t('ai.resliceCompleteDesc') });

        } catch (error: any) {
            console.error(error);
            toast({ title: t('ai.resliceFailed'), description: error.message, variant: 'destructive' });
        } finally {
            setIsSlicing(false);
        }
    };

    const startPrint = async () => {
        if (!currentGCodeUrl || !selectedPrinter || !printFileName.trim()) {
            toast({ title: t('errors.general'), description: t('ai.missingFileOrPrinter'), variant: 'destructive' });
            return;
        }
        if (!selectedPrinter.device_uuid) {
            toast({ title: t('errors.general'), description: t('ai.printerUuidMissing'), variant: 'destructive' });
            return;
        }

        try {
            const sanitizedInput = printFileName.trim().replace(/[^a-zA-Z0-9가-힣\-_]/g, '_').replace(/^_|_$/g, '');
            let fileName = sanitizedInput.length > 0
                ? (sanitizedInput.endsWith('.gcode') ? sanitizedInput : `${sanitizedInput}.gcode`)
                : `print_${Date.now()}.gcode`;

            toast({ title: t('ai.downloadingGCode'), description: t('ai.preparingPrint') });

            const gcodeResponse = await fetch(currentGCodeUrl);
            if (!gcodeResponse.ok) throw new Error(t('ai.gcodeDownloadFailed'));
            const gcodeBlob = await gcodeResponse.blob();

            await mqttConnect();

            const uploadId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
            const arrayBuf = await gcodeBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            const total = bytes.length;
            const chunkSize = 32 * 1024;

            const toB64 = (chunk: Uint8Array) => {
                let binary = '';
                for (let i = 0; i < chunk.length; i += 1) binary += String.fromCharCode(chunk[i]);
                return btoa(binary);
            };

            await publishSdUploadChunkFirst(selectedPrinter.device_uuid, {
                type: 'sd_upload_chunk',
                upload_id: uploadId,
                index: 0,
                name: fileName,
                total_size: total,
                data_b64: toB64(bytes.subarray(0, Math.min(chunkSize, total))),
                size: Math.min(chunkSize, total),
                upload_traget: 'local',
            });

            let sent = Math.min(chunkSize, total);
            let index = 1;
            while (sent < total) {
                const next = Math.min(sent + chunkSize, total);
                await publishSdUploadChunk(selectedPrinter.device_uuid, {
                    type: 'sd_upload_chunk', upload_id: uploadId, index,
                    data_b64: toB64(bytes.subarray(sent, next)),
                    size: next - sent,
                });
                sent = next;
                index += 1;
            }

            await publishSdUploadCommit(selectedPrinter.device_uuid, uploadId, 'local');

            try {
                const uploadResult = await waitForGCodeUploadResult(selectedPrinter.device_uuid, uploadId, 60000);
                if (uploadResult.success) {
                    toast({ title: t('gcode.uploadSuccess'), description: `${uploadResult.filename} -> Local` });
                } else {
                    toast({ title: t('gcode.uploadFailed'), description: uploadResult.error, variant: 'destructive' });
                    return;
                }
            } catch (timeoutError) {
                console.warn(timeoutError);
                toast({ title: t('gcode.uploadSuccess'), description: t('ai.fileUploadedToPrinter', { fileName }) });
            }

            setPrintDialogOpen(false);
            if (window.confirm(`${selectedPrinter.name} 대시보드로 이동하시겠습니까?`)) {
                navigate(`/printer/${selectedPrinter.id}`);
            }

        } catch (error: any) {
            console.error(error);
            toast({ title: t('ai.printStartFailed'), description: error.message, variant: 'destructive' });
        }
    };

    return {
        isSlicing,
        setIsSlicing,
        gcodeInfo,
        setGcodeInfo,
        printSettings,
        setPrintSettings,
        printDialogOpen,
        setPrintDialogOpen,
        printerConfirmDialogOpen,
        setPrinterConfirmDialogOpen,
        printerToConfirm,
        setPrinterToConfirm,
        selectedPrinter,
        setSelectedPrinter,
        printFileName,
        setPrintFileName,
        settingsTab,
        setSettingsTab,
        targetPrinterModelId,
        setTargetPrinterModelId,

        resliceManufacturer,
        setResliceManufacturer,
        resliceSeries,
        setResliceSeries,
        resliceModelId,
        setResliceModelId,
        manufacturers,
        seriesList,
        modelsList,
        isLoadingDefaultPrinter,

        loadDefaultPrinterSettings,
        openPrinterSettings,
        confirmPrinterSelection,
        handleReslice,
        startPrint
    };
}
