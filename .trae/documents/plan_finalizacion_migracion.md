# Plan de Finalización de Migración y Funcionalidad

El objetivo es completar la migración a Supabase y asegurar que toda la funcionalidad crítica (sucursales, croquis, empleados, inventario) opere correctamente en el nuevo backend.

## 1. Completar Script de Migración (Prioridad Alta)
El script `scripts/migrate_firebase_to_supabase.js` tiene secciones incompletas que impiden la migración de sucursales y sus configuraciones (croquis).

*   **Migrar Sucursales:** Implementar la lógica dentro del bucle de sucursales para insertar en `public.branches`. Mapear el campo `layouts` de Firebase al campo `settings` (JSONB) de Supabase.
*   **Asegurar Mapeo de IDs:** Garantizar que el `branchMap` se llene correctamente para que los productos y empleados se asocien a la sucursal correcta.

## 2. Actualizar Páginas para Usar Supabase
Varias páginas aún dependen de Firebase o tienen nombres de columnas incorrectos.

### 2.1. Gestión de Croquis (`BranchLayoutConfig.jsx`)
*   **Lectura:** Cambiar `getDoc(doc(db, "branches", id))` por `supabase.from('branches').select('*').eq('id', id)`.
*   **Escritura:** Cambiar `updateDoc` por `supabase.from('branches').update({ settings: { layouts: ... } })`.
*   **Adaptación de Datos:** Asegurar que la estructura `layouts` se lea y guarde dentro de la columna `settings` JSONB.

### 2.2. Listado de Inventario (`InventoryList.jsx`)
*   **Corrección de Columna:** Cambiar `location_code` por `locations` en la consulta `select` y en el `update`.
*   **Manejo de JSON:** Asegurar que el campo `locations` (JSONB) se maneje directamente como objeto, eliminando `tryParseJSON` si Supabase ya devuelve el objeto parseado.

### 2.3. Gestión de Empleados (`EmployeeManager.jsx`)
*   **Migración Completa:** Reescribir todo el componente para eliminar dependencias de `firebase/auth` y `firebase/firestore`.
*   **Creación de Usuarios:** Implementar una *Edge Function* o usar el cliente de Supabase (si se tienen permisos de admin en el cliente, aunque lo ideal es una función segura) para crear usuarios (`supabase.auth.signUp` o `admin.createUser`). *Nota: Por simplicidad en esta fase, usaremos la creación directa si el usuario admin tiene permisos, o simularemos la creación de perfil.*
*   **Gestión de Perfiles:** CRUD directo sobre la tabla `public.profiles`.

### 2.4. Agregar Producto (`AddProduct.jsx`)
*   **Subida de Imágenes:** Cambiar `firebase/storage` por `supabase.storage`.
*   **Guardado:** Cambiar `addDoc/updateDoc` por `supabase.from('products').insert/update` y `supabase.from('inventory').insert/update`.

## 3. Verificación y Limpieza
*   Ejecutar el script de migración completo.
*   Probar el flujo de usuario: Login -> Selección de Sucursal -> Ver Inventario -> Editar Croquis -> Agregar Producto.
*   Eliminar código muerto de Firebase (`src/config/firebase.js` y referencias).

## Paso a Paso de Ejecución

1.  **Corregir Script:** Completar la sección de migración de sucursales en `migrate_firebase_to_supabase.js`.
2.  **Ejecutar Migración:** Correr el script nuevamente para poblar Supabase.
3.  **Refactorizar `BranchLayoutConfig.jsx`:** Cambiar a Supabase.
4.  **Refactorizar `InventoryList.jsx`:** Corregir `location_code` -> `locations`.
5.  **Refactorizar `AddProduct.jsx`:** Cambiar almacenamiento e inserción a Supabase.
6.  **Refactorizar `EmployeeManager.jsx`:** Cambiar gestión de usuarios a Supabase.
