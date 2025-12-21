-- Add camera_type column to cameras table
-- Values: 'octoprint' (default, uses Raspberry Pi + MQTT + WebRTC)
--         'external' (direct external camera URL, MJPEG/HTTP stream)

ALTER TABLE cameras
ADD COLUMN IF NOT EXISTS camera_type text DEFAULT 'octoprint';

-- Add check constraint to ensure valid values
ALTER TABLE cameras
ADD CONSTRAINT cameras_camera_type_check
CHECK (camera_type IN ('octoprint', 'external'));

-- Add comment for documentation
COMMENT ON COLUMN cameras.camera_type IS 'Camera type: octoprint (Raspberry Pi + MQTT + WebRTC) or external (direct URL)';
