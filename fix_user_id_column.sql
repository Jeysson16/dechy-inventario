-- FIX MISSING USER_ID COLUMN
-- This script resolves the "column user_id does not exist" error by checking for renaming or adding the column.

-- 1. Fix Transactions Table
DO $$ 
BEGIN 
    -- Case A: 'performed_by' exists but 'user_id' does not -> Rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='performed_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
        ALTER TABLE public.transactions RENAME COLUMN performed_by TO user_id;
    
    -- Case B: Neither exists -> Add 'user_id'
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

-- 3. Add Foreign Key Constraints (Safe to run now)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales 
ADD CONSTRAINT sales_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Refresh API Schema
NOTIFY pgrst, 'reload config';
