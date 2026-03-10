-- FIX FINAL SCHEMA & RELATIONS
-- This script aligns the database schema with the application logic to resolve AbortErrors and FK issues.

-- 1. Fix Transactions Table (user_id)
DO $$ 
BEGIN 
    -- Rename 'performed_by' to 'user_id' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='performed_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions RENAME COLUMN performed_by TO user_id;
    END IF;
    
    -- Add 'user_id' if neither exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 2. Fix Sales Table (user_id)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='user_id') THEN
        ALTER TABLE public.sales ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 3. Fix Foreign Keys (Explicit Names)
-- Transactions -> Profiles
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_performed_by_fkey; -- Remove old
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Sales -> Profiles
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales 
ADD CONSTRAINT sales_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Update RLS Policies (Drop by name to avoid conflicts)
DO $$
BEGIN
    -- Transactions
    DROP POLICY IF EXISTS "Insert company transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.transactions;
    
    -- Sales
    DROP POLICY IF EXISTS "Insert company sales" ON public.sales;
END $$;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert company transactions" ON public.transactions 
FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert company sales" ON public.sales 
FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    branch_id IN (SELECT id FROM public.branches WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- 5. Fix Profiles Recursion (Final Check)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- 6. Reload Schema
NOTIFY pgrst, 'reload config';
