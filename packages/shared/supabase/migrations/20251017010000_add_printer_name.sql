-- Add name column to printers table
-- This column stores the user-defined printer name

-- Add name column (nullable initially for existing records)
ALTER TABLE printers
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update existing records: set name to model if name is null
UPDATE printers
SET name = model
WHERE name IS NULL;

-- Make name NOT NULL after populating existing records
ALTER TABLE printers
ALTER COLUMN name SET NOT NULL;

-- Add comment
COMMENT ON COLUMN printers.name IS 'User-defined printer name';
