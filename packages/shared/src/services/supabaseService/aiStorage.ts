import { SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'ai-models';

/**
 * 원본 이미지를 Supabase Storage에 업로드
 */
export async function uploadSourceImage(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string; url: string; publicUrl: string }> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/source-images/${timestamp}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Public URL 생성
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    path: path,
    url: urlData.publicUrl,
    publicUrl: urlData.publicUrl
  };
}

/**
 * 생성된 3D 모델을 Supabase Storage에 저장
 */
export async function uploadGeneratedModel(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  glbBlob: Blob
): Promise<{ path: string; url: string; publicUrl: string }> {
  const path = `${userId}/generated-models/${modelId}.glb`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, glbBlob, {
      contentType: 'model/gltf-binary',
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    path: path,
    url: urlData.publicUrl,
    publicUrl: urlData.publicUrl
  };
}

/**
 * URL에서 GLB 파일을 다운로드하여 Supabase Storage에 저장
 */
export async function downloadAndUploadModel(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  glbUrl: string
): Promise<{ path: string; url: string; publicUrl: string }> {
  console.log('[aiStorage] Downloading GLB from:', glbUrl);

  // GLB 파일 다운로드
  const response = await fetch(glbUrl);
  if (!response.ok) {
    throw new Error(`Failed to download GLB: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[aiStorage] Downloaded GLB size:', arrayBuffer.byteLength, 'bytes');

  // 올바른 MIME type으로 새 Blob 생성 (Python 서버가 text/plain을 반환할 수 있음)
  const glbBlob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  console.log('[aiStorage] Created Blob with correct MIME type:', glbBlob.type);

  // Supabase Storage에 업로드
  return await uploadGeneratedModel(supabase, userId, modelId, glbBlob);
}

/**
 * URL에서 STL 파일을 다운로드하여 Supabase Storage에 저장
 */
export async function downloadAndUploadSTL(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  stlUrl: string
): Promise<{ path: string; url: string; publicUrl: string }> {
  console.log('[aiStorage] Downloading STL from:', stlUrl);

  // STL 파일 다운로드
  const response = await fetch(stlUrl);
  if (!response.ok) {
    throw new Error(`Failed to download STL: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[aiStorage] Downloaded STL size:', arrayBuffer.byteLength, 'bytes');

  // 올바른 MIME type으로 새 Blob 생성
  const stlBlob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  console.log('[aiStorage] Created STL Blob with MIME type:', stlBlob.type);

  // Supabase Storage에 업로드
  const path = `${userId}/generated-models/${modelId}.stl`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, stlBlob, {
      contentType: 'application/octet-stream',
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    path: path,
    url: urlData.publicUrl,
    publicUrl: urlData.publicUrl
  };
}

/**
 * URL에서 썸네일 이미지를 다운로드하여 Supabase Storage에 저장
 */
export async function downloadAndUploadThumbnail(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  thumbnailUrl: string
): Promise<{ path: string; url: string; publicUrl: string }> {
  console.log('[aiStorage] Downloading thumbnail from:', thumbnailUrl);

  try {
    // 썸네일 이미지 다운로드 (CORS 허용 모드)
    const response = await fetch(thumbnailUrl, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/*',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('[aiStorage] Downloaded thumbnail size:', arrayBuffer.byteLength, 'bytes');

    // Content-Type에서 이미지 타입 추출 (기본값: image/png)
    const contentType = response.headers.get('content-type') || 'image/png';
    const thumbnailBlob = new Blob([arrayBuffer], { type: contentType });
    console.log('[aiStorage] Created thumbnail Blob with MIME type:', thumbnailBlob.type);

    // Supabase Storage에 업로드
    const path = `${userId}/thumbnails/${modelId}.png`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, thumbnailBlob, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('[aiStorage] Supabase upload error:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    console.log('[aiStorage] Thumbnail uploaded successfully:', urlData.publicUrl);

    return {
      path: path,
      url: urlData.publicUrl,
      publicUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('[aiStorage] Failed to download/upload thumbnail:', error);
    console.error('[aiStorage] Thumbnail URL was:', thumbnailUrl);
    throw error;
  }
}

/**
 * Storage에서 파일 삭제
 */
export async function deleteStorageFile(
  supabase: SupabaseClient,
  path: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) throw error;
}

/**
 * 모델과 관련된 모든 파일 삭제
 */
export async function deleteModelFiles(
  supabase: SupabaseClient,
  modelData: {
    source_image_url?: string;
    storage_path?: string;
    thumbnail_url?: string;
  }
): Promise<void> {
  const filesToDelete = [
    modelData.source_image_url,
    modelData.storage_path,
    modelData.thumbnail_url
  ].filter(Boolean) as string[];

  if (filesToDelete.length > 0) {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete);

    if (error) throw error;
  }
}

/**
 * 사용자의 업로드된 이미지 목록 가져오기
 */
export async function listUserSourceImages(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<{ name: string; path: string; url: string; created_at: string; size: number }>> {
  const folderPath = `${userId}/source-images`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) throw error;

  return (data || []).map(file => {
    const fullPath = `${folderPath}/${file.name}`;
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fullPath);

    console.log('[aiStorage] Generated URL for', file.name, ':', urlData.publicUrl);

    return {
      name: file.name,
      path: fullPath,
      url: urlData.publicUrl,
      created_at: file.created_at || new Date().toISOString(),
      size: file.metadata?.size || 0
    };
  });
}

/**
 * Python AI 서버의 GCode URL에서 GCode를 다운로드하고 Supabase Storage에 업로드
 */
export async function downloadAndUploadGCode(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  gcodeUrl: string
): Promise<{ path: string; publicUrl: string } | null> {
  try {
    console.log('[aiStorage] Downloading GCode from AI server:', gcodeUrl);

    // 1. Python 서버에서 GCode 다운로드
    const response = await fetch(gcodeUrl);
    if (!response.ok) {
      throw new Error(`Failed to download GCode: ${response.status} ${response.statusText}`);
    }

    const gcodeBlob = await response.blob();
    console.log('[aiStorage] GCode downloaded, size:', gcodeBlob.size, 'bytes');

    // 2. Supabase Storage에 업로드
    const path = `${userId}/generated-models/${modelId}.gcode`;
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, gcodeBlob, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('[aiStorage] GCode upload failed:', error);
      throw error;
    }

    // 3. Public URL 생성
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    console.log('[aiStorage] GCode uploaded successfully:', urlData.publicUrl);

    return {
      path: path,
      publicUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('[aiStorage] Failed to download and upload GCode:', error);
    return null;
  }
}
