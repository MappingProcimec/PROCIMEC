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

// ─── Toast simple ──────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-white text-sm font-medium transition-all animate-slide-up ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
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
    try {
      // El responsable es el email del usuario logueado, las horas siempre 9
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

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al registrar');
      }

      setToast({ message: 'Actividad registrada correctamente', type: 'success' });
      reset({ activity_date: today, is_rework: false });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Error al registrar', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <h1 className="text-white font-bold text-xl">Registrar Actividad de Dibujo</h1>
          <p className="text-blue-100 text-sm mt-0.5">Completa los campos para registrar tu actividad diaria</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Info del usuario */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
            <span className="text-base">👤</span>
            <div>
              <span className="font-semibold">Responsable: </span>
              {session?.user?.email || session?.user?.name || '—'}
              <span className="ml-3 font-semibold">· Horas registradas: </span>
              <span className="font-bold">9 h</span>
            </div>
          </div>

          {/* Sección 1: Datos principales */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              Datos de la actividad
            </h2>

            {/* Proyecto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Proyecto <span className="text-red-500">*</span>
              </label>
              <select
                {...register('project_name')}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  errors.project_name ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <option value="">— Selecciona un proyecto —</option>
                {PROYECTOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {errors.project_name && (
                <p className="text-red-500 text-xs mt-1">{errors.project_name.message}</p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Fecha de desarrollo <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('activity_date')}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  errors.activity_date ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {errors.activity_date && (
                <p className="text-red-500 text-xs mt-1">{errors.activity_date.message}</p>
              )}
            </div>
          </div>

          {/* Sección 2: Software */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              Software utilizado
            </h2>

            {/* Software */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Software <span className="text-red-500">*</span>
              </label>
              <select
                {...register('software')}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  errors.software ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <option value="">— Selecciona software —</option>
                <option value="CIVIL 3D">CIVIL 3D</option>
                <option value="REVIT">REVIT</option>
                <option value="OTRO">OTRO</option>
              </select>
              {errors.software && (
                <p className="text-red-500 text-xs mt-1">{errors.software.message}</p>
              )}
            </div>

            {/* Etapa de elaboración — CIVIL 3D o REVIT */}
            {(software === 'CIVIL 3D' || software === 'REVIT') && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-blue-700 font-semibold text-sm mb-3">
                  📐 Configuración de {software}
                </p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Etapa de elaboración
                  </label>
                  <select
                    {...register('elaboration_stage')}
                    className="w-full border border-blue-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="">— Selecciona etapa —</option>
                    <option value="INICIO">INICIO</option>
                    <option value="PROCESO">PROCESO</option>
                    <option value="FINAL">FINAL</option>
                  </select>
                  {errors.elaboration_stage && (
                    <p className="text-red-500 text-xs mt-1">{errors.elaboration_stage.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Nombre del software — OTRO */}
            {software === 'OTRO' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-amber-700 font-semibold text-sm mb-3">🔧 Otro software</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Nombre del software
                  </label>
                  <input
                    type="text"
                    {...register('other_software_name')}
                    placeholder="Ingresa el nombre del software..."
                    className="w-full border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sección 3: Reproceso */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              Información de reproceso
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                ¿Esta actividad es de reproceso de información? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    value="false"
                    {...register('is_rework', { setValueAs: (v) => v === 'true' })}
                    defaultChecked
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">No</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    value="true"
                    {...register('is_rework', { setValueAs: (v) => v === 'true' })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">Sí</span>
                </label>
              </div>
            </div>

            {/* Observaciones reproceso */}
            {isRework && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-red-700 font-semibold text-sm mb-3">⚠️ Información de reproceso</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Identificación y Observaciones de las Causas del Reproceso{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('rework_observations')}
                    rows={4}
                    placeholder="Especifica las razones y el actor responsable (interno o externo)..."
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none transition ${
                      errors.rework_observations ? 'border-red-400' : 'border-red-200'
                    }`}
                  />
                  {errors.rework_observations && (
                    <p className="text-red-500 text-xs mt-1">{errors.rework_observations.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <span>✓</span>
                Registrar Actividad
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
