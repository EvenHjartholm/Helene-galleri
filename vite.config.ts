import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // ✅ Makes deployment to GitHub Pages (and Vercel) easier
  server: {
    port: 8000,
  }
})
