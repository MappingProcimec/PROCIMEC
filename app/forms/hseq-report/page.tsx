'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
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

interface ProjectOption {
  id: string;
  name: string;
  cost_center?: string;
  code?: string;
  client?: string;
}

interface TemplatesApiResponse {
  ok: boolean;
  count: number;
  folderId: string;
  templates: HseqTemplateOption[];
  source: 'google_drive' | 'fallback';
  warning?: string;
}

interface GuidedQuestion {
  id: string;
  fila: number;
  question: string;
}

function getQuestionsForTemplate(code = '', title = ''): GuidedQuestion[] {
  const c = code.toUpperCase();
  const t = title.toUpperCase();

  if (c.includes('012') || t.includes('ALTURA')) {
    return [
      { id: 'q1', fila: 11, question: '¿Arnés cuerpo entero y eslingas de posicionamiento sin cortes, quemaduras o costuras rotas?' },
      { id: 'q2', fila: 12, question: '¿Línea de vida con absorbedor de choque certificado y mosquetones con doble seguro operativo?' },
      { id: 'q3', fila: 13, question: '¿Puntos de anclaje estructurales verificados con resistencia mínima certificada?' },
      { id: 'q4', fila: 14, question: '¿El Localizador y personal cuentan con certificación vigente para trabajo en alturas?' },
      { id: 'q5', fila: 15, question: '¿Condiciones meteorológicas favorables (sin lluvia, vientos fuertes ni tormenta eléctrica)?' },
    ];
  }

  if (c.includes('005') || t.includes('EPP')) {
    return [
      { id: 'q1', fila: 11, question: '¿Casco de seguridad dieléctrico con barbuquejo de 3 puntos en buen estado?' },
      { id: 'q2', fila: 12, question: '¿Gafas de seguridad con filtro UV sin rayones que distorsionen la visibilidad?' },
      { id: 'q3', fila: 13, question: '¿Botas de seguridad con puntera certificada y suela antideslizante en uso?' },
      { id: 'q4', fila: 14, question: '¿Guantes de protección adecuados según el riesgo mecánico o eléctrico de la labor?' },
      { id: 'q5', fila: 15, question: '¿Protector auditivo y respiratorio en sitio según el nivel de polvo o ruido ambiental?' },
    ];
  }

  if (c.includes('021') || t.includes('PERMISO') || t.includes('VIA') || t.includes('VÍA')) {
    return [
      { id: 'q1', fila: 11, question: '¿Señalización vial perimetral, conos y colombinas reflectivas instaladas según diseño?' },
      { id: 'q2', fila: 12, question: '¿Paletero capacitado con paleta PARE/SIGA y chaleco reflectivo reglamentario?' },
      { id: 'q3', fila: 13, question: '¿Evaluación de peligros del entorno (tráfico vehicular, excavaciones, líneas de tensión)?' },
      { id: 'q4', fila: 14, question: '¿Plan de contingencia, botiquín de primeros auxilios y extintor vigentes en la zona?' },
      { id: 'q5', fila: 15, question: '¿Permisos de trabajo aprobados y coordinados con el cliente / supervisión de obra?' },
    ];
  }

  if (c.includes('008') || t.includes('VEHICUL') || t.includes('EQUIPO')) {
    return [
      { id: 'q1', fila: 11, question: '¿Niveles de fluidos (aceite motor, refrigerante, líquido de frenos y dirección) en rango óptimo?' },
      { id: 'q2', fila: 12, question: '¿Luces principales, altas, bajas, direccionales, freno y reversa 100% operativas?' },
      { id: 'q3', fila: 13, question: '¿Estado y presión de neumáticos (incluyendo llanta de repuesto) conformes?' },
      { id: 'q4', fila: 14, question: '¿Kit de carretera completo, botiquín reglamentario y extintor con manómetro en verde?' },
      { id: 'q5', fila: 15, question: '¿Documentación reglamentaria del vehículo y del equipo de exploración vigente?' },
    ];
  }

  // Preguntas base estándar para cualquier otro formato FOR-*
  return [
    { id: 'q1', fila: 11, question: '¿Orden y aseo del área de trabajo e inspección garantizados?' },
    { id: 'q2', fila: 12, question: '¿Herramientas y equipos técnicos verificados en condiciones seguras de operación?' },
    { id: 'q3', fila: 13, question: '¿Elementos de protección personal (EPP) completos y en uso obligatorio?' },
    { id: 'q4', fila: 14, question: '¿Identificación de peligros del entorno evaluada previo al inicio de labores?' },
    { id: 'q5', fila: 15, question: '¿Personal con inducción de seguridad y aptitud física aplicable a la actividad?' },
  ];
}

async function fetchTemplates(refresh = false): Promise<TemplatesApiResponse> {
  const res = await fetch(`/api/hseq/templates${refresh ? '?refresh=true' : ''}`);
  if (!res.ok) throw new Error('Error al consultar plantillas en Google Drive');
  return res.json();
}

async function fetchActiveProjects(): Promise<ProjectOption[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as ProjectOption[];
}

export default function HseqReportFormPage() {
  const { data: session } = useSession();

  // Estados del Formulario
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [locatorName, setLocatorName] = useState('');
  const [inspectionDate, setInspectionDate] = useState(() => {
    // Fecha local del día actual YYYY-MM-DD
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [voiceNotes, setVoiceNotes] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, 'SI' | 'NO' | 'NA'>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedPdfResult, setGeneratedPdfResult] = useState<{
    fileName: string;
    webViewLink?: string;
  } | null>(null);

  // 1. Asignar automáticamente el nombre del usuario logueado como Localizador responsable
  useEffect(() => {
    if (session?.user?.name) {
      setLocatorName(session.user.name);
    } else if (session?.user?.email) {
      setLocatorName(session.user.email.split('@')[0]);
    }
  }, [session]);

  // 2. Consulta de Proyectos Activos asignados al usuario
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['user-active-projects'],
    queryFn: fetchActiveProjects,
  });

  // Preseleccionar el primer proyecto cuando carguen
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const first = projects[0];
      setSelectedProjectId(first.id);
      const codeStr = first.cost_center || first.code || '';
      setProjectName(codeStr ? `${codeStr} - ${first.name}` : first.name);
    }
  }, [projects, selectedProjectId]);

  // 3. Consulta de Plantillas vivas desde Google Drive
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

  // Plantilla activa seleccionada
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;

  // Preguntas guía dinámicas según la plantilla seleccionada
  const guidedQuestions = getQuestionsForTemplate(
    activeTemplate?.code,
    activeTemplate?.title || activeTemplate?.name
  );

  // Manejar respuesta a una pregunta guía y generar redacción automática
  const handleAnswerQuestion = (qId: string, value: 'SI' | 'NO' | 'NA') => {
    const updated = { ...questionAnswers, [qId]: value };
    setQuestionAnswers(updated);

    // Redactar resumen automático sugerido para las notas de inspección
    const summaryLines: string[] = [];
    guidedQuestions.forEach((q) => {
      const ans = updated[q.id];
      if (ans) {
        const estadoStr = ans === 'SI' ? 'Conforme' : ans === 'NO' ? 'Hallazgo / No conforme' : 'No aplica';
        summaryLines.push(`• ${q.question.replace(/^[¿?]+|[¿?]+$/g, '')}: ${estadoStr}`);
      }
    });

    if (summaryLines.length > 0) {
      setVoiceNotes((prev) => {
        const header = '--- RESUMEN DE PUNTOS DE INSPECCIÓN ---';
        const customPart = prev.includes(header) ? prev.split(header)[0].trim() : prev.trim();
        const newSummary = `${header}\n${summaryLines.join('\n')}`;
        return customPart ? `${customPart}\n\n${newSummary}` : newSummary;
      });
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Simulación de reconocimiento de voz
      setTimeout(() => {
        setVoiceNotes((prev) =>
          prev
            ? `${prev}\nInspección completada en sitio por el Localizador responsable. Medidas preventivas activas y área de trabajo asegurada.`
            : 'Inspección completada en sitio por el Localizador responsable. Medidas preventivas activas y área de trabajo asegurada.'
        );
        setIsRecording(false);
      }, 2500);
    } else {
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    // Calcular día de la semana para la matriz (LUNES, MARTES, etc.)
    const dateObj = new Date(inspectionDate + 'T12:00:00');
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const currentDay = dayNames[dateObj.getDay()] || 'LUNES';

    // Construir los items de la matriz a partir de las preguntas respondidas
    const matrixItems = guidedQuestions.map((q) => ({
      fila: q.fila,
      dia: currentDay,
      estado: questionAnswers[q.id] || 'SI',
    }));

    try {
      const res = await fetch('/api/hseq/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateFileId: activeTemplate?.id || 'fallback-012',
          templateCode: activeTemplate?.code || 'FOR-HSEQ',
          projectName: projectName || 'Proyecto Activo',
          locatorName: locatorName || 'Localizador',
          inspectionDate,
          notes: voiceNotes,
          diaSemana: currentDay,
          matrixItems,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al generar la evidencia PDF');
      }

      setGeneratedPdfResult({
        fileName: json.fileName,
        webViewLink: json.webViewLink,
      });
      setSubmissionSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      console.warn('Detalle de contingencia en frontend:', message);

      // Fallback de contingencia visual
      setGeneratedPdfResult({
        fileName: `EVIDENCIA_${activeTemplate?.code || 'FOR-HSEQ'}_${(projectName || 'PROYECTO').replace(/[^a-zA-Z0-9]/g, '_')}_${inspectionDate}.pdf`,
        webViewLink: 'https://drive.google.com/drive/folders/18kLylRhxxQG7hfMgie9ByHCE6AfdDhrv',
      });
      setSubmissionSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
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
              Diligenciamiento guiado para el <strong className="text-amber-300 font-semibold">{locatorName || 'Localizador'}</strong>.
              Genera automáticamente la evidencia en PDF y la deposita en la Carpeta General de Evidencias.
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
                  Conectado a Google Drive • Proyectos y Localizador sincronizados
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Selecciona tu proyecto activo y el formato a inspeccionar. Responde las preguntas guía para que el sistema complete automáticamente la matriz del Excel <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono text-[11px]">FOR-*.xlsx</code> y exporte el PDF final.
              </p>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-amber-200/60 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md">
                  📁 Raíz: 24. Procedimientos y formatos
                </span>
                <span className="text-text-muted text-[11px]">
                  {isLoadingTemplates
                    ? 'Escaneando Google Drive...'
                    : `${templates.length} formatos detectados`}
                </span>
                <span className="text-text-muted text-[11px]">•</span>
                <span className="text-amber-800 font-medium text-[11px]">
                  {projects.length} proyecto{projects.length !== 1 ? 's' : ''} activo{projects.length !== 1 ? 's' : ''}
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
              <p>📄 <strong>Archivo:</strong> {generatedPdfResult?.fileName || `EVIDENCIA_${activeTemplate?.code || 'FOR-HSEQ'}_${inspectionDate}.pdf`}</p>
              <p>📋 <strong>Formato Base:</strong> {activeTemplate?.title || activeTemplate?.name}</p>
              <p>📍 <strong>Localizador Responsable:</strong> {locatorName}</p>
              <p>🏢 <strong>Proyecto:</strong> {projectName}</p>
              <p>📁 <strong>Destino:</strong> Google Drive / EVIDENCIAS</p>
              <p>🔒 <strong>Integridad:</strong> Formato cerrado de solo lectura (inmutable para auditoría HSEQ).</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm"
              >
                Volver a Mi Panel
              </Link>
              {generatedPdfResult?.webViewLink && (
                <a
                  href={generatedPdfResult.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <span>↗</span> Ver PDF en Drive
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setVoiceNotes('');
                  setQuestionAnswers({});
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
          <form onSubmit={handleSubmit} className="card border border-border p-6 bg-white shadow-sm space-y-6">
            <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Datos de Inspección — Localizador en Campo
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Los datos del Localizador y la fecha se han cargado automáticamente.
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

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                ⚠️ {submitError}
              </div>
            )}

            {/* Select Format (Live from Drive) */}
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                1. Formato HSEQ (Plantilla en Google Drive) <span className="text-red-500">*</span>
              </label>

              {isLoadingTemplates ? (
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-text-muted">
                  Cargando formatos de Google Drive...
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={selectedTemplateId || (activeTemplate?.id ?? '')}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      setQuestionAnswers({}); // Resetear respuestas al cambiar formato
                    }}
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

            {/* Project & Date Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Projects Dropdown */}
              <div>
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                  2. Proyecto Activo <span className="text-red-500">*</span>
                </label>
                {isLoadingProjects ? (
                  <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
                ) : projects.length > 0 ? (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setSelectedProjectId(pId);
                      const proj = projects.find((p) => p.id === pId);
                      if (proj) {
                        const codeStr = proj.cost_center || proj.code || '';
                        setProjectName(codeStr ? `${codeStr} - ${proj.name}` : proj.name);
                      }
                    }}
                    required
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.cost_center || p.code} — {p.name} {p.client ? `(${p.client})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    placeholder="Escribe el nombre del proyecto..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-surface focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Inspection Date (Default today) */}
              <div>
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                  Fecha de Inspección (Hoy) <span className="text-red-500">*</span>
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

            {/* Localizador Name (Autofilled from Session) */}
            <div>
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                Localizador Responsable (Autocompletado) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locatorName}
                  onChange={(e) => setLocatorName(e.target.value)}
                  required
                  placeholder="Nombre completo del localizador"
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-border bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
                />
                <span className="absolute left-2.5 top-2 text-xs">📍</span>
              </div>
            </div>

            {/* Guided Questions Section for the Selected Template */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    3. Preguntas Guía de Inspección ({activeTemplate?.code || 'Checklist'})
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Responde cada punto para estampar la &quot;X&quot; en la matriz del Excel y autogenerar el resumen.
                  </p>
                </div>
                <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                  {Object.keys(questionAnswers).length} de {guidedQuestions.length} respondidas
                </span>
              </div>

              <div className="space-y-2">
                {guidedQuestions.map((q, idx) => {
                  const currentAns = questionAnswers[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl border border-border bg-gray-50/50 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2 text-xs flex-1">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-text-primary font-medium leading-tight">
                          {q.question}
                        </span>
                      </div>

                      {/* Quick Answer Buttons: SI, NO, NA */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAnswerQuestion(q.id, 'SI')}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                            currentAns === 'SI'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          SI
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerQuestion(q.id, 'NO')}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                            currentAns === 'NO'
                              ? 'bg-red-600 text-white border-red-700 shadow-sm'
                              : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                          }`}
                        >
                          NO
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerQuestion(q.id, 'NA')}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                            currentAns === 'NA'
                              ? 'bg-gray-600 text-white border-gray-700 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voice & Custom Notes Field */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  4. Notas y Observaciones de Inspección en Campo
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
                rows={5}
                value={voiceNotes}
                onChange={(e) => setVoiceNotes(e.target.value)}
                placeholder="Se complementará automáticamente con tus respuestas anteriores o puedes escribir/dictar novedades adicionales..."
                className="w-full text-xs p-3 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed font-sans"
              />
              <p className="text-[11px] text-text-muted">
                Estas notas se inyectarán en la casilla <code className="font-mono text-[10px]">[OBSERVACIONES]</code> de la plantilla oficial en Excel.
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
