'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Tool, Form } from '@/types';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tools: Tool[];
  forms: Form[];
  legacyRole?: string | null;
}

const TOOL_CATEGORY_ICON: Record<string, string> = {
  gpr: '📡',
  cad: '✏️',
  admin: '⚙️',
  universal: '🌐',
};

export function HamburgerMenu({ isOpen, onClose, tools, forms, legacyRole }: HamburgerMenuProps) {
  const pathname = usePathname();

  // Cerrar al navegar
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menú de navegación"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
          <span className="font-bold text-primary text-sm">Menú</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-muted"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scroll area */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">

          {/* Panel principal */}
          <section>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">
              Panel
            </p>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-primary-50 text-primary'
                  : 'text-text-secondary hover:bg-gray-100'
              }`}
            >
              <span className="text-base">🏠</span>
              Mi Panel
            </Link>
            <Link
              href="/projects"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname.startsWith('/projects')
                  ? 'bg-primary-50 text-primary'
                  : 'text-text-secondary hover:bg-gray-100'
              }`}
            >
              <span className="text-base">📁</span>
              Mis Proyectos
            </Link>
          </section>

          {/* Módulo Dibujante (legacy) */}
          {legacyRole === 'dibujo' && (
            <section>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">
                Módulo Dibujante
              </p>
              <Link
                href="/dibujo/nueva-actividad"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/dibujo/nueva-actividad'
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                <span className="text-base">✏️</span>
                Nueva Actividad CAD
              </Link>
              <Link
                href="/dibujo/tablero"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/dibujo/tablero'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                <span className="text-base">📊</span>
                Tablero de Actividades
              </Link>
            </section>
          )}

          {/* Mis Herramientas */}
          {tools.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">
                Mis Herramientas
              </p>
              <ul className="space-y-1">
                {tools.map((tool) => (
                  <li key={tool.id}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        pathname === `/tools/${tool.slug}`
                          ? 'bg-primary-50 text-primary'
                          : 'text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{TOOL_CATEGORY_ICON[tool.category] ?? '🔧'}</span>
                      <span className="truncate">{tool.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mis Formularios */}
          {forms.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">
                Mis Formularios
              </p>
              <ul className="space-y-1">
                {forms.map((form) => (
                  <li key={form.id}>
                    <Link
                      href={`/forms/${form.slug}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        pathname === `/forms/${form.slug}`
                          ? 'bg-primary-50 text-primary'
                          : 'text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">📋</span>
                      <span className="truncate">{form.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </nav>
      </aside>
    </>
  );
}
