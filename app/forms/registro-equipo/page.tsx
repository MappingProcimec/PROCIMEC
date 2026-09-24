'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Package,
  Truck,
  RotateCcw,
  PlusCircle,
  Box,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  User,
  ShieldCheck,
  CheckSquare,
  Sparkles,
  ArrowRight,
  BatteryCharging,
  Layers,
  Wrench,
  Tag,
  Barcode,
  Search,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';
import type { EquipmentCategory, EquipmentStatus } from '@/types';

type WarehouseOperationMode = 'despacho' | 'retorno' | 'alta' | 'consumibles';

interface EquipmentOption {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status: EquipmentStatus;
  calibration_expiry_date?: string | null;
}

interface ActiveCheckoutOption {
  id: string;
  project_id: string;
  equipment_id: string;
  responsible_user_id?: string | null;
  responsible_name?: string | null;
  checkout_date: string;
  expected_return_date?: string | null;
  checklist?: Record<string, unknown>;
  notes?: string | null;
  equipment?: {
    id: string;
    code: string;
    name: string;
    category: EquipmentCategory;
    brand?: string | null;
    model?: string | null;
    serial_number?: string | null;
  };
  project?: {
    id: string;
    name: string;
    cost_center: string;
    client: string;
  };
  responsible_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface FormOptionsData {
  allEquipment: EquipmentOption[];
  availableEquipment: EquipmentOption[];
  activeCheckouts: ActiveCheckoutOption[];
  projects: { id: string; name: string; code: string; client: string }[];
  fieldUsers: { id: string; full_name: string; email: string; role: string }[];
}

const CATEGORIES: { id: EquipmentCategory; label: string; prefix: string; hint: string }[] = [
  { id: 'gpr', label: 'Georradar GPR', prefix: 'GPR-', hint: 'Sistemas de radar de penetración terrestre' },
  { id: 'antenna', label: 'Antena GPR', prefix: 'ANT-', hint: 'Antenas de alta/baja frecuencia (200MHz, 700MHz)' },
  { id: 'gnss', label: 'Receptor GNSS / RTK', prefix: 'RTK-', hint: 'Receptores satelitales diferenciales' },
  { id: 'radiodetection', label: 'Localizador EM', prefix: 'RAD-', hint: 'Equipos de radiodetección de cables y tuberías' },
  { id: 'total_station', label: 'Estación Total', prefix: 'EST-', hint: 'Instrumentos ópticos y topográficos' },
  { id: 'vehicle', label: 'Vehículo / Dron', prefix: 'VEH-', hint: 'Camionetas de frente o aeronaves remotas' },
  { id: 'accessory', label: 'Accesorio / Odómetro', prefix: 'ACC-', hint: 'Baterías, odómetros, cables y cargadores' },
  { id: 'other', label: 'Otro Instrumental', prefix: 'EQ-', hint: 'Herramientas técnicas auxiliares' },
];

async function fetchWarehouseFormOptions(): Promise<FormOptionsData> {
  const res = await fetch('/api/forms/registro-equipo');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error cargando datos operativos');
  return json.data;
}

function WarehouseOperationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Mode Selection (Alta, Consumibles, Despacho, Retorno)
  const initialMode = (searchParams.get('mode') as WarehouseOperationMode) || 'alta';
  const [activeMode, setActiveMode] = useState<WarehouseOperationMode>(initialMode);

  // Sync with searchParams if changed
  useEffect(() => {
    const modeParam = searchParams.get('mode') as WarehouseOperationMode;
    if (modeParam && ['despacho', 'retorno', 'alta', 'consumibles'].includes(modeParam)) {
      setActiveMode(modeParam);
    }
  }, [searchParams]);

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['warehouse-form-options'],
    queryFn: fetchWarehouseFormOptions,
  });

  const availableEquipment = data?.availableEquipment ?? [];
  const activeCheckouts = data?.activeCheckouts ?? [];
  const projects = data?.projects ?? [];
  const fieldUsers = data?.fieldUsers ?? [];

  // Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // STATE: MODO DESPACHO
  // ──────────────────────────────────────────────────────────────────────────
  const [dispProjectId, setDispProjectId] = useState('');
  const [dispEquipmentId, setDispEquipmentId] = useState('');
  const [dispUserId, setDispUserId] = useState('');
  const [dispCustomName, setDispCustomName] = useState('');
  const [dispDate, setDispDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dispReturnDate, setDispReturnDate] = useState('');
  const [dispNotes, setDispNotes] = useState('');
  const [dispBatteries, setDispBatteries] = useState<number>(2);
  const [dispChargerOk, setDispChargerOk] = useState(true);
  const [dispCablesOk, setDispCablesOk] = useState(true);
  const [dispOdometerOk, setDispOdometerOk] = useState(true);
  const [dispCaseOk, setDispCaseOk] = useState(true);
  const [dispHarnessOk, setDispHarnessOk] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // STATE: MODO RETORNO
  // ──────────────────────────────────────────────────────────────────────────
  const [retCheckoutId, setRetCheckoutId] = useState('');
  const [retDate, setRetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [retStatus, setRetStatus] = useState<'available' | 'maintenance' | 'calibration'>('available');
  const [retBatteries, setRetBatteries] = useState<number>(2);
  const [retChargerOk, setRetChargerOk] = useState(true);
  const [retCablesOk, setRetCablesOk] = useState(true);
  const [retCleanOk, setRetCleanOk] = useState(true);
  const [retCaseOk, setRetCaseOk] = useState(true);
  const [retHasDamages, setRetHasDamages] = useState(false);
  const [retNotes, setRetNotes] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // STATE: MODO ALTA DE INSTRUMENTAL
  // ──────────────────────────────────────────────────────────────────────────
  const [altaCategory, setAltaCategory] = useState<EquipmentCategory>('gpr');
  const [altaCode, setAltaCode] = useState('GPR-');
  const [altaName, setAltaName] = useState('');
  const [altaBrand, setAltaBrand] = useState('');
  const [altaModel, setAltaModel] = useState('');
  const [altaSerial, setAltaSerial] = useState('');
  const [altaInitialStatus, setAltaInitialStatus] = useState<EquipmentStatus>('available');
  const [altaRequiresCalibration, setAltaRequiresCalibration] = useState(true);
  const [altaCalibDate, setAltaCalibDate] = useState('');
  const [altaCalibExpiry, setAltaCalibExpiry] = useState('');
  const [altaNotes, setAltaNotes] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // STATE: MODO CONSUMIBLES
  // ──────────────────────────────────────────────────────────────────────────
  const [consName, setConsName] = useState('');
  const [consCategory, setConsCategory] = useState('terreno');
  const [consQuantity, setConsQuantity] = useState<string>('1');
  const [consUnit, setConsUnit] = useState('unidades');
  const [consSupplier, setConsSupplier] = useState('');
  const [consInvoice, setConsInvoice] = useState('');
  const [consDate, setConsDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [consNotes, setConsNotes] = useState('');

  // Quick prefix setter for Alta
  const handleCategorySelect = (selectedCat: EquipmentCategory) => {
    setAltaCategory(selectedCat);
    const catConfig = CATEGORIES.find(c => c.id === selectedCat);
    if (catConfig && (!altaCode || CATEGORIES.some(c => altaCode === c.prefix))) {
      setAltaCode(catConfig.prefix);
    }
  };

  const selectedRetCheckout = activeCheckouts.find(c => c.id === retCheckoutId);

  // Synchronize batteries count when a checkout is selected for return
  useEffect(() => {
    if (selectedRetCheckout?.checklist?.batteries !== undefined) {
      setRetBatteries(Number(selectedRetCheckout.checklist.batteries) || 2);
    }
  }, [selectedRetCheckout]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      let payload: Record<string, unknown> = {};

      if (activeMode === 'despacho') {
        if (!dispProjectId) throw new Error('Por favor selecciona el proyecto de destino.');
        if (!dispEquipmentId) throw new Error('Por favor selecciona el equipo a despachar.');

        const finalRespName = dispUserId
          ? fieldUsers.find(u => u.id === dispUserId)?.full_name || ''
          : dispCustomName.trim();

        if (!finalRespName) throw new Error('Indica el nombre del responsable que recibe en campo.');

        payload = {
          action: 'despacho',
          project_id: dispProjectId,
          equipment_id: dispEquipmentId,
          responsible_user_id: dispUserId || undefined,
          responsible_name: finalRespName,
          checkout_date: dispDate,
          expected_return_date: dispReturnDate || undefined,
          checklist: {
            batteries: dispBatteries,
            charger: dispChargerOk,
            cables: dispCablesOk,
            odometer: dispOdometerOk,
            pelican_case: dispCaseOk,
            harness: dispHarnessOk,
          },
          notes: dispNotes.trim() || undefined,
        };
      } else if (activeMode === 'retorno') {
        if (!retCheckoutId) throw new Error('Por favor selecciona el despacho a reingresar.');

        payload = {
          action: 'retorno',
          checkout_id: retCheckoutId,
          return_date: retDate,
          destination_status: retHasDamages ? 'maintenance' : retStatus,
          return_checklist: {
            batteries_returned: retBatteries,
            charger_returned: retChargerOk,
            cables_returned: retCablesOk,
            clean_returned: retCleanOk,
            case_returned: retCaseOk,
            damages_reported: retHasDamages,
          },
          return_notes: retNotes.trim() || undefined,
        };
      } else if (activeMode === 'alta') {
        if (!altaCode.trim()) throw new Error('El código interno del equipo es obligatorio.');
        if (!altaName.trim()) throw new Error('El nombre o descripción del equipo es obligatorio.');

        payload = {
          action: 'alta',
          code: altaCode.trim().toUpperCase(),
          name: altaName.trim(),
          category: altaCategory,
          brand: altaBrand.trim() || undefined,
          model: altaModel.trim() || undefined,
          serial_number: altaSerial.trim() || undefined,
          status: altaInitialStatus,
          calibration_date: altaRequiresCalibration ? (altaCalibDate || undefined) : undefined,
          calibration_expiry_date: altaRequiresCalibration ? (altaCalibExpiry || undefined) : undefined,
          notes: altaNotes.trim() || undefined,
        };
      } else if (activeMode === 'consumibles') {
        if (!consName.trim()) throw new Error('El nombre del consumible es obligatorio.');
        const qty = Number(consQuantity);
        if (isNaN(qty) || qty <= 0) throw new Error('La cantidad debe ser mayor a 0.');

        payload = {
          action: 'consumable',
          item_name: consName.trim(),
          category: consCategory,
          quantity: qty,
          unit: consUnit,
          supplier: consSupplier.trim() || undefined,
          invoice_number: consInvoice.trim() || undefined,
          entry_date: consDate,
          notes: consNotes.trim() || undefined,
        };
      }

      const res = await fetch('/api/forms/registro-equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al procesar la operación de almacén.');

      setSuccessMessage(resData.message || 'Operación registrada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['warehouse-form-options'] });

      // Reset form according to active mode
      if (activeMode === 'despacho') {
        setDispEquipmentId('');
        setDispProjectId('');
        setDispNotes('');
      } else if (activeMode === 'retorno') {
        setRetCheckoutId('');
        setRetNotes('');
      } else if (activeMode === 'alta') {
        setAltaName('');
        setAltaBrand('');
        setAltaModel('');
        setAltaSerial('');
        setAltaNotes('');
      } else if (activeMode === 'consumibles') {
        setConsName('');
        setConsQuantity('1');
        setConsNotes('');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Header Oficial */}
      <div className="bg-primary text-white border-b border-border shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Movimientos y Registro de Almacén
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Control operativo de instrumental y bodega: despachos a obra, retornos de instrumental, altas e insumos.
          </p>

          {/* Navegación por Pestañas de Modos de Operación (Orden Canónico) */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => { setActiveMode('alta'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                activeMode === 'alta'
                  ? 'bg-accent text-primary shadow-md font-bold'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <PlusCircle className="w-4 h-4" strokeWidth={1.75} />
              Alta de Instrumental
            </button>

            <button
              type="button"
              onClick={() => { setActiveMode('consumibles'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                activeMode === 'consumibles'
                  ? 'bg-accent text-primary shadow-md font-bold'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <Box className="w-4 h-4" strokeWidth={1.75} />
              Ingreso de Consumibles
            </button>

            <button
              type="button"
              onClick={() => { setActiveMode('despacho'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                activeMode === 'despacho'
                  ? 'bg-accent text-primary shadow-md font-bold'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <Truck className="w-4 h-4" strokeWidth={1.75} />
              Despacho a Campo
              {availableEquipment.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeMode === 'despacho' ? 'bg-primary/20 text-primary' : 'bg-white/20 text-white'
                }`}>
                  {availableEquipment.length} disp.
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setActiveMode('retorno'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] ${
                activeMode === 'retorno'
                  ? 'bg-accent text-primary shadow-md font-bold'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
              Retorno desde Obra
              {activeCheckouts.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeMode === 'retorno' ? 'bg-primary/20 text-primary' : 'bg-amber-400 text-primary font-bold'
                }`}>
                  {activeCheckouts.length} en obra
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* Banner de Éxito */}
        {successMessage && (
          <div className="card p-5 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-emerald-950">{successMessage}</p>
              <p className="text-xs text-emerald-700 mt-1">El movimiento ha sido registrado y los saldos de bodega actualizados en tiempo real.</p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="btn btn-sm bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs"
                >
                  Registrar otro movimiento
                </button>
                <Link
                  href="/dashboard"
                  className="btn btn-sm bg-emerald-800 text-white hover:bg-emerald-900 text-xs"
                >
                  Volver a Mi Panel
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Error */}
        {errorMessage && (
          <div className="card p-4 mb-6 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========================================================================= */}
          {/* SECCIÓN MODO 1: DESPACHO A CAMPO                                          */}
          {/* ========================================================================= */}
          {activeMode === 'despacho' && (
            <div className="space-y-6">
              <div className="card border border-border p-6 shadow-sm bg-white rounded-2xl space-y-6">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <Truck className="w-5 h-5 text-accent" strokeWidth={1.75} />
                      1. Asignación de Frente y Equipo Disponible
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Selecciona el equipo disponible en bodega y el proyecto donde operará la cuadrilla.
                    </p>
                  </div>
                  <span className="badge badge-primary text-xs">Despacho</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Selector de Equipo Disponible */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-text-muted" />
                      Instrumental Disponible en Bodega *
                    </label>
                    <select
                      value={dispEquipmentId}
                      onChange={(e) => setDispEquipmentId(e.target.value)}
                      required
                      className="input w-full text-xs font-mono"
                    >
                      <option value="">-- Seleccionar Equipo Disponible ({availableEquipment.length}) --</option>
                      {availableEquipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          [{eq.code}] {eq.name} {eq.brand ? `— ${eq.brand}` : ''} {eq.model ? `(${eq.model})` : ''}
                        </option>
                      ))}
                    </select>
                    {availableEquipment.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                        No hay instrumental disponible en bodega en este momento. Registra un equipo nuevo o realiza el reingreso de uno en obra.
                      </p>
                    )}
                  </div>

                  {/* Selector de Proyecto Destino */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <FolderGit2 className="w-4 h-4 text-text-muted" />
                      Proyecto u Obra de Destino *
                    </label>
                    <select
                      value={dispProjectId}
                      onChange={(e) => setDispProjectId(e.target.value)}
                      required
                      className="input w-full text-xs"
                    >
                      <option value="">-- Seleccionar Proyecto Destino --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code ? `[${p.code}] ` : ''}{p.name} {p.client ? `(${p.client})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Responsable de Campo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <User className="w-4 h-4 text-text-muted" />
                      Responsable en Campo (Localizador / Operador) *
                    </label>
                    <select
                      value={dispUserId}
                      onChange={(e) => {
                        setDispUserId(e.target.value);
                        if (e.target.value) setDispCustomName('');
                      }}
                      className="input w-full text-xs"
                    >
                      <option value="">-- Seleccionar Colaborador Registrado --</option>
                      {fieldUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role}) — {u.email}
                        </option>
                      ))}
                    </select>
                    {!dispUserId && (
                      <input
                        type="text"
                        value={dispCustomName}
                        onChange={(e) => setDispCustomName(e.target.value)}
                        placeholder="O escribe el nombre completo del receptor..."
                        className="input w-full text-xs mt-1"
                      />
                    )}
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-text-muted" />
                        Fecha de Salida *
                      </label>
                      <input
                        type="date"
                        value={dispDate}
                        onChange={(e) => setDispDate(e.target.value)}
                        required
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-text-muted" />
                        Retorno Estimado
                      </label>
                      <input
                        type="date"
                        value={dispReturnDate}
                        onChange={(e) => setDispReturnDate(e.target.value)}
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Checklist de Salida */}
                <div className="pt-4 border-t border-border space-y-3">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider text-text-muted">
                    Checklist de Accesorios y Componentes Entregados
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 border border-border rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">Baterías</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={dispBatteries}
                        onChange={(e) => setDispBatteries(Number(e.target.value))}
                        className="input text-xs w-16 text-center font-mono py-1"
                      />
                    </div>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={dispChargerOk}
                        onChange={(e) => setDispChargerOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Cargador AC/DC</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={dispCablesOk}
                        onChange={(e) => setDispCablesOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Cables de Datos</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={dispOdometerOk}
                        onChange={(e) => setDispOdometerOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Odómetro / Rueda</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={dispCaseOk}
                        onChange={(e) => setDispCaseOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Maletín Rígido</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={dispHarnessOk}
                        onChange={(e) => setDispHarnessOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Arnés de Espalda</span>
                    </label>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary">Observaciones o Condiciones Particulares</label>
                  <textarea
                    rows={2}
                    value={dispNotes}
                    onChange={(e) => setDispNotes(e.target.value)}
                    placeholder="Detalles sobre el estado exterior, cables adicionales, número de serie de accesorios..."
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECCIÓN MODO 2: RETORNO DESDE OBRA                                        */}
          {/* ========================================================================= */}
          {activeMode === 'retorno' && (
            <div className="space-y-6">
              <div className="card border border-border p-6 shadow-sm bg-white rounded-2xl space-y-6">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-accent" strokeWidth={1.75} />
                      1. Recepción y Cierre de Préstamo de Campo
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Selecciona el equipo que regresa de obra, inspecciona su integridad física y actualiza su estado.
                    </p>
                  </div>
                  <span className="badge badge-primary text-xs">Reingreso</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Selector de Despacho Activo */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-text-muted" />
                      Instrumental Activo en Obra a Reingresar *
                    </label>
                    <select
                      value={retCheckoutId}
                      onChange={(e) => setRetCheckoutId(e.target.value)}
                      required
                      className="input w-full text-xs font-mono"
                    >
                      <option value="">-- Seleccionar Equipo Actualmente en Terreno ({activeCheckouts.length}) --</option>
                      {activeCheckouts.map((chk) => (
                        <option key={chk.id} value={chk.id}>
                          [{chk.equipment?.code}] {chk.equipment?.name} — Proyecto: {chk.project?.name || 'Obra'} — Resp: {chk.responsible_name || chk.responsible_user?.full_name || 'Cuadrilla'} (Salida: {chk.checkout_date})
                        </option>
                      ))}
                    </select>
                    {activeCheckouts.length === 0 && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 mt-1">
                        Todos los equipos despachados se encuentran actualmente en bodega. No hay préstamos activos pendientes de retorno.
                      </p>
                    )}
                  </div>

                  {/* Resumen del Préstamo Seleccionado */}
                  {selectedRetCheckout && (
                    <div className="md:col-span-2 p-4 bg-gray-50 border border-border rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">Detalles del Despacho Origen:</span>
                        <span className="badge badge-neutral text-[10px]">Salida: {selectedRetCheckout.checkout_date}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-text-muted">
                        <p><strong className="text-text-primary">Frente / Proyecto:</strong> {selectedRetCheckout.project?.name}</p>
                        <p><strong className="text-text-primary">Responsable:</strong> {selectedRetCheckout.responsible_name || selectedRetCheckout.responsible_user?.full_name}</p>
                        <p><strong className="text-text-primary">Marca / Modelo:</strong> {selectedRetCheckout.equipment?.brand || 'N/A'} {selectedRetCheckout.equipment?.model || ''}</p>
                      </div>
                    </div>
                  )}

                  {/* Fecha de Retorno */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-text-muted" />
                      Fecha Efectiva de Reingreso *
                    </label>
                    <input
                      type="date"
                      value={retDate}
                      onChange={(e) => setRetDate(e.target.value)}
                      required
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  {/* Estado Destino en Bodega */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-text-muted" />
                      Estado Tras la Inspección *
                    </label>
                    <select
                      value={retStatus}
                      onChange={(e) => setRetStatus(e.target.value as 'available' | 'maintenance' | 'calibration')}
                      disabled={retHasDamages}
                      className="input w-full text-xs font-medium"
                    >
                      <option value="available">Disponible en Bodega (Listo para nuevo despacho)</option>
                      <option value="maintenance">Requiere Mantenimiento / Reparación Preventiva</option>
                      <option value="calibration">Requiere Envío a Laboratorio de Calibración</option>
                    </select>
                    {retHasDamages && (
                      <p className="text-[11px] text-rose-700 mt-1 font-semibold">
                        Se asignará automáticamente a Mantenimiento debido al reporte de daño o faltante crítico.
                      </p>
                    )}
                  </div>
                </div>

                {/* Checklist de Retorno e Inspección */}
                <div className="pt-4 border-t border-border space-y-3">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider text-text-muted">
                    Inspección Física y Verificación de Retorno
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 border border-border rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">Baterías Devueltas</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={retBatteries}
                        onChange={(e) => setRetBatteries(Number(e.target.value))}
                        className="input text-xs w-16 text-center font-mono py-1"
                      />
                    </div>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={retChargerOk}
                        onChange={(e) => setRetChargerOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Cargador Devuelto</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={retCablesOk}
                        onChange={(e) => setRetCablesOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Cables sin Daños</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={retCaseOk}
                        onChange={(e) => setRetCaseOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Maletín Devuelto</span>
                    </label>

                    <label className="p-3 bg-gray-50 border border-border rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={retCleanOk}
                        onChange={(e) => setRetCleanOk(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Limpieza Aceptable</span>
                    </label>

                    <label className={`p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors ${
                      retHasDamages ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold' : 'bg-gray-50 border-border text-text-primary'
                    }`}>
                      <input
                        type="checkbox"
                        checked={retHasDamages}
                        onChange={(e) => setRetHasDamages(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs">Reportar Daño o Faltante</span>
                    </label>
                  </div>
                </div>

                {/* Observaciones de Retorno */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary">
                    Informe de Novedades, Faltantes o Daños de Campo
                  </label>
                  <textarea
                    rows={3}
                    value={retNotes}
                    onChange={(e) => setRetNotes(e.target.value)}
                    placeholder="Detalles de golpes, suciedad excesiva, rayones en la antena GPR, desgaste de cables o reporte de extravío..."
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECCIÓN MODO 3: ALTA DE NUEVO INSTRUMENTAL                                */}
          {/* ========================================================================= */}
          {activeMode === 'alta' && (
            <div className="space-y-6">
              <div className="card border border-border p-6 shadow-sm bg-white rounded-2xl space-y-6">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-accent" strokeWidth={1.75} />
                      1. Alta de Instrumental Técnico / Activo Fijo
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Ingreso de nuevo equipo al inventario corporativo con código interno y parámetros de calibración.
                    </p>
                  </div>
                  <span className="badge badge-primary text-xs">Alta de Activo</span>
                </div>

                {/* Categoría con selector visual */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-text-muted" />
                    Categoría de Instrumental *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          altaCategory === cat.id
                            ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
                            : 'bg-white border-border hover:bg-gray-50'
                        }`}
                      >
                        <p className={`text-xs font-bold ${altaCategory === cat.id ? 'text-primary' : 'text-text-primary'}`}>
                          {cat.label}
                        </p>
                        <p className="text-[10px] text-text-muted font-mono mt-0.5">{cat.prefix}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Código Interno *</label>
                    <input
                      type="text"
                      value={altaCode}
                      onChange={(e) => setAltaCode(e.target.value.toUpperCase())}
                      required
                      placeholder="GPR-001"
                      className="input w-full text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-text-primary">Nombre / Descripción Oficial *</label>
                    <input
                      type="text"
                      value={altaName}
                      onChange={(e) => setAltaName(e.target.value)}
                      required
                      placeholder="Ej: Georradar IDS Opera Duo Doble Frecuencia"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Marca / Fabricante</label>
                    <input
                      type="text"
                      value={altaBrand}
                      onChange={(e) => setAltaBrand(e.target.value)}
                      placeholder="Ej: IDS Georadar / Leica / Mala"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Modelo</label>
                    <input
                      type="text"
                      value={altaModel}
                      onChange={(e) => setAltaModel(e.target.value)}
                      placeholder="Ej: Opera Duo / GS18T"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Número de Serie de Fábrica</label>
                    <input
                      type="text"
                      value={altaSerial}
                      onChange={(e) => setAltaSerial(e.target.value)}
                      placeholder="Ej: SN-984210"
                      className="input w-full text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Parámetros de Calibración */}
                <div className="pt-4 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">Control Metrológico y Certificado</h3>
                      <p className="text-[11px] text-text-muted">Habilitar si el equipo requiere calibración anual certificada</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={altaRequiresCalibration}
                        onChange={(e) => setAltaRequiresCalibration(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-medium text-text-primary">Requiere Calibración</span>
                    </label>
                  </div>

                  {altaRequiresCalibration && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 border border-border rounded-xl">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-primary">Fecha de Última Calibración</label>
                        <input
                          type="date"
                          value={altaCalibDate}
                          onChange={(e) => setAltaCalibDate(e.target.value)}
                          className="input w-full text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-primary">Fecha de Vencimiento de Certificado</label>
                        <input
                          type="date"
                          value={altaCalibExpiry}
                          onChange={(e) => setAltaCalibExpiry(e.target.value)}
                          className="input w-full text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary">Notas Técnicas Adicionales</label>
                  <textarea
                    rows={2}
                    value={altaNotes}
                    onChange={(e) => setAltaNotes(e.target.value)}
                    placeholder="Accesorios incluidos, número de factura de compra, proveedor..."
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECCIÓN MODO 4: INGRESO DE CONSUMIBLES                                    */}
          {/* ========================================================================= */}
          {activeMode === 'consumibles' && (
            <div className="space-y-6">
              <div className="card border border-border p-6 shadow-sm bg-white rounded-2xl space-y-6">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <Box className="w-5 h-5 text-accent" strokeWidth={1.75} />
                      1. Entrada de Consumibles de Terreno
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Registro de insumos operativos: pintura topográfica, estacas de madera, cintas de balizamiento y baterías.
                    </p>
                  </div>
                  <span className="badge badge-primary text-xs">Insumos</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-text-primary">Nombre del Material Consumible *</label>
                    <input
                      type="text"
                      value={consName}
                      onChange={(e) => setConsName(e.target.value)}
                      required
                      placeholder="Ej: Pintura Topográfica Fluorescente Naranja (Aerosol 500ml)"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Categoría de Insumo</label>
                    <select
                      value={consCategory}
                      onChange={(e) => setConsCategory(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="terreno">Terreno / Topografía</option>
                      <option value="seguridad">Seguridad / Señalización</option>
                      <option value="baterias">Baterías y Energía</option>
                      <option value="oficina">Papelería y Oficina</option>
                      <option value="general">General / Varios</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Cantidad Ingresada *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={consQuantity}
                      onChange={(e) => setConsQuantity(e.target.value)}
                      required
                      className="input w-full text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Unidad de Medida *</label>
                    <select
                      value={consUnit}
                      onChange={(e) => setConsUnit(e.target.value)}
                      className="input w-full text-xs"
                    >
                      <option value="unidades">Unidades (uds)</option>
                      <option value="cajas">Cajas</option>
                      <option value="paquetes">Paquetes</option>
                      <option value="rollos">Rollos</option>
                      <option value="galones">Galones</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Fecha de Ingreso *</label>
                    <input
                      type="date"
                      value={consDate}
                      onChange={(e) => setConsDate(e.target.value)}
                      required
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Proveedor / Casa Comercial</label>
                    <input
                      type="text"
                      value={consSupplier}
                      onChange={(e) => setConsSupplier(e.target.value)}
                      placeholder="Ej: TopoEquipos SAS / Homecenter"
                      className="input w-full text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Número de Factura / Remisión</label>
                    <input
                      type="text"
                      value={consInvoice}
                      onChange={(e) => setConsInvoice(e.target.value)}
                      placeholder="Ej: FE-9842"
                      className="input w-full text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-primary">Ubicación en Bodega</label>
                    <input
                      type="text"
                      value={consNotes}
                      onChange={(e) => setConsNotes(e.target.value)}
                      placeholder="Ej: Estantería B - Nivel 2"
                      className="input w-full text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón de Envío Canónico */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href="/dashboard"
              className="btn btn-secondary text-xs"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary text-xs px-6 py-2.5 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Procesando Movimiento...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {activeMode === 'despacho' && 'Confirmar Despacho a Campo'}
                    {activeMode === 'retorno' && 'Confirmar Reingreso a Bodega'}
                    {activeMode === 'alta' && 'Dar de Alta en Inventario'}
                    {activeMode === 'consumibles' && 'Registrar Entrada de Consumibles'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function RegistroEquipoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <WarehouseOperationsContent />
    </Suspense>
  );
}
