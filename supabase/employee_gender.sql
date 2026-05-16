-- Add gender field to employees table
-- Values: 'male' | 'female' | NULL (auto-detect from name)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IN ('male', 'female'))
    DEFAULT NULL;

-- RLS: same policies as other columns (inherited from existing row-level security)
