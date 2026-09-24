import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PROCIMEC — PCM CLOUD | Mapping Ingeniería',
  description: 'Plataforma empresarial de gestión geofísica, cartografía subterránea 3D, modelado CAD/BIM, aseguramiento HSEQ y automatización operativa para Mapping Ingeniería.',
  keywords: ['GPR', 'ground penetrating radar', 'Mapping Ingeniería', 'PCM CLOUD', 'PROCIMEC', 'CAD', 'BIM', 'HSEQ'],
  authors: [{ name: 'Mapping Ingeniería' }],
  creator: 'Mapping Ingeniería',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PCM CLOUD',
  },
  openGraph: {
    title: 'PROCIMEC — PCM CLOUD | Mapping Ingeniería',
    description: 'Plataforma empresarial de gestión geofísica y cartografía subterránea',
    type: 'website',
  },
  verification: {
    google: 'OXOT9JTd9TfbeI4v-5h5ArEs08-w4i2pHx6pvlVr9kg',
  },
};

export const viewport: Viewport = {
  themeColor: '#1E2229',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <meta name="google-site-verification" content="OXOT9JTd9TfbeI4v-5h5ArEs08-w4i2pHx6pvlVr9kg" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="font-sans bg-surface text-text-primary antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
