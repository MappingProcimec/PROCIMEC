'use client';

import { Suspense } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { GprCadStudioPanel } from '@/components/tools/GprCadStudioPanel';

export const dynamic = 'force-dynamic';

export default function GprCadStudioPage() {
  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <Navbar />

      {/* Page Hero Canónico Ley 5 */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Estudio de Procesamiento GPR & CAD/BIM AI
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Orquestación en 5 pasos asistida por Inteligencia Artificial, cuantificación de costos APU por actividad y generación de entregables DWG, RVT e informes
          </p>
        </div>
      </div>

      {/* Contenedor Principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-6">
        <Suspense
          fallback={
            <div className="card p-12 text-center text-text-muted flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <span>Cargando Estudio de Procesamiento GPR & CAD/BIM...</span>
            </div>
          }
        >
          <GprCadStudioPanel />
        </Suspense>
      </div>
    </div>
  );
}
