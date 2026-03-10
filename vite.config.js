import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Escucha en todas las interfaces de red (0.0.0.0)
    port: 5173,
    hmr: {
      overlay: false, // Deshabilita el overlay de errores si es molesto, pero mantiene HMR
    }
  }
})
