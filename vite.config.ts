import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Порт из окружения (preview-панель назначает свой), иначе дефолт Vite.
    port: Number(process.env.PORT) || 5173,
  },
})
