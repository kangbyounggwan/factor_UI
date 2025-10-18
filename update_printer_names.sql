-- Update existing printers: set name to model if name is null or empty
UPDATE printers
SET name = model
WHERE name IS NULL OR name = '';

-- Verify the update
SELECT id, name, model FROM printers LIMIT 10;
