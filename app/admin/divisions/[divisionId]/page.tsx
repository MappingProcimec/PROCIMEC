'use client';

import { use } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery } from '@tanstack/react-query';

interface Role {
  id: string; name: string; is_system_role: boolean;
  tool_count: number; form_count: number; user_count: number;
}

interface User { id: string; full_name: string; email: string; role_name: string }

interface Project {
  id: string; code: string; name: string; client: string; is_active: boolean;
  total_ml: number; total_drawing_hours: number; report_count: number;
}

interface Stats {
  role_count: number; user_count: number;
  project_total: number; project_active: number;
  total_ml: number; total_drawing_hours: number; total_reports: number;
}

interface DivisionDetail {
  id: string; name: string; description?: string; created_at: string;
  roles?: Role[]; users?: User[]; projects?: Project[]; stats?: Stats;
}

async function fetchDivision(id: string): Promise<DivisionDetail> {
  const res = await fetch(`/api/admin/divisions/${id}`);
  const json = await res.json();
  return json.data;
}

function StatCard({ icon, value, label, sub }: { icon: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-bold text-text-primary leading-tight">{value}</div>
        <div className="text-xs text-text-muted">{label}</div>
        {sub && <div className="text-xs text-text-secondary">{sub}</div>}
      </div>
    </div>
  );
}

export default function DivisionDetailPage({ params }: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = use(params);

  const { data: division, isLoading } = useQuery({
    queryKey: ['admin-division', divisionId],
    queryFn: () => fetchDivision(divisionId),
  });

  const stats = division?.stats;
  const projects = division?.projects ?? [];
  const roles = division?.roles ?? [];
  const users = division?.users ?? [];

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <BackButton href="/admin/divisions" label="Volver a Divisiones" />
          <div className="mt-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {isLoading ? '...' : division?.name}
            </h1>
            {division?.description && (
              <p className="text-white/70 text-sm mt-1">{division.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {isLoading ? (
          <div className="card p-10 text-center text-text-muted animate-pulse">Cargando...</div>
        ) : !division ? (
          <div className="card p-10 text-center text-text-muted">División no encontrada.</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon="👥" value={stats?.role_count ?? 0} label="Roles" />
              <StatCard icon="🧑‍💼" value={stats?.user_count ?? 0} label="Usuarios" />
              <StatCard
                icon="🏗️"
                value={stats?.project_active ?? 0}
                label="Proyectos activos"
                sub={`de ${stats?.project_total ?? 0} totales`}
              />
              <StatCard icon="📏" value={`${(stats?.total_ml ?? 0).toFixed(0)} ml`} label="ML ejecutados" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              <StatCard icon="✏️" value={`${(stats?.total_drawing_hours ?? 0).toFixed(1)} h`} label="Horas CAD" />
              <StatCard icon="📋" value={stats?.total_reports ?? 0} label="Reportes de campo" />
            </div>

            {/* Proyectos */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Proyectos</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    <span className="font-semibold text-success">{stats?.project_active}</span> activos / {stats?.project_total} totales
                  </span>
                </div>
              </div>
              {projects.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay proyectos vinculados a esta división.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Código</th>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Nombre</th>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary hidden md:table-cell">Cliente</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-secondary">Estado</th>
                        <th className="text-right px-4 py-3 font-semibold text-text-secondary">ML</th>
                        <th className="text-right px-4 py-3 font-semibold text-text-secondary">Horas CAD</th>
                        <th className="text-right px-4 py-3 font-semibold text-text-secondary">Reportes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {projects.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/admin/projects`} className="text-xs font-bold text-text-muted hover:text-primary transition-colors">
                              {p.code}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                          <td className="px-4 py-3 text-text-muted hidden md:table-cell">{p.client}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted'}`}>
                              {p.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">
                            {p.total_ml > 0 ? `${p.total_ml} ml` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">
                            {p.total_drawing_hours > 0 ? `${p.total_drawing_hours.toFixed(1)} h` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="badge badge-primary text-xs">{p.report_count}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Roles */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Roles</h2>
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-xs">{roles.length}</span>
                  <Link href="/admin/roles" className="text-xs text-primary font-semibold hover:underline">Gestionar →</Link>
                </div>
              </div>
              {roles.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay roles asignados a esta división.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Nombre</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-secondary">Herramientas</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-secondary">Formularios</th>
                        <th className="text-center px-4 py-3 font-semibold text-text-secondary">Usuarios</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {roles.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-text-primary">{r.name}</span>
                              {r.is_system_role && <span className="badge badge-accent text-xs">Sistema</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="badge badge-primary text-xs">{r.tool_count}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="badge badge-primary text-xs">{r.form_count}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="badge badge-primary text-xs">{r.user_count}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/roles/${r.id}`} className="text-primary text-xs font-semibold hover:underline">
                              Ver →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Usuarios */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Usuarios</h2>
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-xs">{users.length}</span>
                  <Link href="/admin/users" className="text-xs text-primary font-semibold hover:underline">Gestionar →</Link>
                </div>
              </div>
              {users.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay usuarios asignados a esta división.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Nombre</th>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary hidden sm:table-cell">Email</th>
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Rol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary">{u.full_name || '—'}</td>
                          <td className="px-4 py-3 text-text-muted hidden sm:table-cell text-xs">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className="badge badge-accent text-xs">{u.role_name}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Estadísticas */}
            {(stats?.total_reports ?? 0) > 0 && (
              <div className="card shadow-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-gray-50">
                  <h2 className="font-bold text-text-primary">Estadísticas de la División</h2>
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats?.total_reports}</div>
                    <div className="text-xs text-text-muted mt-0.5">Reportes de campo</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{(stats?.total_ml ?? 0).toFixed(0)} ml</div>
                    <div className="text-xs text-text-muted mt-0.5">Total ML ejecutados</div>
                  </div>
                  <div className="text-center col-span-2 sm:col-span-1">
                    <div className="text-2xl font-bold text-accent">{(stats?.total_drawing_hours ?? 0).toFixed(1)} h</div>
                    <div className="text-xs text-text-muted mt-0.5">Horas CAD totales</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
