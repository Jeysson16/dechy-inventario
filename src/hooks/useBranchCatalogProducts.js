import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, productCatalogDb } from "../config/firebase";
import { decorateCatalogProduct } from "../utils/catalogProduct";

export const useBranchCatalogProducts = (branchId) => {
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [branchLinks, setBranchLinks] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(Boolean(branchId));

  useEffect(() => {
    const productsQuery = query(
      collection(productCatalogDb, "products"),
      orderBy("name"),
    );

    return onSnapshot(
      productsQuery,
      (snapshot) => {
        setCatalogProducts(
          snapshot.docs
            .map((productDoc) => ({
              id: productDoc.id,
              ...productDoc.data(),
            }))
            .filter((product) => product.visible !== false),
        );
        setCatalogLoading(false);
      },
      (error) => {
        console.error("Error loading Inventory catalog:", error);
        setCatalogProducts([]);
        setCatalogLoading(false);
      },
    );
  }, []);

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
          snapshot.docs.map((linkDoc) => ({
            id: linkDoc.id,
            ...linkDoc.data(),
          })),
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

    return catalogProducts
      .map((product) =>
        decorateCatalogProduct(product, linksByProduct.get(product.id)),
      )
      .filter((product) => product.branchCatalogEnabled);
  }, [catalogProducts, branchLinks]);

  return {
    products,
    loading: catalogLoading || linksLoading,
  };
};
