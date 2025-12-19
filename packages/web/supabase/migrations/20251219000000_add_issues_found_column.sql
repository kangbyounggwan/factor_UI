-- Add issues_found column to gcode_analysis_reports table
-- This column stores the raw issues_found array from the analysis API response
-- for easier access and queries

ALTER TABLE gcode_analysis_reports
ADD COLUMN IF NOT EXISTS issues_found JSONB DEFAULT '[]'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN gcode_analysis_reports.issues_found IS 'Raw issues_found array from analysis API response (includes grouped issues)';

-- Create index for querying issues
CREATE INDEX IF NOT EXISTS idx_gcode_analysis_reports_issues_found
ON gcode_analysis_reports USING GIN (issues_found);
