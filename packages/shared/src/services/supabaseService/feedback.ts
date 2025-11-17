import { supabase } from "../../integrations/supabase/client";

export interface FeedbackData {
  type: "issue" | "idea";
  title: string;
  description: string;
  printerId?: string;
  imageFiles?: File[];
}

export interface FeedbackRecord {
  id: string;
  user_id: string;
  type: "issue" | "idea";
  title: string;
  description: string;
  printer_id?: string;
  image_urls?: string[];
  status: "pending" | "reviewed" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
}

/**
 * Upload feedback images to Supabase Storage
 */
async function uploadFeedbackImages(
  userId: string,
  files: File[]
): Promise<string[]> {
  const uploadPromises = files.map(async (file, index) => {
    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}_${index}_${file.name}`;

    const { data, error } = await supabase.storage
      .from("feedback-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload image:", error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  });

  return await Promise.all(uploadPromises);
}

/**
 * Submit feedback to database and send email
 */
export async function submitFeedback(
  feedbackData: FeedbackData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    const userName = profile?.name || user.email?.split("@")[0] || "Unknown User";

    // Upload images if any
    let imageUrls: string[] = [];
    if (feedbackData.imageFiles && feedbackData.imageFiles.length > 0) {
      imageUrls = await uploadFeedbackImages(user.id, feedbackData.imageFiles);
    }

    // Get printer info if printerId is provided
    let printerName: string | undefined;
    let printerModel: string | undefined;
    if (feedbackData.printerId) {
      const { data: printer } = await supabase
        .from("printers")
        .select("name, model")
        .eq("id", feedbackData.printerId)
        .single();

      if (printer) {
        printerName = printer.name || undefined;
        printerModel = printer.model || undefined;
      }
    }

    // Insert feedback to database
    const { data: feedbackRecord, error: insertError } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        type: feedbackData.type,
        title: feedbackData.title,
        description: feedbackData.description,
        printer_id: feedbackData.printerId || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert feedback:", insertError);
      throw insertError;
    }

    // Call Edge Function to send email
    const { data: emailData, error: emailError } = await supabase.functions.invoke(
      "send-feedback-email",
      {
        body: {
          type: feedbackData.type,
          title: feedbackData.title,
          description: feedbackData.description,
          userEmail: user.email,
          userName: userName,
          printerName,
          printerModel,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        },
      }
    );

    if (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't throw - feedback is saved even if email fails
    }

    console.log("Feedback submitted successfully:", {
      feedbackId: feedbackRecord.id,
      emailSent: !emailError,
    });

    return { success: true };
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's feedback history
 */
export async function getUserFeedback(): Promise<FeedbackRecord[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch feedback:", error);
    throw error;
  }

  return data as FeedbackRecord[];
}
