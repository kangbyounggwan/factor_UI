-- Create gcode-files storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gcode-files',
  'gcode-files',
  true, -- Public access for viewer
  104857600, -- 100MB
  ARRAY['application/octet-stream', 'text/plain', 'text/x-gcode']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/octet-stream', 'text/plain', 'text/x-gcode'];

-- Allow authenticated users to upload their own gcode files
CREATE POLICY "Users can upload gcode files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gcode-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to gcode files
CREATE POLICY "Gcode files are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gcode-files');

-- Allow users to delete their own gcode files
CREATE POLICY "Users can delete their own gcode files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gcode-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own gcode files
CREATE POLICY "Users can update their own gcode files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gcode-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
