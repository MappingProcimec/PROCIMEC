'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface TemplateOption {
  id: string;
  code: string;
  name: string;
  category: string;
  driveFolder: string;
  fields: string[];
}

const SAMPLE_TEMPLATES: TemplateOption[] = [
  {
    id: 'f-alturas',
    code: 'FOR-HSEQ-012',
    name: 'Inspección Preoperacional de Trabajo en Alturas',
    category: 'Seguridad en Campo',
    driveFolder: 'Drive / HSEQ / Formatos / Alturas',
    fields: ['Fecha', 'Localizador Responsable', 'Proyecto', 'Estado de Arnés', 'Línea de Vida', 'Puntos de Anclaje', 'Observaciones'],
  },
  {
    id: 'f-epp',
    code: 'FOR-HSEQ-005',
    name: 'Lista de Chequeo y Dotación de EPP',
    category: 'Equipos y Protección',
    driveFolder: 'Drive / HSEQ / Formatos / EPP',
    fields: ['Fecha', 'Localizador Responsable', 'Proyecto', 'Casco y Barbuquejo', 'Gafas de Seguridad', 'Botas Dieléctricas', 'Guantes'],
  },
  {
    id: 'f-permiso',
    code: 'FOR-HSEQ-021',
    name: 'Permiso de Trabajo Seguro en Vía / Campo',
    category: 'Operaciones',
    driveFolder: 'Drive / HSEQ / Formatos / Permisos',
    fields: ['Fecha', 'Localizador Responsable', 'Proyecto', 'Señalización Vial', 'Conos y Paleteros', 'Condiciones Climáticas', 'Riesgos Identificados'],
  },
  {
    id: 'f-vehicular',
    code: 'FOR-HSEQ-008',
    name: 'Inspección Preoperacional de Vehículo y Equipo',
    category: 'Móvil / Equipos',
    driveFolder: 'Drive / HSEQ / Formatos / Inspecciones',
    fields: ['Fecha', 'Localizador Responsable', 'Placa / ID Equipo', 'Frenos y Luces', 'Niveles de Fluidos', 'Kit de Carretera', 'Extintor Vigente'],
  },
];

export default function HseqFormatsToolPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption>(SAMPLE_TEMPLATES[0]);
  const [locatorName, setLocatorName] = useState('Localizador Principal');
  const [projectName, setProjectName] = useState('PRO-2026-01 Gasoducto Central');
  const [voiceText, setVoiceText] = useState(
    'Inspección preoperacional realizada en campo. Arnés tipo paracaidista en óptimas condiciones con costuras intactas, línea de vida con absorbedor certificado vigente, anclajes estructurales verificados. Clima despejado y personal 100% apto sin novedades.'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatedPdf, setSimulatedPdf] = useState<{
    fileName: string;
    generatedAt: string;
    driveUrl: string;
    extractedData: Record<string, string>;
  } | null>(null);

  const handleSimulateAiProcess = () => {
    setIsProcessing(true);
    setSimulatedPdf(null);

    setTimeout(() => {
      setIsProcessing(false);
      setSimulatedPdf({
        fileName: `EVIDENCIA_${selectedTemplate.code}_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        generatedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        driveUrl: 'https://drive.google.com/drive/folders/procimec-evidencias-general',
        extractedData: {
          'Formato': selectedTemplate.name,
          'Código': selectedTemplate.code,
          'Proyecto': projectName,
          'Localizador responsable': locatorName,
          'Estado general': 'Conforme / Aprobado',
          'Inspección técnica': 'Arnés y línea de vida certificados, costuras íntegras',
          'Condición climática': 'Despejado / Operación segura',
          'Observaciones IA': 'Sin hallazgos críticos detectados en el dictado del Localizador.',
        },
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero Header */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Panel" />
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-teal-500/20 text-teal-200 border border-teal-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  HSEQ / Calidad y Seguridad
                </span>
                <span className="badge bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Asistencia IA Gemini
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <span>🦺</span> Gestión y Llenado HSEQ con IA
              </h1>
              <p className="text-white/80 text-sm mt-1 max-w-2xl">
                Plataforma inteligente para la administración de plantillas HSEQ en Google Drive y diligenciamiento
                ágil por voz para el <strong className="text-amber-300 font-semibold">Localizador</strong> de campo con exportación directa a PDF inalterable.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/tools/evidence-board"
                className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <span>📋</span> Ver Tablero de Evidencias
              </Link>
              <Link
                href="/forms/hseq-report"
                className="btn bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>✍️</span> Abrir Formulario HSEQ
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {/* Construction Notice Banner */}
        <div className="card border-2 border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-2xl flex-shrink-0">
              🚧
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                  En Construcción
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  Fase de definición funcional y conexión de APIs
                </span>
              </div>
              <h2 className="text-base font-bold text-text-primary">
                Módulo HSEQ en proceso de implementación técnica
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
                Estamos configurando las integraciones con Google Drive y Gemini AI. A continuación puedes explorar el flujo
                arquitectónico definido y probar el simulador interactivo de llenado para el rol de <strong>Localizador</strong>.
              </p>

              {/* Progress Milestones */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-amber-200/60">
                <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200/70 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <span>✓</span> Arquitectura y Reglas
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Plantillas Drive + IA + Exportación exclusiva a PDF.
                  </p>
                </div>
                <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200/70 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <span>✓</span> Roles Definidos
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    HSEQ (crea plantillas) y <strong>Localizador</strong> (llena en campo).
                  </p>
                </div>
                <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200/70 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                    <span className="animate-pulse">●</span> Integración Drive API
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Conexión de cuenta de servicio y exportación en vuelo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roles & Architecture Diagram Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card: Rol HSEQ */}
          <div className="card border border-border p-5 bg-white space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-lg font-bold">
                👷‍♂️
              </div>
              <div>
                <h3 className="font-bold text-text-primary text-sm">Rol HSEQ (Administrador de Formatos)</h3>
                <p className="text-xs text-text-muted">Crea y actualiza plantillas en Google Drive</p>
              </div>
            </div>
            <ul className="text-xs text-text-secondary space-y-2 list-disc list-inside pl-1">
              <li>Mantiene las plantillas originales en las carpetas de Google Drive de HSEQ.</li>
              <li>Utiliza marcadores de sustitución tipo <code className="bg-gray-100 text-teal-800 px-1 py-0.5 rounded font-mono text-[11px]">{'{{campo}}'}</code> sin necesidad de programar.</li>
              <li>Añade nuevos formatos en minutos sin alterar el código de la plataforma.</li>
            </ul>
          </div>

          {/* Card: Rol Localizador */}
          <div className="card border border-border p-5 bg-white space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-lg font-bold">
                📍
              </div>
              <div>
                <h3 className="font-bold text-text-primary text-sm">Rol Localizador (Diligenciamiento en Campo)</h3>
                <p className="text-xs text-text-muted">Llenado ágil por voz o formulario con IA</p>
              </div>
            </div>
            <ul className="text-xs text-text-secondary space-y-2 list-disc list-inside pl-1">
              <li>Dicta notas de inspección por audio desde campo sin teclear manualmente 30 casillas.</li>
              <li>Gemini extrae automáticamente las respuestas y estructura los datos.</li>
              <li>Revisión rápida en un toque y generación directa de la evidencia en PDF.</li>
            </ul>
          </div>

        </div>

        {/* Interactive Simulator Section */}
        <div className="card border border-border p-6 bg-white space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Simulador de Flujo</span>
              <h2 className="text-lg font-bold text-text-primary">Prototipo de Llenado Asistido por IA</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Experimenta cómo el Localizador diligencia el formato y se genera el PDF de evidencia.
              </p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Modo Interactivo Demo
            </span>
          </div>

          {/* Step 1: Template Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
              1. Seleccionar Formato HSEQ (Plantilla origen en Google Drive)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SAMPLE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    selectedTemplate.id === tmpl.id
                      ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                      : 'border-border hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-teal-800">{tmpl.code}</span>
                    <span className="text-[10px] text-text-muted bg-white border border-border px-1.5 py-0.5 rounded">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary mt-1">{tmpl.name}</p>
                  <p className="text-[10px] text-text-muted mt-1 truncate">📁 {tmpl.driveFolder}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Form metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1">
                2. Proyecto Asignado
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none bg-surface"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1">
                Localizador Responsable (En Campo)
              </label>
              <input
                type="text"
                value={locatorName}
                onChange={(e) => setLocatorName(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none bg-surface"
              />
            </div>
          </div>

          {/* Step 3: Speech / Text Input for Localizador */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
                3. Entrada por Voz o Texto Libre del Localizador
              </label>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                🎙️ Speech-to-Text integrado
              </span>
            </div>
            <textarea
              rows={3}
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="El Localizador dicta o escribe lo ocurrido en campo..."
              className="w-full text-xs p-3 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none font-sans leading-relaxed"
            />
          </div>

          {/* Action button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-text-muted max-w-md">
              💡 Al pulsar procesar, la IA mapea las variables de la plantilla y crea el <strong>PDF cerrado</strong> en la Carpeta General de Evidencias.
            </p>
            <button
              type="button"
              onClick={handleSimulateAiProcess}
              disabled={isProcessing}
              className="btn bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin text-sm">⚙️</span> Procesando con IA y generando PDF...
                </>
              ) : (
                <>
                  <span>✨</span> Procesar Dictado y Generar PDF
                </>
              )}
            </button>
          </div>

          {/* Step 4: Result Preview Card */}
          {simulatedPdf && (
            <div className="bg-teal-50/50 border-2 border-teal-300 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 border border-red-200 flex items-center justify-center font-bold text-xs">
                    PDF
                  </div>
                  <div>
                    <p className="text-xs font-bold text-teal-900">{simulatedPdf.fileName}</p>
                    <p className="text-[11px] text-teal-700">Generado a las {simulatedPdf.generatedAt} • Listo para auditoría</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                    ✓ PDF Inalterable
                  </span>
                  <Link
                    href="/tools/evidence-board"
                    className="text-xs font-bold text-teal-800 underline hover:text-teal-950 ml-1"
                  >
                    Ver en Tablero →
                  </Link>
                </div>
              </div>

              {/* Extracted table preview */}
              <div>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                  Datos Inyectados en la Plantilla por la IA:
                </p>
                <div className="bg-white rounded-xl border border-teal-200 divide-y divide-gray-100 overflow-hidden text-xs">
                  {Object.entries(simulatedPdf.extractedData).map(([key, val]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-3 p-2.5 gap-1">
                      <span className="font-semibold text-text-secondary">{key}:</span>
                      <span className="sm:col-span-2 text-text-primary font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-teal-800">
                <span>📁 Destino: <strong>Google Drive / PROCIMEC_EVIDENCIAS_GENERAL /</strong></span>
                <span>🔒 Ningún archivo editable basura retenido en Drive.</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
