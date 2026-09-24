'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import {
  Package,
  ShieldCheck,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Box,
  Compass,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

export default function WarehouseLandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role === 'pending') {
        router.replace('/pending');
      }
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const user = session?.user;
  const userRole = user?.role || 'warehouse';

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Industrial Hero Header */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-medium tracking-wide uppercase px-2.5 py-1">
              División Operativa
            </span>
            <span className="badge bg-white/10 text-white/90 border border-white/20 text-xs font-mono font-semibold px-2.5 py-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
              Rol: Almacén
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Almacén & Equipos
          </h1>
          <p className="text-white/75 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Módulo corporativo para el control de inventario, calibración de instrumental geofísico y despacho de equipos técnicos.
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 -mt-6 pb-16 w-full space-y-6">
        {/* Pilot Phase 1 Banner */}
        <div className="card border border-amber-200 bg-amber-50/70 p-5 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-amber-600" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-amber-950">
                  Capa 1: Rol Base Habilitado
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" strokeWidth={1.75} />
                  Piloto Activo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/80 mt-1 leading-relaxed">
                Este rol base ha sido verificado con éxito en la plataforma PROCIMEC. Su perfil de usuario tiene asignada la identidad canónica de <strong className="font-semibold text-amber-950">Almacén</strong>. Las herramientas de control de activos y formularios de entrega se desplegarán en las siguientes etapas.
              </p>
            </div>
          </div>
        </div>

        {/* User Identity & Operational Scope Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Identity Card */}
          <div className="card border border-border p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary font-bold text-base">
                {(user?.fullName || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-text-primary truncate">
                  {user?.fullName || 'Responsable de Almacén'}
                </h3>
                <p className="text-xs text-text-muted font-mono truncate">{user?.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Identificador de Sistema</span>
                <span className="font-mono font-semibold text-text-primary bg-gray-100 px-2 py-0.5 rounded">
                  {userRole}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Nombre Canónico</span>
                <span className="font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Almacén
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-muted">Estado de Sesión</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 active:scale-[0.98] transition-all duration-160 shadow-xs"
              >
                <span>Acceder a Mi Panel</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>

          {/* Operational Forms & Module Capabilities */}
          <div className="card border border-border p-5 rounded-2xl shadow-xs md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Formularios Operacionales del Rol
              </h3>
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                Captura Activa
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Formulario 1: Alta de Instrumental (ACTIVO) */}
              <div className="border-2 border-primary/20 bg-primary-50/20 hover:border-primary/40 rounded-xl p-4 space-y-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                    <Box className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    <span>Alta de Instrumental</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Disponible
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Registro oficial de georradares, antenas, GNSS, estaciones y accesorios con número de serie y calibración.
                </p>
                <div className="pt-1">
                  <Link
                    href="/forms/registro-equipo"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-800 transition-colors"
                  >
                    <span>Llenar Formulario de Alta</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                </div>
              </div>

              {/* Formulario 2: Despacho a Campo (SIGUIENTE) */}
              <div className="border border-border/80 bg-gray-50/50 rounded-xl p-4 space-y-2.5 opacity-85">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                    <FileSpreadsheet className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                    <span>Despacho a Campo</span>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Fase Siguiente
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Salida de instrumental hacia proyectos con checklist de accesorios y responsable receptor.
                </p>
                <div className="pt-1">
                  <span className="text-[11px] font-mono text-text-muted">
                    Se habilitará tras validar el alta
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-primary-50/40 border border-primary-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-primary-900">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>
                Los equipos dados de alta a través de este formulario alimentarán automáticamente la base de datos para la futura <strong className="font-semibold text-primary">Herramienta de Control de Inventario</strong>.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
