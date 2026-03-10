# Guía de Migración de Firebase a Supabase

Esta guía te ayudará a migrar tu base de datos y autenticación de Firebase a Supabase.

## 1. Configuración de Supabase

1.  Crea un nuevo proyecto en [Supabase](https://supabase.com/).
2.  Ve al **SQL Editor** en el dashboard de Supabase.
3.  Copia y pega el contenido del archivo `supabase_schema.sql` (ubicado en la raíz de este proyecto) y ejecútalo. Esto creará las tablas, políticas de seguridad y funciones necesarias.

## 2. Preparación para la Migración de Datos

Necesitamos ejecutar un script localmente para mover los datos.

### Requisitos Previos

1.  Asegúrate de tener Node.js instalado.
2.  Instala las dependencias del script de migración:
    ```bash
    npm install firebase-admin @supabase/supabase-js dotenv
    ```
3.  **Credenciales de Firebase**:
    -   Ve a la Consola de Firebase -> Configuración del Proyecto -> Cuentas de servicio.
    -   Genera una nueva clave privada.
    -   Descarga el archivo JSON y guárdalo en la raíz de este proyecto con el nombre `serviceAccountKey.json`.
4.  **Credenciales de Supabase**:
    -   Crea un archivo `.env` en la raíz del proyecto (si no existe) y agrega:
        ```env
        SUPABASE_URL=https://tu-proyecto.supabase.co
        SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
        ```
    -   *Nota*: La `SERVICE_ROLE_KEY` se encuentra en Project Settings -> API -> service_role secret. **Nunca compartas esta clave ni la uses en el frontend.**

## 3. Ejecutar la Migración

Ejecuta el script:

```bash
node scripts/migrate_firebase_to_supabase.js
```

El script migrará:
-   Sucursales
-   Categorías
-   Usuarios (Creará las cuentas en Supabase Auth y los perfiles en `public.profiles`. Los usuarios deberán restablecer su contraseña).
-   Productos e Inventario
-   Transacciones (últimas 500 para evitar sobrecarga, puedes ajustar el límite en el script).

## 4. Configuración del Frontend

1.  Instala el cliente de Supabase en tu proyecto React:
    ```bash
    npm install @supabase/supabase-js
    ```
2.  Crea/Actualiza `src/config/supabaseClient.js` con tu `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## 5. Notas Importantes

-   **Usuarios**: Las contraseñas no se pueden migrar. Los usuarios existentes deberán usar la opción "Olvidé mi contraseña" en el nuevo sistema o recibir un correo de invitación.
-   **Storage**: El script de migración de datos NO migra automáticamente los archivos de Storage (imágenes). Deberás subir las imágenes a un bucket 'images' en Supabase y actualizar las URLs, o hacerlo manualmente si son pocas.
