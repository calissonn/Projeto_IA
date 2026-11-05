/**
 * Gera dist/standalone/index.html: o AI Command Center (modo demonstração) num único arquivo,
 * sem servidor — abre no navegador do celular ou do computador.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import { build } from 'esbuild';
import postcss from 'postcss';

const WEB = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(WEB, '../../dist/standalone');
const shim = (f) => path.join(WEB, 'standalone/shims', f);

const js = await build({
  entryPoints: [path.join(WEB, 'standalone/entry.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  tsconfig: path.join(WEB, 'tsconfig.json'),
  alias: { 'next/link': shim('next-link.tsx'), 'next/navigation': shim('next-navigation.ts'), 'node:crypto': shim('node-crypto.ts') },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'warning',
});

const cssSource = readFileSync(path.join(WEB, 'app/globals.css'), 'utf8');
const css = await postcss([tailwind({ base: WEB })]).process(cssSource, { from: path.join(WEB, 'app/globals.css') });

const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<title>AI Command Center</title>
<meta name="description" content="Empresa virtual de agentes de IA com supervisão humana (demonstração)">
<meta name="theme-color" content="#0b1020">
<style>:root{color-scheme:dark}html,body{background:#0b1020;color:#e5e9f5}</style>
<style>${css.css}</style>
<div id="root"></div>
<script>${script}</script>
`;
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`dist/standalone/index.html — ${(html.length / 1024 / 1024).toFixed(2)} MB`);
