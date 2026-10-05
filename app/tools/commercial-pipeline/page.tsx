'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

interface CommercialOpportunity {
  id: string;
  client_name: string;
  client_contact: string | null;
  client_email: string | null;
  client_phone: string | null;
  opportunity_title: string;
  service_type: string;
  estimated_value: number | null;
  deadline_date: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
}

interface CommercialProposal {
  id: string;
  opportunity_id: string | null;
  quote_code: string;
  client_name: string;
  scope_description: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  validity_days: number;
  delivery_weeks: number;
  notes: string | null;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  commercial_opportunities?: { opportunity_title?: string; service_type?: string } | null;
}

interface CommercialClosing {
  id: string;
  proposal_id: string | null;
  closing_type: string;
  final_value: number;
  reason: string | null;
  feedback_notes: string | null;
  project_code: string | null;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  commercial_proposals?: { quote_code?: string; client_name?: string } | null;
}

interface CommercialData {
  stats: {
    pipelineCOP: number;
    activeOpportunitiesCount: number;
    issuedProposalsCount: number;
    wonContractsCOP: number;
    winRatePct: number;
  };
  opportunities: CommercialOpportunity[];
  proposals: CommercialProposal[];
  closings: CommercialClosing[];
}

const SERVICE_LABELS: Record<string, string> = {
  gpr_localizacion: 'GPR / Localización Subterránea',
  topografia_cad: 'Topografía & Modelado CAD/BIM',
  inspeccion_dron: 'Inspección Aérea con Dron',
  geofisica_integral: 'Geofísica Aplicada Integral',
  consultoria: 'Consultoría Especializada',
};

const STATUS_OPP_LABELS: Record<string, { label: string; badge: string }> = {
  open: { label: 'Abierta', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  quoted: { label: 'Cotizada', badge: 'bg-purple-100/80 text-purple-900 border border-purple-300' },
  in_negotiation: { label: 'En Negociación', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  won: { label: 'Adjudicada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  lost: { label: 'Perdida', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
  abandoned: { label: 'Desierta / Cancelada', badge: 'bg-slate-100 text-slate-800 border border-slate-300' },
};

const CLOSING_TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  won: { label: 'Ganada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  adjudicada: { label: 'Adjudicada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  lost: { label: 'Perdida', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
  desert: { label: 'Desierta', badge: 'bg-slate-100 text-slate-800 border border-slate-300' },
};

export default function CommercialPipelinePage() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'proposals' | 'closings'>('opportunities');
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<CommercialOpportunity | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<CommercialProposal | null>(null);

  const { data, isLoading } = useQuery<{ data: CommercialData }>({
    queryKey: ['commercial-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/tools/commercial-pipeline');
      if (!res.ok) throw new Error('Error al cargar datos comerciales');
      return res.json();
    },
  });

  const dashboard = data?.data;

  const filteredOpportunities = useMemo(() => {
    if (!dashboard?.opportunities) return [];
    return dashboard.opportunities.filter((o) => {
      const matchSearch =
        search === '' ||
        o.opportunity_title.toLowerCase().includes(search.toLowerCase()) ||
        o.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.location || '').toLowerCase().includes(search.toLowerCase());
      const matchService = filterService === 'all' || o.service_type === filterService;
      return matchSearch && matchService;
    });
  }, [dashboard?.opportunities, search, filterService]);

  const filteredProposals = useMemo(() => {
    if (!dashboard?.proposals) return [];
    return dashboard.proposals.filter((p) => {
      return (
        search === '' ||
        p.quote_code.toLowerCase().includes(search.toLowerCase()) ||
        p.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.scope_description || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.proposals, search]);

  const filteredClosings = useMemo(() => {
    if (!dashboard?.closings) return [];
    return dashboard.closings.filter((c) => {
      return (
        search === '' ||
        (c.commercial_proposals?.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.reason || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.project_code || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.closings, search]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Briefcase className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Pipeline y Gestión Comercial
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Seguimiento integral del embudo comercial, licitaciones activas, propuestas y tasa de adjudicación
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pipeline en Curso</span>
              <TrendingUp className="w-4 h-4 text-accent" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.pipelineCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Valor estimado en negociación</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Oportunidades Activas</span>
              <Briefcase className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.activeOpportunitiesCount ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Licitaciones y prospectos abiertos</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cotizaciones Emitidas</span>
              <FileCheck2 className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.issuedProposalsCount ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Propuestas económicas activas</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Contratos Adjudicados</span>
              <Trophy className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
                {dashboard?.stats.winRatePct ?? 0}%
              </p>
              <span className="text-xs font-mono font-semibold text-emerald-800">
                {formatCOP(dashboard?.stats.wonContractsCOP ?? 0)}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">Tasa de éxito en cierres</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('opportunities')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'opportunities'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Briefcase className="w-4 h-4" strokeWidth={1.75} />
            Oportunidades & Licitaciones
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.opportunities.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'proposals'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            Cotizaciones Emitidas
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.proposals.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('closings')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'closings'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Trophy className="w-4 h-4" strokeWidth={1.75} />
            Historial de Cierres
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.closings.length ?? 0}
            </span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="card p-3 sm:p-4 border border-border flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type="text"
              placeholder={
                activeTab === 'opportunities'
                  ? 'Buscar por cliente, título de licitación o ciudad...'
                  : activeTab === 'proposals'
                  ? 'Buscar por código de cotización o cliente...'
                  : 'Buscar por cliente, proyecto o motivo...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
            />
          </div>

          {activeTab === 'opportunities' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">Todas las especialidades</option>
                <option value="gpr_localizacion">GPR / Localización</option>
                <option value="topografia_cad">Topografía & CAD</option>
                <option value="inspeccion_dron">Inspección con Dron</option>
                <option value="geofisica_integral">Geofísica Integral</option>
                <option value="consultoria">Consultoría</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Opportunities */}
        {activeTab === 'opportunities' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando oportunidades comerciales...</div>
            ) : filteredOpportunities.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron oportunidades registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Oportunidad / Objeto</th>
                      <th className="py-3 px-4">Servicio</th>
                      <th className="py-3 px-4">Valor Estimado</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOpportunities.map((o) => {
                      const st = STATUS_OPP_LABELS[o.status] ?? { label: o.status, badge: 'badge-outline' };
                      return (
                        <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-text-primary whitespace-nowrap">
                            {o.client_name}
                            {o.location && <p className="text-xs text-text-muted font-normal mt-0.5">{o.location}</p>}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-medium text-text-primary truncate">{o.opportunity_title}</p>
                            <p className="text-xs text-text-muted truncate">Límite: {o.deadline_date || 'Abierta'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-text-secondary font-medium">
                              {SERVICE_LABELS[o.service_type] || o.service_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {o.estimated_value ? formatCOP(Number(o.estimated_value)) : 'Por definir'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedOpportunity(o)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Ver detalle →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Proposals */}
        {activeTab === 'proposals' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando cotizaciones...</div>
            ) : filteredProposals.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron cotizaciones emitidas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Código Oferta</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Alcance Técnico</th>
                      <th className="py-3 px-4">Plazo Entrega</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProposals.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                          {p.quote_code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary whitespace-nowrap">
                          {p.client_name}
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <p className="text-xs text-text-secondary line-clamp-2">{p.scope_description}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {p.delivery_weeks} sem. ({p.validity_days} días validez)
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                          {formatCOP(Number(p.total_amount) || 0)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedProposal(p)}
                            className="text-xs text-primary font-semibold hover:underline"
                          >
                            Ver desglose →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Closings */}
        {activeTab === 'closings' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando cierres...</div>
            ) : filteredClosings.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron cierres comerciales registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Resultado</th>
                      <th className="py-3 px-4">Cliente / Oferta</th>
                      <th className="py-3 px-4">Valor Final</th>
                      <th className="py-3 px-4">Código Proyecto</th>
                      <th className="py-3 px-4">Observaciones / Razón</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredClosings.map((c) => {
                      const st = CLOSING_TYPE_LABELS[c.closing_type] ?? { label: c.closing_type, badge: 'badge-outline' };
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-text-primary">{c.commercial_proposals?.client_name || 'Cliente'}</p>
                            <p className="text-xs text-text-muted font-mono">{c.commercial_proposals?.quote_code || '—'}</p>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(c.final_value) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                            {c.project_code || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-xs text-text-secondary max-w-xs truncate">
                            {c.reason || c.feedback_notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle Oportunidad */}
      {selectedOpportunity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Detalle de Oportunidad</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedOpportunity.opportunity_title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpportunity(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">Cliente</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOpportunity.client_name}</p>
              </div>
              <div>
                <p className="text-text-muted">Contacto</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOpportunity.client_contact || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Teléfono / Correo</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedOpportunity.client_phone || selectedOpportunity.client_email || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Especialidad</p>
                <p className="font-semibold text-text-primary mt-0.5">{SERVICE_LABELS[selectedOpportunity.service_type] || selectedOpportunity.service_type}</p>
              </div>
              <div>
                <p className="text-text-muted">Valor Presupuestado</p>
                <p className="font-mono font-bold text-primary mt-0.5">
                  {selectedOpportunity.estimated_value ? formatCOP(Number(selectedOpportunity.estimated_value)) : 'Por definir'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Fecha Límite</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedOpportunity.deadline_date || 'Abierta'}</p>
              </div>
            </div>

            {selectedOpportunity.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Condiciones Técnicas y Alcance</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedOpportunity.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOpportunity(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Desglose Cotización */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">{selectedProposal.quote_code}</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedProposal.client_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposal(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal antes de impuestos:</span>
                  <span className="font-mono font-medium">{formatCOP(Number(selectedProposal.subtotal) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">IVA / Impuestos:</span>
                  <span className="font-mono font-medium">{formatCOP(Number(selectedProposal.tax_amount) || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-text-primary">
                  <span>Monto Total de Propuesta:</span>
                  <span className="font-mono text-primary">{formatCOP(Number(selectedProposal.total_amount) || 0)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-text-muted">Vigencia de la oferta:</span>
                  <p className="font-semibold text-text-primary">{selectedProposal.validity_days} días calendario</p>
                </div>
                <div>
                  <span className="text-text-muted">Tiempo de entrega:</span>
                  <p className="font-semibold text-text-primary">{selectedProposal.delivery_weeks} semanas</p>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-text-muted">Alcance Técnico Ofertado:</span>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedProposal.scope_description}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
