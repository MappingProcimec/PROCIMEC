'use client';

import React, { useState } from 'react';
import { DSPOptions, calculateVelocity } from '@/lib/gpr/dspEngine';
import { GSFHeader } from '@/lib/gpr/gsfParser';
import { ColorPalette } from './CanvasViewer';
import {
  Sliders,
  Activity,
  Palette,
  Crosshair,
  RefreshCw,
  FileSpreadsheet,
  Ruler,
  FileCode,
  Zap,
  Sparkles,
  Clock,
} from 'lucide-react';

interface DSPOptionsPanelProps {
  options: DSPOptions;
  header: GSFHeader | null;
  onChange: (updatedOptions: DSPOptions) => void;
  onHeaderChange?: (updatedHeader: GSFHeader) => void;
  palette: ColorPalette;
  onPaletteChange: (p: ColorPalette) => void;
  contrast: number;
  onContrastChange: (c: number) => void;
  brightness: number;
  onBrightnessChange: (b: number) => void;
  showHyperbolaTool: boolean;
  onToggleHyperbolaTool: (show: boolean) => void;
  onResetDSP: () => void;
}

export const DSPOptionsPanel: React.FC<DSPOptionsPanelProps> = ({
  options,
  header,
  onChange,
  onHeaderChange,
  palette,
  onPaletteChange,
  contrast,
  onContrastChange,
  brightness,
  onBrightnessChange,
  showHyperbolaTool,
  onToggleHyperbolaTool,
  onResetDSP,
}) => {
  // Main tabs: Modo (Izquierda), Procesamiento (Centro), Calibración (Derecha)
  const [activeTab, setActiveTab] = useState<'mode' | 'filters' | 'calibracion'>('mode');

  // Sub-filter for calibration view (Show all or focus on a section)
  const [calibFilter, setCalibFilter] = useState<'all' | 'header' | 'geometry' | 'timezero' | 'display'>('all');

  const updateOption = <K extends keyof DSPOptions>(key: K, value: DSPOptions[K]) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  const updateHeader = <K extends keyof GSFHeader>(key: K, value: GSFHeader[K]) => {
    if (!header || !onHeaderChange) return;
    onHeaderChange({
      ...header,
      [key]: value,
    });
  };

  const currentVelocity = calculateVelocity(options.dielectricPermittivity);
  const currentTwNs = options.ventanaNs || (header ? header.timeWindowNs : 90.0);
  const currentDepthM = (currentVelocity * currentTwNs) / 2.0;
  const numTraces = header ? header.numTraces : 1000;
  const currentDxM = options.traceDistanceStepM || (header ? header.traceDistanceStepM : 1.0 / 112.0);
  const currentTotalDistM = numTraces * currentDxM;
  const currentTracesPerMeter = currentDxM > 0 ? 1.0 / currentDxM : 112.0;

  // Handle setting explicit traces/meter (111, 112, 111.11, etc.)
  const handleSetTracesPerMeter = (trm: number) => {
    if (trm <= 0) return;
    const dx = 1.0 / trm;
    updateOption('traceDistanceStepM', dx);
  };

  // Handle setting total length in meters (e.g. 50m, 100m)
  const handleSetTotalDistanceM = (totalM: number) => {
    if (totalM <= 0 || numTraces <= 0) return;
    const dx = totalM / numTraces;
    updateOption('traceDistanceStepM', dx);
  };

  // Handle setting explicit Time Window (ns)
  const handleSetTimeWindowNs = (tw: number) => {
    if (tw <= 0) return;
    updateOption('ventanaNs', tw);
  };

  // Handle setting target Depth (m) -> calculates TW ns
  const handleSetTargetDepthM = (depthM: number) => {
    if (depthM <= 0) return;
    const tw = (2.0 * depthM) / currentVelocity;
    handleSetTimeWindowNs(tw);
  };

  return (
    <div className="w-80 h-full bg-white border-l border-border flex flex-col shadow-soft overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-gray-50/70">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Sliders className="w-4 h-4 text-primary" />
          <span>Panel de Calibración GPR</span>
        </div>
        <button
          onClick={onResetDSP}
          className="p-1.5 hover:bg-gray-200 text-text-secondary hover:text-text-primary rounded-lg transition"
          title="Restablecer Parámetros Predeterminados"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Bar: Modo (Izquierda) | Procesamiento (Centro) | Calibración (Derecha) */}
      <div className="grid grid-cols-3 bg-gray-100 p-1 border-b border-border text-xs gap-1">
        <button
          onClick={() => setActiveTab('mode')}
          className={`py-2 flex items-center justify-center gap-1.5 rounded-lg font-medium transition ${
            activeTab === 'mode'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Modo de Señal (Dato Crudo / Procesado)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="text-[11px]">Modo</span>
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-2 flex items-center justify-center gap-1.5 rounded-lg font-medium transition ${
            activeTab === 'filters'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Filtros y Procesamiento DSP"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[11px]">Procesamiento</span>
        </button>
        <button
          onClick={() => setActiveTab('calibracion')}
          className={`py-2 flex items-center justify-center gap-1.5 rounded-lg font-medium transition ${
            activeTab === 'calibracion'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Calibración Centralizada (Cabecera, Geometría, Time-Zero, Paleta)"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[11px]">Calibración</span>
        </button>
      </div>

      {/* Quick Section Filter Chips for Calibración View */}
      {activeTab === 'calibracion' && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border-b border-border overflow-x-auto text-[10px]">
          <span className="text-text-muted font-medium mr-0.5">Ver:</span>
          <button
            onClick={() => setCalibFilter('all')}
            className={`px-2 py-0.5 rounded-md font-medium transition ${
              calibFilter === 'all'
                ? 'bg-primary-100 text-primary font-bold'
                : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setCalibFilter('header')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center gap-1 ${
              calibFilter === 'header'
                ? 'bg-primary-100 text-primary font-bold'
                : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            <FileCode className="w-2.5 h-2.5" />
            Cabecera
          </button>
          <button
            onClick={() => setCalibFilter('geometry')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center gap-1 ${
              calibFilter === 'geometry'
                ? 'bg-primary-100 text-primary font-bold'
                : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            <Ruler className="w-2.5 h-2.5" />
            Geometría
          </button>
          <button
            onClick={() => setCalibFilter('timezero')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center gap-1 ${
              calibFilter === 'timezero'
                ? 'bg-primary-100 text-primary font-bold'
                : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            <Zap className="w-2.5 h-2.5 text-amber-500" />
            Time-Zero
          </button>
          <button
            onClick={() => setCalibFilter('display')}
            className={`px-2 py-0.5 rounded-md font-medium transition flex items-center gap-1 ${
              calibFilter === 'display'
                ? 'bg-primary-100 text-primary font-bold'
                : 'text-text-secondary hover:bg-gray-200'
            }`}
          >
            <Palette className="w-2.5 h-2.5" />
            Paleta
          </button>
        </div>
      )}

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs text-text-secondary">
        {/* ============================================================ */}
        {/* TAB 1: CENTRALIZED CALIBRATION (Cabecera, Geometría, T-Zero, Paleta) */}
        {/* ============================================================ */}
        {activeTab === 'calibracion' && (
          <div className="space-y-4">
            {/* ------------------------------------------------------------ */}
            {/* 1. SECCIÓN: CABECERA & MUESTRAS (.GSF)                       */}
            {/* ------------------------------------------------------------ */}
            {(calibFilter === 'all' || calibFilter === 'header') && header && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <FileCode className="w-3.5 h-3.5 text-primary" />
                    <span>Cabecera & Muestras (.GSF)</span>
                  </div>
                  <span className="badge-primary text-[9px] px-1.5 py-0.2">
                    {header.byteOffsetData || 512} Bytes
                  </span>
                </div>

                {/* Header Size Selector (512 Bytes Default) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-semibold text-text-secondary">
                      Tamaño Cabecera de Archivo:
                    </label>
                    <span className="text-[9px] text-emerald-600 font-medium">
                      512 Bytes Predeterminado
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[512, 1024, 937].map((off) => (
                      <button
                        key={off}
                        onClick={() => updateHeader('byteOffsetData', off)}
                        className={`py-1.5 rounded-xl text-xs font-mono border transition flex flex-col items-center justify-center ${
                          (header.byteOffsetData || 512) === off
                            ? 'bg-primary text-white border-primary font-bold shadow-xs'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        <span>{off} Bytes</span>
                        {off === 512 && (
                          <span className="text-[8px] font-sans font-normal opacity-90">
                            Predeterminado
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Samples per trace */}
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                    Muestras por Traza (Geometry):
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[512, 256, 1024, 2048].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateHeader('numSamples', s)}
                        className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition flex flex-col items-center justify-center ${
                          header.numSamples === s
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        <span>{s}</span>
                        {s === 512 && (
                          <span className="text-[8px] font-sans font-normal opacity-90">
                            Default
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hardware Offsets Preview */}
                <div className="p-2.5 bg-white rounded-xl border border-border text-[10px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Offset 66 (OWT → TWT):</span>
                    <span className="text-primary font-bold">
                      {header.ventanaNsHdr != null ? `${header.ventanaNsHdr} ns → ${header.timeWindowNs} ns` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Offset 84 (Muestras):</span>
                    <span className="text-primary font-bold">{header.muestrasHdr ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Offset 86 (εr RDP):</span>
                    <span className="text-primary font-bold">{header.erHdr ? header.erHdr.toFixed(2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Offset 344 (Trazas):</span>
                    <span className="text-primary font-bold">{header.totalTrazasHdr ?? header.numTraces}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Paso dx (Offset 406):</span>
                    <span className="text-primary font-bold">{header.traceDistanceStepM.toFixed(4)} m</span>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 2. SECCIÓN: GEOMETRÍA & ODOMETRÍA                           */}
            {/* ------------------------------------------------------------ */}
            {(calibFilter === 'all' || calibFilter === 'geometry') && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <Ruler className="w-3.5 h-3.5 text-primary" />
                    <span>Geometría & Odometría</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {currentTotalDistM.toFixed(2)} m total
                  </span>
                </div>

                {/* Presets for Traces/Meter */}
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                    Presets de Odómetro (Trazas/Metro):
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[111.0, 111.11, 112.0, 100.0].map((trm) => (
                      <button
                        key={trm}
                        onClick={() => handleSetTracesPerMeter(trm)}
                        className={`py-1.5 rounded-lg text-[10px] font-mono border transition ${
                          Math.abs(currentTracesPerMeter - trm) < 0.2
                            ? 'bg-primary text-white border-primary font-bold shadow-xs'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        {trm} tr/m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Traces/Meter & Total Distance Input */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Trazas / Metro:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={parseFloat(currentTracesPerMeter.toFixed(2))}
                      onChange={(e) => handleSetTracesPerMeter(parseFloat(e.target.value) || 112.0)}
                      className="input text-xs py-1 font-mono font-bold text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Distancia Total (m):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={parseFloat(currentTotalDistM.toFixed(2))}
                      onChange={(e) => handleSetTotalDistanceM(parseFloat(e.target.value) || 10.0)}
                      className="input text-xs py-1 font-mono font-bold text-emerald-700"
                    />
                  </div>
                </div>

                {/* Permittivity (RDP) & Depth Calibration */}
                <div className="pt-1 border-t border-border space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-text-primary">Permitividad Relativa (εr):</span>
                    <span className="font-mono text-primary font-bold">{options.dielectricPermittivity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={81.0}
                    step={0.5}
                    value={options.dielectricPermittivity}
                    onChange={(e) => updateOption('dielectricPermittivity', parseFloat(e.target.value))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />

                  {/* RDP Presets */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => updateOption('dielectricPermittivity', 4.0)}
                      className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[10px] border border-border text-left transition"
                    >
                      Arena Seca (ε=4)
                    </button>
                    <button
                      onClick={() => updateOption('dielectricPermittivity', 6.0)}
                      className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[10px] border border-border text-left transition font-bold text-primary"
                    >
                      Hormigón (ε=6)
                    </button>
                    <button
                      onClick={() => updateOption('dielectricPermittivity', 9.0)}
                      className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[10px] border border-border text-left transition"
                    >
                      Suelo Húmedo (ε=9)
                    </button>
                    <button
                      onClick={() => updateOption('dielectricPermittivity', 16.0)}
                      className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[10px] border border-border text-left transition"
                    >
                      Arcilla (ε=16)
                    </button>
                  </div>
                </div>

                {/* Time Window Presets & Inputs */}
                <div className="pt-1 border-t border-border space-y-2">
                  <label className="text-[10px] font-semibold text-text-secondary block mb-0.5">
                    Ventana de Tiempo (Two-Way Time - ns):
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[30, 50, 70, 90, 100, 120, 150].map((tw) => (
                      <button
                        key={tw}
                        onClick={() => handleSetTimeWindowNs(tw)}
                        className={`py-1 rounded-lg text-[10px] font-mono border transition ${
                          Math.abs(currentTwNs - tw) < 2
                            ? 'bg-primary text-white border-primary font-bold'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        {tw} ns
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Ventana (ns):
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={parseFloat(currentTwNs.toFixed(1))}
                        onChange={(e) => handleSetTimeWindowNs(parseFloat(e.target.value) || 90.0)}
                        className="input text-xs py-1 font-mono font-bold text-amber-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Prof. Máx (m):
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={parseFloat(currentDepthM.toFixed(2))}
                        onChange={(e) => handleSetTargetDepthM(parseFloat(e.target.value) || 2.5)}
                        className="input text-xs py-1 font-mono font-bold text-purple-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Hyperbola Tool */}
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => onToggleHyperbolaTool(!showHyperbolaTool)}
                    className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs transition shadow-sm ${
                      showHyperbolaTool
                        ? 'bg-accent text-white shadow-glow-accent'
                        : 'bg-white hover:bg-gray-100 text-text-primary border border-border'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{showHyperbolaTool ? 'Desactivar Hipérbola' : 'Activar Hipérbola sobre Canvas'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 3. SECCIÓN: CORRECCIÓN TIME-ZERO (TIEMPO CERO)               */}
            {/* ------------------------------------------------------------ */}
            {(calibFilter === 'all' || calibFilter === 'timezero') && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Corrección Time-Zero (Primer Arribo)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.timeZero}
                    onChange={(e) => updateOption('timeZero', e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                    title="Activar o desactivar corte de Time-Zero"
                  />
                </div>

                {options.timeZero && (
                  <div className="space-y-2.5">
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      Recorta la demora inicial dejando <code className="font-mono text-primary font-bold">t = 0 ns</code> en el inicio de la variación de amplitud (arribo directo).
                    </p>

                    {/* Mode Selector: Auto vs Manual */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => updateOption('timeZeroMode', 'auto')}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border transition flex items-center justify-center gap-1 ${
                          (options.timeZeroMode || 'auto') === 'auto'
                            ? 'bg-primary text-white border-primary font-bold shadow-xs'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>Auto (Línea Sync)</span>
                      </button>
                      <button
                        onClick={() => updateOption('timeZeroMode', 'manual')}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border transition flex items-center justify-center gap-1 ${
                          options.timeZeroMode === 'manual'
                            ? 'bg-primary text-white border-primary font-bold shadow-xs'
                            : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                        }`}
                      >
                        <Clock className="w-3 h-3 text-sky-300" />
                        <span>Manual (ns)</span>
                      </button>
                    </div>

                    {/* Auto Mode Controls (Línea Blanca Sync + Margen) */}
                    {(options.timeZeroMode || 'auto') === 'auto' && (
                      <div className="bg-white p-2.5 rounded-xl border border-border space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-text-primary">Margen tras Línea Blanca:</span>
                          <span className="font-mono text-amber-600 font-bold">
                            +{(options.timeZeroMarginNs ?? 2.5).toFixed(1)} ns
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0.0}
                          max={10.0}
                          step={0.5}
                          value={options.timeZeroMarginNs ?? 2.5}
                          onChange={(e) => updateOption('timeZeroMarginNs', parseFloat(e.target.value))}
                          className="w-full accent-amber-500 bg-gray-200 rounded cursor-pointer"
                        />

                        {/* Presets: +1.0ns, +2.5ns, +4.0ns, +5.0ns */}
                        <div className="grid grid-cols-4 gap-1 pt-1">
                          {[1.0, 2.5, 4.0, 5.0].map((m) => (
                            <button
                              key={m}
                              onClick={() => updateOption('timeZeroMarginNs', m)}
                              className={`py-1 rounded-lg text-[10px] font-mono border transition ${
                                Math.abs((options.timeZeroMarginNs ?? 2.5) - m) < 0.2
                                  ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs'
                                  : 'bg-gray-100 hover:bg-gray-200 text-text-secondary border-border'
                              }`}
                            >
                              +{m} ns
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual Controls */}
                    {options.timeZeroMode === 'manual' && (
                      <div className="bg-white p-2.5 rounded-xl border border-border space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-text-primary">Inicio Time-Zero (ns):</span>
                          <span className="font-mono text-amber-600 font-bold">
                            {(options.timeZeroCustomNs || 0).toFixed(2)} ns / {currentTwNs.toFixed(1)} ns
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={currentTwNs}
                          step={0.1}
                          value={options.timeZeroCustomNs || 0}
                          onChange={(e) => updateOption('timeZeroCustomNs', parseFloat(e.target.value))}
                          className="w-full accent-amber-500 bg-gray-200 rounded cursor-pointer"
                        />

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            max={currentTwNs}
                            value={parseFloat((options.timeZeroCustomNs || 0).toFixed(2))}
                            onChange={(e) => updateOption('timeZeroCustomNs', Math.max(0, Math.min(currentTwNs, parseFloat(e.target.value) || 0)))}
                            className="input text-xs py-1 font-mono font-bold text-amber-700 flex-1"
                          />
                        </div>

                        {/* Quick Presets: 0ns, Mitad ns, Total ns */}
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          <button
                            onClick={() => updateOption('timeZeroCustomNs', 0)}
                            className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 text-text-secondary rounded-lg text-[10px] transition font-mono"
                          >
                            0 ns
                          </button>
                          <button
                            onClick={() => updateOption('timeZeroCustomNs', parseFloat((currentTwNs / 2).toFixed(1)))}
                            className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] transition font-mono font-bold"
                          >
                            Mitad ({(currentTwNs / 2).toFixed(1)}ns)
                          </button>
                          <button
                            onClick={() => updateOption('timeZeroCustomNs', parseFloat(currentTwNs.toFixed(1)))}
                            className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 text-text-secondary rounded-lg text-[10px] transition font-mono"
                          >
                            Total ({currentTwNs.toFixed(1)}ns)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 4. SECCIÓN: PALETA DE COLORES & VISUALIZACIÓN                */}
            {/* ------------------------------------------------------------ */}
            {(calibFilter === 'all' || calibFilter === 'display') && (
              <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <Palette className="w-3.5 h-3.5 text-primary" />
                    <span>Paleta de Colores & Render</span>
                  </div>
                  <span className="badge-primary text-[9px] px-1.5 py-0.2 capitalize">
                    {palette}
                  </span>
                </div>

                {/* Palettes: Grayscale default */}
                <div className="grid grid-cols-2 gap-2">
                  {(['grayscale', 'seismic', 'bone', 'sepia', 'jet'] as ColorPalette[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => onPaletteChange(p)}
                      className={`py-2 px-2 rounded-xl border text-xs capitalize transition font-medium ${
                        palette === p
                          ? 'border-primary bg-primary text-white shadow-xs font-bold'
                          : 'border-border bg-white text-text-secondary hover:border-gray-300'
                      }`}
                    >
                      {p === 'grayscale' ? 'Escala Grises (Default)' : p === 'seismic' ? 'Seismic (R/W/B)' : p}
                    </button>
                  ))}
                </div>

                {/* Contrast Slider */}
                <div className="pt-1 border-t border-border space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-text-primary">Contraste:</span>
                    <span className="font-mono text-primary font-bold">{contrast.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={4.0}
                    step={0.1}
                    value={contrast}
                    onChange={(e) => onContrastChange(parseFloat(e.target.value))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>

                {/* Brightness Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-text-primary">Brillo:</span>
                    <span className="font-mono text-primary font-bold">{brightness}</span>
                  </div>
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    step={5}
                    value={brightness}
                    onChange={(e) => onBrightnessChange(parseInt(e.target.value, 10))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: FILTERS DSP                                           */}
        {/* ============================================================ */}
        {activeTab === 'filters' && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Filtro Dewow</span>
                <span className="text-[10px] text-text-muted">Elimina deriva DC de cada traza</span>
              </div>
              <input
                type="checkbox"
                checked={options.dewow}
                onChange={(e) => updateOption('dewow', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Corrección Time-Zero</span>
                <span className="text-[10px] text-text-muted">Alinea el pico de arribo directo</span>
              </div>
              <input
                type="checkbox"
                checked={options.timeZero}
                onChange={(e) => updateOption('timeZero', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Ganancia SEC (Energía)</span>
                <span className="text-[10px] text-text-muted">Compensa atenuación geométrica e intrínseca</span>
              </div>
              <input
                type="checkbox"
                checked={options.secGain}
                onChange={(e) => updateOption('secGain', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Filtro Pasa-Banda</span>
                <span className="text-[10px] text-text-muted">Suavizado Butterworth / FIR</span>
              </div>
              <input
                type="checkbox"
                checked={options.bandpass}
                onChange={(e) => updateOption('bandpass', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Background Removal</span>
                <span className="text-[10px] text-text-muted">Resta reflectores estáticos horizontales</span>
              </div>
              <input
                type="checkbox"
                checked={options.backgroundRemoval}
                onChange={(e) => updateOption('backgroundRemoval', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: MODE & SYSTEM SPECS                                   */}
        {/* ============================================================ */}
        {activeTab === 'mode' && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-2.5">
              <span className="font-bold text-text-primary block text-xs">Modo de Señal</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateOption('mode', 'crudo')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                    options.mode === 'crudo'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                  }`}
                >
                  <span>Dato Crudo</span>
                  <span className="text-[10px] font-normal opacity-80">(Binario Original)</span>
                </button>
                <button
                  onClick={() => updateOption('mode', 'procesado')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                    options.mode === 'procesado'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                  }`}
                >
                  <span>Procesado DSP</span>
                  <span className="text-[10px] font-normal opacity-80">(Filtros GPR)</span>
                </button>
              </div>
            </div>

            {header && (
              <div className="p-3 bg-primary-50 rounded-2xl border border-primary-200 text-[11px] font-mono space-y-1.5 text-primary">
                <div className="flex justify-between font-bold">
                  <span>Equipo:</span>
                  <span>Geoscanners Akula9000C</span>
                </div>
                <div className="flex justify-between">
                  <span>Cabecera:</span>
                  <span>{header.byteOffsetData} Bytes</span>
                </div>
                <div className="flex justify-between">
                  <span>Trazas Totales:</span>
                  <span className="font-bold">{header.numTraces}</span>
                </div>
                <div className="flex justify-between">
                  <span>Muestras / Traza:</span>
                  <span className="font-bold">{header.numSamples}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dieléctrico (εr):</span>
                  <span>{options.dielectricPermittivity.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Velocidad (v):</span>
                  <span>{currentVelocity.toFixed(3)} m/ns</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
