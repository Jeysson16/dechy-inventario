-- FIX INVENTORY AND BRANCH SETTINGS COLUMNS
-- This script ensures that 'inventory' has 'location_code' and 'branches' has 'settings'.

-- 1. Fix inventory.location_code (JSONB)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='location_code') THEN
        ALTER TABLE public.inventory ADD COLUMN location_code JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Fix branches.settings (JSONB for Layouts)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='settings') THEN
        ALTER TABLE public.branches ADD COLUMN settings JSONB DEFAULT '{"layouts": []}'::jsonb;
    END IF;
END $$;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
