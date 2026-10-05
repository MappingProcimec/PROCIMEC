'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LayoutDashboard,
  Building2,
  Activity,
  PenTool,
  Clock,
  Shield,
  Users,
  FileText,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface Division {
  id: string;
  name: string;
  description?: string;
  role_count: number;
}

interface Role {
  id: string;
  name: string;
  division_id: string | null;
}

interface Report {
  operational_summary: { ml?: number }[];
}

interface DrawingActivity {
  hours_worked: number;
}

async function fetchDashboardData() {
  const [projectsRes, usersRes, divisionsRes, rolesRes, reportsRes, dibujoRes] = await Promise.all([
    fetch('/api/admin/projects', { cache: 'no-store' }),
    fetch('/api/admin/users', { cache: 'no-store' }),
    fetch('/api/admin/divisions', { cache: 'no-store' }),
    fetch('/api/admin/roles', { cache: 'no-store' }),
    fetch('/api/reports', { cache: 'no-store' }),
    fetch('/api/dibujo/actividades', { cache: 'no-store' }),
  ]);
  return {
    projects: (await projectsRes.json()).data || [],
    users: (await usersRes.json()).data || [],
    divisions: (await divisionsRes.json()).data || [],
    roles: (await rolesRes.json()).data || [],
    reports: (await reportsRes.json()).data || [],
    dibujo: await dibujoRes.json().then((d) => (Array.isArray(d) ? d : [])),
  };
}

interface KpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  cardClass: string;
  href?: string;
}

function KpiCard({ icon, value, label, cardClass, href }: KpiCardProps) {
  const inner = (
    <div
      className={`rounded-2xl p-5 shadow-card h-full transition-all border ${cardClass} ${
        href ? 'hover:shadow-glow-accent cursor-pointer active:scale-[0.98]' : ''
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="p-2 rounded-xl bg-black/10 backdrop-blur-xs">{icon}</div>
        {href && <ArrowRight className="w-4 h-4 opacity-60" strokeWidth={1.75} />}
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight mb-0.5">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardData,
  });

  const projects = data?.projects || [];
  const users = data?.users || [];
  const divisions: Division[] = data?.divisions || [];
  const roles: Role[] = data?.roles || [];
  const reports: Report[] = data?.reports || [];
  const dibujo: DrawingActivity[] = data?.dibujo || [];

  const activeProjects = projects.filter((p: { is_active?: boolean }) => p.is_active !== false);
  const pendingUsers = users.filter((u: { role: string }) => u.role === 'pending');

  const totalML = reports.reduce((sum, r) => {
    const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
    return sum + rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
  }, 0);

  const totalHoras = dibujo.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);

  const rolesByDivision = roles.reduce<Record<string, number>>((acc, r) => {
    if (r.division_id) acc[r.division_id] = (acc[r.division_id] ?? 0) + 1;
    return acc;
  }, {});

  interface UserWithRole {
    role_id?: string | null;
    roles?: { id: string } | null;
  }
  const usersByDivision = (users as UserWithRole[]).reduce((acc: Record<string, number>, u) => {
    const roleId = u.role_id ?? u.roles?.id;
    if (!roleId) return acc;
    const role = roles.find((r: Role) => r.id === roleId);
    if (role?.division_id) acc[role.division_id] = (acc[role.division_id] ?? 0) + 1;
    return acc;
  }, {});

  const kpis: KpiCardProps[] = [
    {
      label: 'Proyectos Activos',
      value: isLoading ? '—' : activeProjects.length,
      icon: <Building2 className="w-5 h-5 text-accent" strokeWidth={1.75} />,
      cardClass: 'bg-primary-900 text-white border-primary-800',
      href: '/admin/projects',
    },
    {
      label: 'ML Ejecutados',
      value: isLoading ? '—' : `${totalML.toFixed(0)} ml`,
      icon: <Activity className="w-5 h-5 text-accent" strokeWidth={1.75} />,
      cardClass: 'bg-primary-900 text-white border-primary-800',
    },
    {
      label: 'Horas CAD / BIM',
      value: isLoading ? '—' : `${totalHoras.toFixed(1)} h`,
      icon: <PenTool className="w-5 h-5 text-primary-950" strokeWidth={1.75} />,
      cardClass: 'bg-accent text-primary-950 border-amber-500 font-bold',
    },
    {
      label: 'Aprobación Pendiente',
      value: isLoading ? '—' : pendingUsers.length,
      icon: <Clock className="w-5 h-5 text-primary-950" strokeWidth={1.75} />,
      cardClass:
        pendingUsers.length > 0
          ? 'bg-amber-400 text-primary-950 border-amber-500 font-bold animate-pulse-soft'
          : 'bg-primary-900 text-white border-primary-800',
      href: '/admin/users',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico según AGENTS.md */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto space-y-2">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <LayoutDashboard className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Panel de Administración
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Visión global de proyectos, colaboradores, roles operativos y métricas de producción.
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-white/60 capitalize bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 self-start sm:self-auto">
              {format(new Date(), "MMMM yyyy", { locale: es })}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-8 pb-20 space-y-6 w-full flex-1">
        {/* Tarjetas KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Accesos Rápidos Corporativos (Cero Emojis) */}
        <div>
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2.5">
            Módulos de Configuración
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                href: '/admin/projects',
                icon: <Building2 className="w-5 h-5 text-accent" strokeWidth={1.75} />,
                label: 'Proyectos',
                desc: 'Centros de costos y frentes',
              },
              {
                href: '/admin/roles',
                icon: <Shield className="w-5 h-5 text-accent" strokeWidth={1.75} />,
                label: 'Roles',
                desc: 'Perfiles y permisos',
              },
              {
                href: '/admin/users',
                icon: <Users className="w-5 h-5 text-accent" strokeWidth={1.75} />,
                label: 'Usuarios',
                desc: 'Colaboradores y accesos',
              },
              {
                href: '/admin/forms',
                icon: <FileText className="w-5 h-5 text-accent" strokeWidth={1.75} />,
                label: 'Formularios',
                desc: 'Catálogo de inspecciones',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col p-4 rounded-xl border border-border bg-white hover:border-accent/60 hover:shadow-card transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-primary-50 text-accent group-hover:bg-primary-900 transition-colors">
                    {item.icon}
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <span className="font-bold text-sm text-text-primary">{item.label}</span>
                <span className="text-xs text-text-muted mt-0.5">{item.desc}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Divisiones Operativas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" strokeWidth={1.75} />
              Divisiones Operativas
            </h2>
            <Link
              href="/admin/divisions"
              className="text-xs text-primary font-semibold hover:text-accent transition-colors flex items-center gap-1"
            >
              <span>Gestionar divisiones</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse bg-gray-200 rounded-2xl" />
              ))}
            </div>
          ) : divisions.length === 0 ? (
            <div className="card p-10 text-center border border-border">
              <p className="text-text-muted text-sm">No hay divisiones registradas.</p>
              <Link
                href="/admin/divisions"
                className="mt-2 inline-block text-primary text-sm font-semibold hover:underline"
              >
                Crear primera división →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {divisions.map((div) => {
                const roleCount = div.role_count ?? rolesByDivision[div.id] ?? 0;
                const userCount = usersByDivision[div.id] ?? 0;
                const divRoles = roles.filter((r: Role) => r.division_id === div.id);
                return (
                  <div
                    key={div.id}
                    className="bg-white rounded-2xl border border-border shadow-card overflow-hidden flex flex-col"
                  >
                    {/* Header Técnico */}
                    <div className="bg-primary-900 border-b border-primary-800 px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">{div.name}</h3>
                        {div.description && (
                          <p className="text-white/70 text-xs mt-0.5">{div.description}</p>
                        )}
                      </div>
                      <Link
                        href={`/admin/divisions/${div.id}`}
                        className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                      >
                        Gestionar →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-border bg-slate-50/50">
                      <div className="px-5 py-3.5 text-center">
                        <div className="text-2xl font-bold font-mono text-text-primary">{roleCount}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mt-0.5">
                          Roles
                        </div>
                      </div>
                      <div className="px-5 py-3.5 text-center">
                        <div className="text-2xl font-bold font-mono text-text-primary">{userCount}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mt-0.5">
                          Usuarios
                        </div>
                      </div>
                    </div>

                    {divRoles.length > 0 && (
                      <div className="border-t border-border px-5 py-3 flex flex-wrap gap-1.5 mt-auto bg-white">
                        {divRoles.map((r: Role) => (
                          <Link
                            key={r.id}
                            href={`/admin/roles/${r.id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 hover:border-accent hover:text-accent transition-colors"
                          >
                            {r.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

