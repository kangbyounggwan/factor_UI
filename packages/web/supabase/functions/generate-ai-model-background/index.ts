// Supabase Edge Function for background AI model generation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Supabase configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// AI Python Server configuration
const AI_PYTHON_URL = Deno.env.get("AI_PYTHON_URL") || "http://127.0.0.1:7000";

interface GenerateModelRequest {
  modelId: string;
  userId: string;
  generationType: "text" | "image";
  payload: any; // FormData for image, JSON for text
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { modelId, userId, generationType, payload } = await req.json();

    // Validate required fields
    if (!modelId || !userId || !generationType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`[Background AI] Starting generation for model ${modelId}`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update model status to processing
    await supabase
      .from("ai_generated_models")
      .update({ status: "processing", progress: 0 })
      .eq("id", modelId);

    // Call AI Python server with async_mode=true
    const endpoint = `${AI_PYTHON_URL}/v1/process/modelling?async_mode=true`;

    let aiResponse;

    if (generationType === "image") {
      // For image generation, we need to handle FormData
      // Since we can't pass FormData through JSON, this should be called directly from client
      throw new Error("Image generation should be called directly from client with async_mode=true");
    } else {
      // Text to 3D
      aiResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI server error: ${aiResponse.status} ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const taskId = aiResult.data?.task_id || aiResult.task_id;

    if (!taskId) {
      throw new Error("No task_id returned from AI server");
    }

    console.log(`[Background AI] Task started: ${taskId}`);

    // Store task_id in model metadata
    await supabase
      .from("ai_generated_models")
      .update({
        metadata: { task_id: taskId },
        progress: 5
      })
      .eq("id", modelId);

    // Start polling in background (don't wait for completion)
    pollTaskAndUpdateModel(modelId, taskId, userId).catch((error) => {
      console.error(`[Background AI] Polling error for model ${modelId}:`, error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        modelId,
        taskId,
        message: "AI model generation started in background",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[Background AI] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Poll AI task progress and update model in database
 */
async function pollTaskAndUpdateModel(
  modelId: string,
  taskId: string,
  userId: string
): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const endpoint = `${AI_PYTHON_URL}/v1/process/modelling/${taskId}`;
  const maxAttempts = 360; // 30 minutes (5s interval)
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      // Fetch progress from AI server
      const response = await fetch(endpoint, { method: "GET" });

      if (!response.ok) {
        throw new Error(`Progress check failed: ${response.status}`);
      }

      const progressData = await response.json();
      const status = progressData.data?.status;
      const progress = progressData.data?.progress || 0;

      console.log(`[Background AI] Model ${modelId} - Status: ${status}, Progress: ${progress}%`);

      // Update progress in database
      await supabase
        .from("ai_generated_models")
        .update({ progress: Math.min(progress, 95) })
        .eq("id", modelId);

      // Check if completed
      if (status === "SUCCEEDED") {
        console.log(`[Background AI] Model ${modelId} completed successfully`);

        // Extract URLs
        const glbUrl = progressData.data?.glb_download_url || progressData.data?.download_url;
        const stlUrl = progressData.data?.stl_download_url;
        const thumbnailUrl = progressData.data?.thumbnail_download_url || progressData.data?.thumbnail_url;

        // Make URLs absolute if they're relative
        const makeAbsoluteUrl = (url: string | null) => {
          if (!url) return null;
          return url.startsWith('/') ? `${AI_PYTHON_URL}${url}` : url;
        };

        // Download GLB file and upload to Supabase Storage
        let storagePath = "";
        if (glbUrl) {
          const absoluteGlbUrl = makeAbsoluteUrl(glbUrl);
          const glbResponse = await fetch(absoluteGlbUrl);
          const glbBlob = await glbResponse.blob();

          const fileName = `${modelId}.glb`;
          const filePath = `${userId}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("ai-models")
            .upload(filePath, glbBlob, {
              contentType: "model/gltf-binary",
              upsert: true,
            });

          if (uploadError) {
            console.error("[Background AI] Storage upload error:", uploadError);
          } else {
            storagePath = uploadData.path;
          }
        }

        // Update model with completed data
        await supabase
          .from("ai_generated_models")
          .update({
            status: "completed",
            progress: 100,
            storage_path: storagePath,
            file_url: glbUrl ? makeAbsoluteUrl(glbUrl) : null,
            stl_url: stlUrl ? makeAbsoluteUrl(stlUrl) : null,
            thumbnail_url: thumbnailUrl ? makeAbsoluteUrl(thumbnailUrl) : null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", modelId);

        // Send push notification
        await sendCompletionNotification(modelId, userId);

        return; // Success - exit polling
      }

      // Check if failed
      if (status === "FAILED") {
        console.error(`[Background AI] Model ${modelId} failed`);
        const errorMsg = progressData.error || progressData.message || "Unknown error";

        await supabase
          .from("ai_generated_models")
          .update({
            status: "failed",
            error_message: errorMsg,
          })
          .eq("id", modelId);

        return; // Failed - exit polling
      }

      // Wait 5 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`[Background AI] Polling error (attempt ${attempt}):`, error);

      // If too many consecutive errors, mark as failed
      if (attempt > 10) {
        await supabase
          .from("ai_generated_models")
          .update({
            status: "failed",
            error_message: `Polling failed: ${error.message}`,
          })
          .eq("id", modelId);
        return;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Timeout - mark as failed
  console.error(`[Background AI] Model ${modelId} timed out`);
  await supabase
    .from("ai_generated_models")
    .update({
      status: "failed",
      error_message: "Generation timeout (30 minutes exceeded)",
    })
    .eq("id", modelId);
}

/**
 * Send push notification when model generation completes
 */
async function sendCompletionNotification(modelId: string, userId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get model name
    const { data: model } = await supabase
      .from("ai_generated_models")
      .select("model_name")
      .eq("id", modelId)
      .single();

    const modelName = model?.model_name || "AI 모델";

    // Create notification in database
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "AI 모델 생성 완료",
      message: `'${modelName}' 모델이 성공적으로 생성되었습니다.`,
      message_en: `'${modelName}' model has been successfully created.`,
      type: "ai_model_complete",
      related_id: modelId,
      related_type: "ai_model",
    });

    // Send push notification via Edge Function
    await supabase.functions.invoke("send-push-notification", {
      body: {
        userId,
        title: "AI 모델 생성 완료",
        body: `'${modelName}' 모델이 성공적으로 생성되었습니다.`,
        data: {
          type: "ai_model_complete",
          related_id: modelId,
          related_type: "ai_model",
        },
        priority: "high",
      },
    });

    console.log(`[Background AI] Notification sent for model ${modelId}`);
  } catch (error) {
    console.error("[Background AI] Notification error:", error);
    // Don't throw - notification failure shouldn't fail the whole process
  }
}
