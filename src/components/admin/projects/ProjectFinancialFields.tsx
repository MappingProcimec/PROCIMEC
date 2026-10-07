'use client';

import React, { useState, useMemo } from 'react';
import { ProjectDeduction } from '@/types';
import {
  DEFAULT_COLOMBIA_DEDUCTIONS,
  computeProjectFinancials,
  formatCOP,
} from '@/lib/projectFinancials';
import {
  BadgePercent,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Coins,
  Info,
  Calculator,
  Lock,
} from 'lucide-react';

interface ProjectFinancialFieldsProps {
  contractValue: string;
  onContractValueChange: (value: string) => void;
  deductions: ProjectDeduction[];
  onDeductionsChange: (deductions: ProjectDeduction[]) => void;
  isAuthorized: boolean;
}

export function ProjectFinancialFields({
  contractValue,
  onContractValueChange,
  deductions,
  onDeductionsChange,
  isAuthorized,
}: ProjectFinancialFieldsProps) {
  const [showDeductionsList, setShowDeductionsList] = useState(true);
  const [newDeductionName, setNewDeductionName] = useState('');
  const [newDeductionPct, setNewDeductionPct] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Computo reactivo instantáneo O(1) en el cliente
  const financials = useMemo(() => {
    return computeProjectFinancials(contractValue, deductions);
  }, [contractValue, deductions]);

  const handleToggleDeduction = (id: string) => {
    if (!isAuthorized) return;
    const updated = deductions.map((d) =>
      d.id === id ? { ...d, applies: !d.applies } : d
    );
    onDeductionsChange(updated);
  };

  const handlePercentageChange = (id: string, rawVal: string) => {
    if (!isAuthorized) return;
    const num = Math.max(0, Math.min(100, parseFloat(rawVal) || 0));
    const updated = deductions.map((d) =>
      d.id === id ? { ...d, percentage: num } : d
    );
    onDeductionsChange(updated);
  };

  const handleRemoveDeduction = (id: string) => {
    if (!isAuthorized) return;
    const updated = deductions.filter((d) => d.id !== id);
    onDeductionsChange(updated);
  };

  const handleAddCustomDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;
    const name = newDeductionName.trim();
    const pct = parseFloat(newDeductionPct);
    if (!name || isNaN(pct) || pct < 0) return;

    const newId = `custom-${Date.now()}`;
    const newDeduction: ProjectDeduction = {
      id: newId,
      name,
      percentage: Math.min(100, Math.max(0, pct)),
      applies: true,
      is_custom: true,
    };

    onDeductionsChange([...deductions, newDeduction]);
    setNewDeductionName('');
    setNewDeductionPct('');
    setShowAddCustom(false);
  };

  const handleResetDefaults = () => {
    if (!isAuthorized) return;
    onDeductionsChange(DEFAULT_COLOMBIA_DEDUCTIONS.map((d) => ({ ...d })));
  };

  if (!isAuthorized) {
    return (
      <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-text-muted flex items-center gap-2">
        <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.75} />
        <span>
          La gestión financiera del contrato y deducciones está reservada exclusivamente para roles de <strong>Administración</strong> y <strong>Gerencia</strong>.
        </span>
      </div>
    );
  }

  const remainingPct = financials.contract_value > 0
    ? Math.max(0, Math.round((100 - financials.deductions_percentage) * 100) / 100)
    : 100;

  return (
    <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-4">
      {/* Encabezado del bloque financiero */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-primary-900">
            <Coins className="w-4 h-4 text-primary-900" strokeWidth={1.75} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-primary-900 flex items-center gap-1.5">
              <span>Gestión Financiera del Proyecto</span>
            </h4>
            <p className="text-[11px] text-text-muted">
              Presupuesto contractual, deducciones tributarias de Colombia y valor neto ejecutable
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3 h-3 text-emerald-700" strokeWidth={1.75} />
          <span>Acceso Gerencial</span>
        </span>
      </div>

      {/* ── 1. VALOR DEL CONTRATO / PROYECTO ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="label text-xs font-bold text-text-primary">
            Valor del Contrato / Valor del Proyecto (COP)
          </label>
          {financials.contract_value > 0 && (
            <span className="text-xs font-mono font-bold text-primary">
              {formatCOP(financials.contract_value)} COP
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-text-muted">
            $
          </span>
          <input
            type="number"
            min="0"
            step="1000"
            value={contractValue}
            onChange={(e) => onContractValueChange(e.target.value)}
            placeholder="0"
            className="input text-sm pl-7 font-mono font-bold text-primary-900 bg-white"
          />
        </div>
        <p className="text-[11px] text-text-muted">
          Monto total bruto acordado en el contrato u orden de servicio antes de aplicar deducciones tributarias o administrativas.
        </p>
      </div>

      {/* ── 2. DEDUCCIONES (COLOMBIA) ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
        <div
          onClick={() => setShowDeductionsList(!showDeductionsList)}
          className="px-3.5 py-2.5 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-accent" strokeWidth={1.75} />
            <span className="text-xs font-bold text-text-primary">
              Deducciones Contractuales y de Ley (Colombia)
            </span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
              {financials.deductions_percentage}% total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-red-600">
              -{formatCOP(financials.deductions_amount)}
            </span>
            {showDeductionsList ? (
              <ChevronUp className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
            )}
          </div>
        </div>

        {showDeductionsList && (
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Activa o ajusta el porcentaje de cada concepto:</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Restablecer predeterminados
              </button>
            </div>

            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {deductions.map((d) => {
                const itemAmount = financials.contract_value > 0 && d.applies
                  ? Math.round(financials.contract_value * (d.percentage / 100))
                  : 0;

                return (
                  <div
                    key={d.id}
                    className={`py-2 px-1 flex items-center justify-between gap-3 transition-colors ${
                      d.applies ? 'bg-amber-50/20' : 'opacity-60'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={d.applies}
                        onChange={() => handleToggleDeduction(d.id)}
                        className="rounded text-primary focus:ring-accent"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-text-primary block truncate">
                          {d.name}
                        </span>
                        {d.is_custom && (
                          <span className="text-[10px] text-text-muted">Personalizada</span>
                        )}
                      </div>
                    </label>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={d.percentage}
                          disabled={!d.applies}
                          onChange={(e) => handlePercentageChange(d.id, e.target.value)}
                          className={`w-16 text-xs px-2 py-1 rounded border text-right font-mono font-bold ${
                            d.applies
                              ? 'bg-white border-gray-300 text-text-primary'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        />
                        <span className="text-xs font-mono text-text-muted font-bold">%</span>
                      </div>

                      <span
                        className={`text-xs font-mono font-semibold w-28 text-right ${
                          d.applies && itemAmount > 0 ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {d.applies && itemAmount > 0 ? `-${formatCOP(itemAmount)}` : '—'}
                      </span>

                      {d.is_custom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDeduction(d.id)}
                          title="Eliminar deducción personalizada"
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agregar deducción custom */}
            {showAddCustom ? (
              <form onSubmit={handleAddCustomDeduction} className="pt-2 border-t border-gray-100 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la deducción (ej. Pro-Hospital)"
                  value={newDeductionName}
                  onChange={(e) => setNewDeductionName(e.target.value)}
                  className="input text-xs flex-1 py-1 px-2.5"
                  autoFocus
                />
                <div className="flex items-center gap-1 w-24">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={newDeductionPct}
                    onChange={(e) => setNewDeductionPct(e.target.value)}
                    className="input text-xs py-1 px-2 font-mono"
                  />
                  <span className="text-xs font-mono font-bold text-text-muted">%</span>
                </div>
                <button
                  type="submit"
                  disabled={!newDeductionName.trim() || !newDeductionPct}
                  className="btn-sm btn-primary text-xs py-1 px-2.5"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="btn-sm btn-ghost text-xs py-1 px-2 text-text-muted"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="pt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 py-0.5"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Agregar deducción personalizada</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. VALOR AUTOMÁTICO PARA EJECUTAR EL PROYECTO (VALOR EJECUCIÓN) ── */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-bold">
            <Calculator className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            <span>Valor para Ejecutar el Proyecto (Valor Ejecución):</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
            {remainingPct}% del contrato
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4 pt-1">
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-accent">
            {formatCOP(financials.execution_value)} COP
          </div>
          <div className="text-right text-[11px] font-mono text-slate-400">
            <div>Bruto: {formatCOP(financials.contract_value)}</div>
            <div className="text-red-400">Deducido: -{formatCOP(financials.deductions_amount)}</div>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-800 flex items-start gap-1.5 text-[11px] text-slate-400 leading-tight">
          <Info className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>
            Este valor es el saldo neto disponible para la operación y costos directos de ejecución tras descontar las retenciones e impuestos configurados.
          </span>
        </div>
      </div>
    </div>
  );
}
