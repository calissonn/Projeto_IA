import path from 'node:path';
import type { NextConfig } from 'next';

// Usa o mesmo .env da raiz do projeto (ACC_TOKEN, ACC_PORT…).
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  /* sem .env: usa variáveis do ambiente */
}

const isDev = process.env.NODE_ENV !== 'production';

// Política de conteúdo: só recursos da própria aplicação. Em desenvolvimento o Next precisa de eval.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: ['@acc/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: path.resolve(process.cwd(), '../..') },
};
export default config;
