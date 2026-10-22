'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  Layers,
  Play,
  RotateCw,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  FileText,
  Boxes,
  Compass,
  DollarSign,
  ChevronRight,
  ChevronDown,
  Info,
  FolderArchive,
  Search,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  GprPipelineJob,
  GprPipelineStep,
  GprPipelineStepKey,
  ProjectGprDataSummary,
} from '@/types/gpr-pipeline';

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

  // 1. Consultar información del proyecto y pipeline
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gpr-pipeline', selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId
        ? `/api/tools/gpr-pipeline?projectId=${selectedProjectId}`
        : '/api/tools/gpr-pipeline';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar datos del pipeline');
      return json.data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const projects: ProjectOption[] = data?.projects || [];
  const currentProjectId = selectedProjectId || data?.targetProjectId || (projects[0]?.id ?? '');
  const projectSummary: ProjectGprDataSummary | null = data?.projectSummary || null;
  const activeJob: GprPipelineJob | null = data?.activeJob || null;
  const steps: GprPipelineStep[] = activeJob?.steps || [];

  // 2. Mutación para inicializar o recalcular Job
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

  // 3. Mutación para ejecutar un paso individual o todos
  const executeStepMutation = useMutation({
    mutationFn: async ({ jobId, stepKey, runAll }: { jobId: string; stepKey?: GprPipelineStepKey; runAll?: boolean }) => {
      const res = await fetch('/api/tools/gpr-pipeline/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, stepKey, runAll }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al ejecutar paso');
      return json;
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
      <div className="card p-5 bg-surface-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 max-w-xl">
          <label className="label text-xs uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5 mb-1.5">
            <FolderArchive className="w-4 h-4 text-accent" strokeWidth={1.75} />
            Proyecto Imputable de Exploración
          </label>
          <select
            className="select w-full font-medium"
            value={currentProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
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
              className="btn-accent px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95"
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
              className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-transform active:scale-95"
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
            className="btn-ghost p-2.5 text-text-muted hover:text-white rounded-xl border border-border"
            title="Recargar datos"
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

      {/* ── CUADRO DE MÉTRICAS DEL LEVANTAMIENTO (PROVENIENTES DE FIELD_REPORTS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Metros Lineales</span>
          <div className="font-mono text-xl font-bold text-accent mt-1">
            {projectSummary?.total_ml || 0} <span className="text-xs text-text-muted">ML</span>
          </div>
        </div>

        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Área Explorada</span>
          <div className="font-mono text-xl font-bold text-white mt-1">
            {projectSummary?.total_m2 || 0} <span className="text-xs text-text-muted">M²</span>
          </div>
        </div>

        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Prof. Máxima</span>
          <div className="font-mono text-xl font-bold text-white mt-1">
            {projectSummary?.max_depth_m || 0} <span className="text-xs text-text-muted">m</span>
          </div>
        </div>

        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Interferencias</span>
          <div className="font-mono text-xl font-bold text-amber-400 mt-1">
            {projectSummary?.detected_utilities.length || 0}
          </div>
        </div>

        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Reportes Campo</span>
          <div className="font-mono text-xl font-bold text-white mt-1">
            {projectSummary?.reports_count || 0}
          </div>
        </div>

        <div className="card p-3.5 bg-primary-900/60 border border-border">
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Archivos Crudos</span>
          <div className="font-mono text-xl font-bold text-white mt-1">
            {(projectSummary?.raw_gpr_files_count || 0) + (projectSummary?.gps_files_count || 0)}
          </div>
        </div>
      </div>

      {/* ── NAVEGACIÓN POR PESTAÑAS ── */}
      <div className="flex border-b border-border gap-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" strokeWidth={1.75} />
          Pipeline de Orquestación (5 Pasos)
          {steps.length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full font-mono">
              {completedStepsCount}/{steps.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('costos')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'costos'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" strokeWidth={1.75} />
          Cuantificación de Costos APU
        </button>

        <button
          onClick={() => setActiveTab('datos_campo')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'datos_campo'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" strokeWidth={1.75} />
          Datos e Interferencias de Campo ({projectSummary?.detected_utilities.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('plantillas')}
          className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'plantillas'
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-text-muted hover:text-white'
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
          <div className="card p-4 bg-surface-card border border-border">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Estado del Flujo de Automatización
              </span>
              <span className="font-mono text-accent font-bold">{progressPercent}% Completado</span>
            </div>
            <div className="w-full bg-primary-950 rounded-full h-2.5 overflow-hidden border border-border">
              <div
                className="bg-accent h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {!activeJob ? (
            <div className="card p-8 text-center bg-surface-card border-dashed border-2 border-border space-y-3">
              <Cpu className="w-10 h-10 text-accent/60 mx-auto" strokeWidth={1.5} />
              <h3 className="text-base font-bold text-white">No hay un trabajo activo para este proyecto</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                Haz clic en <strong>"Inicializar Pipeline y Cuantificar APU"</strong> para consolidar los reportes de campo y habilitar la orquestación de los 5 pasos.
              </p>
              <button
                onClick={() => createJobMutation.mutate(currentProjectId)}
                disabled={createJobMutation.isPending}
                className="btn-accent px-5 py-2.5 text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs"
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
                    className={`card p-4 transition-all border ${
                      step.status === 'completed'
                        ? 'border-emerald-500/40 bg-surface-card'
                        : step.status === 'running'
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-border bg-surface-card hover:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Información del Paso */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-900 flex items-center justify-center shrink-0 border border-border">
                          {getStepIcon(step.step_key)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white">{step.step_name}</h4>
                            <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                              {formatCop(step.cost_cop)}
                            </span>

                            {step.status === 'completed' && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completado
                              </span>
                            )}
                            {step.status === 'running' && (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-500/20">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> Procesando
                              </span>
                            )}
                            {step.status === 'pending' && (
                              <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pendiente
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-text-muted mt-1">
                            {step.step_key === 'cad_2d' && 'Delineación de ejes, curvas y capas base sobre plantilla DWG.'}
                            {step.step_key === 'gpr_raw_proc' && 'Filtros DSP: Time-zero, Dewow, Ganancia SEC y ajuste de RDP.'}
                            {step.step_key === 'cad_2d_refine' && 'Incrustación de tuberías, cotas z, diámetros y simbología técnica.'}
                            {step.step_key === 'bim_3d_rvt' && 'Modelado tridimensional de redes y sólidos en plantilla Revit/IFC.'}
                            {step.step_key === 'project_report' && 'Redacción técnica consolidada y compilación documental oficial.'}
                          </p>

                          {step.output_file_name && (
                            <div className="text-[11px] text-accent font-mono mt-1.5 flex items-center gap-1.5">
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
                          className="btn-primary px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
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
                          className="btn-ghost p-1.5 text-text-muted hover:text-white rounded-lg border border-border"
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
                      <div className="mt-3 pt-3 border-t border-border/60 text-xs space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span className="font-bold text-accent uppercase">Prompt de Ingeniería Asignado (Claude/Gemini):</span>
                          {step.token_usage && (
                            <span className="font-mono text-[10px]">
                              In: {step.token_usage.input_tokens} | Out: {step.token_usage.output_tokens} tokens
                            </span>
                          )}
                        </div>
                        <pre className="p-3 rounded-lg bg-primary-950 font-mono text-[11px] text-text-primary whitespace-pre-wrap overflow-x-auto max-h-48 border border-border/80">
                          {step.ai_prompt || 'El prompt se generará automáticamente al presionar Ejecutar.'}
                        </pre>

                        {step.execution_logs && (
                          <div className="p-2 rounded bg-white/5 font-mono text-[11px] text-emerald-400">
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
        <div className="card p-5 bg-surface-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Cuadro Tarifario y Análisis de Precios Unitarios (APU)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Estructura de costos estimada por cada etapa del pipeline para facturación e imputación técnica
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Costo Total del Flujo</span>
              <div className="font-mono text-xl font-bold text-accent">
                {formatCop(activeJob?.total_cost_cop)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-base min-w-full text-xs">
              <thead>
                <tr>
                  <th>Fase / Actividad</th>
                  <th>Unidad Base</th>
                  <th>Cantidad Ejecutada</th>
                  <th>Tarifa Unitaria (COP)</th>
                  <th className="text-right">Subtotal Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="font-semibold text-white">1. Elaboración del Plano 2D (.dwg)</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono">{formatCop(activeJob?.cost_rates.cad_2d_rate_per_ml ?? 2500)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.cad_2d_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-white">2. Procesamiento de Datos Crudos GPR</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono">{formatCop(activeJob?.cost_rates.gpr_proc_rate_per_ml ?? 3000)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.gpr_proc_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-white">3. Mejora y Ajuste de Interferencias en Plano 2D</td>
                  <td className="font-mono text-text-muted">Interferencias</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.detected_utilities.length || 0}</td>
                  <td className="font-mono">{formatCop(activeJob?.cost_rates.cad_refine_rate_per_utility ?? 35000)} / red</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.cad_refine_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-white">4. Elaboración del Modelo 3D BIM (.rvt / IFC)</td>
                  <td className="font-mono text-text-muted">ML</td>
                  <td className="font-mono font-bold text-text-primary">{projectSummary?.total_ml || 0}</td>
                  <td className="font-mono">{formatCop(activeJob?.cost_rates.bim_3d_rate_per_ml ?? 4500)} / ML</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.bim_3d_cost)}
                  </td>
                </tr>

                <tr>
                  <td className="font-semibold text-white">5. Informe Final del Proyecto y Resumen Ejecutivo</td>
                  <td className="font-mono text-text-muted">Global / Informe</td>
                  <td className="font-mono font-bold text-text-primary">1</td>
                  <td className="font-mono">{formatCop(activeJob?.cost_rates.report_fixed_rate ?? 350000)}</td>
                  <td className="font-mono font-bold text-right text-accent">
                    {formatCop(activeJob?.cost_breakdown.report_cost)}
                  </td>
                </tr>

                <tr className="bg-primary-900/60 font-bold border-t-2 border-accent/40">
                  <td colSpan={4} className="text-right text-accent uppercase py-3">
                    Gran Total Cuantificado APU:
                  </td>
                  <td className="font-mono text-right text-accent text-sm py-3">
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
        <div className="card p-5 bg-surface-card border border-border space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
              Interferencias y Servicios Subterráneos Reportados
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Registros consolidados de los formularios de campo GPR correspondientes a este proyecto
            </p>
          </div>

          {(!projectSummary?.detected_utilities || projectSummary.detected_utilities.length === 0) ? (
            <div className="card p-6 text-center text-text-muted border-dashed border">
              No se han reportado interferencias en los formularios de este proyecto todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-full text-xs">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo de Servicio</th>
                    <th>Diámetro</th>
                    <th>Profundidad Est.</th>
                    <th>Confianza</th>
                    <th>Descripción / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projectSummary.detected_utilities.map((u, i) => (
                    <tr key={u.id || i} className="hover:bg-primary-900/40">
                      <td className="font-mono text-text-muted">{u.report_date}</td>
                      <td className="font-semibold text-white">{u.type}</td>
                      <td className="font-mono text-accent">{u.diameter || 'N/D'}</td>
                      <td className="font-mono font-bold">{u.estimated_depth_m} m</td>
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
                      <td className="text-text-muted">{u.description || '—'}</td>
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
        <div className="card p-5 bg-surface-card border border-border space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-accent" strokeWidth={1.75} />
              Plantillas Maestras de Ingeniería (PROCIMEC INGENIERÍA S.A.S.)
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Archivos base sobre los cuales los agentes de IA ensamblan los vectores, tuberías y textos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 bg-primary-900/40 border border-border space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FileCode className="w-4 h-4 text-accent" />
                Plantilla Plano 2D (.dwg / .dxf)
              </div>
              <p className="text-[11px] text-text-muted">
                Contiene rótulo corporativo, tipos de línea de servicios (Gas, Acueducto, Energía), grosores y capas normalizadas.
              </p>
              <div className="font-mono text-[10px] text-accent bg-accent/5 p-2 rounded border border-accent/20">
                Ubicación: <code>templates/cad/plantilla_2d.dwg</code>
              </div>
            </div>

            <div className="card p-4 bg-primary-900/40 border border-border space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Boxes className="w-4 h-4 text-accent" />
                Plantilla Modelo 3D (.rvt / IFC)
              </div>
              <p className="text-[11px] text-text-muted">
                Familias de tuberías circulares, canalizaciones eléctricas y cámaras de inspección con nivel de desarrollo LOD 300.
              </p>
              <div className="font-mono text-[10px] text-accent bg-accent/5 p-2 rounded border border-accent/20">
                Ubicación: <code>templates/bim/plantilla_3d.rvt</code>
              </div>
            </div>

            <div className="card p-4 bg-primary-900/40 border border-border space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <FileText className="w-4 h-4 text-accent" />
                Plantilla Informe Word (.docx)
              </div>
              <p className="text-[11px] text-text-muted">
                Documento membretado con estilos tipográficos oficiales, tablas de metraje y marcadores de posición <code>{'{{placeholders}}'}</code>.
              </p>
              <div className="font-mono text-[10px] text-accent bg-accent/5 p-2 rounded border border-accent/20">
                Ubicación: <code>templates/reports/plantilla_informe.docx</code>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-border text-xs text-text-muted flex items-start gap-2.5">
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
