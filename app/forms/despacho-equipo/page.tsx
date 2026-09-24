'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Truck,
  Package,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Box,
  BatteryCharging,
  Briefcase,
  PlusCircle
} from 'lucide-react';
import type { Equipment } from '@/types';

interface ProjectOption {
  id: string;
  name: string;
  code: string;
  client: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface FormOptionsData {
  availableEquipment: Equipment[];
  projects: ProjectOption[];
  fieldUsers: UserOption[];
}

async function fetchFormOptions(): Promise<FormOptionsData> {
  const res = await fetch('/api/forms/despacho-equipo');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error cargando datos');
  return json.data;
}

export default function DespachoEquipoFormPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['despacho-form-options'],
    queryFn: fetchFormOptions,
  });

  // Form State
  const [projectId, setProjectId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [customResponsibleName, setCustomResponsibleName] = useState('');
  const [checkoutDate, setCheckoutDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  // Checklist State
  const [batteryCount, setBatteryCount] = useState<number>(2);
  const [chargerOk, setChargerOk] = useState(true);
  const [cablesOk, setCablesOk] = useState(true);
  const [odometerOk, setOdometerOk] = useState(true);
  const [caseOk, setCaseOk] = useState(true);
  const [harnessOk, setHarnessOk] = useState(false);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<{
    equipmentCode: string;
    projectName: string;
    responsible: string;
  } | null>(null);

  const availableEquipment = data?.availableEquipment ?? [];
  const projects = data?.projects ?? [];
  const fieldUsers = data?.fieldUsers ?? [];

  const selectedEquipment = availableEquipment.find(e => e.id === equipmentId);
  const selectedProject = projects.find(p => p.id === projectId);

  const resetForm = () => {
    setProjectId('');
    setEquipmentId('');
    setResponsibleUserId('');
    setCustomResponsibleName('');
    setExpectedReturnDate('');
    setNotes('');
    setBatteryCount(2);
    setChargerOk(true);
    setCablesOk(true);
    setOdometerOk(true);
    setCaseOk(true);
    setHarnessOk(false);
    setSubmittedSummary(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Por favor selecciona el proyecto de destino.');
      return;
    }

    if (!equipmentId) {
      setErrorMessage('Por favor selecciona el equipo disponible que saldrá a campo.');
      return;
    }

    const finalRespName = responsibleUserId
      ? fieldUsers.find(u => u.id === responsibleUserId)?.full_name || ''
      : customResponsibleName.trim();

    if (!finalRespName) {
      setErrorMessage('Indica el nombre del colaborador responsable que recibe en campo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/forms/despacho-equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          equipment_id: equipmentId,
          responsible_user_id: responsibleUserId || undefined,
          responsible_name: finalRespName,
          checkout_date: checkoutDate,
          expected_return_date: expectedReturnDate || undefined,
          checklist: {
            batteries: batteryCount,
            charger: chargerOk,
            cables: cablesOk,
            odometer: odometerOk,
            pelican_case: caseOk,
            harness: harnessOk,
          },
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al procesar el despacho.');
      }

      setSubmittedSummary({
        equipmentCode: selectedEquipment?.code || 'Activo',
        projectName: selectedProject?.name || 'Proyecto',
        responsible: finalRespName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor.';
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
              <Truck className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
              Catálogo: despacho-equipo
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Despacho y Salida a Campo
          </h1>
          <p className="text-white/75 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">
            Asignación formal de instrumental geofísico hacia frentes de obra activos con verificación de accesorios y responsable.
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl mx-auto px-4 -mt-6 pb-20 w-full">
        {isLoading ? (
          <div className="card border border-border p-12 text-center rounded-2xl bg-white shadow-xs">
            <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-text-muted font-medium">Cargando proyectos y equipos disponibles...</p>
          </div>
        ) : fetchError ? (
          <div className="card border border-rose-200 bg-rose-50 p-6 rounded-2xl text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-rose-900">Error al cargar las opciones del formulario</p>
            <p className="text-xs text-rose-700 mt-1">{(fetchError as Error).message}</p>
          </div>
        ) : submittedSummary ? (
          /* Confirmation Screen */
          <div className="card border border-emerald-200 bg-white p-6 sm:p-8 rounded-2xl shadow-sm space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-text-primary">
                ¡Despacho Registrado Exitosamente!
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                El equipo <strong className="font-mono text-emerald-800">{submittedSummary.equipmentCode}</strong> ha sido despachado hacia el proyecto <strong className="text-text-primary">{submittedSummary.projectName}</strong> a cargo de <strong className="text-text-primary">{submittedSummary.responsible}</strong>.
              </p>
              <p className="text-xs text-text-muted pt-1">
                El estado del activo en bodega ha cambiado automáticamente a <strong>"En Campo"</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 active:scale-[0.98] transition-all duration-160 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" strokeWidth={1.75} />
                <span>Despachar Otro Equipo</span>
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
          /* Active Checkout Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs sm:text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* SECCIÓN 1: Selección de Equipo */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    1. Selección de Instrumental en Bodega
                  </h2>
                </div>
                <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                  {availableEquipment.length} disponibles
                </span>
              </div>

              {availableEquipment.length === 0 ? (
                <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/60 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" strokeWidth={1.75} />
                  <p className="text-xs font-bold text-amber-950">No hay instrumental disponible en bodega actualmente.</p>
                  <p className="text-xs text-amber-800">
                    Todos los equipos se encuentran en campo o debes registrarlos primero en el inventario.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/forms/registro-equipo"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary underline hover:text-primary-800"
                    >
                      <span>Ir al Formulario de Alta de Equipos</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-text-secondary">
                    Selecciona el equipo a despachar <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                    required
                  >
                    <option value="">-- Elige un equipo disponible --</option>
                    {availableEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.code} — {eq.name} {eq.brand ? `(${eq.brand})` : ''} {eq.serial_number ? `[S/N: ${eq.serial_number}]` : ''}
                      </option>
                    ))}
                  </select>

                  {selectedEquipment && (
                    <div className="p-3.5 rounded-xl bg-gray-50 border border-border/80 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary bg-primary-50 px-2 py-0.5 rounded border border-primary-100">
                          {selectedEquipment.code}
                        </span>
                        <span className="font-semibold text-text-primary">{selectedEquipment.name}</span>
                      </div>
                      <div className="text-text-muted font-mono text-[11px]">
                        {selectedEquipment.serial_number ? `S/N: ${selectedEquipment.serial_number}` : 'Sin S/N'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: Proyecto Destino y Responsable */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    2. Destino y Responsable en Frente de Obra
                  </h2>
                </div>
                <span className="text-xs font-mono text-text-muted">Ley 1 PROCIMEC</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Proyecto */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    Proyecto Destino <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                    required
                  >
                    <option value="">-- Selecciona el proyecto activo --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `[${p.code}] ` : ''}{p.name} {p.client ? `(${p.client})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Responsable de Campo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">
                    Responsable / Receptor en Campo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={responsibleUserId}
                    onChange={(e) => {
                      setResponsibleUserId(e.target.value);
                      if (e.target.value) setCustomResponsibleName('');
                    }}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  >
                    <option value="">-- Selecciona usuario del equipo --</option>
                    {fieldUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                    <option value="custom">Otro responsable (especificar nombre)</option>
                  </select>
                </div>

                {/* Si selecciona 'custom' o no está en lista */}
                {responsibleUserId === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">
                      Nombre del Receptor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customResponsibleName}
                      onChange={(e) => setCustomResponsibleName(e.target.value)}
                      placeholder="ej. Juan Pérez (Contratista)"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                )}

                {/* Fechas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">
                    Fecha de Despacho <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">
                    Fecha Estimada de Retorno a Bodega
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Checklist Físico de Salida */}
            <div className="card border border-border p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    3. Verificación de Accesorios Entregados
                  </h2>
                </div>
                <span className="text-xs font-mono text-text-muted">Checklist Físico</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Baterías */}
                <div className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <BatteryCharging className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    <span className="text-xs font-bold text-text-primary">Baterías de Litio:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBatteryCount(num)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                          batteryCount === num
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-white border border-border text-text-secondary hover:bg-gray-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cargador */}
                <label className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors">
                  <span className="text-xs font-semibold text-text-primary">Cargador y adaptador CA</span>
                  <input
                    type="checkbox"
                    checked={chargerOk}
                    onChange={(e) => setChargerOk(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>

                {/* Cables */}
                <label className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors">
                  <span className="text-xs font-semibold text-text-primary">Cables de datos y alimentación</span>
                  <input
                    type="checkbox"
                    checked={cablesOk}
                    onChange={(e) => setCablesOk(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>

                {/* Odómetro */}
                <label className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors">
                  <span className="text-xs font-semibold text-text-primary">Rueda odómetro calibrada</span>
                  <input
                    type="checkbox"
                    checked={odometerOk}
                    onChange={(e) => setOdometerOk(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>

                {/* Maletín Pelican */}
                <label className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors">
                  <span className="text-xs font-semibold text-text-primary">Maletín rígido Pelican / Estuche</span>
                  <input
                    type="checkbox"
                    checked={caseOk}
                    onChange={(e) => setCaseOk(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>

                {/* Arnés de Transporte */}
                <label className="p-3.5 rounded-xl border border-border/80 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors">
                  <span className="text-xs font-semibold text-text-primary">Chaleco / Arnés de transporte</span>
                  <input
                    type="checkbox"
                    checked={harnessOk}
                    onChange={(e) => setHarnessOk(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </label>
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-text-secondary">
                  Observaciones de Salida / Condiciones Físicas Iniciales
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ej. Equipo entregado con baterías 100% cargadas, sin rayones en carcasa ni daños en conectores..."
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
                disabled={isSubmitting || availableEquipment.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold hover:bg-primary-800 active:scale-[0.98] transition-all duration-160 shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registrando Despacho...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-accent" strokeWidth={2} />
                    <span>Confirmar Despacho a Campo</span>
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
