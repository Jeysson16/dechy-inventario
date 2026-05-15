/* ══════════════════════════════
   MOCK DATA – Sistema de Reportes Jieda
   ══════════════════════════════ */

// ── VENTAS ──
export const MOCK_PRODUCTOS_VENDIDOS = [
  {
    nombre: "Cielo Raso 60×60",
    categoria: "Cielo Raso",
    unidades: 342,
    ingresos: 15390,
  },
  {
    nombre: "Panel Acústico",
    categoria: "Paneles",
    unidades: 218,
    ingresos: 9810,
  },
  {
    nombre: "Porcelanato Blanco",
    categoria: "Pisos",
    unidades: 195,
    ingresos: 17550,
  },
  {
    nombre: "Perfil T 60",
    categoria: "Accesorios",
    unidades: 512,
    ingresos: 4608,
  },
  {
    nombre: "Perfil L 25",
    categoria: "Accesorios",
    unidades: 430,
    ingresos: 3870,
  },
  {
    nombre: "Cielo Raso 30×30",
    categoria: "Cielo Raso",
    unidades: 280,
    ingresos: 8400,
  },
  {
    nombre: "Panel 3D Wave",
    categoria: "Paneles",
    unidades: 165,
    ingresos: 11550,
  },
  {
    nombre: "Porcelanato Madera",
    categoria: "Pisos",
    unidades: 143,
    ingresos: 18590,
  },
  {
    nombre: "Esquinero Metálico",
    categoria: "Accesorios",
    unidades: 98,
    ingresos: 882,
  },
  {
    nombre: "Cielo Raso PVC",
    categoria: "Cielo Raso",
    unidades: 87,
    ingresos: 7830,
  },
];

export const MOCK_SIN_VENTAS = [
  {
    nombre: "Panel Bambú Ecológico",
    categoria: "Paneles",
    diasSinVenta: 45,
    stock: 23,
  },
  {
    nombre: "Porcelanato Mármol Negro",
    categoria: "Pisos",
    diasSinVenta: 38,
    stock: 12,
  },
  {
    nombre: "Perfil Omega 38",
    categoria: "Accesorios",
    diasSinVenta: 32,
    stock: 87,
  },
  {
    nombre: "Cielo Raso Artesanal",
    categoria: "Cielo Raso",
    diasSinVenta: 28,
    stock: 8,
  },
  {
    nombre: "Panel Vinílico Madera",
    categoria: "Paneles",
    diasSinVenta: 21,
    stock: 34,
  },
];

export const MOCK_GANANCIAS = [
  { fecha: "Lun", hoy: 4200, anterior: 3800 },
  { fecha: "Mar", hoy: 5100, anterior: 4600 },
  { fecha: "Mié", hoy: 3900, anterior: 4200 },
  { fecha: "Jue", hoy: 6300, anterior: 5100 },
  { fecha: "Vie", hoy: 7800, anterior: 6900 },
  { fecha: "Sáb", hoy: 9200, anterior: 8100 },
  { fecha: "Dom", hoy: 4500, anterior: 3200 },
];

export const MOCK_DEVOLUCIONES = [
  {
    id: "DEV-001",
    producto: "Cielo Raso 60×60",
    motivo: "Defecto de fábrica",
    monto: 450,
    fecha: "14/05/2026",
    estado: "Procesada",
  },
  {
    id: "DEV-002",
    producto: "Porcelanato Blanco",
    motivo: "Daño en transporte",
    monto: 280,
    fecha: "13/05/2026",
    estado: "Pendiente",
  },
  {
    id: "DEV-003",
    producto: "Panel Acústico",
    motivo: "Pedido incorrecto",
    monto: 180,
    fecha: "12/05/2026",
    estado: "Procesada",
  },
  {
    id: "DEV-004",
    producto: "Perfil T 60",
    motivo: "Defecto de fábrica",
    monto: 90,
    fecha: "11/05/2026",
    estado: "Rechazada",
  },
  {
    id: "DEV-005",
    producto: "Cielo Raso PVC",
    motivo: "Daño en transporte",
    monto: 310,
    fecha: "10/05/2026",
    estado: "Procesada",
  },
];

export const MOCK_MOTIVOS_DEV = [
  { motivo: "Defecto fábrica", cantidad: 14 },
  { motivo: "Daño transporte", cantidad: 8 },
  { motivo: "Pedido incorrecto", cantidad: 6 },
  { motivo: "Insatisfacción", cantidad: 3 },
  { motivo: "Otro", cantidad: 2 },
];

// ── INVENTARIO ──
export const MOCK_STOCK = [
  {
    nombre: "Cielo Raso 60×60",
    categoria: "Cielo Raso",
    stockActual: 145,
    stockMinimo: 50,
    estado: "ok",
  },
  {
    nombre: "Panel Acústico",
    categoria: "Paneles",
    stockActual: 32,
    stockMinimo: 40,
    estado: "critico",
  },
  {
    nombre: "Porcelanato Blanco",
    categoria: "Pisos",
    stockActual: 58,
    stockMinimo: 30,
    estado: "ok",
  },
  {
    nombre: "Perfil T 60",
    categoria: "Accesorios",
    stockActual: 18,
    stockMinimo: 20,
    estado: "alerta",
  },
  {
    nombre: "Perfil L 25",
    categoria: "Accesorios",
    stockActual: 95,
    stockMinimo: 25,
    estado: "ok",
  },
  {
    nombre: "Panel 3D Wave",
    categoria: "Paneles",
    stockActual: 7,
    stockMinimo: 15,
    estado: "critico",
  },
  {
    nombre: "Porcelanato Madera",
    categoria: "Pisos",
    stockActual: 42,
    stockMinimo: 20,
    estado: "ok",
  },
  {
    nombre: "Cielo Raso PVC",
    categoria: "Cielo Raso",
    stockActual: 22,
    stockMinimo: 25,
    estado: "alerta",
  },
];

export const MOCK_MOVIMIENTOS = [
  { periodo: "Sem 1", entradas: 420, salidas: 380 },
  { periodo: "Sem 2", entradas: 350, salidas: 410 },
  { periodo: "Sem 3", entradas: 580, salidas: 320 },
  { periodo: "Sem 4", entradas: 290, salidas: 450 },
  { periodo: "Sem 5", entradas: 640, salidas: 390 },
  { periodo: "Sem 6", entradas: 380, salidas: 420 },
];

export const MOCK_MERMAS = [
  { name: "Dañado", value: 34, valor: 1530 },
  { name: "Caducado", value: 12, valor: 840 },
  { name: "Robo/pérdida", value: 8, valor: 560 },
  { name: "Error proceso", value: 6, valor: 270 },
];

export const MOCK_VENCIMIENTOS = [
  {
    producto: "Adhesivo Cerámico",
    lote: "LC-2024-A",
    diasRestantes: 8,
    cantidad: 24,
    unidad: "bolsas",
  },
  {
    producto: "Sellador Acrílico",
    lote: "SA-2024-B",
    diasRestantes: 15,
    cantidad: 12,
    unidad: "unid.",
  },
  {
    producto: "Impermeabilizante",
    lote: "IMP-2024",
    diasRestantes: 22,
    cantidad: 8,
    unidad: "galones",
  },
  {
    producto: "Pintura Base",
    lote: "PB-2024-C",
    diasRestantes: 30,
    cantidad: 18,
    unidad: "galones",
  },
];

// ── ALMACENES ──
export const MOCK_ALMACENES = [
  {
    id: "A1",
    nombre: "Almacén Principal",
    ciudad: "Trujillo Centro",
    productos: 284,
    capacidad: 400,
    ocupacion: 71,
    color: "#00d4ff",
  },
  {
    id: "A2",
    nombre: "Almacén Norte",
    ciudad: "Trujillo Norte",
    productos: 156,
    capacidad: 250,
    ocupacion: 62,
    color: "#00ff9d",
  },
  {
    id: "A3",
    nombre: "Almacén Sur",
    ciudad: "La Esperanza",
    productos: 98,
    capacidad: 200,
    ocupacion: 49,
    color: "#f59e0b",
  },
  {
    id: "A4",
    nombre: "Almacén Express",
    ciudad: "El Porvenir",
    productos: 45,
    capacidad: 100,
    ocupacion: 45,
    color: "#a78bfa",
  },
];

export const MOCK_TRANSFERENCIAS = [
  {
    id: "TRF-001",
    origen: "Principal",
    destino: "Norte",
    producto: "Cielo Raso 60×60",
    cantidad: 50,
    estado: "completado",
    fecha: "14/05/2026",
  },
  {
    id: "TRF-002",
    origen: "Norte",
    destino: "Sur",
    producto: "Perfil T 60",
    cantidad: 80,
    estado: "en-transito",
    fecha: "15/05/2026",
  },
  {
    id: "TRF-003",
    origen: "Principal",
    destino: "Express",
    producto: "Panel Acústico",
    cantidad: 20,
    estado: "pendiente",
    fecha: "15/05/2026",
  },
  {
    id: "TRF-004",
    origen: "Sur",
    destino: "Principal",
    producto: "Porcelanato Blanco",
    cantidad: 30,
    estado: "completado",
    fecha: "13/05/2026",
  },
  {
    id: "TRF-005",
    origen: "Express",
    destino: "Norte",
    producto: "Perfil L 25",
    cantidad: 45,
    estado: "pendiente",
    fecha: "15/05/2026",
  },
];

// ── COMPRAS ──
export const MOCK_ORDENES = [
  {
    id: "OC-2026-041",
    proveedor: "Materiales Andinos SAC",
    monto: 12400,
    estado: "recibido",
    fecha: "10/05/2026",
    items: 8,
  },
  {
    id: "OC-2026-042",
    proveedor: "Distribuidora Lima Norte",
    monto: 8750,
    estado: "en-transito",
    fecha: "12/05/2026",
    items: 5,
  },
  {
    id: "OC-2026-043",
    proveedor: "Importaciones García",
    monto: 21300,
    estado: "pendiente",
    fecha: "14/05/2026",
    items: 12,
  },
  {
    id: "OC-2026-044",
    proveedor: "Cerámicas del Norte",
    monto: 5600,
    estado: "recibido",
    fecha: "08/05/2026",
    items: 3,
  },
  {
    id: "OC-2026-045",
    proveedor: "Aluminio Perú SAC",
    monto: 3200,
    estado: "cancelado",
    fecha: "09/05/2026",
    items: 2,
  },
];

export const MOCK_PROVEEDORES = [
  {
    nombre: "Materiales Andinos SAC",
    volumen: 48200,
    tiempoEntrega: 3,
    rating: 4.8,
    ordenes: 12,
  },
  {
    nombre: "Distribuidora Lima Norte",
    volumen: 31500,
    tiempoEntrega: 5,
    rating: 4.2,
    ordenes: 8,
  },
  {
    nombre: "Importaciones García",
    volumen: 28900,
    tiempoEntrega: 7,
    rating: 3.9,
    ordenes: 6,
  },
  {
    nombre: "Cerámicas del Norte",
    volumen: 19400,
    tiempoEntrega: 4,
    rating: 4.5,
    ordenes: 9,
  },
  {
    nombre: "Aluminio Perú SAC",
    volumen: 12800,
    tiempoEntrega: 2,
    rating: 4.7,
    ordenes: 5,
  },
];

export const MOCK_COSTOS_PRECIOS = [
  { producto: "Cielo Raso 60×60", costo: 28, precio: 45, margen: 37.8 },
  { producto: "Panel Acústico", costo: 32, precio: 45, margen: 28.9 },
  { producto: "Porcelanato Blanco", costo: 55, precio: 90, margen: 38.9 },
  { producto: "Perfil T 60", costo: 6, precio: 9, margen: 33.3 },
  { producto: "Panel 3D Wave", costo: 48, precio: 70, margen: 31.4 },
  { producto: "Porcelanato Madera", costo: 82, precio: 130, margen: 36.9 },
];

// ── CLIENTES ──
export const MOCK_CLIENTES = [
  {
    nombre: "Constructora Horizonte SAC",
    compras: 28,
    monto: 42800,
    inicial: "CH",
    color: "#00d4ff",
  },
  {
    nombre: "Grupo Inmobiliario Norte",
    compras: 24,
    monto: 38500,
    inicial: "GI",
    color: "#00ff9d",
  },
  {
    nombre: "Ferretería El Constructor",
    compras: 19,
    monto: 21400,
    inicial: "FE",
    color: "#f59e0b",
  },
  {
    nombre: "Arq. Juan Rodríguez",
    compras: 16,
    monto: 18900,
    inicial: "JR",
    color: "#a78bfa",
  },
  {
    nombre: "Decoraciones Premium",
    compras: 14,
    monto: 15600,
    inicial: "DP",
    color: "#f472b6",
  },
  {
    nombre: "Ing. María Castillo",
    compras: 12,
    monto: 14200,
    inicial: "MC",
    color: "#34d399",
  },
  {
    nombre: "Multiservicios Andino",
    compras: 11,
    monto: 12800,
    inicial: "MA",
    color: "#60a5fa",
  },
  {
    nombre: "Ferremax Trujillo",
    compras: 9,
    monto: 11200,
    inicial: "FT",
    color: "#fb923c",
  },
  {
    nombre: "Construcciones Rápidas",
    compras: 8,
    monto: 9800,
    inicial: "CR",
    color: "#e879f9",
  },
  {
    nombre: "Estudio Arq. Pérez",
    compras: 7,
    monto: 8400,
    inicial: "EP",
    color: "#2dd4bf",
  },
];

export const MOCK_TIMELINE_PRODUCTOS = [
  {
    nombre: "Cielo Raso Nano-Acústico",
    tipo: "nuevo",
    fecha: "Mar 2026",
    categoria: "Cielo Raso",
  },
  {
    nombre: "Panel Bambú Ecológico",
    tipo: "nuevo",
    fecha: "Feb 2026",
    categoria: "Paneles",
  },
  {
    nombre: "Perfil Decorativo Gold",
    tipo: "nuevo",
    fecha: "Ene 2026",
    categoria: "Accesorios",
  },
  {
    nombre: "Porcelanato Mármol Vintage",
    tipo: "discontinuado",
    fecha: "Dic 2025",
    categoria: "Pisos",
  },
  {
    nombre: "Panel Poliestireno Clásico",
    tipo: "discontinuado",
    fecha: "Nov 2025",
    categoria: "Paneles",
  },
  {
    nombre: "Cielo Raso Fibra Natural",
    tipo: "nuevo",
    fecha: "Oct 2025",
    categoria: "Cielo Raso",
  },
];

// ── DASHBOARD EJECUTIVO ──
export const MOCK_KPIS = {
  ventasMes: 148200,
  stockCritico: 7,
  productosAgotados: 3,
  utilidadBruta: 52800,
  rotacion: 73,
  ordenesActivas: 12,
  clientesNuevos: 24,
  devolucionesMes: 18,
};

export const SPARK_VENTAS = [
  3200, 4100, 3800, 5200, 6100, 4800, 7200, 6900, 8100, 7400, 9200, 8800,
];
export const SPARK_STOCK = [82, 78, 75, 71, 68, 65, 63, 60, 58, 55, 53, 50];
export const SPARK_UTILIDAD = [
  1800, 2100, 1950, 2400, 2800, 2300, 3100, 2900, 3400, 3200, 3800, 3600,
];
export const SPARK_ROTACION = [65, 67, 70, 68, 72, 71, 73, 75, 74, 73, 76, 73];

export const MOCK_ALERTAS = [
  {
    id: 1,
    tipo: "critico",
    msg: "Panel Acústico: stock bajo mínimo (32 unid.)",
    modulo: "Inventario",
    tiempo: "10 min",
  },
  {
    id: 2,
    tipo: "critico",
    msg: "Panel 3D Wave: stock crítico (7 unid.)",
    modulo: "Inventario",
    tiempo: "25 min",
  },
  {
    id: 3,
    tipo: "alerta",
    msg: "Adhesivo Cerámico vence en 8 días (lote LC-2024-A)",
    modulo: "Inventario",
    tiempo: "1 h",
  },
  {
    id: 4,
    tipo: "alerta",
    msg: "Transferencia TRF-002 en tránsito sin confirmar",
    modulo: "Almacenes",
    tiempo: "2 h",
  },
  {
    id: 5,
    tipo: "info",
    msg: "OC-2026-043 pendiente de aprobación (S/ 21,300)",
    modulo: "Compras",
    tiempo: "3 h",
  },
  {
    id: 6,
    tipo: "info",
    msg: "5 devoluciones pendientes de procesar",
    modulo: "Ventas",
    tiempo: "4 h",
  },
];

// ── AUDITORÍA ──
export const MOCK_AUDIT_LOG = [
  {
    id: 1,
    usuario: "admin@jieda.pe",
    accion: "Modificó precio",
    modulo: "Inventario",
    campo: "Cielo Raso 60×60",
    anterior: "S/ 40.00",
    nuevo: "S/ 45.00",
    fecha: "15/05/2026 09:14",
  },
  {
    id: 2,
    usuario: "cajera@jieda.pe",
    accion: "Registró venta",
    modulo: "Ventas",
    campo: "Panel Acústico x5",
    anterior: "—",
    nuevo: "Venta #V-2026-841",
    fecha: "15/05/2026 09:02",
  },
  {
    id: 3,
    usuario: "admin@jieda.pe",
    accion: "Creó orden de compra",
    modulo: "Compras",
    campo: "OC-2026-043",
    anterior: "—",
    nuevo: "Pendiente",
    fecha: "14/05/2026 18:30",
  },
  {
    id: 4,
    usuario: "manager@jieda.pe",
    accion: "Aprobó transferencia",
    modulo: "Almacenes",
    campo: "TRF-002",
    anterior: "Pendiente",
    nuevo: "En tránsito",
    fecha: "14/05/2026 17:15",
  },
  {
    id: 5,
    usuario: "cajera@jieda.pe",
    accion: "Procesó devolución",
    modulo: "Ventas",
    campo: "DEV-001",
    anterior: "Pendiente",
    nuevo: "Procesada",
    fecha: "14/05/2026 15:48",
  },
  {
    id: 6,
    usuario: "admin@jieda.pe",
    accion: "Modificó stock mínimo",
    modulo: "Inventario",
    campo: "Panel 3D Wave",
    anterior: "10",
    nuevo: "15",
    fecha: "14/05/2026 12:20",
  },
  {
    id: 7,
    usuario: "manager@jieda.pe",
    accion: "Registró merma",
    modulo: "Inventario",
    campo: "Porcelanato Blanco x3",
    anterior: "—",
    nuevo: "Dañado",
    fecha: "14/05/2026 10:05",
  },
  {
    id: 8,
    usuario: "cajera@jieda.pe",
    accion: "Registró venta",
    modulo: "Ventas",
    campo: "Perfil T 60 x20",
    anterior: "—",
    nuevo: "Venta #V-2026-840",
    fecha: "14/05/2026 09:30",
  },
  {
    id: 9,
    usuario: "admin@jieda.pe",
    accion: "Actualizó proveedor",
    modulo: "Compras",
    campo: "Materiales Andinos SAC",
    anterior: "Activo",
    nuevo: "Preferencial",
    fecha: "13/05/2026 16:00",
  },
  {
    id: 10,
    usuario: "admin@jieda.pe",
    accion: "Añadió producto",
    modulo: "Inventario",
    campo: "Cielo Raso Nano-Acústico",
    anterior: "—",
    nuevo: "Stock: 50 unid.",
    fecha: "13/05/2026 11:45",
  },
];
