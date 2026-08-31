/** @type {import('next').NextConfig} */
const path = require('path');
const webpack = require('webpack');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
  // Required for googleapis on server
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'google-auth-library'],
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
