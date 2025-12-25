import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api-gtw': {
            target: 'https://new.playhouse.ai',
            changeOrigin: true,
            secure: false,
          },
          '/auth-api': {
            target: 'https://authdev.playhouse.ai/api-gtw',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/auth-api/, '')
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
