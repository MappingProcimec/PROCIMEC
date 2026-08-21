'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from 'next-auth/react';

// ─── Proyectos disponibles ─────────────────────────────────────────────────────
const PROYECTOS = [
  'TENARIS',
  'VOPAK COLOMBIA BAQ',
  'CARNAVAL SA',
  'EPM COPACABANA',
  'INSPECCION DIQUES',
  'CANAL SANTA CECILIA',
  'CONINSA RH VIA 40-72',
  'LOTE FAN AMARILO',
  'YDN POLICARPA',
  'YDN COLECTOR BOYACA',
  'PIMSA IEB',
  'CARACOLI IEB',
  'CONSORCIO VIAL TPF-CB PUENTES',
  'QUORA AMARILO',
  'COLECTOR SIMON BOLIVAR',
  'CONSTRUTORA COLPATRIA',
  'DESARROLLO',
] as const;

// ─── Schema de validación ──────────────────────────────────────────────────────
const schema = z
  .object({
    project_name: z.string().min(1, 'Selecciona un proyecto'),
    activity_date: z.string().min(1, 'Selecciona la fecha'),
    software: z.enum(['CIVIL 3D', 'REVIT', 'OTRO']),
    elaboration_stage: z.enum(['INICIO', 'PROCESO', 'FINAL']).optional(),
    other_software_name: z.string().optional(),
    is_rework: z.boolean(),
    rework_observations: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.is_rework && !data.rework_observations?.trim()) return false;
      return true;
    },
    {
      message: 'Las observaciones del reproceso son obligatorias',
      path: ['rework_observations'],
    }
  );

type FormData = z.infer<typeof schema>;

// ─── Toast visible en parte superior central ──────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all animate-slide-up border border-white/20 ${
        type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      <span className="text-lg">{type === 'success' ? '🎉' : '⚠️'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-3 opacity-80 hover:opacity-100 font-bold text-base">
        ×
      </button>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function NuevaActividadPage() {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ project: string; software: string } | null>(null);

  // Fecha de hoy en formato YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      activity_date: today,
      is_rework: false,
    },
  });

  const software = watch('software');
  const isRework = watch('is_rework');

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setToast(null);
    try {
      const payload = {
        ...data,
        responsible: session?.user?.email || session?.user?.name || '',
        hours_worked: 9,
      };

      const res = await fetch('/api/dibujo/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Error al registrar la actividad');
      }

      setLastSuccess({ project: data.project_name, software: data.software });
      setToast({ message: '¡Actividad registrada exitosamente!', type: 'success' });
      reset({ activity_date: today, is_rework: false });

      // Scroll arriba suavemente para mostrar el banner de éxito
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Error al registrar', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Hero section */}
      <div className="page-hero">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="badge badge-accent">Área de Dibujo</span>
            <span className="text-white/60 text-xs">Mapping Ingeniería</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Registrar Actividad Diaria
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Completa los datos del levantamiento o modelo técnico desarrollado hoy.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-3xl mx-auto px-4 -mt-10">
        {/* Banner de Éxito Prominente */}
        {lastSuccess && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 shadow-lg animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
                ✓
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-base">¡Actividad registrada con éxito!</p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  Proyecto: <span className="font-semibold">{lastSuccess.project}</span> · Software: <span className="font-semibold">{lastSuccess.software}</span> · <span className="font-bold">9 Horas</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="/dibujo/tablero"
                className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <span>📊</span> Ver en Tablero
              </a>
              <button
                onClick={() => setLastSuccess(null)}
                className="btn-sm btn-ghost text-emerald-800 hover:bg-emerald-100 text-xs"
              >
                Cerrar aviso
              </button>
            </div>
          </div>
        )}
        <div className="card shadow-xl overflow-hidden border border-border">
          {/* Informative Header Banner */}
          <div className="bg-primary-50/70 border-b border-primary-100 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base flex-shrink-0">
                {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Responsable del registro</p>
                <p className="text-sm font-semibold text-text-primary">
                  {session?.user?.name ? `${session.user.name} (${session.user.email})` : session?.user?.email || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-primary-200 shadow-xs">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold text-primary">Jornada: 9 Horas</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-8">
            {/* Sección 1: Datos de la actividad */}
            <div className="space-y-4">
              <div className="section-header">
                <div className="section-icon">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">1. Datos de la Actividad</h2>
                  <p className="text-xs text-text-muted">Selecciona el proyecto y la fecha de ejecución</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Proyecto */}
                <div className="form-group sm:col-span-2">
                  <label className="label label-required">Proyecto</label>
                  <select
                    {...register('project_name')}
                    className={`select ${errors.project_name ? 'input-error' : ''}`}
                  >
                    <option value="">— Selecciona un proyecto —</option>
                    {PROYECTOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {errors.project_name && (
                    <p className="error-msg">⚠️ {errors.project_name.message}</p>
                  )}
                </div>

                {/* Fecha de desarrollo */}
                <div className="form-group sm:col-span-2">
                  <label className="label label-required">Fecha de desarrollo</label>
                  <input
                    type="date"
                    {...register('activity_date')}
                    className={`input ${errors.activity_date ? 'input-error' : ''}`}
                  />
                  {errors.activity_date && (
                    <p className="error-msg">⚠️ {errors.activity_date.message}</p>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Sección 2: Software utilizado */}
            <div className="space-y-4">
              <div className="section-header">
                <div className="section-icon bg-accent-100 text-accent-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.037-.501.08-.75.128m.75-.128a24.393 24.393 0 0110.125 0m-9.75 0V3m.75.128A24.393 24.393 0 0118.75 3.23m-9 0V3m.75.128A24.393 24.393 0 0117.25 3.33m-7.5 0V3m.75.128A24.393 24.393 0 0115.75 3.43m-6 0V3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">2. Software Utilizado</h2>
                  <p className="text-xs text-text-muted">Herramienta de diseño y etapa del entregable</p>
                </div>
              </div>

              {/* Selector de Software */}
              <div className="form-group">
                <label className="label label-required">Software</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['CIVIL 3D', 'REVIT', 'OTRO'] as const).map((sw) => {
                    const selected = software === sw;
                    return (
                      <label
                        key={sw}
                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          selected
                            ? 'border-primary bg-primary-50 text-primary font-bold shadow-sm'
                            : 'border-border bg-white text-text-secondary hover:border-primary-200'
                        }`}
                      >
                        <input
                          type="radio"
                          value={sw}
                          {...register('software')}
                          className="sr-only"
                        />
                        <span className="text-sm font-semibold">{sw}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.software && (
                  <p className="error-msg">⚠️ {errors.software.message}</p>
                )}
              </div>

              {/* Condicional Etapa (CIVIL 3D / REVIT) */}
              {(software === 'CIVIL 3D' || software === 'REVIT') && (
                <div className="bg-primary-50/60 border border-primary-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h11.25" />
                    </svg>
                    <span>Configuración de {software}</span>
                  </div>
                  <div className="form-group">
                    <label className="label">Etapa de elaboración</label>
                    <select
                      {...register('elaboration_stage')}
                      className="select bg-white"
                    >
                      <option value="">— Selecciona etapa —</option>
                      <option value="INICIO">INICIO</option>
                      <option value="PROCESO">PROCESO</option>
                      <option value="FINAL">FINAL</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Condicional OTRO software */}
              {software === 'OTRO' && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654" />
                    </svg>
                    <span>Especificar Software Alternativo</span>
                  </div>
                  <div className="form-group">
                    <label className="label label-required">Nombre del software</label>
                    <input
                      type="text"
                      {...register('other_software_name')}
                      placeholder="Ej: AutoCAD 2D, MicroStation, Navisworks..."
                      className="input bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Sección 3: Reproceso */}
            <div className="space-y-4">
              <div className="section-header">
                <div className="section-icon bg-red-100 text-red-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">3. Información de Reproceso</h2>
                  <p className="text-xs text-text-muted">Indica si la actividad es una re-elaboración o ajuste</p>
                </div>
              </div>

              {/* Radio Pill Selector */}
              <div className="form-group">
                <label className="label label-required">
                  ¿Esta actividad es de reproceso de información?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      !isRework
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-sm'
                        : 'border-border bg-white text-text-secondary hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="false"
                      {...register('is_rework', { setValueAs: (v) => v === 'true' })}
                      defaultChecked
                      className="sr-only"
                    />
                    <span className="text-base">✓</span>
                    <span className="text-sm font-semibold">No (Trabajo regular)</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      isRework
                        ? 'border-red-500 bg-red-50 text-red-800 font-bold shadow-sm'
                        : 'border-border bg-white text-text-secondary hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="true"
                      {...register('is_rework', { setValueAs: (v) => v === 'true' })}
                      className="sr-only"
                    />
                    <span className="text-base">⚠️</span>
                    <span className="text-sm font-semibold">Sí (Es reproceso)</span>
                  </label>
                </div>
              </div>

              {/* Observaciones condicionales */}
              {isRework && (
                <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>Causas y Detalles del Reproceso</span>
                  </div>
                  <div className="form-group">
                    <label className="label label-required">
                      Identificación y Observaciones de las Causas del Reproceso
                    </label>
                    <textarea
                      {...register('rework_observations')}
                      rows={4}
                      placeholder="Especifica las razones y el actor responsable (interno o externo)..."
                      className={`textarea bg-white ${errors.rework_observations ? 'input-error' : ''}`}
                    />
                    {errors.rework_observations && (
                      <p className="error-msg">⚠️ {errors.rework_observations.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary btn-lg w-full text-base font-bold shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando actividad...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Registrar Actividad
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
