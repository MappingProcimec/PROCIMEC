'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  Layers,
  Play,
  RotateCw,
  Download,
  CheckCircle2,
  Clock,
  FileCode,
  FileText,
  Boxes,
  Compass,
  ChevronRight,
  ChevronDown,
  Info,
  FolderArchive,
  Sparkles,
  Loader2,
  Radio,
  Coins,
  CheckSquare,
  Square,
  ArrowRight,
  Calendar,
  User,
  AlertCircle,
  Paperclip,
  Camera,
  ExternalLink,
  UploadCloud,
  Eye,
  X,
  Navigation,
  Zap,
} from 'lucide-react';
import {
  GprPipelineJob,
  GprPipelineStepKey,
  ProjectGprDataSummary,
} from '@/types/gpr-pipeline';
import { getActiveProjectId, setActiveProjectId } from '@/hooks/useActiveProject';
import { getUtilityLayer } from '@/lib/gpr-cad/generators/dxf-generator';
import { parseTopographyTxt, TopographyDataset } from '@/lib/gpr-cad/parsers/topography-txt-parser';

interface ProjectOption {
  id: string;
  name: string;
  client: string;
  cost_center?: string;
  location?: string;
}

// Información canónica y estimaciones de los 5 pasos obligatorios
const CANONICAL_STEP_INFO: Record<
  GprPipelineStepKey,
  { name: string; desc: string; defaultIn: number; defaultOut: number; outputExt: string }
> = {
  cad_2d: {
    name: 'Paso 1: Elaboración del Plano 2D Base (.dxf / .dwg)',
    desc: 'Delineación de ejes viales, franjas de exploración por tramo, abscisado y rótulo institucional PROCIMEC.',
    defaultIn: 1420,
    defaultOut: 680,
    outputExt: 'dxf',
  },
  gpr_raw_proc: {
    name: 'Paso 2: Procesamiento de Datos Crudos GPR y Detección de Anomalías (.pdf)',
    desc: 'Motor GSF-Processor: Filtrado DSP (Time-Zero, Dewow 2.0ns, Ganancia SEC 40dB, Pasa-banda) y detección geofísica de hipérbolas y redes (ASCE 38-02 / ASTM D6432).',
    defaultIn: 1650,
    defaultOut: 890,
    outputExt: 'pdf',
  },
  cad_2d_refine: {
    name: 'Paso 3: Mejora del Plano 2D con Interferencias (.dxf / .dwg)',
    desc: 'Incrustación de redes subterráneas con capas normalizadas por servicio, cotas Z, etiquetas y cuadro de redes.',
    defaultIn: 1890,
    defaultOut: 1120,
    outputExt: 'dxf',
  },
  bim_3d_rvt: {
    name: 'Paso 4: Elaboración del Modelo 3D BIM (.ifc / .rvt)',
    desc: 'Modelado paramétrico volumétrico LOD 300 en IFC 4.0 para Revit, cotas invert y Clash Detection espacial.',
    defaultIn: 2150,
    defaultOut: 1450,
    outputExt: 'ifc',
  },
  project_report: {
    name: 'Paso 5: Informe Final del Proyecto (.docx)',
    desc: 'Redacción técnica consolidada, volumetría, matriz de riesgos de excavación y membrete oficial (FOR-GPR-05).',
    defaultIn: 2800,
    defaultOut: 2200,
    outputExt: 'docx',
  },
};

const STEP_KEYS_ORDER: GprPipelineStepKey[] = [
  'cad_2d',
  'gpr_raw_proc',
  'cad_2d_refine',
  'bim_3d_rvt',
  'project_report',
];

interface DeliverableMetaInfo {
  stepKey: GprPipelineStepKey;
  stepNum: number;
  title: string;
  shortTitle: string;
  ext: string;
  formatBadge: string;
  formatBadgeStyle: string;
  standard: string;
  software: string;
  defaultFileName: (projectName: string) => string;
  expectedOutput: string;
  keyOutputs: { label: string; desc: string }[];
}

const CANONICAL_DELIVERABLES_META: Record<GprPipelineStepKey, DeliverableMetaInfo> = {
  cad_2d: {
    stepKey: 'cad_2d',
    stepNum: 1,
    title: 'Plano 2D Base Vectorial (.dxf / AutoCAD R2018)',
    shortTitle: 'Plano 2D Base Vectorial',
    ext: 'dxf',
    formatBadge: 'DXF R2018',
    formatBadgeStyle: 'bg-rose-50 text-rose-800 border-rose-200',
    standard: 'NSR-10 / Cartografía Vial PROCIMEC',
    software: 'AutoCAD 2018+, Civil 3D, QGIS, LibreCAD',
    defaultFileName: (p) => `Plano_2D_Base_${p}.dxf`,
    expectedOutput: 'Delineación vectorial de ejes viales, franjas de exploración delimitadas por tramo, abscisado K0+000 y rótulo oficial de PROCIMEC INGENIERÍA S.A.S.',
    keyOutputs: [
      { label: 'Ejes Viales', desc: 'Capa EJE_VIA (Color 1 Rojo, 0.30mm)' },
      { label: 'Franja de Exploración', desc: 'Capa BORDE_EXPLORACION (Color 8 Gris)' },
      { label: 'Abscisado y Rótulo', desc: 'Cotas cada 20m y membrete legal institucional' },
    ],
  },
  gpr_raw_proc: {
    stepKey: 'gpr_raw_proc',
    stepNum: 2,
    title: 'Informe Técnico DSP y Detección de Anomalías (.pdf / FOR-GPR-04)',
    shortTitle: 'Informe Técnico DSP y Detección',
    ext: 'pdf',
    formatBadge: 'PDF DSP + DET',
    formatBadgeStyle: 'bg-sky-50 text-sky-800 border-sky-200',
    standard: 'FOR-GPR-04 v2 / ASCE 38-02 / ASTM D6432',
    software: 'Adobe Acrobat Reader, Visores PDF de Navegador',
    defaultFileName: (p) => `Reporte_Radargramas_DSP_${p}.pdf`,
    expectedOutput: 'Procesamiento digital de señales (Time-Zero, Dewow 2.0ns, SEC Gain 40dB, Pasa-banda) y detección automática de difracciones hiperbólicas y redes de servicios públicos por perfil.',
    keyOutputs: [
      { label: 'Cadena DSP (GSF-Processor)', desc: 'Time-Zero + Dewow 2.0ns + Ganancia SEC 40dB + Pasa-Banda' },
      { label: 'Detección Geofísica', desc: 'Identificación de hipérbolas R²>=0.70 y redes subterráneas Z' },
      { label: 'Formato Oficial', desc: 'Plantilla Institucional de Geofísica FOR-GPR-04 v2' },
    ],
  },
  cad_2d_refine: {
    stepKey: 'cad_2d_refine',
    stepNum: 3,
    title: 'Plano 2D Mejorado con Redes e Interferencias (.dxf / AutoCAD)',
    shortTitle: 'Plano 2D Mejorado con Redes',
    ext: 'dxf',
    formatBadge: 'DXF REDES',
    formatBadgeStyle: 'bg-amber-50 text-amber-900 border-amber-200',
    standard: 'ASCE 38-02 / CI/ASCE 38-22 Nivel de Calidad B',
    software: 'AutoCAD Civil 3D, AutoCAD Map 3D, MicroStation',
    defaultFileName: (p) => `Plano_2D_Interferencias_${p}.dxf`,
    expectedOutput: 'Incrustación de todas las interferencias subterráneas detectadas con capas normalizadas por servicio, cotas Z de profundidad invert, diámetros y cuadro técnico de redes.',
    keyOutputs: [
      { label: 'Capas Normalizadas', desc: 'RED_GAS, RED_ACUEDUCTO, RED_ENERGIA, RED_TELECOM, etc.' },
      { label: 'Cotas Z de Invert', desc: 'Profundidades reales estampadas en cada vértice' },
      { label: 'Cuadro de Redes', desc: 'Tabla de diámetros, profundidades y nivel de confianza' },
    ],
  },
  bim_3d_rvt: {
    stepKey: 'bim_3d_rvt',
    stepNum: 4,
    title: 'Modelo 3D BIM Subterráneo (.ifc / Revit LOD 300)',
    shortTitle: 'Modelo 3D BIM Subterráneo (IFC 4.0)',
    ext: 'ifc',
    formatBadge: 'IFC 4.0 LOD 300',
    formatBadgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    standard: 'ISO 10303-21 / ISO 19650 / BIM LOD 300',
    software: 'Autodesk Revit, Navisworks, BIM Vision, Solibri',
    defaultFileName: (p) => `Modelo_3D_BIM_Subterraneo_${p}.ifc`,
    expectedOutput: 'Modelado paramétrico volumétrico LOD 300 en IFC 4.0 abrible en Revit, tuberías continuas con cotas invert de enterramiento y matriz espacial de Clash Detection (<0.30m).',
    keyOutputs: [
      { label: 'Geometría Volumétrica', desc: 'Tuberías cilíndricas LOD 300 (IfcPipeSegment)' },
      { label: 'Cotas Invert Z', desc: 'Z = -profundidad referenciada a la rasante' },
      { label: 'Clash Detection', desc: 'Validación espacial de cruces y colisiones entre redes' },
    ],
  },
  project_report: {
    stepKey: 'project_report',
    stepNum: 5,
    title: 'Informe Técnico Final del Proyecto (.docx / FOR-GPR-05)',
    shortTitle: 'Informe Técnico Final Word',
    ext: 'docx',
    formatBadge: 'DOCX OFICIAL',
    formatBadgeStyle: 'bg-blue-50 text-blue-800 border-blue-200',
    standard: 'FOR-GPR-05 v2 / ISO 9001:2015 & ISO 45001:2018',
    software: 'Microsoft Word 365 / 2019+, LibreOffice Writer',
    defaultFileName: (p) => `Informe_Final_Georadar_${p}.docx`,
    expectedOutput: 'Informe consolidado bajo formato oficial FOR-GPR-05 v2 de PROCIMEC INGENIERÍA S.A.S. con resumen de metrajes, cuadro de interferencias y matriz de riesgos de rotura.',
    keyOutputs: [
      { label: 'Membrete Oficial', desc: 'Razón Social: PROCIMEC INGENIERÍA S.A.S.' },
      { label: 'Consolidado Metrológico', desc: 'Metros lineales, área explorada y tramos' },
      { label: 'Matriz de Riesgos', desc: 'Protocolo de excavación segura por servicio' },
    ],
  },
};

// Tarifas oficiales de Inferencia Google Gemini 1.5 Pro (USD por millón de tokens)
const GEMINI_INPUT_RATE_USD = 3.50; // $3.50 USD / 1M input
const GEMINI_OUTPUT_RATE_USD = 10.50; // $10.50 USD / 1M output
const USD_TO_COP = 4150; // TRM representativa de referencia

export function GprCadStudioPanel() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Reorganización canónica de pestañas: 1. Reportes y Datos de Campo, 2. Pipeline de Orquestación, 3. Entregables, 4. Costos API IA
  const [activeTab, setActiveTab] = useState<'datos_campo' | 'pipeline' | 'entregables' | 'costos_api'>('datos_campo');
  
  const [expandedPromptStep, setExpandedPromptStep] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Estado para selección granular de reportes de campo (formularios llenados)
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  // Estado para georreferenciación y archivo .txt de Estación Total
  const [customTopoTxt, setCustomTopoTxt] = useState<string>('');
  const [customTopoFileName, setCustomTopoFileName] = useState<string>('');
  const [parsedTopoData, setParsedTopoData] = useState<TopographyDataset | null>(null);
  const [showTopoPointsModal, setShowTopoPointsModal] = useState<boolean>(false);
  const [isUploadingTopo, setIsUploadingTopo] = useState<boolean>(false);

  // 1. Sincronización inicial con el proyecto activo de Mi Panel (localStorage)
  useEffect(() => {
    const activeStoredId = getActiveProjectId();
    if (activeStoredId) {
      setSelectedProjectId(activeStoredId);
    }
  }, []);

  // 2. Consultar información del proyecto y pipeline con react-query
  const activeQueryId = selectedProjectId || (typeof window !== 'undefined' ? getActiveProjectId() : '') || '';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gpr-pipeline', activeQueryId],
    queryFn: async () => {
      const url = activeQueryId
        ? `/api/tools/gpr-pipeline?projectId=${encodeURIComponent(activeQueryId)}`
        : '/api/tools/gpr-pipeline';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar datos del pipeline');
      return json.data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const projects: ProjectOption[] = useMemo(() => data?.projects || [], [data?.projects]);

  // Sincronización automática con la lista de proyectos disponibles
  useEffect(() => {
    if (projects.length === 0) return;
    const storedActiveId = getActiveProjectId();
    if (storedActiveId && projects.some((p) => p.id === storedActiveId)) {
      if (selectedProjectId !== storedActiveId) {
        setSelectedProjectId(storedActiveId);
      }
    } else if (!selectedProjectId) {
      const fallbackId = data?.targetProjectId || projects[0]?.id || '';
      if (fallbackId) {
        setSelectedProjectId(fallbackId);
        setActiveProjectId(fallbackId);
      }
    }
  }, [projects, data?.targetProjectId, selectedProjectId]);

  const currentProjectId = selectedProjectId || (projects[0]?.id ?? '');
  const projectSummary: ProjectGprDataSummary | null = data?.projectSummary || null;
  const activeJob: GprPipelineJob | null = data?.activeJob || null;

  // Buscar si alguno de los reportes seleccionados tiene un archivo de topografía .txt adjunto
  const attachedTxtFile = useMemo(() => {
    const reports = projectSummary?.field_reports || [];
    for (const r of reports) {
      if (selectedReportIds.includes(r.id) && r.files) {
        const found = r.files.find(
          (f) => f.original_name?.toLowerCase().endsWith('.txt') || f.file_type === 'gps'
        );
        if (found) return { file: found, reportDate: r.report_date };
      }
    }
    return null;
  }, [projectSummary?.field_reports, selectedReportIds]);

  // Si el job activo ya tiene topografía persistida, cargarla
  useEffect(() => {
    const savedTxt = activeJob?.input_metrics?.topography_txt;
    if (savedTxt && !customTopoTxt) {
      setCustomTopoTxt(savedTxt);
      setCustomTopoFileName(activeJob?.input_metrics?.topography_file_name || 'estacion_total.txt');
      setParsedTopoData(parseTopographyTxt(savedTxt));
    }
  }, [activeJob?.input_metrics?.topography_txt, customTopoTxt]);

  // Si hay un archivo adjunto en el reporte y no se ha cargado topografía manual, intentar leerlo automáticamente
  useEffect(() => {
    if (attachedTxtFile?.file?.url && !customTopoTxt && !parsedTopoData) {
      fetch(attachedTxtFile.file.url)
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => {
          if (text && text.trim().length > 0) {
            setCustomTopoTxt(text);
            setCustomTopoFileName(attachedTxtFile.file.original_name);
            const parsed = parseTopographyTxt(text);
            setParsedTopoData(parsed);
          }
        })
        .catch(() => {});
    }
  }, [attachedTxtFile, customTopoTxt, parsedTopoData]);

  // Inicializar la selección de reportes cuando se cargan los datos del proyecto
  useEffect(() => {
    const reports = projectSummary?.field_reports || [];
    if (reports.length > 0) {
      // Si el job ya tenía guardada una selección específica previa, respetarla
      const savedSelection = activeJob?.input_metrics?.selected_report_ids;
      if (Array.isArray(savedSelection) && savedSelection.length > 0) {
        setSelectedReportIds(savedSelection.filter((id) => reports.some((r) => r.id === id)));
      } else {
        // Por defecto todos los reportes del proyecto quedan seleccionados
        setSelectedReportIds((prev) => {
          if (prev.length === 0 || !prev.every((id) => reports.some((r) => r.id === id))) {
            return reports.map((r) => r.id);
          }
          return prev;
        });
      }
    } else {
      setSelectedReportIds([]);
    }
  }, [projectSummary?.field_reports, activeJob?.input_metrics?.selected_report_ids, currentProjectId]);

  // Carga y procesamiento local de archivo .txt de Estación Total
  const handleTopoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTopo(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCustomTopoTxt(text);
        setCustomTopoFileName(file.name);
        const parsed = parseTopographyTxt(text);
        setParsedTopoData(parsed);

        // Guardar en el pipeline job activo
        try {
          await fetch('/api/tools/gpr-pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: currentProjectId,
              selectedReportIds,
              topographyTxt: text,
              topographyFileName: file.name,
            }),
          });
          setStatusMessage(`Topografía georreferenciada guardada: ${parsed.points.length} puntos de ${file.name}`);
          queryClient.invalidateQueries({ queryKey: ['gpr-pipeline'] });
          setTimeout(() => setStatusMessage(''), 5000);
        } catch (err) {
          console.error('Error guardando topografía:', err);
        } finally {
          setIsUploadingTopo(false);
        }
      }
    };
    reader.readAsText(file);
  };

  // 3. Mutación para inicializar o recalcular Job
  const createJobMutation = useMutation({
    mutationFn: async ({ pId, reportIds }: { pId: string; reportIds?: string[] }) => {
      const res = await fetch('/api/tools/gpr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: pId,
          selectedReportIds: reportIds,
          topographyTxt: customTopoTxt || undefined,
          topographyFileName: customTopoFileName || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al inicializar pipeline');
      return json.data;
    },
    onSuccess: () => {
      setStatusMessage('Flujo de trabajo inicializado exitosamente.');
      queryClient.invalidateQueries({ queryKey: ['gpr-pipeline'] });
      setTimeout(() => setStatusMessage(''), 4000);
    },
    onError: (err: Error) => {
      alert(`Error al inicializar: ${err.message}`);
    },
  });

  // 4. Mutación para ejecutar un paso individual o todos con filtrado estricto
  const executeStepMutation = useMutation({
    mutationFn: async ({
      jobId,
      stepKey,
      runAll,
      projectId,
      reportIds,
    }: {
      jobId?: string;
      stepKey?: GprPipelineStepKey;
      runAll?: boolean;
      projectId?: string;
      reportIds?: string[];
    }) => {
      const res = await fetch('/api/tools/gpr-pipeline/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          stepKey,
          runAll,
          projectId,
          selectedReportIds: reportIds,
          topographyTxt: customTopoTxt || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al ejecutar paso');
      return json.data;
    },
    onSuccess: (res) => {
      setStatusMessage(res.message || 'Paso procesado exitosamente.');
      queryClient.invalidateQueries({ queryKey: ['gpr-pipeline'] });
      setTimeout(() => setStatusMessage(''), 5000);
    },
    onError: (err: Error) => {
      alert(`Error en ejecución: ${err.message}`);
    },
  });

  // Cálculos dinámicos de métricas basados ÚNICAMENTE en los reportes seleccionados
  const activeMetrics = useMemo(() => {
    const allReports = projectSummary?.field_reports || [];
    const selected = allReports.filter((r) => selectedReportIds.includes(r.id));

    let totalMl = 0;
    let totalM2 = 0;
    let maxDepth = 0;
    let utilsCount = 0;

    selected.forEach((rep) => {
      totalMl += rep.total_ml || 0;
      totalM2 += rep.total_m2 || 0;
      if (rep.global_max_depth && rep.global_max_depth > maxDepth) {
        maxDepth = rep.global_max_depth;
      }
      if (Array.isArray(rep.detected_utilities)) {
        utilsCount += rep.detected_utilities.length;
      }
    });

    return {
      total_ml: Number(totalMl.toFixed(2)),
      total_m2: Number(totalM2.toFixed(2)),
      max_depth_m: Number(maxDepth.toFixed(2)),
      utilities_count: utilsCount,
      selected_count: selected.length,
      total_available: allReports.length,
      selectedReportsList: selected,
    };
  }, [projectSummary?.field_reports, selectedReportIds]);

  // Manejo de selección múltiple de reportes
  const toggleSelectAllReports = () => {
    const allReports = projectSummary?.field_reports || [];
    if (selectedReportIds.length === allReports.length) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(allReports.map((r) => r.id));
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
    );
  };

  const toggleExpandReport = (reportId: string) => {
    setExpandedReports((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  // Ensamblar los 5 pasos canónicos garantizando que SIEMPRE sean visibles
  const displaySteps = useMemo(() => {
    const currentSteps = activeJob?.steps || [];
    return STEP_KEYS_ORDER.map((key, idx) => {
      const existing = currentSteps.find((s) => s.step_key === key);
      const meta = CANONICAL_STEP_INFO[key];
      const isCompleted = existing?.status === 'completed';

      // Tokens reales consumidos (únicamente calculados si el paso ya fue completado)
      const inTok = isCompleted ? (existing?.token_usage?.input_tokens ?? meta.defaultIn) : 0;
      const outTok = isCompleted ? (existing?.token_usage?.output_tokens ?? meta.defaultOut) : 0;
      const totalTok = inTok + outTok;
      const costUsd = isCompleted
        ? (inTok / 1_000_000) * GEMINI_INPUT_RATE_USD + (outTok / 1_000_000) * GEMINI_OUTPUT_RATE_USD
        : 0;
      const costCop = Math.round(costUsd * USD_TO_COP);

      // Valores proyectados / estimados para referencia presupuestal cuando aún no se ha ejecutado
      const estInTok = meta.defaultIn;
      const estOutTok = meta.defaultOut;
      const estTotalTok = estInTok + estOutTok;
      const estCostUsd = (estInTok / 1_000_000) * GEMINI_INPUT_RATE_USD + (estOutTok / 1_000_000) * GEMINI_OUTPUT_RATE_USD;
      const estCostCop = Math.round(estCostUsd * USD_TO_COP);

      // Si existe URL de descarga y hay reportes seleccionados, asegurar parámetro reportIds
      let downloadUrl = existing?.output_file_url;
      if (!downloadUrl && currentProjectId && (existing?.status === 'completed' || !!existing?.output_file_name)) {
        const cleanName = (projectSummary?.project_name || 'Proyecto').replace(/[^a-zA-Z0-9_-]/g, '_');
        const rParam = selectedReportIds.length > 0 ? `&reportIds=${encodeURIComponent(selectedReportIds.join(','))}` : '';
        const jParam = activeJob?.id ? `&jobId=${encodeURIComponent(activeJob.id)}` : '';
        downloadUrl = `/api/tools/gpr-pipeline/download?projectId=${encodeURIComponent(currentProjectId)}${jParam}&stepKey=${key}&type=${meta.outputExt}&name=${cleanName}_${key}${rParam}`;
      } else if (downloadUrl && selectedReportIds.length > 0 && !downloadUrl.includes('reportIds=')) {
        downloadUrl += `&reportIds=${encodeURIComponent(selectedReportIds.join(','))}`;
      }

      return {
        id: existing?.id || `step_${key}`,
        step_key: key,
        step_order: idx + 1,
        step_name: existing?.step_name || meta.name,
        desc: meta.desc,
        output_ext: meta.outputExt,
        status: existing?.status || 'pending',
        output_file_name: existing?.output_file_name,
        output_file_url: downloadUrl,
        ai_prompt: existing?.ai_prompt,
        ai_response: existing?.ai_response,
        execution_logs: existing?.execution_logs,
        completed_at: existing?.completed_at,
        ai_model: existing?.ai_model_used || 'Gemini 1.5 Pro',
        input_tokens: inTok,
        output_tokens: outTok,
        total_tokens: totalTok,
        cost_usd: costUsd,
        cost_cop_ai: costCop,
        estimated_input_tokens: estInTok,
        estimated_output_tokens: estOutTok,
        estimated_total_tokens: estTotalTok,
        estimated_cost_usd: estCostUsd,
        estimated_cost_cop: estCostCop,
      };
    });
  }, [activeJob?.steps, activeJob?.id, currentProjectId, projectSummary?.project_name, selectedReportIds]);

  const completedDeliverablesCount = useMemo(() => {
    return displaySteps.filter((s) => s.status === 'completed').length;
  }, [displaySteps]);

  const activeProjectName = useMemo(() => {
    return projects.find((p) => p.id === currentProjectId)?.name || projectSummary?.project_name || 'Proyecto';
  }, [projects, currentProjectId, projectSummary?.project_name]);

  const projectCleanName = useMemo(() => {
    return activeProjectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [activeProjectName]);

  const formatDateTime = (isoDate?: string | null) => {
    if (!isoDate) return 'Pendiente';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  // Ejecución transparente (auto-crea el job si no existe en BD)
  const handleExecuteSingleStep = async (stepKey: GprPipelineStepKey) => {
    if (selectedReportIds.length === 0) {
      alert('Debes seleccionar al menos un reporte de campo para ejecutar el paso.');
      return;
    }

    let targetJobId = activeJob?.id;
    if (!targetJobId) {
      try {
        const newJob = await createJobMutation.mutateAsync({
          pId: currentProjectId,
          reportIds: selectedReportIds,
        });
        targetJobId = newJob.id;
      } catch (e) {
        console.error('Error auto-creando job:', e);
      }
    }
    executeStepMutation.mutate({
      jobId: targetJobId,
      stepKey,
      runAll: false,
      projectId: currentProjectId,
      reportIds: selectedReportIds,
    });
  };

  const handleExecuteAllSteps = async () => {
    if (selectedReportIds.length === 0) {
      alert('Debes seleccionar al menos un reporte de campo para ejecutar el flujo completo.');
      return;
    }

    let targetJobId = activeJob?.id;
    if (!targetJobId) {
      try {
        const newJob = await createJobMutation.mutateAsync({
          pId: currentProjectId,
          reportIds: selectedReportIds,
        });
        targetJobId = newJob.id;
      } catch (e) {
        console.error('Error auto-creando job:', e);
      }
    }
    executeStepMutation.mutate({
      jobId: targetJobId,
      runAll: true,
      projectId: currentProjectId,
      reportIds: selectedReportIds,
    });
  };

  const completedStepsCount = displaySteps.filter((s) => s.status === 'completed').length;
  const progressPercent = Math.round((completedStepsCount / displaySteps.length) * 100);

  const totalInputTokens = useMemo(() => displaySteps.reduce((acc, s) => acc + s.input_tokens, 0), [displaySteps]);
  const totalOutputTokens = useMemo(() => displaySteps.reduce((acc, s) => acc + s.output_tokens, 0), [displaySteps]);
  const grandTotalTokens = totalInputTokens + totalOutputTokens;
  const grandTotalCostUsd = useMemo(() => displaySteps.reduce((acc, s) => acc + s.cost_usd, 0), [displaySteps]);
  const grandTotalCostCopAi = Math.round(grandTotalCostUsd * USD_TO_COP);

  const projectedTotalCostUsd = useMemo(
    () => displaySteps.reduce((acc, s) => acc + (s.status === 'completed' ? s.cost_usd : s.estimated_cost_usd), 0),
    [displaySteps]
  );
  const projectedTotalCostCop = Math.round(projectedTotalCostUsd * USD_TO_COP);

  const formatCop = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$ 0 COP';
    return `$ ${val.toLocaleString('es-CO')} COP`;
  };

  const getStepIcon = (key: GprPipelineStepKey) => {
    switch (key) {
      case 'cad_2d':
        return <FileCode className="w-5 h-5 text-accent" strokeWidth={1.75} />;
      case 'gpr_raw_proc':
        return <Compass className="w-5 h-5 text-accent" strokeWidth={1.75} />;
      case 'cad_2d_refine':
        return <Layers className="w-5 h-5 text-accent" strokeWidth={1.75} />;
      case 'bim_3d_rvt':
        return <Boxes className="w-5 h-5 text-accent" strokeWidth={1.75} />;
      case 'project_report':
        return <FileText className="w-5 h-5 text-accent" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── BARRA SUPERIOR: SELECTOR DE PROYECTO & ACCIÓN PRINCIPAL ── */}
      <div className="card p-5 bg-white border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 max-w-xl">
          <label className="label text-xs uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5 mb-1.5">
            <FolderArchive className="w-4 h-4 text-accent" strokeWidth={1.75} />
            Proyecto Imputable de Exploración
          </label>
          <select
            className="select w-full font-medium text-xs sm:text-sm"
            value={currentProjectId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedProjectId(newId);
              setActiveProjectId(newId);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cost_center ? `[${p.cost_center}] ` : ''}
                {p.name} — {p.client}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExecuteAllSteps}
            disabled={executeStepMutation.isPending || createJobMutation.isPending || selectedReportIds.length === 0}
            className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
            title="Ejecutar secuencialmente los 5 pasos con los reportes seleccionados"
          >
            {executeStepMutation.isPending || createJobMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-900" />
            ) : (
              <Play className="w-4 h-4 text-primary-900 fill-primary-900" strokeWidth={2} />
            )}
            Ejecutar Flujo Completo (5 Pasos)
          </button>

          <button
            onClick={() => createJobMutation.mutate({ pId: currentProjectId, reportIds: selectedReportIds })}
            disabled={createJobMutation.isPending}
            className="btn-ghost px-3.5 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-xl border border-border cursor-pointer flex items-center gap-1.5"
            title="Reinicializar el estado del pipeline"
          >
            <RotateCw className={`w-3.5 h-3.5 ${createJobMutation.isPending ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            <span>Reiniciar</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-ghost p-2.5 text-text-muted hover:text-text-primary rounded-xl border border-border cursor-pointer"
            title="Recargar datos del proyecto"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* MENSAJE DE ESTADO REACTIVO */}
      {statusMessage && (
        <div className="card p-3.5 bg-accent/10 border border-accent/30 text-xs font-semibold text-text-primary flex items-center gap-2.5 animate-slide-up shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-accent shrink-0" strokeWidth={2} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ── CUADRO DE MÉTRICAS DINÁMICAS (CARBÓN TÉCNICO OFICIAL LEY 5) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Metros Lineales */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Metros Lineales</span>
            <Radio className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-accent mt-1">
            {activeMetrics.total_ml.toLocaleString('es-CO')}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">ML</span>
          </div>
          {activeMetrics.selected_count < activeMetrics.total_available && (
            <span className="text-[10px] text-white/60 font-mono mt-0.5">
              de {projectSummary?.total_ml || 0} ML en total
            </span>
          )}
        </div>

        {/* 2. Área Explorada */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Área Explorada</span>
            <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {activeMetrics.total_m2.toLocaleString('es-CO')}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">M²</span>
          </div>
          {activeMetrics.selected_count < activeMetrics.total_available && (
            <span className="text-[10px] text-white/60 font-mono mt-0.5">
              de {projectSummary?.total_m2 || 0} M² en total
            </span>
          )}
        </div>

        {/* 3. Prof. Máxima */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Prof. Máxima</span>
            <Compass className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {activeMetrics.max_depth_m}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">m</span>
          </div>
        </div>

        {/* 4. Interferencias */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Interferencias</span>
            <Boxes className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-accent mt-1">
            {activeMetrics.utilities_count}
          </div>
          {activeMetrics.selected_count < activeMetrics.total_available && (
            <span className="text-[10px] text-white/60 font-mono mt-0.5">
              de {projectSummary?.detected_utilities.length || 0} reportadas
            </span>
          )}
        </div>

        {/* 5. Reportes Campo */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Reportes Campo</span>
            <FileText className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {activeMetrics.selected_count}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">/ {activeMetrics.total_available}</span>
          </div>
        </div>

        {/* 6. Archivos Crudos */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Archivos Crudos</span>
            <Cpu className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {(projectSummary?.raw_gpr_files_count || 0) + (projectSummary?.gps_files_count || 0)}
          </div>
        </div>
      </div>

      {/* ── NAVEGACIÓN POR PESTAÑAS (ORDEN CANÓNICO: 1. DATOS CAMPO | 2. PIPELINE | 3. ENTREGABLES | 4. COSTOS API) ── */}
      <div className="flex border-b border-border gap-2 text-xs font-semibold overflow-x-auto">
        {/* PESTAÑA 1 (IZQUIERDA): Reportes y Datos de Campo */}
        <button
          onClick={() => setActiveTab('datos_campo')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'datos_campo'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4" strokeWidth={1.75} />
          Reportes y Datos de Campo
          <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-accent/20 text-primary-900 rounded-full font-mono font-bold">
            {activeMetrics.selected_count}/{activeMetrics.total_available}
          </span>
        </button>

        {/* PESTAÑA 2: Pipeline de Orquestación */}
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Cpu className="w-4 h-4" strokeWidth={1.75} />
          Pipeline de Orquestación (5 Pasos)
          <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-primary/10 text-primary-900 rounded-full font-mono font-bold">
            {completedStepsCount}/{displaySteps.length}
          </span>
        </button>

        {/* PESTAÑA 3: Entregables (NUEVA ENTRE PIPELINE Y COSTOS) */}
        <button
          onClick={() => setActiveTab('entregables')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'entregables'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FolderArchive className="w-4 h-4" strokeWidth={1.75} />
          Entregables
          <span
            className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              completedDeliverablesCount > 0
                ? 'bg-accent/20 text-primary-900'
                : 'bg-primary/10 text-primary-900'
            }`}
          >
            {completedDeliverablesCount}/{displaySteps.length}
          </span>
        </button>

        {/* PESTAÑA 4 (DERECHA): Costos de Procesamiento API IA */}
        <button
          onClick={() => setActiveTab('costos_api')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'costos_api'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Coins className="w-4 h-4" strokeWidth={1.75} />
          Costos de Procesamiento API IA
          <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-accent/20 text-primary-900 rounded-full font-mono font-bold">
            ${grandTotalCostUsd.toFixed(3)} USD
          </span>
        </button>
      </div>

      {/* ── TAB 1: REPORTES Y DATOS DE CAMPO (SELECCIÓN GRANULAR DE FORMULARIOS) ── */}
      {activeTab === 'datos_campo' && (
        <div className="space-y-4">
          {/* Panel de Control y Selección del Paquete de Información */}
          <div className="card p-4.5 bg-white border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Paquete de Formularios de Campo Diligenciados
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Selecciona las inspecciones que conformarán el entregable técnico. Los reportes desmarcados quedarán totalmente excluidos del plano 2D, modelo BIM y reporte final.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={toggleSelectAllReports}
                className="btn-ghost px-3 py-1.5 text-xs font-semibold rounded-lg border border-border flex items-center gap-1.5 cursor-pointer text-text-primary hover:bg-gray-50"
              >
                {selectedReportIds.length === (projectSummary?.field_reports?.length || 0) ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-text-muted" />
                    <span>Deseleccionar Todos</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-accent" />
                    <span>Seleccionar Todos</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveTab('pipeline')}
                className="btn-primary px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Continuar al Pipeline ({activeMetrics.selected_count})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card de Georreferenciación y Estación Total (.TXT) */}
          <div className="card p-4.5 bg-surface-dark text-white border border-border-dark shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 border border-accent/40 text-accent">
                  <Compass className="w-5 h-5 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">Georreferenciación y Topografía (Estación Total .TXT)</h4>
                    {parsedTopoData && parsedTopoData.points.length > 0 ? (
                      <>
                        <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {parsedTopoData.points.length} Puntos Radiados ({customTopoFileName || 'archivo.txt'})
                        </span>
                        {parsedTopoData.stationSetups && parsedTopoData.stationSetups.length > 0 && (
                          <span className="badge bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-fuchsia-400" />
                            {parsedTopoData.stationSetups.length} Traslados de Estación
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        Modo Esquemático Local (Sin archivo .txt)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/70 mt-1">
                    {parsedTopoData && parsedTopoData.points.length > 0 ? (
                      <>
                        Eje: <strong className="text-accent">{parsedTopoData.axisPoints.length} puntos VIA</strong> ({parsedTopoData.totalAxisLength.toFixed(1)} ML) |
                        {parsedTopoData.stationSetups && parsedTopoData.stationSetups.length > 0 && (
                          <> Estaciones: <span className="font-semibold text-fuchsia-300">{parsedTopoData.stationSetups.map((s) => s.stationId).join(', ')}</span> |</>
                        )}
                        {' '}Norte: <span className="font-mono text-white/90">{parsedTopoData.bounds.minNorth.toFixed(2)} - {parsedTopoData.bounds.maxNorth.toFixed(2)}</span> |
                        Este: <span className="font-mono text-white/90">{parsedTopoData.bounds.minEast.toFixed(2)} - {parsedTopoData.bounds.maxEast.toFixed(2)}</span>
                      </>
                    ) : (
                      'Para que el Plano 2D (.DXF) se dibuje en las coordenadas reales del proyecto en AutoCAD Civil 3D, carga el archivo .txt exportado de la Estación Total (08TP, 02TP traslados de estación, Punto, Norte, Este, Cota, Código).'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {parsedTopoData && parsedTopoData.points.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTopoPointsModal(true)}
                    className="btn-ghost px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/20 text-white hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-accent" />
                    <span>Ver Coordenadas ({parsedTopoData.points.length})</span>
                  </button>
                )}

                <label className="btn-accent px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-primary-900 shadow-xs hover:opacity-95">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{parsedTopoData ? 'Reemplazar .TXT' : 'Cargar Estación Total (.TXT)'}</span>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    className="hidden"
                    onChange={handleTopoFileUpload}
                    disabled={isUploadingTopo}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Card de Archivos Crudos de Georadar (.GSF / .RD3 / .DZT) — Motor GSF-Processor */}
          <div className="card p-4.5 bg-surface-dark text-white border border-border-dark shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0 border border-sky-500/40 text-sky-400">
                  <Cpu className="w-5 h-5 text-sky-400" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">Perfiles y Archivos Crudos de Georadar (.GSF / .RD3 / .DZT)</h4>
                    <span className="badge bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Layers className="w-3 h-3 text-sky-400" />
                      {projectSummary?.raw_gpr_files_count || 0} Archivos Crudos Registrados
                    </span>
                    <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      Motor GSF-Processor Integrado
                    </span>
                  </div>
                  <p className="text-xs text-white/70 mt-1">
                    En el <strong>Paso 2</strong>, el pipeline ejecutará la misma arquitectura de procesamiento DSP (Time-Zero, Dewow 2.0ns, Ganancia SEC 40dB y Filtro Pasa-Banda) y el motor de detección geofísica de hipérbolas y tuberías subterráneas (ASCE 38-02 / ASTM D6432) del Procesador Web GSF.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <a
                  href="/tools/gsf-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 text-primary-900 cursor-pointer shadow-xs hover:opacity-95"
                  title="Abrir la Estación de Trabajo y Procesador Web GSF en una pestaña nueva"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Procesador GSF</span>
                </a>
              </div>
            </div>
          </div>

          {/* Modal de Coordenadas de Topografía (P, N, E, Z, D) y Traslados de Estación */}
          {showTopoPointsModal && parsedTopoData && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-surface border border-border rounded-xl shadow-xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface-dark text-white">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Compass className="w-4 h-4 text-accent" />
                      Levantamiento Topográfico Georreferenciado — {customTopoFileName || 'archivo.txt'}
                    </h3>
                    <p className="text-xs text-white/70 mt-0.5">
                      {parsedTopoData.points.length} puntos de campo | {parsedTopoData.stationSetups?.length || 0} traslados de estación | {parsedTopoData.axisPoints.length} puntos en eje vial | Longitud: {parsedTopoData.totalAxisLength.toFixed(2)} ML
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTopoPointsModal(false)}
                    className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                  {/* Bloque de Traslados de Estación Armada (02TP) */}
                  {parsedTopoData.stationSetups && parsedTopoData.stationSetups.length > 0 && (
                    <div className="border border-fuchsia-500/30 bg-fuchsia-500/5 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-fuchsia-900 dark:text-fuchsia-300 flex items-center gap-1.5 mb-2">
                        <Navigation className="w-3.5 h-3.5 text-fuchsia-500" />
                        Estaciones Ocupadas y Traslados de Estación (02TP — Capa ESTACIONES_DELTA)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {parsedTopoData.stationSetups.map((stn, sIdx) => (
                          <div key={sIdx} className="bg-white dark:bg-primary-900/60 border border-fuchsia-200 dark:border-fuchsia-800/40 rounded p-2 text-xs">
                            <div className="flex items-center justify-between font-bold text-fuchsia-700 dark:text-fuchsia-300">
                              <span>Estación: {stn.stationId}</span>
                              <span className="font-mono text-[11px] bg-fuchsia-100 dark:bg-fuchsia-950 px-1.5 py-0.5 rounded">
                                HI: {stn.instrumentHeight ? `${stn.instrumentHeight.toFixed(3)} m` : 'N/D'}
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[11px] text-text-secondary">
                              <span>N: {stn.north.toFixed(3)}</span>
                              <span>E: {stn.east.toFixed(3)}</span>
                              <span>Z: {stn.elevation.toFixed(3)}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tabla General de Puntos Radiados (08TP) */}
                  <div className="table-container border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary text-text-muted font-bold border-b border-border">
                        <tr>
                          <th className="py-2 px-3 text-left">PUNTO</th>
                          <th className="py-2 px-3 text-right">NORTE (Y)</th>
                          <th className="py-2 px-3 text-right">ESTE (X)</th>
                          <th className="py-2 px-3 text-right">COTA (Z)</th>
                          <th className="py-2 px-3 text-left">CÓDIGO</th>
                          <th className="py-2 px-3 text-left">CAPA CAD</th>
                          <th className="py-2 px-3 text-left">METADATOS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedTopoData.points.slice(0, 300).map((pt, pIdx) => {
                          const isAxis = pt.category === 'eje';
                          const isStation = pt.isStationSetup;
                          return (
                            <tr key={pIdx} className={isStation ? 'bg-fuchsia-500/10 font-medium' : isAxis ? 'bg-accent/5 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-primary-900/40'}>
                              <td className="py-1.5 px-3 font-mono font-bold text-text-primary">{pt.id}</td>
                              <td className="py-1.5 px-3 text-right font-mono text-text-secondary">{pt.north.toFixed(4)}</td>
                              <td className="py-1.5 px-3 text-right font-mono text-text-secondary">{pt.east.toFixed(4)}</td>
                              <td className="py-1.5 px-3 text-right font-mono text-accent">{pt.elevation.toFixed(3)}</td>
                              <td className="py-1.5 px-3 font-mono font-semibold">
                                {pt.code}
                              </td>
                              <td className="py-1.5 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isStation
                                    ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300'
                                    : pt.category === 'gas'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : pt.category === 'acueducto'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : pt.category === 'telecom'
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                    : pt.category === 'energia'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                    : pt.category === 'alcantarillado'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : isAxis
                                    ? 'bg-accent/20 text-accent'
                                    : 'bg-gray-100 text-text-secondary dark:bg-primary-800'
                                }`}>
                                  {pt.layerName}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-[11px] text-text-muted">
                                {pt.depth !== undefined && `Prof: ${pt.depth.toFixed(2)}m `}
                                {pt.diameter && `| ${pt.diameter}`}
                                {!pt.depth && !pt.diameter && '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedTopoData.points.length > 300 && (
                    <p className="text-center text-[11px] text-text-muted mt-2">
                      Mostrando primeros 300 de {parsedTopoData.points.length} puntos radiados. Todos los 544 puntos se incluyen en el entregable .DXF.
                    </p>
                  )}
                </div>

                <div className="p-3 bg-surface-secondary border-t border-border flex justify-end">
                  <button
                    onClick={() => setShowTopoPointsModal(false)}
                    className="btn-primary px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Formularios Llenados (Uno por cada vez que se diligenció) */}
          {!projectSummary?.field_reports || projectSummary.field_reports.length === 0 ? (
            <div className="card p-8 text-center text-text-muted border-dashed border bg-surface/50">
              <FileText className="w-8 h-8 text-text-muted/60 mx-auto mb-2" strokeWidth={1.5} />
              <p className="font-semibold text-sm">No hay formularios de campo registrados para este proyecto.</p>
              <p className="text-xs text-text-secondary mt-1">Diligencia un Formulario de Campo GPR para alimentar el pipeline de ingeniería.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectSummary.field_reports.map((report, idx) => {
                const isSelected = selectedReportIds.includes(report.id);
                const isExpanded = !!expandedReports[report.id];

                return (
                  <div
                    key={report.id}
                    className={`card transition-all border ${
                      isSelected
                        ? 'border-accent/60 bg-white shadow-xs ring-1 ring-accent/20'
                        : 'border-border/80 bg-gray-50/70 opacity-75'
                    }`}
                  >
                    {/* Encabezado del Formulario Llenado */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        {/* Checkbox de Selección Activa */}
                        <button
                          type="button"
                          onClick={() => toggleReportSelection(report.id)}
                          className="mt-0.5 text-accent hover:opacity-80 transition-transform active:scale-90 cursor-pointer"
                          title={isSelected ? 'Excluir del entregable' : 'Incluir en el entregable'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-accent" strokeWidth={2.2} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" strokeWidth={1.75} />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-text-primary">
                              Inspección #{(projectSummary?.field_reports?.length || 0) - idx}
                            </h4>

                            <span className="text-[11px] font-mono font-semibold text-text-muted bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-text-muted" />
                              {report.report_date}
                              {report.report_time ? ` (${report.report_time})` : ''}
                            </span>

                            <span className="text-[11px] font-semibold text-text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 flex items-center gap-1">
                              <User className="w-3 h-3 text-accent" />
                              {report.localizador_name}
                            </span>

                            {isSelected ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Incluido en Entregables
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-text-muted bg-gray-200 px-2 py-0.5 rounded">
                                Excluido
                              </span>
                            )}
                          </div>

                          {/* Metadatos técnicos del formulario */}
                          <div className="flex items-center gap-4 text-xs text-text-secondary mt-1.5 flex-wrap">
                            <span>
                              Antena: <strong className="text-text-primary font-mono">{report.antenna_frequency || '400 MHz'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Equipo: <strong className="text-text-primary">{report.gpr_equipment || 'GPR ProEx'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Terreno: <strong className="text-text-primary">{report.terrain_conditions || 'Asfalto'}</strong>
                            </span>
                          </div>

                          {/* Píldoras de Archivos Adjuntos (Datos Crudos, GPS, Fotos) */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-[11px] text-text-muted font-semibold flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5 text-accent" />
                              Adjuntos:
                            </span>
                            {(report.files_count && report.files_count > 0) ? (
                              <>
                                {(report.raw_gpr_count || 0) > 0 && (
                                  <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1" title="Radargramas crudos procesables (Paso 2 DSP)">
                                    <Cpu className="w-3 h-3 text-sky-600" />
                                    {report.raw_gpr_count} {report.raw_gpr_count === 1 ? 'Dato Crudo GPR' : 'Datos Crudos GPR'}
                                  </span>
                                )}
                                {(report.gps_count || 0) > 0 && (
                                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1" title="Archivos de coordenadas y trazas GPS">
                                    <Compass className="w-3 h-3 text-indigo-600" />
                                    {report.gps_count} {report.gps_count === 1 ? 'Archivo GPS' : 'Archivos GPS'}
                                  </span>
                                )}
                                {(report.photos_count || 0) > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1" title="Fotografías de campo">
                                    <Camera className="w-3 h-3 text-emerald-600" />
                                    {report.photos_count} {report.photos_count === 1 ? 'Foto' : 'Fotos'}
                                  </span>
                                )}
                                {((report.files_count || 0) - (report.raw_gpr_count || 0) - (report.gps_count || 0) - (report.photos_count || 0)) > 0 && (
                                  <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                    +{(report.files_count || 0) - (report.raw_gpr_count || 0) - (report.gps_count || 0) - (report.photos_count || 0)} otros
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                Sin archivos adjuntos
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Resumen Métrico del Formulario y Botón Expandir */}
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-accent">
                            {report.total_ml} ML · {report.total_m2} M²
                          </div>
                          <div className="text-[11px] text-text-muted font-mono">
                            {report.utilities_count} interferencias · Prof: {report.global_max_depth || 0}m
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpandReport(report.id)}
                          className="btn-ghost p-1.5 text-text-secondary hover:text-text-primary rounded-lg border border-border cursor-pointer"
                          title="Ver tramos, interferencias y adjuntos de esta inspección"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-accent" strokeWidth={2} />
                          ) : (
                            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detalle Desplegable: Tramos, Interferencias y Adjuntos de esta inspección específica */}
                    {isExpanded && (
                      <div className="border-t border-border/70 p-4 bg-gray-50/50 space-y-4 text-xs animate-fade-in">
                        {/* Sub-bloque 1: Tramos del formulario */}
                        <div>
                          <h5 className="font-bold text-text-primary text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-accent" />
                            Tramos y Sectores Explorados en esta Fecha
                          </h5>
                          {(!report.operational_summary || report.operational_summary.length === 0) ? (
                            <p className="text-text-muted italic text-[11px]">Sin tramos detallados en este formulario.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-border bg-white">
                              <table className="min-w-full text-[11px]">
                                <thead className="bg-gray-100 text-text-muted font-bold text-left">
                                  <tr>
                                    <th className="py-1.5 px-3">Sector</th>
                                    <th className="py-1.5 px-3">Longitud</th>
                                    <th className="py-1.5 px-3">Área</th>
                                    <th className="py-1.5 px-3">Prof. Máx</th>
                                    <th className="py-1.5 px-3">Observaciones</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {report.operational_summary.map((t, tIdx) => (
                                    <tr key={tIdx} className="hover:bg-gray-50">
                                      <td className="py-1.5 px-3 font-semibold text-text-primary">{t.sector || `Tramo ${tIdx + 1}`}</td>
                                      <td className="py-1.5 px-3 font-mono font-bold text-accent">{t.ml || 0} ML</td>
                                      <td className="py-1.5 px-3 font-mono">{t.m2 || 0} M²</td>
                                      <td className="py-1.5 px-3 font-mono">{t.max_depth_m || 0} m</td>
                                      <td className="py-1.5 px-3 text-text-secondary">{t.observations || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Sub-bloque 2: Interferencias del formulario */}
                        <div>
                          <h5 className="font-bold text-text-primary text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-accent" />
                            Interferencias Subterráneas Detectadas en esta Fecha
                          </h5>
                          {(!report.detected_utilities || report.detected_utilities.length === 0) ? (
                            <p className="text-text-muted italic text-[11px]">No se reportaron interferencias en esta inspección.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-border bg-white">
                              <table className="min-w-full text-[11px]">
                                <thead className="bg-gray-100 text-text-muted font-bold text-left">
                                  <tr>
                                    <th className="py-1.5 px-3">Tipo de Red</th>
                                    <th className="py-1.5 px-3">Capa Normalizada</th>
                                    <th className="py-1.5 px-3">Diámetro</th>
                                    <th className="py-1.5 px-3">Profundidad Est.</th>
                                    <th className="py-1.5 px-3">Confianza</th>
                                    <th className="py-1.5 px-3">Descripción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {report.detected_utilities.map((u, uIdx) => {
                                    const layerInfo = getUtilityLayer(u.type || '');
                                    return (
                                      <tr key={uIdx} className="hover:bg-gray-50">
                                        <td className="py-1.5 px-3 font-semibold text-text-primary">{u.type}</td>
                                        <td className="py-1.5 px-3">
                                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                                            {layerInfo.layer}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3 font-mono font-bold text-accent">{u.diameter || 'N/D'}</td>
                                        <td className="py-1.5 px-3 font-mono font-bold text-text-primary">{u.estimated_depth_m || 0} m</td>
                                        <td className="py-1.5 px-3">
                                          <span
                                            className={`badge text-[10px] ${
                                              u.confidence === 'Alta'
                                                ? 'badge-success'
                                                : u.confidence === 'Media'
                                                ? 'badge-warning'
                                                : 'badge-error'
                                            }`}
                                          >
                                            {u.confidence}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3 text-text-secondary">{u.description || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Sub-bloque 3: Archivos Adjuntos de esta inspección */}
                        <div>
                          <h5 className="font-bold text-text-primary text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-accent" />
                            Archivos Adjuntos de esta Inspección ({report.files_count || 0})
                          </h5>
                          {(!report.files || report.files.length === 0) ? (
                            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                Esta inspección <strong>no cuenta con archivos adjuntos cargados</strong> (sin radargramas crudos .dzt/.rd3, sin archivos GPS ni fotografías). Puedes seleccionarla para incluir sus tramos e interferencias en los planos 2D y 3D, pero no aportará datos crudos al informe geofísico DSP.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {report.files.map((file) => (
                                <div
                                  key={file.id}
                                  className="p-2.5 bg-white border border-border rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-accent/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded bg-primary/5 flex items-center justify-center shrink-0 border border-border">
                                      {file.file_type === 'raw_gpr' ? (
                                        <Cpu className="w-3.5 h-3.5 text-sky-600" />
                                      ) : file.file_type === 'gps' ? (
                                        <Compass className="w-3.5 h-3.5 text-indigo-600" />
                                      ) : file.file_type === 'photo' ? (
                                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-accent" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-text-primary text-[11px] truncate" title={file.original_name}>
                                        {file.original_name}
                                      </p>
                                      <span className="text-[10px] text-text-muted capitalize block">
                                        {file.file_type === 'raw_gpr'
                                          ? 'Dato Crudo GPR'
                                          : file.file_type === 'gps'
                                          ? 'Posición GPS'
                                          : file.file_type === 'photo'
                                          ? 'Foto de Campo'
                                          : file.file_type}
                                      </span>
                                    </div>
                                  </div>

                                  {file.url && (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-ghost p-1.5 text-accent hover:text-accent/80 rounded hover:bg-accent/10 shrink-0"
                                      title="Abrir / Descargar archivo"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PIPELINE DE ORQUESTACIÓN EN 5 PASOS ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Alerta informativa de selección activa */}
          {activeMetrics.selected_count < activeMetrics.total_available && (
            <div className="card p-3 bg-amber-50/80 border border-amber-300/80 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Procesando con un subconjunto de <strong>{activeMetrics.selected_count} de {activeMetrics.total_available}</strong> formularios de campo seleccionados ({activeMetrics.total_ml} ML, {activeMetrics.utilities_count} interferencias).
                </span>
              </div>
              <button
                onClick={() => setActiveTab('datos_campo')}
                className="text-amber-800 font-bold underline hover:text-amber-950 shrink-0 cursor-pointer"
              >
                Modificar Selección
              </button>
            </div>
          )}

          {/* Barra de Progreso General */}
          <div className="card p-4 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Estado del Flujo de Automatización (5 Fases Canónicas)
              </span>
              <span className="font-mono text-accent font-bold">{progressPercent}% Completado</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-border">
              <div
                className="bg-accent h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Lista de los 5 Pasos Siempre Visibles */}
          <div className="space-y-3">
            {displaySteps.map((step) => {
              const isExecuting =
                executeStepMutation.isPending &&
                (executeStepMutation.variables?.runAll ||
                  executeStepMutation.variables?.stepKey === step.step_key);
              const isStepPromptExpanded = expandedPromptStep === step.id;

              return (
                <div
                  key={step.id}
                  className={`card p-4 transition-all border bg-white shadow-xs ${
                    step.status === 'completed'
                      ? 'border-emerald-500/50'
                      : step.status === 'running'
                      ? 'border-amber-500 ring-1 ring-amber-400'
                      : 'border-border hover:border-accent/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Información del Paso */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0 border border-primary-700 shadow-xs">
                        {getStepIcon(step.step_key)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-text-primary">{step.step_name}</h4>

                          <span className="font-mono text-[11px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {step.ai_model} · {step.total_tokens.toLocaleString('es-CO')} tok
                          </span>

                          {step.status === 'completed' && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Completado
                            </span>
                          )}
                          {step.status === 'running' && (
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                              <Loader2 className="w-3 h-3 animate-spin text-amber-600" /> Procesando
                            </span>
                          )}
                          {step.status === 'pending' && (
                            <span className="text-[10px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                              <Clock className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-text-secondary mt-1">{step.desc}</p>

                        {step.output_file_name && (
                          <div className="text-[11px] text-accent font-mono font-bold mt-1.5 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                            <span>
                              Entregable Listo: <strong>{step.output_file_name}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {step.output_file_url && (
                        <a
                          href={step.output_file_url}
                          download
                          className="btn-outline px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 text-accent border-accent/40 hover:bg-accent/10 cursor-pointer shadow-xs"
                          title="Descargar Entregable Oficial"
                        >
                          <Download className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Descargar ({step.output_ext.toUpperCase()})</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleExecuteSingleStep(step.step_key)}
                        disabled={isExecuting || executeStepMutation.isPending || selectedReportIds.length === 0}
                        className="btn-primary px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isExecuting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{step.status === 'completed' ? 'Re-ejecutar' : 'Ejecutar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Acordeón para inspeccionar logs y prompts */}
                  <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
                    <button
                      type="button"
                      onClick={() => setExpandedPromptStep(isStepPromptExpanded ? null : step.id)}
                      className="hover:text-text-primary flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {isStepPromptExpanded ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Ocultar Auditoría del Entregable
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3.5 h-3.5" /> Ver Auditoría y Prompt de Ingeniería
                        </>
                      )}
                    </button>

                    <span className="font-mono text-[10px]">
                      {step.status === 'completed' ? (
                        <>
                          Costo Inferencia: <strong className="text-primary-900">{formatCop(step.cost_cop_ai)}</strong> (${step.cost_usd.toFixed(4)} USD)
                        </>
                      ) : (
                        <span className="text-text-muted">
                          Costo Incurrido: <strong className="text-text-secondary">$ 0 COP</strong>{' '}
                          <span className="text-[9px] opacity-80">(Est. ~{formatCop(step.estimated_cost_cop)})</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {isStepPromptExpanded && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-border text-xs space-y-2 animate-fade-in font-mono">
                      <div>
                        <span className="text-text-muted uppercase text-[10px] font-bold block mb-1">
                          Prompt de Ingeniería Inyectado (Datos Filtrados):
                        </span>
                        <pre className="text-[11px] bg-white p-2.5 rounded border border-border overflow-x-auto whitespace-pre-wrap text-text-primary">
                          {step.ai_prompt || 'Prompt en generación...'}
                        </pre>
                      </div>

                      {step.execution_logs && (
                        <div>
                          <span className="text-text-muted uppercase text-[10px] font-bold block mb-1">
                            Trazabilidad de Ejecución:
                          </span>
                          <div className="text-[11px] text-text-secondary bg-white p-2 rounded border border-border">
                            {step.execution_logs}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: ENTREGABLES (VISUALIZACIÓN DE SALIDAS DEL PIPELINE) ── */}
      {activeTab === 'entregables' && (
        <div className="space-y-5 animate-fade-in">
          {/* BANNER PRINCIPAL DE ENTREGABLES */}
          <div className="card p-5 bg-white border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-accent/20 text-primary-900">
                  <FolderArchive className="w-5 h-5 text-accent" strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-bold text-text-primary">
                  Dossier Técnico de Entregables de Ingeniería (CAD / BIM / GPR)
                </h3>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  completedDeliverablesCount === displaySteps.length
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-primary/10 text-primary-900 border-primary/20'
                }`}>
                  {completedDeliverablesCount} de {displaySteps.length} Listos
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Información de salida y archivos generados por el pipeline de orquestación con IA a partir de las inspecciones de campo seleccionadas ({activeMetrics.selected_count} formularios activos).
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {completedDeliverablesCount < displaySteps.length && (
                <button
                  onClick={handleExecuteAllSteps}
                  disabled={executeStepMutation.isPending || createJobMutation.isPending || selectedReportIds.length === 0}
                  className="btn-accent px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Ejecutar los pasos pendientes del pipeline"
                >
                  {executeStepMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-900" />
                  ) : (
                    <Play className="w-4 h-4 text-primary-900 fill-primary-900" />
                  )}
                  <span>Generar Entregables Faltantes</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('pipeline')}
                className="btn-ghost px-3 py-2 text-xs font-semibold rounded-xl border border-border flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                title="Ir a la pestaña de Pipeline de Orquestación"
              >
                <Cpu className="w-3.5 h-3.5 text-accent" />
                <span>Ver Pipeline</span>
              </button>

              <button
                onClick={() => setActiveTab('datos_campo')}
                className="btn-ghost px-3 py-2 text-xs font-semibold rounded-xl border border-border flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                title="Modificar la selección de formularios diligenciados"
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Datos Fuente ({activeMetrics.selected_count})</span>
              </button>
            </div>
          </div>

          {/* MÉTRICAS TÉCNICAS CONSOLIDADAS DEL PAQUETE ENTRADA-SALIDA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Formularios Diligenciados
              </span>
              <span className="font-mono text-lg font-bold text-text-primary mt-0.5 block">
                {activeMetrics.selected_count}{' '}
                <span className="text-xs text-text-muted font-sans font-normal">/ {activeMetrics.total_available} seleccionados</span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Metraje Total Trazado
              </span>
              <span className="font-mono text-lg font-bold text-accent mt-0.5 block">
                {activeMetrics.total_ml.toLocaleString('es-CO')}{' '}
                <span className="text-xs text-text-secondary font-sans font-normal">ML</span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Área Explorada
              </span>
              <span className="font-mono text-lg font-bold text-text-primary mt-0.5 block">
                {activeMetrics.total_m2.toLocaleString('es-CO')}{' '}
                <span className="text-xs text-text-secondary font-sans font-normal">M²</span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Redes e Interferencias
              </span>
              <span className="font-mono text-lg font-bold text-accent mt-0.5 block">
                {activeMetrics.utilities_count}{' '}
                <span className="text-xs text-text-secondary font-sans font-normal">detectadas</span>
              </span>
            </div>
          </div>

          {/* LISTA DETALLADA DE LOS 5 ENTREGABLES TÉCNICOS */}
          <div className="space-y-4">
            {displaySteps.map((step) => {
              const meta = CANONICAL_DELIVERABLES_META[step.step_key];
              const isExecuting =
                executeStepMutation.isPending &&
                (executeStepMutation.variables?.runAll ||
                  executeStepMutation.variables?.stepKey === step.step_key);
              const isCompleted = step.status === 'completed';

              return (
                <div
                  key={`deliv_${step.step_key}`}
                  className={`card transition-all border bg-white shadow-xs overflow-hidden ${
                    isCompleted
                      ? 'border-emerald-500/50 hover:shadow-sm'
                      : isExecuting
                      ? 'border-amber-500 ring-1 ring-amber-400'
                      : 'border-border hover:border-accent/40'
                  }`}
                >
                  {/* Encabezado de la Tarjeta del Entregable */}
                  <div className="p-4 border-b border-border/70 bg-gradient-to-r from-gray-50/80 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0 border border-primary-700 shadow-xs">
                        {getStepIcon(step.step_key)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-accent">
                            Entregable #{meta.stepNum}
                          </span>
                          <span className="text-text-muted">·</span>
                          <h4 className="text-sm font-bold text-text-primary">
                            {meta.shortTitle}
                          </h4>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${meta.formatBadgeStyle}`}>
                            {meta.formatBadge}
                          </span>
                          {isCompleted ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Listo para Descarga
                            </span>
                          ) : isExecuting ? (
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                              <Loader2 className="w-3 h-3 animate-spin text-amber-600" /> Generando con IA...
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-text-muted bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                              <Clock className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {meta.title}
                        </p>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isCompleted && step.output_file_url ? (
                        <a
                          href={step.output_file_url}
                          download
                          className="btn-accent px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer text-primary-900"
                          title={`Descargar ${step.output_file_name || meta.shortTitle}`}
                        >
                          <Download className="w-4 h-4 text-primary-900" strokeWidth={2} />
                          <span>Descargar ({step.output_ext.toUpperCase()})</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => handleExecuteSingleStep(step.step_key)}
                          disabled={isExecuting || executeStepMutation.isPending || selectedReportIds.length === 0}
                          className="btn-primary px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {isExecuting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                          <span>Generar Entregable</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo: Información de Salida del Procesamiento de IA */}
                  <div className="p-4 space-y-3.5">
                    {/* BLOQUE DESTACADO: INFORMACIÓN DE SALIDA ARROJADA POR EL PROCESAMIENTO */}
                    {isCompleted ? (
                      <div className="p-3.5 bg-accent/10 border border-accent/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                            Información de Salida del Procesamiento (Gemini 1.5 Pro)
                          </span>
                          <span className="text-[10px] font-mono font-bold text-accent bg-white px-2 py-0.5 rounded border border-accent/20">
                            {step.ai_model} · {step.total_tokens.toLocaleString('es-CO')} tokens
                          </span>
                        </div>
                        <p className="text-xs text-text-primary leading-relaxed font-medium">
                          {step.ai_response || meta.expectedOutput}
                        </p>
                        {step.execution_logs && (
                          <div className="pt-2 border-t border-accent/20 text-[11px] font-mono text-text-secondary flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{step.execution_logs}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-gray-50 border border-border/80 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                            Salida Esperada tras Procesamiento en Pipeline
                          </span>
                          <span className="text-[10px] font-mono text-text-muted bg-white px-2 py-0.5 rounded border border-border">
                            Listo para Procesar ({activeMetrics.selected_count} reportes)
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {meta.expectedOutput}
                        </p>
                      </div>
                    )}

                    {/* FICHA TÉCNICA Y METADATOS DEL ENTREGABLE */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                      <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                        <span className="text-[10px] uppercase font-bold text-text-muted block">
                          Archivo de Salida
                        </span>
                        <span className="font-mono text-xs font-bold text-text-primary truncate block mt-0.5" title={step.output_file_name || meta.defaultFileName(projectCleanName)}>
                          {step.output_file_name || meta.defaultFileName(projectCleanName)}
                        </span>
                      </div>

                      <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                        <span className="text-[10px] uppercase font-bold text-text-muted block">
                          Software Compatible
                        </span>
                        <span className="text-xs font-semibold text-text-secondary block mt-0.5 truncate" title={meta.software}>
                          {meta.software}
                        </span>
                      </div>

                      <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                        <span className="text-[10px] uppercase font-bold text-text-muted block">
                          Norma / Formato
                        </span>
                        <span className="text-xs font-semibold text-text-secondary block mt-0.5 truncate" title={meta.standard}>
                          {meta.standard}
                        </span>
                      </div>

                      <div className="p-2.5 bg-surface rounded-lg border border-border/80">
                        <span className="text-[10px] uppercase font-bold text-text-muted block">
                          Fecha de Generación
                        </span>
                        <span className="font-mono text-xs text-text-secondary block mt-0.5">
                          {formatDateTime(step.completed_at)}
                        </span>
                      </div>
                    </div>

                    {/* COMPONENTES TÉCNICOS CLAVE DEL ARCHIVO */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      {meta.keyOutputs.map((k, kIdx) => (
                        <div key={kIdx} className="p-2 rounded-lg bg-gray-50/80 border border-border/60">
                          <span className="font-bold text-text-primary block text-[11px]">{k.label}:</span>
                          <span className="text-text-secondary text-[11px] block">{k.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 4: COSTOS DE PROCESAMIENTO API IA ── */}
      {activeTab === 'costos_api' && (
        <div className="card p-5 bg-white border border-border shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Coins className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Liquidación de Costos de Cómputo e Inferencia de IA (Gemini 1.5 Pro)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Contabilización transparente de tokens de entrada y salida consumidos en los pasos ejecutados del proyecto
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-text-muted block">Gasto Real Acumulado ({completedStepsCount}/5 pasos)</span>
              <span className="font-mono text-xl font-bold text-accent">
                {formatCop(grandTotalCostCopAi)}
              </span>
              <span className="text-[10px] text-text-muted font-mono block">
                (${grandTotalCostUsd.toFixed(4)} USD)
              </span>
              {completedStepsCount < displaySteps.length && (
                <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                  Proyección total (5 pasos): ~{formatCop(projectedTotalCostCop)} (${projectedTotalCostUsd.toFixed(4)} USD)
                </span>
              )}
            </div>
          </div>

          {/* Tabla de Desglose por Paso */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-base min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] font-bold text-text-muted uppercase">Paso / Entregable</th>
                    <th className="py-2.5 px-4 text-left text-[11px] font-bold text-text-muted uppercase">Modelo</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold text-text-muted uppercase">Tokens In</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold text-text-muted uppercase">Tokens Out</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold text-text-muted uppercase">Total Tokens</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold text-text-muted uppercase">Costo USD</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold text-text-muted uppercase">Costo COP</th>
                    <th className="py-2.5 px-4 text-center text-[11px] font-bold text-text-muted uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displaySteps.map((step) => {
                    const isCompleted = step.status === 'completed';
                    return (
                      <tr key={step.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 font-semibold text-text-primary">
                          <div className="flex items-center gap-2">
                            {getStepIcon(step.step_key)}
                            <span>{step.step_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-text-muted">{step.ai_model}</td>
                        <td className="font-mono text-right py-3 px-4 text-text-secondary">
                          {isCompleted ? (
                            step.input_tokens.toLocaleString('es-CO')
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="font-mono text-right py-3 px-4 text-text-secondary">
                          {isCompleted ? (
                            step.output_tokens.toLocaleString('es-CO')
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="font-mono text-right py-3 px-4 font-bold text-text-primary">
                          {isCompleted ? (
                            step.total_tokens.toLocaleString('es-CO')
                          ) : (
                            <span className="text-text-muted font-normal text-[11px]">
                              — <span className="text-[10px] opacity-75">(Est. ~{step.estimated_total_tokens.toLocaleString('es-CO')})</span>
                            </span>
                          )}
                        </td>
                        <td className="font-mono text-right py-3 px-4 text-text-secondary">
                          {isCompleted ? (
                            `$${step.cost_usd.toFixed(4)}`
                          ) : (
                            <span className="text-text-muted">$0.0000</span>
                          )}
                        </td>
                        <td className="font-mono text-right py-3 px-4 font-bold text-primary-900">
                          {isCompleted ? (
                            formatCop(step.cost_cop_ai)
                          ) : (
                            <span className="text-text-muted font-normal text-[11px]">
                              $ 0 COP <span className="text-[10px] opacity-75">(Est. ~{formatCop(step.estimated_cost_cop)})</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`badge text-[10px] ${
                              step.status === 'completed'
                                ? 'badge-success'
                                : step.status === 'running'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {step.status === 'completed' ? 'Completado' : step.status === 'running' ? 'En Proceso' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila Totalizadora */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-border">
                    <td colSpan={2} className="py-3.5 px-4 text-text-primary uppercase text-[11px]">
                      Totales Consolidados Consumidos ({completedStepsCount} de 5 Pasos)
                    </td>
                    <td className="font-mono text-right py-3.5 px-4 text-text-secondary">{totalInputTokens.toLocaleString('es-CO')}</td>
                    <td className="font-mono text-right py-3.5 px-4 text-text-secondary">{totalOutputTokens.toLocaleString('es-CO')}</td>
                    <td className="font-mono text-right py-3.5 px-4 text-text-primary">{grandTotalTokens.toLocaleString('es-CO')}</td>
                    <td className="font-mono text-right text-text-primary py-3.5 px-4">${grandTotalCostUsd.toFixed(4)} USD</td>
                    <td className="font-mono text-right text-accent text-base py-3.5 px-4">{formatCop(grandTotalCostCopAi)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tarjeta Informativa de Gobernanza Cloud (PROCIMEC INGENIERÍA S.A.S.) */}
          <div className="card p-4.5 bg-gray-50 border border-border text-xs text-text-secondary space-y-2">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <Info className="w-4 h-4 text-accent shrink-0" strokeWidth={1.75} />
              <span>Gobernanza Financiera de Tokens y Cómputo (PROCIMEC INGENIERÍA S.A.S.)</span>
            </div>
            <p className="leading-relaxed">
              Las tarifas de cómputo se derivan directamente de la lista oficial de precios de <strong>Google Cloud Vertex AI</strong> para el modelo <strong>Gemini 1.5 Pro</strong> ($3.50 USD / 1M tokens de entrada y $10.50 USD / 1M tokens de salida). Los prompts estructurados han sido diseñados bajo arquitectura de tokenización comprimida para maximizar la eficiencia y mantener el costo por proyecto en una fracción mínima frente a la delineación y modelado CAD manual tradicional.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
