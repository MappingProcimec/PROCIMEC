'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Role {
  id: string; name: string; is_system_role: boolean;
  tool_count: number; form_count: number; user_count: number;
}

interface User { id: string; full_name: string; email: string; role_name: string }

interface Project {
  id: string; code: string; cost_center?: string; name: string; client: string; is_active: boolean;
  total_ml: number; total_drawing_hours: number;
  report_count: number; field_report_count: number; drawing_count: number;
}

interface Stats {
  role_count: number; user_count: number;
  project_total: number; project_active: number;
  total_ml: number; total_drawing_hours: number;
  total_reports: number; total_field_reports: number; total_drawing_records: number;
}

interface DivisionActivityLog {
  id: string;
  date: string;
  type: string;
  form_name: string;
  project_name: string;
  project_code: string;
  localizador_name?: string;
  operator_name?: string;
  detail: string;
  status: string;
  url: string | null;
  created_at?: string;
}

interface DivisionDetail {
  id: string; name: string; description?: string; created_at: string;
  roles?: Role[]; users?: User[]; projects?: Project[]; stats?: Stats;
  activity_logs?: DivisionActivityLog[];
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

export default function DivisionDetailPage({ params }: { params: { divisionId: string } }) {
  const { divisionId } = params;
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 10;

  const { data: division, isLoading } = useQuery({
    queryKey: ['admin-division', divisionId],
    queryFn: () => fetchDivision(divisionId),
  });

  const stats = division?.stats;
  const projects = useMemo(() => division?.projects ?? [], [division?.projects]);
  const roles = division?.roles ?? [];
  const users = division?.users ?? [];
  const activityLogs = useMemo(() => division?.activity_logs ?? [], [division?.activity_logs]);

  const totalLogPages = Math.ceil(activityLogs.length / LOGS_PER_PAGE) || 1;
  const currentLogs = activityLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  const [isMounted, setIsMounted] = useState(false);
  const [chartFilter, setChartFilter] = useState<'with_forms' | 'all'>('with_forms');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── Datos para Gráfico 1: Barras de Formularios por Proyecto ──
  const allProjectsChartData = useMemo(() => {
    return (projects || [])
      .map((p) => ({
        name: p.name,
        shortName: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name,
        code: p.cost_center || p.code || '',
        formularios: p.report_count ?? 0,
        horas: p.total_drawing_hours ?? 0,
        isActive: p.is_active,
      }))
      .sort((a, b) => b.formularios - a.formularios);
  }, [projects]);

  const projectsWithForms = useMemo(() => {
    return allProjectsChartData.filter((p) => p.formularios > 0);
  }, [allProjectsChartData]);

  const displayedProjectsData = chartFilter === 'with_forms' && projectsWithForms.length > 0
    ? projectsWithForms
    : allProjectsChartData;

  const totalFormsCount = useMemo(() => {
    return allProjectsChartData.reduce((acc, p) => acc + p.formularios, 0);
  }, [allProjectsChartData]);

  // Promedio de formularios por proyecto
  const avgForms = useMemo(() => {
    return allProjectsChartData.length > 0
      ? parseFloat((totalFormsCount / allProjectsChartData.length).toFixed(1))
      : 0;
  }, [allProjectsChartData, totalFormsCount]);

  // ── Datos para Gráfico 2: Torta de Tipos de Formularios ──
  const formTypesChartData = useMemo(() => {
    const map = new Map<string, number>();
    activityLogs.forEach((log) => {
      const typeKey = log.form_name || log.type || 'Otro';
      map.set(typeKey, (map.get(typeKey) || 0) + 1);
    });

    if (map.size === 0) {
      if ((stats?.total_drawing_records ?? 0) > 0) {
        map.set('Registro CAD / BIM', stats!.total_drawing_records);
      }
      if ((stats?.total_field_reports ?? 0) > 0) {
        map.set('Formulario Campo GPR', stats!.total_field_reports);
      }
    }

    const COLORS: Record<string, string> = {
      'Registro CAD / BIM': '#f59e0b',
      'Formulario Campo GPR': '#3b82f6',
      'CAD/BIM': '#f59e0b',
      'Campo GPR': '#3b82f6',
      'Otro': '#8b5cf6',
    };
    const FALLBACK_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: COLORS[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }));
  }, [activityLogs, stats]);

  // ── Datos para Gráfico 3: Torta de Proyectos Activos vs Inactivos ──
  const projectStatusChartData = useMemo(() => {
    const active = stats?.project_active ?? projects.filter((p) => p.is_active).length;
    const total = stats?.project_total ?? projects.length;
    const inactive = Math.max(0, total - active);

    return [
      { name: 'Activos', value: active, color: '#10b981' },
      { name: 'Inactivos', value: inactive, color: '#94a3b8' },
    ];
  }, [stats, projects]);

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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard icon="✏️" value={`${(stats?.total_drawing_hours ?? 0).toFixed(1)} h`} label="Horas CAD" />
              <StatCard icon="📍" value={stats?.total_field_reports ?? 0} label="Reportes de campo" />
              <StatCard icon="🖊️" value={stats?.total_drawing_records ?? 0} label="Registros de dibujo" />
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
                        <th className="text-left px-4 py-3 font-semibold text-text-secondary">Centro de Costo</th>
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
                              {p.cost_center || p.code || '—'}
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
                            <div className="flex flex-col items-end gap-0.5">
                              {p.field_report_count > 0 && (
                                <span className="badge bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5">📍 {p.field_report_count}</span>
                              )}
                              {p.drawing_count > 0 && (
                                <span className="badge bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5">✏️ {p.drawing_count}</span>
                              )}
                              {p.report_count === 0 && (
                                <span className="text-xs text-text-muted">—</span>
                              )}
                            </div>
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

            {/* Logs de la División (Historial de Formularios y Registros) */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-bold text-text-primary flex items-center gap-2">
                    <span>📜</span> Logs de la División (Historial de Formularios)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Registros y envíos ordenados de más reciente a más antiguo (10 por página)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-xs">{activityLogs.length} registros</span>
                </div>
              </div>

              {activityLogs.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay registros ni formularios realizados en esta división aún.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-text-secondary">Fecha</th>
                          <th className="text-left px-4 py-3 font-semibold text-text-secondary">Formulario</th>
                          <th className="text-left px-4 py-3 font-semibold text-text-secondary">Proyecto</th>
                          <th className="text-left px-4 py-3 font-semibold text-text-secondary hidden sm:table-cell">Responsable</th>
                          <th className="text-left px-4 py-3 font-semibold text-text-secondary">Detalle</th>
                          <th className="text-center px-4 py-3 font-semibold text-text-secondary">Estado</th>
                          <th className="text-right px-4 py-3 font-semibold text-text-secondary">Documento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                              {log.date ? new Date(log.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                log.type === 'Campo GPR' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {log.type === 'Campo GPR' ? '📍' : '✏️'} {log.form_name}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-text-primary text-xs">{log.project_name}</div>
                              {log.project_code && log.project_code !== '—' && (
                                <div className="text-[10px] text-text-muted font-bold">{log.project_code}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-muted hidden sm:table-cell">
                              {log.localizador_name || log.operator_name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-text-primary font-medium">
                              {log.detail}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-text-secondary">
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {log.url ? (
                                <a
                                  href={log.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                                >
                                  📄 Ver doc
                                </a>
                              ) : (
                                <span className="text-xs text-text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {totalLogPages > 1 && (
                    <div className="px-5 py-3 border-t border-border bg-gray-50 flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        Página <span className="font-bold text-text-primary">{logPage}</span> de{' '}
                        <span className="font-bold text-text-primary">{totalLogPages}</span> ({activityLogs.length} total)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                          disabled={logPage === 1}
                          className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                        >
                          ← Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                          disabled={logPage === totalLogPages}
                          className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                        >
                          Siguiente →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {((stats?.total_reports ?? 0) > 0 || (stats?.total_drawing_hours ?? 0) > 0) && (
              <div className="card shadow-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-gray-50">
                  <h2 className="font-bold text-text-primary">Estadísticas de la División</h2>
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{stats?.total_field_reports ?? 0}</div>
                    <div className="text-xs text-text-muted mt-0.5">Reportes de campo</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{(stats?.total_ml ?? 0).toFixed(0)} ml</div>
                    <div className="text-xs text-text-muted mt-0.5">Total ML ejecutados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">{(stats?.total_drawing_hours ?? 0).toFixed(1)} h</div>
                    <div className="text-xs text-text-muted mt-0.5">Horas CAD totales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">{stats?.total_drawing_records ?? 0}</div>
                    <div className="text-xs text-text-muted mt-0.5">Registros de dibujo</div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Sección de Gráficos Analíticos ─── */}
            <div className="space-y-6 pt-2">
              {/* Gráfico 1: Barras de Formularios Llenados por Proyecto con Línea Roja de Promedio */}
              <div className="card shadow-xl border border-border p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                      <span>📊</span> Formularios Llenados por Proyecto
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Comparativa de formularios por proyecto con línea roja que señala el promedio general ({avgForms} formularios/proyecto)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-xl text-xs font-semibold">
                      <span className="w-3 h-0.5 bg-red-500 rounded-full inline-block"></span>
                      Promedio: {avgForms}
                    </div>
                    {projectsWithForms.length < allProjectsChartData.length && (
                      <div className="inline-flex bg-gray-100 p-0.5 rounded-xl text-xs">
                        <button
                          type="button"
                          onClick={() => setChartFilter('with_forms')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            chartFilter === 'with_forms'
                              ? 'bg-white font-bold text-primary shadow-xs'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          Con registros ({projectsWithForms.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartFilter('all')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            chartFilter === 'all'
                              ? 'bg-white font-bold text-primary shadow-xs'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          Todos ({allProjectsChartData.length})
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!isMounted ? (
                  <div className="h-[340px] bg-gray-50 animate-pulse rounded-xl flex items-center justify-center text-xs text-text-muted">
                    Cargando gráfico de barras...
                  </div>
                ) : displayedProjectsData.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
                    No hay proyectos para graficar.
                  </div>
                ) : (
                  <div className="w-full h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={displayedProjectsData}
                        margin={{ top: 25, right: 30, left: 0, bottom: 65 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="shortName"
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-border rounded-xl shadow-xl text-xs space-y-1">
                                  <p className="font-bold text-text-primary text-sm">{d.name}</p>
                                  {d.code && <p className="text-text-muted font-mono">{d.code}</p>}
                                  <p className="text-primary font-semibold">
                                    📋 Formularios llenados: <span className="font-bold text-sm">{d.formularios}</span>
                                  </p>
                                  {d.horas > 0 && (
                                    <p className="text-accent font-semibold">
                                      ⏱️ Horas CAD: <span className="font-bold">{d.horas.toFixed(1)} h</span>
                                    </p>
                                  )}
                                  <p className="text-text-muted text-[10px] mt-1 pt-1 border-t border-border">
                                    {d.isActive ? '🟢 Proyecto Activo' : '⚪ Proyecto Inactivo'}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine
                          y={avgForms}
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{
                            value: `Promedio: ${avgForms}`,
                            position: 'top',
                            fill: '#dc2626',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        />
                        <Bar
                          dataKey="formularios"
                          name="Formularios Llenados"
                          fill="#2563eb"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Gráficos de Torta: Tipos de Formularios y Proyectos Activos vs Inactivos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Torta 1: Tipos de Formularios Llenados */}
                <div className="card shadow-xl border border-border p-5 space-y-4">
                  <div className="border-b border-border pb-3">
                    <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                      <span>🥧</span> Tipos de Formularios Llenados
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Distribución según formato diligenciado (Dibujo CAD/BIM vs Campo GPR)
                    </p>
                  </div>

                  {!isMounted ? (
                    <div className="h-[280px] bg-gray-50 animate-pulse rounded-xl" />
                  ) : formTypesChartData.length === 0 || formTypesChartData.every((d) => d.value === 0) ? (
                    <div className="h-[240px] flex items-center justify-center text-xs text-text-muted">
                      Sin registros de formularios
                    </div>
                  ) : (
                    <div className="w-full h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={formTypesChartData}
                            cx="50%"
                            cy="46%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                          >
                            {formTypesChartData.map((entry, index) => (
                              <Cell key={`cell-form-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => [
                              `${Number(value)} formularios`,
                              String(name),
                            ]}
                            contentStyle={{ borderRadius: '0.75rem', borderColor: '#e2e8f0', fontSize: '12px' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Torta 2: Proyectos Activos vs Inactivos */}
                <div className="card shadow-xl border border-border p-5 space-y-4">
                  <div className="border-b border-border pb-3">
                    <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                      <span>🎯</span> Proyectos Activos vs Inactivos
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Estado de los proyectos en la división ({stats?.project_active ?? 0} activos de {stats?.project_total ?? 0})
                    </p>
                  </div>

                  {!isMounted ? (
                    <div className="h-[280px] bg-gray-50 animate-pulse rounded-xl" />
                  ) : (
                    <div className="w-full h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectStatusChartData}
                            cx="50%"
                            cy="46%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                          >
                            {projectStatusChartData.map((entry, index) => (
                              <Cell key={`cell-status-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => [
                              `${Number(value)} proyectos`,
                              String(name),
                            ]}
                            contentStyle={{ borderRadius: '0.75rem', borderColor: '#e2e8f0', fontSize: '12px' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
