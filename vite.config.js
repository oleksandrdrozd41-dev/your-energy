import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/your-energy/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
