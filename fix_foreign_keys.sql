-- FIX FOREIGN KEYS FOR POSTGREST API
-- Supabase API needs explicit foreign keys to detect relationships automatically.
-- We will drop and re-create them with standard naming conventions.

-- 1. Inventory -> Products (product_id)
ALTER TABLE public.inventory 
DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE CASCADE;

-- 2. Products -> Categories (category_id)
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_category_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES public.categories(id)
ON DELETE SET NULL;

-- 3. Transactions -> Products (product_id)
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_product_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE SET NULL;

-- 4. Transactions -> Profiles (user_id)
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 5. Inventory -> Branches (branch_id)
ALTER TABLE public.inventory
DROP CONSTRAINT IF EXISTS inventory_branch_id_fkey;

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.branches(id)
ON DELETE CASCADE;

-- 6. Transactions -> Branches (branch_id)
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_branch_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES public.branches(id)
ON DELETE CASCADE;

-- Refresh schema cache
NOTIFY pgrst, 'reload config';
