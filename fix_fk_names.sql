-- STANDARDISING FOREIGN KEY NAMES
-- This script renames foreign key constraints to standard names so the frontend can use explicit embedding.

-- 1. Profiles -> Branches (Used in EmployeeManager)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_branch_id_fkey 
FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Inventory -> Products (Used in InventoryList, StockEntry, Dashboard)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE public.inventory 
ADD CONSTRAINT inventory_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 3. Products -> Categories (Used in InventoryList, Dashboard)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.products 
ADD CONSTRAINT products_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4. Transactions -> Products (Used in Sales, Dashboard)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_product_id_fkey;
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 5. Transactions -> Profiles (User ID) (Already fixed in previous step, but ensuring consistency)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Sales -> Profiles (User ID)
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales 
ADD CONSTRAINT sales_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. Reload Config
NOTIFY pgrst, 'reload config';
