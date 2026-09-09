'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

export default function HseqReportFormPage() {
  const [formatCode, setFormatCode] = useState('FOR-HSEQ-012');
  const [projectName, setProjectName] = useState('Gasoducto Central - Tramo Norte');
  const [locatorName, setLocatorName] = useState('Localizador de Campo');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [voiceNotes, setVoiceNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

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

        {/* Notice: En Construcción */}
        <div className="card border-2 border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm p-5">
          <div className="flex items-start gap-3.5">
            <span className="text-2xl flex-shrink-0">🚧</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                  Formulario en Construcción
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  Integración directa con exportación a PDF en Google Drive
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Este formulario es el punto de captura oficial para el <strong>Localizador</strong> en campo.
                La información no se almacena en tablas redundantes: se plasma directamente en la plantilla oficial y genera la evidencia final en PDF.
              </p>
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
              <p>📄 <strong>Archivo:</strong> EVIDENCIA_{formatCode}_PROYECTO_{inspectionDate}.pdf</p>
              <p>📍 <strong>Localizador:</strong> {locatorName}</p>
              <p>📁 <strong>Destino:</strong> Google Drive / Carpeta General de Evidencias</p>
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
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-text-primary">
                Datos de Campo — Localizador Responsable
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Selecciona la plantilla correspondiente y registra las condiciones observadas.
              </p>
            </div>

            {/* Select Format */}
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                Formato HSEQ <span className="text-red-500">*</span>
              </label>
              <select
                value={formatCode}
                onChange={(e) => setFormatCode(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="FOR-HSEQ-012">FOR-HSEQ-012 — Inspección Preoperacional de Alturas</option>
                <option value="FOR-HSEQ-005">FOR-HSEQ-005 — Lista de Chequeo y Dotación de EPP</option>
                <option value="FOR-HSEQ-021">FOR-HSEQ-021 — Permiso de Trabajo Seguro en Vía / Campo</option>
                <option value="FOR-HSEQ-008">FOR-HSEQ-008 — Inspección Preoperacional de Vehículo y Equipo</option>
              </select>
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
