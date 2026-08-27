'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

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

async function fetchDashboardData() {
  const [projectsRes, usersRes, divisionsRes, rolesRes] = await Promise.all([
    fetch('/api/admin/projects'),
    fetch('/api/admin/users'),
    fetch('/api/admin/divisions'),
    fetch('/api/admin/roles'),
  ]);
  return {
    projects: (await projectsRes.json()).data || [],
    users: (await usersRes.json()).data || [],
    divisions: (await divisionsRes.json()).data || [],
    roles: (await rolesRes.json()).data || [],
  };
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

  const activeProjects = projects.filter((p: { is_active?: boolean }) => p.is_active !== false);
  const pendingUsers = users.filter((u: { role: string }) => u.role === 'pending');

  // Build role count per division from roles list (as fallback if division.role_count missing)
  const rolesByDivision = roles.reduce<Record<string, number>>((acc, r) => {
    if (r.division_id) acc[r.division_id] = (acc[r.division_id] ?? 0) + 1;
    return acc;
  }, {});

  // Build user count per division
  interface UserWithRole { role_id?: string | null; roles?: { id: string } | null }
  const usersByDivision = (users as UserWithRole[]).reduce((acc: Record<string, number>, u) => {
    const roleId = u.role_id ?? u.roles?.id;
    if (!roleId) return acc;
    const role = roles.find((r: Role) => r.id === roleId);
    if (role?.division_id) acc[role.division_id] = (acc[role.division_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-white/70 text-sm">
            {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Proyectos Activos', value: isLoading ? '—' : activeProjects.length, icon: '🏗️', color: 'bg-primary text-white' },
            { label: 'Usuarios Totales', value: isLoading ? '—' : users.length, icon: '👥', color: 'bg-primary-600 text-white' },
            { label: 'Divisiones', value: isLoading ? '—' : divisions.length, icon: '🏢', color: 'bg-accent text-white' },
            { label: 'Pendientes', value: isLoading ? '—' : pendingUsers.length, icon: '⏳', color: pendingUsers.length > 0 ? 'bg-warning text-white' : 'bg-success text-white' },
          ].map((card) => (
            <div key={card.label} className={`${card.color} rounded-2xl p-5 shadow-card`}>
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold mb-0.5">{card.value}</div>
              <div className="text-sm font-medium opacity-90">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Divisiones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text-primary">Divisiones</h2>
            <Link href="/admin/divisions" className="text-xs text-primary font-semibold hover:underline">
              Gestionar →
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-36 animate-pulse bg-gray-200 rounded-2xl" />
              ))}
            </div>
          ) : divisions.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-text-muted text-sm">No hay divisiones creadas.</p>
              <Link href="/admin/divisions" className="mt-2 inline-block text-primary text-sm font-medium hover:underline">
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
                  <div key={div.id} className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-primary-600 px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">{div.name}</h3>
                        {div.description && (
                          <p className="text-white/70 text-xs mt-0.5">{div.description}</p>
                        )}
                      </div>
                      <Link
                        href={`/admin/divisions/${div.id}`}
                        className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Gestionar →
                      </Link>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="px-5 py-4 text-center">
                        <div className="text-2xl font-bold text-text-primary">{roleCount}</div>
                        <div className="text-xs font-medium text-text-secondary mt-0.5">Roles</div>
                      </div>
                      <div className="px-5 py-4 text-center">
                        <div className="text-2xl font-bold text-text-primary">{userCount}</div>
                        <div className="text-xs font-medium text-text-secondary mt-0.5">Usuarios</div>
                      </div>
                    </div>

                    {/* Roles list */}
                    {divRoles.length > 0 && (
                      <div className="border-t border-border px-5 py-3 flex flex-wrap gap-1.5">
                        {divRoles.map((r: Role) => (
                          <Link
                            key={r.id}
                            href={`/admin/roles/${r.id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary hover:bg-primary-100 transition-colors"
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
