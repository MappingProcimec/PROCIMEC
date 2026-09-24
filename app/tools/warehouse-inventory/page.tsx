'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Boxes,
  Package,
  Truck,
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  User,
  FolderGit2,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Box,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import type { EquipmentCategory, EquipmentStatus } from '@/types';

interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status: EquipmentStatus;
  calibration_date?: string | null;
  calibration_expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
  calibrationStatus: 'ok' | 'warning' | 'expired' | 'none';
  activeCheckout?: {
    id: string;
    project_id: string;
    checkout_date: string;
    expected_return_date?: string | null;
    responsible_name?: string | null;
    notes?: string | null;
    project?: {
      name: string;
      cost_center?: string;
      client?: string;
    };
    responsible_user?: {
      full_name: string;
      email: string;
    };
  } | null;
}

interface CheckoutItem {
  id: string;
  project_id: string;
  equipment_id: string;
  responsible_name?: string | null;
  checkout_date: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  status: 'active' | 'returned' | 'overdue';
  checklist?: Record<string, unknown>;
  notes?: string | null;
  return_notes?: string | null;
  created_at: string;
  equipment?: {
    code: string;
    name: string;
    category: EquipmentCategory;
    brand?: string | null;
    model?: string | null;
  };
  project?: {
    name: string;
    cost_center?: string;
    client?: string;
  };
  responsible_user?: {
    full_name: string;
    email: string;
  };
}

interface ConsumableItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  invoice_number?: string | null;
  entry_date: string;
  notes?: string | null;
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
}

interface ToolData {
  equipment: EquipmentItem[];
  checkouts: CheckoutItem[];
  consumables: ConsumableItem[];
  stats: {
    totalEquipment: number;
    availableCount: number;
    inFieldCount: number;
    maintenanceCount: number;
    calibrationAlertsCount: number;
    totalConsumablesEntries: number;
  };
}

async function fetchWarehouseToolData(): Promise<ToolData> {
  const res = await fetch('/api/tools/warehouse-inventory');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error cargando datos del kárdex');
  return json.data;
}

const CATEGORY_NAMES: Record<string, string> = {
  gpr: 'Georradar GPR',
  antenna: 'Antena GPR',
  gnss: 'Receptor GNSS/RTK',
  total_station: 'Estación Total',
  radiodetection: 'Localizador EM',
  vehicle: 'Vehículo / Dron',
  accessory: 'Accesorio / Odómetro',
  other: 'Otro Instrumental',
};

const STATUS_BADGES: Record<EquipmentStatus, { label: string; bg: string; text: string; border: string }> = {
  available: { label: 'En Bodega', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  in_field: { label: 'En Terreno', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  maintenance: { label: 'Mantenimiento', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  calibration: { label: 'Calibración', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  decommissioned: { label: 'Baja', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

export default function WarehouseInventoryToolPage() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'kardex' | 'consumables'>('inventory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-tool-data'],
    queryFn: fetchWarehouseToolData,
  });

  const equipmentList = data?.equipment ?? [];
  const checkouts = data?.checkouts ?? [];
  const consumables = data?.consumables ?? [];
  const stats = data?.stats ?? {
    totalEquipment: 0,
    availableCount: 0,
    inFieldCount: 0,
    maintenanceCount: 0,
    calibrationAlertsCount: 0,
    totalConsumablesEntries: 0,
  };

  // Filtrado de inventario
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      const q = search.toLowerCase();
      const matchSearch =
        eq.code.toLowerCase().includes(q) ||
        eq.name.toLowerCase().includes(q) ||
        (eq.brand && eq.brand.toLowerCase().includes(q)) ||
        (eq.model && eq.model.toLowerCase().includes(q)) ||
        (eq.serial_number && eq.serial_number.toLowerCase().includes(q)) ||
        (eq.activeCheckout?.project?.name && eq.activeCheckout.project.name.toLowerCase().includes(q)) ||
        (eq.activeCheckout?.responsible_name && eq.activeCheckout.responsible_name.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || eq.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || eq.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [equipmentList, search, statusFilter, categoryFilter]);

  // Filtrado de kárdex
  const filteredCheckouts = useMemo(() => {
    return checkouts.filter((chk) => {
      const q = search.toLowerCase();
      return (
        (chk.equipment?.code && chk.equipment.code.toLowerCase().includes(q)) ||
        (chk.equipment?.name && chk.equipment.name.toLowerCase().includes(q)) ||
        (chk.project?.name && chk.project.name.toLowerCase().includes(q)) ||
        (chk.responsible_name && chk.responsible_name.toLowerCase().includes(q))
      );
    });
  }, [checkouts, search]);

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Header Oficial */}
      <div className="bg-primary text-white border-b border-border shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Boxes className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Kárdex e Inventario Activo de Bodega
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Herramienta técnica de consolidación de instrumental, control de frentes de obra y kárdex histórico.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/forms/registro-equipo?mode=despacho"
                className="btn btn-sm bg-accent text-primary font-bold shadow-xs hover:bg-accent/90 text-xs px-3.5 py-2 flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Despachar Equipo</span>
              </Link>

              <Link
                href="/forms/registro-equipo?mode=retorno"
                className="btn btn-sm bg-white/10 hover:bg-white/20 text-white font-medium text-xs px-3 py-2 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reingreso</span>
              </Link>

              <Link
                href="/forms/registro-equipo?mode=alta"
                className="btn btn-sm bg-white/10 hover:bg-white/20 text-white font-medium text-xs px-3 py-2 flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nuevo Equipo</span>
              </Link>
            </div>
          </div>

          {/* KPI Cards Superiores */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[11px] text-white/70">Total Instrumental</p>
              <p className="text-xl font-bold text-white font-mono mt-0.5">{stats.totalEquipment}</p>
              <span className="text-[10px] text-white/50">Activos en sistema</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[11px] text-emerald-300">En Bodega Central</p>
              <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{stats.availableCount}</p>
              <span className="text-[10px] text-white/50">Listos para despacho</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[11px] text-blue-300">En Terreno / Obra</p>
              <p className="text-xl font-bold text-blue-400 font-mono mt-0.5">{stats.inFieldCount}</p>
              <span className="text-[10px] text-white/50">Operando en cuadrillas</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[11px] text-amber-300">Taller / Lab</p>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{stats.maintenanceCount}</p>
              <span className="text-[10px] text-white/50">Mantenimiento o calib.</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-rose-300">Alertas Calibración</p>
              <p className="text-xl font-bold text-rose-400 font-mono mt-0.5">{stats.calibrationAlertsCount}</p>
              <span className="text-[10px] text-white/50">Vencidas o próx. 30d</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Banner de Alerta de Calibración si existen equipos críticos */}
        {stats.calibrationAlertsCount > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 text-xs">
              <p className="font-bold text-amber-900">
                Atención: Hay {stats.calibrationAlertsCount} equipo(s) con certificación de calibración vencida o próxima a expirar en menos de 30 días.
              </p>
              <p className="text-amber-800 mt-0.5">
                Revisa los equipos marcados con indicador ámbar o rojo en la lista para coordinar la remisión al laboratorio metrológico antes de su próximo despacho.
              </p>
            </div>
          </div>
        )}

        {/* Barra de Filtros y Selector de Pestañas */}
        <div className="card border border-border shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inventario Activo</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-text-primary font-mono">
                {equipmentList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kardex')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'kardex'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Kárdex de Movimientos</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-text-primary font-mono">
                {checkouts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('consumables')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'consumables'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Consumibles</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-text-primary font-mono">
                {consumables.length}
              </span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, serie, equipo, obra o responsable..."
              className="input pl-9 text-xs py-1.5 w-full"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: INVENTARIO ACTIVO                                              */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Filtros secundarios */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-text-muted font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filtrar:
              </span>
              <div className="flex flex-wrap gap-1">
                {['all', 'available', 'in_field', 'maintenance', 'calibration'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      statusFilter === st
                        ? 'bg-primary text-white font-bold'
                        : 'bg-white border border-border text-text-muted hover:bg-gray-50'
                    }`}
                  >
                    {st === 'all' && 'Todos los estados'}
                    {st === 'available' && 'En Bodega'}
                    {st === 'in_field' && 'En Terreno'}
                    {st === 'maintenance' && 'Mantenimiento'}
                    {st === 'calibration' && 'Calibración'}
                  </button>
                ))}
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input py-1 text-xs ml-auto"
              >
                <option value="all">Todas las categorías</option>
                {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Tabla de Equipos */}
            <div className="card border border-border overflow-hidden bg-white shadow-xs rounded-2xl">
              <div className="overflow-x-auto">
                <table className="table w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-gray-50/80 text-text-muted font-bold">
                      <th className="py-3 px-4">Código / Serial</th>
                      <th className="py-3 px-4">Instrumental / Modelo</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Ubicación / Proyecto Actual</th>
                      <th className="py-3 px-4 text-center">Calibración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEquipment.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-text-muted">
                          No se encontraron equipos registrados con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      filteredEquipment.map((eq) => {
                        const statusConfig = STATUS_BADGES[eq.status] || STATUS_BADGES.available;
                        return (
                          <tr key={eq.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-primary text-xs">{eq.code}</span>
                              {eq.serial_number && (
                                <p className="font-mono text-[10px] text-text-muted">S/N: {eq.serial_number}</p>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <p className="font-semibold text-text-primary">{eq.name}</p>
                              <p className="text-[11px] text-text-muted">
                                {eq.brand || 'Genérico'} {eq.model ? `— ${eq.model}` : ''}
                              </p>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[11px] font-medium text-text-muted">
                                {CATEGORY_NAMES[eq.category] || eq.category}
                              </span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                                {statusConfig.label}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              {eq.status === 'in_field' && eq.activeCheckout ? (
                                <div className="space-y-0.5">
                                  <p className="font-medium text-primary flex items-center gap-1">
                                    <FolderGit2 className="w-3 h-3 text-text-muted" />
                                    {eq.activeCheckout.project?.name || 'Obra Asignada'}
                                  </p>
                                  <p className="text-[11px] text-text-muted flex items-center gap-1">
                                    <User className="w-3 h-3 text-text-muted" />
                                    {eq.activeCheckout.responsible_name || eq.activeCheckout.responsible_user?.full_name || 'Cuadrilla'}
                                    <span className="text-[10px] text-text-muted/70 font-mono">
                                      ({eq.activeCheckout.checkout_date})
                                    </span>
                                  </p>
                                </div>
                              ) : (
                                <span className="text-text-muted text-[11px] italic">
                                  Bodega Central PROCIMEC
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {eq.calibration_expiry_date ? (
                                <div className="inline-flex flex-col items-center">
                                  {eq.calibrationStatus === 'expired' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-mono">
                                      <ShieldAlert className="w-3 h-3" /> Vencida: {eq.calibration_expiry_date}
                                    </span>
                                  )}
                                  {eq.calibrationStatus === 'warning' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                                      <AlertTriangle className="w-3 h-3" /> Próx: {eq.calibration_expiry_date}
                                    </span>
                                  )}
                                  {eq.calibrationStatus === 'ok' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                                      <ShieldCheck className="w-3 h-3" /> Válida: {eq.calibration_expiry_date}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-muted/60 text-[10px]">No requiere</span>
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: KÁRDEX DE MOVIMIENTOS                                          */}
        {/* ========================================================================= */}
        {activeTab === 'kardex' && (
          <div className="card border border-border overflow-hidden bg-white shadow-xs rounded-2xl">
            <div className="overflow-x-auto">
              <table className="table w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-gray-50/80 text-text-muted font-bold">
                    <th className="py-3 px-4">Fecha Movimiento</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Instrumental</th>
                    <th className="py-3 px-4">Proyecto / Frente</th>
                    <th className="py-3 px-4">Responsable Campo</th>
                    <th className="py-3 px-4">Accesorios / Observaciones</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCheckouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        No hay movimientos de kárdex registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredCheckouts.map((chk) => (
                      <tr key={chk.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-text-primary">
                          <p className="font-bold">{chk.checkout_date}</p>
                          {chk.actual_return_date && (
                            <p className="text-[10px] text-emerald-700">Retorno: {chk.actual_return_date}</p>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {chk.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              <Truck className="w-3 h-3" /> Despacho Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <RotateCcw className="w-3 h-3" /> Retornado
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-primary">{chk.equipment?.code || 'EQ'}</span>
                          <p className="text-[11px] text-text-muted">{chk.equipment?.name}</p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-medium text-text-primary">{chk.project?.name || 'Obra'}</p>
                          {chk.project?.cost_center && (
                            <span className="font-mono text-[10px] text-text-muted">CC: {chk.project.cost_center}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-medium text-text-primary">
                            {chk.responsible_name || chk.responsible_user?.full_name || 'Cuadrilla'}
                          </p>
                        </td>

                        <td className="py-3 px-4 max-w-xs truncate">
                          {chk.notes && <p className="text-text-muted text-[11px] truncate">Salida: {chk.notes}</p>}
                          {chk.return_notes && <p className="text-emerald-800 text-[11px] truncate">Retorno: {chk.return_notes}</p>}
                          {!chk.notes && !chk.return_notes && <span className="text-text-muted/60 text-[11px]">—</span>}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            chk.status === 'active'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {chk.status === 'active' ? 'En Terreno' : 'Cerrado'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: CONSUMIBLES                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'consumables' && (
          <div className="card border border-border overflow-hidden bg-white shadow-xs rounded-2xl">
            <div className="overflow-x-auto">
              <table className="table w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-gray-50/80 text-text-muted font-bold">
                    <th className="py-3 px-4">Fecha Entrada</th>
                    <th className="py-3 px-4">Material / Insumo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Cantidad</th>
                    <th className="py-3 px-4">Proveedor / Factura</th>
                    <th className="py-3 px-4">Ubicación / Notas</th>
                    <th className="py-3 px-4">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consumables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        No hay registros de consumibles ingresados en bodega.
                      </td>
                    </tr>
                  ) : (
                    consumables.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono whitespace-nowrap font-medium text-text-primary">
                          {item.entry_date}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-bold text-text-primary">{item.item_name}</p>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="badge badge-neutral text-[10px] uppercase font-mono">
                            {item.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                          {item.quantity} {item.unit}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-medium text-text-primary">{item.supplier || 'N/A'}</p>
                          {item.invoice_number && (
                            <p className="font-mono text-[10px] text-text-muted">Doc: {item.invoice_number}</p>
                          )}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {item.notes || '—'}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-text-muted">
                          {item.users?.full_name || 'Almacén'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
