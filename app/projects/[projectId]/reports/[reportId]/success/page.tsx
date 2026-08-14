'use client';

import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const reportId = params.reportId as string;
  const folderUrl = searchParams.get('folderUrl') || '';
  const docxUrl = searchParams.get('docxUrl') || '';
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10 pb-20">
        {/* Success animation */}
        <div className="text-center mb-8 animate-slide-up">
          <div className={`inline-flex items-center justify-center w-24 h-24 bg-success rounded-3xl mb-5 shadow-lg transition-transform duration-500 ${showConfetti ? 'scale-110' : 'scale-100'}`}>
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">¡Registro guardado exitosamente!</h1>
          <p className="text-text-secondary text-sm">
            El reporte técnico ha sido generado y los archivos subidos a Google Drive.
          </p>
        </div>

        {/* Summary card */}
        <div className="card p-6 mb-5 animate-fade-in space-y-4">
          <h2 className="font-bold text-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            Resumen del registro
          </h2>

          <div className="space-y-2">
            {[
              { icon: '✅', label: 'Datos del operativo', status: 'Guardados en Supabase' },
              { icon: '✅', label: 'Resumen operativo (soporte facturación)', status: 'Registrado' },
              { icon: '✅', label: 'Hallazgos y anomalías', status: 'Registrados' },
              { icon: '✅', label: 'Archivos subidos a Google Drive', status: 'Completado' },
              { icon: '✅', label: 'Reporte Word (.docx) generado', status: docxUrl ? 'Disponible en Drive' : 'Guardado localmente' },
            ].map(({ icon, label, status }) => (
              <div key={label} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-lg">{icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                </div>
                <span className="text-xs text-success font-medium">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 animate-fade-in">
          {/* Drive folder */}
          {folderUrl && (
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-center gap-4 hover:shadow-soft transition-all hover:-translate-y-0.5 group"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 9.75l7.5-6 7.5 6v9.75a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V9.75z" opacity="0.3"/>
                  <path fillRule="evenodd" d="M2.25 9L12 1.5 21.75 9v11.25A2.25 2.25 0 0119.5 22.5H4.5A2.25 2.25 0 012.25 20.25V9zM12 3.75L4.5 9.75v10.5a.75.75 0 00.75.75h13.5a.75.75 0 00.75-.75V9.75L12 3.75z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-text-primary text-sm">Abrir carpeta en Google Drive</p>
                <p className="text-xs text-text-muted">Ver todos los archivos del levantamiento</p>
              </div>
              <svg className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}

          {/* Download DOCX */}
          {docxUrl && (
            <a
              href={docxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-center gap-4 hover:shadow-soft transition-all hover:-translate-y-0.5 group border-primary/20"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-text-primary text-sm">Descargar Reporte Word (.docx)</p>
                <p className="text-xs text-text-muted">Reporte técnico completo con soporte de facturación</p>
              </div>
              <svg className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          )}

          {/* Navigation buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link href={`/projects/${projectId}/new-report`} className="btn-outline justify-center py-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo Registro
            </Link>
            <Link href="/projects" className="btn-primary justify-center py-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Ir al Inicio
            </Link>
          </div>

          {/* View all reports */}
          <Link href={`/projects/${projectId}/reports`}
            className="text-center block text-sm text-text-muted hover:text-primary transition-colors py-2">
            Ver todos los registros de este proyecto →
          </Link>
        </div>
      </div>
    </div>
  );
}
