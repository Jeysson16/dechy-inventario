// Única ruta del ícono Dechy: vive en el repo del inventario (public/img/brand/icono/actual.png).
// Al reemplazar ese archivo cambia en el inventario y en el catálogo.
const INVENTORY_ORIGIN = import.meta.env.DEV
  ? String(import.meta.env.PUBLIC_INVENTORY_URL || 'http://localhost:5173').replace(/\/+$/, '')
  : 'https://dechy-inventario.vercel.app';

export const ICON_URL = `${INVENTORY_ORIGIN}/img/brand/icono/actual.png`;
