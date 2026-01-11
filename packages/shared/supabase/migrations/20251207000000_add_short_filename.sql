-- Add short_filename column to gcode_files table
-- This stores the short filename used for MQTT transfer (e.g., "snowman.gcode")
-- while the full model name is preserved in the folder structure

ALTER TABLE public.gcode_files
ADD COLUMN IF NOT EXISTS short_filename TEXT;

COMMENT ON COLUMN public.gcode_files.short_filename IS 'Short filename used for MQTT transfer to printer (e.g., snowman.gcode)';

-- Create index for quick lookup by short_filename
CREATE INDEX IF NOT EXISTS idx_gcode_files_short_filename ON public.gcode_files(short_filename);
