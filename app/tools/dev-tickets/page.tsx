'use client';

import { Lightbulb } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { DevTicketsPanel } from '@/components/tools/DevTicketsPanel';

export const dynamic = 'force-dynamic';

export default function DevTicketsToolPage() {
  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero Sobrio Canónico Ley 5 */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Lightbulb className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Tickets y DevOps Autónomo
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Recepción de requerimientos, especificación técnica asistida por IA, aprobación exclusiva del Administrador y orquestación con Runner local
          </p>
        </div>
      </div>

      {/* Panel Principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20">
        <DevTicketsPanel />
      </div>
    </div>
  );
}
