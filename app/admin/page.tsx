'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  SlidersHorizontal,
  Users,
  Building2,
  Shield,
  FileText,
  Wrench,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Database,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface ConfigStats {
  usersCount: number;
  pendingUsersCount: number;
  projectsCount: number;
  activeProjectsCount: number;
  rolesCount: number;
  formsCount: number;
  toolsCount: number;
  divisionsCount: number;
}

async function fetchAdminConfigStats(): Promise<ConfigStats> {
  const [usersRes, projectsRes, rolesRes, formsRes, toolsRes, divisionsRes] =
    await Promise.allSettled([
      fetch('/api/admin/users', { cache: 'no-store' }),
      fetch('/api/admin/projects', { cache: 'no-store' }),
      fetch('/api/admin/roles', { cache: 'no-store' }),
      fetch('/api/admin/forms', { cache: 'no-store' }),
      fetch('/api/admin/tools', { cache: 'no-store' }),
      fetch('/api/admin/divisions', { cache: 'no-store' }),
    ]);

  const usersData =
    usersRes.status === 'fulfilled' && usersRes.value.ok
      ? await usersRes.value.json()
      : { data: [] };
  const projectsData =
    projectsRes.status === 'fulfilled' && projectsRes.value.ok
      ? await projectsRes.value.json()
      : { data: [] };
  const rolesData =
    rolesRes.status === 'fulfilled' && rolesRes.value.ok
      ? await rolesRes.value.json()
      : { data: [] };
  const formsData =
    formsRes.status === 'fulfilled' && formsRes.value.ok
      ? await formsRes.value.json()
      : { data: [] };
  const toolsData =
    toolsRes.status === 'fulfilled' && toolsRes.value.ok
      ? await toolsRes.value.json()
      : { data: [] };
  const divisionsData =
    divisionsRes.status === 'fulfilled' && divisionsRes.value.ok
      ? await divisionsRes.value.json()
      : { data: [] };

  const users = usersData.data || [];
  const projects = projectsData.data || [];
  const roles = rolesData.data || [];
  const forms = formsData.data || [];
  const tools = toolsData.data || [];
  const divisions = divisionsData.data || [];

  return {
    usersCount: users.length,
    pendingUsersCount: users.filter((u: { role: string }) => u.role === 'pending').length,
    projectsCount: projects.length,
    activeProjectsCount: projects.filter((p: { is_active?: boolean }) => p.is_active !== false).length,
    rolesCount: roles.length,
    formsCount: forms.length,
    toolsCount: tools.length,
    divisionsCount: divisions.length,
  };
}

export default function AdminConfigPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-config-stats'],
    queryFn: fetchAdminConfigStats,
    staleTime: 1000 * 60 * 2,
  });

  const modules = [
    {
      title: 'Usuarios & Accesos',
      href: '/admin/users',
      icon: <Users className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Control de colaboradores, aprobación de nuevas cuentas, perfiles de seguridad y asignación de firmas.',
      statLabel: stats?.pendingUsersCount
        ? `${stats.pendingUsersCount} por aprobar`
        : isLoading
        ? 'Cargando...'
        : `${stats?.usersCount ?? 0} usuarios`,
      badgeAlert: (stats?.pendingUsersCount ?? 0) > 0,
      actionText: 'Administrar usuarios',
    },
    {
      title: 'Proyectos & Centros de Costos',
      href: '/admin/projects',
      icon: <Building2 className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Parametrización de frentes de obra, centros de costos, códigos oficiales, vigencias y cuadrillas vinculadas.',
      statLabel: isLoading ? 'Cargando...' : `${stats?.activeProjectsCount ?? 0} activos`,
      badgeAlert: false,
      actionText: 'Administrar proyectos',
    },
    {
      title: 'Roles & Perfiles Operativos',
      href: '/admin/roles',
      icon: <Shield className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Matriz de cargos canónicos (Almacén, Compras, Comercial, Finanzas, HSEQ, etc.) y jerarquías.',
      statLabel: isLoading ? 'Cargando...' : `${stats?.rolesCount ?? 0} roles`,
      badgeAlert: false,
      actionText: 'Configurar roles',
    },
    {
      title: 'Catálogo de Formularios',
      href: '/admin/forms',
      icon: <FileText className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Habilitación y asignación de formularios operativos de entrada (inspecciones HSEQ, kárdex, novedades y checklists).',
      statLabel: isLoading ? 'Cargando...' : `${stats?.formsCount ?? 0} formularios`,
      badgeAlert: false,
      actionText: 'Configurar formularios',
    },
    {
      title: 'Catálogo de Herramientas',
      href: '/admin/tools',
      icon: <Wrench className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Habilitación de módulos técnicos de consolidación, tableros de gestión, visores de datos y herramientas analíticas.',
      statLabel: isLoading ? 'Cargando...' : `${stats?.toolsCount ?? 0} herramientas`,
      badgeAlert: false,
      actionText: 'Configurar herramientas',
    },
    {
      title: 'Divisiones Corporativas',
      href: '/admin/divisions',
      icon: <Layers className="w-6 h-6 text-accent" strokeWidth={1.75} />,
      desc: 'Estructura departamental de la organización (Geofísica & GPR, Oficina Técnica CAD/BIM, Soporte y Operaciones).',
      statLabel: isLoading ? 'Cargando...' : `${stats?.divisionsCount ?? 0} divisiones`,
      badgeAlert: false,
      actionText: 'Configurar divisiones',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico según AGENTS.md */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto space-y-2">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <SlidersHorizontal className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Configuración de Plataforma
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Centro de control y parametrización de usuarios, proyectos, roles de seguridad y catálogos de PROCIMEC.
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-white/60 capitalize bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 self-start sm:self-auto">
              {format(new Date(), 'MMMM yyyy', { locale: es })}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="max-w-6xl mx-auto px-4 -mt-8 pb-20 space-y-6 w-full flex-1">
        {/* Banner de Estado General */}
        <div className="bg-primary-900 border border-primary-800 rounded-2xl p-5 shadow-card text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Database className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                Arquitectura Relacional & Parámetros Globales
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" strokeWidth={2} />
                  Supabase Activo
                </span>
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Todas las modificaciones de catálogos y permisos aplican en tiempo real al panel operativo unificado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-white/80 self-start sm:self-auto bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
            <Lock className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            <span>Acceso Exclusivo Administrador</span>
          </div>
        </div>

        {/* Cuadrícula de Módulos de Configuración */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Módulos de Configuración de Plataforma
            </h2>
            <span className="text-xs font-mono text-text-muted">
              {modules.length} módulos disponibles
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className="flex flex-col justify-between p-5 rounded-2xl border border-border bg-white hover:border-accent/60 hover:shadow-card transition-all active:scale-[0.98] group relative overflow-hidden"
              >
                {/* Indicador de Alerta de Pendientes */}
                {mod.badgeAlert && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-primary-950 font-bold text-[11px] font-mono border border-amber-500 shadow-xs animate-pulse-soft">
                    <Clock className="w-3 h-3 text-primary-950" strokeWidth={2} />
                    <span>{mod.statLabel}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-primary-50 text-accent group-hover:bg-primary-900 transition-colors">
                      {mod.icon}
                    </div>
                    {!mod.badgeAlert && (
                      <span className="text-xs font-mono font-semibold text-text-secondary bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {mod.statLabel}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary group-hover:text-accent transition-colors">
                  <span>{mod.actionText}</span>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Atajo de Retorno Rápido al Hub */}
        <div className="p-4 rounded-xl border border-border bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            ¿Deseas volver a visualizar tus métricas de producción y formularios de captura?
          </div>
          <Link
            href="/dashboard"
            className="btn-secondary text-xs px-3.5 py-1.5 self-start sm:self-auto flex items-center gap-1.5"
          >
            <span>Ir a Mi Panel</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </main>
    </div>
  );
}
