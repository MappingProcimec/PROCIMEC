'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FieldReport } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

async function fetchReports(projectId: string): Promise<FieldReport[]> {
  const res = await fetch(`/api/reports?projectId=${projectId}`);
  if (!res.ok) throw new Error('Error al cargar registros');
  const data = await res.json();
  return data.data || [];
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  submitted: { label: 'Enviado', badge: 'badge-success' },
  draft: { label: 'Borrador', badge: 'badge-warning' },
  reviewed: { label: 'Revisado', badge: 'badge-primary' },
};

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => fetchReports(projectId),
  });

  const totalML = reports.reduce((sum, r) => {
    const rows = (Array.isArray(r.operational_summary) ? r.operational_summary : []) as { ml?: number }[];
    return sum + rows.reduce((s: number, row) => s + (Number(row.ml) || 0), 0);
  }, 0);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <Link href="/projects" className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver a proyectos
          </Link>
          <h1 className="text-2xl font-bold text-white mb-1">Registros de Campo</h1>
          <p className="text-white/70 text-sm">{reports.length} registros · {totalML.toFixed(2)} ML total</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-10 pb-20">
        {/* New report shortcut */}
        <Link
          href={`/projects/${projectId}/new-report`}
          className="card mb-5 p-4 flex items-center gap-4 bg-primary text-white hover:bg-primary-600 transition-colors shadow-glow"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold">+ Nuevo Registro de Campo</p>
            <p className="text-white/70 text-xs">Iniciar formulario de 5 pasos</p>
          </div>
          <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && reports.length === 0 && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Sin registros aún</h3>
            <p className="text-sm text-text-muted">Crea tu primer registro de campo para este proyecto</p>
          </div>
        )}

        {/* Reports list */}
        <div className="space-y-3">
          {reports.map(report => {
            const rows = (Array.isArray(report.operational_summary) ? report.operational_summary : []) as { ml?: number; m2?: number }[];
            const ml = rows.reduce((s: number, r) => s + (Number(r.ml) || 0), 0);
            const m2 = rows.reduce((s: number, r) => s + (Number(r.m2) || 0), 0);
            const status = STATUS_LABELS[report.status] || STATUS_LABELS.submitted;

            return (
              <div key={report.id} className="card-hover p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge ${status.badge} text-xs`}>{status.label}</span>
                      {report.cad_priority && (
                        <span className={`badge text-xs ${
                          report.cad_priority === 'Alta' ? 'badge-error' :
                          report.cad_priority === 'Media' ? 'badge-warning' : 'badge-success'
                        }`}>
                          Prioridad {report.cad_priority}
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-text-primary text-sm">
                      {report.report_date ? format(new Date(report.report_date + 'T00:00:00'), "dd 'de' MMMM yyyy", { locale: es }) : '—'}
                      {report.report_time ? ` · ${report.report_time}` : ''}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{report.operator_name} · {report.gpr_equipment}</p>

                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="font-semibold text-primary">{ml.toFixed(1)} ML</span>
                      <span className="text-text-muted">·</span>
                      <span className="font-semibold text-primary">{m2.toFixed(1)} M²</span>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-muted">{rows.length} tramo{rows.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {report.docx_drive_url && (
                      <a href={report.docx_drive_url} target="_blank" rel="noopener noreferrer"
                        className="btn-sm btn-primary" title="Descargar Word">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        .docx
                      </a>
                    )}
                    {report.drive_session_folder_url && (
                      <a href={report.drive_session_folder_url} target="_blank" rel="noopener noreferrer"
                        className="btn-sm btn-outline text-xs" title="Ver en Drive">
                        Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
