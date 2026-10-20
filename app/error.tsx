'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { logClientError } from '@/lib/telemetry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error no controlado en la aplicación:', error);
    logClientError(error, { digest: error?.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#1E2229] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#2A303C] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-500" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Ha ocurrido una novedad técnica
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Se presentó una interrupción inesperada al cargar esta vista. Los datos estructurados y sesiones activas se encuentran protegidos.
          </p>
        </div>

        {error?.digest && (
          <div className="bg-[#15181D] rounded-xl p-3 text-xs font-mono text-slate-400 border border-white/5">
            <span>Referencia: {error.digest}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2} />
            <span>Reintentar</span>
          </button>
          <Link
            href="/dashboard"
            className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-white/10"
          >
            <Home className="w-4 h-4" strokeWidth={1.75} />
            <span>Mi Panel</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
