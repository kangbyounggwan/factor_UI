-- Add manufacture_id column to printers table
-- This column references the manufacturing_printers table

ALTER TABLE printers
ADD COLUMN IF NOT EXISTS manufacture_id UUID REFERENCES manufacturing_printers(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_printers_manufacture_id ON printers(manufacture_id);

-- Add comment
COMMENT ON COLUMN printers.manufacture_id IS 'Reference to the manufacturing_printers table for detailed printer specifications';
