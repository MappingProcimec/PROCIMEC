'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FieldReport } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  FileText,
  Share2,
  FolderOpen,
  ArrowLeft,
  Plus,
  Radio,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface ExtendedFieldReport extends FieldReport {
  projects?: {
    name?: string;
    client?: string;
    cost_center?: string;
    location?: string;
  };
}

async function fetchReports(projectId: string): Promise<ExtendedFieldReport[]> {
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
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            Volver a Mi Panel
          </Link>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Registros de Campo GPR
              </h1>
              <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                {reports.length} {reports.length === 1 ? 'registro' : 'registros'} · {totalML.toFixed(2)} ML explorados
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/new-report`}
              className="btn-primary py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Nuevo Registro
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-20">
        {/* Loading state */}
        {isLoading && (
          <div className="card p-8 text-center text-text-muted text-sm animate-pulse">
            Cargando registros de campo desde la base de datos...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && reports.length === 0 && (
          <div className="card p-10 text-center rounded-xl border border-border">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Radio className="w-7 h-7" strokeWidth={1.75} />
            </div>
            <h3 className="font-bold text-text-primary text-base mb-1">Sin registros aún</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
              Crea tu primer levantamiento de campo GPR con volumetría y generación instantánea de reporte PDF.
            </p>
            <Link
              href={`/projects/${projectId}/new-report`}
              className="btn-primary inline-flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Comenzar Registro
            </Link>
          </div>
        )}

        {/* Reports list */}
        <div className="space-y-3">
          {reports.map((report) => {
            const rows = (Array.isArray(report.operational_summary) ? report.operational_summary : []) as { ml?: number; m2?: number }[];
            const ml = rows.reduce((s: number, r) => s + (Number(r.ml) || 0), 0);
            const m2 = rows.reduce((s: number, r) => s + (Number(r.m2) || 0), 0);
            const status = STATUS_LABELS[report.status] || STATUS_LABELS.submitted;

            const projName = report.projects?.name || 'Proyecto';
            const clientName = report.projects?.client || 'Cliente';
            const formattedDate = report.report_date
              ? format(new Date(report.report_date + 'T00:00:00'), "dd 'de' MMMM yyyy", { locale: es })
              : '—';

            const whatsappMsg = `*PROCIMEC — REPORTE DIARIO GPR*
📁 *Proyecto:* ${projName}
🏢 *Cliente:* ${clientName}
📅 *Fecha:* ${report.report_date}
👷 *Localizador:* ${report.localizador_name || 'Personal Técnico'}
${report.ai_summary ? `\n*Síntesis (IA):*\n${report.ai_summary}\n` : ''}
📄 *Descargar PDF Oficial:*
${report.pdf_report_url || 'Disponible en plataforma'}`;

            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMsg)}`;

            return (
              <div key={report.id} className="card-hover p-4 sm:p-5 rounded-xl border border-border animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Radio className="w-5 h-5" strokeWidth={1.75} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`badge ${status.badge} text-[11px]`}>{status.label}</span>
                        {report.cad_priority && (
                          <span
                            className={`badge text-[11px] ${
                              report.cad_priority === 'Alta'
                                ? 'badge-error'
                                : report.cad_priority === 'Media'
                                ? 'badge-warning'
                                : 'badge-success'
                            }`}
                          >
                            Prioridad {report.cad_priority}
                          </span>
                        )}
                        {report.pdf_report_url && (
                          <span className="badge text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                            PDF Listo
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-text-primary text-sm sm:text-base">
                        {formattedDate}
                        {report.report_time ? ` · ${report.report_time}` : ''}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {report.localizador_name || report.operator_name || 'Localizador'} · {report.gpr_equipment || 'GPR'}
                      </p>

                      {/* AI Summary snippet */}
                      {report.ai_summary && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-bold text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                            <Sparkles className="w-3 h-3" strokeWidth={1.75} />
                            Síntesis Gemini AI
                          </div>
                          <p className="line-clamp-2 italic">{report.ai_summary}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-3 text-xs font-mono">
                        <span className="font-bold text-primary">{ml.toFixed(1)} ML</span>
                        <span className="text-text-muted font-sans">·</span>
                        <span className="font-bold text-primary">{m2.toFixed(1)} M²</span>
                        <span className="text-text-muted font-sans">·</span>
                        <span className="text-text-muted font-sans">
                          {rows.length} {rows.length === 1 ? 'tramo' : 'tramos'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    {report.pdf_report_url && (
                      <a
                        href={report.pdf_report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-sm btn-primary flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1.5"
                        title="Ver y descargar Reporte PDF Oficial"
                      >
                        <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                        Reporte PDF
                      </a>
                    )}

                    {report.pdf_report_url && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1.5"
                        title="Enviar al cliente por WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        WhatsApp
                      </a>
                    )}

                    {report.docx_drive_url && (
                      <a
                        href={report.docx_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-sm btn-outline text-xs flex items-center gap-1"
                        title="Descargar Word"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                        .docx
                      </a>
                    )}

                    {report.drive_session_folder_url && (
                      <a
                        href={report.drive_session_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-sm btn-outline text-xs flex items-center gap-1"
                        title="Ver carpeta en Google Drive"
                      >
                        <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
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
