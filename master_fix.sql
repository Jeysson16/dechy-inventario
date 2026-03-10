-- MASTER FIX SCRIPT
-- This script fixes ALL known issues:
-- 1. "Infinite recursion" in profiles.
-- 2. "Missing interfaces" (Legacy data migration to Companies).
-- 3. Ensures all necessary Stored Procedures (RPCs) exist.

-- ==============================================================================
-- PART 1: FIX PROFILE RECURSION (The "500 Internal Server Error" cause)
-- ==============================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); 
    END LOOP; 
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple, safe policies
CREATE POLICY "Public read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ==============================================================================
-- PART 2: COMPANY SUPPORT & LEGACY DATA MIGRATION (The "Missing Interfaces" cause)
-- ==============================================================================

-- 1. Create companies table if missing
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add columns if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_id') THEN
        ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='company_id') THEN
        ALTER TABLE public.branches ADD COLUMN company_id UUID REFERENCES public.companies(id);
    END IF;
END $$;

-- 3. Create a Default Company for legacy users
DO $$ 
DECLARE 
    default_company_id UUID;
BEGIN 
    -- Check if we have any company, if not create one
    SELECT id INTO default_company_id FROM public.companies LIMIT 1;
    
    IF default_company_id IS NULL THEN
        INSERT INTO public.companies (name) VALUES ('Mi Empresa (Principal)') RETURNING id INTO default_company_id;
    END IF;

    -- Update legacy profiles (NULL company) to use this default company
    UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;

    -- Update legacy branches (NULL company) to use this default company
    UPDATE public.branches SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- 4. Fix Branch Policies
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public branches are viewable by everyone" ON public.branches;
DROP POLICY IF EXISTS "View company branches" ON public.branches;
DROP POLICY IF EXISTS "Insert company branches" ON public.branches;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View company branches" ON public.branches
FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Insert company branches" ON public.branches
FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Fix Company Policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
DROP POLICY IF EXISTS "Allow public insert company" ON public.companies;

CREATE POLICY "Users can view own company" ON public.companies
FOR SELECT USING (
    id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Allow public insert company" ON public.companies
FOR INSERT WITH CHECK (true);


-- ==============================================================================
-- PART 3: STORED PROCEDURES (The "seguro que llamas a un sp" check)
-- ==============================================================================

-- 1. get_branch_inventory
CREATE OR REPLACE FUNCTION public.get_branch_inventory(p_branch_id UUID)
RETURNS TABLE (
    inventory_id UUID,
    product_id UUID,
    product_name TEXT,
    sku TEXT,
    image_url TEXT,
    stock_current INTEGER,
    stock_min INTEGER,
    price_unit NUMERIC,
    locations JSONB,
    category_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id AS inventory_id,
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.image_url,
        i.stock_current,
        i.stock_min,
        p.unit_price AS price_unit,
        i.location_code AS locations,
        c.name AS category_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE i.branch_id = p_branch_id;
END;
$$ LANGUAGE plpgsql;

-- 2. process_sale
CREATE OR REPLACE FUNCTION public.process_sale(
    p_branch_id UUID,
    p_items JSONB,
    p_total NUMERIC
)
RETURNS VOID AS $$
DECLARE
    item JSONB;
    v_sale_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    INSERT INTO public.sales (branch_id, user_id, total_amount)
    VALUES (p_branch_id, v_user_id, p_total)
    RETURNING id INTO v_sale_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.transactions (branch_id, product_id, sale_id, user_id, type, quantity, amount)
        VALUES (
            p_branch_id,
            (item->>'product_id')::UUID,
            v_sale_id,
            v_user_id,
            'SALE',
            (item->>'quantity')::INTEGER,
            (item->>'price')::NUMERIC * (item->>'quantity')::INTEGER
        );
        UPDATE public.inventory
        SET stock_current = stock_current - (item->>'quantity')::INTEGER
        WHERE branch_id = p_branch_id AND product_id = (item->>'product_id')::UUID;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. add_stock
CREATE OR REPLACE FUNCTION public.add_stock(
    p_branch_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_locations JSONB,
    p_note TEXT,
    p_location_key TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    UPDATE public.inventory
    SET stock_current = stock_current + p_quantity,
        location_code = p_locations
    WHERE branch_id = p_branch_id AND product_id = p_product_id;

    INSERT INTO public.transactions (branch_id, product_id, user_id, type, quantity, details)
    VALUES (
        p_branch_id,
        p_product_id,
        v_user_id,
        'ENTRY',
        p_quantity,
        jsonb_build_object('location', p_location_key, 'note', p_note)
    );
END;
$$ LANGUAGE plpgsql;

-- 4. transfer_stock
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_branch_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_new_locations JSONB,
    p_origin_location TEXT,
    p_dest_location TEXT,
    p_note TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    UPDATE public.inventory
    SET location_code = p_new_locations
    WHERE branch_id = p_branch_id AND product_id = p_product_id;

    INSERT INTO public.transactions (branch_id, product_id, user_id, type, quantity, details)
    VALUES (
        p_branch_id,
        p_product_id,
        v_user_id,
        'TRANSFER',
        p_quantity,
        jsonb_build_object(
            'origin_location', p_origin_location, 
            'destination_location', p_dest_location, 
            'note', p_note
        )
    );
END;
$$ LANGUAGE plpgsql;
