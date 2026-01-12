import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // ✅ Tilbake til rot for eget domene (www.helenesvelle.no)
  server: {
    port: 8000,
  }
})
