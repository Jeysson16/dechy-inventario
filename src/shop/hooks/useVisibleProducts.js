import { useMemo } from "react";
import { useBranchCatalogProducts } from "../../hooks/useBranchCatalogProducts";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const useVisibleProducts = (branchId) => {
  const { products, loading } = useBranchCatalogProducts(branchId);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((product) => {
      const value = normalize(product.category);
      if (value) set.add(product.category);
    });
    return Array.from(set);
  }, [products]);

  return { products, categories, loading, normalize };
};
