'use client';

import { useSession, signOut } from 'next-auth/react';


export default function PendingPage() {
  const { data: session } = useSession();

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
                <p className="text-white font-semibold text-sm mb-1">Cuenta creada exitosamente</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  Tu cuenta ha sido registrada. Un administrador de PROCIMEC debe aprobar tu acceso y asignarte proyectos antes de que puedas comenzar a usar la aplicación.
                </p>
              </div>
            </div>
          </div>

          <p className="text-white/50 text-xs mb-6">
            Contacta a tu supervisor o al equipo de TI de PROCIMEC para acelerar el proceso de activación.
          </p>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="btn-outline border-white/30 text-white hover:bg-white/10 w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
