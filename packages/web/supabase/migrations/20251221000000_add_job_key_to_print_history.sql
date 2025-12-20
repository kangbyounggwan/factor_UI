-- Add octoprint_job_id column for duplicate prevention
-- OctoPrint provides unique job ID for each print job

ALTER TABLE model_print_history
ADD COLUMN IF NOT EXISTS octoprint_job_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_model_print_history_octoprint_job_id
ON model_print_history(printer_id, octoprint_job_id)
WHERE print_status = 'printing';

-- Add unique constraint to prevent duplicate printing jobs
-- Only one 'printing' job with same octoprint_job_id per printer
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_print_history_unique_printing_job
ON model_print_history(printer_id, octoprint_job_id)
WHERE print_status = 'printing';

COMMENT ON COLUMN model_print_history.octoprint_job_id IS 'OctoPrint job ID (unique identifier from OctoPrint, prevents duplicate entries)';
