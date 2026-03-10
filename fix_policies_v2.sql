-- ROBUST FIX FOR DUPLICATE POLICIES
-- This script uses dynamic SQL to remove ALL policies on 'branches' and 'companies' 
-- before re-creating them. This guarantees no "already exists" errors.

-- ==============================================================================
-- 1. CLEANUP BRANCHES POLICIES
-- ==============================================================================
DO $$ 
DECLARE pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branches' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.branches', pol.policyname); 
    END LOOP; 
END $$;

-- ==============================================================================
-- 2. CLEANUP COMPANIES POLICIES
-- ==============================================================================
DO $$ 
DECLARE pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'companies' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname); 
    END LOOP; 
END $$;

-- ==============================================================================
-- 3. RE-CREATE BRANCHES POLICIES
-- ==============================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View company branches" ON public.branches
FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Insert company branches" ON public.branches
FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Update company branches" ON public.branches
FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- ==============================================================================
-- 4. RE-CREATE COMPANIES POLICIES
-- ==============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company" ON public.companies
FOR SELECT USING (
    id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Allow public insert company" ON public.companies
FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 5. VERIFY & FIX DATA (Just in case)
-- ==============================================================================
DO $$ 
DECLARE 
    default_company_id UUID;
BEGIN 
    -- Ensure at least one company exists
    SELECT id INTO default_company_id FROM public.companies LIMIT 1;
    
    IF default_company_id IS NULL THEN
        INSERT INTO public.companies (name) VALUES ('Mi Empresa (Principal)') RETURNING id INTO default_company_id;
    END IF;

    -- Fix orphans
    UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.branches SET company_id = default_company_id WHERE company_id IS NULL;
END $$;
