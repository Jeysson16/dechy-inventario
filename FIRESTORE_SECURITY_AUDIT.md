# Auditoría de reglas Firestore — integración SUNAT

## Modelo fiscal protegido

- `settings/sunat`: RUC, razón social, dirección, ubigeo, establecimiento, series y ambiente. Solo administradores en el cliente.
- `privateSettings/sunat`: Usuario SOL, Clave SOL, PFX y contraseña dentro de un bloque AES-256-GCM. Acceso cliente denegado; solo Firebase Admin SDK.
- `fiscalCounters/{ruc_series}`: último correlativo reservado por serie. Acceso cliente denegado; solo transacciones del backend.
- `sunatOutbox/{sale_document}`: XML enviado, endpoint y CDR para auditoría. Acceso cliente denegado; el frontend lo recibe por un endpoint autenticado cuando corresponde.
- `purchases/{id}`: comprobantes recibidos de proveedores para Registro de Compras/SIRE. Lectura, creación y actualización para `admin`/`manager`; borrado denegado.

## Hallazgo corregido

`isAdmin()` trataba como administrador a cualquier usuario autenticado que no tuviera documento en `employees`. Esto permitía leer y modificar `settings` antes de crear un perfil. Ahora el rol solo existe cuando el documento de empleado existe y declara `role == 'admin'`.

## Pruebas adversariales consideradas

1. Un usuario autenticado sin perfil intenta leer `settings/sunat`: denegado.
2. Un empleado o administrador intenta leer directamente `privateSettings/sunat`: denegado para todos los clientes.
3. Un usuario intenta escoger su propio correlativo escribiendo `fiscalCounters`: denegado.
4. Un usuario intenta reemplazar el XML o CDR en `sunatOutbox`: denegado.
5. Un empleado común intenta crear o editar una compra: denegado; solo `admin` y `manager`.
6. Un administrador intenta borrar una compra para ocultar trazabilidad: denegado.

## Riesgo pendiente fuera del alcance fiscal

La regla de compatibilidad de los módulos históricos todavía permite lectura/escritura autenticada en colecciones no fiscales. Debe migrarse colección por colección a reglas de mínimo privilegio antes de considerar toda la aplicación endurecida para producción.
