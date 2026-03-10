
-- Function to add inventory for a new product across all branches
CREATE OR REPLACE FUNCTION public.handle_new_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory (branch_id, product_id, stock_current, stock_min, locations)
  SELECT id, NEW.id, 0, 5, '{}'::jsonb
  FROM public.branches;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new products
DROP TRIGGER IF EXISTS on_product_created ON public.products;
CREATE TRIGGER on_product_created
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_new_product();

-- Function to populate inventory for a new branch with all existing products
CREATE OR REPLACE FUNCTION public.handle_new_branch()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory (branch_id, product_id, stock_current, stock_min, locations)
  SELECT NEW.id, id, 0, 5, '{}'::jsonb
  FROM public.products;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new branches
DROP TRIGGER IF EXISTS on_branch_created ON public.branches;
CREATE TRIGGER on_branch_created
AFTER INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.handle_new_branch();
