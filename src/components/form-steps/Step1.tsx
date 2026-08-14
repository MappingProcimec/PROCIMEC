'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { step1Schema } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { Step1Input } from '@/lib/validations';

const GPR_EQUIPMENT = ['Akula9000C', 'MALA GPR', 'SIR-4000', 'GSSI StructureScan', 'Otro'];
const FREQUENCIES = ['250 MHz', '400 MHz', '800 MHz', '1.5 GHz', '2.3 GHz', 'Otro'];
const CAPTURE_METHODS = ['Líneas 2D paralelas', 'Mallado 3D', 'Perfil puntual', 'Otro'];
const POSITIONING = ['GNSS RTK', 'Estación Total', 'GPS navegación', 'Cinta métrica', 'Sin posicionamiento'];
const TERRAIN = ['Asfalto', 'Concreto', 'Tierra', 'Grava', 'Césped', 'Mixto', 'Otro'];
const WEATHER = ['Soleado', 'Nublado', 'Lluvia ligera', 'Húmedo', 'Otro'];

interface Step1Props {
  onNext: () => void;
}

export function Step1({ onNext }: Step1Props) {
  const { step1, updateStep1 } = useFormStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: step1,
  });

  const onSubmit = (data: Step1Input) => {
    updateStep1(data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Datos del Operativo</h2>
          <p className="text-sm text-text-muted">Información del equipo y condiciones del levantamiento</p>
        </div>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label label-required">Fecha del levantamiento</label>
          <input type="date" className={`input ${errors.report_date ? 'input-error' : ''}`} {...register('report_date')} />
          {errors.report_date && <p className="error-msg">⚠ {errors.report_date.message}</p>}
        </div>
        <div className="form-group">
          <label className="label label-required">Hora de inicio</label>
          <input type="time" className={`input ${errors.report_time ? 'input-error' : ''}`} {...register('report_time')} />
          {errors.report_time && <p className="error-msg">⚠ {errors.report_time.message}</p>}
        </div>
      </div>

      {/* Operator */}
      <div className="form-group">
        <label className="label label-required">Operador responsable</label>
        <input type="text" className={`input ${errors.operator_name ? 'input-error' : ''}`} placeholder="Nombre completo" {...register('operator_name')} />
        {errors.operator_name && <p className="error-msg">⚠ {errors.operator_name.message}</p>}
      </div>

      {/* GPR Equipment */}
      <div className="form-group">
        <label className="label label-required">Equipo GPR utilizado</label>
        <select className={`select ${errors.gpr_equipment ? 'input-error' : ''}`} {...register('gpr_equipment')}>
          <option value="">Seleccionar equipo...</option>
          {GPR_EQUIPMENT.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {errors.gpr_equipment && <p className="error-msg">⚠ {errors.gpr_equipment.message}</p>}
      </div>

      {/* Frequency */}
      <div className="form-group">
        <label className="label label-required">Frecuencia de antena</label>
        <select className={`select ${errors.antenna_frequency ? 'input-error' : ''}`} {...register('antenna_frequency')}>
          <option value="">Seleccionar frecuencia...</option>
          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {errors.antenna_frequency && <p className="error-msg">⚠ {errors.antenna_frequency.message}</p>}
      </div>

      {/* Capture method */}
      <div className="form-group">
        <label className="label label-required">Método de captura</label>
        <select className={`select ${errors.capture_method ? 'input-error' : ''}`} {...register('capture_method')}>
          <option value="">Seleccionar método...</option>
          {CAPTURE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {errors.capture_method && <p className="error-msg">⚠ {errors.capture_method.message}</p>}
      </div>

      {/* Positioning */}
      <div className="form-group">
        <label className="label label-required">Equipo de posicionamiento</label>
        <select className={`select ${errors.positioning_equipment ? 'input-error' : ''}`} {...register('positioning_equipment')}>
          <option value="">Seleccionar equipo...</option>
          {POSITIONING.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {errors.positioning_equipment && <p className="error-msg">⚠ {errors.positioning_equipment.message}</p>}
      </div>

      {/* Terrain */}
      <div className="form-group">
        <label className="label label-required">Tipo de terreno / superficie</label>
        <select className={`select ${errors.terrain_conditions ? 'input-error' : ''}`} {...register('terrain_conditions')}>
          <option value="">Seleccionar tipo de terreno...</option>
          {TERRAIN.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.terrain_conditions && <p className="error-msg">⚠ {errors.terrain_conditions.message}</p>}
      </div>

      {/* Weather */}
      <div className="form-group">
        <label className="label">Condiciones climáticas</label>
        <select className="select" {...register('weather_conditions')}>
          <option value="">Seleccionar clima...</option>
          {WEATHER.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary btn-lg">
          Siguiente
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </form>
  );
}
