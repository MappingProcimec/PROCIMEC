/** @type {import('next').NextConfig} */
const path = require('path');
const webpack = require('webpack');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  runtimeCaching: [
    {
      // No cachear APIs en absoluto
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      // Rutas privadas y autenticadas: NUNCA cachear HTML dinámico para prevenir fuga de datos cruzados entre operadores
      urlPattern: /\/(dashboard|admin|projects|tools|forms|pending)(\/.*)?$/i,
      handler: 'NetworkOnly',
    },
    {
      // Assets estáticos de compilación de Next.js (JS, CSS)
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Fuentes e imágenes estáticas
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'media-assets',
        expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Rutas públicas base (landing, login, legal)
      urlPattern: /^https?:\/\/[^\/]+(\/|\/login|\/privacy|\/terms)$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'public-pages',
        expiration: { maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/app/logo.ico',
        destination: '/logo.ico',
      },
    ];
  },
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    let supabaseHost = '';
    try {
      if (supabaseUrl) supabaseHost = new URL(supabaseUrl).host;
    } catch {
      supabaseHost = '';
    }

    const supabaseOrigins = supabaseHost
      ? `https://${supabaseHost} wss://${supabaseHost}`
      : 'https://*.supabase.co wss://*.supabase.co';

    const supabaseImg = supabaseHost ? `https://${supabaseHost}` : 'https://*.supabase.co';

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' blob: data: ${supabaseImg} https://lh3.googleusercontent.com`,
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseOrigins} https://generativelanguage.googleapis.com`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
  // Required for heavy node libraries on server
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@tanstack/react-query',
      'recharts',
    ],
    serverComponentsExternalPackages: [
      'exceljs',
      'docx',
      'nodemailer',
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        child_process: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      };
      
      // Redirect node: scheme imports (e.g. node:fs, node:https) to empty stub module on client
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:(.*)$/, (resource) => {
          resource.request = path.resolve(__dirname, 'src/lib/gpr/emptyModule.ts');
        })
      );
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
