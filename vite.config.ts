import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DATA_ROOT = path.resolve('.quake-data');
const SHAREWARE_ARCHIVE = path.join(DATA_ROOT, 'quake106.zip');
const LIBARCHIVE_ROOT = path.resolve('node_modules/libarchive.js/dist');

const gameDataPlugin = (): Plugin => ({
    name: 'quake-game-data',
    configureServer(server) {
        server.middlewares.use('/game-data', (request, response, next) => {
            const relativePath = decodeURIComponent(request.url ?? '/')
            .replace(/^\/+/, '')
            .replaceAll('/', path.sep);
            const requestedPath = path.resolve(DATA_ROOT, relativePath);

            if (!requestedPath.startsWith(`${DATA_ROOT}${path.sep}`)) {
                response.statusCode = 403;
                response.end('Forbidden');
                return;
            }

            if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
                next();
                return;
            }

            response.setHeader('Content-Type', 'application/octet-stream');
            response.setHeader('Cache-Control', 'no-store');
            fs.createReadStream(requestedPath).pipe(response);
        });
    },
    generateBundle() {
        if (!fs.existsSync(SHAREWARE_ARCHIVE)) return;
        for (const [fileName, sourcePath] of [
            ['game-data/quake106.zip', SHAREWARE_ARCHIVE],
            ['libarchive/worker-bundle.js', path.join(LIBARCHIVE_ROOT, 'worker-bundle.js')],
            ['libarchive/libarchive.wasm', path.join(LIBARCHIVE_ROOT, 'libarchive.wasm')]
        ]) {
            this.emitFile({
                fileName,
                source: fs.readFileSync(sourcePath),
                type: 'asset'
            });
        }
    }
});

export default defineConfig({
    base: process.env.VITE_BASE_PATH ?? '/',
    plugins: [gameDataPlugin()],
    server: {
        strictPort: true
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts']
    }
});
