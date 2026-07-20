import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/d3-')) return 'charts-d3';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@xterm')) return 'terminal';
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // In sviluppo locale, Vite inoltrata /api al backend.
      // VITE_API_BASE_URL sovrascrive il target (default: http://localhost:8000).
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
