# Configuración de Notificaciones Push

## Requisitos Previos

### 1. Configurar VAPID Key en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** > **Cloud Messaging**
4. En la sección **Web Push certificates**, genera un nuevo par de claves
5. Copia la **Server key** (VAPID key)

### 2. Actualizar la configuración

En `src/config/firebase.js`, reemplaza `'YOUR_VAPID_KEY_HERE'` con tu VAPID key real:

```javascript
const token = await getToken(messaging, {
  vapidKey: 'TU_VAPID_KEY_AQUI'
});
```

### 3. Archivo de Audio de Notificación

Coloca un archivo de audio llamado `notification.mp3` en la carpeta `public/`. 
Puedes descargar sonidos gratuitos de:
- [Freesound.org](https://freesound.org/)
- [Zapsplat.com](https://www.zapsplat.com/)
- [Notification Sounds](https://notificationsounds.com/)

### 4. Iconos para Notificaciones

Agrega iconos de notificación en `public/`:
- `icon-192x192.png` (192x192px)
- `icon-512x512.png` (512x512px)

## Funcionamiento

Cuando se genera una nueva venta:

1. **Notificación Local**: Se muestra en el dispositivo actual con sonido
2. **Notificación Push**: Se envía a todos los dispositivos conectados y activos
3. **Persistencia**: Las notificaciones se guardan en Firestore para historial
4. **Background**: Las notificaciones funcionan incluso cuando la app está en segundo plano

## Solución de Problemas

### Notificaciones no llegan
- Verifica que el VAPID key esté configurado correctamente
- Asegúrate de que el service worker esté registrado
- Revisa la consola del navegador para errores

### Audio no se reproduce
- El navegador puede bloquear la reproducción automática
- El archivo `notification.mp3` debe existir en `public/`
- Verifica que el volumen no esté en 0

### Service Worker no se registra
- Asegúrate de que el archivo `firebase-messaging-sw.js` esté en `public/`
- Verifica que no haya errores en la consola