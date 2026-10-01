'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Receipt,
  CreditCard,
  Calendar,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
  MapPin
} from 'lucide-react';

interface PerDiemRequest {
  id: string;
  destination: string;
  departure_date: string;
  return_date: string;
  estimated_days: number;
  lodging_budget: number;
  food_budget: number;
  transport_budget: number;
  tolls_fuel_budget: number;
  total_requested: number;
  notes: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface ExpenseLegalization {
  id: string;
  per_diem_request_id: string | null;
  total_received: number;
  total_spent: number;
  balance_difference: number;
  balance_type: string;
  receipt_count: number;
  notes: string | null;
  status: string;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  per_diem_requests?: { destination?: string; departure_date?: string; return_date?: string } | null;
}

interface PaymentRecord {
  id: string;
  payment_type: string;
  beneficiary_name: string;
  beneficiary_doc: string | null;
  amount: number;
  currency: string;
  bank_name: string | null;
  transaction_reference: string | null;
  payment_date: string;
  notes: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface FinanceData {
  stats: {
    totalDisbursedCOP: number;
    pendingLegalizationsCount: number;
    totalPaymentsCOP: number;
    totalLegalizedCOP: number;
  };
  perDiems: PerDiemRequest[];
  legalizations: ExpenseLegalization[];
  payments: PaymentRecord[];
}

const STATUS_PER_DIEM_LABELS: Record<string, { label: string; badge: string }> = {
  requested: { label: 'Solicitado', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  approved: { label: 'Aprobado', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  disbursed: { label: 'Desembolsado (En Campo)', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  legalized: { label: 'Legalizado', badge: 'bg-purple-100/80 text-purple-900 border border-purple-300' },
  closed: { label: 'Cerrado', badge: 'bg-slate-100 text-slate-800 border border-slate-300' },
  rejected: { label: 'Rechazado', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const STATUS_LEG_LABELS: Record<string, { label: string; badge: string }> = {
  submitted: { label: 'Radicada', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  audited: { label: 'Auditada', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  closed: { label: 'Conciliada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
};

export default function FinanceExpensesBoardPage() {
  const [activeTab, setActiveTab] = useState<'perDiems' | 'legalizations' | 'payments'>('perDiems');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPerDiem, setSelectedPerDiem] = useState<PerDiemRequest | null>(null);
  const [selectedLegalization, setSelectedLegalization] = useState<ExpenseLegalization | null>(null);

  const { data, isLoading } = useQuery<{ data: FinanceData }>({
    queryKey: ['finance-expenses-board'],
    queryFn: async () => {
      const res = await fetch('/api/tools/finance-expenses-board');
      if (!res.ok) throw new Error('Error al cargar datos financieros');
      return res.json();
    },
  });

  const dashboard = data?.data;

  const filteredPerDiems = useMemo(() => {
    if (!dashboard?.perDiems) return [];
    return dashboard.perDiems.filter((p) => {
      const matchSearch =
        search === '' ||
        p.destination.toLowerCase().includes(search.toLowerCase()) ||
        (p.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.projects?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [dashboard?.perDiems, search, filterStatus]);

  const filteredLegalizations = useMemo(() => {
    if (!dashboard?.legalizations) return [];
    return dashboard.legalizations.filter((l) => {
      return (
        search === '' ||
        (l.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.per_diem_requests?.destination || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.notes || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.legalizations, search]);

  const filteredPayments = useMemo(() => {
    if (!dashboard?.payments) return [];
    return dashboard.payments.filter((p) => {
      return (
        search === '' ||
        p.beneficiary_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.bank_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.transaction_reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.projects?.name || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.payments, search]);

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
            <Wallet className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Control de Viáticos y Flujo de Fondos
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Administración de comisiones de campo, legalizaciones de gastos y comprobantes de egreso
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Anticipos Desembolsados</span>
              <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalDisbursedCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Fondos entregados para comisiones</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Comisiones por Legalizar</span>
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.pendingLegalizationsCount ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Anticipos pendientes de rendición</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Gastos Legalizados</span>
              <Receipt className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalLegalizedCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Soportes de gasto procesados</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Egresos Pagados</span>
              <CreditCard className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalPaymentsCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Total comprobantes bancarios</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('perDiems')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'perDiems'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <MapPin className="w-4 h-4" strokeWidth={1.75} />
            Anticipos de Viáticos
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.perDiems.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('legalizations')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'legalizations'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Receipt className="w-4 h-4" strokeWidth={1.75} />
            Rendición y Legalización
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.legalizations.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <CreditCard className="w-4 h-4" strokeWidth={1.75} />
            Comprobantes de Pago
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.payments.length ?? 0}
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
                activeTab === 'perDiems'
                  ? 'Buscar por destino, comisionado o proyecto...'
                  : activeTab === 'legalizations'
                  ? 'Buscar por comisionado o destino...'
                  : 'Buscar por beneficiario, banco o referencia...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
            />
          </div>

          {activeTab === 'perDiems' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">Todos los estados</option>
                <option value="requested">Solicitados</option>
                <option value="approved">Aprobados</option>
                <option value="disbursed">En Campo (Desembolsados)</option>
                <option value="legalized">Legalizados</option>
                <option value="closed">Cerrados</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Per Diems */}
        {activeTab === 'perDiems' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando anticipos de viáticos...</div>
            ) : filteredPerDiems.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron solicitudes de viáticos.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Comisionado</th>
                      <th className="py-3 px-4">Destino / Fechas</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Días</th>
                      <th className="py-3 px-4">Total Anticipo</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPerDiems.map((p) => {
                      const st = STATUS_PER_DIEM_LABELS[p.status] ?? { label: p.status, badge: 'badge-outline' };
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <p className="font-semibold text-text-primary">{p.users?.full_name || 'Colaborador'}</p>
                            <p className="text-xs text-text-muted">{p.users?.email}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-medium text-text-primary">
                              <MapPin className="w-3.5 h-3.5 text-text-muted" />
                              {p.destination}
                            </div>
                            <p className="text-xs text-text-muted font-mono mt-0.5">
                              {p.departure_date} al {p.return_date}
                            </p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-text-secondary">
                              {p.projects?.cost_center || 'General'}
                            </span>
                            <p className="text-xs text-text-muted truncate max-w-[130px]">
                              {p.projects?.name || 'Comisión'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-center">
                            {p.estimated_days}d
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(p.total_requested) || 0)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedPerDiem(p)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Ver presupuesto →
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

        {/* Tab 2: Legalizations */}
        {activeTab === 'legalizations' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando legalizaciones...</div>
            ) : filteredLegalizations.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron legalizaciones registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Comisionado</th>
                      <th className="py-3 px-4">Anticipo Recibido</th>
                      <th className="py-3 px-4">Total Ejecutado</th>
                      <th className="py-3 px-4">Diferencia</th>
                      <th className="py-3 px-4 text-center">Comprobantes</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLegalizations.map((l) => {
                      const st = STATUS_LEG_LABELS[l.status] ?? { label: l.status, badge: 'badge-outline' };
                      const isFavorEmpresa = l.balance_type === 'empresa' || (Number(l.total_received) > Number(l.total_spent));
                      return (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {l.created_at ? new Date(l.created_at).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <p className="font-semibold text-text-primary">{l.users?.full_name || 'Colaborador'}</p>
                            <p className="text-xs text-text-muted">{l.per_diem_requests?.destination || 'Comisión'}</p>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-text-secondary whitespace-nowrap">
                            {formatCOP(Number(l.total_received) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(l.total_spent) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono whitespace-nowrap">
                            <span className={`font-semibold text-xs ${isFavorEmpresa ? 'text-emerald-800' : 'text-amber-800'}`}>
                              {formatCOP(Math.abs(Number(l.balance_difference) || 0))}
                            </span>
                            <p className="text-[10px] text-text-muted">
                              {isFavorEmpresa ? 'Saldo a reintegrar' : 'Saldo a favor colab.'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono text-center font-bold">
                            {l.receipt_count} facturas
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
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

        {/* Tab 3: Payments */}
        {activeTab === 'payments' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando comprobantes...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron comprobantes de egreso registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha Pago</th>
                      <th className="py-3 px-4">Beneficiario</th>
                      <th className="py-3 px-4">Concepto / Tipo</th>
                      <th className="py-3 px-4">Banco / Referencia</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Monto Pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPayments.map((pm) => (
                      <tr key={pm.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {pm.payment_date || (pm.created_at ? new Date(pm.created_at).toLocaleDateString('es-CO') : '—')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-semibold text-text-primary">{pm.beneficiary_name}</p>
                          <p className="text-xs text-text-muted font-mono">{pm.beneficiary_doc || 'Sin documento'}</p>
                        </td>
                        <td className="py-3 px-4 capitalize text-text-secondary whitespace-nowrap">
                          {pm.payment_type.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="text-xs font-semibold text-text-primary">{pm.bank_name || 'Bancolombia'}</p>
                          <p className="text-xs text-text-muted font-mono">{pm.transaction_reference || 'Ref: N/A'}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                          {pm.projects?.cost_center || 'General'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                          {formatCOP(Number(pm.amount) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Presupuesto Viático */}
      {selectedPerDiem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Desglose de Anticipo</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">Comisión a {selectedPerDiem.destination}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPerDiem(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">Comisionado</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedPerDiem.users?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Proyecto</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedPerDiem.projects?.name || 'General'}</p>
              </div>
              <div>
                <p className="text-text-muted">Duración Estimada</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedPerDiem.estimated_days} días ({selectedPerDiem.departure_date} al {selectedPerDiem.return_date})</p>
              </div>
              <div>
                <p className="text-text-muted">Estado</p>
                <p className="font-semibold text-primary mt-0.5 capitalize">{selectedPerDiem.status}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs p-3.5 bg-gray-50 rounded-xl border border-border">
              <div className="flex justify-between">
                <span className="text-text-muted">Presupuesto Alojamiento / Hotel:</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedPerDiem.lodging_budget) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Presupuesto Alimentación:</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedPerDiem.food_budget) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Transporte / Pasajes:</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedPerDiem.transport_budget) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Combustible y Peajes:</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedPerDiem.tolls_fuel_budget) || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold text-sm text-text-primary">
                <span>Total Anticipo Solicitado:</span>
                <span className="font-mono text-primary">{formatCOP(Number(selectedPerDiem.total_requested) || 0)}</span>
              </div>
            </div>

            {selectedPerDiem.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Observaciones de la Comisión</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedPerDiem.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPerDiem(null)}
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
