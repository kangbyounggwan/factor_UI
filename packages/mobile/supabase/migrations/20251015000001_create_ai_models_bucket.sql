-- Create ai-models storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-models',
  'ai-models',
  true,
  52428800, -- 50MB
  ARRAY['model/gltf-binary', 'application/octet-stream', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['model/gltf-binary', 'application/octet-stream', 'image/png', 'image/jpeg', 'image/webp'];
