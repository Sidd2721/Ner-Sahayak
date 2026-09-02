import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: { port: 3001 },
  build: { outDir: 'dist' },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
