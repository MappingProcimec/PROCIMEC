'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  ShoppingBag,
  Truck,
  Search,
  Filter,
  Plus,
  Download,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  Eye,
  X,
  Save,
  RotateCw,
  CreditCard,
  Package,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type { Supplier } from '@/types';

const STATUS_SUPPLIER_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: 'Activo', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  inactive: { label: 'Inactivo', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  blocked: { label: 'Bloqueado', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
};

const CATEGORY_OPTIONS = [
  'Materiales Pétreos',
  'Ferretería y Herramientas',
  'Equipos y Andamios',
  'Cementos y Concretos',
  'Ferretería y Tornillería',
  'Combustibles y Lubricantes',
  'EPP y Dotación de Seguridad',
  'Repuestos y Mantenimiento',
  'Alquiler de Maquinaria',
  'Servicios Especializados / Laboratorio',
  'Papelería y Oficina',
  'Otro',
];

const PAYMENT_TERMS_OPTIONS = [
  'Contado',
  'Anticipo 50% y Saldo contra Entrega',
  'Crédito 15 días',
  'Crédito 30 días',
  'Crédito 45 días',
  'Crédito 60 días',
];

const BANK_OPTIONS = [
  'Bancolombia',
  'Banco de Bogotá',
  'Davivienda',
  'Banco BBVA',
  'Banco de Occidente',
  'Banco Popular',
  'Banco Agrario',
  'Banco AV Villas',
  'Scotiabank Colpatria',
  'Otro Banco',
];

export default function PurchasingSuppliersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modales
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    suppliers: Supplier[];
    stats: {
      totalSuppliers: number;
      activeSuppliers: number;
      creditSuppliersCount: number;
      ordersIssuedCount: number;
    };
  }>({
    queryKey: ['purchasing-suppliers', statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`/api/tools/purchasing-suppliers?${params.toString()}`);
      if (!res.ok) throw new Error('Error al consultar proveedores');
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const suppliers = data?.suppliers ?? [];
  const stats = data?.stats ?? {
    totalSuppliers: 0,
    activeSuppliers: 0,
    creditSuppliersCount: 0,
    ordersIssuedCount: 0,
  };

  // Filtrado local ágil por texto
  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      return (
        s.company_name.toLowerCase().includes(q) ||
        (s.nit && s.nit.toLowerCase().includes(q)) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.bank_name && s.bank_name.toLowerCase().includes(q))
      );
    });
  }, [suppliers, search]);

  // Mutación para Guardar / Actualizar
  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      const isUpdating = Boolean(payload.id);
      const url = '/api/tools/purchasing-suppliers';
      const method = isUpdating ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al guardar proveedor');
      return resJson;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-suppliers'] });
      setIsEditModalOpen(false);
      setEditingSupplier(null);
      if (selectedSupplier && resData.supplier) {
        setSelectedSupplier(resData.supplier);
      }
      setFeedbackMsg({ text: resData.message || 'Proveedor guardado con éxito.', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setFeedbackMsg({ text: msg, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  const handleOpenCreate = () => {
    setEditingSupplier({
      company_name: '',
      nit: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      category: 'Materiales Pétreos',
      payment_terms: 'Contado',
      bank_name: 'Bancolombia',
      bank_account_type: 'Ahorros',
      bank_account_number: '',
      status: 'active',
      notes: '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier({ ...supplier });
    setIsEditModalOpen(true);
  };

  const handleExportCSV = () => {
    if (filteredSuppliers.length === 0) return;

    const headers = [
      'Razón Social',
      'NIT',
      'Persona de Contacto',
      'Correo Electrónico',
      'Teléfono',
      'Ciudad',
      'Categoría de Suministro',
      'Condiciones de Pago',
      'Banco',
      'Tipo de Cuenta',
      'Número de Cuenta',
      'Estado',
      'Órdenes Asociadas',
    ];

    const rows = filteredSuppliers.map((s) => [
      `"${s.company_name.replace(/"/g, '""')}"`,
      `"${(s.nit || '').replace(/"/g, '""')}"`,
      `"${(s.contact_name || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.city || '').replace(/"/g, '""')}"`,
      `"${(s.category || '').replace(/"/g, '""')}"`,
      `"${(s.payment_terms || '').replace(/"/g, '""')}"`,
      `"${(s.bank_name || '').replace(/"/g, '""')}"`,
      `"${(s.bank_account_type || '').replace(/"/g, '""')}"`,
      `"${(s.bank_account_number || '').replace(/"/g, '""')}"`,
      `"${STATUS_SUPPLIER_CONFIG[s.status]?.label || s.status}"`,
      s.purchase_orders_count || 0,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Directorio_Proveedores_PROCIMEC_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Cabecera Institucional Anti-Slop (Ley 5) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div className="space-y-1">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2.5 mt-2">
              <ShoppingBag className="w-6 h-6 text-accent flex-shrink-0" strokeWidth={1.75} />
              Directorio y Gestión de Proveedores
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Directorio maestro, homologación técnica, condiciones comerciales, cuentas bancarias e historial de órdenes de proveedores.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredSuppliers.length === 0}
              className="btn-secondary text-xs px-3.5 py-2 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Descargar directorio en formato CSV"
            >
              <Download className="w-4 h-4 text-text-secondary" strokeWidth={1.75} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-accent text-xs px-4 py-2 font-bold flex items-center gap-2 text-primary-900 shadow-sm cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4 text-primary-900" strokeWidth={2.2} />
              <span>Nuevo Proveedor</span>
            </button>
          </div>
        </div>

        {/* Mensaje de Feedback */}
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" strokeWidth={2} />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Bloque de KPIs Sobrios */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Proveedores</p>
              <p className="text-2xl font-bold font-mono text-text-primary mt-1">{stats.totalSuppliers}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-accent">
              <Truck className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Proveedores Activos</p>
              <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">{stats.activeSuppliers}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Líneas de Crédito</p>
              <p className="text-2xl font-bold font-mono text-cyan-700 mt-1">{stats.creditSuppliersCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
              <CreditCard className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Órdenes Emitidas</p>
              <p className="text-2xl font-bold font-mono text-primary-700 mt-1">{stats.ordersIssuedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700">
              <Package className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-3 sm:p-4 border border-border space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Razón Social, NIT, Contacto, Ciudad, Categoría o Banco..."
                className="input pl-10 text-xs sm:text-sm w-full font-sans"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="w-full sm:w-44">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input text-xs w-full cursor-pointer"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="blocked">Bloqueados</option>
                </select>
              </div>

              <div className="w-full sm:w-56">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input text-xs w-full cursor-pointer"
                >
                  <option value="all">Todas las Categorías</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="p-2 border border-border rounded-xl text-text-muted hover:text-accent hover:border-accent/40 bg-surface transition-colors cursor-pointer flex-shrink-0"
                title="Refrescar listado"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabla Técnica de Proveedores */}
        <div className="card border border-border overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted space-y-3">
              <RotateCw className="w-7 h-7 text-accent animate-spin mx-auto" strokeWidth={1.75} />
              <p className="text-xs font-mono">Cargando directorio de proveedores...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Truck className="w-8 h-8 text-text-muted mx-auto" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-primary">No se encontraron proveedores</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn-accent text-xs px-3.5 py-1.5 font-bold text-primary-900 mt-2 cursor-pointer"
              >
                Registrar Primer Proveedor
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-border">
                <thead className="bg-surface/70 text-text-secondary uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Razón Social / Proveedor</th>
                    <th className="px-4 py-3">NIT / Identificación</th>
                    <th className="px-4 py-3">Contacto / Teléfono</th>
                    <th className="px-4 py-3">Categoría & Ubicación</th>
                    <th className="px-4 py-3">Condiciones de Pago</th>
                    <th className="px-4 py-3">Información Bancaria</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Órdenes</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredSuppliers.map((supplier) => {
                    const statusCfg = STATUS_SUPPLIER_CONFIG[supplier.status] || {
                      label: supplier.status,
                      badge: 'bg-gray-100 text-gray-800',
                    };

                    return (
                      <tr key={supplier.id} className="hover:bg-surface/50 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-text-primary text-sm group-hover:text-primary transition-colors">
                            {supplier.company_name}
                          </div>
                          {supplier.notes && (
                            <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-xs">
                              {supplier.notes}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-mono text-text-secondary font-medium">
                          {supplier.nit}
                        </td>

                        <td className="px-4 py-3.5">
                          {supplier.contact_name ? (
                            <div>
                              <div className="font-semibold text-text-primary">{supplier.contact_name}</div>
                              {supplier.phone && (
                                <div className="text-[11px] font-mono text-text-secondary mt-0.5 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                                  <span>{supplier.phone}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Sin contacto</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="badge badge-accent text-[11px] font-medium">
                            {supplier.category || 'General'}
                          </span>
                          {supplier.city && (
                            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1 font-sans">
                              <MapPin className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                              <span>{supplier.city}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-text-secondary">
                          <span className="font-medium">{supplier.payment_terms || 'Contado'}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          {supplier.bank_name ? (
                            <div>
                              <div className="font-semibold text-text-primary">{supplier.bank_name}</div>
                              <div className="text-[11px] font-mono text-text-muted mt-0.5">
                                {supplier.bank_account_type ? `${supplier.bank_account_type}: ` : ''}
                                {supplier.bank_account_number || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Sin datos bancarios</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.badge}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                            {supplier.purchase_orders_count || 0}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSupplier(supplier)}
                              className="p-1.5 text-text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
                              title="Ver Ficha Técnica y Bancaria"
                            >
                              <Eye className="w-4 h-4" strokeWidth={1.75} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(supplier)}
                              className="p-1.5 text-text-muted hover:text-accent hover:bg-surface rounded-lg transition-colors cursor-pointer"
                              title="Editar Información"
                            >
                              <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 1: FICHA TÉCNICA Y BANCARIA DEL PROVEEDOR             */}
      {/* ─────────────────────────────────────────────────────────── */}
      {selectedSupplier && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedSupplier(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-border flex items-start justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-6 h-6 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg sm:text-xl leading-tight">
                    {selectedSupplier.company_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-text-muted font-semibold">
                      NIT: {selectedSupplier.nit}
                    </span>
                    <span className="text-text-muted text-xs">·</span>
                    <span className="text-xs text-text-secondary">
                      {selectedSupplier.category || 'Materiales'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Contenido de la Ficha */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Bloque 1: Contacto y Ubicación */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Información Comercial y Representante
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface/40 p-4 rounded-xl border border-border/60">
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Asesor / Contacto:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedSupplier.contact_name || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Correo Electrónico:</p>
                    <p className="font-mono text-text-primary mt-0.5 break-all">
                      {selectedSupplier.email ? (
                        <a href={`mailto:${selectedSupplier.email}`} className="text-primary hover:underline">
                          {selectedSupplier.email}
                        </a>
                      ) : (
                        'No registrado'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Teléfono / WhatsApp:</p>
                    <p className="font-mono text-text-primary mt-0.5">
                      {selectedSupplier.phone ? (
                        <a href={`tel:${selectedSupplier.phone}`} className="text-primary hover:underline">
                          {selectedSupplier.phone}
                        </a>
                      ) : (
                        'No registrado'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Ciudad / Sede:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedSupplier.city || 'No registrada'}</p>
                    {selectedSupplier.address && (
                      <p className="text-xs text-text-secondary truncate">{selectedSupplier.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Información Bancaria Destacada */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Información Bancaria para Pagos y Transferencias
                </h4>
                <div className="bg-primary-900 text-white p-4 rounded-xl border border-primary-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70 uppercase tracking-wider font-semibold">Entidad Financiera</span>
                    <span className="font-bold text-accent text-sm sm:text-base">{selectedSupplier.bank_name || 'Sin banco asignado'}</span>
                  </div>
                  <div className="pt-2 border-t border-primary-800 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-white/60">Tipo de Cuenta</p>
                      <p className="font-semibold text-xs mt-0.5">{selectedSupplier.bank_account_type || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/60">Número de Cuenta</p>
                      <p className="font-mono text-sm font-bold text-white mt-0.5 tracking-wider">
                        {selectedSupplier.bank_account_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Condiciones y Notas */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Condiciones Comerciales y Observaciones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface/40 p-4 rounded-xl border border-border/60">
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Condiciones de Pago:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedSupplier.payment_terms || 'Contado'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Estado:</p>
                    <p className="mt-0.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_SUPPLIER_CONFIG[selectedSupplier.status]?.badge || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_SUPPLIER_CONFIG[selectedSupplier.status]?.label || selectedSupplier.status}
                      </span>
                    </p>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-border">
                    <p className="text-[11px] text-text-muted font-medium">Notas Técnicas:</p>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      {selectedSupplier.notes || 'Sin observaciones registradas.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-4 bg-surface border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="btn-secondary text-xs px-3.5 py-1.5 font-semibold cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  const toEdit = selectedSupplier;
                  setSelectedSupplier(null);
                  handleOpenEdit(toEdit);
                }}
                className="btn-accent text-xs px-4 py-1.5 font-bold text-primary-900 flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary-900" strokeWidth={2} />
                <span>Editar Proveedor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CREACIÓN / EDICIÓN DE PROVEEDOR                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {isEditModalOpen && editingSupplier && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-5 h-5 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-base sm:text-lg">
                    {editingSupplier.id ? 'Editar Información de Proveedor' : 'Registrar y Homologar Proveedor'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Completa la ficha técnica, datos tributarios, bancarios y comerciales para compras.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Formulario en Rejilla 2 Columnas (Ergonomía Industrial Ley 5) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(editingSupplier);
              }}
              className="p-6 overflow-y-auto space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Razón Social */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Razón Social / Nombre Comercial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.company_name || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, company_name: e.target.value })}
                    placeholder="Ej. Ultracem SAS"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* NIT */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    NIT / Identificación Tributaria <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSupplier.nit || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, nit: e.target.value })}
                    placeholder="Ej. 900.345.678-4"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Categoría de Suministro
                  </label>
                  <select
                    value={editingSupplier.category || 'Materiales Pétreos'}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, category: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contacto */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Persona / Asesor de Contacto
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.contact_name || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_name: e.target.value })}
                    placeholder="Ej. Asesor Comercial / Despachos"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Correo Electrónico */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    placeholder="ventas@proveedor.com"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    placeholder="Ej. 3001234567"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Ciudad / Municipio
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.city || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, city: e.target.value })}
                    placeholder="Ej. Barranquilla"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Dirección */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Dirección de Despacho / Planta
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.address || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                    placeholder="Ej. Vía 40 # 73-290"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Condiciones de Pago */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Condiciones de Pago Habituales
                  </label>
                  <select
                    value={editingSupplier.payment_terms || 'Contado'}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, payment_terms: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Estado de Homologación
                  </label>
                  <select
                    value={editingSupplier.status || 'active'}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        status: e.target.value as 'active' | 'inactive' | 'blocked',
                      })
                    }
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>

                {/* ── Subsección Bancaria ── */}
                <div className="sm:col-span-2 pt-2 border-t border-border">
                  <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                    Datos Bancarios para Giros y Pagos
                  </p>
                </div>

                {/* Banco */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Entidad Bancaria
                  </label>
                  <select
                    value={editingSupplier.bank_name || 'Bancolombia'}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_name: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Cuenta */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={editingSupplier.bank_account_type || 'Ahorros'}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_account_type: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    <option value="Ahorros">Cuenta de Ahorros</option>
                    <option value="Corriente">Cuenta Corriente</option>
                  </select>
                </div>

                {/* Número de Cuenta */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Número de Cuenta Bancaria
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.bank_account_number || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, bank_account_number: e.target.value })}
                    placeholder="Ej. 123-456789-01"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Observaciones */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Notas y Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={editingSupplier.notes || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                    placeholder="Descuentos comerciales, tiempos de entrega acordados o calificaciones..."
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary text-xs px-3.5 py-2 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-accent text-xs px-5 py-2 font-bold text-primary-900 flex items-center gap-2 cursor-pointer shadow-sm hover:brightness-105 disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <RotateCw className="w-4 h-4 animate-spin text-primary-900" strokeWidth={2} />
                  ) : (
                    <Save className="w-4 h-4 text-primary-900" strokeWidth={2} />
                  )}
                  <span>{editingSupplier.id ? 'Guardar Cambios' : 'Registrar Proveedor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
