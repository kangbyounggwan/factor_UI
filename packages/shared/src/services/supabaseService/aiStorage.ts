import { SupabaseClient } from '@supabase/supabase-js';
import { generateShortFilename } from '../claudeService';

const BUCKET_NAME = 'ai-models';
const GCODE_BUCKET_NAME = 'gcode-files';

/**
 * Supabase Storage에 사용할 수 있는 안전한 파일명/경로로 변환
 * - 한글, 특수문자, 공백 등을 제거하고 영문/숫자/하이픈만 남김
 * - 최대 50자로 제한
 */
function sanitizeStoragePath(name: string): string {
  if (!name) return 'unnamed';

  // 한글을 로마자로 간단 변환 (삭제)하고, 허용 문자만 남김
  const sanitized = name
    .replace(/[^\w\s-]/g, '') // 영문, 숫자, 공백, 하이픈, 언더스코어만 남김
    .replace(/\s+/g, '-')     // 공백을 하이픈으로
    .replace(/-+/g, '-')      // 연속 하이픈을 하나로
    .replace(/^-|-$/g, '')    // 앞뒤 하이픈 제거
    .toLowerCase()
    .substring(0, 50);        // 최대 50자

  return sanitized || 'unnamed';
}

/**
 * 파일 경로에서 Public URL 생성 (버킷이 public인 경우)
 * @param supabase - Supabase 클라이언트
 * @param bucketName - 버킷 이름 ('ai-models' | 'gcode-files')
 * @param path - 파일 경로
 * @returns Public URL 또는 null
 */
export async function createSignedUrlFromPath(
  supabase: SupabaseClient,
  bucketName: string,
  path: string
): Promise<string | null> {
  if (!path) return null;

  try {
    // Public URL 사용 (ai-models 버킷은 public)
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error) {
    console.error('[aiStorage] Exception creating public URL:', error);
    return null;
  }
}

/**
 * URL에서 경로 추출하는 함수
 * @param url - Supabase storage URL 또는 경로
 * @returns 경로 또는 null
 */
export function extractPathFromUrl(url: string | undefined): string | null {
  if (!url) return null;

  // 이미 경로 형식인 경우 (http:// 또는 https://로 시작하지 않음)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url; // 경로를 그대로 반환
  }

  try {
    const urlObj = new URL(url);
    // Supabase storage URL 형식: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const match = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (match) {
      return decodeURIComponent(match[1].split('?')[0]); // 쿼리 파라미터 제거
    }
  } catch (e) {
    // URL 파싱 실패는 로그 출력하지 않음 (경로인 경우 정상)
  }
  return null;
}

/**
 * GCode 슬라이싱 메타데이터 타입
 */
export interface GCodeMetadata {
  print_time_formatted?: string;
  print_time_seconds?: number;
  filament_used_m?: number;
  filament_weight_g?: number;
  filament_cost?: number;
  layer_count?: number;
  layer_height?: number;
  bounding_box?: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
    min_z: number;
    max_z: number;
    size_x?: number;
    size_y?: number;
    size_z?: number;
  };
  nozzle_temp?: number;
  bed_temp?: number;
  printer_name?: string;
}

/**
 * print_time_formatted 문자열을 초 단위로 변환
 * @param timeStr - 예: "2h 30m 15s", "1h 5m", "45m 30s", "30s"
 * @returns 초 단위 숫자, 파싱 실패 시 null
 */
function parseFormattedTimeToSeconds(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;

  let totalSeconds = 0;

  // 시간 추출 (h)
  const hoursMatch = timeStr.match(/(\d+)\s*h/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1]) * 3600;
  }

  // 분 추출 (m)
  const minutesMatch = timeStr.match(/(\d+)\s*m/);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1]) * 60;
  }

  // 초 추출 (s)
  const secondsMatch = timeStr.match(/(\d+)\s*s/);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1]);
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

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
  const result = await uploadGeneratedModel(supabase, userId, modelId, glbBlob);
  console.log('[aiStorage] GLB uploaded successfully:', result.publicUrl);
  return result;
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

  // Public URL 생성
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  const result = {
    path: path,
    url: urlData.publicUrl,
    publicUrl: urlData.publicUrl
  };
  console.log('[aiStorage] STL uploaded successfully:', result.publicUrl);
  return result;
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

    // Public URL 생성
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
  // 새 구조: {userId}/{modelId}/
  const gcodeFolderPath = `${userId}/${modelData.id}`;

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

  // Public URL 생성
  const filesWithUrls = (data || []).map((file) => {
    const fullPath = `${folderPath}/${file.name}`;
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fullPath);

    const url = urlData.publicUrl;
    console.log('[aiStorage] Generated URL for', file.name, ':', url);

    return {
      name: file.name,
      path: fullPath,
      url: url,
      created_at: file.created_at || new Date().toISOString(),
      size: file.metadata?.size || 0
    };
  });

  return filesWithUrls;
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
  modelName?: string,
  printerInfo?: {
    manufacturer?: string;
    series?: string;
    model?: string;
    printer_name?: string;
  },
  metadata?: GCodeMetadata,
  prompt?: string,    // 사용자의 원본 프롬프트 (text-to-3D: Claude로 파일명 생성용)
  imageUrl?: string,  // 원본 이미지 URL (image-to-3D: Claude Vision으로 파일명 생성용)
  modelNameFromDb?: string  // 모델에서 이미 생성된 model_name (있으면 우선 사용)
): Promise<{ path: string; publicUrl: string; metadata?: GCodeMetadata } | null> {
  try {
    const GCODE_BUCKET = 'gcode-files';

    // modelId가 null/undefined인 경우 fallback
    const safeModelId = modelId || `model-${Date.now()}`;

    // 파일 구조: {userId}/{modelId}/{sanitizedModelFolder}/{shortFileName}.gcode
    // modelName을 sanitize하여 폴더명으로 사용 (특수문자, 한글 제거)
    const modelFolder = sanitizeStoragePath(modelName || '') || safeModelId.substring(0, 8);

    // 짧은 파일명 결정 (우선순위: modelNameFromDb 파라미터 -> Claude API -> fallback)
    let shortFileName: string;

    if (modelNameFromDb) {
      // 모델에서 이미 생성된 model_name이 있으면 그것을 사용
      shortFileName = `${modelNameFromDb}.gcode`;
      console.log('[aiStorage] Using existing model_name:', shortFileName);
    } else {
      // Claude API로 짧은 파일명 생성 (프롬프트 우선 -> 이미지 -> 모델명)
      try {
        const generatedName = await generateShortFilename({ prompt, imageUrl, modelName });
        shortFileName = `${generatedName}.gcode`;
        console.log('[aiStorage] Claude generated filename:', shortFileName);
      } catch (error) {
        console.warn('[aiStorage] Claude filename generation failed, using fallback:', error);
        // Fallback: 기존 방식으로 파일명 생성
        if (modelName) {
          const words = modelName.split(/[_\s-]+/).filter(w => w.length > 0);
          const meaningfulWord = words.find(w =>
            !w.toLowerCase().includes('text') &&
            !w.toLowerCase().includes('image') &&
            !w.toLowerCase().includes('3d') &&
            !w.toLowerCase().includes('printable') &&
            w.length > 2
          ) || words[words.length - 1] || safeModelId.substring(0, 8);
          shortFileName = `${sanitizeStoragePath(meaningfulWord)}.gcode`;
        } else {
          shortFileName = `${safeModelId.substring(0, 8)}.gcode`;
        }
      }
    }

    const path = `${userId}/${safeModelId}/${modelFolder}/${shortFileName}`;
    const filename = shortFileName;

    console.log('[aiStorage] Downloading GCode from AI server:', gcodeUrl);

    // 1. Python 서버에서 GCode 다운로드
    const response = await fetch(gcodeUrl);
    if (!response.ok) {
      throw new Error(`Failed to download GCode: ${response.status} ${response.statusText}`);
    }

    const gcodeBlob = await response.blob();
    console.log('[aiStorage] GCode downloaded, size:', gcodeBlob.size, 'bytes');

    // 2. Supabase Storage에 업로드
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

    // 3. Public URL 생성
    const { data: urlData } = supabase.storage
      .from(GCODE_BUCKET)
      .getPublicUrl(path);

    console.log('[aiStorage] GCode uploaded successfully:', urlData.publicUrl);

    // 4. 메타데이터를 DB에 저장
    if (printerModelId && metadata) {
      // print_time_formatted를 초 단위로 변환
      const printTimeSeconds = parseFormattedTimeToSeconds(metadata.print_time_formatted);

      console.log('[aiStorage] Saving metadata to DB:', {
        model_id: modelId,
        printer_id: printerModelId,
        metadata: metadata,
        print_time_seconds: printTimeSeconds
      });

      const { data: upsertData, error: metadataError } = await supabase
        .from('gcode_files')
        .upsert({
          user_id: userId,
          model_id: modelId,
          printer_id: printerModelId,
          filename: filename,
          short_filename: shortFileName,
          file_path: path,
          file_size: gcodeBlob.size,
          manufacturer: printerInfo?.manufacturer,
          series: printerInfo?.series,
          printer_model_name: printerInfo?.model,
          printer_name: printerInfo?.printer_name,
          print_time_formatted: metadata.print_time_formatted,
          print_time_seconds: printTimeSeconds,
          filament_used_m: metadata.filament_used_m,
          filament_weight_g: metadata.filament_weight_g,
          filament_cost: metadata.filament_cost,
          layer_count: metadata.layer_count,
          layer_height: metadata.layer_height,
          bounding_box: metadata.bounding_box,
          nozzle_temp: metadata.nozzle_temp,
          bed_temp: metadata.bed_temp,
          status: 'uploaded'
        })
        .select();

      if (metadataError) {
        console.error('[aiStorage] Failed to save metadata to DB:', metadataError);
        console.error('[aiStorage] Error details:', JSON.stringify(metadataError, null, 2));
      } else {
        console.log('[aiStorage] Metadata saved to DB successfully:', upsertData);
      }
    }

    return {
      path: path,
      publicUrl: urlData.publicUrl,
      metadata: metadata
    };
  } catch (error) {
    console.error('[aiStorage] Failed to download and upload GCode:', error);
    return null;
  }
}
