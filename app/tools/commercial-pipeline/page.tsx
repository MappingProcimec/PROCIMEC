'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Briefcase,
  TrendingUp,
  FileCheck2,
  Trophy,
  Search,
  Filter,
  FileText,
  X,
  Calculator,
  Download,
  ArrowRight,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  User,
  ExternalLink,
  Plus,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  CommercialOpportunity,
  CommercialBudget,
  CommercialProposal,
  CommercialClosing,
  Project,
  CommercialPipelineData,
} from '@/types';
import {
  generateOpportunityPdf,
  generateBudgetPdf,
  generateProposalPdf,
  generateClosingPdf,
  generateProjectFinancialPdf,
} from '@/lib/commercial/commercialPdfGenerator';

const SERVICE_LABELS: Record<string, string> = {
  gpr_localizacion: 'Georradar GPR y Localización Subterránea',
  civil_planta: 'Obras Civiles y Adecuaciones en Planta',
  montaje_mecanico: 'Montajes Mecánicos, Piping y Estructuras',
  topografia_cad: 'Topografía de Precisión y Modelado BIM',
  topografia_industrial: 'Topografía Industrial y Escaneo Láser',
  inspeccion_dron: 'Inspección Aérea con Dron',
  geofisica_integral: 'Geofísica Aplicada Integral',
  interventoria_obra: 'Interventoría Técnica de Obra',
  consultoria: 'Consultoría y Diseño de Infraestructura',
};

const STATUS_OPP_LABELS: Record<string, { label: string; badge: string }> = {
  open: { label: 'Abierta', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' },
  budgeted: { label: 'Presupuestada', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
  quoted: { label: 'Cotizada', badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/30' },
  in_negotiation: { label: 'En Negociación', badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/40' },
  won: { label: 'Adjudicada', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
  lost: { label: 'Perdida', badge: 'bg-red-500/10 text-red-400 border border-red-500/30' },
  abandoned: { label: 'Desierta / Cancelada', badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/30' },
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

type PipelineTab = 'timeline' | 'opportunities' | 'budgets' | 'proposals' | 'closings' | 'projects';

export default function CommercialPipelinePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const userRole = session?.user?.role || 'pending';

  // Permisos RBAC por pestaña
  const isManagementOrAdmin = ['admin', 'management', 'gerencia'].includes(userRole);
  const isCommercial = ['commercial', 'comercial', 'admin', 'management', 'gerencia'].includes(userRole);
  const isEngineeringOrDrawing = ['drawing', 'dibujo', 'admin', 'management', 'gerencia'].includes(userRole);

  const [activeTab, setActiveTab] = useState<PipelineTab>('timeline');
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<string>('all');

  // Modales de Detalle
  const [selectedOpp, setSelectedOpp] = useState<CommercialOpportunity | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<CommercialBudget | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<CommercialProposal | null>(null);
  const [selectedClosing, setSelectedClosing] = useState<CommercialClosing | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Modal de Vinculación Retroactiva
  const [linkProposalModal, setLinkProposalModal] = useState<CommercialProposal | null>(null);
  const [targetProjectIdForLink, setTargetProjectIdForLink] = useState<string>('');

  const { data, isLoading } = useQuery<{ data: CommercialPipelineData }>({
    queryKey: ['commercial-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/tools/commercial-pipeline');
      if (!res.ok) throw new Error('Error al cargar datos comerciales');
      return res.json();
    },
  });

  const dashboard = data?.data;

  // Mutación para vincular retroactivamente propuesta a proyecto
  const linkMutation = useMutation({
    mutationFn: async ({ proposal_id, project_id }: { proposal_id: string; project_id: string }) => {
      const res = await fetch('/api/tools/commercial-pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_proposal_project', proposal_id, project_id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al vincular');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-pipeline'] });
      setLinkProposalModal(null);
      setTargetProjectIdForLink('');
      alert('Propuesta vinculada exitosamente con el proyecto.');
    },
    onError: (err: Error) => {
      alert(`Error al vincular: ${err.message}`);
    },
  });

  // Filtros en memoria O(N)
  const filteredOpportunities = useMemo(() => {
    if (!dashboard?.opportunities) return [];
    return dashboard.opportunities.filter((o) => {
      const matchSearch =
        search === '' ||
        (o.opportunity_title || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.opportunity_code || '').toLowerCase().includes(search.toLowerCase());
      const matchService = filterService === 'all' || o.service_type === filterService;
      return matchSearch && matchService;
    });
  }, [dashboard?.opportunities, search, filterService]);

  const filteredBudgets = useMemo(() => {
    if (!dashboard?.budgets) return [];
    return dashboard.budgets.filter((b) => {
      return (
        search === '' ||
        (b.budget_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.project_title || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.budgets, search]);

  const filteredProposals = useMemo(() => {
    if (!dashboard?.proposals) return [];
    return dashboard.proposals.filter((p) => {
      return (
        search === '' ||
        (p.quote_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.scope_description || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.proposals, search]);

  const filteredClosings = useMemo(() => {
    if (!dashboard?.closings) return [];
    return dashboard.closings.filter((c) => {
      return (
        search === '' ||
        (c.closing_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.commercial_proposals?.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.commercial_proposals?.quote_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.contract_number || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.closings, search]);

  const filteredProjects = useMemo(() => {
    if (!dashboard?.projects) return [];
    return dashboard.projects.filter((pr) => {
      return (
        search === '' ||
        (pr.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (pr.client || '').toLowerCase().includes(search.toLowerCase()) ||
        (pr.cost_center || '').toLowerCase().includes(search.toLowerCase()) ||
        (pr.commercial_proposal?.quote_code || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.projects, search]);

  return (
    <div className="min-h-screen bg-[#15181D] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 pt-6">
        <BackButton href="/dashboard" label="Volver a Mi Panel" />

        {/* Encabezado Institucional */}
        <div className="mt-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A303C] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Briefcase className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Gestión Comercial & Proyectos de Ingeniería
              </h1>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              PCM CLOUD — Trazabilidad articulada de Oportunidades, Presupuestos APU, Cotizaciones, Cierres y Apertura de Proyectos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/forms/registro-oportunidad"
              className="px-3.5 py-2 rounded-xl bg-[#2A303C] hover:bg-[#323946] text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-600 transition-all"
            >
              <Plus className="w-4 h-4 text-amber-400" strokeWidth={2} />
              Nueva Oportunidad
            </Link>

            <Link
              href="/forms/presupuesto-proyecto"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Calculator className="w-4 h-4" strokeWidth={2} />
              Nuevo Presupuesto APU
            </Link>
          </div>
        </div>

        {/* Resumen Ejecutivo KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pipeline Activo</span>
              <TrendingUp className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
            </div>
            <p className="text-lg md:text-xl font-bold text-white font-mono truncate">
              {formatCOP(dashboard?.stats.pipelineCOP ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">En estudio o negociación</p>
          </div>

          <div className="bg-[#1E2229] border border-[#2A303C] rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Oportunidades</span>
              <Briefcase className="w-4 h-4 text-blue-400" strokeWidth={1.75} />
            </div>
            <p className="text-lg md:text-xl font-bold text-white font-mono">
              {dashboard?.stats.activeOpportunitiesCount ?? 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Licitaciones y prospectos</p>
          </div>

          <div className="bg-[#1E2229] border border-[#2A303C] rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Presupuestos APU</span>
              <Calculator className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
            </div>
            <p className="text-lg md:text-xl font-bold text-white font-mono">
              {dashboard?.stats.budgetsCount ?? 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Costeos de ingeniería</p>
          </div>

          <div className="bg-[#1E2229] border border-[#2A303C] rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Cotizaciones</span>
              <FileCheck2 className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
            </div>
            <p className="text-lg md:text-xl font-bold text-white font-mono">
              {dashboard?.stats.issuedProposalsCount ?? 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ofertas económicas</p>
          </div>

          <div className="bg-[#1E2229] border border-[#2A303C] rounded-xl p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Contratos Ganados</span>
              <Trophy className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
            </div>
            <p className="text-lg md:text-xl font-bold text-emerald-400 font-mono truncate">
              {formatCOP(dashboard?.stats.wonContractsCOP ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tasa de éxito: {dashboard?.stats.winRatePct ?? 0}%</p>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 bg-[#1E2229] p-3 rounded-xl border border-[#2A303C]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, cliente o proyecto..."
              className="w-full bg-[#15181D] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {activeTab === 'opportunities' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-[#15181D] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="all">Todas las Líneas de Servicio</option>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navegador de Pestañas con RBAC */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#2A303C] mb-6">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
            }`}
          >
            <Layers className="w-4 h-4" strokeWidth={1.75} />
            1. Cadena de Trazabilidad
          </button>

          {isCommercial && (
            <button
              onClick={() => setActiveTab('opportunities')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'opportunities'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
              }`}
            >
              <Briefcase className="w-4 h-4" strokeWidth={1.75} />
              2. Oportunidades ({dashboard?.opportunities?.length ?? 0})
            </button>
          )}

          {(isEngineeringOrDrawing || isCommercial) && (
            <button
              onClick={() => setActiveTab('budgets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'budgets'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
              }`}
            >
              <Calculator className="w-4 h-4" strokeWidth={1.75} />
              3. Presupuestos APU ({dashboard?.budgets?.length ?? 0})
            </button>
          )}

          {isCommercial && (
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'proposals'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
              }`}
            >
              <FileCheck2 className="w-4 h-4" strokeWidth={1.75} />
              4. Cotizaciones ({dashboard?.proposals?.length ?? 0})
            </button>
          )}

          {isCommercial && (
            <button
              onClick={() => setActiveTab('closings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'closings'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
              }`}
            >
              <Trophy className="w-4 h-4" strokeWidth={1.75} />
              5. Cierres & Adjudicaciones ({dashboard?.closings?.length ?? 0})
            </button>
          )}

          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-[#1E2229] text-slate-300 hover:bg-[#2A303C]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
            6. Proyectos Oficiales ({dashboard?.projects?.length ?? 0})
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 1: CADENA DE TRAZABILIDAD ARTICULADA (TIMELINE)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">
                Mapa de Flujo Comercial y Ejecución
              </h2>
              <p className="text-xs text-slate-400">
                Visualización de expedientes conectados. Recuerde que el sistema es totalmente desacoplado: se puede iniciar desde cualquier fase y vincular posteriormente.
              </p>
            </div>

            {/* Listado de expedientes conectados por Cotización */}
            <div className="space-y-3">
              {(dashboard?.proposals || []).slice(0, 20).map((prop) => {
                const linkedBudget = dashboard?.budgets.find((b) => b.id === prop.budget_id);
                const linkedOpp = dashboard?.opportunities.find((o) => o.id === prop.opportunity_id);
                const linkedClosing = dashboard?.closings.find((c) => c.proposal_id === prop.id);
                const linkedProject = dashboard?.projects.find(
                  (pr) => pr.commercial_proposal_id === prop.id || pr.id === prop.project_id
                );

                return (
                  <div
                    key={prop.id}
                    className="bg-[#1E2229] border border-[#2A303C] hover:border-slate-600 rounded-xl p-4 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A303C] pb-2 mb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-amber-400 mr-2">{prop.quote_code}</span>
                        <span className="text-xs font-semibold text-white">{prop.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {formatCOP(prop.total_amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => generateProposalPdf(prop)}
                          className="p-1 rounded bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                          title="Descargar PDF Oferta"
                        >
                          <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>

                    {/* Cadena visual horizontal */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Nodo Oportunidad */}
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15181D] border border-slate-700">
                        <Briefcase className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.75} />
                        <span className="text-[11px] text-slate-300">
                          {linkedOpp ? linkedOpp.opportunity_code || 'OPP' : 'Directa (Sin Oportunidad)'}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />

                      {/* Nodo Presupuesto */}
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15181D] border border-slate-700">
                        <Calculator className="w-3.5 h-3.5 text-purple-400" strokeWidth={1.75} />
                        <span className="text-[11px] text-slate-300">
                          {linkedBudget ? linkedBudget.budget_code : 'Sin APU Previsto'}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />

                      {/* Nodo Cotización */}
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 font-semibold">
                        <FileCheck2 className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
                        <span className="text-[11px] font-mono">{prop.quote_code}</span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />

                      {/* Nodo Cierre */}
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                          linkedClosing?.result === 'won'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : linkedClosing?.result === 'lost'
                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-[#15181D] border-slate-700 text-slate-400'
                        }`}
                      >
                        <Trophy className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span className="text-[11px]">
                          {linkedClosing
                            ? linkedClosing.result === 'won'
                              ? 'Ganada / Adjudicada'
                              : 'No Adjudicada'
                            : 'En Estudio'}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />

                      {/* Nodo Proyecto */}
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15181D] border border-slate-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
                        {linkedProject ? (
                          <span className="text-[11px] text-amber-300 font-mono">
                            {linkedProject.code || linkedProject.cost_center}: {linkedProject.name}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLinkProposalModal(prop)}
                            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <LinkIcon className="w-3 h-3" strokeWidth={2} />
                            + Vincular a Proyecto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 2: OPORTUNIDADES (FOR-CMR-001)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'opportunities' && isCommercial && (
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15181D] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#2A303C]">
                  <tr>
                    <th className="py-3 px-4">Código / Fecha</th>
                    <th className="py-3 px-4">Oportunidad / Cliente</th>
                    <th className="py-3 px-4">Servicio</th>
                    <th className="py-3 px-4 text-right">Presupuesto Estimado</th>
                    <th className="py-3 px-4">Autor / Registro</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A303C]">
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                        No se encontraron oportunidades registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map((opp) => (
                      <tr key={opp.id} className="hover:bg-[#15181D]/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-400 block">{opp.opportunity_code}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(opp.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{opp.opportunity_title}</span>
                          <span className="text-slate-400 text-[11px]">{opp.client_name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {SERVICE_LABELS[opp.service_type] || opp.service_type}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                          {opp.estimated_value ? formatCOP(opp.estimated_value) : 'Por definir'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 block truncate max-w-[140px]">
                            {opp.created_by_name || opp.users?.full_name || 'Comercial'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {opp.created_by_email || opp.users?.email || ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              STATUS_OPP_LABELS[opp.status]?.badge || 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {STATUS_OPP_LABELS[opp.status]?.label || opp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateOpportunityPdf(opp)}
                            className="p-1.5 rounded-lg bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                            title="Descargar PDF (FOR-CMR-001)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/presupuesto-proyecto?opportunity_id=${opp.id}`}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold inline-flex items-center gap-1 transition-all border border-amber-500/30"
                            title="Crear Presupuesto APU"
                          >
                            <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
                            APU
                          </Link>
                          <Link
                            href={`/forms/cotizacion-comercial?opportunity_id=${opp.id}&client_name=${encodeURIComponent(opp.client_name)}&scope=${encodeURIComponent(opp.opportunity_title)}`}
                            className="p-1.5 rounded-lg bg-[#2A303C] hover:bg-[#323946] text-white font-semibold inline-flex items-center gap-1 transition-all"
                            title="Emitir Cotización Directa"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 3: PRESUPUESTOS APU (FOR-CMR-004)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'budgets' && (isEngineeringOrDrawing || isCommercial) && (
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15181D] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#2A303C]">
                  <tr>
                    <th className="py-3 px-4">Código APU</th>
                    <th className="py-3 px-4">Proyecto / Alcance</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-right">Costos Directos (CD)</th>
                    <th className="py-3 px-4 text-right">Venta Sugerida</th>
                    <th className="py-3 px-4">Autor & Fecha</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A303C]">
                  {filteredBudgets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                        No se encontraron presupuestos APU registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredBudgets.map((b) => (
                      <tr key={b.id} className="hover:bg-[#15181D]/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-400 block">{b.budget_code}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(b.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{b.project_title}</span>
                          <span className="text-[11px] text-slate-400">{b.service_category}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{b.client_name}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {formatCOP(b.total_direct_cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCOP(b.suggested_sale_price)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 block truncate max-w-[130px]">
                            {b.created_by_name || 'Ingeniero de Costos'}
                          </span>
                          <span className="text-[10px] text-slate-500">{formatDate(b.created_at)}</span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateBudgetPdf(b)}
                            className="p-1.5 rounded-lg bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                            title="Descargar PDF APU (FOR-CMR-004)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/cotizacion-comercial?budget_id=${b.id}&client_name=${encodeURIComponent(b.client_name)}&scope=${encodeURIComponent(b.project_title)}&subtotal=${b.suggested_sale_price}`}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold inline-flex items-center gap-1 transition-all text-xs"
                            title="Generar Cotización desde este Presupuesto"
                          >
                            Cotizar
                            <ArrowRight className="w-3 h-3" strokeWidth={2} />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 4: COTIZACIONES (FOR-CMR-002)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'proposals' && isCommercial && (
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15181D] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#2A303C]">
                  <tr>
                    <th className="py-3 px-4">Código Oferta</th>
                    <th className="py-3 px-4">Cliente / Razón Social</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Total Ofertado</th>
                    <th className="py-3 px-4">Presupuesto APU</th>
                    <th className="py-3 px-4">Proyecto Oficial</th>
                    <th className="py-3 px-4">Autor</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A303C]">
                  {filteredProposals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500 italic">
                        No se encontraron cotizaciones emitidas.
                      </td>
                    </tr>
                  ) : (
                    filteredProposals.map((p) => (
                      <tr key={p.id} className="hover:bg-[#15181D]/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-400 block">{p.quote_code}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(p.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{p.client_name}</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[200px] block">
                            {p.scope_description}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {formatCOP(p.subtotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCOP(p.total_amount)}
                        </td>
                        <td className="py-3 px-4">
                          {p.commercial_budgets?.budget_code ? (
                            <span className="font-mono text-xs text-purple-400">
                              {p.commercial_budgets.budget_code}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Directa</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.projects?.code || p.projects?.name ? (
                            <span className="font-mono text-xs text-amber-300">
                              {p.projects.code || p.projects.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLinkProposalModal(p)}
                              className="text-amber-400 hover:underline text-[11px] flex items-center gap-1"
                            >
                              <LinkIcon className="w-3 h-3" />
                              Vincular
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 block truncate max-w-[120px]">
                            {p.created_by_name || p.users?.full_name || 'Comercial'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateProposalPdf(p)}
                            className="p-1.5 rounded-lg bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                            title="Descargar PDF (FOR-CMR-002)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/cierre-comercial?quote_code=${p.quote_code}&client_name=${encodeURIComponent(p.client_name)}`}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2A303C] hover:bg-[#323946] text-white font-semibold inline-flex items-center gap-1 transition-all text-xs"
                            title="Registrar desenlace de cierre"
                          >
                            <Trophy className="w-3 h-3 text-amber-400" />
                            Cierre
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 5: CIERRES & ADJUDICACIONES (FOR-CMR-003)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'closings' && isCommercial && (
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15181D] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#2A303C]">
                  <tr>
                    <th className="py-3 px-4">Código Cierre</th>
                    <th className="py-3 px-4">Cotización / Cliente</th>
                    <th className="py-3 px-4 text-center">Resultado</th>
                    <th className="py-3 px-4 text-right">Valor Final Adjudicado</th>
                    <th className="py-3 px-4">Contrato / OS</th>
                    <th className="py-3 px-4">Autor & Fecha</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A303C]">
                  {filteredClosings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                        No se han registrado cierres comerciales.
                      </td>
                    </tr>
                  ) : (
                    filteredClosings.map((c) => {
                      const isWon = c.result === 'won' || c.closing_type === 'won';
                      return (
                        <tr key={c.id} className="hover:bg-[#15181D]/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-400 block">{c.closing_code}</span>
                            <span className="text-[10px] text-slate-500">{formatDate(c.created_at)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-200 block">
                              {c.commercial_proposals?.quote_code || 'Directa'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {c.commercial_proposals?.client_name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isWon
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {isWon ? 'Adjudicada / Ganada' : 'No Adjudicada'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatCOP(c.final_contract_value || c.final_value || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {c.contract_number || 'Pendiente'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-200 block truncate max-w-[120px]">
                              {c.created_by_name || c.users?.full_name || 'Comercial'}
                            </span>
                            <span className="text-[10px] text-slate-500">{formatDate(c.created_at)}</span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => generateClosingPdf(c)}
                              className="p-1.5 rounded-lg bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                              title="Descargar PDF (FOR-CMR-003)"
                            >
                              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            {isWon && (
                              <Link
                                href={`/admin/projects?create_from_closing=${c.id}&client=${encodeURIComponent(c.commercial_proposals?.client_name || '')}&contract_value=${c.final_contract_value || c.final_value}&contract_number=${encodeURIComponent(c.contract_number || '')}`}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold inline-flex items-center gap-1 transition-all text-xs"
                                title="Aperturar Proyecto Oficial en Sistema"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Crear Proyecto
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 6: PROYECTOS OFICIALES DERIVADOS
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15181D] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#2A303C]">
                  <tr>
                    <th className="py-3 px-4">Código / CC</th>
                    <th className="py-3 px-4">Nombre del Proyecto</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-right">Valor Contrato</th>
                    <th className="py-3 px-4 text-right">Presupuesto Ejecución</th>
                    <th className="py-3 px-4">Cotización Vinculada</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A303C]">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                        No se encontraron proyectos oficiales.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((pr) => (
                      <tr key={pr.id} className="hover:bg-[#15181D]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {pr.code || pr.cost_center}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{pr.name}</td>
                        <td className="py-3 px-4 text-slate-300">{pr.client}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {formatCOP(pr.contract_value || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCOP(pr.execution_value || 0)}
                        </td>
                        <td className="py-3 px-4">
                          {pr.commercial_proposal?.quote_code ? (
                            <span className="font-mono text-xs text-amber-300">
                              {pr.commercial_proposal.quote_code}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Directo (Sin Cotización)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateProjectFinancialPdf(pr)}
                            className="p-1.5 rounded-lg bg-[#15181D] hover:bg-[#2A303C] text-slate-300 hover:text-amber-400 transition-colors"
                            title="Descargar Ficha Financiera PDF (FOR-GPR-001)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/admin/projects`}
                            className="p-1.5 rounded-lg bg-[#2A303C] hover:bg-[#323946] text-white font-semibold inline-flex items-center gap-1 transition-all"
                            title="Ver en Gestión de Proyectos"
                          >
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            MODAL DE VINCULACIÓN RETROACTIVA: COTIZACIÓN <-> PROYECTO
           ──────────────────────────────────────────────────────────────────── */}
        {linkProposalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#2A303C] pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                  Vincular Cotización a Proyecto
                </h3>
                <button
                  type="button"
                  onClick={() => setLinkProposalModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#15181D] p-3 rounded-xl border border-[#2A303C]">
                  <span className="text-[11px] text-slate-400 block">Cotización a Vincular:</span>
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {linkProposalModal.quote_code}
                  </span>
                  <span className="text-xs text-white block mt-0.5">{linkProposalModal.client_name}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Seleccionar Proyecto Existente:
                  </label>
                  <select
                    value={targetProjectIdForLink}
                    onChange={(e) => setTargetProjectIdForLink(e.target.value)}
                    className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Seleccione un proyecto...</option>
                    {(dashboard?.projects || []).map((prj) => (
                      <option key={prj.id} value={prj.id}>
                        {prj.code || prj.cost_center}: {prj.name} ({prj.client})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A303C]">
                  <button
                    type="button"
                    onClick={() => setLinkProposalModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!targetProjectIdForLink || linkMutation.isPending}
                    onClick={() =>
                      linkMutation.mutate({
                        proposal_id: linkProposalModal.id,
                        project_id: targetProjectIdForLink,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {linkMutation.isPending ? 'Vinculando...' : 'Confirmar Vínculo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
