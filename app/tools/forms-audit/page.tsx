'use client';

import { ClipboardCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { FormsAuditPanel } from '@/components/tools/FormsAuditPanel';

export const dynamic = 'force-dynamic';

export default function FormsAuditToolPage() {
  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero Sobrio Canónico */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <ClipboardCheck className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Auditoría General de Formularios y Formatos
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Consola centralizada para la fiscalización, trazabilidad universal y auditoría de archivos de todos los formatos operativos
          </p>
        </div>
      </div>

      {/* Panel Principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20">
        <FormsAuditPanel />
      </div>
    </div>
  );
}
