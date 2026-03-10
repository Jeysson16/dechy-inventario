-- FIX MISSING COLUMNS IN PRODUCTS
-- This script renames columns to match the application code (unit_price, box_price, etc.)

DO $$ 
BEGIN 
    -- 1. Fix unit_price
    -- Check if 'unit_price' exists. If not, look for 'price' or 'price_unit' to rename.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit_price') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
            ALTER TABLE public.products RENAME COLUMN price TO unit_price;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_unit') THEN
            ALTER TABLE public.products RENAME COLUMN price_unit TO unit_price;
        ELSE
            ALTER TABLE public.products ADD COLUMN unit_price NUMERIC(10,2) DEFAULT 0;
        END IF;
    END IF;

    -- 2. Fix box_price
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='box_price') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_box') THEN
            ALTER TABLE public.products RENAME COLUMN price_box TO box_price;
        ELSE
            ALTER TABLE public.products ADD COLUMN box_price NUMERIC(10,2) DEFAULT 0;
        END IF;
    END IF;

    -- 3. Fix units_per_box
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='units_per_box') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='units_box') THEN
            ALTER TABLE public.products RENAME COLUMN units_box TO units_per_box;
        ELSE
            ALTER TABLE public.products ADD COLUMN units_per_box INTEGER DEFAULT 1;
        END IF;
    END IF;

     -- 4. Fix image_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image') THEN
            ALTER TABLE public.products RENAME COLUMN image TO image_url;
        ELSE
            ALTER TABLE public.products ADD COLUMN image_url TEXT;
        END IF;
    END IF;

END $$;

-- Reload Config
NOTIFY pgrst, 'reload config';
