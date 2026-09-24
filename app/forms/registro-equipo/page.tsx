'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Package,
  PlusCircle,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Radio,
  Layers,
  Wrench,
  Tag,
  Barcode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Box
} from 'lucide-react';
import type { EquipmentCategory, EquipmentStatus } from '@/types';

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

const STATUS_OPTIONS: { id: EquipmentStatus; label: string; description: string; badgeClass: string }[] = [
  { id: 'available', label: 'Disponible en Bodega', description: 'Listo para despacho inmediato a frentes de campo', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { id: 'calibration', label: 'En Calibración', description: 'En laboratorio técnico para certificación metrológica', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'maintenance', label: 'En Mantenimiento', description: 'En revisión preventiva o reparación de componentes', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300' },
];

export default function RegistroEquipoFormPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Form State
  const [category, setCategory] = useState<EquipmentCategory>('gpr');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState<EquipmentStatus>('available');
  const [requiresCalibration, setRequiresCalibration] = useState(true);
  const [calibrationDate, setCalibrationDate] = useState('');
  const [calibrationExpiryDate, setCalibrationExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEquipment, setSubmittedEquipment] = useState<{ code: string; name: string } | null>(null);

  // Quick prefix setter
  const applyPrefix = (prefix: string) => {
    if (!code || code.includes('-')) {
      setCode(prefix);
    } else {
      setCode(`${prefix}${code}`);
    }
  };

  const handleCategorySelect = (selectedCat: EquipmentCategory) => {
    setCategory(selectedCat);
    const catConfig = CATEGORIES.find(c => c.id === selectedCat);
    if (catConfig && (!code || CATEGORIES.some(c => code === c.prefix))) {
      setCode(catConfig.prefix);
    }
  };

  const resetForm = () => {
    setCode('GPR-');
    setName('');
    setBrand('');
    setModel('');
    setSerialNumber('');
    setStatus('available');
    setCalibrationDate('');
    setCalibrationExpiryDate('');
    setNotes('');
    setSubmittedEquipment(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Ingresa el código interno único del equipo (ej. GPR-001).');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Ingresa el nombre o denominación técnica del equipo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/forms/registro-equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: name.trim(),
          category,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serial_number: serialNumber.trim() || undefined,
          status,
          calibration_date: requiresCalibration && calibrationDate ? calibrationDate : undefined,
          calibration_expiry_date: requiresCalibration && calibrationExpiryDate ? calibrationExpiryDate : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar el equipo.');
      }

      setSubmittedEquipment({
        code: cleanCode,
        name: name.trim(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Industrial Hero Header */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-wrap items-center gap-2 mt-3 mb-2">
            <span className="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-medium uppercase px-2.5 py-1">
              Formulario Operativo
            </span>
            <span className="badge bg-white/10 text-white/90 border border-white/20 text-xs font-mono font-semibold px-2.5 py-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
              Catálogo: registro-equipo
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Registro y Alta de Instrumental
          </h1>
          <p className="text-white/75 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">
            Ingreso formal de georradares, antenas electromagnéticas, receptores RTK y accesorios al inventario corporativo de PROCIMEC.
          </p>
        </div>
      </div>

      {/* Main Form Container */}
      <main className="flex-1 max-w-4xl mx-auto px-4 -mt-6 pb-20 w-full">
        {submittedEquipment ? (
          /* Success Card */
          <div className="card border border-emerald-200 bg-white p-6 sm:p-8 rounded-2xl shadow-sm space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-text-primary">
                ¡Equipo Registrado con Éxito!
              </h2>
              <p className="text-sm text-text-secondary">
                El activo <strong className="font-mono text-emerald-800">{submittedEquipment.code}</strong> ({submittedEquipment.name}) ha sido almacenado en la base de datos y se encuentra disponible para control de bodega y despacho.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 active:scale-[0.98] transition-all duration-160 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" strokeWidth={1.75} />
                <span>Registrar Otro Equipo</span>
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-white text-text-primary text-xs font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all duration-160 shadow-xs"
              >
                <span>Ir a Mi Panel</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        ) : (
          /* Active Registration Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs sm:text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* SECCIÓN 1: Categoría Técnica */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    1. Categoría de Instrumental
                  </h2>
                </div>
                <span className="text-xs font-mono text-text-muted">Requerido</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`text-left p-3 rounded-xl border transition-all duration-160 flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary-50/60 ring-2 ring-primary/20 shadow-xs'
                          : 'border-border/80 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-text-primary">{cat.label}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'
                        }`}>
                          {cat.prefix}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1 leading-tight line-clamp-2">
                        {cat.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 2: Identificación y Especificaciones Técnicas */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    2. Identificación del Activo
                  </h2>
                </div>
                <span className="text-xs font-mono text-text-muted">Datos de Fábrica</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Código Interno */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text-secondary">
                      Código Interno del Equipo <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-text-muted">Único en sistema</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ej. GPR-001"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm font-mono font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase tracking-wider"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-text-muted">Prefijo sugerido:</span>
                    {CATEGORIES.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applyPrefix(c.prefix)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-text-secondary transition-colors"
                      >
                        {c.prefix}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre / Denominación */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">
                    Nombre / Denominación del Equipo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej. Georradar IDS Opera Duo 250/700 MHz"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                {/* Marca */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Marca / Fabricante</label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="ej. IDS GeoRadar, Leica, Radiodetection..."
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <datalist id="brand-suggestions">
                    <option value="IDS GeoRadar" />
                    <option value="Leica Geosystems" />
                    <option value="Radiodetection" />
                    <option value="Trimble" />
                    <option value="Sensors & Software" />
                    <option value="MALA Geoscience" />
                    <option value="DJI Enterprise" />
                    <option value="Bosch" />
                  </datalist>
                </div>

                {/* Modelo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Modelo Específico</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="ej. Opera Duo Dual, RD8100, GS18 T"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Número de Serie */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    Número de Serie del Fabricante (S/N)
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="ej. SN-2023091482"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Estado Operativo y Calibraciones */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    3. Estado Operativo & Calibración
                  </h2>
                </div>
                <span className="text-xs font-mono text-text-muted">Control de Calidad</span>
              </div>

              {/* Selector de Estado Inicial */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Estado Inicial del Activo</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {STATUS_OPTIONS.map((st) => {
                    const isSelected = status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatus(st.id)}
                        className={`text-left p-3 rounded-xl border transition-all duration-160 ${
                          isSelected
                            ? `${st.badgeClass} ring-2 ring-primary/20 font-semibold shadow-xs`
                            : 'border-border/80 bg-white hover:border-gray-300 text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{st.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />}
                        </div>
                        <p className="text-[10px] opacity-80 mt-1 leading-tight">{st.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interruptor de Calibración */}
              <div className="p-4 rounded-xl border border-border/80 bg-gray-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-text-primary">¿Requiere Calibración Metrológica?</span>
                    <p className="text-[11px] text-text-muted">Equipos de precisión geofísica que requieren certificación vigente.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequiresCalibration(!requiresCalibration)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      requiresCalibration ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        requiresCalibration ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {requiresCalibration && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                        Fecha de Última Calibración
                      </label>
                      <input
                        type="date"
                        value={calibrationDate}
                        onChange={(e) => setCalibrationDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                        Fecha de Vencimiento de Calibración
                      </label>
                      <input
                        type="date"
                        value={calibrationExpiryDate}
                        onChange={(e) => setCalibrationExpiryDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones y Accesorios */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Observaciones, Accesorios Incluidos y Condiciones Físicas
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ej. Maletín rígido Pelican 1510, cargador original, 2 baterías de litio, cable odómetro y arnés de transporte..."
                  className="w-full p-3 rounded-xl border border-border bg-white text-xs sm:text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary leading-relaxed"
                />
              </div>
            </div>

            {/* Acciones de Envío */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-white text-text-secondary text-xs font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all text-center"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold hover:bg-primary-800 active:scale-[0.98] transition-all duration-160 shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando en Inventario...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 text-accent" strokeWidth={2} />
                    <span>Completar Alta de Instrumental</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
