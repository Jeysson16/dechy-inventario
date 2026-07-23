import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/sunat": {
        target: "https://dechy-inventario-backend.vercel.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
