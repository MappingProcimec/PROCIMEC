'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import {
  BadgeDollarSign,
  ShieldCheck,
  Layers,
  ArrowRight,
  CheckCircle2,
  LineChart,
  Coins,
  AlertCircle
} from 'lucide-react';

export default function FinanceLandingPage() {
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
  const userRole = user?.role || 'finance';

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Industrial Hero Header */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono font-medium tracking-wide uppercase px-2.5 py-1">
              División Financiera
            </span>
            <span className="badge bg-white/10 text-white/90 border border-white/20 text-xs font-mono font-semibold px-2.5 py-1 flex items-center gap-1.5">
              <BadgeDollarSign className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
              Rol: Finanzas
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Finanzas & Tesorería
          </h1>
          <p className="text-white/75 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Supervisión del flujo de caja, ejecución de presupuestos operativos por proyecto y viabilidad financiera de frentes de obra.
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 -mt-6 pb-16 w-full space-y-6">
        {/* Pilot Phase Banner */}
        <div className="card border border-purple-200 bg-purple-50/70 p-5 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-700 flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-purple-600" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-purple-950">
                  Capa 2: Rol Base Habilitado
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900 border border-purple-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" strokeWidth={1.75} />
                  Rol Activo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-purple-900/80 mt-1 leading-relaxed">
                Este rol base ha sido verificado con éxito en la plataforma PROCIMEC. Su perfil de usuario tiene asignada la identidad canónica de <strong className="font-semibold text-purple-950">Finanzas</strong>. El monitor de flujo de caja y presupuestos se desplegarán según el plan progresivo.
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
                {(user?.fullName || user?.email || 'F').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-text-primary truncate">
                  {user?.fullName || 'Responsable de Finanzas'}
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
                <span className="font-semibold text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                  Finanzas
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

          {/* Operational Roadmap / Scope Card */}
          <div className="card border border-border p-5 rounded-2xl shadow-xs md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Próximas Habilitaciones del Módulo
              </h3>
              <span className="text-xs font-mono text-text-muted">Plan Progresivo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="border border-border/80 bg-gray-50/50 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <LineChart className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <span>Flujo de Caja Operativo</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Proyecciones de ingresos y egresos vinculados a ejecución de contratos y compras.
                </p>
                <div className="pt-1">
                  <span className="text-[10px] font-mono font-medium text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded">
                    Capa 4: Herramienta
                  </span>
                </div>
              </div>

              <div className="border border-border/80 bg-gray-50/50 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <Coins className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <span>Presupuesto por Centro de Costo</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Registro y control de rubros presupuestales autorizados para cada frente de obra.
                </p>
                <div className="pt-1">
                  <span className="text-[10px] font-mono font-medium text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded">
                    Capa 6: Formularios
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-primary-50/40 border border-primary-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-primary-900">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>
                Cualquier herramienta universal o formulario general asignado por el administrador ya se encuentra disponible inmediatamente en <Link href="/dashboard" className="underline font-semibold hover:text-primary-700">Mi Panel</Link>.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
