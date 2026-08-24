'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface DashboardReport {
  id: string;
  report_date: string;
  report_time?: string;
  operator_name?: string;
  cad_priority?: string;
  status: string;
  docx_drive_url?: string;
  drive_session_folder_url?: string;
  operational_summary: { ml?: number; m2?: number }[];
  projects?: { code: string; name: string };
  users?: { full_name: string };
}

interface DrawingActivity {
  id: string;
  project_name: string;
  software: string;
  hours_worked: number;
  is_rework: boolean;
  responsible: string;
  activity_date: string;
}

async function fetchDashboard() {
  const [reportsRes, projectsRes, usersRes, dibujoRes] = await Promise.all([
    fetch('/api/reports'),
    fetch('/api/admin/projects'),
    fetch('/api/admin/users'),
    fetch('/api/dibujo/actividades'),
  ]);
  const reports = (await reportsRes.json()).data || [];
  const projects = (await projectsRes.json()).data || [];
  const users = (await usersRes.json()).users || [];
  const dibujo = Array.isArray(await dibujoRes.json()) ? await (await fetch('/api/dibujo/actividades')).json() : [];
  return { reports, projects, users, dibujo };
}

// Fallback fetch sin re-fetch duplicado
async function fetchDashboardClean() {
  const [reportsRes, projectsRes, usersRes, dibujoRes] = await Promise.all([
    fetch('/api/reports'),
    fetch('/api/admin/projects'),
    fetch('/api/admin/users'),
    fetch('/api/dibujo/actividades'),
  ]);
  const reportsData = await reportsRes.json();
  const projectsData = await projectsRes.json();
  const usersData = await usersRes.json();
  const dibujoData = await dibujoRes.json();

  return {
    reports: reportsData.data || [],
    projects: projectsData.data || [],
    users: usersData.users || [],
    dibujo: Array.isArray(dibujoData) ? dibujoData : [],
  };
}

// ── Componente de panel de área ─────────────────────────────────────────────
function AreaPanel({
  title,
  icon,
  color,
  kpis,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: string;
  color: string;
  kpis: { label: string; value: string | number; sub?: string }[];
  href: string;
  linkLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className={`${color} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h2 className="font-bold text-white text-base leading-tight">{title}</h2>
          </div>
        </div>
        <Link
          href={href}
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {linkLabel} →
        </Link>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-${kpis.length} divide-x divide-border`}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="px-5 py-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{kpi.value}</div>
            <div className="text-xs font-medium text-text-secondary mt-0.5">{kpi.label}</div>
            {kpi.sub && <div className="text-xs text-text-muted mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Optional content slot */}
      {children && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboardClean,
  });

  const reports: DashboardReport[] = data?.reports || [];
  const projects = data?.projects || [];
  const users = data?.users || [];
  const dibujo: DrawingActivity[] = data?.dibujo || [];

  // ── Campo KPIs ──────────────────────────────────────────────────────────────
  const totalML = reports.reduce((sum, r) => {
    const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
    return sum + rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
  }, 0);

  const thisMonth = reports.filter((r) => {
    if (!r.report_date) return false;
    const d = new Date(r.report_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ── Dibujo KPIs ─────────────────────────────────────────────────────────────
  const totalHorasDrawing = dibujo.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);
  const horasReproceso = dibujo.filter((a) => a.is_rework).reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);
  const dibujantesUnicos = new Set(dibujo.map((a) => a.responsible)).size;

  const thisMonthDrawing = dibujo.filter((a) => {
    if (!a.activity_date) return false;
    const d = new Date(a.activity_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ── Usuarios ────────────────────────────────────────────────────────────────
  const activeProjects = projects.filter((p: { is_active: boolean }) => p.is_active);
  const pendingUsers = users.filter((u: { role: string }) => u.role === 'pending');

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard de Administración</h1>
          <p className="text-white/70 text-sm">
            Vista consolidada por área — {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20 space-y-6">

        {/* ── KPI globales ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Proyectos Activos', value: isLoading ? '—' : activeProjects.length, icon: '🏗️', color: 'bg-primary text-white' },
            { label: 'Usuarios Totales', value: isLoading ? '—' : users.length, icon: '👥', color: 'bg-primary-600 text-white' },
            { label: 'Aprobación Pendiente', value: isLoading ? '—' : pendingUsers.length, icon: '⏳', color: pendingUsers.length > 0 ? 'bg-warning text-white' : 'bg-success text-white' },
            { label: 'Total Registros', value: isLoading ? '—' : reports.length + dibujo.length, icon: '📁', color: 'bg-accent text-white' },
          ].map((card) => (
            <div key={card.label} className={`${card.color} rounded-2xl p-5 shadow-card`}>
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold mb-0.5">{card.value}</div>
              <div className="text-sm font-medium opacity-90">{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── Panel: Mapping Campo ─────────────────────────────────────────── */}
        {isLoading ? (
          <Skeleton className="h-44" />
        ) : (
          <AreaPanel
            title="Mapping Campo"
            icon="📍"
            color="bg-gradient-to-r from-primary to-primary-600"
            href="/projects"
            linkLabel="Ver registros"
            kpis={[
              { label: 'Total Registros', value: reports.length },
              { label: 'Este Mes', value: thisMonth.length, sub: format(new Date(), 'MMMM', { locale: es }) },
              { label: 'ML Ejecutados', value: `${totalML.toFixed(0)} ml`, sub: 'Histórico' },
              { label: 'Proyectos Activos', value: activeProjects.length },
            ]}
          >
            {/* Últimos 3 registros de campo */}
            {reports.slice(0, 3).length > 0 && (
              <div className="divide-y divide-border">
                {reports.slice(0, 3).map((r: DashboardReport) => {
                  const ml = (Array.isArray(r.operational_summary) ? r.operational_summary : [])
                    .reduce((s, row) => s + (Number(row.ml) || 0), 0);
                  return (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-text-primary">
                          {(r.projects as { name?: string } | null)?.name || '—'}
                        </span>
                        <span className="text-text-muted ml-2 text-xs">{r.operator_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-semibold text-xs">{ml.toFixed(1)} ml</span>
                        <span className="text-text-muted text-xs">
                          {r.report_date ? format(new Date(r.report_date + 'T00:00:00'), 'dd/MM/yy') : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AreaPanel>
        )}

        {/* ── Panel: Área de Dibujo ─────────────────────────────────────────── */}
        {isLoading ? (
          <Skeleton className="h-44" />
        ) : (
          <AreaPanel
            title="Área de Dibujo"
            icon="✏️"
            color="bg-gradient-to-r from-accent-700 to-accent"
            href="/dibujo/tablero"
            linkLabel="Ver tablero completo"
            kpis={[
              { label: 'Actividades', value: dibujo.length },
              { label: 'Este Mes', value: thisMonthDrawing.length, sub: format(new Date(), 'MMMM', { locale: es }) },
              { label: 'Horas Totales', value: `${totalHorasDrawing.toFixed(1)} h` },
              { label: 'H. Reproceso', value: `${horasReproceso.toFixed(1)} h`, sub: `${dibujantesUnicos} dibujantes` },
            ]}
          >
            {/* Últimas 3 actividades de dibujo */}
            {dibujo.slice(0, 3).length > 0 && (
              <div className="divide-y divide-border">
                {dibujo.slice(0, 3).map((a: DrawingActivity) => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-text-primary">{a.project_name}</span>
                      <span className="text-text-muted ml-2 text-xs">{a.responsible}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.is_rework ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {a.is_rework ? 'Reproceso' : 'Normal'}
                      </span>
                      <span className="text-accent-700 font-semibold text-xs">{Number(a.hours_worked).toFixed(1)} h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AreaPanel>
        )}

        {/* ── Accesos rápidos ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/admin/projects', label: 'Gestión de Proyectos', icon: '🏗️', desc: 'Crear, editar y asignar proyectos' },
            { href: '/admin/users', label: 'Gestión de Usuarios', icon: '👥', desc: 'Roles, permisos y aprobaciones' },
            { href: '/projects', label: 'Vista Operador Campo', icon: '📱', desc: 'Ver como operador de campo' },
          ].map((nav) => (
            <Link key={nav.href} href={nav.href} className="card-hover p-5 flex items-center gap-4">
              <span className="text-3xl">{nav.icon}</span>
              <div>
                <p className="font-semibold text-text-primary">{nav.label}</p>
                <p className="text-xs text-text-muted">{nav.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Tabla completa campo ─────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-text-primary">Todos los Registros de Campo</h2>
            <span className="badge badge-primary">{reports.length}</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Cargando registros...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-text-muted">Sin registros aún</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proyecto</th>
                    <th>Operador</th>
                    <th className="text-right">ML</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r: DashboardReport) => {
                    const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
                    const ml = rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-sm">
                          {r.report_date ? format(new Date(r.report_date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                          {r.report_time && <span className="text-text-muted ml-1 text-xs">{r.report_time}</span>}
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-sm text-text-primary">{(r.projects as { name?: string } | null)?.name || '—'}</p>
                            <p className="text-xs text-text-muted">{(r.projects as { code?: string } | null)?.code}</p>
                          </div>
                        </td>
                        <td className="text-sm">{r.operator_name || '—'}</td>
                        <td className="text-right font-semibold text-primary text-sm">{ml.toFixed(1)}</td>
                        <td>
                          {r.cad_priority ? (
                            <span className={`badge text-xs ${
                              r.cad_priority === 'Alta' ? 'badge-error' :
                              r.cad_priority === 'Media' ? 'badge-warning' : 'badge-success'
                            }`}>{r.cad_priority}</span>
                          ) : <span className="text-text-muted text-xs">—</span>}
                        </td>
                        <td>
                          <span className={`badge text-xs ${
                            r.status === 'submitted' ? 'badge-success' :
                            r.status === 'reviewed' ? 'badge-primary' : 'badge-warning'
                          }`}>
                            {r.status === 'submitted' ? 'Enviado' : r.status === 'reviewed' ? 'Revisado' : 'Borrador'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {r.docx_drive_url && (
                              <a href={r.docx_drive_url} target="_blank" rel="noopener noreferrer"
                                className="btn-sm btn-primary py-1 text-xs">.docx</a>
                            )}
                            {r.drive_session_folder_url && (
                              <a href={r.drive_session_folder_url} target="_blank" rel="noopener noreferrer"
                                className="btn-sm btn-ghost py-1 text-xs">Drive</a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
