'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DSPOptions, calculateVelocity, GainPoint } from '@/lib/gpr/dspEngine';
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
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Filter,
  Layers,
  BarChart,
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

/**
 * Interactive Canvas component for rendering Gain Curve (Amplitude dB vs Time ns)
 * and editing control nodes.
 */
const GainCurveGraph: React.FC<{
  points: GainPoint[];
  twNs: number;
  maxGainDb: number;
  gainMode: string;
  onPointsChange: (pts: GainPoint[]) => void;
}> = ({ points, twNs, maxGainDb, gainMode, onPointsChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const padL = 35;
    const padR = 15;
    const padT = 15;
    const padB = 22;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const baseY = padT + plotH;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Horizontal grid (dB ticks)
    const yTicks = [0, maxGainDb / 2, maxGainDb];
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    yTicks.forEach((dbVal) => {
      const y = baseY - (dbVal / maxGainDb) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(dbVal)}dB`, padL - 4, y);
    });

    // Vertical grid (ns ticks)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = [0, twNs / 2, twNs];
    xTicks.forEach((tVal) => {
      const x = padL + (tVal / twNs) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, baseY);
      ctx.stroke();
      ctx.fillText(`${tVal.toFixed(0)}ns`, x, baseY + 4);
    });
    ctx.setLineDash([]);

    // Curve rendering
    ctx.strokeStyle = '#38bdf8'; // Bright Sky Blue
    ctx.lineWidth = 2;
    ctx.beginPath();

    const numSamples = 60;
    for (let i = 0; i < numSamples; i++) {
      const frac = i / (numSamples - 1);
      const tNs = frac * twNs;
      let dbVal = 0;

      const maxFactor = Math.pow(10, maxGainDb / 20.0);

      if (gainMode === 'linear') {
        const factor = 1.0 + (maxFactor - 1.0) * frac;
        dbVal = 20.0 * Math.log10(factor);
      } else if (gainMode === 'logarithmic') {
        const factor = 1.0 + (maxFactor - 1.0) * (Math.log(1.0 + 9.0 * frac) / Math.LN10);
        dbVal = 20.0 * Math.log10(factor);
      } else if (gainMode === 'power') {
        const factor = 1.0 + (maxFactor - 1.0) * Math.pow(frac, 2);
        dbVal = 20.0 * Math.log10(factor);
      } else if (gainMode === 'custom' && points.length > 0) {
        const sorted = [...points].sort((a, b) => a.timeNs - b.timeNs);
        if (tNs <= sorted[0].timeNs) {
          dbVal = sorted[0].gainDb;
        } else if (tNs >= sorted[sorted.length - 1].timeNs) {
          dbVal = sorted[sorted.length - 1].gainDb;
        } else {
          for (let p = 0; p < sorted.length - 1; p++) {
            if (tNs >= sorted[p].timeNs && tNs <= sorted[p + 1].timeNs) {
              const span = sorted[p + 1].timeNs - sorted[p].timeNs;
              const a = span > 0 ? (tNs - sorted[p].timeNs) / span : 0;
              dbVal = (1 - a) * sorted[p].gainDb + a * sorted[p + 1].gainDb;
              break;
            }
          }
        }
      } else {
        // Auto SEC curve approximation
        const factor = 1.0 + (maxFactor - 1.0) * Math.pow(frac, 1.3);
        dbVal = 20.0 * Math.log10(factor);
      }

      const x = padL + frac * plotW;
      const y = baseY - Math.min(1.0, Math.max(0, dbVal / maxGainDb)) * plotH;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw control point nodes for custom mode
    if (gainMode === 'custom') {
      points.forEach((pt) => {
        const x = padL + (pt.timeNs / twNs) * plotW;
        const y = baseY - Math.min(1.0, Math.max(0, pt.gainDb / maxGainDb)) * plotH;

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
  }, [points, twNs, maxGainDb, gainMode]);

  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gainMode !== 'custom') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const padL = 35;
    const padR = 15;
    const padT = 15;
    const padB = 22;
    const plotW = canvas.width - padL - padR;
    const plotH = canvas.height - padT - padB;
    const baseY = padT + plotH;

    if (clickX < padL || clickX > padL + plotW || clickY < padT || clickY > baseY) return;

    const fracX = (clickX - padL) / plotW;
    const clickNs = parseFloat((fracX * twNs).toFixed(1));

    const fracY = (baseY - clickY) / plotH;
    const clickDb = parseFloat((Math.min(1.0, Math.max(0, fracY)) * maxGainDb).toFixed(1));

    // Update nearest point or modify list
    const updated = points.map((p) => {
      if (Math.abs(p.timeNs - clickNs) < twNs * 0.1) {
        return { ...p, gainDb: clickDb };
      }
      return p;
    });

    onPointsChange(updated);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={260}
        height={115}
        onClick={handleCanvasClick}
        className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl block cursor-pointer shadow-inner"
      />
    </div>
  );
};

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

  // Collapsible Accordion sections for Calibración view (ALL CONTRACTED BY DEFAULT!)
  const [openSections, setOpenSections] = useState<{
    header: boolean;
    geometry: boolean;
    timezero: boolean;
    display: boolean;
  }>({
    header: false,
    geometry: false,
    timezero: false,
    display: false,
  });

  // Collapsible Accordion sections for Procesamiento view (ALL CONTRACTED BY DEFAULT!)
  const [filterOpenSections, setFilterOpenSections] = useState<{
    iir: boolean;
    bkg: boolean;
    gain: boolean;
    dewow: boolean;
    velocity: boolean;
  }>({
    iir: false,
    bkg: false,
    gain: false,
    dewow: false,
    velocity: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleFilterSection = (key: keyof typeof filterOpenSections) => {
    setFilterOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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

  // Set number of points for Custom Gain Curve (3, 5, 8, 10 points)
  const handleSetPointCount = (count: number) => {
    const maxDb = options.maxGainDb || 40.0;
    const newPoints: GainPoint[] = [];

    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const timeNs = parseFloat((frac * currentTwNs).toFixed(1));
      const gainDb = parseFloat((frac * maxDb).toFixed(1));
      newPoints.push({ timeNs, gainDb });
    }

    updateOption('customGainPoints', newPoints);
  };

  // Update specific gain point
  const handleUpdateGainPoint = (index: number, field: 'timeNs' | 'gainDb', val: number) => {
    const points = [...(options.customGainPoints || [])];
    if (index >= 0 && index < points.length) {
      points[index] = {
        ...points[index],
        [field]: val,
      };
      updateOption('customGainPoints', points);
    }
  };

  const handleSetTracesPerMeter = (trm: number) => {
    if (trm <= 0) return;
    const dx = 1.0 / trm;
    updateOption('traceDistanceStepM', dx);
  };

  const handleSetTotalDistanceM = (totalM: number) => {
    if (totalM <= 0 || numTraces <= 0) return;
    const dx = totalM / numTraces;
    updateOption('traceDistanceStepM', dx);
  };

  const handleSetTimeWindowNs = (tw: number) => {
    if (tw <= 0) return;
    updateOption('ventanaNs', tw);
  };

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

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs text-text-secondary">
        {/* ============================================================ */}
        {/* TAB 1: CENTRALIZED CALIBRATION (Collapsible Accordion Cards)  */}
        {/* ============================================================ */}
        {activeTab === 'calibracion' && (
          <div className="space-y-3">
            {/* 1. CABECERA & MUESTRAS (.GSF) */}
            {header && (
              <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
                <button
                  onClick={() => toggleSection('header')}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
                >
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <FileCode className="w-4 h-4 text-primary" />
                    <span>Cabecera & Muestras (.GSF)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-primary text-[9px] px-1.5 py-0.2">
                      {header.byteOffsetData || 512} Bytes
                    </span>
                    {openSections.header ? (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </button>

                {openSections.header && (
                  <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
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
              </div>
            )}

            {/* 2. GEOMETRÍA & ODOMETRÍA */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleSection('geometry')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Ruler className="w-4 h-4 text-primary" />
                  <span>Geometría & Odometría</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {currentTotalDistM.toFixed(2)} m total
                  </span>
                  {openSections.geometry ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {openSections.geometry && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
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
            </div>

            {/* 3. CORRECCIÓN TIME-ZERO */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleSection('timezero')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Corrección Time-Zero (Primer Arribo)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.timeZero}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateOption('timeZero', e.target.checked);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {openSections.timezero ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {openSections.timezero && options.timeZero && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Recorta la demora inicial dejando <code className="font-mono text-primary font-bold">t = 0 ns</code> en el inicio de la variación de amplitud.
                  </p>

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
                      <span>Auto (Primer Arribo)</span>
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

                  {(options.timeZeroMode || 'auto') === 'auto' && (
                    <div className="bg-white p-3 rounded-xl border border-border space-y-1 text-center">
                      <p className="text-[11px] font-semibold text-primary flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Detección Automática Activa</span>
                      </p>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        Ubicación del pulso de sincronización + 2% de los ns del archivo → primera variación de amplitud (&gt;1000).
                      </p>
                    </div>
                  )}

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
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. PALETA DE COLORES & RENDER */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleSection('display')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Palette className="w-4 h-4 text-primary" />
                  <span>Paleta de Colores & Render</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-primary text-[9px] px-1.5 py-0.2 capitalize">
                    {palette}
                  </span>
                  {openSections.display ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {openSections.display && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
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
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: FILTERS DSP / PROCESAMIENTO MODULAR (Accordion Cards) */}
        {/* ============================================================ */}
        {activeTab === 'filters' && (
          <div className="space-y-3">
            {/* ------------------------------------------------------------ */}
            {/* 1. SECCIÓN: FILTROS DE PERFIL (IIR 10 dB)                    */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleFilterSection('iir')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Filter className="w-4 h-4 text-sky-600" />
                  <span>Filtros de Perfil (Filtro IIR)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.bandpass}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateOption('bandpass', e.target.checked);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {filterOpenSections.iir ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {filterOpenSections.iir && options.bandpass && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-border">
                    <span className="text-[10px] text-text-muted font-medium">Atenuación IIR:</span>
                    <span className="badge-primary text-[9px] px-2 py-0.5 font-bold">10 dB Predeterminada</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Pasa-Alto HP (MHz):
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={options.hpCutoffMHz || 100}
                        onChange={(e) => updateOption('hpCutoffMHz', Math.max(1, parseFloat(e.target.value) || 100))}
                        className="input text-xs py-1 font-mono font-bold text-sky-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Pasa-Bajo LP (MHz):
                      </label>
                      <input
                        type="number"
                        step="50"
                        value={options.lpCutoffMHz || 800}
                        onChange={(e) => updateOption('lpCutoffMHz', Math.max(10, parseFloat(e.target.value) || 800))}
                        className="input text-xs py-1 font-mono font-bold text-sky-700"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 2. SECCIÓN: ELIMINACIÓN DE FONDO (BACKGROUND REMOVAL)        */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleFilterSection('bkg')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Eliminar Fondo (Background)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.backgroundRemoval}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateOption('backgroundRemoval', e.target.checked);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {filterOpenSections.bkg ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {filterOpenSections.bkg && options.backgroundRemoval && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Elimina reflectores horizontales estáticos promediando las trazas vecinas.
                  </p>

                  <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-text-primary">Porcentaje de Trazas:</span>
                      <span className="font-mono text-purple-700 font-bold">
                        {options.bkgRemovalPercent || 10}% Trazas
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={options.bkgRemovalPercent || 10}
                      onChange={(e) => updateOption('bkgRemovalPercent', parseInt(e.target.value, 10))}
                      className="w-full accent-purple-600 bg-gray-200 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted font-mono">
                      <span>1% (Filtro Suave)</span>
                      <span>10% (Default)</span>
                      <span>100% (Perfil Completo)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 3. SECCIÓN: FUNCIÓN DE GANANCIA (GAIN FUNCTIONS & SEC)       */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleFilterSection('gain')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Función de Ganancia (Gain)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.secGain}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateOption('secGain', e.target.checked);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {filterOpenSections.gain ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {filterOpenSections.gain && options.secGain && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  {/* Mode Buttons */}
                  <div>
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Tipo de Función de Ganancia:
                    </label>
                    <div className="grid grid-cols-3 gap-1 mb-1">
                      {[
                        { id: 'auto', label: 'Automático' },
                        { id: 'linear', label: 'Lineal' },
                        { id: 'logarithmic', label: 'Log' },
                        { id: 'power', label: 'Potencias' },
                        { id: 'custom', label: 'Personalizada' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateOption('gainMode', m.id as DSPOptions['gainMode'])}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-medium border transition ${
                            (options.gainMode || 'auto') === m.id
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                              : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Max Gain dB Slider (10 to 80 dB) */}
                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-text-primary">Ganancia Máxima (dB):</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {options.maxGainDb || 40} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={options.maxGainDb || 40}
                      onChange={(e) => updateOption('maxGainDb', parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 bg-gray-200 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted font-mono">
                      <span>10 dB</span>
                      <span>40 dB (Default)</span>
                      <span>80 dB (Máx)</span>
                    </div>
                  </div>

                  {/* Interactive Graph Canvas (Amplitude dB vs Time ns) */}
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-text-secondary mb-1">
                      <span>Curva de Ganancia (Amplitud dB vs ns):</span>
                      <span className="font-mono text-sky-600">{options.gainMode || 'auto'}</span>
                    </div>
                    <GainCurveGraph
                      points={options.customGainPoints || []}
                      twNs={currentTwNs}
                      maxGainDb={options.maxGainDb || 40}
                      gainMode={options.gainMode || 'auto'}
                      onPointsChange={(pts) => updateOption('customGainPoints', pts)}
                    />
                  </div>

                  {/* Point Selection Controls & Table for Custom Mode */}
                  {options.gainMode === 'custom' && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Número de Puntos:
                        </label>
                        <div className="flex gap-1">
                          {[3, 5, 8, 10].map((cnt) => (
                            <button
                              key={cnt}
                              onClick={() => handleSetPointCount(cnt)}
                              className={`px-1.5 py-0.5 text-[9px] font-mono rounded border transition ${
                                (options.customGainPoints || []).length === cnt
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                              }`}
                            >
                              {cnt} Pts
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Points Table */}
                      <div className="max-h-32 overflow-y-auto border border-border rounded-xl bg-white p-1">
                        <table className="w-full text-[10px] font-mono">
                          <thead>
                            <tr className="border-b border-border text-text-muted bg-gray-50">
                              <th className="p-1 text-left">Pt #</th>
                              <th className="p-1 text-left">Tiempo (ns)</th>
                              <th className="p-1 text-right">Ganancia (dB)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(options.customGainPoints || []).map((pt, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-1 font-bold text-primary">#{idx + 1}</td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={pt.timeNs}
                                    onChange={(e) => handleUpdateGainPoint(idx, 'timeNs', parseFloat(e.target.value) || 0)}
                                    className="w-16 input text-[10px] py-0 px-1 font-mono"
                                  />
                                </td>
                                <td className="p-1 text-right">
                                  <input
                                    type="number"
                                    step="1"
                                    min={0}
                                    max={options.maxGainDb || 80}
                                    value={pt.gainDb}
                                    onChange={(e) => handleUpdateGainPoint(idx, 'gainDb', parseFloat(e.target.value) || 0)}
                                    className="w-16 input text-[10px] py-0 px-1 font-mono text-right text-emerald-700 font-bold"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 4. SECCIÓN: FILTRO DEWOW (DERIVA DC EN NS)                   */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleFilterSection('dewow')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Filtro Dewow (Remoción DC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.dewow}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateOption('dewow', e.target.checked);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {filterOpenSections.dewow ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {filterOpenSections.dewow && options.dewow && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Elimina la oscilación inicial de baja frecuencia (deriva DC) por saturación de antena.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border">
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Ventana de Tiempo Dewow (ns):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="30"
                        value={options.dewowWindowNs || 5.0}
                        onChange={(e) => updateOption('dewowWindowNs', Math.max(0.5, parseFloat(e.target.value) || 5.0))}
                        className="input text-xs py-1 font-mono font-bold text-amber-700 flex-1"
                      />
                      <span className="text-[10px] font-mono text-text-muted">ns</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 5. SECCIÓN: ANÁLISIS DE VELOCIDAD & MIGRACIÓN                */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleFilterSection('velocity')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <BarChart className="w-4 h-4 text-indigo-600" />
                  <span>Análisis de Velocidad & Migración</span>
                </div>
                <div className="flex items-center gap-2">
                  {filterOpenSections.velocity ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {filterOpenSections.velocity && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-text-primary">Velocidad Estimada:</span>
                      <span className="font-mono text-indigo-700 font-bold">
                        {currentVelocity.toFixed(3)} m/ns
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-text-primary">Permitividad (εr):</span>
                      <span className="font-mono text-primary font-bold">{options.dielectricPermittivity.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={81.0}
                      step={0.5}
                      value={options.dielectricPermittivity}
                      onChange={(e) => updateOption('dielectricPermittivity', parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 bg-gray-200 rounded"
                    />
                  </div>

                  {/* Kirchhoff Migration */}
                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary text-[11px]">Migración Kirchhoff:</span>
                      <input
                        type="checkbox"
                        checked={options.enableMigration}
                        onChange={(e) => updateOption('enableMigration', e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                      />
                    </div>
                    {options.enableMigration && (
                      <div>
                        <label className="text-[10px] text-text-muted block mb-1">
                          Apertura de Migración (Trazas):
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={options.migrationApertureTraces || 10}
                          onChange={(e) => updateOption('migrationApertureTraces', parseInt(e.target.value, 10) || 10)}
                          className="input text-xs py-1 font-mono font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
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
