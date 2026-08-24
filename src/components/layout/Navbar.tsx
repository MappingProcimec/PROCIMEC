'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href={isAdmin ? '/admin/dashboard' : '/projects'} className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="font-bold text-primary text-sm hidden sm:block">PROCIMEC</span>
        </Link>

        {/* Nav links (admin) */}
        {isAdmin && (
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/admin/dashboard', label: 'Dashboard' },
              { href: '/admin/projects', label: 'Proyectos' },
              { href: '/admin/users', label: 'Usuarios' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-primary-50 text-primary'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        {/* User menu */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span className={`hidden sm:inline-flex badge text-xs ${isAdmin ? 'badge-primary' : 'badge-accent'}`}>
            {isAdmin ? 'Admin' : 'Operador'}
          </span>

          {/* Avatar */}
          <div className="relative group">
            <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || ''}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary text-sm font-bold">
                    {(session?.user?.name || 'U').charAt(0)}
                  </span>
                </div>
              )}
              <svg className="w-4 h-4 text-text-muted hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-soft border border-border py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-semibold text-text-primary truncate">{session?.user?.name}</p>
                <p className="text-xs text-text-muted truncate">{session?.user?.email}</p>
              </div>
              {isAdmin && (
                <Link href="/projects" className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  Vista Operador
                </Link>
              )}
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent('/login');
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
