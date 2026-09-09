'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface HseqTemplateOption {
  id: string;
  name: string;
  code: string;
  title: string;
  folderName: string;
  folderId: string;
  mimeType: string;
  webViewLink?: string;
}

interface TemplatesApiResponse {
  ok: boolean;
  count: number;
  folderId: string;
  templates: HseqTemplateOption[];
  source: 'google_drive' | 'fallback';
  warning?: string;
}

async function fetchTemplates(refresh = false): Promise<TemplatesApiResponse> {
  const res = await fetch(`/api/hseq/templates${refresh ? '?refresh=true' : ''}`);
  if (!res.ok) throw new Error('Error al consultar plantillas en Google Drive');
  return res.json();
}

export default function HseqReportFormPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [projectName, setProjectName] = useState('Gasoducto Central - Tramo Norte');
  const [locatorName, setLocatorName] = useState('Localizador de Campo');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [voiceNotes, setVoiceNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Consulta de plantillas vivas desde Google Drive
  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    isFetching: isFetchingTemplates,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['hseq-templates'],
    queryFn: () => fetchTemplates(false),
  });

  const templates = templatesData?.templates ?? [];

  // Seleccionar automáticamente la primera plantilla si no hay ninguna seleccionada
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Simular captura de dictado por voz
      setTimeout(() => {
        setVoiceNotes((prev) =>
          prev
            ? `${prev}\nInspección completada por el Localizador. Equipos de protección verificados, condiciones de terreno seguras y sin novedades de riesgo crítico.`
            : 'Inspección completada por el Localizador. Equipos de protección verificados, condiciones de terreno seguras y sin novedades de riesgo crítico.'
        );
        setIsRecording(false);
      }, 2500);
    } else {
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionSuccess(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-3xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Panel" />
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge bg-teal-500/20 text-teal-200 border border-teal-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                HSEQ / Calidad y Seguridad
              </span>
              <span className="badge bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Rol: Localizador
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <span>✍️</span> Formulario de Inspección HSEQ
            </h1>
            <p className="text-white/80 text-sm mt-1 max-w-xl">
              Diligenciamiento de inspección de campo para el <strong className="text-amber-300 font-semibold">Localizador</strong>.
              Genera automáticamente la evidencia en PDF y la deposita en la Carpeta General.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {/* Notice: En Construcción & Drive Connection Status */}
        <div className="card border-2 border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm p-5">
          <div className="flex items-start gap-3.5">
            <span className="text-2xl flex-shrink-0">🚧</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                  Formulario en Construcción
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  Fase 1: Conexión con carpeta de formatos de Google Drive
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Este formulario lee directamente las plantillas <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono text-[11px]">FOR-*.xlsx</code> de la carpeta raíz oficial de HSEQ. Los datos se inyectan en la plantilla y generan el PDF final en la Carpeta General de Evidencias.
              </p>

              {/* Status Badge */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-amber-200/60 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md">
                  📁 Raíz: 24. Procedimientos y formatos
                </span>
                <span className="text-text-muted text-[11px]">
                  {isLoadingTemplates
                    ? 'Escaneando subcarpetas en Google Drive...'
                    : `${templates.length} formatos FOR-* detectados`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Success Alert */}
        {submissionSuccess && (
          <div className="card border-2 border-emerald-400 bg-emerald-50 p-6 rounded-2xl animate-in fade-in duration-300 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                ✓
              </div>
              <div>
                <h3 className="font-bold text-emerald-900 text-sm">
                  ¡Evidencia HSEQ Generada y Guardada en PDF con Éxito!
                </h3>
                <p className="text-xs text-emerald-700">
                  El archivo PDF ha sido depositado en la Carpeta General de Evidencias.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-4 text-xs space-y-1.5 text-text-secondary">
              <p>📄 <strong>Archivo:</strong> EVIDENCIA_{activeTemplate?.code || 'FOR-HSEQ'}_PROYECTO_{inspectionDate}.pdf</p>
              <p>📋 <strong>Formato Base:</strong> {activeTemplate?.title || activeTemplate?.name}</p>
              <p>📍 <strong>Localizador:</strong> {locatorName}</p>
              <p>📁 <strong>Destino:</strong> Google Drive / EVIDENCIAS</p>
              <p>🔒 <strong>Integridad:</strong> Formato cerrado de solo lectura (inmutable para auditoría HSEQ).</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm"
              >
                Volver a Mi Panel
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setVoiceNotes('');
                }}
                className="btn bg-gray-100 hover:bg-gray-200 text-text-secondary text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Diligenciar otro formulario
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        {!submissionSuccess && (
          <form onSubmit={handleSubmit} className="card border border-border p-6 bg-white shadow-sm space-y-5">
            <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Datos de Campo — Localizador Responsable
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Selecciona la plantilla correspondiente y registra las condiciones observadas.
                </p>
              </div>

              {/* Botón para forzar actualización de plantillas desde Drive */}
              <button
                type="button"
                onClick={() => refetchTemplates()}
                disabled={isFetchingTemplates}
                className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Escanear Google Drive nuevamente en busca de nuevos formatos FOR-"
              >
                <span className={isFetchingTemplates ? 'animate-spin' : ''}>🔄</span>
                {isFetchingTemplates ? 'Buscando...' : 'Sincronizar Drive'}
              </button>
            </div>

            {/* Select Format (Live from Drive) */}
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                Formato HSEQ (Plantilla en Google Drive) <span className="text-red-500">*</span>
              </label>

              {isLoadingTemplates ? (
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-text-muted">
                  Cargando formatos de Google Drive...
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={selectedTemplateId || (activeTemplate?.id ?? '')}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.title} {t.folderName !== 'Raíz Formatos' ? `(Carpeta: ${t.folderName})` : ''}
                      </option>
                    ))}
                  </select>

                  {activeTemplate && (
                    <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
                      <span>📁 Subcarpeta: <strong>{activeTemplate.folderName}</strong></span>
                      <span className="font-mono text-[10px] text-teal-700">{activeTemplate.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Project & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                  Proyecto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                  Fecha de Inspección <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Localizador Name */}
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                Localizador Responsable en Campo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locatorName}
                  onChange={(e) => setLocatorName(e.target.value)}
                  required
                  placeholder="Nombre completo del localizador"
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <span className="absolute left-2.5 top-2 text-xs">📍</span>
              </div>
            </div>

            {/* Voice / Notes Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  Notas y Observaciones de Inspección en Campo
                </label>
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`text-xs px-3 py-1 rounded-xl font-semibold flex items-center gap-1.5 border transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white border-red-600 animate-pulse'
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <span>{isRecording ? '⏹ Detener' : '🎙️ Dictar por Voz'}</span>
                </button>
              </div>

              <textarea
                rows={4}
                value={voiceNotes}
                onChange={(e) => setVoiceNotes(e.target.value)}
                placeholder="El Localizador puede dictar por audio o escribir: estado de arneses, equipo de protección, condiciones de clima, hallazgos..."
                className="w-full text-xs p-3 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed"
              />
              <p className="text-[11px] text-text-muted">
                El sistema procesa las notas para completar los campos de la plantilla correspondiente.
              </p>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
              <span className="text-[11px] text-text-muted">
                📄 Salida: <strong>Copia directa en PDF</strong> en Carpeta General de Evidencias
              </span>

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="btn bg-gray-100 hover:bg-gray-200 text-text-secondary text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin text-sm">⚙️</span> Generando PDF...
                    </>
                  ) : (
                    <>
                      <span>📄</span> Generar Evidencia en PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
