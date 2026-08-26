// app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function LandingPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const role = session?.user?.role;

  let dashboardUrl = '/login';
  if (role === 'admin') dashboardUrl = '/admin/dashboard';
  else if (role === 'pending') dashboardUrl = '/pending';
  else if (role) dashboardUrl = '/dashboard';

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glow">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-primary text-base tracking-tight leading-none block">PROCIMEC</span>
              <span className="text-[10px] text-accent-700 font-semibold tracking-wider uppercase">Plataforma de Gestión Empresarial</span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Link href="/privacy" className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors hidden sm:block">
              Privacidad
            </Link>
            <Link href="/terms" className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors hidden sm:block">
              Términos
            </Link>
            {isAuthenticated ? (
              <Link href={dashboardUrl} className="btn-primary text-xs font-bold px-4 py-2 rounded-xl shadow-glow">
                Ir a mi Panel →
              </Link>
            ) : (
              <Link href="/login" className="btn-primary text-xs font-bold px-5 py-2.5 rounded-xl shadow-glow">
                Iniciar Sesión
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-procimec-gradient text-white pt-16 pb-24 px-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-accent font-semibold text-xs tracking-wide">
            <span>🏢</span>
            <span>Sistema Integrado de Gestión Empresarial (SIG)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            PROCIMEC — Portal Corporativo
          </h1>

          <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Plataforma web integrada para la administración de operaciones, control de calidad ISO, procesos transversales y gestión documental centralizada de toda la organización.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link href={dashboardUrl} className="btn-accent btn-lg text-sm font-bold shadow-lg">
                Ingresar al Sistema →
              </Link>
            ) : (
              <Link href="/login" className="btn-accent btn-lg text-sm font-bold shadow-lg">
                Iniciar Sesión con Google
              </Link>
            )}
            <a href="#caracteristicas" className="btn-outline border-white/40 text-white hover:bg-white/10 text-sm font-semibold px-6 py-3.5 rounded-2xl">
              Conocer más
            </a>
          </div>
        </div>

        {/* Background glow */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-accent/15 blur-3xl rounded-full pointer-events-none" />
      </section>

      {/* Features Grid */}
      <section id="caracteristicas" className="max-w-6xl mx-auto px-4 -mt-10 mb-16 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="card p-6 shadow-xl border border-border hover:shadow-2xl transition-all">
            <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary flex items-center justify-center text-2xl font-bold mb-4">
              📊
            </div>
            <h3 className="font-bold text-text-primary text-lg mb-2">Áreas Operativas</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Módulos especializados para captura de datos en campo (GPR), registro de actividades CAD/BIM y ejecución técnica de proyectos.
            </p>
          </div>

          {/* Card 2 */}
          <div className="card p-6 shadow-xl border border-border hover:shadow-2xl transition-all">
            <div className="w-12 h-12 rounded-2xl bg-accent-100 text-accent-700 flex items-center justify-center text-2xl font-bold mb-4">
              🛡️
            </div>
            <h3 className="font-bold text-text-primary text-lg mb-2">Gestión ISO / HSEQ</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Centralización de responsabilidades por cargo, control documental y cumplimiento de las normas ISO 9001, 14001 y 45001.
            </p>
          </div>

          {/* Card 3 */}
          <div className="card p-6 shadow-xl border border-border hover:shadow-2xl transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4">
              ⚙️
            </div>
            <h3 className="font-bold text-text-primary text-lg mb-2">Procesos Transversales</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Administración unificada para comercial, gestión contable, recursos humanos y repositorio institucional articulado con Google Drive.
            </p>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="max-w-4xl mx-auto px-4 mb-16 text-center">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-border shadow-card space-y-4">
          <span className="badge badge-primary text-xs">Acceso Institucional</span>
          <h2 className="text-2xl font-bold text-primary">Portal Corporativo PROCIMEC</h2>
          <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto">
            Este sistema requiere inicio de sesión con cuentas corporativas verificadas de Google. Cada usuario cuenta con permisos específicos asignados según su área y perfil en la organización.
          </p>
          <div className="pt-2">
            <Link href="/login" className="btn-primary px-7 py-3 text-sm font-semibold rounded-xl inline-flex items-center gap-2">
              <span>Acceder al Portal</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Public */}
      <footer className="bg-primary-900 text-white/80 py-10 border-t border-primary-800">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <span className="font-bold text-white text-base tracking-tight">PROCIMEC</span>
              <span className="text-accent text-xs font-semibold">· Gestión Integral</span>
            </div>
            <p className="text-white/60 text-xs">
              Plataforma Corporativa de Operaciones y Procesos Transversales
            </p>
          </div>

          {/* Links a Privacidad y Términos */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs font-semibold">
            <Link href="/privacy" className="hover:text-accent transition-colors">
              Política de Privacidad
            </Link>
            <span className="text-white/30">•</span>
            <Link href="/terms" className="hover:text-accent transition-colors">
              Términos del Servicio
            </Link>
            <span className="text-white/30">•</span>
            <a href="mailto:mapping.procimec2024@gmail.com" className="hover:text-accent transition-colors">
              Soporte: mapping.procimec2024@gmail.com
            </a>
          </div>

          <div className="text-white/40 text-xs">
            © {new Date().getFullYear()} PROCIMEC. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}