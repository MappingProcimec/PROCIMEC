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
} from 'lucide-react';
import {
  GprPipelineJob,
  GprPipelineStep,
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

export function GprCadStudioPanel() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'costos' | 'datos_campo' | 'plantillas'>('pipeline');
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
  const steps: GprPipelineStep[] = activeJob?.steps || [];

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
      setStatusMessage('Pipeline inicializado exitosamente.');
      queryClient.invalidateQueries({ queryKey: ['gpr-pipeline'] });
      setTimeout(() => setStatusMessage(''), 4000);
    },
    onError: (err: Error) => {
      alert(`Error al inicializar: ${err.message}`);
    },
  });

  // 4. Mutación para ejecutar un paso individual o todos
  const executeStepMutation = useMutation({
    mutationFn: async ({ jobId, stepKey, runAll }: { jobId: string; stepKey?: GprPipelineStepKey; runAll?: boolean }) => {
      const res = await fetch('/api/tools/gpr-pipeline/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, stepKey, runAll }),
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

  const handleExecuteSingleStep = (stepKey: GprPipelineStepKey) => {
    if (!activeJob?.id) {
      alert('Debes inicializar el trabajo del proyecto antes de ejecutar.');
      return;
    }
    executeStepMutation.mutate({ jobId: activeJob.id, stepKey, runAll: false });
  };

  const handleExecuteAllSteps = () => {
    if (!activeJob?.id) {
      alert('Debes inicializar el trabajo del proyecto antes de ejecutar.');
      return;
    }
    if (confirm('¿Deseas ejecutar el flujo completo secuencial de los 5 pasos con Inteligencia Artificial?')) {
      executeStepMutation.mutate({ jobId: activeJob.id, runAll: true });
    }
  };

  const completedStepsCount = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = steps.length > 0 ? Math.round((completedStepsCount / steps.length) * 100) : 0;

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
              setActiveProjectId(newId); // Sincroniza bidireccionalmente con Mi Panel y la app
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
          {!activeJob ? (
            <button
              onClick={() => createJobMutation.mutate(currentProjectId)}
              disabled={createJobMutation.isPending || !currentProjectId}
              className="btn-accent px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              {createJobMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-900" />
              ) : (
                <Cpu className="w-4 h-4 text-primary-900" strokeWidth={2} />
              )}
              Inicializar Pipeline y Cuantificar APU
            </button>
          ) : (
            <button
              onClick={handleExecuteAllSteps}
              disabled={executeStepMutation.isPending}
              className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              {executeStepMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-900" />
              ) : (
                <Play className="w-4 h-4 text-primary-900 fill-primary-900" strokeWidth={2} />
              )}
              Ejecutar Flujo Completo (5 Pasos)
            </button>
          )}

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

      {/* ── NAVEGACIÓN POR PESTAÑAS ── */}
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
          {steps.length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-primary/10 text-primary-900 rounded-full font-mono font-bold">
              {completedStepsCount}/{steps.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('costos')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'costos'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <DollarSign className="w-4 h-4" strokeWidth={1.75} />
          Cuantificación de Costos APU
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

        <button
          onClick={() => setActiveTab('plantillas')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'plantillas'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FolderArchive className="w-4 h-4" strokeWidth={1.75} />
          Plantillas Maestras (.dwg / .rvt / .docx)
        </button>
      </div>

      {/* ── TAB 1: PIPELINE DE ORQUESTACIÓN EN 5 PASOS ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Barra de Progreso */}
          <div className="card p-4 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Estado del Flujo de Automatización
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

          {!activeJob ? (
            <div className="card p-8 text-center bg-white border-dashed border-2 border-border space-y-3">
              <Cpu className="w-10 h-10 text-accent/80 mx-auto" strokeWidth={1.5} />
              <h3 className="text-base font-bold text-text-primary">No hay un trabajo activo para este proyecto</h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Haz clic en <strong>&quot;Inicializar Pipeline y Cuantificar APU&quot;</strong> para consolidar los reportes de campo y habilitar la orquestación de los 5 pasos.
              </p>
              <button
                onClick={() => createJobMutation.mutate(currentProjectId)}
                disabled={createJobMutation.isPending}
                className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {createJobMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-primary-900" /> : <Play className="w-4 h-4 text-primary-900 fill-primary-900" />}
                Inicializar Trabajo Ahora
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => {
                const isExecuting = executeStepMutation.isPending && executeStepMutation.variables?.stepKey === step.step_key;
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
                            <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                              {formatCop(step.cost_cop)}
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

                          <p className="text-xs text-text-secondary mt-1">
                            {step.step_key === 'cad_2d' && 'Delineación de ejes, curvas y capas base sobre plantilla DWG.'}
                            {step.step_key === 'gpr_raw_proc' && 'Filtros DSP: Time-zero, Dewow, Ganancia SEC y ajuste de RDP.'}
                            {step.step_key === 'cad_2d_refine' && 'Incrustación de tuberías, cotas z, diámetros y simbología técnica.'}
                            {step.step_key === 'bim_3d_rvt' && 'Modelado tridimensional de redes y sólidos en plantilla Revit/IFC.'}
                            {step.step_key === 'project_report' && 'Redacción técnica consolidada y compilación documental oficial.'}
                          </p>

                          {step.output_file_name && (
                            <div className="text-[11px] text-accent font-mono font-bold mt-1.5 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                              <span>Entregable: <strong>{step.output_file_name}</strong></span>
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
                          <span className="font-bold text-accent uppercase">Prompt de Ingeniería Asignado (Claude/Gemini):</span>
                          {step.token_usage && (
                            <span className="font-mono text-[10px]">
                              In: {step.token_usage.input_tokens} | Out: {step.token_usage.output_tokens} tokens
                            </span>
                          )}
                        </div>
                        <pre className="p-3.5 rounded-xl bg-primary-950 font-mono text-[11px] text-accent/90 whitespace-pre-wrap overflow-x-auto max-h-52 border border-primary-800">
                          {step.ai_prompt || 'El prompt se generará automáticamente al presionar Ejecutar.'}
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
          )}
        </div>
      )}

      {/* ── TAB 2: CUANTIFICACIÓN FINANCIERA APU POR ACTIVIDAD ── */}
      {activeTab === 'costos' && (
        <div className="card p-5 bg-white border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Cuadro Tarifario y Análisis de Precios Unitarios (APU)
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Estructura de costos estimada por cada etapa del pipeline para facturación e imputación técnica
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Costo Total del Flujo</span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-accent">
                {formatCop(activeJob?.total_cost_cop)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-base min-w-full text-xs">
              <thead>
                <tr>
                  <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Fase / Actividad</th>
                  <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Unidad Base</th>
                  <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Cantidad Ejecutada</th>
                  <th className="py-2.5 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Tarifa Unitaria (COP)</th>
                  <th className="py-2.5 text-right text-[11px] font-bold text-text-muted uppercase tracking-wider">Subtotal Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="font-semibold text-text-primary py-3">1. Elaboración del Plano 2D (.dwg)</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono text-text-secondary">{formatCop(activeJob?.cost_rates.cad_2d_rate_per_ml ?? 2500)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.cad_2d_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-text-primary py-3">2. Procesamiento de Datos Crudos GPR</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono text-text-secondary">{formatCop(activeJob?.cost_rates.gpr_proc_rate_per_ml ?? 3000)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.gpr_proc_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-text-primary py-3">3. Mejora y Ajuste de Interferencias en Plano 2D</td>
                  <td className="font-mono text-text-muted">Interferencias</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.detected_utilities.length || 0}</td>
                  <td className="font-mono text-text-secondary">{formatCop(activeJob?.cost_rates.cad_refine_rate_per_utility ?? 35000)} / red</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.cad_refine_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-text-primary py-3">4. Elaboración del Modelo 3D BIM (.rvt / IFC)</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono text-text-secondary">{formatCop(activeJob?.cost_rates.bim_3d_rate_per_ml ?? 4500)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.bim_3d_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-text-primary py-3">5. Informe Final del Proyecto y Resumen Ejecutivo</td>
                  <td className="font-mono text-text-muted">Global / Informe</td>
                  <td className="font-mono font-bold text-text-primary">1</td>
                  <td className="font-mono text-text-secondary">{formatCop(activeJob?.cost_rates.report_fixed_rate ?? 350000)}</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.report_cost)}
                  </td>
                </tr>

                <tr className="bg-primary text-white font-bold border-t-2 border-accent">
                  <td colSpan={4} className="text-right text-white font-bold uppercase py-3.5 px-4">
                    Gran Total Cuantificado APU:
                  </td>
                  <td className="font-mono text-right text-accent text-base py-3.5 px-4">
                    {formatCop(activeJob?.total_cost_cop)}
                  </td>
                </tr>
              </tbody>
            </table>
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

          {(!projectSummary?.detected_utilities || projectSummary.detected_utilities.length === 0) ? (
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

      {/* ── TAB 4: PLANTILLAS MAESTRAS (.DWG / .RVT / .DOCX) ── */}
      {activeTab === 'plantillas' && (
        <div className="card p-5 bg-white border border-border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-accent" strokeWidth={1.75} />
              Plantillas Maestras de Ingeniería (PROCIMEC INGENIERÍA S.A.S.)
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Archivos base sobre los cuales los agentes de IA ensamblan los vectores, tuberías y textos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FileCode className="w-4 h-4 text-accent" />
                Plantilla Plano 2D (.dwg / .dxf)
              </div>
              <p className="text-[11px] text-white/80 leading-relaxed">
                Contiene rótulo corporativo, tipos de línea de servicios (Gas, Acueducto, Energía), grosores y capas normalizadas.
              </p>
              <div className="font-mono text-[10px] text-accent bg-black/30 p-2.5 rounded-xl border border-accent/20">
                Ubicación: <code>templates/cad/plantilla_2d.dwg</code>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Boxes className="w-4 h-4 text-accent" />
                Plantilla Modelo 3D (.rvt / IFC)
              </div>
              <p className="text-[11px] text-white/80 leading-relaxed">
                Familias de tuberías circulares, canalizaciones eléctricas y cámaras de inspección con nivel de desarrollo LOD 300.
              </p>
              <div className="font-mono text-[10px] text-accent bg-black/30 p-2.5 rounded-xl border border-accent/20">
                Ubicación: <code>templates/bim/plantilla_3d.rvt</code>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-primary text-white border border-primary-700/60 shadow-card space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FileText className="w-4 h-4 text-accent" />
                Plantilla Informe Word (.docx)
              </div>
              <p className="text-[11px] text-white/80 leading-relaxed">
                Documento membretado con estilos tipográficos oficiales, tablas de metraje y marcadores de posición <code>{'{{placeholders}}'}</code>.
              </p>
              <div className="font-mono text-[10px] text-accent bg-black/30 p-2.5 rounded-xl border border-accent/20">
                Ubicación: <code>templates/reports/plantilla_informe.docx</code>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-2xl border border-border text-xs text-text-secondary flex items-start gap-2.5">
            <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>
              <strong>Entrega de Plantillas:</strong> Puedes colocar tus archivos directamente en la carpeta <code>templates/</code> del repositorio local o cargarlos a través de la interfaz. En la Fase 3 se integrará el motor de inyección directa de entidades.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
