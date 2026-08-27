'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { DivisionBadge } from '@/components/DivisionBadge';
import type { Tool, Form } from '@/types';

interface DashboardData {
  user: { full_name: string };
  division: { name: string } | null;
  role: { name: string } | null;
  legacyRole?: string | null;
  tools: Tool[];
  forms: Form[];
}

async function fetchDashboardNav(): Promise<DashboardData | null> {
  const res = await fetch('/api/dashboard');
  if (!res.ok) return null;
  const json = await res.json();
  return json.data as DashboardData;
}

interface AdminRole { id: string; name: string }

async function fetchAdminTools(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  if (!res.ok) return [];
  return (await res.json()).data ?? [];
}

async function fetchAdminRoles(): Promise<AdminRole[]> {
  const res = await fetch('/api/admin/roles');
  if (!res.ok) return [];
  return ((await res.json()).data ?? []).map((r: AdminRole) => ({ id: r.id, name: r.name }));
}

const GENERAL_TOOL_SLUGS = ['dynamic-dashboard', 'internal-chat', 'meeting-transcriber', 'org-chart-ai'];

const TOOL_CATEGORY_ICON: Record<string, string> = {
  gpr: '📡',
  cad: '✏️',
  admin: '⚙️',
  universal: '🌐',
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === 'admin';
  const isPending = session?.user?.role === 'pending';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardNav,
    enabled: !!session && !isPending,
    staleTime: 5 * 60 * 1000,
  });

  const { data: adminTools = [] } = useQuery({
    queryKey: ['admin-tools-nav'],
    queryFn: fetchAdminTools,
    enabled: !!session && isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const { data: adminRoles = [] } = useQuery<AdminRole[]>({
    queryKey: ['admin-roles-nav'],
    queryFn: fetchAdminRoles,
    enabled: !!session && isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const assignedTools: Tool[] = dashData?.tools ?? [];
  const assignedForms: Form[] = dashData?.forms ?? [];
  const legacyRole = dashData?.legacyRole ?? null;
  const divisionName = dashData?.division?.name ?? (session?.user as { divisionName?: string })?.divisionName;
  const displayName = dashData?.user?.full_name ?? session?.user?.name ?? '';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setEditingName(false);
        setExpanded(new Set());
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setEditingName(false);
  }, [pathname]);

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingName(false);
    },
  });

  const openEditName = () => {
    setNameValue(displayName);
    setEditingName(true);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="font-bold text-primary text-sm hidden sm:block">PROCIMEC</span>
        </Link>

        {/* Admin nav links */}
        {isAdmin && (
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/admin/dashboard', label: 'Dashboard' },
              { href: '/admin/divisions', label: 'Divisiones' },
              { href: '/admin/projects', label: 'Proyectos' },
              { href: '/admin/roles', label: 'Roles' },
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

        {/* Right: badge + avatar */}
        <div className="flex items-center gap-2">
          {divisionName && <DivisionBadge divisionName={divisionName} />}
          <span className={`hidden sm:inline-flex badge text-xs ${isAdmin ? 'badge-primary' : 'badge-accent'}`}>
            {isAdmin ? 'Admin' : (dashData?.role?.name ?? legacyRole ?? 'Operador')}
          </span>

          {/* Avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Menú de usuario"
            >
              {session?.user?.image ? (
                <Image src={session.user.image} alt={displayName} width={32} height={32} className="rounded-full" />
              ) : (
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary text-sm font-bold">{(displayName || 'U').charAt(0)}</span>
                </div>
              )}
              <svg className="w-4 h-4 text-text-muted hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-2xl shadow-soft border border-border py-2 z-50 max-h-[80vh] overflow-y-auto">

                {/* User info */}
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
                  <p className="text-xs text-text-muted truncate">{session?.user?.email}</p>
                </div>

                {/* Editar usuario */}
                <div className="px-3 py-1 border-b border-border">
                  {!editingName ? (
                    <button
                      onClick={openEditName}
                      className="flex items-center gap-2 w-full py-2 text-sm text-text-secondary hover:text-primary transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                      Editar usuario
                    </button>
                  ) : (
                    <div className="py-2 space-y-2">
                      <p className="text-xs font-semibold text-text-secondary">Nombre completo</p>
                      <input
                        type="text"
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-border rounded-xl focus:outline-none focus:border-primary"
                        placeholder="Tu nombre completo"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && nameValue.trim()) updateNameMutation.mutate(nameValue.trim());
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                      />
                      {updateNameMutation.isError && (
                        <p className="text-xs text-red-600">Error al guardar</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingName(false)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-border text-text-secondary hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => updateNameMutation.mutate(nameValue.trim())}
                          disabled={updateNameMutation.isPending || !nameValue.trim()}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-primary text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                          {updateNameMutation.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Non-admin navigation */}
                {!isAdmin && !isPending && (
                  <>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors"
                    >
                      <span>🏠</span> Mi Panel
                    </Link>

                    {legacyRole === 'dibujo' && (
                      <>
                        <button onClick={() => toggleSection('dibujo')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Módulo Dibujante</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('dibujo') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('dibujo') && (
                          <>
                            <Link href="/dibujo/nueva-actividad" className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>✏️</span> Nueva Actividad CAD
                            </Link>
                            <Link href="/dibujo/tablero" className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>📊</span> Tablero de Actividades
                            </Link>
                          </>
                        )}
                      </>
                    )}

                    {assignedTools.length > 0 && (
                      <>
                        <button onClick={() => toggleSection('tools')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mis Herramientas</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('tools') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('tools') && assignedTools.map(tool => (
                          <Link key={tool.id} href={`/tools/${tool.slug}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                            <span>{TOOL_CATEGORY_ICON[tool.category] ?? '🔧'}</span>
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {assignedForms.length > 0 && (
                      <>
                        <button onClick={() => toggleSection('forms')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mis Formularios</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('forms') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('forms') && assignedForms.map(form => (
                          <Link key={form.id} href={`/forms/${form.slug}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                            <span>📋</span>
                            <span className="truncate">{form.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    <div className="border-t border-border my-1" />
                  </>
                )}

                {/* Admin extras */}
                {isAdmin && (
                  <>
                    {/* Herramientas generales */}
                    {adminTools.filter((t: Tool) => GENERAL_TOOL_SLUGS.includes(t.slug)).length > 0 && (
                      <>
                        <button onClick={() => toggleSection('admin-general')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Herramientas generales</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('admin-general') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('admin-general') && adminTools.filter((t: Tool) => GENERAL_TOOL_SLUGS.includes(t.slug)).map((tool: Tool) => (
                          <Link key={tool.id} href={`/tools/${tool.slug}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                            <span>{TOOL_CATEGORY_ICON[tool.category] ?? '🔧'}</span>
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Herramientas de rol */}
                    {adminTools.filter((t: Tool) => !GENERAL_TOOL_SLUGS.includes(t.slug)).length > 0 && (
                      <>
                        <button onClick={() => toggleSection('admin-rol')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Herramientas de rol</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('admin-rol') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('admin-rol') && adminTools.filter((t: Tool) => !GENERAL_TOOL_SLUGS.includes(t.slug)).map((tool: Tool) => (
                          <Link key={tool.id} href={`/tools/${tool.slug}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                            <span>{TOOL_CATEGORY_ICON[tool.category] ?? '🔧'}</span>
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Vistas de roles — dynamic per role in DB */}
                    {adminRoles.length > 0 && (
                      <>
                        <button onClick={() => toggleSection('vistas')} className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-70 transition-opacity">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Vistas de roles</p>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded.has('vistas') ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                        {expanded.has('vistas') && adminRoles.map((role: AdminRole) => (
                          <Link key={role.id} href={`/admin/roles/${role.id}`} className="flex items-center gap-2.5 pl-5 pr-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors">
                            <span>👤</span>
                            <span className="truncate">Vista {role.name}</span>
                          </Link>
                        ))}
                      </>
                    )}
                    <div className="border-t border-border my-1" />
                  </>
                )}

                {/* Sign out */}
                <button
                  onClick={() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/api/logout';
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
