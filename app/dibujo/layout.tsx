'use client';

import { Navbar } from '@/components/layout/Navbar';

export default function DibujoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
