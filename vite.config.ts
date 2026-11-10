import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 하위 경로(/zziksin/)에서도 동작하도록 상대 경로
  base: './',
  build: { target: 'es2020' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
