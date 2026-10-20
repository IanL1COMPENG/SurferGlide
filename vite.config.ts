import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
