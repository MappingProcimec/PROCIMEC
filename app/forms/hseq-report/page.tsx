'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { DigitalSignatureModal } from '@/components/hseq/DigitalSignatureModal';
import {
  DRONE_INSPECTION_ITEMS,
  DRONE_INSPECTION_SECTIONS,
  getOptimalResponses,
} from '@/lib/drone-inspection';
import { Sparkles, PenTool, CheckCircle2, AlertCircle, Check } from 'lucide-react';

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
  location?: string;
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

  // Estados específicos para Inspección de Drone
  const [droneBrandModel, setDroneBrandModel] = useState('DJI Mavic 3 Enterprise');
  const [droneSerial, setDroneSerial] = useState('PROC-DRN-001');
  const [droneItemsResponses, setDroneItemsResponses] = useState<Record<string, 'SI' | 'NO' | 'NA'>>({});
  const [droneCriticalPoint, setDroneCriticalPoint] = useState('Ninguno');
  const [droneObservations, setDroneObservations] = useState('');

  // Firmas Digitales con Validación de Identidad
  const [operatorSignName, setOperatorSignName] = useState('');
  const [operatorSignDataUrl, setOperatorSignDataUrl] = useState('');
  const [sstaSignName, setSstaSignName] = useState('');
  const [sstaSignDataUrl, setSstaSignDataUrl] = useState('');

  // Modales de firma
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [isSstaModalOpen, setIsSstaModalOpen] = useState(false);

  // Párrafo orientador generado con IA para formatos generales
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
    excelFileName?: string;
    webViewLink?: string;
    pdfBase64?: string;
    excelBase64?: string;
    driveError?: string | null;
  } | null>(null);

  // 1. Asignar automáticamente el nombre del usuario logueado
  useEffect(() => {
    if (session?.user?.name) {
      setLocatorName(session.user.name);
      if (!operatorSignName) setOperatorSignName(session.user.name);
    } else if (session?.user?.email) {
      const fallback = session.user.email.split('@')[0];
      setLocatorName(fallback);
      if (!operatorSignName) setOperatorSignName(fallback);
    }
  }, [session, operatorSignName]);

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

  // Proyecto activo seleccionado actualmente
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
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

  // Asegurar que el Formato de Drone siempre esté disponible en Carpeta 24
  const templates: HseqTemplateOption[] = useMemo(() => {
    const raw = templatesData?.templates ?? [];
    const hasDrone = raw.some(
      (t) => t.code.includes('024') || t.title.toLowerCase().includes('drone')
    );

    if (hasDrone) return raw;

    const droneOption: HseqTemplateOption = {
      id: 'hseq-drone-preoperational',
      code: 'FOR-HSEQ-024',
      title: 'Inspección Pre-operacional de Drone',
      name: 'FOR-HSEQ-024 Inspección Pre-operacional de Drone.xlsx',
      folderName: '24. Procedimientos y formatos',
      folderId: 'folder-24',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return [droneOption, ...raw];
  }, [templatesData]);

  // Plantilla activa seleccionada
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Detector si la plantilla elegida es la de Drone
  const isDroneTemplate = useMemo(() => {
    if (!activeTemplate) return false;
    const c = activeTemplate.code.toUpperCase();
    const t = activeTemplate.title.toUpperCase();
    return (
      activeTemplate.id === 'hseq-drone-preoperational' ||
      c.includes('024') ||
      c.includes('DRONE') ||
      t.includes('DRONE')
    );
  }, [activeTemplate]);

  // Cargar orientación IA para formatos generales
  const loadGuidanceForTemplate = useCallback(async (template: HseqTemplateOption | null) => {
    if (!template) {
      setGuidanceParagraph('');
      return;
    }
    setIsLoadingGuidance(true);
    try {
      const res = await fetch('/api/hseq/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateFileId: template.id,
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

  // Manejador del cambio de formato
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSubmitError(null);
    if (!templateId) {
      setGuidanceParagraph('');
      return;
    }
    const target = templates.find((t) => t.id === templateId) || null;
    if (target) {
      // Si no es drone, cargamos pauta IA
      const isDr =
        target.id === 'hseq-drone-preoperational' ||
        target.code.toUpperCase().includes('024') ||
        target.title.toUpperCase().includes('DRONE');
      if (!isDr) {
        loadGuidanceForTemplate(target);
      }
    }
  };

  const isRecordingRef = useRef(false);

  // Reconocimiento de Voz para formato genérico
  const stopListening = useCallback(() => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Tu navegador no soporta dictado por voz nativo. Por favor escribe tus observaciones en el recuadro.');
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);

    const initRecognition = () => {
      if (!isRecordingRef.current) return;

      try {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'es-CO';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
          if (isRecordingRef.current) setIsRecording(true);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let chunk = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              chunk += event.results[i][0].transcript + ' ';
            }
          }
          chunk = chunk.trim();
          if (chunk) {
            setVoiceNotes((prev) => {
              const cleanPrev = prev.trim();
              if (!cleanPrev) return chunk;
              if (cleanPrev.endsWith(chunk)) return cleanPrev;
              return `${cleanPrev} ${chunk}`;
            });
          }
        };

        recognition.onerror = () => {
          if (isRecordingRef.current) {
            setTimeout(initRecognition, 500);
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            setTimeout(initRecognition, 300);
          } else {
            setIsRecording(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        setIsRecording(false);
      }
    };

    initRecognition();
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Botón rápido: marcar todo óptimo en Drone
  const handleMarkAllOptimal = () => {
    setDroneItemsResponses(getOptimalResponses());
  };

  // Envío especializado para Formato de Drone
  const handleDroneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedProjectId) {
      setSubmitError('Por favor selecciona un proyecto activo asignado a tu usuario.');
      return;
    }

    const answeredCount = Object.keys(droneItemsResponses).length;
    if (answeredCount < DRONE_INSPECTION_ITEMS.length) {
      setSubmitError(
        `Debes evaluar los 25 ítems de inspección. Has completado ${answeredCount} de 25. Puedes usar el botón "✨ Marcar todo en estado óptimo" y modificar solo las novedades.`
      );
      return;
    }

    if (!operatorSignName.trim() || !operatorSignDataUrl) {
      setSubmitError('La firma digital del Operador es obligatoria. Haz clic en "✍️ Capturar Firma Operador".');
      return;
    }

    if (!sstaSignName.trim() || !sstaSignDataUrl) {
      setSubmitError('La firma digital del Responsable SSTA es obligatoria. Haz clic en "✍️ Capturar Firma SSTA".');
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = selectedProject;
      const costCenter = proj?.cost_center || proj?.code || '';
      const location = proj?.location || 'En campo';

      const res = await fetch('/api/hseq/drone-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          projectName: proj?.name || projectName,
          costCenter,
          location,
          inspectionDate,
          droneBrandModel,
          droneSerial,
          itemsResponses: droneItemsResponses,
          criticalPoint: droneCriticalPoint,
          generalObservations: droneObservations,
          operatorName: operatorSignName,
          operatorSignatureDataUrl: operatorSignDataUrl,
          sstaName: sstaSignName,
          sstaSignatureDataUrl: sstaSignDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la inspección de drone');
      }

      setGeneratedPdfResult({
        fileName: data.fileName,
        webViewLink: data.webViewLink,
        pdfBase64: data.pdfBase64,
        driveError: data.driveWarning || data.dbWarning || null,
      });
      setSubmissionSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el formulario';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envío para Formatos HSEQ Generales (Plantillas Google Drive)
  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const proj = selectedProject;
      const costCenter = proj?.cost_center || proj?.code || 'PROCIMEC-HSEQ';
      const projectLoc = proj?.location || 'En campo';

      const res = await fetch('/api/hseq/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateFileId: activeTemplate.id,
          templateCode: activeTemplate.code,
          projectName: projectName || 'Proyecto Activo',
          costCenter,
          location: projectLoc,
          locatorName: locatorName || 'Localizador',
          inspectionDate,
          notes: voiceNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar la evidencia de inspección');
      }

      setGeneratedPdfResult({
        fileName: data.fileName,
        excelFileName: data.excelFileName,
        webViewLink: data.webViewLink,
        pdfBase64: data.pdfBase64,
        excelBase64: data.excelBase64,
        driveError: data.driveError || null,
      });
      setSubmissionSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el formulario';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadLocalPdf = () => {
    if (!generatedPdfResult?.pdfBase64) return;
    try {
      const byteCharacters = atob(generatedPdfResult.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedPdfResult.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error al descargar PDF local:', e);
    }
  };

  const answeredCount = Object.keys(droneItemsResponses).length;

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
            Gestión de inspecciones oficiales (Carpeta 24: Procedimientos y Formatos). Diligenciamiento con interfaz reactiva, firmas digitales verificadas y generación directa en PDF.
          </p>
        </div>

        {/* Banner de Sincronización con Google Drive */}
        <div className="mb-6 p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📁</span>
            <div>
              <p className="font-semibold text-teal-950">
                Formatos Oficiales (Carpeta 24)
              </p>
              <p className="text-[11px] text-teal-800/80">
                {isLoadingTemplates ? (
                  'Explorando formatos en Google Drive...'
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
                ¡Evidencia de Inspección Generada Exitosamente!
              </h2>
              <p className="text-xs text-text-muted">
                El archivo PDF ha sido generado y registrado en la base de datos de PROCIMEC.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-border">
              <p className="text-text-secondary">
                <strong>Archivo generado:</strong> <code className="font-mono text-teal-700">{generatedPdfResult.fileName}</code>
              </p>
              <p className="text-text-secondary">
                <strong>Proyecto:</strong> {selectedProject?.name || projectName}
              </p>
              <p className="text-text-secondary">
                <strong>Centro de Costos:</strong> {selectedProject?.cost_center || 'N/A'}
              </p>
              <p className="text-text-secondary">
                <strong>Responsable Operador:</strong> {operatorSignName || locatorName}
              </p>
              {sstaSignName && (
                <p className="text-text-secondary">
                  <strong>Responsable SSTA:</strong> {sstaSignName}
                </p>
              )}
              <p className="text-text-secondary">
                <strong>Fecha:</strong> {inspectionDate}
              </p>
            </div>

            {generatedPdfResult.driveError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-xl text-center">
                ℹ️ <strong>Aviso:</strong> {generatedPdfResult.driveError} (El PDF está listo para descarga local).
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {generatedPdfResult.pdfBase64 && (
                <button
                  type="button"
                  onClick={downloadLocalPdf}
                  className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                >
                  <span>⬇️</span> Descargar PDF Oficial
                </button>
              )}

              {generatedPdfResult.webViewLink && (
                <a
                  href={generatedPdfResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-white hover:bg-gray-50 text-teal-800 border border-teal-300 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                >
                  <span>📄</span> Ver en Google Drive
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setGeneratedPdfResult(null);
                  setSelectedTemplateId('');
                  setDroneItemsResponses({});
                  setOperatorSignDataUrl('');
                  setSstaSignDataUrl('');
                  setVoiceNotes('');
                }}
                className="btn bg-gray-100 hover:bg-gray-200 text-text-primary text-xs font-semibold px-4 py-2.5 rounded-xl"
              >
                + Diligenciar Otra Inspección
              </button>
            </div>
          </div>
        ) : (
          /* Formulario Principal */
          <div className="space-y-6">
            {/* 1. Selector de Plantilla (Inicia en Ninguno) */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wide block">
                1. Selección de Formato HSEQ (Carpeta 24: Procedimientos y formatos) <span className="text-red-500">*</span>
              </label>

              {isLoadingTemplates ? (
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-text-muted">
                  Cargando formatos de la Carpeta 24...
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-3 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium shadow-sm"
                  >
                    <option value="">-- Selecciona un formato de la Carpeta 24 --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.title} {t.folderName ? `(Carpeta: ${t.folderName})` : ''}
                      </option>
                    ))}
                  </select>

                  {activeTemplate && (
                    <div className="flex items-center justify-between text-[11px] text-teal-800 bg-teal-50/70 border border-teal-200/60 p-2.5 rounded-xl">
                      <span>📁 Carpeta: <strong>{activeTemplate.folderName}</strong></span>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-teal-200">
                        {activeTemplate.code}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* SI SE SELECCIONÓ EL FORMATO DE DRONE: RENDERIZAR MÓDULO ESPECIALIZADO DE DRONE */}
            {isDroneTemplate && (
              <form onSubmit={handleDroneSubmit} className="space-y-6">
                {/* 2. Encabezado de Operación con Autocompletado Canónico */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                      <span>🚁</span> 2. Información General y Proyecto Asignado
                    </h3>
                    <span className="text-[11px] text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full font-semibold border border-teal-200">
                      Autocompletado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Selector de Proyecto Activo */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Proyecto Asignado <span className="text-red-500">*</span>
                      </label>
                      {isLoadingProjects ? (
                        <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
                      ) : (
                        <select
                          value={selectedProjectId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            setSelectedProjectId(pId);
                            const p = projects.find((proj) => proj.id === pId);
                            if (p) {
                              setProjectName(p.name);
                            }
                          }}
                          required
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                        >
                          <option value="">-- Selecciona Proyecto --</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.cost_center || p.code} — {p.name} {p.client ? `(${p.client})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Centro de Costos (Autocompletado) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Centro de Costos (Del Proyecto)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={selectedProject?.cost_center || selectedProject?.code || 'Automático según proyecto'}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-slate-100 text-slate-700 font-mono font-medium outline-none cursor-default"
                      />
                    </div>

                    {/* Ubicación / Ciudad (Autocompletado) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Ubicación / Ciudad
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={selectedProject?.location || 'En campo'}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-slate-100 text-slate-700 font-medium outline-none cursor-default"
                      />
                    </div>

                    {/* Fecha de Inspección (Hoy) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Fecha de Inspección <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={inspectionDate}
                        onChange={(e) => setInspectionDate(e.target.value)}
                        required
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>

                    {/* Marca y Modelo del Drone */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Marca y Modelo del Drone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={droneBrandModel}
                        onChange={(e) => setDroneBrandModel(e.target.value)}
                        required
                        placeholder="Ej: DJI Mavic 3 Enterprise"
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>

                    {/* Serial del Drone */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Serial del Drone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={droneSerial}
                        onChange={(e) => setDroneSerial(e.target.value)}
                        required
                        placeholder="Ej: 1581F5GXC2340008"
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Los 25 Ítems de Inspección */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                        <span>📋</span> 3. Criterios de Inspección (25 Ítems Oficiales)
                      </h3>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Marca exactamente una opción (SÍ, NO o N/A) por cada componente evaluado.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                        {answeredCount} / {DRONE_INSPECTION_ITEMS.length} evaluados
                      </span>
                      <button
                        type="button"
                        onClick={handleMarkAllOptimal}
                        className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                        title="Marca todos los 25 ítems con sus valores ideales para que solo cambies las novedades"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Marcar todo en estado óptimo
                      </button>
                    </div>
                  </div>

                  {/* Renderizado de los 6 bloques */}
                  <div className="space-y-6">
                    {DRONE_INSPECTION_SECTIONS.map((sectionName) => {
                      const sectionItems = DRONE_INSPECTION_ITEMS.filter((it) => it.section === sectionName);

                      return (
                        <div key={sectionName} className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                              {sectionName}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {sectionItems.length} ítems
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {sectionItems.map((item) => {
                              const currentVal = droneItemsResponses[item.code] || '';

                              return (
                                <div
                                  key={item.code}
                                  className="p-3 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                >
                                  <div className="flex items-start gap-2.5 flex-1">
                                    <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 flex-shrink-0">
                                      {item.code}
                                    </span>
                                    <p className="text-xs text-slate-800 font-medium leading-snug">
                                      {item.description}
                                    </p>
                                  </div>

                                  {/* Radio Buttons / Pills (SÍ, NO, NA) */}
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                                    {(['SI', 'NO', 'NA'] as const).map((opt) => {
                                      const isSelected = currentVal === opt;
                                      let activeClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
                                      if (isSelected) {
                                        if (opt === 'SI') activeClass = 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold';
                                        if (opt === 'NO') activeClass = 'bg-rose-600 text-white border-rose-600 shadow-sm font-bold';
                                        if (opt === 'NA') activeClass = 'bg-slate-700 text-white border-slate-700 shadow-sm font-bold';
                                      }

                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() =>
                                            setDroneItemsResponses((prev) => ({
                                              ...prev,
                                              [item.code]: opt,
                                            }))
                                          }
                                          className={`text-xs px-3 py-1 rounded-xl border transition-all ${activeClass}`}
                                        >
                                          {opt === 'SI' ? 'SÍ' : opt === 'NO' ? 'NO' : 'N/A'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Puntos Críticos y Observaciones Generales */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 flex items-center gap-1.5">
                    <span>📝</span> 4. Cierre de Inspección y Novedades
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Punto Crítico que Inhabilita el Equipo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={droneCriticalPoint}
                        onChange={(e) => setDroneCriticalPoint(e.target.value)}
                        placeholder="Por defecto: Ninguno"
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Observaciones Generales
                      </label>
                      <textarea
                        rows={3}
                        value={droneObservations}
                        onChange={(e) => setDroneObservations(e.target.value)}
                        placeholder="Registra cualquier condición atípica de vuelo, mantenimiento o del entorno..."
                        className="w-full text-xs p-3 rounded-xl border border-border bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Firmas Digitales con Nombre Verificado y Trazo en Pantalla */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                      <span>✍️</span> 5. Firmas Digitales Verificadas (Operador y SSTA) <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Ambas firmas requieren confirmación del Nombre Completo antes de habilitar el trazo en pantalla.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tarjeta Firma Operador */}
                    <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Firma Operador / Responsable
                          </span>
                          {operatorSignDataUrl ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Firmado
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          <strong>Nombre:</strong> {operatorSignName || locatorName || 'Por registrar'}
                        </p>
                      </div>

                      {operatorSignDataUrl ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-col items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={operatorSignDataUrl}
                            alt="Firma Operador"
                            className="h-16 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setIsOperatorModalOpen(true)}
                            className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold mt-1 flex items-center gap-1"
                          >
                            <PenTool className="w-3 h-3" /> Modificar Firma
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsOperatorModalOpen(true)}
                          className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          ✍️ Capturar Firma Operador
                        </button>
                      )}
                    </div>

                    {/* Tarjeta Firma SSTA */}
                    <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Firma Responsable SSTA / SST
                          </span>
                          {sstaSignDataUrl ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Firmado
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          <strong>Nombre:</strong> {sstaSignName || 'Por registrar'}
                        </p>
                      </div>

                      {sstaSignDataUrl ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-col items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sstaSignDataUrl}
                            alt="Firma SSTA"
                            className="h-16 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setIsSstaModalOpen(true)}
                            className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold mt-1 flex items-center gap-1"
                          >
                            <PenTool className="w-3 h-3" /> Modificar Firma
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsSstaModalOpen(true)}
                          className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          ✍️ Capturar Firma SSTA
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra de Envío Drone */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-text-muted">
                    📑 Se registrará en la <strong>Base de Datos</strong> y se generará el <strong>PDF Oficial</strong>
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
                      className="btn bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin text-sm">⚙️</span> Guardando y Generando PDF...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Finalizar y Generar Evidencia PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* SI ES OTRO FORMATO GENERAL DE LA CARPETA 24: RENDERIZAR FORMULARIO ESTÁNDAR CON IA Y VOZ */}
            {activeTemplate && !isDroneTemplate && (
              <form onSubmit={handleGeneralSubmit} className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Selector de Proyecto */}
                  <div>
                    <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                      2. Proyecto Activo <span className="text-red-500">*</span>
                    </label>
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
                  </div>

                  {/* Fecha de Inspección */}
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

                {/* Localizador Name */}
                <div>
                  <label className="text-xs font-bold text-text-primary uppercase tracking-wide block mb-1.5">
                    Localizador Responsable (Autocompletado) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={locatorName}
                    onChange={(e) => setLocatorName(e.target.value)}
                    required
                    placeholder="Nombre del localizador"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-gray-50 focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                {/* Pautas Guía con IA */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      3. Preguntas Guía para la Inspección ({activeTemplate.code})
                    </h3>
                    <button
                      type="button"
                      onClick={() => loadGuidanceForTemplate(activeTemplate)}
                      disabled={isLoadingGuidance}
                      className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 self-start sm:self-auto disabled:opacity-50"
                    >
                      <span>{isLoadingGuidance ? '⏳' : '🔄'}</span>
                      <span>{isLoadingGuidance ? 'Analizando...' : 'Regenerar Pauta'}</span>
                    </button>
                  </div>

                  <div className="relative rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40 p-4 shadow-sm">
                    <p className="text-xs text-text-primary leading-relaxed font-normal">
                      {guidanceParagraph || getFallbackGuidanceParagraph(activeTemplate.code, activeTemplate.title)}
                    </p>
                  </div>
                </div>

                {/* Notas y Grabación por Voz */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary uppercase tracking-wide block">
                      4. Notas y Observaciones de Inspección
                    </label>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`text-xs px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse'
                          : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-ping' : 'bg-teal-600'}`} />
                      <span>{isRecording ? '⏹ Detener Dictado' : '🎙️ Dictar con Micrófono'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={5}
                    value={voiceNotes}
                    onChange={(e) => setVoiceNotes(e.target.value)}
                    placeholder="Describe los hallazgos y condiciones de seguridad respondiendo a las preguntas guía..."
                    className="w-full text-xs p-3 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Botón de Envío General */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                  <span className="text-[11px] text-text-muted">
                    📄 Salida: Copia directa en PDF en Google Drive
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
                      {isSubmitting ? '⚙️ Generando...' : '📄 Generar Evidencia en PDF'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Si no hay plantilla seleccionada */}
            {!selectedTemplateId && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/70 p-8 text-center space-y-2">
                <span className="text-3xl block">📋</span>
                <p className="text-xs font-bold text-text-primary">
                  Selecciona un formato en el Paso 1 para comenzar
                </p>
                <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                  Al elegir <strong>FOR-HSEQ-024 Inspección Pre-operacional de Drone</strong>, se cargará la matriz de los 25 ítems con firmas digitales y autocompletado del proyecto.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Firma Operador */}
      <DigitalSignatureModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        title="Firma Digital del Operador / Responsable"
        roleLabel="Operador de Drone"
        initialName={operatorSignName || locatorName}
        onSaveSignature={(name, dataUrl) => {
          setOperatorSignName(name);
          setOperatorSignDataUrl(dataUrl);
        }}
      />

      {/* Modal Firma SSTA */}
      <DigitalSignatureModal
        isOpen={isSstaModalOpen}
        onClose={() => setIsSstaModalOpen(false)}
        title="Firma Digital del Responsable SSTA / SST"
        roleLabel="Seguridad y Salud en el Trabajo"
        initialName={sstaSignName}
        onSaveSignature={(name, dataUrl) => {
          setSstaSignName(name);
          setSstaSignDataUrl(dataUrl);
        }}
      />
    </div>
  );
}
