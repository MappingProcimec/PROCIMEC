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
  title: 'GPR Field Reporter — PROCIMEC',
  description: 'Sistema de registro digital de levantamientos con Radar de Penetración Terrestre para PROCIMEC. Captura datos en campo, genera reportes y sincroniza con Google Drive.',
  keywords: ['GPR', 'ground penetrating radar', 'PROCIMEC', 'field reporter', 'reporte técnico'],
  authors: [{ name: 'PROCIMEC' }],
  creator: 'PROCIMEC',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GPR Reporter',
  },
  openGraph: {
    title: 'GPR Field Reporter — PROCIMEC',
    description: 'Sistema de registro digital de levantamientos GPR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#1B3A5C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="font-sans bg-surface text-text-primary antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
