'use client';

import { ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { VersionControlPanel } from '@/components/tools/VersionControlPanel';

export const dynamic = 'force-dynamic';

export default function VersionControlToolPage() {
  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero Sobrio Canónico Ley 5 */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Control de Versiones y Gestión Documental
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Listado maestro oficial de formatos, control de cambios, versiones vigentes y descarga de plantillas del Sistema Integrado de Gestión (HSEQ & SIG)
          </p>
        </div>
      </div>

      {/* Panel Principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20">
        <VersionControlPanel />
      </div>
    </div>
  );
}
