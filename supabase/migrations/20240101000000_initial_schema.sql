-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLAS PRINCIPALES
-- -----------------------------------------------------------------------------

-- TABLA: profiles (Extiende auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('admin', 'manager', 'employee', 'customer')) DEFAULT 'customer',
    branch_id UUID, -- Se llenará si es empleado de una sucursal específica
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: branches (Sucursales)
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    image_url TEXT,
    primary_color TEXT,
    settings JSONB DEFAULT '{}'::JSONB, -- Para guardar layouts, configuraciones visuales, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: categories (Categorías de productos)
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: products (Catálogo Global)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price_unit DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Precio venta público
    price_box DECIMAL(10, 2) DEFAULT 0, -- Precio caja
    units_per_box INT DEFAULT 1,
    image_url TEXT,
    dimensions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: inventory (Stock por Sucursal)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    stock_current INT DEFAULT 0 CHECK (stock_current >= 0),
    stock_min INT DEFAULT 5,
    locations JSONB DEFAULT '{}'::JSONB, -- Mapa de ubicaciones: {"A-1": 10, "B-2": 5}
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, product_id) -- Un producto solo puede tener un registro de inventario por sucursal
);

-- TABLA: sales (Cabecera de Ventas ERP)
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Vendedor
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: transactions (Historial de movimientos / Detalle de Venta)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('SALE', 'ENTRY', 'TRANSFER', 'ADJUSTMENT')) NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE, -- Link a la venta padre
    quantity INT NOT NULL, -- Positivo para entradas, Negativo para salidas (aunque se puede manejar absoluto y usar type)
    amount DECIMAL(10, 2), -- Monto total de la transacción si aplica
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    related_transaction_id UUID REFERENCES public.transactions(id), -- Para transferencias (salida de A -> entrada en B)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: orders (Para E-commerce futuro - Separado de Sales ERP por ahora, o unificable)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')) DEFAULT 'pending',
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    shipping_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: order_items (Items de la orden)
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS (Ejemplos básicos, ajustar según necesidad estricta)

-- PROFILES:
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins/Managers view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PRODUCTS & CATEGORIES:
CREATE POLICY "Public view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin/Manager manage products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- INVENTORY:
CREATE POLICY "Public view inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Staff manage inventory" ON public.inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
);

-- SALES:
CREATE POLICY "Staff view sales" ON public.sales FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
);
CREATE POLICY "Staff create sales" ON public.sales FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
);

-- TRANSACTIONS:
CREATE POLICY "Staff view transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
);
CREATE POLICY "Staff create transactions" ON public.transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
);

-- -----------------------------------------------------------------------------
-- 3. STORED PROCEDURES (RPCs)
-- -----------------------------------------------------------------------------

-- TRIGGER: Crear perfil automáticamente al registrarse en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'customer') 
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- RPC: Obtener inventario completo de una sucursal con detalles de producto
CREATE OR REPLACE FUNCTION get_branch_inventory(p_branch_id UUID)
RETURNS TABLE (
  inventory_id UUID,
  product_id UUID,
  product_name TEXT,
  sku TEXT,
  image_url TEXT,
  stock_current INT,
  stock_min INT,
  price_unit DECIMAL,
  category_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    p.id,
    p.name,
    p.sku,
    p.image_url,
    i.stock_current,
    i.stock_min,
    p.price_unit,
    c.name
  FROM public.inventory i
  JOIN public.products p ON i.product_id = p.id
  LEFT JOIN public.categories c ON p.category_id = c.id
  WHERE i.branch_id = p_branch_id;
END;
$$ LANGUAGE plpgsql;


-- RPC: Procesar Venta (Atomicidad: Crea Venta + Transacciones + Descuenta Stock)
CREATE OR REPLACE FUNCTION process_sale(
  p_branch_id UUID,
  p_items JSONB, -- Array de objetos: [{product_id, quantity, price}]
  p_total DECIMAL
)
RETURNS UUID -- Retorna ID de la venta
AS $$
DECLARE
  item JSONB;
  prod_id UUID;
  qty INT;
  current_stock INT;
  new_sale_id UUID;
BEGIN
  -- 1. Crear Venta Header
  INSERT INTO public.sales (branch_id, user_id, total_amount)
  VALUES (p_branch_id, auth.uid(), p_total)
  RETURNING id INTO new_sale_id;

  -- 2. Iterar sobre los items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    prod_id := (item->>'product_id')::UUID;
    qty := (item->>'quantity')::INT;

    -- Verificar stock
    SELECT stock_current INTO current_stock FROM public.inventory 
    WHERE branch_id = p_branch_id AND product_id = prod_id;

    IF current_stock IS NULL OR current_stock < qty THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', prod_id;
    END IF;

    -- Descontar stock
    UPDATE public.inventory
    SET stock_current = stock_current - qty,
        last_updated = NOW()
    WHERE branch_id = p_branch_id AND product_id = prod_id;

    -- Registrar transacción individual
    INSERT INTO public.transactions (type, branch_id, product_id, sale_id, quantity, amount, performed_by)
    VALUES ('SALE', p_branch_id, prod_id, new_sale_id, qty, (item->>'price')::DECIMAL * qty, auth.uid());
    
  END LOOP;

  RETURN new_sale_id; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 4. STORAGE (Buckets)
-- -----------------------------------------------------------------------------

-- Crear bucket 'avatars' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket 'products' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket 'branches' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('branches', 'branches', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public Access Products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Staff Upload Products" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'products' 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Public Access Branches" ON storage.objects FOR SELECT USING (bucket_id = 'branches');
CREATE POLICY "Admin Upload Branches" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'branches' 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
