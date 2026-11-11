#!/usr/bin/env node
/**
 * Bundle the Express extract API into a single CommonJS file for Electron
 * (run via ELECTRON_RUN_AS_NODE so we do not ship a separate Node binary).
 */
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'dist-electron')
const outfile = path.join(outDir, 'server.cjs')

fs.mkdirSync(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [path.join(root, 'server/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  // Packaged desktop always serves prebuilt Vite assets — do not pull Vite into the server binary.
  external: ['vite'],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // Expose CJS __dirname to the ESM-oriented serverDir() helper via globalThis.
  banner: {
    js: 'globalThis.__dirname = __dirname;',
  },
  logLevel: 'info',
})

console.log(`Bundled extract server → ${path.relative(root, outfile)}`)
