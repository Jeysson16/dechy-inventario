-- FIX DATABASE INCONSISTENCIES
-- 1. Fix 'unit_price' vs 'price_unit' column name in products table
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_unit') THEN
        ALTER TABLE public.products RENAME COLUMN price_unit TO unit_price;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_box') THEN
        ALTER TABLE public.products RENAME COLUMN price_box TO box_price;
    END IF;
END $$;

-- 2. Fix Ambiguous Relationships for Transactions -> Profiles
-- We need to ensure we are using the correct constraint name.
-- We'll drop potential duplicates and ensure one clean FK named 'transactions_user_id_fkey'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_performed_by_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Fix Profiles -> Branches FK name for explicit join
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_branch_id_fkey 
FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Refresh API Schema
NOTIFY pgrst, 'reload config';
