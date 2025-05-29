import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';
import solidJs from '@astrojs/solid-js';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), react(), solidJs()],
  output: 'static',
  site: 'https://whiteboard-tracker.netlify.app',
  server: {
    port: 3000,
    host: true
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://localhost:5000',
          ws: true
        }
      }
    }
  }
});