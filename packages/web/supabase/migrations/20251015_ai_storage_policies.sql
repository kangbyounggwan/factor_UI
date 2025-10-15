-- AI Models Storage Bucket RLS Policies

-- 1. ai-models 버킷에 대한 SELECT 정책 (본인 폴더만 조회 가능)
CREATE POLICY "Users can view their own ai-models files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-models'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. ai-models 버킷에 대한 INSERT 정책 (본인 폴더에만 업로드 가능)
CREATE POLICY "Users can upload to their own ai-models folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-models'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. ai-models 버킷에 대한 UPDATE 정책 (본인 파일만 수정 가능)
CREATE POLICY "Users can update their own ai-models files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai-models'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'ai-models'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. ai-models 버킷에 대한 DELETE 정책 (본인 파일만 삭제 가능)
CREATE POLICY "Users can delete their own ai-models files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-models'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 버킷이 public인지 확인 (public이어야 이미지 URL로 접근 가능)
-- Supabase Dashboard에서 직접 설정하거나 아래 쿼리로 확인:
-- SELECT * FROM storage.buckets WHERE name = 'ai-models';
-- public 컬럼이 true여야 합니다.
