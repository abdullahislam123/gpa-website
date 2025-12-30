import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // ✅ Naya plugin import krain

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // ✅ Tailwind plugin yahan add krain
  ],
})