# Plan de Migración de Firebase a Supabase (ERP + E-commerce)

Este plan detalla los pasos para migrar la aplicación de inventario actual de Firebase a Supabase, reestructurando la base de datos para soportar funcionalidades de ERP y un futuro E-commerce, siguiendo buenas prácticas de SQL y seguridad.

## Objetivos
1.  **Migración de Datos**: Mover usuarios, productos, sucursales y transacciones de Firestore a PostgreSQL (Supabase).
2.  **Diseño de Base de Datos**: Crear un esquema relacional robusto optimizado para ERP y E-commerce.
3.  **Lógica de Negocio en Base de Datos**: Implementar Stored Procedures (RPCs) para operaciones críticas.
4.  **Actualización del Frontend**: Reemplazar SDK de Firebase con Supabase Client.
5.  **Autenticación y Perfiles**: Soporte para empleados (con roles) y clientes (registro público), incluyendo fotos de perfil.
6.  **Almacenamiento**: Migrar imágenes a Supabase Storage.

## Paso 1: Diseño de Esquema de Base de Datos (PostgreSQL)

Diseñaremos las tablas en Supabase considerando la normalización y las necesidades futuras.

### Tablas Propuestas
-   **`profiles`**: Extensión de `auth.users`.
    -   `id` (UUID, PK, FK a auth.users)
    -   `email` (TEXT)
    -   `full_name` (TEXT)
    -   `avatar_url` (TEXT) - *Nuevo*
    -   `role` (ENUM: 'admin', 'manager', 'employee', 'customer')
    -   `branch_id` (UUID, FK a branches, nullable para clientes/admins globales)
    -   `created_at` (TIMESTAMPTZ)
-   **`branches`**: Sucursales físicas.
    -   `id` (UUID, PK)
    -   `name` (TEXT)
    -   `address` (TEXT)
    -   `image_url` (TEXT)
    -   `settings` (JSONB) - Para configuraciones como `layout` o `colors`.
-   **`categories`**: Categorías de productos.
    -   `id` (UUID, PK)
    -   `name` (TEXT)
    -   `slug` (TEXT)
-   **`products`**: Catálogo global de productos (E-commerce ready).
    -   `id` (UUID, PK)
    -   `sku` (TEXT, UNIQUE)
    -   `name` (TEXT)
    -   `description` (TEXT)
    -   `category_id` (UUID, FK)
    -   `price_unit` (DECIMAL) - Precio venta público
    -   `price_box` (DECIMAL) - Precio caja
    -   `units_per_box` (INT)
    -   `image_url` (TEXT)
    -   `dimensions` (TEXT)
    -   `is_active` (BOOLEAN)
-   **`inventory`**: Stock por sucursal.
    -   `id` (UUID, PK)
    -   `branch_id` (UUID, FK)
    -   `product_id` (UUID, FK)
    -   `stock_current` (INT)
    -   `stock_min` (INT)
    -   `location_code` (TEXT)
-   **`transactions`**: Historial de movimientos.
    -   `id` (UUID, PK)
    -   `type` (ENUM: 'sale', 'entry', 'transfer', 'adjustment')
    -   `branch_id` (UUID, FK)
    -   `product_id` (UUID, FK)
    -   `quantity` (INT)
    -   `performed_by` (UUID, FK a profiles)
    -   `created_at` (TIMESTAMPTZ)
-   **`orders`** (Futuro E-commerce):
    -   `id`, `customer_id`, `status`, `total`, `created_at`.

### Stored Procedures (RPCs)
Crearemos funciones SQL para encapsular la lógica y seguridad:
1.  `get_user_profile()`: Obtiene datos del usuario actual.
2.  `get_products_by_branch(branch_uuid)`: Obtiene productos con su stock específico.
3.  `process_sale(branch_uuid, items JSON)`: Procesa una venta, descuenta inventario y registra transacción atómicamente.
4.  `register_new_user(email, password, role, ...)`: Función segura para crear usuarios (si es necesario customizar).

## Paso 2: Script de Migración (Firebase -> Supabase)

Crearemos un script en Node.js para:
1.  Leer datos de Firestore (usando `firebase-admin`).
2.  Transformar los datos al nuevo esquema relacional.
3.  Insertar datos en Supabase usando `supabase-js`.
4.  Migrar archivos de Storage (descargar y subir a Supabase Storage).

*Nota: Como no tenemos acceso directo a las credenciales de servicio aquí, generaremos el script para que tú lo ejecutes localmente.*

## Paso 3: Configuración del Proyecto Frontend

1.  Instalar dependencias: `npm install @supabase/supabase-js`.
2.  Crear `src/config/supabaseClient.js`.
3.  Configurar variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Paso 4: Refactorización de Autenticación (`AuthContext`)

1.  Reemplazar métodos de Firebase Auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`) por sus equivalentes en Supabase.
2.  Implementar lógica para manejar la sesión y cargar el perfil desde la tabla `profiles`.
3.  Manejar la subida de fotos de perfil al registrarse o editar perfil.

## Paso 5: Implementación de Vistas y Lógica de Datos

1.  **Login/Registro**:
    -   Actualizar `Login.jsx`.
    -   Crear/Actualizar registro para clientes (público) y empleados (privado/admin).
2.  **Dashboard/Inventario**:
    -   Reemplazar `onSnapshot` de Firestore por `supabase.channel` (Realtime) o consultas estándar según necesidad.
    -   Usar los RPCs creados para obtener datos complejos.
3.  **Gestión de Empleados**:
    -   Actualizar CRUD de empleados para usar Supabase Auth Admin (o funciones seguras) y tabla `profiles`.

## Paso 6: Verificación y Pruebas

1.  Verificar flujo de registro y login (Cliente vs Empleado).
2.  Verificar integridad de datos migrados.
3.  Probar operaciones de inventario (Stock se descuenta correctamente).

