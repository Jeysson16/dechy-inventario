-- Esquema de base de datos para Inventario (Supabase)
-- Basado en el uso del código de la aplicación

-- Tabla: branches (Sucursales)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    image_url TEXT,
    primary_color TEXT DEFAULT '#10b981',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: categories (Categorías de productos)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: products (Productos globales)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    unit_price NUMERIC DEFAULT 0,
    box_price NUMERIC DEFAULT 0,
    units_per_box INTEGER DEFAULT 1,
    image_url TEXT,
    category_id UUID REFERENCES public.categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: inventory (Inventario por sucursal)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    stock_current INTEGER DEFAULT 0,
    stock_min INTEGER DEFAULT 0,
    location_code JSONB DEFAULT '{}'::jsonb, -- Almacena ubicaciones como objeto JSON { "shelf-row-col": quantity }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(branch_id, product_id)
);

-- Tabla: profiles (Perfiles de usuarios - vinculada a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: sales (Ventas cabecera)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: transactions (Detalle de movimientos: Ventas, Ingresos, Traslados)
-- Nota: El código usa 'transactions' para items de venta y movimientos de stock.
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    sale_id UUID REFERENCES public.sales(id), -- Opcional, solo para ventas
    user_id UUID REFERENCES public.profiles(id),
    type TEXT NOT NULL, -- 'SALE', 'ENTRY', 'TRANSFER'
    quantity INTEGER NOT NULL, -- Cantidad en cajas (o unidades base según lógica)
    amount NUMERIC DEFAULT 0, -- Monto total de la línea (para ventas)
    details JSONB DEFAULT '{}'::jsonb, -- Detalles extra: location, origin, destination
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Función RPC: get_branch_inventory
-- Utilizada en Sales.jsx y StockEntry.jsx
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

-- Función RPC: process_sale
-- Utilizada en Sales.jsx
-- Nota: Esta es una estructura sugerida, la implementación real depende de la lógica de negocio exacta.
CREATE OR REPLACE FUNCTION public.process_sale(
    p_branch_id UUID,
    p_items JSONB, -- Array de objetos { product_id, quantity, price }
    p_total NUMERIC
)
RETURNS VOID AS $$
DECLARE
    item JSONB;
    v_sale_id UUID;
    v_user_id UUID; -- Asumimos que se obtiene del contexto de la sesión o se pasa como parámetro
BEGIN
    -- Obtener usuario actual (requiere configuración de auth en Supabase)
    v_user_id := auth.uid();

    -- Crear venta
    INSERT INTO public.sales (branch_id, user_id, total_amount)
    VALUES (p_branch_id, v_user_id, p_total)
    RETURNING id INTO v_sale_id;

    -- Procesar items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Registrar transacción
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

        -- Actualizar stock (simple, sin manejo de ubicaciones específicas aquí por brevedad)
        UPDATE public.inventory
        SET stock_current = stock_current - (item->>'quantity')::INTEGER
        WHERE branch_id = p_branch_id AND product_id = (item->>'product_id')::UUID;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función RPC: add_stock
-- Utilizada en StockEntry.jsx
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

    -- Actualizar inventario
    UPDATE public.inventory
    SET stock_current = stock_current + p_quantity,
        location_code = p_locations
    WHERE branch_id = p_branch_id AND product_id = p_product_id;

    -- Registrar transacción
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

-- Función RPC: transfer_stock
-- Utilizada en StockEntry.jsx
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

    -- Actualizar inventario (locations)
    -- El stock total no cambia en un traslado interno, solo las ubicaciones
    UPDATE public.inventory
    SET location_code = p_new_locations
    WHERE branch_id = p_branch_id AND product_id = p_product_id;

    -- Registrar transacción
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
