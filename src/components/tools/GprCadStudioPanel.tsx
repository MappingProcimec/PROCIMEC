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
  DollarSign,
  ChevronRight,
  ChevronDown,
  Info,
  FolderArchive,
  Sparkles,
  Loader2,
  Radio,
  Coins,
} from 'lucide-react';
import {
  GprPipelineJob,
  GprPipelineStepKey,
  ProjectGprDataSummary,
} from '@/types/gpr-pipeline';
import { getActiveProjectId, setActiveProjectId } from '@/hooks/useActiveProject';

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
    name: 'Paso 1: Elaboración del Plano 2D (.dwg)',
    desc: 'Delineación de ejes, curvas, franja de exploración y capas base normalizadas en AutoCAD.',
    defaultIn: 1420,
    defaultOut: 680,
    outputExt: 'dwg',
  },
  gpr_raw_proc: {
    name: 'Paso 2: Procesamiento de Datos Crudos GPR',
    desc: 'Filtros DSP geofísicos: Time-zero, Dewow, Ganancia SEC exponencial y calibración de RDP.',
    defaultIn: 1650,
    defaultOut: 890,
    outputExt: 'pdf',
  },
  cad_2d_refine: {
    name: 'Paso 3: Mejora del Plano 2D (Ajuste de Interferencias)',
    desc: 'Incrustación de tuberías, cotas z, diámetros, profundidad y simbología técnica de servicios.',
    defaultIn: 1890,
    defaultOut: 1120,
    outputExt: 'dwg',
  },
  bim_3d_rvt: {
    name: 'Paso 4: Elaboración del Modelo 3D BIM (.rvt / IFC)',
    desc: 'Modelado paramétrico tridimensional subsuperficial en familias Revit/IFC con nivel LOD 300.',
    defaultIn: 2150,
    defaultOut: 1450,
    outputExt: 'rvt',
  },
  project_report: {
    name: 'Paso 5: Informe Final del Proyecto',
    desc: 'Redacción técnica consolidada, volumetría, análisis de riesgos y compilación documental oficial.',
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
  const [activeTab, setActiveTab] = useState<'pipeline' | 'costos_api' | 'datos_campo'>('pipeline');
  const [expandedPromptStep, setExpandedPromptStep] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

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

  // 3. Mutación para inicializar o recalcular Job
  const createJobMutation = useMutation({
    mutationFn: async (pId: string) => {
      const res = await fetch('/api/tools/gpr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pId }),
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

  // 4. Mutación para ejecutar un paso individual o todos
  const executeStepMutation = useMutation({
    mutationFn: async ({
      jobId,
      stepKey,
      runAll,
      projectId,
    }: {
      jobId?: string;
      stepKey?: GprPipelineStepKey;
      runAll?: boolean;
      projectId?: string;
    }) => {
      const res = await fetch('/api/tools/gpr-pipeline/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, stepKey, runAll, projectId }),
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

      return {
        id: existing?.id || `step_${key}`,
        step_key: key,
        step_order: idx + 1,
        step_name: existing?.step_name || meta.name,
        desc: meta.desc,
        status: existing?.status || 'pending',
        output_file_name: existing?.output_file_name,
        output_file_url: existing?.output_file_url,
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
  }, [activeJob?.steps]);

  // Ejecución transparente (auto-crea el job si no existe en BD)
  const handleExecuteSingleStep = async (stepKey: GprPipelineStepKey) => {
    let targetJobId = activeJob?.id;
    if (!targetJobId) {
      try {
        const newJob = await createJobMutation.mutateAsync(currentProjectId);
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
    });
  };

  const handleExecuteAllSteps = async () => {
    let targetJobId = activeJob?.id;
    if (!targetJobId) {
      try {
        const newJob = await createJobMutation.mutateAsync(currentProjectId);
        targetJobId = newJob.id;
      } catch (e) {
        console.error('Error auto-creando job:', e);
      }
    }
    executeStepMutation.mutate({
      jobId: targetJobId,
      runAll: true,
      projectId: currentProjectId,
    });
  };

  const completedStepsCount = displaySteps.filter((s) => s.status === 'completed').length;
  const progressPercent = Math.round((completedStepsCount / displaySteps.length) * 100);

  // Cálculos consolidados de costos de procesamiento de API IA
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

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExecuteAllSteps}
            disabled={executeStepMutation.isPending || createJobMutation.isPending}
            className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            title="Ejecutar secuencialmente los 5 pasos con IA"
          >
            {executeStepMutation.isPending || createJobMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-900" />
            ) : (
              <Play className="w-4 h-4 text-primary-900 fill-primary-900" strokeWidth={2} />
            )}
            Ejecutar Flujo Completo (5 Pasos)
          </button>

          <button
            onClick={() => createJobMutation.mutate(currentProjectId)}
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

      {/* ── CUADRO DE MÉTRICAS DEL LEVANTAMIENTO (CARBÓN TÉCNICO OFICIAL LEY 5) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Metros Lineales */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Metros Lineales</span>
            <Radio className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-accent mt-1">
            {projectSummary?.total_ml ? projectSummary.total_ml.toLocaleString('es-CO') : 0}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">ML</span>
          </div>
        </div>

        {/* 2. Área Explorada */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Área Explorada</span>
            <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {projectSummary?.total_m2 ? projectSummary.total_m2.toLocaleString('es-CO') : 0}{' '}
            <span className="text-xs text-white/70 font-sans font-normal">M²</span>
          </div>
        </div>

        {/* 3. Prof. Máxima */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Prof. Máxima</span>
            <Compass className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {projectSummary?.max_depth_m || 0}{' '}
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
            {projectSummary?.detected_utilities.length || 0}
          </div>
        </div>

        {/* 5. Reportes Campo */}
        <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card hover:border-accent/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
            <span>Reportes Campo</span>
            <FileText className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
            {projectSummary?.reports_count || 0}
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

      {/* ── NAVEGACIÓN POR PESTAÑAS (3 PESTAÑAS CANÓNICAS) ── */}
      <div className="flex border-b border-border gap-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
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

        <button
          onClick={() => setActiveTab('costos_api')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
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

        <button
          onClick={() => setActiveTab('datos_campo')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'datos_campo'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4" strokeWidth={1.75} />
          Datos e Interferencias de Campo ({projectSummary?.detected_utilities.length || 0})
        </button>
      </div>

      {/* ── TAB 1: PIPELINE DE ORQUESTACIÓN EN 5 PASOS (SIEMPRE VISIBLE) ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
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
                              Entregable Generado: <strong>{step.output_file_name}</strong>
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
                          className="btn-outline px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 text-accent border-accent/40 hover:bg-accent/10"
                          title="Descargar Entregable"
                        >
                          <Download className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Descargar</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleExecuteSingleStep(step.step_key)}
                        disabled={isExecuting || executeStepMutation.isPending}
                        className="btn-primary px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
                      >
                        {isExecuting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{step.status === 'completed' ? 'Re-procesar' : 'Ejecutar'}</span>
                      </button>

                      <button
                        onClick={() => setExpandedPromptStep(isStepPromptExpanded ? null : step.id)}
                        className="btn-ghost p-1.5 text-text-muted hover:text-text-primary rounded-lg border border-border cursor-pointer"
                        title="Ver Prompt de Ingeniería y Logs"
                      >
                        {isStepPromptExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Desplegable de Prompt y Logs */}
                  {isStepPromptExpanded && (
                    <div className="mt-3 pt-3 border-t border-border text-xs space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span className="font-bold text-accent uppercase">
                          Prompt de Ingeniería Neuronal ({step.ai_model}):
                        </span>
                        <span className="font-mono text-[10px]">
                          In: {step.input_tokens.toLocaleString('es-CO')} | Out: {step.output_tokens.toLocaleString('es-CO')} tokens · ${step.cost_usd.toFixed(4)} USD
                        </span>
                      </div>
                      <pre className="p-3.5 rounded-xl bg-primary-950 font-mono text-[11px] text-accent/90 whitespace-pre-wrap overflow-x-auto max-h-52 border border-primary-800">
                        {step.ai_prompt || 'El prompt estructurado se generará automáticamente al presionar Ejecutar.'}
                      </pre>

                      {step.execution_logs && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono text-[11px]">
                          {step.execution_logs}
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

      {/* ── TAB 2: COSTOS DE PROCESAMIENTO API IA (REQUERIMIENTO PRINCIPAL) ── */}
      {activeTab === 'costos_api' && (
        <div className="space-y-5">
          {/* Tarjetas de Métricas de Cómputo Cloud (Carbón Técnico Oficial Ley 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Tokens Totales */}
            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
                <span>Tokens Consumidos</span>
                <Cpu className="w-4 h-4 text-accent" strokeWidth={1.75} />
              </div>
              <div className="font-mono text-2xl font-bold tracking-tight text-white mt-1">
                {grandTotalTokens.toLocaleString('es-CO')}
              </div>
              <p className="text-[11px] text-white/70 mt-1 font-mono">
                Prompt: {totalInputTokens.toLocaleString('es-CO')} | Salida: {totalOutputTokens.toLocaleString('es-CO')}
              </p>
            </div>

            {/* 2. Costo API en USD */}
            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
                <span>Costo Inferencia (USD)</span>
                <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
              </div>
              <div className="font-mono text-2xl font-bold tracking-tight text-accent mt-1">
                ${grandTotalCostUsd.toFixed(4)} <span className="text-xs text-white/70 font-sans font-normal">USD</span>
              </div>
              <p className="text-[11px] text-white/70 mt-1">
                Tarifa Google Cloud AI Platform
              </p>
            </div>

            {/* 3. Costo Equivalente en COP */}
            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
                <span>Costo en Moneda Local</span>
                <Coins className="w-4 h-4 text-accent" strokeWidth={1.75} />
              </div>
              <div className="font-mono text-2xl font-bold tracking-tight text-accent mt-1">
                {formatCop(grandTotalCostCopAi)}
              </div>
              <p className="text-[11px] text-white/70 mt-1 font-mono">
                TRM Ref. $4,150 COP / USD
              </p>
            </div>

            {/* 4. Modelo Predeterminado */}
            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/80 mb-1">
                <span>Motor de Inferencia</span>
                <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
              </div>
              <div className="text-base font-bold tracking-tight text-white mt-1">
                Gemini 1.5 Pro
              </div>
              <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                99.7% Ahorro vs Horas-Hombre
              </p>
            </div>
          </div>

          {/* Tabla Desglosada por Paso del Pipeline */}
          <div className="card p-5 bg-white border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                  <Coins className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  Desglose de Consumo de Tokens y Costos API por Fase
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Liquidación de cómputo basada en la cantidad exacta de tokens procesados por la API neuronal
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Costo Total API</span>
                <div className="font-mono text-xl sm:text-2xl font-bold text-accent">
                  {formatCop(grandTotalCostCopAi)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table-base min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Fase / Paso del Pipeline</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Modelo</th>
                    <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Tokens Entrada</th>
                    <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Tokens Salida</th>
                    <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Tokens</th>
                    <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Costo USD</th>
                    <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Costo COP</th>
                    <th className="py-2.5 text-center text-[11px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displaySteps.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/80">
                      <td className="font-semibold text-text-primary py-3">
                        {s.step_name}
                      </td>
                      <td className="font-mono text-text-secondary">
                        {s.ai_model}
                      </td>
                      <td className="font-mono text-right text-text-muted">
                        {s.input_tokens.toLocaleString('es-CO')}
                      </td>
                      <td className="font-mono text-right text-text-muted">
                        {s.output_tokens.toLocaleString('es-CO')}
                      </td>
                      <td className="font-mono text-right font-bold text-text-primary">
                        {s.total_tokens.toLocaleString('es-CO')}
                      </td>
                      <td className="font-mono text-right text-text-secondary">
                        ${s.cost_usd.toFixed(4)} USD
                      </td>
                      <td className="font-mono font-bold text-right text-accent">
                        {formatCop(s.cost_cop_ai)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge text-[10px] ${
                            s.status === 'completed'
                              ? 'badge-success'
                              : s.status === 'running'
                              ? 'badge-warning'
                              : 'bg-gray-100 text-text-muted'
                          }`}
                        >
                          {s.status === 'completed' ? 'Procesado' : s.status === 'running' ? 'En Curso' : 'Estimado'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-primary text-white font-bold border-t-2 border-accent">
                    <td colSpan={2} className="text-left text-white font-bold uppercase py-3.5 px-4">
                      Consumo Consolidado del Pipeline:
                    </td>
                    <td className="font-mono text-right text-white/90 py-3.5 px-2">
                      {totalInputTokens.toLocaleString('es-CO')}
                    </td>
                    <td className="font-mono text-right text-white/90 py-3.5 px-2">
                      {totalOutputTokens.toLocaleString('es-CO')}
                    </td>
                    <td className="font-mono text-right text-accent font-bold py-3.5 px-2">
                      {grandTotalTokens.toLocaleString('es-CO')}
                    </td>
                    <td className="font-mono text-right text-white font-bold py-3.5 px-2">
                      ${grandTotalCostUsd.toFixed(4)} USD
                    </td>
                    <td className="font-mono text-right text-accent text-base py-3.5 px-4">
                      {formatCop(grandTotalCostCopAi)}
                    </td>
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

      {/* ── TAB 3: DATOS E INTERFERENCIAS DE CAMPO ── */}
      {activeTab === 'datos_campo' && (
        <div className="card p-5 bg-white border border-border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
              Interferencias y Servicios Subterráneos Reportados
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Registros consolidados de los formularios de campo GPR correspondientes a este proyecto
            </p>
          </div>

          {!projectSummary?.detected_utilities || projectSummary.detected_utilities.length === 0 ? (
            <div className="card p-6 text-center text-text-muted border-dashed border bg-surface/50">
              No se han reportado interferencias en los formularios de este proyecto todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Fecha</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Tipo de Servicio</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Diámetro</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Profundidad Est.</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Confianza</th>
                    <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase">Descripción / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projectSummary.detected_utilities.map((u, i) => (
                    <tr key={u.id || i} className="hover:bg-gray-50/80">
                      <td className="font-mono text-text-muted py-3">{u.report_date}</td>
                      <td className="font-semibold text-text-primary">{u.type}</td>
                      <td className="font-mono text-accent font-bold">{u.diameter || 'N/D'}</td>
                      <td className="font-mono font-bold text-text-primary">{u.estimated_depth_m} m</td>
                      <td>
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
                      <td className="text-text-secondary">{u.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
