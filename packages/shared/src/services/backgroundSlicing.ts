import { SupabaseClient } from '@supabase/supabase-js';
import { uploadSTLAndSlice, SlicingSettings, PrinterDefinition } from './aiService';
import { downloadAndUploadGCode } from './supabaseService/aiStorage';

export interface BackgroundTask {
  id: string;
  user_id: string;
  task_type: 'slicing' | 'model_generation';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model_id: string | null;
  printer_id: string | null;
  printer_model_id: string | null;
  input_url: string | null;
  input_params: any;
  output_url: string | null;
  output_metadata: any;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

/**
 * Creates a background slicing task
 */
export async function createSlicingTask(
  supabase: SupabaseClient,
  modelId: string,
  printerId: string,
  printerModelId: string,
  modelUrl: string,
  params: {
    curaSettings?: SlicingSettings;
    printerDefinition?: PrinterDefinition;
    printerName?: string;
    modelName?: string;
    printerInfo?: any;
    prompt?: string;  // 사용자의 원본 프롬프트 (Claude로 파일명 생성용)
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_slicing_task', {
    p_model_id: modelId,
    p_printer_id: printerId,
    p_printer_model_id: printerModelId,
    p_input_url: modelUrl,
    p_input_params: params,
  });

  if (error) {
    console.error('[backgroundSlicing] Failed to create task:', error);
    throw error;
  }

  console.log('[backgroundSlicing] Created task:', data);
  return data;
}

/**
 * Updates task status
 */
export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  outputUrl?: string,
  outputMetadata?: any,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase.rpc('update_task_status', {
    p_task_id: taskId,
    p_status: status,
    p_output_url: outputUrl,
    p_output_metadata: outputMetadata,
    p_error_message: errorMessage,
  });

  if (error) {
    console.error('[backgroundSlicing] Failed to update task status:', error);
    throw error;
  }
}

/**
 * Processes a single slicing task
 */
export async function processSlicingTask(
  supabase: SupabaseClient,
  task: BackgroundTask
): Promise<void> {
  console.log('[backgroundSlicing] Processing task:', task.id);

  try {
    // Update status to processing
    await updateTaskStatus(supabase, task.id, 'processing');

    // Download model file
    const modelUrl = task.input_url!;
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.status}`);
    }

    const modelBlob = await response.blob();
    const fileExtension = modelUrl.endsWith('.stl') ? 'stl' : 'glb';
    const fileName = `model_${Date.now()}.${fileExtension}`;

    // Get slicing parameters
    const params = task.input_params || {};
    const { curaSettings, printerDefinition, printerName, prompt } = params;

    console.log('[backgroundSlicing] Starting slicing...');
    console.log('[backgroundSlicing] - File:', fileName);
    console.log('[backgroundSlicing] - Size:', modelBlob.size, 'bytes');

    // Perform slicing
    const slicingResult = await uploadSTLAndSlice(
      modelBlob,
      fileName,
      curaSettings,
      printerDefinition,
      printerName
    );

    if (slicingResult.status === 'error' || !slicingResult.data) {
      throw new Error(slicingResult.error || 'Slicing failed');
    }

    console.log('[backgroundSlicing] Slicing completed');
    console.log('[backgroundSlicing] GCode URL:', slicingResult.data.gcode_url);

    // 모델의 model_name 조회 (이미 생성되어 있으면 사용)
    let modelShortName: string | undefined;
    if (task.model_id) {
      const { data: modelData } = await supabase
        .from('ai_generated_models')
        .select('model_name, source_image_url')
        .eq('id', task.model_id)
        .single();

      if (modelData?.model_name) {
        modelShortName = modelData.model_name;
        console.log('[backgroundSlicing] Using model_name:', modelShortName);
      }
    }

    // Upload GCode to Supabase Storage
    const gcodeUrl = slicingResult.data.gcode_url;
    const gcodeUploadResult = await downloadAndUploadGCode(
      supabase,
      task.user_id,
      task.model_id!,
      gcodeUrl,
      task.printer_model_id!,
      params.modelName || task.model_id,
      params.printerInfo,
      slicingResult.data.gcode_metadata,
      prompt,           // Claude로 파일명 생성용 프롬프트 전달
      undefined,        // imageUrl (모델 조회로 대체)
      modelShortName    // 모델의 short_name (있으면 우선 사용)
    );

    if (!gcodeUploadResult) {
      throw new Error('Failed to upload GCode to storage');
    }

    console.log('[backgroundSlicing] GCode uploaded to storage:', gcodeUploadResult.publicUrl);

    // Update AI model with GCode URL
    const { error: updateError } = await supabase
      .from('ai_generated_models')
      .update({ gcode_url: gcodeUploadResult.publicUrl })
      .eq('id', task.model_id);

    if (updateError) {
      console.error('[backgroundSlicing] Failed to update ai_generated_models:', updateError);
    }

    // Send push notification (DB 저장 + FCM 푸시 전송)
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: task.user_id,
          title: '슬라이싱 완료',
          body: '모델 슬라이싱이 완료되었습니다. GCode 파일이 준비되었습니다.',
          type: 'slicing_complete',
          relatedId: task.model_id,
          relatedType: 'ai_model',
          data: {
            task_id: task.id,
            model_id: task.model_id,
            gcode_url: gcodeUploadResult.publicUrl,
            printer_model_id: task.printer_model_id || '',
          },
          priority: 'high',
          messageEn: 'Model slicing completed. GCode file is ready.',
        },
      });
      console.log('[backgroundSlicing] Push notification sent');
    } catch (pushError) {
      console.error('[backgroundSlicing] Failed to send push notification:', pushError);
      // 푸시 실패해도 DB에는 알림 저장 (fallback)
      await supabase.from('notifications').insert({
        user_id: task.user_id,
        title: '슬라이싱 완료',
        message: '모델 슬라이싱이 완료되었습니다. GCode 파일이 준비되었습니다.',
        message_en: 'Model slicing completed. GCode file is ready.',
        type: 'slicing_complete',
        related_id: task.model_id,
        related_type: 'ai_model',
        metadata: {
          task_id: task.id,
          model_id: task.model_id,
          gcode_url: gcodeUploadResult.publicUrl,
          printer_model_id: task.printer_model_id,
        },
      });
    }

    // Update task status to completed
    await updateTaskStatus(
      supabase,
      task.id,
      'completed',
      gcodeUploadResult.publicUrl,
      slicingResult.data.gcode_metadata
    );

    console.log('[backgroundSlicing] Task completed successfully');
  } catch (error) {
    console.error('[backgroundSlicing] Task failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Send error push notification (DB 저장 + FCM 푸시 전송)
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: task.user_id,
          title: '슬라이싱 실패',
          body: `모델 슬라이싱 중 오류가 발생했습니다: ${errorMessage}`,
          type: 'slicing_failed',
          relatedId: task.model_id,
          relatedType: 'ai_model',
          data: {
            task_id: task.id,
            model_id: task.model_id || '',
            error: errorMessage,
          },
          priority: 'high',
          messageEn: `Model slicing failed: ${errorMessage}`,
        },
      });
    } catch (pushError) {
      console.error('[backgroundSlicing] Failed to send error push notification:', pushError);
      // 푸시 실패해도 DB에는 알림 저장 (fallback)
      await supabase.from('notifications').insert({
        user_id: task.user_id,
        title: '슬라이싱 실패',
        message: `모델 슬라이싱 중 오류가 발생했습니다: ${errorMessage}`,
        message_en: `Model slicing failed: ${errorMessage}`,
        type: 'slicing_failed',
        related_id: task.model_id,
        related_type: 'ai_model',
        metadata: {
          task_id: task.id,
          model_id: task.model_id,
          error: errorMessage,
        },
      });
    }

    // Update task status to failed
    await updateTaskStatus(supabase, task.id, 'failed', undefined, undefined, errorMessage);

    throw error;
  }
}

/**
 * Gets user's background tasks
 */
export async function getUserTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<BackgroundTask[]> {
  const { data, error } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[backgroundSlicing] Failed to get user tasks:', error);
    throw error;
  }

  return data || [];
}

/**
 * Subscribes to task status changes
 */
export function subscribeToTaskUpdates(
  supabase: SupabaseClient,
  userId: string,
  callback: (task: BackgroundTask) => void
) {
  const subscription = supabase
    .channel('background_tasks_updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'background_tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('[backgroundSlicing] Task updated:', payload.new);
        callback(payload.new as BackgroundTask);
      }
    )
    .subscribe();

  return subscription;
}
