# Estructura de Imágenes

Todas las imágenes estáticas del proyecto viven aquí bajo `public/img/`.

```
public/img/
├── brand/              → Logos y activos de marca
│   ├── logo-sistema.png        Logo principal del sistema de inventario
│   ├── logo-dechy.png          Logo Dechy (favicon, PWA, SEO)
│   └── logo-horizontal.jpg     Logo horizontal para encabezados
│
├── sistema/            → Imágenes del sistema de administración/inventario
│   └── iconos/                 Íconos de métodos de pago
│       ├── efectivo.png
│       ├── pos.png
│       ├── transferencia.png
│       └── yape.png
│
├── tienda/             → Imágenes de la tienda virtual (e-commerce)
│   └── productos/              Fotos de productos (agrega aquí las imágenes)
│
└── landing/            → Imágenes de la landing page
    ├── carousel/               Slides del hero carousel (1440×560 px, max 300 KB)
    │   ├── slide1.jpg
    │   ├── slide2.png
    │   └── slide3.jpg
    └── banners/                Banners promocionales
        ├── hero/               Banner de hero completo (1200×400 px)
        │   ├── banner1.jpg
        │   ├── banner2.png
        │   └── banner3.jpg
        ├── promo/              Banner de promoción (800×400 px)
        │   ├── promo1.jpg
        │   ├── promo2.png
        │   └── promo3.jpg
        └── split/              Banner dividido (600×400 px)
            ├── split1.jpg
            ├── split2.png
            └── split3.jpg
```

## Dónde referenciar imágenes en el código

Usa rutas absolutas desde la raíz `/`:

```jsx
// Ejemplos
src = "/img/brand/logo-sistema.png";
src = "/img/sistema/iconos/efectivo.png";
src = "/img/landing/carousel/slide1.jpg";
src = "/img/tienda/productos/mi-producto.jpg";
```
