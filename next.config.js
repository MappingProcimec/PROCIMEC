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
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: { maxEntries: 200 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
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
      'googleapis',
      'google-auth-library',
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
