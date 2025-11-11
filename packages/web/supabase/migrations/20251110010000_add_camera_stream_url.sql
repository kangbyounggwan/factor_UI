-- Add stream_url column to cameras table
ALTER TABLE cameras
ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN cameras.stream_url IS 'URL for the camera stream (MJPEG, HLS, etc.)';
