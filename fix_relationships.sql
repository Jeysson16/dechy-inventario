-- Fix missing foreign key relationship between profiles and branches
-- This is needed for Supabase to detect the relationship in the API (PostgREST)

-- 1. Ensure the column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS branch_id UUID;

-- 2. Add the foreign key constraint explicitly
-- We use a specific name for the constraint to ensure it's clean
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.branches(id)
ON DELETE SET NULL;

-- 3. Refresh the schema cache (notify PostgREST)
NOTIFY pgrst, 'reload config';
