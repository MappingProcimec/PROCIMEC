'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { step4Schema } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { Step4Input } from '@/lib/validations';

const FILTER_HINT = 'Ej: Aplicar filtro dewow, ganancia SEC, migración en tiempo, corrección de velocidad de propagación. Perfil de interés entre 0-3m de profundidad.';

interface Step4Props {
  onNext: () => void;
  onBack: () => void;
}

const PRIORITIES = [
  { value: 'Alta', color: 'error', desc: 'Entrega urgente', icon: '🔴' },
  { value: 'Media', color: 'warning', desc: 'Tiempo normal', icon: '🟡' },
  { value: 'Baja', color: 'success', desc: 'Sin urgencia', icon: '🟢' },
] as const;

export function Step4({ onNext, onBack }: Step4Props) {
  const { step4, updateStep4 } = useFormStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step4Input>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      ...step4,
      cad_priority: (step4.cad_priority as string) === '' ? undefined : step4.cad_priority as 'Alta' | 'Media' | 'Baja',
    } as Step4Input,
  });

  const priority = watch('cad_priority');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    updateStep4(data as typeof step4);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Notas para Oficina / CAD</h2>
          <p className="text-sm text-text-muted">Instrucciones para el equipo de posprocesamiento y digitalización</p>
        </div>
      </div>

      {/* Priority */}
      <div className="form-group">
        <label className="label label-required">Prioridad de digitalización</label>
        <div className="grid grid-cols-3 gap-3">
          {PRIORITIES.map(({ value, color, desc, icon }) => (
            <button key={value} type="button"
              onClick={() => setValue('cad_priority', value, { shouldValidate: true })}
              className={`card p-3 text-center transition-all duration-200 border-2 ${
                priority === value
                  ? color === 'error' ? 'border-error bg-red-50 shadow-sm'
                    : color === 'warning' ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-success bg-emerald-50 shadow-sm'
                  : 'border-border hover:border-primary-200'
              }`}>
              <div className="text-2xl mb-1">{icon}</div>
              <div className={`font-bold text-sm ${
                priority === value
                  ? color === 'error' ? 'text-error' : color === 'warning' ? 'text-amber-600' : 'text-success'
                  : 'text-text-primary'
              }`}>{value}</div>
              <div className="text-xs text-text-muted mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
        {errors.cad_priority && (
          <p className="error-msg">⚠ {errors.cad_priority.message}</p>
        )}
        <input type="hidden" {...register('cad_priority')} />
      </div>

      {/* Filter / gain notes */}
      <div className="form-group">
        <label className="label">Recomendaciones de filtrado / ganancia</label>
        <textarea className="textarea min-h-[100px]"
          placeholder={FILTER_HINT}
          {...register('filter_gain_notes')} />
        <p className="text-xs text-text-muted mt-1">
          Incluye parámetros sugeridos de filtros, velocidades de propagación, y rangos de profundidad de interés.
        </p>
      </div>

      {/* Processing recommendations */}
      <div className="form-group">
        <label className="label">Observaciones adicionales para posprocesamiento</label>
        <textarea className="textarea"
          placeholder="Zonas de interés prioritario, condiciones especiales del terreno, interpretaciones preliminares..."
          {...register('processing_recommendations')} />
      </div>

      {/* Elaborated by / Reviewed by */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label label-required">Elaborado por</label>
          <input type="text" className={`input ${errors.elaborated_by ? 'input-error' : ''}`}
            placeholder="Nombre completo"
            {...register('elaborated_by')} />
          {errors.elaborated_by && <p className="error-msg">⚠ {errors.elaborated_by.message}</p>}
        </div>
        <div className="form-group">
          <label className="label">Revisado por</label>
          <input type="text" className="input" placeholder="Nombre del revisor (opcional)"
            {...register('reviewed_by')} />
        </div>
      </div>

      {/* Info card */}
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div>
            <p className="text-primary font-semibold text-sm">Siguiente paso: Carga de archivos</p>
            <p className="text-primary/70 text-xs mt-0.5">
              En el último paso podrás subir los archivos RAW GPR, de posicionamiento y fotografías de campo directamente a Google Drive.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-ghost">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Anterior
        </button>
        <button type="submit" className="btn-primary btn-lg">
          Continuar a Archivos
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </form>
  );
}
