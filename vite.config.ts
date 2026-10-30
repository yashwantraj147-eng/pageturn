import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import { builtinModules } from 'module';

// Remove ELECTRON_RUN_AS_NODE if set in the host environment (e.g. VS Code terminal)
delete process.env.ELECTRON_RUN_AS_NODE;

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(args) {
          const env = { ...process.env };
          delete env.ELECTRON_RUN_AS_NODE;
          args.startup(['.', '--no-sandbox'], { env });
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
              ],
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: [
                'electron',
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
              ],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
