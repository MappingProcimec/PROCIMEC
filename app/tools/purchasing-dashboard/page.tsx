'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Package,
  Layers,
  Calendar,
  Building2,
  DollarSign,
  Star,
  FileText,
  User,
  ExternalLink,
  Info
} from 'lucide-react';

interface PurchaseRequest {
  id: string;
  title: string;
  category: string;
  priority: string;
  required_date: string | null;
  items: Array<{ item?: string; description?: string; quantity?: number; unit?: string }>;
  justification: string;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface PurchaseOrder {
  id: string;
  order_code: string;
  supplier_name: string;
  supplier_nit: string | null;
  supplier_contact: string | null;
  total_amount: number;
  currency: string;
  delivery_deadline: string | null;
  payment_terms: string | null;
  attachment_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface SupplierEvaluation {
  id: string;
  supplier_name: string;
  quality_score: number;
  delivery_time_score: number;
  service_score: number;
  overall_rating: number;
  comments: string | null;
  recommend_supplier: boolean;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
}

interface PurchasingDashboardData {
  stats: {
    pendingRequests: number;
    activeOrders: number;
    totalCommittedCOP: number;
    evaluatedSuppliers: number;
  };
  requests: PurchaseRequest[];
  orders: PurchaseOrder[];
  evaluations: SupplierEvaluation[];
}

const STATUS_REQ_LABELS: Record<string, { label: string; badge: string }> = {
  pending: { label: 'Pendiente', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  in_quotation: { label: 'En Cotización', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  approved: { label: 'Aprobada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  purchased: { label: 'Comprada', badge: 'bg-slate-100 text-slate-800 border border-slate-300' },
  rejected: { label: 'Rechazada', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const STATUS_ORDER_LABELS: Record<string, { label: string; badge: string }> = {
  issued: { label: 'Emitida', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  partially_received: { label: 'Recibida Parcial', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  completed: { label: 'Completada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  cancelled: { label: 'Cancelada', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: 'text-red-700 bg-red-50 border-red-200' },
  alta: { label: 'Alta', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  media: { label: 'Media', color: 'text-blue-800 bg-blue-50 border-blue-200' },
  baja: { label: 'Baja', color: 'text-slate-700 bg-slate-50 border-slate-200' },
};

export default function PurchasingDashboardPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'suppliers'>('requests');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  const { data, isLoading, error } = useQuery<{ data: PurchasingDashboardData }>({
    queryKey: ['purchasing-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/tools/purchasing-dashboard');
      if (!res.ok) throw new Error('Error al cargar datos de compras');
      return res.json();
    },
  });

  const dashboard = data?.data;

  const filteredRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const matchSearch =
        search === '' ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.justification || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [dashboard?.requests, search, filterStatus]);

  const filteredOrders = useMemo(() => {
    if (!dashboard?.orders) return [];
    return dashboard.orders.filter((o) => {
      const matchSearch =
        search === '' ||
        o.order_code.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.supplier_nit || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.projects?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [dashboard?.orders, search, filterStatus]);

  const filteredSuppliers = useMemo(() => {
    if (!dashboard?.evaluations) return [];
    return dashboard.evaluations.filter((ev) => {
      return (
        search === '' ||
        ev.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (ev.comments || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.evaluations, search]);

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
            <ShoppingBag className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Gestión y Control de Compras
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Monitoreo centralizado de requerimientos, órdenes emitidas y evaluación de proveedores
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Requerimientos Pendientes</span>
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.pendingRequests ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">En espera o en cotización</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Órdenes en Tránsito</span>
              <Package className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.activeOrders ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Emitidas o recibidas parcial</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Inversión Comprometida</span>
              <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalCommittedCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Acumulado en órdenes de compra</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Proveedores Evaluados</span>
              <Star className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.evaluatedSuppliers ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Calificaciones registradas</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('requests'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            Requerimientos
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.requests.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('orders'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4" strokeWidth={1.75} />
            Órdenes de Compra
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.orders.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('suppliers'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'suppliers'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Star className="w-4 h-4" strokeWidth={1.75} />
            Evaluación de Proveedores
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.evaluations.length ?? 0}
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
                activeTab === 'requests'
                  ? 'Buscar por título, proyecto o justificación...'
                  : activeTab === 'orders'
                  ? 'Buscar por código, proveedor, NIT...'
                  : 'Buscar por nombre de proveedor...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
            />
          </div>

          {activeTab !== 'suppliers' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">Todos los estados</option>
                {activeTab === 'requests' ? (
                  <>
                    <option value="pending">Pendientes</option>
                    <option value="in_quotation">En Cotización</option>
                    <option value="approved">Aprobadas</option>
                    <option value="purchased">Compradas</option>
                    <option value="rejected">Rechazadas</option>
                  </>
                ) : (
                  <>
                    <option value="issued">Emitidas</option>
                    <option value="partially_received">Recibidas Parcial</option>
                    <option value="completed">Completadas</option>
                    <option value="cancelled">Canceladas</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Requests */}
        {activeTab === 'requests' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando requerimientos...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron requerimientos registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Título / Detalle</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Prioridad</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRequests.map((r) => {
                      const st = STATUS_REQ_LABELS[r.status] ?? { label: r.status, badge: 'badge-outline' };
                      const pr = PRIORITY_LABELS[r.priority] ?? { label: r.priority, color: 'text-gray-700 bg-gray-50' };
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-text-primary truncate">{r.title}</p>
                            <p className="text-xs text-text-muted truncate capitalize">{r.category}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-primary">
                              {r.projects?.cost_center || 'General'}
                            </span>
                            <p className="text-xs text-text-muted truncate max-w-[140px]">
                              {r.projects?.name || 'Área Administrativa'}
                            </p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${pr.color}`}>
                              {pr.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(r)}
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

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando órdenes de compra...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron órdenes de compra registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4">Plazo Entrega</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((o) => {
                      const st = STATUS_ORDER_LABELS[o.status] ?? { label: o.status, badge: 'badge-outline' };
                      return (
                        <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                            {o.order_code}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-text-primary truncate">{o.supplier_name}</p>
                            <p className="text-xs text-text-muted font-mono truncate">{o.supplier_nit || 'Sin NIT'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-text-secondary">
                              {o.projects?.cost_center || 'General'}
                            </span>
                            <p className="text-xs text-text-muted truncate max-w-[140px]">
                              {o.projects?.name || 'Administración'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(o.total_amount) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {o.delivery_deadline ? new Date(o.delivery_deadline + 'T00:00:00').toLocaleDateString('es-CO') : 'Inmediato'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(o)}
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

        {/* Tab 3: Suppliers */}
        {activeTab === 'suppliers' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando evaluaciones...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron evaluaciones de proveedores.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4 text-center">Calidad</th>
                      <th className="py-3 px-4 text-center">Tiempos</th>
                      <th className="py-3 px-4 text-center">Servicio</th>
                      <th className="py-3 px-4 text-center">Promedio</th>
                      <th className="py-3 px-4">Recomendado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSuppliers.map((ev) => (
                      <tr key={ev.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CO') : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary">
                          {ev.supplier_name}
                          {ev.comments && <p className="text-xs text-text-muted font-normal mt-0.5 truncate max-w-sm">{ev.comments}</p>}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                          {ev.quality_score}/5
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                          {ev.delivery_time_score}/5
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                          {ev.service_score}/5
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">
                            ★ {Number(ev.overall_rating || ((ev.quality_score + ev.delivery_time_score + ev.service_score) / 3)).toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {ev.recommend_supplier ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-800 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Recomendado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-800 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              Observado
                            </span>
                          )}
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

      {/* Modal Detalle Requerimiento */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Detalle de Solicitud</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedRequest.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">Proyecto</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedRequest.projects?.name || 'General'}</p>
              </div>
              <div>
                <p className="text-text-muted">Solicitante</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedRequest.users?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Categoría</p>
                <p className="font-semibold text-text-primary mt-0.5 capitalize">{selectedRequest.category}</p>
              </div>
              <div>
                <p className="text-text-muted">Fecha Requerida</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedRequest.required_date || 'No especificada'}</p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <p className="text-text-muted">Justificación</p>
              <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                {selectedRequest.justification || 'Sin justificación registrada.'}
              </div>
            </div>

            {selectedRequest.items && selectedRequest.items.length > 0 && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted font-semibold">Ítems Solicitados</p>
                <ul className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {selectedRequest.items.map((it, idx) => (
                    <li key={idx} className="p-2.5 flex justify-between bg-white">
                      <span className="text-text-primary font-medium">{it.item || it.description || 'Ítem'}</span>
                      <span className="font-mono text-text-muted">{it.quantity || 1} {it.unit || 'uds'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Orden de Compra */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">{selectedOrder.order_code}</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedOrder.supplier_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">NIT / Identificación</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedOrder.supplier_nit || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Contacto Proveedor</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.supplier_contact || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Monto Total</p>
                <p className="font-mono font-bold text-base text-primary mt-0.5">{formatCOP(Number(selectedOrder.total_amount) || 0)}</p>
              </div>
              <div>
                <p className="text-text-muted">Condiciones de Pago</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.payment_terms || 'Contado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Fecha Límite Entrega</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedOrder.delivery_deadline || 'Inmediata'}</p>
              </div>
              <div>
                <p className="text-text-muted">Proyecto Asignado</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.projects?.name || 'Administración'}</p>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Observaciones y Términos</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedOrder.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              {selectedOrder.attachment_url ? (
                <a
                  href={selectedOrder.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver soporte / Cotización
                </a>
              ) : <span />}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
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
