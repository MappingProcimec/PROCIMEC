'use client';

import { FileCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { HrLettersAuditPanel } from '@/components/admin/HrLettersAuditPanel';

export const dynamic = 'force-dynamic';

export default function CartasAuditToolPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="mt-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <FileCheck className="w-7 h-7 text-accent" strokeWidth={1.75} /> Auditoría de Elaboración de Cartas
            </h1>
            <p className="text-white/70 text-sm mt-1 max-w-2xl">
              Panel centralizado para la fiscalización, control de radicados, visualización en Word/PDF y auditoría histórica de certificaciones laborales emitidas.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20">
        <HrLettersAuditPanel />
      </div>
    </div>
  );
}
