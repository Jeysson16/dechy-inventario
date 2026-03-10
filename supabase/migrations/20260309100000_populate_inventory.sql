
-- Insert missing inventory records for all products in all branches
INSERT INTO public.inventory (branch_id, product_id, stock_current, stock_min, locations)
SELECT b.id, p.id, 0, 5, '{}'::jsonb
FROM public.branches b
CROSS JOIN public.products p
WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory i
    WHERE i.branch_id = b.id AND i.product_id = p.id
);
