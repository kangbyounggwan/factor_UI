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
 * 모델과 관련된 모든 파일 삭제 (GLB, STL, 썸네일, GCode)
 */
export async function deleteModelFiles(
  supabase: SupabaseClient,
  userId: string,
  modelData: {
    id: string;
    storage_path?: string;
    stl_url?: string;
    thumbnail_url?: string;
    gcode_url?: string;
    model_name?: string;
    prompt?: string;
  }
): Promise<void> {
  const filesToDelete: string[] = [];

  // URL에서 경로 추출하는 함수
  const extractPath = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      // Supabase storage URL 형식: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
      if (match) {
        return decodeURIComponent(match[1].split('?')[0]); // 쿼리 파라미터 제거
      }
    } catch (e) {
      console.warn('[deleteModelFiles] Failed to parse URL:', url);
    }
    return null;
  };

  // 1. GLB 파일 (ai-models 버킷)
  if (modelData.storage_path) {
    const path = extractPath(modelData.storage_path);
    if (path) filesToDelete.push(path);
  }

  // 2. STL 파일 (ai-models 버킷)
  if (modelData.stl_url) {
    const path = extractPath(modelData.stl_url);
    if (path) filesToDelete.push(path);
  }

  // 3. 썸네일 (ai-models 버킷)
  if (modelData.thumbnail_url) {
    const path = extractPath(modelData.thumbnail_url);
    if (path) filesToDelete.push(path);
  }

  // ai-models 버킷에서 파일 삭제
  if (filesToDelete.length > 0) {
    console.log('[deleteModelFiles] Deleting from ai-models:', filesToDelete);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete);

    if (error) {
      console.error('[deleteModelFiles] Error deleting from ai-models:', error);
    }
  }

  // 4. GCode 파일들 삭제 (gcode-files 버킷의 모델 폴더 전체)
  const modelName = (modelData.model_name || modelData.prompt || modelData.id).replace(/[^a-zA-Z0-9._-]/g, '_');
  const gcodeFolderPath = `${userId}/${modelName}`;

  try {
    console.log('[deleteModelFiles] Deleting GCode folder:', gcodeFolderPath);

    // 폴더 내 모든 파일 목록 가져오기
    const { data: gcodeFiles, error: listError } = await supabase.storage
      .from('gcode-files')
      .list(gcodeFolderPath);

    if (listError) {
      console.warn('[deleteModelFiles] Error listing GCode files:', listError);
    } else if (gcodeFiles && gcodeFiles.length > 0) {
      // 파일 경로 생성
      const gcodeFilesToDelete = gcodeFiles.map(file => `${gcodeFolderPath}/${file.name}`);

      console.log('[deleteModelFiles] Deleting GCode files:', gcodeFilesToDelete);

      // GCode 파일들 삭제
      const { error: deleteError } = await supabase.storage
        .from('gcode-files')
        .remove(gcodeFilesToDelete);

      if (deleteError) {
        console.error('[deleteModelFiles] Error deleting GCode files:', deleteError);
      }
    }
  } catch (error) {
    console.error('[deleteModelFiles] Failed to delete GCode folder:', error);
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
  gcodeUrl: string,
  printerModelId?: string,
  modelName?: string
): Promise<{ path: string; publicUrl: string } | null> {
  try {
    const GCODE_BUCKET = 'gcode-files';

    // 3D 모델명 폴더 내에 프린터별 GCode 파일 저장
    // 경로: {userId}/{modelName}/{printerModelId}.gcode
    const sanitizedModelName = (modelName || modelId).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = printerModelId
      ? `${printerModelId}.gcode`
      : 'default.gcode';
    const path = `${userId}/${sanitizedModelName}/${filename}`;

    console.log('[aiStorage] Checking if GCode already exists:', path);

    // 1. 이미 저장된 GCode가 있는지 확인
    const folderPath = `${userId}/${sanitizedModelName}`;
    const { data: existingFiles } = await supabase.storage
      .from(GCODE_BUCKET)
      .list(folderPath, {
        search: filename
      });

    if (existingFiles && existingFiles.length > 0) {
      console.log('[aiStorage] GCode already exists in storage, using existing file');
      const { data: urlData } = supabase.storage
        .from(GCODE_BUCKET)
        .getPublicUrl(path);

      return {
        path: path,
        publicUrl: urlData.publicUrl
      };
    }

    console.log('[aiStorage] GCode not found in storage, downloading from AI server:', gcodeUrl);

    // 2. Python 서버에서 GCode 다운로드
    const response = await fetch(gcodeUrl);
    if (!response.ok) {
      throw new Error(`Failed to download GCode: ${response.status} ${response.statusText}`);
    }

    const gcodeBlob = await response.blob();
    console.log('[aiStorage] GCode downloaded, size:', gcodeBlob.size, 'bytes');

    // 3. Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(GCODE_BUCKET)
      .upload(path, gcodeBlob, {
        contentType: 'text/x-gcode',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('[aiStorage] GCode upload failed:', error);
      throw error;
    }

    // 4. Public URL 생성
    const { data: urlData } = supabase.storage
      .from(GCODE_BUCKET)
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
