import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
});
