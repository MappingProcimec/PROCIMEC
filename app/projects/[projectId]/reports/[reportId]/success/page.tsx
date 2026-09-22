'use client';

import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Download,
  Share2,
  Mail,
  FolderOpen,
  Plus,
  ArrowRight,
  Database,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ReportDetails {
  id: string;
  report_date: string;
  localizador_name: string;
  pdf_report_url?: string;
  pdf_storage_path?: string;
  ai_summary?: string;
  docx_drive_url?: string;
  additional_notes?: string;
  projects?: {
    name: string;
    client: string;
    code?: string;
    location?: string;
  };
}

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = (params.projectId as string) || '';
  const reportId = (params.reportId as string) || '';

  const initialPdfUrl = searchParams.get('pdfUrl') || '';
  const folderUrl = searchParams.get('folderUrl') || '';
  const docxUrl = searchParams.get('docxUrl') || '';

  const [report, setReport] = useState<ReportDetails | null>(null);

  useEffect(() => {
    async function loadReportInfo() {
      try {
        const res = await fetch(`/api/reports?projectId=${projectId}`);
        if (res.ok) {
          const json = await res.json();
          const found = (json.data || []).find((r: ReportDetails) => r.id === reportId);
          if (found) {
            setReport(found);
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar detalles del reporte:', err);
      }
    }
    loadReportInfo();
  }, [projectId, reportId]);

  const pdfUrl = report?.pdf_report_url || (report?.docx_drive_url?.includes('http') ? report.docx_drive_url : '') || initialPdfUrl;
  const projectName = report?.projects?.name || 'Proyecto';
  const clientName = report?.projects?.client || 'Cliente';
  const reportDate = report?.report_date || new Date().toISOString().split('T')[0];
  const localizadorName = report?.localizador_name || 'Localizador';
  const aiSummary = report?.ai_summary || report?.additional_notes || '';

  // Texto profesional para WhatsApp
  const whatsappMessage = `*PROCIMEC — REPORTE DIARIO DE OPERACIÓN GPR*
📁 *Proyecto:* ${projectName}
🏢 *Cliente:* ${clientName}
📅 *Fecha:* ${reportDate}
👷 *Localizador Responsable:* ${localizadorName}
${aiSummary ? `\n*Síntesis Técnica Operacional (Google Gemini AI):*\n${aiSummary}\n` : ''}
📄 *Descargar Reporte Oficial (PDF):*
${pdfUrl || 'Disponible en plataforma PROCIMEC'}

_Plataforma Integral PROCIMEC Mapping e Ingeniería_`;

  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  // Enlace para correo (mailto)
  const mailSubject = `Reporte Diario de Operación GPR — ${projectName} — ${reportDate}`;
  const mailBody = `Estimado cliente (${clientName}),\n\nAdjuntamos la información del reporte diario de exploración con Georadar (GPR) correspondiente a la jornada del ${reportDate} en el proyecto ${projectName}.\n\nLocalizador Responsable: ${localizadorName}\n\n${aiSummary ? `Síntesis Técnica (IA):\n${aiSummary}\n\n` : ''}Puede consultar y descargar el Reporte Oficial en PDF en el siguiente enlace:\n${pdfUrl}\n\nAtentamente,\nPROCIMEC Mapping e Ingeniería S.A.S.`;
  const mailHref = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Banner de éxito */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mb-4 shadow-sm">
            <CheckCircle2 className="w-10 h-10" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            ¡Registro Almacenado con Éxito!
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Los datos operativos y archivos han sido guardados de manera segura en Supabase y el reporte oficial ha sido compilado.
          </p>
        </div>

        {/* Tarjeta de Síntesis de Google Gemini AI (si está disponible) */}
        {aiSummary && (
          <div className="card p-5 mb-5 bg-[#1E2229] border border-amber-500/30 text-white rounded-xl shadow-md animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-amber-400">
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              <span className="text-xs font-bold uppercase tracking-wider">
                Síntesis Técnica Operacional (Google Gemini AI)
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {aiSummary}
            </p>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
              <span>Proyecto: <strong className="text-white/80">{projectName}</strong></span>
              <span>Cliente: <strong className="text-white/80">{clientName}</strong></span>
            </div>
          </div>
        )}

        {/* Acciones principales de Distribución */}
        <div className="space-y-3 mb-6">
          {/* Descarga de PDF Oficial */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-center gap-4 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all hover:-translate-y-0.5 group rounded-xl"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
                <FileText className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-text-primary text-sm">Descargar Reporte Diario (PDF Oficial)</p>
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                    Listo
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  Informe ejecutivo de campo con volumetría, hallazgos, síntesis IA y fotos
                </p>
              </div>
              <Download className="w-5 h-5 text-amber-500 group-hover:translate-y-0.5 transition-transform flex-shrink-0" strokeWidth={1.75} />
            </a>
          )}

          {/* Enviar por WhatsApp al Cliente */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="card p-4 flex items-center gap-4 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all hover:-translate-y-0.5 group rounded-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <Share2 className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text-primary text-sm">Enviar Reporte por WhatsApp</p>
              <p className="text-xs text-text-muted mt-0.5">
                Mensaje prediseñado para el cliente con síntesis técnica y enlace al PDF
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" strokeWidth={1.75} />
          </a>

          {/* Enviar por Correo Electrónico */}
          <a
            href={mailHref}
            className="card p-4 flex items-center gap-4 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all hover:-translate-y-0.5 group rounded-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
              <Mail className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text-primary text-sm">Enviar por Correo Electrónico</p>
              <p className="text-xs text-text-muted mt-0.5">
                Abre tu cliente de correo con el asunto y cuerpo redactado para el cliente
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" strokeWidth={1.75} />
          </a>

          {/* Reporte Word en Drive (si está disponible) */}
          {docxUrl && (
            <a
              href={docxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-center gap-4 hover:shadow-sm transition-all hover:-translate-y-0.5 group rounded-xl"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                <FileText className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">Descargar Reporte Word (.docx)</p>
                <p className="text-xs text-text-muted mt-0.5">Versión para edición técnica</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors flex-shrink-0" strokeWidth={1.75} />
            </a>
          )}

          {/* Carpeta en Google Drive (si está disponible) */}
          {folderUrl && (
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-center gap-4 hover:shadow-sm transition-all hover:-translate-y-0.5 group rounded-xl"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500 flex-shrink-0">
                <FolderOpen className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">Abrir carpeta en Google Drive</p>
                <p className="text-xs text-text-muted mt-0.5">Ver réplica en la nube</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors flex-shrink-0" strokeWidth={1.75} />
            </a>
          )}
        </div>

        {/* Resumen de Integridad y Almacenamiento */}
        <div className="card p-5 mb-6 rounded-xl border border-border">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            Integridad del Almacenamiento en Supabase
          </h2>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-text-secondary">Base de datos (field_reports):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Guardado en PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-text-secondary">Archivos y Evidencias (GPR, GPS, Fotos):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Bucket Supabase Storage</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-text-secondary">Síntesis Técnica:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Google Gemini AI</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-text-secondary">Reporte Diario en PDF:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Generado & Almacenado</span>
            </div>
          </div>
        </div>

        {/* Navegación inferior */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link
            href={`/projects/${projectId}/new-report`}
            className="btn-outline justify-center py-3 rounded-xl flex items-center gap-2 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Nuevo Registro
          </Link>
          <Link
            href={projectId ? `/projects/${projectId}/reports` : '/projects'}
            className="btn-primary justify-center py-3 rounded-xl flex items-center gap-2 text-sm font-semibold"
          >
            <Layers className="w-4 h-4" strokeWidth={1.75} />
            Ver Registros
          </Link>
        </div>

        <Link
          href={projectId ? `/projects/${projectId}` : '/projects'}
          className="text-center block text-xs text-text-muted hover:text-amber-500 transition-colors py-2"
        >
          ← Volver a la vista del proyecto
        </Link>
      </div>
    </div>
  );
}
