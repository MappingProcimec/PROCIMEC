'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role === 'admin') router.replace('/admin/dashboard');
      else if (role === 'operator') router.replace('/projects');
      else if (role === 'dibujo') router.replace('/dibujo');
      else router.replace('/pending');
    }
  }, [session, status, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    await signIn('google', { callbackUrl: '/projects' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-procimec-gradient flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-procimec-gradient flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-3xl" />
        {/* Radar wave animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-0 border border-white/10 rounded-full animate-ping"
              style={{
                width: `${i * 200}px`,
                height: `${i * 200}px`,
                marginLeft: `-${i * 100}px`,
                marginTop: `-${i * 100}px`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: '3s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 mb-4 shadow-glow">
            {/* Radar icon */}
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            GPR Field Reporter
          </h1>
          <p className="text-white/70 text-sm mt-2">
            Sistema de registro digital de campo
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-accent/20 border border-accent/30 rounded-full">
            <span className="text-accent font-semibold text-xs tracking-wider">Mapping Ingeniería</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-7 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-1">Iniciar sesión</h2>
          <p className="text-white/60 text-sm mb-6">
            Accede con tu cuenta de Google corporativa para continuar.
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold px-5 py-3.5 rounded-2xl
                       hover:bg-gray-50 active:scale-95 transition-all duration-200 shadow-lg
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {isLoading ? 'Iniciando sesión...' : 'Continuar con Google'}
          </button>

          <p className="text-white/40 text-xs text-center mt-5">
            Solo para personal autorizado de Mapping Ingeniería.
            <br />El acceso es aprobado por el administrador.
          </p>
        </div>

        <p className="text-white/30 text-xs text-center mt-6">
          GPR Field Reporter v1.0 · Mapping Ingeniería © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}
