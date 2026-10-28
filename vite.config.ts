import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const rawBase = env.VITE_BASE_PATH?.trim() || '/';
  const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  return {
    root,
    base: base.endsWith('/') ? base : `${base}/`,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(root, 'src') },
      dedupe: ['react', 'react-dom'],
    },
    build: { outDir: path.resolve(root, 'dist'), emptyOutDir: true },
    preview: { host: '0.0.0.0' },
  };
});
