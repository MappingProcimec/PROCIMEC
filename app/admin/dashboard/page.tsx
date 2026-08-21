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

async function fetchDashboard() {
  const [reportsRes, projectsRes] = await Promise.all([
    fetch('/api/reports'),
    fetch('/api/admin/projects'),
  ]);
  const reports = (await reportsRes.json()).data || [];
  const projects = (await projectsRes.json()).data || [];
  return { reports, projects };
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchDashboard });

  const reports: DashboardReport[] = data?.reports || [];
  const projects = data?.projects || [];

  const totalML = reports.reduce((sum: number, r: DashboardReport) => {
    const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
    return sum + rows.reduce((s: number, row) => s + (Number(row.ml) || 0), 0);
  }, 0);

  const thisMonth = reports.filter((r: DashboardReport) => {
    if (!r.report_date) return false;
    const d = new Date(r.report_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const activeProjects = projects.filter((p: { is_active: boolean }) => p.is_active);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard de Administración</h1>
          <p className="text-white/70 text-sm">Vista general de PROCIMEC — Mapping Ingeniería</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total ML Ejecutados',
              value: `${totalML.toFixed(1)} ml`,
              icon: '📐',
              color: 'bg-primary text-white',
              sub: 'Todos los proyectos',
            },
            {
              label: 'Registros Este Mes',
              value: thisMonth.length,
              icon: '📋',
              color: 'bg-success text-white',
              sub: format(new Date(), 'MMMM yyyy', { locale: es }),
            },
            {
              label: 'Total Registros',
              value: reports.length,
              icon: '📁',
              color: 'bg-accent text-white',
              sub: 'Histórico completo',
            },
            {
              label: 'Proyectos Activos',
              value: activeProjects.length,
              icon: '🏗️',
              color: 'bg-primary-600 text-white',
              sub: `${projects.length} proyectos en total`,
            },
          ].map(card => (
            <div key={card.label} className={`${card.color} rounded-2xl p-5 shadow-card animate-fade-in`}>
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold mb-0.5">{isLoading ? '—' : card.value}</div>
              <div className="text-sm font-medium opacity-90">{card.label}</div>
              <div className="text-xs opacity-70 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/admin/projects', label: 'Gestión de Proyectos', icon: '🏗️', desc: 'Crear, editar y asignar proyectos' },
            { href: '/admin/users', label: 'Gestión de Usuarios', icon: '👥', desc: 'Roles, permisos y activación' },
            { href: '/projects', label: 'Vista Operador', icon: '📱', desc: 'Ver como operador de campo' },
          ].map(nav => (
            <Link key={nav.href} href={nav.href} className="card-hover p-5 flex items-center gap-4">
              <span className="text-3xl">{nav.icon}</span>
              <div>
                <p className="font-semibold text-text-primary">{nav.label}</p>
                <p className="text-xs text-text-muted">{nav.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Master reports table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-text-primary">Todos los Registros</h2>
            <span className="badge badge-primary">{reports.length}</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Cargando registros...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-text-muted">Sin registros registrados aún</div>
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
                            }`}>
                              {r.cad_priority}
                            </span>
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
                                className="btn-sm btn-primary py-1 text-xs" title="Descargar Word">
                                .docx
                              </a>
                            )}
                            {r.drive_session_folder_url && (
                              <a href={r.drive_session_folder_url} target="_blank" rel="noopener noreferrer"
                                className="btn-sm btn-ghost py-1 text-xs" title="Ver Drive">
                                Drive
                              </a>
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
