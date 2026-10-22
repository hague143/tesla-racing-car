import { defineConfig } from 'vite';
export default defineConfig({
  base: './', publicDir: false,
  server: { host: '0.0.0.0', port: 8001 },
  preview: { host: '0.0.0.0', port: 8001 },
  build: { outDir: 'public', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 800 },
});
