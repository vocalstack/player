import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { port: 5190, strictPort: true, proxy: { '/v1': { target: 'http://localhost:8080', ws: true, changeOrigin: false }, '/app': { target: 'http://localhost:8080' } } },
});
