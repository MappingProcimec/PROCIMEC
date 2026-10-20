import React from 'react';
import Link from 'next/link';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1E2229] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#2A303C] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8 text-amber-500" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
            Error 404
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Página o recurso no encontrado
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            La ruta solicitada no existe, fue reubicada o requiere permisos de acceso adicionales dentro de la plataforma.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
          >
            <Home className="w-4 h-4" strokeWidth={2} />
            <span>Volver a Mi Panel</span>
          </Link>
          <Link
            href="/"
            className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            <span>Inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
