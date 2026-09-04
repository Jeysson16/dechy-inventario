import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { decorateCatalogProduct, isCatalogProductVisible } from "../utils/catalogProduct";

export const useBranchCatalogProducts = (branchId) => {
  const [baseProducts, setBaseProducts] = useState([]);
  const [branchLinks, setBranchLinks] = useState([]);
  const [productsLoading, setProductsLoading] = useState(Boolean(branchId));
  const [linksLoading, setLinksLoading] = useState(Boolean(branchId));

  useEffect(() => {
    if (!branchId) {
      setBaseProducts([]);
      setProductsLoading(false);
      return undefined;
    }

    setProductsLoading(true);
    const productsQuery = query(
      collection(db, "products"),
      where("branch", "==", branchId),
    );

    return onSnapshot(
      productsQuery,
      (snapshot) => {
        setBaseProducts(
          snapshot.docs
            .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
            .filter((product) => !product.catalogHidden),
        );
        setProductsLoading(false);
      },
      (error) => {
        console.error("Error loading Dechy products:", error);
        setBaseProducts([]);
        setProductsLoading(false);
      },
    );
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setBranchLinks([]);
      setLinksLoading(false);
      return undefined;
    }

    setLinksLoading(true);
    const linksQuery = query(
      collection(db, "branchCatalogProducts"),
      where("branchId", "==", branchId),
    );

    return onSnapshot(
      linksQuery,
      (snapshot) => {
        setBranchLinks(
          snapshot.docs.map((linkDoc) => ({ id: linkDoc.id, ...linkDoc.data() })),
        );
        setLinksLoading(false);
      },
      (error) => {
        console.error("Error loading Dechy catalog links:", error);
        setBranchLinks([]);
        setLinksLoading(false);
      },
    );
  }, [branchId]);

  const products = useMemo(() => {
    const linksByProduct = new Map(
      branchLinks.map((link) => [link.catalogProductId, link]),
    );

    return baseProducts
      .map((product) => decorateCatalogProduct(product, linksByProduct.get(product.id)))
      .filter(isCatalogProductVisible);
  }, [baseProducts, branchLinks]);

  return {
    products,
    loading: productsLoading || linksLoading,
  };
};
