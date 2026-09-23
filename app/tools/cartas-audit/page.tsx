'use client';

import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { HrLettersAuditPanel } from '@/components/admin/HrLettersAuditPanel';

export default function CartasAuditToolPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/admin/forms" label="Volver a Herramientas y Formularios" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Recursos Humanos
                </span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-white/60 text-xs font-mono">cartas-audit</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5 mt-1.5">
                <span>📑</span> Auditoría de Elaboración de Cartas
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-2xl">
                Panel centralizado para la fiscalización, control de radicados, visualización en Word/PDF y auditoría histórica de certificaciones laborales emitidas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20">
        <HrLettersAuditPanel />
      </div>
    </div>
  );
}
