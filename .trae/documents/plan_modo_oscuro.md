# Plan para implementar Modo Oscuro/Claro

El objetivo es permitir que cada usuario pueda alternar entre el modo oscuro y el modo claro en la aplicación. La preferencia se persistirá localmente para recordar la elección del usuario.

## Pasos de Implementación

1.  **Crear el Contexto de Tema (`ThemeContext`)**
    *   Crear un nuevo archivo `src/context/ThemeContext.jsx`.
    *   Implementar un `ThemeProvider` que gestione el estado del tema (`light` o `dark`).
    *   Utilizar `localStorage` para persistir la preferencia del usuario (clave: `inventory_theme`).
    *   Sincronizar el estado con la clase `dark` en el elemento `html` del documento.
    *   Exportar un hook `useTheme` para facilitar el acceso al contexto.

2.  **Integrar el Proveedor de Tema en la Aplicación**
    *   Modificar `src/App.jsx` para envolver la aplicación con `ThemeProvider`.
    *   Asegurarse de que el proveedor esté disponible tanto para las rutas protegidas como para el login (aunque el botón de cambio estará principalmente en el layout principal).

3.  **Añadir el Botón de Alternancia (Toggle) en el Layout Principal**
    *   Modificar `src/components/layout/AppLayout.jsx` para consumir `useTheme`.
    *   Añadir un botón en la barra lateral (sidebar) o en la cabecera (header) que permita cambiar el tema.
    *   Usar los iconos `light_mode` y `dark_mode` de Material Symbols para indicar el estado actual/acción.
    *   Estilar el botón para que se integre con el diseño existente.

4.  **Verificación**
    *   Probar el cambio de tema y verificar que se aplican las clases `dark` correctamente.
    *   Recargar la página para asegurar que la preferencia se mantiene.
