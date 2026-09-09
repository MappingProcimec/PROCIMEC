'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

function getFallbackGuidanceParagraph(code = '', title = ''): string {
  const c = code.toUpperCase();
  const t = title.toUpperCase();

  if (c.includes('012') || t.includes('ALTURA')) {
    return 'Durante la inspección en campo para este formato de Trabajo en Alturas, verifique y responda con atención: ¿El arnés de cuerpo entero, eslingas de posicionamiento y líneas de vida se encuentran limpios, sin cortes ni costuras rotas?, ¿los mosquetones con doble seguro y absorbedores de choque cuentan con certificación vigente y operativa?, ¿los puntos de anclaje estructurales fueron inspeccionados con resistencia mínima certificada?, ¿el personal y el Localizador cuentan con su certificado de trabajo en alturas al día?, y ¿las condiciones climáticas son óptimas sin vientos fuertes, lluvia ni tormenta eléctrica?';
  }

  if (c.includes('005') || t.includes('EPP')) {
    return 'Para la inspección técnica de Elementos de Protección Personal (EPP), observe detenidamente e indique: ¿El casco de seguridad dieléctrico cuenta con barbuquejo de 3 puntos en perfecto estado?, ¿las gafas de seguridad con filtro UV están libres de rayones o fisuras?, ¿las botas de seguridad con puntera certificada y suela antideslizante se encuentran en uso activo?, ¿los guantes de protección corresponden adecuadamente al riesgo mecánico o eléctrico de la tarea?, y ¿se dispone de protección auditiva y respiratoria conforme al nivel de ruido y partículas ambientales?';
  }

  if (c.includes('021') || t.includes('PERMISO') || t.includes('VIA') || t.includes('VÍA') || t.includes('TRANSITO')) {
    return 'Durante la verificación de señalización y permisos de trabajo en vía, confirme y detalle: ¿Se instalaron todos los conos reflectivos, colombinas y vallas delimitando con suficiente distancia el área de trabajo y al personal?, ¿el paletero asignado cuenta con su chaleco reflectivo reglamentario y paleta pare/siga?, ¿se valoraron los peligros del entorno como flujo vehicular pesado, excavaciones adyacentes o líneas de alta tensión?, ¿se dispone de extintor con manómetro en verde y botiquín de primeros auxilios dotado?, y ¿los permisos de trabajo y el plan de contingencia fueron socializados y aprobados con la supervisión de obra?';
  }

  if (c.includes('008') || t.includes('VEHICUL') || t.includes('EQUIPO') || t.includes('PREOPERACIONAL')) {
    return 'En la inspección preoperacional de vehículo y equipos de exploración, compruebe y precise: ¿Los niveles de aceite de motor, refrigerante, líquido de frenos y dirección hidráulica se encuentran en el rango óptimo?, ¿todas las luces principales, direccionales, de freno y reversa operan al 100%?, ¿la presión, labrado y estado general de los neumáticos (incluyendo la llanta de repuesto) son seguros?, ¿el kit de carretera reglamentario, botiquín y extintor vigente se encuentran a bordo?, y ¿el Localizador cuenta con licencia de conducción y documentación técnica del móvil al día?';
  }

  return `Durante la inspección técnica en campo para el formato ${code || 'HSEQ'} (${title || 'Inspección de Seguridad'}), verifique y responda de manera clara: ¿El área de trabajo se encuentra limpia, ordenada y libre de obstáculos o riesgos locativos?, ¿las herramientas y equipos utilizados cuentan con mantenimiento preventivo y operación segura?, ¿el personal cuenta con todos sus Elementos de Protección Personal correspondientes y en uso continuo?, ¿se realizó la charla de seguridad y evaluación de peligros previa al inicio de actividades?, y ¿se tiene identificado el plan de evacuación y los medios de comunicación en caso de emergencia?`;
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
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [voiceNotes, setVoiceNotes] = useState('');

  // Párrafo orientador generado con IA
  const [guidanceParagraph, setGuidanceParagraph] = useState<string>('');
  const [isLoadingGuidance, setIsLoadingGuidance] = useState<boolean>(false);

  // Grabación por voz nativa
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Estados de envío
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

  // Función para solicitar pautas a la IA según el formato
  const loadGuidanceForTemplate = useCallback(async (template: HseqTemplateOption | null) => {
    if (!template) return;
    setIsLoadingGuidance(true);
    try {
      const res = await fetch('/api/hseq/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: template.code,
          title: template.title,
          folderName: template.folderName,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.paragraph) {
          setGuidanceParagraph(json.paragraph);
          return;
        }
      }
      setGuidanceParagraph(getFallbackGuidanceParagraph(template.code, template.title));
    } catch (err) {
      console.warn('Fallo consultando pauta IA, usando respaldo:', err);
      setGuidanceParagraph(getFallbackGuidanceParagraph(template.code, template.title));
    } finally {
      setIsLoadingGuidance(false);
    }
  }, []);

  // Cargar las pautas cuando el activeTemplate esté disponible por primera vez o cambie
  useEffect(() => {
    if (activeTemplate && !guidanceParagraph) {
      loadGuidanceForTemplate(activeTemplate);
    }
  }, [activeTemplate, guidanceParagraph, loadGuidanceForTemplate]);

  // Manejador del cambio de formato
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const target = templates.find((t) => t.id === templateId) || null;
    if (target) {
      loadGuidanceForTemplate(target);
    }
  };

  // Reconocimiento de Voz nativo del navegador (SpeechRecognition / webkitSpeechRecognition)
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorar
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz nativo. Por favor escribe tus observaciones directamente en el recuadro.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-CO';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          setVoiceNotes((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error al inicializar reconocimiento de voz:', err);
      setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignorar
        }
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    // Calcular día de la semana para la matriz (LUNES, MARTES, etc.)
    const dateObj = new Date(inspectionDate + 'T12:00:00');
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const currentDay = dayNames[dateObj.getDay()] || 'LUNES';

    // Para la matriz semanal en el Excel (.xlsx), estampar 'SI' en las filas estándar de verificación del día
    const matrixItems = [11, 12, 13, 14, 15].map((fila) => ({
      fila,
      dia: currentDay,
      estado: 'SI' as const,
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
          matrixItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al generar la evidencia de inspección');
      }

      setGeneratedPdfResult({
        fileName: data.fileName,
        webViewLink: data.webViewLink,
      });
      setSubmissionSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el formulario';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <BackButton href="/dashboard" label="Volver al Tablero" />
          <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-full font-bold">
            Inspección HSEQ
          </span>
        </div>

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <span>🛡️</span> Formulario de Inspección HSEQ
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Diligenciamiento guiado con IA para Localizadores. Consulta plantillas oficiales de Google Drive y genera copias directas en PDF en la carpeta de Evidencias.
          </p>
        </div>

        {/* Banner de Sincronización con Google Drive */}
        <div className="mb-6 p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📁</span>
            <div>
              <p className="font-semibold text-teal-950">
                Plantillas oficiales de Google Drive
              </p>
              <p className="text-[11px] text-teal-800/80">
                {isLoadingTemplates ? (
                  'Explorando subcarpetas en Google Drive...'
                ) : (
                  <>
                    <strong>{templates.length} formatos</strong> detectados en <em>&quot;24. Procedimientos y formatos&quot;</em>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetchTemplates()}
            disabled={isFetchingTemplates}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-white/80 hover:bg-white px-3 py-1.5 rounded-xl border border-teal-300 flex items-center gap-1.5 shadow-sm transition-all self-end sm:self-auto disabled:opacity-50"
          >
            <span>{isFetchingTemplates ? '⏳' : '🔄'}</span>
            {isFetchingTemplates ? 'Actualizando...' : 'Actualizar Plantillas'}
          </button>
        </div>

        {/* Pantalla de Éxito al Generar PDF */}
        {submissionSuccess && generatedPdfResult ? (
          <div className="bg-surface rounded-2xl border border-emerald-300 p-6 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-text-primary">
                ¡Evidencia de Inspección HSEQ Generada Exitosamente!
              </h2>
              <p className="text-xs text-text-muted">
                El archivo PDF ha sido generado y depositado en la <strong>Carpeta General de EVIDENCIAS</strong> en Google Drive.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-border">
              <p className="text-text-secondary">
                <strong>Archivo generado:</strong> <code className="font-mono text-teal-700">{generatedPdfResult.fileName}</code>
              </p>
              <p className="text-text-secondary">
                <strong>Proyecto:</strong> {projectName}
              </p>
              <p className="text-text-secondary">
                <strong>Localizador:</strong> {locatorName}
              </p>
              <p className="text-text-secondary">
                <strong>Fecha:</strong> {inspectionDate}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {generatedPdfResult.webViewLink && (
                <a
                  href={generatedPdfResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <span>📄</span> Abrir PDF en Google Drive
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setGeneratedPdfResult(null);
                  setVoiceNotes('');
                }}
                className="btn bg-gray-100 hover:bg-gray-200 text-text-primary text-xs font-semibold px-4 py-2 rounded-xl"
              >
                + Diligenciar Otra Inspección
              </button>
            </div>
          </div>
        ) : (
          /* Formulario Principal de Inspección */
          <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <span>⚠️</span> {submitError}
              </div>
            )}

            {/* Template Selector */}
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
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
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

            {/* 3. Pautas y Preguntas Guía con IA según Formato */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      3. Preguntas Guía para la Inspección ({activeTemplate?.code || 'Checklist'})
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">
                      <span>✨ Generadas con IA</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Lee atentamente el siguiente párrafo con preguntas orientadoras y responde mediante audio o texto en el recuadro inferior.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadGuidanceForTemplate(activeTemplate)}
                  disabled={isLoadingGuidance}
                  className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 self-start sm:self-auto disabled:opacity-50"
                  title="Regenerar pautas de inspección con Inteligencia Artificial"
                >
                  <span>{isLoadingGuidance ? '⏳' : '🔄'}</span>
                  <span>{isLoadingGuidance ? 'Generando...' : 'Regenerar Pauta'}</span>
                </button>
              </div>

              {/* Párrafo Guía Unificado */}
              <div className="relative rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40 p-4 shadow-sm">
                {isLoadingGuidance ? (
                  <div className="space-y-2 animate-pulse py-1">
                    <div className="h-3.5 bg-teal-200/60 rounded w-11/12" />
                    <div className="h-3.5 bg-teal-200/60 rounded w-full" />
                    <div className="h-3.5 bg-teal-200/60 rounded w-4/5" />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5 flex-shrink-0">📋</span>
                    <p className="text-xs text-text-primary leading-relaxed font-normal">
                      {guidanceParagraph || (activeTemplate ? getFallbackGuidanceParagraph(activeTemplate.code, activeTemplate.title) : 'Seleccione un formato para ver las preguntas guía.')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Voice & Custom Notes Field */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-text-primary uppercase tracking-wide block">
                    4. Notas y Observaciones de Inspección en Campo
                  </label>
                  <p className="text-[11px] text-text-muted">
                    Responde aquí a las preguntas guía del punto anterior (puedes dictar por voz o escribir).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-sm'
                      : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <span>{isRecording ? '⏹ Detener Dictado' : '🎙️ Dictar por Voz'}</span>
                </button>
              </div>

              {isRecording && (
                <div className="flex items-center gap-2 text-[11px] text-red-600 font-medium px-2 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span>Escuchando micrófono... Habla de forma clara respondiendo a las pautas de inspección.</span>
                </div>
              )}

              <textarea
                rows={5}
                value={voiceNotes}
                onChange={(e) => setVoiceNotes(e.target.value)}
                placeholder="Describe los hallazgos, cumplimiento de EPP, estado del equipo y condiciones de seguridad respondiendo a las preguntas guía..."
                className="w-full text-xs p-3 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed font-sans"
              />
              <p className="text-[11px] text-text-muted">
                Estas observaciones se inyectarán en la casilla <code className="font-mono text-[10px]">[OBSERVACIONES]</code> de la plantilla oficial en Excel.
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
