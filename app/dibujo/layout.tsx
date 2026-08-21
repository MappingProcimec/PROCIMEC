'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DibujoLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-800 text-sm tracking-tight">
            Mapping Ingeniería
          </span>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/dibujo/nueva-actividad"
              className={
                pathname.includes('nueva-actividad')
                  ? 'text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5'
                  : 'text-gray-500 hover:text-blue-600 transition-colors'
              }
            >
              Registrar Actividad
            </Link>
            <Link
              href="/dibujo/tablero"
              className={
                pathname.includes('tablero')
                  ? 'text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5'
                  : 'text-gray-500 hover:text-blue-600 transition-colors'
              }
            >
              Tablero
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="hidden sm:inline truncate max-w-[180px]">
            {session?.user?.name || session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
