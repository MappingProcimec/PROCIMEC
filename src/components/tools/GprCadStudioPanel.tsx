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
} from 'lucide-react';
import {
  GprPipelineJob,
  GprPipelineStepKey,
  ProjectGprDataSummary,
} from '@/types/gpr-pipeline';
import { getActiveProjectId, setActiveProjectId } from '@/hooks/useActiveProject';
import { getUtilityLayer } from '@/lib/gpr-cad/generators/dxf-generator';

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
    name: 'Paso 2: Procesamiento de Datos Crudos GPR (.pdf)',
    desc: 'Informe técnico DSP geofísico: Time-Zero, Filtro Dewow, Ganancia SEC exponencial y calibración de RDP.',
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

// Tarifas oficiales de Inferencia Google Gemini 1.5 Pro (USD por millón de tokens)
const GEMINI_INPUT_RATE_USD = 3.50; // $3.50 USD / 1M input
const GEMINI_OUTPUT_RATE_USD = 10.50; // $10.50 USD / 1M output
const USD_TO_COP = 4150; // TRM representativa de referencia

export function GprCadStudioPanel() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Reorganización canónica de pestañas: 1. Reportes y Datos de Campo, 2. Pipeline de Orquestación, 3. Costos API IA
  const [activeTab, setActiveTab] = useState<'datos_campo' | 'pipeline' | 'costos_api'>('datos_campo');
  
  const [expandedPromptStep, setExpandedPromptStep] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Estado para selección granular de reportes de campo (formularios llenados)
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

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

  // 3. Mutación para inicializar o recalcular Job
  const createJobMutation = useMutation({
    mutationFn: async ({ pId, reportIds }: { pId: string; reportIds?: string[] }) => {
      const res = await fetch('/api/tools/gpr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pId, selectedReportIds: reportIds }),
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
        body: JSON.stringify({ jobId, stepKey, runAll, projectId, selectedReportIds: reportIds }),
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
      const inTok = existing?.token_usage?.input_tokens ?? meta.defaultIn;
      const outTok = existing?.token_usage?.output_tokens ?? meta.defaultOut;
      const totalTok = inTok + outTok;
      const costUsd = (inTok / 1_000_000) * GEMINI_INPUT_RATE_USD + (outTok / 1_000_000) * GEMINI_OUTPUT_RATE_USD;
      const costCop = Math.round(costUsd * USD_TO_COP);

      // Si existe URL de descarga y hay reportes seleccionados, asegurar parámetro reportIds
      let downloadUrl = existing?.output_file_url;
      if (downloadUrl && selectedReportIds.length > 0 && !downloadUrl.includes('reportIds=')) {
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
        execution_logs: existing?.execution_logs,
        ai_model: existing?.ai_model_used || 'Gemini 1.5 Pro',
        input_tokens: inTok,
        output_tokens: outTok,
        total_tokens: totalTok,
        cost_usd: costUsd,
        cost_cop_ai: costCop,
      };
    });
  }, [activeJob?.steps, selectedReportIds]);

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

      {/* ── NAVEGACIÓN POR PESTAÑAS (ORDEN CANÓNICO: 1. DATOS CAMPO | 2. PIPELINE | 3. COSTOS API) ── */}
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

        {/* PESTAÑA 2 (CENTRO): Pipeline de Orquestación */}
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

        {/* PESTAÑA 3 (DERECHA): Costos de Procesamiento API IA */}
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
                          title="Ver tramos e interferencias de esta inspección"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-accent" strokeWidth={2} />
                          ) : (
                            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detalle Desplegable: Tramos e Interferencias de esta inspección específica */}
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
                      Costo Inferencia: <strong>{formatCop(step.cost_cop_ai)}</strong> (${step.cost_usd.toFixed(4)} USD)
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

      {/* ── TAB 3: COSTOS DE PROCESAMIENTO API IA ── */}
      {activeTab === 'costos_api' && (
        <div className="card p-5 bg-white border border-border shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Coins className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Liquidación de Costos de Cómputo e Inferencia de IA (Gemini 1.5 Pro)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Contabilización transparente de tokens de entrada y salida consumidos en los 5 pasos del proyecto
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-text-muted block">Gasto Total Acumulado</span>
              <span className="font-mono text-xl font-bold text-accent">
                {formatCop(grandTotalCostCopAi)}
              </span>
              <span className="text-[10px] text-text-muted font-mono block">
                (${grandTotalCostUsd.toFixed(4)} USD)
              </span>
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
                  {displaySteps.map((step) => (
                    <tr key={step.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          {getStepIcon(step.step_key)}
                          <span>{step.step_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted">{step.ai_model}</td>
                      <td className="font-mono text-right py-3 px-4 text-text-secondary">{step.input_tokens.toLocaleString('es-CO')}</td>
                      <td className="font-mono text-right py-3 px-4 text-text-secondary">{step.output_tokens.toLocaleString('es-CO')}</td>
                      <td className="font-mono text-right py-3 px-4 font-bold text-text-primary">{step.total_tokens.toLocaleString('es-CO')}</td>
                      <td className="font-mono text-right py-3 px-4 text-text-secondary">${step.cost_usd.toFixed(4)}</td>
                      <td className="font-mono text-right py-3 px-4 font-bold text-primary-900">{formatCop(step.cost_cop_ai)}</td>
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
                  ))}
                  {/* Fila Totalizadora */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-border">
                    <td colSpan={2} className="py-3.5 px-4 text-text-primary uppercase text-[11px]">
                      Totales Consolidados de Inferencia
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
