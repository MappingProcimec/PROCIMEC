'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PendingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirigir automáticamente si el rol ya no es 'pending'
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const role = session.user.role;
      if (role === 'admin') router.replace('/admin/dashboard');
      else if (role === 'operator') router.replace('/projects');
      else if (role === 'dibujo') router.replace('/dibujo');
    }
  }, [session, status, router]);

  // Intentar refrescar el token al montar para leer el rol actualizado de Supabase
  useEffect(() => {
    if (status === 'authenticated') {
      update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await update();
    setIsRefreshing(false);
  };

  const handleSignOut = () => {
    setIsSigningOut(true);
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/api/logout';
    }
  };

  return (
    <main className="min-h-screen bg-procimec-gradient flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/20 border border-accent/30 rounded-3xl mb-4">
            <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Acceso Pendiente</h1>
          <p className="text-white/60 text-sm mt-2">Aprobación del administrador requerida</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-7 shadow-2xl text-center">
          {session?.user?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.avatarUrl}
              alt="Avatar"
              className="w-14 h-14 rounded-full mx-auto mb-3 border-2 border-white/30"
            />
          )}
          <p className="text-white font-semibold">{session?.user?.fullName || session?.user?.name}</p>
          <p className="text-white/50 text-sm mb-6">{session?.user?.email}</p>

          <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 mb-6 text-left">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p className="text-white font-semibold text-sm mb-1">Cuenta registrada</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  Tu solicitud está en revisión. Si un administrador ya asignó tu rol, presiona el botón de verificar acceso a continuación.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full bg-accent text-primary-900 font-bold px-5 py-3 rounded-2xl hover:bg-accent-400 active:scale-95 transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isRefreshing ? (
                <div className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              {isRefreshing ? 'Comprobando acceso...' : 'Verificar estado de aprobación'}
            </button>

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="btn-outline border-white/30 text-white hover:bg-white/10 w-full flex items-center justify-center gap-2"
            >
              {isSigningOut ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              )}
              {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
