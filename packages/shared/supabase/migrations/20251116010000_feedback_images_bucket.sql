-- Create feedback-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own feedback images
CREATE POLICY "Users can upload feedback images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to feedback images
CREATE POLICY "Feedback images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

-- Allow users to delete their own feedback images
CREATE POLICY "Users can delete their own feedback images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
