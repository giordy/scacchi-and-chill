import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function singleRootConfigPlugin(): Plugin {
  return {
    name: 'single-root-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = (req as any).url || '';
        // Only intercept direct fetch to /config.json, not Vite module imports like /config.json?import
        if (rawUrl === '/config.json') {
          const configPath = path.resolve(process.cwd(), 'config.json');
          if (fs.existsSync(configPath)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(configPath, 'utf-8'));
            return;
          }
        }
        next();
      });
    },
    generateBundle() {
      const configPath = path.resolve(process.cwd(), 'config.json');
      if (fs.existsSync(configPath)) {
        this.emitFile({
          type: 'asset',
          fileName: 'config.json',
          source: fs.readFileSync(configPath, 'utf-8'),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), singleRootConfigPlugin()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
