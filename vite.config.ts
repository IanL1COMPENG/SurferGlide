import { defineConfig, loadEnv } from 'vite';
import { multiplayerBuildEndpoint } from './src/core/deployment.ts';

export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_MULTIPLAYER_URL': JSON.stringify(
      multiplayerBuildEndpoint(
        loadEnv(mode, process.cwd(), 'VITE_MULTIPLAYER_URL').VITE_MULTIPLAYER_URL,
        process.env.VERCEL === '1',
      ),
    ),
  },
  server: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
}));
