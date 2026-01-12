import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Helene-galleri/', // ✅ Matcher navnet på GitHub-repositoryet
  server: {
    port: 8000,
  }
})
