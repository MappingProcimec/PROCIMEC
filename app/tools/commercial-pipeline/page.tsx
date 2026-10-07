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
  open: { label: 'Abierta', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  budgeted: { label: 'Presupuestada', badge: 'bg-amber-50 text-amber-800 border border-amber-200' },
  quoted: { label: 'Cotizada', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
  in_negotiation: { label: 'En Negociación', badge: 'bg-amber-100 text-amber-900 border border-amber-300' },
  won: { label: 'Adjudicada', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  lost: { label: 'Perdida', badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
  abandoned: { label: 'Desierta / Cancelada', badge: 'bg-slate-100 text-slate-700 border border-slate-300' },
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
  const [filterService, setFilterService] = useState('all');

  // Modal para vinculación retroactiva
  const [linkProposalModal, setLinkProposalModal] = useState<CommercialProposal | null>(null);
  const [targetProjectIdForLink, setTargetProjectIdForLink] = useState('');

  // Consulta React Query con staleTime de 60s
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
  } = useQuery<CommercialPipelineData>({
    queryKey: ['commercial-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/tools/commercial-pipeline');
      if (!res.ok) {
        throw new Error('Error al consultar datos del pipeline comercial');
      }
      const json = await res.json();
      return json.data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Mutación para vincular cotización con proyecto existente
  const linkMutation = useMutation({
    mutationFn: async ({ proposal_id, project_id }: { proposal_id: string; project_id: string }) => {
      const res = await fetch('/api/tools/commercial-pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id, project_id }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al vincular cotización con proyecto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-pipeline'] });
      setLinkProposalModal(null);
      setTargetProjectIdForLink('');
    },
  });

  // Filtros en memoria
  const filteredOpportunities = useMemo(() => {
    if (!dashboard?.opportunities) return [];
    return dashboard.opportunities.filter((opp) => {
      const matchSearch =
        search === '' ||
        (opp.opportunity_code || '').toLowerCase().includes(search.toLowerCase()) ||
        opp.client_name.toLowerCase().includes(search.toLowerCase()) ||
        opp.opportunity_title.toLowerCase().includes(search.toLowerCase());
      const matchService = filterService === 'all' || opp.service_type === filterService;
      return matchSearch && matchService;
    });
  }, [dashboard?.opportunities, search, filterService]);

  const filteredBudgets = useMemo(() => {
    if (!dashboard?.budgets) return [];
    return dashboard.budgets.filter((b) => {
      return (
        search === '' ||
        b.budget_code.toLowerCase().includes(search.toLowerCase()) ||
        b.client_name.toLowerCase().includes(search.toLowerCase()) ||
        b.project_title.toLowerCase().includes(search.toLowerCase()) ||
        b.service_category.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.budgets, search]);

  const filteredProposals = useMemo(() => {
    if (!dashboard?.proposals) return [];
    return dashboard.proposals.filter((p) => {
      return (
        search === '' ||
        p.quote_code.toLowerCase().includes(search.toLowerCase()) ||
        p.client_name.toLowerCase().includes(search.toLowerCase()) ||
        p.scope_description.toLowerCase().includes(search.toLowerCase()) ||
        (p.commercial_budgets?.budget_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.projects?.code || '').toLowerCase().includes(search.toLowerCase())
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
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Institucional Oscuro Carbón */}
      <section className="page-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-3">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-accent/20 text-accent font-mono">
                  PCM CLOUD &bull; HERRAMIENTA TÉCNICA
                </span>
                <span className="text-white/60 text-xs">Gestión Comercial & Proyectos</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-accent shrink-0" strokeWidth={1.75} />
                Gestión Comercial & Proyectos de Ingeniería
              </h1>
              <p className="text-white/70 text-xs sm:text-sm mt-1 max-w-2xl">
                Trazabilidad articulada de Oportunidades, Presupuestos APU, Cotizaciones, Cierres y Apertura Oficial de Proyectos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/forms/registro-oportunidad"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 border border-white/15 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 text-accent" strokeWidth={2} />
                Nueva Oportunidad
              </Link>

              <Link
                href="/forms/presupuesto-proyecto"
                className="px-4 py-2.5 rounded-xl bg-accent text-primary-900 font-extrabold text-xs flex items-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all shadow-md"
              >
                <Calculator className="w-4 h-4" strokeWidth={2} />
                Nuevo Presupuesto APU
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contenedor Principal en Superficie Clara */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Resumen Ejecutivo KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pipeline Activo</span>
              <TrendingUp className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.pipelineCOP ?? 0)}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">En estudio o negociación</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Oportunidades</span>
              <Briefcase className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {dashboard?.stats.activeOpportunitiesCount ?? 0}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Licitaciones y prospectos</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Presupuestos APU</span>
              <Calculator className="w-4 h-4 text-purple-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {dashboard?.stats.budgetsCount ?? 0}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Costeos de ingeniería</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cotizaciones</span>
              <FileCheck2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {dashboard?.stats.issuedProposalsCount ?? 0}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Ofertas económicas</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Contratos Ganados</span>
              <Trophy className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono truncate">
              {formatCOP(dashboard?.stats.wonContractsCOP ?? 0)}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Éxito: {dashboard?.stats.winRatePct ?? 0}%</p>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-3.5 bg-white border border-border shadow-card rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, cliente o proyecto..."
              className="input w-full pl-9 py-2 text-xs bg-white text-text-primary border-border focus:ring-accent"
            />
          </div>

          {activeTab === 'opportunities' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="input py-1.5 text-xs bg-white text-text-primary border-border focus:ring-accent"
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

        {/* Navegador de Pestañas con Estándar PCM CLOUD */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-accent text-primary-900 shadow-sm'
                : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" strokeWidth={1.75} />
            1. Cadena de Trazabilidad
          </button>

          {isCommercial && (
            <button
              onClick={() => setActiveTab('opportunities')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'opportunities'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-4 h-4" strokeWidth={1.75} />
              2. Oportunidades ({dashboard?.opportunities?.length ?? 0})
            </button>
          )}

          {(isEngineeringOrDrawing || isCommercial) && (
            <button
              onClick={() => setActiveTab('budgets')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'budgets'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <Calculator className="w-4 h-4" strokeWidth={1.75} />
              3. Presupuestos APU ({dashboard?.budgets?.length ?? 0})
            </button>
          )}

          {isCommercial && (
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'proposals'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <FileCheck2 className="w-4 h-4" strokeWidth={1.75} />
              4. Cotizaciones ({dashboard?.proposals?.length ?? 0})
            </button>
          )}

          {isCommercial && (
            <button
              onClick={() => setActiveTab('closings')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'closings'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <Trophy className="w-4 h-4" strokeWidth={1.75} />
              5. Cierres & Adjudicaciones ({dashboard?.closings?.length ?? 0})
            </button>
          )}

          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-accent text-primary-900 shadow-sm'
                : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
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
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl">
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">
                Mapa de Flujo Comercial y Articulación Integral
              </h2>
              <p className="text-xs text-text-secondary">
                Visualización de expedientes conectados. Cada fase opera de forma 100% autónoma y permite vinculación retroactiva.
              </p>
            </div>

            {/* Listado de expedientes conectados por Cotización */}
            <div className="space-y-3">
              {(dashboard?.proposals || []).slice(0, 25).map((prop) => {
                const linkedBudget = dashboard?.budgets.find((b) => b.id === prop.budget_id);
                const linkedOpp = dashboard?.opportunities.find((o) => o.id === prop.opportunity_id);
                const linkedClosing = dashboard?.closings.find(
                  (c) => c.proposal_id === prop.id || c.commercial_proposals?.quote_code === prop.quote_code
                );
                const linkedProject =
                  dashboard?.projects.find((pr) => pr.id === prop.project_id) ||
                  dashboard?.projects.find((pr) => pr.commercial_proposal?.quote_code === prop.quote_code);

                return (
                  <div
                    key={prop.id}
                    className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl hover:border-accent/50 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border mb-3">
                      <div>
                        <span className="font-mono text-sm font-bold text-amber-700 mr-2">
                          {prop.quote_code}
                        </span>
                        <strong className="text-text-primary text-sm font-semibold">{prop.client_name}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-text-primary text-sm">
                          {formatCOP(prop.total_amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => generateProposalPdf(prop)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-text-secondary"
                          title="Descargar PDF Cotización"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Cadena de Nodos Visual */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Nodo Oportunidad */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.75} />
                        <span className="text-[11px] font-mono">
                          {linkedOpp?.opportunity_code || 'Sin Oportunidad'}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />

                      {/* Nodo Presupuesto APU */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-semibold">
                        <Calculator className="w-3.5 h-3.5 text-purple-600" strokeWidth={1.75} />
                        <span className="text-[11px] font-mono">
                          {linkedBudget?.budget_code || 'Directo (Sin APU)'}
                        </span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />

                      {/* Nodo Cotización */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                        <FileCheck2 className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
                        <span className="text-[11px] font-mono">{prop.quote_code}</span>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />

                      {/* Nodo Cierre */}
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                          linkedClosing?.result === 'won'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : linkedClosing?.result === 'lost'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
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

                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />

                      {/* Nodo Proyecto */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
                        {linkedProject ? (
                          <span className="text-[11px] text-text-primary font-mono font-bold">
                            {linkedProject.code || linkedProject.cost_center}: {linkedProject.name}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLinkProposalModal(prop)}
                            className="text-[11px] text-amber-700 font-bold hover:underline flex items-center gap-1"
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
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-text-muted italic">
                        No se encontraron oportunidades registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map((opp) => (
                      <tr key={opp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-700 block">{opp.opportunity_code}</span>
                          <span className="text-[10px] text-text-muted">{formatDate(opp.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-text-primary block">{opp.opportunity_title}</span>
                          <span className="text-text-secondary text-[11px]">{opp.client_name}</span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {SERVICE_LABELS[opp.service_type] || opp.service_type}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                          {opp.estimated_value ? formatCOP(opp.estimated_value) : 'Por definir'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-text-primary block truncate max-w-[140px] font-medium">
                            {opp.created_by_name || opp.users?.full_name || 'Comercial'}
                          </span>
                          <span className="text-[10px] text-text-muted block">
                            {opp.created_by_email || opp.users?.email || ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              STATUS_OPP_LABELS[opp.status]?.badge || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {STATUS_OPP_LABELS[opp.status]?.label || opp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateOpportunityPdf(opp)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF (FOR-CMR-001)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/presupuesto-proyecto?opportunity_id=${opp.id}`}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold inline-flex items-center gap-1 transition-all border border-amber-200"
                            title="Crear Presupuesto APU"
                          >
                            <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
                            APU
                          </Link>
                          <Link
                            href={`/forms/cotizacion-comercial?opportunity_id=${opp.id}&client_name=${encodeURIComponent(opp.client_name)}&scope=${encodeURIComponent(opp.opportunity_title)}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold inline-flex items-center gap-1 transition-all"
                            title="Emitir Cotización Directa"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
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
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {filteredBudgets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-text-muted italic">
                        No se encontraron presupuestos APU registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredBudgets.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-purple-700 block">{b.budget_code}</span>
                          <span className="text-[10px] text-text-muted">{formatDate(b.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-text-primary block">{b.project_title}</span>
                          <span className="text-[11px] text-text-secondary">{b.service_category}</span>
                        </td>
                        <td className="py-3 px-4 text-text-primary font-medium">{b.client_name}</td>
                        <td className="py-3 px-4 text-right font-mono text-text-secondary">
                          {formatCOP(b.total_direct_cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                          {formatCOP(b.suggested_sale_price)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-text-primary block truncate max-w-[130px] font-medium">
                            {b.created_by_name || 'Ingeniero de Costos'}
                          </span>
                          <span className="text-[10px] text-text-muted">{formatDate(b.created_at)}</span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateBudgetPdf(b)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF APU (FOR-CMR-004)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/cotizacion-comercial?budget_id=${b.id}&client_name=${encodeURIComponent(b.client_name)}&scope=${encodeURIComponent(b.project_title)}&subtotal=${b.suggested_sale_price}`}
                            className="px-2.5 py-1.5 rounded-lg bg-accent text-primary-900 font-extrabold inline-flex items-center gap-1 transition-all text-xs hover:brightness-105"
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
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {filteredProposals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-text-muted italic">
                        No se encontraron cotizaciones emitidas.
                      </td>
                    </tr>
                  ) : (
                    filteredProposals.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-700 block">{p.quote_code}</span>
                          <span className="text-[10px] text-text-muted">{formatDate(p.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-text-primary block">{p.client_name}</span>
                          <span className="text-[11px] text-text-secondary truncate max-w-[200px] block">
                            {p.scope_description}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-text-secondary">
                          {formatCOP(p.subtotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-800">
                          {formatCOP(p.total_amount)}
                        </td>
                        <td className="py-3 px-4">
                          {p.commercial_budgets?.budget_code ? (
                            <span className="font-mono text-xs text-purple-700 font-semibold">
                              {p.commercial_budgets.budget_code}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">Directa</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.projects?.code || p.projects?.name ? (
                            <span className="font-mono text-xs text-emerald-700 font-bold">
                              {p.projects.code || p.projects.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLinkProposalModal(p)}
                              className="text-amber-700 hover:underline text-[11px] font-bold flex items-center gap-1"
                            >
                              <LinkIcon className="w-3 h-3" />
                              Vincular
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-text-primary block truncate max-w-[120px] font-medium">
                            {p.created_by_name || p.users?.full_name || 'Comercial'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateProposalPdf(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF (FOR-CMR-002)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/forms/cierre-comercial?quote_code=${p.quote_code}&client_name=${encodeURIComponent(p.client_name)}`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold inline-flex items-center gap-1 transition-all text-xs"
                            title="Registrar desenlace de cierre"
                          >
                            <Trophy className="w-3 h-3 text-accent" />
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
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {filteredClosings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-text-muted italic">
                        No se han registrado cierres comerciales.
                      </td>
                    </tr>
                  ) : (
                    filteredClosings.map((c) => {
                      const isWon = c.result === 'won' || c.closing_type === 'won';
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-700 block">{c.closing_code}</span>
                            <span className="text-[10px] text-text-muted">{formatDate(c.created_at)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-text-primary block">
                              {c.commercial_proposals?.quote_code || 'Directa'}
                            </span>
                            <span className="text-[11px] text-text-secondary">
                              {c.commercial_proposals?.client_name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isWon
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isWon ? 'Adjudicada / Ganada' : 'No Adjudicada'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                            {formatCOP(c.final_contract_value || c.final_value || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-text-primary">
                            {c.contract_number || 'Pendiente'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-text-primary block truncate max-w-[120px] font-medium">
                              {c.created_by_name || c.users?.full_name || 'Comercial'}
                            </span>
                            <span className="text-[10px] text-text-muted">{formatDate(c.created_at)}</span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => generateClosingPdf(c)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                              title="Descargar PDF (FOR-CMR-003)"
                            >
                              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            {isWon && (
                              <Link
                                href={`/admin/projects?create_from_closing=${c.id}&client=${encodeURIComponent(c.commercial_proposals?.client_name || '')}&contract_value=${c.final_contract_value || c.final_value}&contract_number=${encodeURIComponent(c.contract_number || '')}`}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 transition-all text-xs"
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
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
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
                <tbody className="divide-y divide-border">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-text-muted italic">
                        No se encontraron proyectos oficiales.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-700">
                          {pr.code || pr.cost_center}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary">{pr.name}</td>
                        <td className="py-3 px-4 text-text-secondary">{pr.client}</td>
                        <td className="py-3 px-4 text-right font-mono text-text-secondary">
                          {formatCOP(pr.contract_value || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                          {formatCOP(pr.execution_value || 0)}
                        </td>
                        <td className="py-3 px-4">
                          {pr.commercial_proposal?.quote_code ? (
                            <span className="font-mono text-xs text-amber-700 font-bold">
                              {pr.commercial_proposal.quote_code}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">Directo (Sin Cotización)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => generateProjectFinancialPdf(pr)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar Ficha Financiera PDF (FOR-GPR-001)"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                          <Link
                            href={`/admin/projects`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold inline-flex items-center gap-1 transition-all"
                            title="Ver en Gestión de Proyectos"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  Vincular Cotización a Proyecto Oficial
                </h3>
                <button
                  type="button"
                  onClick={() => setLinkProposalModal(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-border">
                  <span className="text-[11px] text-text-muted block">Cotización a Vincular:</span>
                  <span className="font-mono text-sm font-bold text-amber-700">
                    {linkProposalModal.quote_code}
                  </span>
                  <span className="text-xs text-text-primary block mt-0.5">{linkProposalModal.client_name}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    Seleccionar Proyecto Existente:
                  </label>
                  <select
                    value={targetProjectIdForLink}
                    onChange={(e) => setTargetProjectIdForLink(e.target.value)}
                    className="input w-full py-2 text-xs bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">Seleccione un proyecto...</option>
                    {(dashboard?.projects || []).map((prj) => (
                      <option key={prj.id} value={prj.id}>
                        {prj.code || prj.cost_center}: {prj.name} ({prj.client})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setLinkProposalModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-text-primary text-xs font-semibold"
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
                    className="px-4 py-2 rounded-xl bg-accent text-primary-900 text-xs font-bold disabled:opacity-50 transition-all flex items-center gap-1.5 hover:brightness-105"
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
