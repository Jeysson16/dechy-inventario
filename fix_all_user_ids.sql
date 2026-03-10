-- FIX USER_ID COLUMN IN ALL TABLES
-- This script ensures 'user_id' column exists and is correctly linked in all relevant tables.

-- 1. Fix Transactions Table
DO $$ 
BEGIN 
    -- Rename 'performed_by' to 'user_id' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='performed_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions RENAME COLUMN performed_by TO user_id;
    
    -- Add 'user_id' if neither exists
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 2. Fix Sales Table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='user_id') THEN
        ALTER TABLE public.sales ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 3. Fix Profiles Table (Self-reference not needed but ensuring ID matches Auth)
-- No action needed on columns, just policies.

-- 4. Apply Foreign Key Constraints (Safe to run multiple times)
-- Transactions -> Profiles
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Sales -> Profiles
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales 
ADD CONSTRAINT sales_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Update RLS Policies to allow inserting user_id
-- Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Insert company transactions" ON public.transactions;
CREATE POLICY "Insert company transactions" ON public.transactions 
FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Insert company sales" ON public.sales;
CREATE POLICY "Insert company sales" ON public.sales 
FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- 6. Refresh Schema Cache
NOTIFY pgrst, 'reload config';
