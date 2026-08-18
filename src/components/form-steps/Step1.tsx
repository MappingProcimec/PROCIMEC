'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { section1Schema, Section1Input } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OperationalRow } from '@/types';

const EQUIPMENT_OPTIONS = [
  { id: 'GPR', label: 'GPR' },
  { id: 'RD', label: 'RD (Detector Electromagnético)' },
  { id: 'PPR', label: 'PPR' },
  { id: 'Sonda', label: 'Sonda' },
  { id: 'Bosch D-tect 200 C', label: 'Bosch D-tect 200 C' },
  { id: 'Otro', label: 'Otro' },
];

const POSITIONING_OPTIONS = ['GNSS RTK', 'Estación Total', 'GPS Navegación', 'Cinta métrica', 'Sin posicionamiento'];
const TERRAIN_OPTIONS = ['Asfalto', 'Concreto', 'Tierra', 'Grava', 'Césped', 'Mixto', 'Otro'];
const WEATHER_OPTIONS = ['Soleado', 'Nublado', 'Lluvia ligera', 'Húmedo', 'Otro'];
const CAPTURE_OPTIONS = ['Líneas 2D paralelas', 'Mallado 3D', 'Perfil puntual', 'Otro'];

interface Step1Props {
  onNext: () => void;
}

export function Step1({ onNext }: Step1Props) {
  const { section1, updateSection1 } = useFormStore();

  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(
    section1.equipments_used && section1.equipments_used.length > 0
      ? section1.equipments_used
      : ['GPR']
  );

  const [rows, setRows] = useState<OperationalRow[]>(
    section1.operational_summary && section1.operational_summary.length > 0
      ? section1.operational_summary
      : [{ id: uuidv4(), sector: '', ml: '', m2: '', max_depth_m: '', observations: '' }]
  );

  const [globalMaxDepth, setGlobalMaxDepth] = useState<number | ''>(section1.global_max_depth);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Section1Input>({
    resolver: zodResolver(section1Schema),
    defaultValues: {
      report_date: section1.report_date,
      report_time: section1.report_time,
      report_end_time: section1.report_end_time,
      operator_name: section1.operator_name,
      equipments_used: selectedEquipments,
      positioning_equipment: section1.positioning_equipment,
      terrain_conditions: section1.terrain_conditions,
      weather_conditions: section1.weather_conditions,
      capture_method: section1.capture_method,
    },
  });

  const toggleEquipment = (eqId: string) => {
    let updated: string[];
    if (selectedEquipments.includes(eqId)) {
      if (selectedEquipments.length === 1) return; // Must keep at least one
      updated = selectedEquipments.filter(e => e !== eqId);
    } else {
      updated = [...selectedEquipments, eqId];
    }
    setSelectedEquipments(updated);
    setValue('equipments_used', updated, { shouldValidate: true });
  };

  const addRow = () => {
    setRows([...rows, { id: uuidv4(), sector: '', ml: '', m2: '', max_depth_m: '', observations: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof OperationalRow, value: string | number) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const totalML = rows.reduce((s, r) => s + (Number(r.ml) || 0), 0);
  const totalM2 = rows.reduce((s, r) => s + (Number(r.m2) || 0), 0);

  const onSubmit = (data: Section1Input) => {
    // Validate operational summary rows
    const errorsMap: Record<string, string> = {};
    rows.forEach((r, idx) => {
      if (!r.sector.trim()) errorsMap[`sector_${idx}`] = 'Requerido';
    });

    if (Object.keys(errorsMap).length > 0) {
      setRowErrors(errorsMap);
      return;
    }

    updateSection1({
      ...data,
      equipments_used: selectedEquipments,
      operational_summary: rows,
      global_max_depth: globalMaxDepth,
    });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Sección 1 — Datos del Operativo y Volumetría</h2>
          <p className="text-sm text-text-muted">Información general del levantamiento, equipos y metraje ejecutado</p>
        </div>
      </div>

      {/* Date + Times */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="form-group">
          <label className="label">Hora final</label>
          <input type="time" className="input" {...register('report_end_time')} />
        </div>
      </div>

      {/* Operator */}
      <div className="form-group">
        <label className="label label-required">Operador responsable</label>
        <input type="text" className={`input ${errors.operator_name ? 'input-error' : ''}`} placeholder="Nombre del operador" {...register('operator_name')} />
        {errors.operator_name && <p className="error-msg">⚠ {errors.operator_name.message}</p>}
      </div>

      {/* Equipments Used (Multi-select) */}
      <div className="form-group">
        <label className="label label-required">Equipos utilizados (puedes seleccionar varios)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {EQUIPMENT_OPTIONS.map((eq) => {
            const isSelected = selectedEquipments.includes(eq.id);
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => toggleEquipment(eq.id)}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-primary bg-primary-50 text-primary shadow-xs'
                    : 'border-border text-text-secondary hover:border-gray-300'
                }`}
              >
                <span>{eq.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        {errors.equipments_used && <p className="error-msg">⚠ {errors.equipments_used.message}</p>}
      </div>

      {/* Positioning */}
      <div className="form-group">
        <label className="label label-required">Equipo de posicionamiento</label>
        <select className={`select ${errors.positioning_equipment ? 'input-error' : ''}`} {...register('positioning_equipment')}>
          <option value="">Seleccionar equipo de posicionamiento...</option>
          {POSITIONING_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {errors.positioning_equipment && <p className="error-msg">⚠ {errors.positioning_equipment.message}</p>}
      </div>

      {/* Field Conditions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="form-group">
          <label className="label label-required">Tipo de terreno / superficie</label>
          <select className={`select ${errors.terrain_conditions ? 'input-error' : ''}`} {...register('terrain_conditions')}>
            <option value="">Seleccionar terreno...</option>
            {TERRAIN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {errors.terrain_conditions && <p className="error-msg">⚠ {errors.terrain_conditions.message}</p>}
        </div>

        <div className="form-group">
          <label className="label">Condiciones climáticas</label>
          <select className="select" {...register('weather_conditions')}>
            <option value="">Seleccionar clima...</option>
            {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="label label-required">Método de captura</label>
          <select className={`select ${errors.capture_method ? 'input-error' : ''}`} {...register('capture_method')}>
            <option value="">Seleccionar método...</option>
            {CAPTURE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {errors.capture_method && <p className="error-msg">⚠ {errors.capture_method.message}</p>}
        </div>
      </div>

      {/* Resumen Operativo y Volumetría */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-1.5 0H3.375m11.25 4.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
              </svg>
              Resumen Operativo (Metraje y Volumetría)
            </h3>
            <p className="text-xs text-text-muted">Soporte de facturación para el acta de cobro</p>
          </div>
        </div>

        {/* Table — Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table-base min-w-full">
            <thead>
              <tr>
                <th className="min-w-[180px]">Tramo / Sector</th>
                <th className="min-w-[100px]">ML</th>
                <th className="min-w-[100px]">M²</th>
                <th className="min-w-[140px]">Prof. Máx. (m)</th>
                <th className="min-w-[200px]">Observaciones</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-primary-50/30">
                  <td>
                    <input
                      className={`input text-sm py-1.5 ${rowErrors[`sector_${idx}`] ? 'input-error' : ''}`}
                      placeholder="Ej: Calle 100 k0+000 a k0+150"
                      value={row.sector}
                      onChange={e => updateRow(row.id, 'sector', e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" className="input text-sm py-1.5" placeholder="0.00"
                      value={row.ml} onChange={e => updateRow(row.id, 'ml', e.target.value === '' ? '' : Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" className="input text-sm py-1.5" placeholder="0.00"
                      value={row.m2} onChange={e => updateRow(row.id, 'm2', e.target.value === '' ? '' : Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" className="input text-sm py-1.5" placeholder="0.00"
                      value={row.max_depth_m} onChange={e => updateRow(row.id, 'max_depth_m', e.target.value === '' ? '' : Number(e.target.value))} />
                  </td>
                  <td>
                    <input className="input text-sm py-1.5" placeholder="Notas del tramo..."
                      value={row.observations} onChange={e => updateRow(row.id, 'observations', e.target.value)} />
                  </td>
                  <td>
                    <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                      className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-accent/10 border-t-2 border-accent/30 font-semibold">
                <td className="text-right text-sm font-bold text-accent pr-4 py-2.5">TOTALES</td>
                <td className="text-center text-sm font-bold text-primary py-2.5">{totalML.toFixed(2)}</td>
                <td className="text-center text-sm font-bold text-primary py-2.5">{totalM2.toFixed(2)}</td>
                <td colSpan={3} className="text-sm text-text-muted py-2.5 pl-2">
                  <span className="badge badge-accent">Metraje acumulado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {rows.map((row, idx) => (
            <div key={row.id} className="card p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="badge badge-primary">Tramo {idx + 1}</span>
                <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                  className="btn-icon btn-ghost text-error disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="form-group">
                <label className="label label-required">Tramo / Sector</label>
                <input className={`input ${rowErrors[`sector_${idx}`] ? 'input-error' : ''}`} placeholder="Nombre del tramo"
                  value={row.sector} onChange={e => updateRow(row.id, 'sector', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="form-group">
                  <label className="label text-xs">ML</label>
                  <input type="number" min="0" step="0.01" className="input text-sm" placeholder="0.00"
                    value={row.ml} onChange={e => updateRow(row.id, 'ml', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="label text-xs">M²</label>
                  <input type="number" min="0" step="0.01" className="input text-sm" placeholder="0.00"
                    value={row.m2} onChange={e => updateRow(row.id, 'm2', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="label text-xs">Prof. Máx. (m)</label>
                  <input type="number" min="0" step="0.01" className="input text-sm" placeholder="0.00"
                    value={row.max_depth_m} onChange={e => updateRow(row.id, 'max_depth_m', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Observaciones</label>
                <input className="input text-sm" placeholder="Notas del tramo..."
                  value={row.observations} onChange={e => updateRow(row.id, 'observations', e.target.value)} />
              </div>
            </div>
          ))}

          {/* Mobile Totals */}
          <div className="card p-4 bg-accent/5 border-accent/20">
            <div className="flex justify-between items-center">
              <span className="font-bold text-accent text-sm">TOTALES ACUMULADOS</span>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-text-muted">ML</p>
                  <p className="font-bold text-primary text-sm">{totalML.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-muted">M²</p>
                  <p className="font-bold text-primary text-sm">{totalM2.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add row button */}
        <button type="button" onClick={addRow} className="btn-outline w-full mt-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar tramo / sector
        </button>
      </div>

      {/* Global max depth */}
      <div className="form-group">
        <label className="label">Profundidad máxima global alcanzada (m)</label>
        <div className="relative max-w-xs">
          <input type="number" min="0" step="0.01" className="input pl-4 pr-10"
            placeholder="0.00"
            value={globalMaxDepth}
            onChange={e => setGlobalMaxDepth(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">m</span>
        </div>
        <p className="text-xs text-text-muted mt-1">Profundidad máxima alcanzada en todo el levantamiento</p>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary btn-lg">
          Siguiente: Sección 2 (Técnico y Hallazgos)
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l7.5-7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </form>
  );
}
