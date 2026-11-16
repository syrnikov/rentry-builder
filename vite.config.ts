import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build works at any URL (e.g. GitHub Pages: /rentry-builder/).
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never);
