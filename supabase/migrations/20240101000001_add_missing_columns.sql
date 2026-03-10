-- 20240101000001_add_missing_columns.sql

-- 1. Actualizar PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo'));

-- 2. Actualizar PRODUCTS
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS length DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS width DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS height DECIMAL(10, 2);

-- 3. Actualizar TRANSACTIONS
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS quantity_boxes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_units INT DEFAULT 0;

-- 4. Actualizar RPC process_sale para manejar cajas y unidades (opcional, pero recomendado para mantener consistencia)
CREATE OR REPLACE FUNCTION process_sale(
  p_branch_id UUID,
  p_items JSONB, -- [{product_id, quantity, price, quantity_boxes, quantity_units}]
  p_total DECIMAL
)
RETURNS UUID
AS $$
DECLARE
  item JSONB;
  prod_id UUID;
  qty INT;
  qty_boxes INT;
  qty_units INT;
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
    qty := (item->>'quantity')::INT; -- Cantidad principal a descontar (generalmente cajas)
    qty_boxes := COALESCE((item->>'quantity_boxes')::INT, qty);
    qty_units := COALESCE((item->>'quantity_units')::INT, 0);

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
    INSERT INTO public.transactions (
        type, branch_id, product_id, sale_id, 
        quantity, quantity_boxes, quantity_units, 
        amount, performed_by
    )
    VALUES (
        'SALE', p_branch_id, prod_id, new_sale_id, 
        qty, qty_boxes, qty_units, 
        (item->>'price')::DECIMAL * qty, auth.uid()
    );
    
  END LOOP;

  RETURN new_sale_id; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
