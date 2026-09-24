'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { DivisionBadge } from '@/components/DivisionBadge';
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Users,
  ChevronDown,
  Settings,
  LogOut,
  Pencil,
} from 'lucide-react';
import type { Tool, Form } from '@/types';

interface DashboardData {
  user: { full_name: string; nick_name?: string };
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

/**
 * Automatización para clasificación de herramientas (Admin):
 * - Herramientas Generales: Herramientas con acceso universal (is_universal o categoría 'universal')
 *   o de administración (categoría 'admin' / 'administracion').
 * - Herramientas de Rol: Herramientas técnicas de especialidad (GPR, CAD, etc.).
 */
export function isGeneralTool(tool: { category?: string; is_universal?: boolean }): boolean {
  return (
    Boolean(tool.is_universal) ||
    tool.category === 'universal' ||
    tool.category === 'admin' ||
    tool.category === 'administracion' ||
    tool.category === 'administration'
  );
}

export function isRoleTool(tool: { category?: string; is_universal?: boolean }): boolean {
  return !isGeneralTool(tool);
}

const TOOL_SPECIFIC_ICON: Record<string, string> = {
  'attendance-tracker': '⏱️',
  'internal-chat': '💬',
  'meeting-transcriber': '🎙️',
  'org-chart-ai': '🏢',
  'dynamic-dashboard': '🌐',
  'cad-productivity-board': '📊',
  'txt-dwg-viewer': '📐',
  'docx-generator': '📄',
  'backup-script-gen': '💾',
  'gis-viewer': '🗺️',
  'gsf-processor': '📡',
  'cartas-audit': '📑',
  'elaboracion-cartas': '📄',
};

const TOOL_CATEGORY_ICON: Record<string, string> = {
  gpr: '📡',
  cad: '✏️',
  admin: '⚙️',
  universal: '🌐',
  rrhh: '📑',
};

function getToolIcon(tool: { slug?: string; category?: string }): string {
  if (tool.slug && TOOL_SPECIFIC_ICON[tool.slug]) {
    return TOOL_SPECIFIC_ICON[tool.slug];
  }
  if (tool.category && TOOL_CATEGORY_ICON[tool.category]) {
    return TOOL_CATEGORY_ICON[tool.category];
  }
  return '🔧';
}

function getToolHref(tool: { slug: string }): string {
  if (tool.slug === 'dynamic-dashboard') return '/dashboard';
  if (tool.slug === 'cartas-audit') return '/tools/cartas-audit';
  if (tool.slug === 'elaboracion-cartas') return '/forms/elaboracion-cartas';
  if (tool.slug === 'radargrama') return '/tools/radargrama';
  return `/tools/${tool.slug}`;
}

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
  const displayName = dashData?.user?.nick_name || dashData?.user?.full_name || session?.user?.name || '';

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
        body: JSON.stringify({ nick_name: name }),
      });
      const text = await res.text();
      let json: { error?: string; success?: boolean } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Error en el servidor (${res.status})`);
      }
      if (!res.ok) throw new Error(json.error || 'Error al actualizar');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setEditingName(false);
      window.location.reload();
    },
  });

  const openEditName = () => {
    setNameValue(dashData?.user?.nick_name || displayName);
    setEditingName(true);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo Corporativo Oficial */}
        <Link
          href={isAdmin ? '/admin/dashboard' : '/dashboard'}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          <Image
            src="/logo.png"
            alt="PROCIMEC Mapping Ingeniería"
            width={130}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        {/* Admin nav links */}
        {isAdmin && (
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/admin/divisions', label: 'Divisiones' },
              { href: '/admin/projects', label: 'Proyectos' },
              { href: '/admin/roles', label: 'Roles' },
              { href: '/admin/users', label: 'Usuarios' },
              { href: '/admin/forms', label: 'Formularios' },
              { href: '/admin/tools', label: 'Herramientas' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-primary-50 text-primary font-semibold'
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
            {isAdmin ? 'Admin' : (dashData?.role?.name ?? legacyRole ?? 'Localizador')}
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
              <div className="absolute right-0 top-full mt-1 w-72 sm:w-80 bg-white rounded-2xl shadow-soft border border-border py-2 z-50 max-h-[80vh] overflow-y-auto">

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
                      <Pencil className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                      <span>Editar apodo</span>
                    </button>
                  ) : (
                    <div className="py-2 space-y-2">
                      <p className="text-xs font-semibold text-text-secondary">Apodo</p>
                      <input
                        type="text"
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-border rounded-xl focus:outline-none focus:border-primary"
                        placeholder="Apodo"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && nameValue.trim()) updateNameMutation.mutate(nameValue.trim());
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                      />
                      {updateNameMutation.isError && (
                        <p className="text-xs text-red-600">{(updateNameMutation.error as Error)?.message ?? 'Error al guardar'}</p>
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

                {/* Navegación para todos los roles (incluyendo Admin) */}
                {!isPending && (
                  <>
                    <Link
                      href="/dashboard"
                      className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors rounded-xl mx-1.5 ${
                        pathname === '/dashboard'
                          ? 'bg-primary-50 text-primary font-semibold'
                          : 'text-text-secondary hover:bg-gray-50 hover:text-primary'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-accent" strokeWidth={1.75} />
                      <span className="font-medium">Mi Panel</span>
                    </Link>

                    {/* Mis Herramientas */}
                    {(assignedTools.length > 0 || (isAdmin && adminTools.length > 0)) && (
                      <>
                        <button
                          onClick={() => toggleSection('tools')}
                          className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mis Herramientas</p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${expanded.has('tools') ? 'rotate-180' : ''}`}
                            strokeWidth={2}
                          />
                        </button>
                        {expanded.has('tools') && (assignedTools.length > 0 ? assignedTools : adminTools).map(tool => (
                          <Link
                            key={tool.id}
                            href={getToolHref(tool)}
                            className="flex items-center gap-2 pl-6 pr-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors"
                          >
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Mis Formularios */}
                    {assignedForms.length > 0 && (
                      <>
                        <button
                          onClick={() => toggleSection('forms')}
                          className="flex items-center justify-between w-full px-3 pt-3 pb-1 hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Mis Formularios</p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${expanded.has('forms') ? 'rotate-180' : ''}`}
                            strokeWidth={2}
                          />
                        </button>
                        {expanded.has('forms') && assignedForms.map(form => (
                          <Link
                            key={form.id}
                            href={`/forms/${form.slug}`}
                            className="flex items-center gap-2 pl-6 pr-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors"
                          >
                            <span className="truncate">{form.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Vistas de roles — EXCLUSIVO PARA ADMINISTRADOR */}
                    {isAdmin && adminRoles.length > 0 && (
                      <>
                        <div className="border-t border-border my-1.5" />
                        <button
                          onClick={() => toggleSection('vistas')}
                          className="flex items-center justify-between w-full px-3 pt-2 pb-1 hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Vistas de roles</p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${expanded.has('vistas') ? 'rotate-180' : ''}`}
                            strokeWidth={2}
                          />
                        </button>
                        {expanded.has('vistas') && adminRoles.map((role: AdminRole) => (
                          <Link
                            key={role.id}
                            href={`/dashboard?roleId=${role.id}`}
                            className="flex items-center gap-2 pl-6 pr-3 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors"
                          >
                            <span className="truncate">Vista {role.name}</span>
                          </Link>
                        ))}
                      </>
                    )}

                    {/* Navegación Admin (en móviles cuando la barra horizontal se oculta) */}
                    {isAdmin && (
                      <div className="md:hidden">
                        <div className="border-t border-border my-1.5" />
                        <button
                          onClick={() => toggleSection('admin-nav')}
                          className="flex items-center justify-between w-full px-3 pt-2 pb-1 hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Navegación Admin</p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${expanded.has('admin-nav') ? 'rotate-180' : ''}`}
                            strokeWidth={2}
                          />
                        </button>
                        {expanded.has('admin-nav') && [
                          { href: '/admin/divisions', label: 'Divisiones' },
                          { href: '/admin/projects',  label: 'Proyectos' },
                          { href: '/admin/roles',     label: 'Roles' },
                          { href: '/admin/users',     label: 'Usuarios' },
                          { href: '/admin/forms',     label: 'Formularios' },
                          { href: '/admin/tools',     label: 'Herramientas' },
                        ].map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-2 pl-6 pr-3 py-2 text-sm transition-colors ${
                              pathname.startsWith(href)
                                ? 'bg-primary-50 text-primary font-semibold'
                                : 'text-text-secondary hover:bg-gray-50'
                            }`}
                          >
                            <span>{label}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border my-1.5" />
                  </>
                )}

                {/* Sign out */}
                <button
                  onClick={() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/api/logout';
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-error hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-error" strokeWidth={1.75} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sub-Header Navigation for Admin */}
      {isAdmin && (
        <div className="md:hidden border-t border-border bg-gray-50/95 px-3 py-2 overflow-x-auto flex items-center gap-1.5 whitespace-nowrap text-xs shadow-inner">
          {[
            { href: '/admin/divisions', label: 'Divisiones', icon: '🏢' },
            { href: '/admin/projects',  label: 'Proyectos',  icon: '🏗️' },
            { href: '/admin/roles',     label: 'Roles',      icon: '🔑' },
            { href: '/admin/users',     label: 'Usuarios',   icon: '👥' },
            { href: '/admin/forms',     label: 'Formularios', icon: '📋' },
            { href: '/admin/tools',     label: 'Herramientas', icon: '🛠️' },
          ].map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.2 px-3 py-1.5 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'bg-white text-text-secondary border border-border hover:bg-gray-100'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
