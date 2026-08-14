'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OperationalRow } from '@/types';

const SURFACE_TYPES = ['Asfalto', 'Concreto', 'Tierra', 'Grava', 'Césped', 'Mixto', 'Otro'];

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step2({ onNext, onBack }: Step2Props) {
  const { step2, updateStep2 } = useFormStore();
  const [rows, setRows] = useState<OperationalRow[]>(
    step2.operational_summary.length > 0
      ? step2.operational_summary
      : [{ id: uuidv4(), sector: '', ml: '', m2: '', max_depth_m: '', surface_type: '', observations: '' }]
  );
  const [globalMaxDepth, setGlobalMaxDepth] = useState<number | ''>(step2.global_max_depth);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalML = rows.reduce((s, r) => s + (Number(r.ml) || 0), 0);
  const totalM2 = rows.reduce((s, r) => s + (Number(r.m2) || 0), 0);

  const addRow = () => {
    setRows([...rows, { id: uuidv4(), sector: '', ml: '', m2: '', max_depth_m: '', surface_type: '', observations: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof OperationalRow, value: string | number) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleNext = () => {
    const newErrors: Record<string, string> = {};
    rows.forEach((r, i) => {
      if (!r.sector.trim()) newErrors[`sector_${i}`] = 'Requerido';
    });
    if (rows.length === 0) newErrors.rows = 'Agrega al menos una fila';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateStep2({ operational_summary: rows, global_max_depth: globalMaxDepth });
    onNext();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-1.5 0H3.375m11.25 4.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Resumen Operativo y Volumetría</h2>
          <p className="text-sm text-text-muted">Soporte de facturación — ingresa cada tramo o sector levantado</p>
        </div>
      </div>

      {/* Table — Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="table-base min-w-full">
          <thead>
            <tr>
              <th className="min-w-[160px]">Tramo / Sector</th>
              <th className="min-w-[90px]">ML</th>
              <th className="min-w-[90px]">M²</th>
              <th className="min-w-[130px]">Prof. Máx. (m)</th>
              <th className="min-w-[150px]">Superficie</th>
              <th className="min-w-[180px]">Observaciones</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-primary-50/30">
                <td>
                  <input
                    className={`input text-sm py-1.5 ${errors[`sector_${idx}`] ? 'input-error' : ''}`}
                    placeholder="Ej: Calle Principal"
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
                  <select className="select text-sm py-1.5"
                    value={row.surface_type} onChange={e => updateRow(row.id, 'surface_type', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {SURFACE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <input className="input text-sm py-1.5" placeholder="Notas..."
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
              <td colSpan={4} className="text-sm text-text-muted py-2.5 pl-2">
                <span className="badge badge-accent">Soporte de facturación</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
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
              <input className={`input ${errors[`sector_${idx}`] ? 'input-error' : ''}`} placeholder="Nombre del tramo"
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
              <label className="label">Superficie</label>
              <select className="select" value={row.surface_type} onChange={e => updateRow(row.id, 'surface_type', e.target.value)}>
                <option value="">Seleccionar...</option>
                {SURFACE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Observaciones</label>
              <input className="input" placeholder="Notas adicionales..."
                value={row.observations} onChange={e => updateRow(row.id, 'observations', e.target.value)} />
            </div>
          </div>
        ))}
        {/* Mobile totals */}
        <div className="card p-4 bg-accent/5 border-accent/20">
          <div className="flex justify-between items-center">
            <span className="font-bold text-accent">TOTALES</span>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-xs text-text-muted">ML</p>
                <p className="font-bold text-primary">{totalML.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-muted">M²</p>
                <p className="font-bold text-primary">{totalM2.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add row button */}
      <button onClick={addRow} className="btn-outline w-full">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar fila
      </button>

      {/* Global max depth */}
      <div className="form-group">
        <label className="label">Profundidad máxima global estimada (m)</label>
        <div className="relative max-w-xs">
          <input type="number" min="0" step="0.01" className="input pl-4 pr-10"
            placeholder="0.00"
            value={globalMaxDepth}
            onChange={e => setGlobalMaxDepth(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">m</span>
        </div>
        <p className="text-xs text-text-muted mt-1">Profundidad máxima registrada en todo el levantamiento</p>
      </div>

      {errors.rows && <p className="error-msg">⚠ {errors.rows}</p>}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-ghost">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Anterior
        </button>
        <button type="button" onClick={handleNext} className="btn-primary btn-lg">
          Siguiente
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
