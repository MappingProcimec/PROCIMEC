'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Calculator,
  Receipt,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Building2,
  Calendar,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';

interface InvoiceFiling {
  id: string;
  supplier_name: string;
  supplier_nit: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  withholding_amount: number;
  total_amount: number;
  payment_status: string;
  payment_due_days: number | null;
  status: string;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface BillingSupport {
  id: string;
  client_name: string;
  cut_period_start: string;
  cut_period_end: string;
  delivered_ml: number | null;
  delivered_m2: number | null;
  amount_to_bill: number;
  acta_number: string | null;
  approver_client_name: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface AccountingData {
  stats: {
    totalPayablesCOP: number;
    pendingInvoicesCount: number;
    totalReceivablesCOP: number;
    pendingBillingActasCount: number;
  };
  invoices: InvoiceFiling[];
  billingSupports: BillingSupport[];
}

const STATUS_INVOICE_LABELS: Record<string, { label: string; badge: string }> = {
  filed: { label: 'Radicada', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  caused: { label: 'Causada', badge: 'bg-purple-100/80 text-purple-900 border border-purple-300' },
  scheduled: { label: 'Programada Pago', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  paid: { label: 'Pagada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  rejected: { label: 'Rechazada', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const STATUS_ACTA_LABELS: Record<string, { label: string; badge: string }> = {
  ready_to_invoice: { label: 'Lista para Facturar', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  invoiced: { label: 'Facturada al Cliente', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  collected: { label: 'Cobrada / Pagada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
};

export default function AccountingInvoicesBoardPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'supports'>('invoices');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceFiling | null>(null);
  const [selectedActa, setSelectedActa] = useState<BillingSupport | null>(null);

  const { data, isLoading } = useQuery<{ data: AccountingData }>({
    queryKey: ['accounting-invoices-board'],
    queryFn: async () => {
      const res = await fetch('/api/tools/accounting-invoices-board');
      if (!res.ok) throw new Error('Error al cargar datos contables');
      return res.json();
    },
  });

  const dashboard = data?.data;

  const filteredInvoices = useMemo(() => {
    if (!dashboard?.invoices) return [];
    return dashboard.invoices.filter((inv) => {
      const matchSearch =
        search === '' ||
        inv.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        (inv.supplier_nit || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.projects?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [dashboard?.invoices, search, filterStatus]);

  const filteredSupports = useMemo(() => {
    if (!dashboard?.billingSupports) return [];
    return dashboard.billingSupports.filter((s) => {
      const matchSearch =
        search === '' ||
        s.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.acta_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.projects?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [dashboard?.billingSupports, search, filterStatus]);

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
            <Calculator className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Control de Facturación y Radicaciones
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Gestión de facturas de proveedores radicadas para pago y actas de corte de obra aprobadas a clientes
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cuentas por Pagar</span>
              <Receipt className="w-4 h-4 text-red-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalPayablesCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Facturas proveedores pendientes</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Facturas por Causar/Pagar</span>
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.pendingInvoicesCount ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Documentos en trámite contable</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Por Facturar a Clientes</span>
              <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalReceivablesCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Actas de obra listas para cobro</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cortes de Obra Activos</span>
              <FileSpreadsheet className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.pendingBillingActasCount ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Avances técnicos certificados</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('invoices'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Receipt className="w-4 h-4" strokeWidth={1.75} />
            Facturas de Proveedores
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.invoices.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('supports'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'supports'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} />
            Actas de Corte para Facturar
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.billingSupports.length ?? 0}
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
                activeTab === 'invoices'
                  ? 'Buscar por proveedor, factura, NIT o proyecto...'
                  : 'Buscar por cliente, número de acta o proyecto...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">Todos los estados</option>
              {activeTab === 'invoices' ? (
                <>
                  <option value="filed">Radicadas</option>
                  <option value="caused">Causadas</option>
                  <option value="scheduled">Programadas</option>
                  <option value="paid">Pagadas</option>
                  <option value="rejected">Rechazadas</option>
                </>
              ) : (
                <>
                  <option value="ready_to_invoice">Listas para Facturar</option>
                  <option value="invoiced">Facturadas</option>
                  <option value="collected">Cobradas</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Tab 1: Invoices */}
        {activeTab === 'invoices' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando facturas de proveedores...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron facturas radicadas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Factura N°</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Emisión / Vencimiento</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInvoices.map((inv) => {
                      const st = STATUS_INVOICE_LABELS[inv.status] ?? { label: inv.status, badge: 'badge-outline' };
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-text-primary truncate">{inv.supplier_name}</p>
                            <p className="text-xs text-text-muted font-mono">{inv.supplier_nit || 'Sin NIT'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-text-secondary">
                              {inv.projects?.cost_center || 'General'}
                            </span>
                            <p className="text-xs text-text-muted truncate max-w-[130px]">
                              {inv.projects?.name || 'Administración'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            <p>{inv.invoice_date}</p>
                            <p className="text-[11px] text-text-secondary">Vence: {inv.due_date}</p>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(inv.total_amount) || 0)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Ver desglose →
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

        {/* Tab 2: Billing Supports */}
        {activeTab === 'supports' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando actas de corte...</div>
            ) : filteredSupports.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron actas de corte de obra registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Acta N°</th>
                      <th className="py-3 px-4">Cliente / Proyecto</th>
                      <th className="py-3 px-4">Periodo de Corte</th>
                      <th className="py-3 px-4 text-center">Volumen Certificado</th>
                      <th className="py-3 px-4">Monto a Cobrar</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSupports.map((s) => {
                      const st = STATUS_ACTA_LABELS[s.status] ?? { label: s.status, badge: 'badge-outline' };
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                            {s.acta_number || 'S/N'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <p className="font-semibold text-text-primary">{s.client_name}</p>
                            <p className="text-xs text-text-muted">{s.projects?.name || 'Proyecto'}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {s.cut_period_start} al {s.cut_period_end}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-xs whitespace-nowrap">
                            {s.delivered_ml ? `${s.delivered_ml} ML` : ''}
                            {s.delivered_ml && s.delivered_m2 ? ' · ' : ''}
                            {s.delivered_m2 ? `${s.delivered_m2} m²` : ''}
                            {!s.delivered_ml && !s.delivered_m2 ? 'Por definir' : ''}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(s.amount_to_bill) || 0)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedActa(s)}
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
      </div>

      {/* Modal Desglose Factura Proveedor */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">{selectedInvoice.invoice_number}</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedInvoice.supplier_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">NIT Proveedor</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedInvoice.supplier_nit || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Proyecto / Centro Costos</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedInvoice.projects?.name || 'Administración'}</p>
              </div>
              <div>
                <p className="text-text-muted">Fecha de Emisión</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedInvoice.invoice_date}</p>
              </div>
              <div>
                <p className="text-text-muted">Fecha de Vencimiento</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedInvoice.due_date}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs p-3.5 bg-gray-50 rounded-xl border border-border">
              <div className="flex justify-between">
                <span className="text-text-muted">Subtotal:</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedInvoice.subtotal) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">IVA (+):</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedInvoice.tax_amount) || 0)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Retenciones en la Fuente (-):</span>
                <span className="font-mono font-medium">{formatCOP(Number(selectedInvoice.withholding_amount) || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold text-sm text-text-primary">
                <span>Total a Pagar:</span>
                <span className="font-mono text-primary">{formatCOP(Number(selectedInvoice.total_amount) || 0)}</span>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Observaciones de Radicación</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedInvoice.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              {selectedInvoice.attachment_url ? (
                <a
                  href={selectedInvoice.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver Factura PDF / Adjunto
                </a>
              ) : <span />}
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Acta de Obra */}
      {selectedActa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">{selectedActa.acta_number || 'Acta de Corte'}</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedActa.client_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActa(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">Proyecto</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedActa.projects?.name || 'Obra'}</p>
              </div>
              <div>
                <p className="text-text-muted">Aprobador / Interventoría</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedActa.approver_client_name || 'Pendiente'}</p>
              </div>
              <div>
                <p className="text-text-muted">Periodo Certificado</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedActa.cut_period_start} al {selectedActa.cut_period_end}</p>
              </div>
              <div>
                <p className="text-text-muted">Monto por Facturar</p>
                <p className="font-mono font-bold text-base text-primary mt-0.5">{formatCOP(Number(selectedActa.amount_to_bill) || 0)}</p>
              </div>
              <div>
                <p className="text-text-muted">Metros Lineales (ML)</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedActa.delivered_ml ?? 0} ML</p>
              </div>
              <div>
                <p className="text-text-muted">Área Subterránea (m²)</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedActa.delivered_m2 ?? 0} m²</p>
              </div>
            </div>

            {selectedActa.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Detalles del Corte de Obra</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedActa.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedActa(null)}
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
