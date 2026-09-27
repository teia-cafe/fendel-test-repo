import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<org>.github.io/fendel-test-repo/ on GitHub Pages.
// Override with BASE_PATH=/ when hosting at a domain root.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/fendel-test-repo/',
  plugins: [react()],
})
