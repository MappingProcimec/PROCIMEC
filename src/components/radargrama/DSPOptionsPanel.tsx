'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DSPOptions, calculateVelocity, calculateResolution, GainPoint } from '@/lib/gpr/dspEngine';
import { GSFHeader } from '@/lib/gpr/gsfParser';
import { ColorPalette } from './CanvasViewer';
import {
  Sliders,
  Activity,
  Palette,
  Crosshair,
  RefreshCw,
  Radio,
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
  Scan,
  Droplets,
  CircleDot,
  AlertTriangle,
  Grid,
  GitCommit,
  Moon,
} from 'lucide-react';
import {
  DetectionConfig,
  DetectionResults,
  DEFAULT_DETECTION_CONFIG,
} from '@/lib/gpr/detectionTypes';

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
  detectionConfig?: DetectionConfig;
  onDetectionConfigChange?: (cfg: DetectionConfig) => void;
  detectionResults?: DetectionResults;
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
  detectionConfig = DEFAULT_DETECTION_CONFIG,
  onDetectionConfigChange,
  detectionResults,
}) => {
  // Main tabs: Modo (Izquierda), Procesamiento (Centro), Calibración, Detección
  const [activeTab, setActiveTab] = useState<'mode' | 'filters' | 'calibracion' | 'deteccion'>('mode');

  // Detection config state with 300ms debounce
  const [localConfig, setLocalConfig] = useState<DetectionConfig>(detectionConfig);

  useEffect(() => {
    if (detectionConfig) {
      setLocalConfig(detectionConfig);
    }
  }, [detectionConfig]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateDetection = <K extends keyof DetectionConfig, F extends keyof DetectionConfig[K]>(
    category: K,
    field: F,
    value: DetectionConfig[K][F],
    isImmediate = false
  ) => {
    const updated = {
      ...localConfig,
      [category]: {
        ...localConfig[category],
        [field]: value,
      },
    };
    setLocalConfig(updated);

    if (isImmediate) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onDetectionConfigChange?.(updated);
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onDetectionConfigChange?.(updated);
      }, 300);
    }
  };

  // Collapsible Accordion sections for Detección view (ALL CONTRACTED BY DEFAULT!)
  const [detectionOpenSections, setDetectionOpenSections] = useState<{
    brightSpot: boolean;
    hyperbola: boolean;
    delamination: boolean;
    subslabVoid: boolean;
    diffuseScattering: boolean;
    jointInfiltration: boolean;
    dielectricShadow: boolean;
    thicknessVariation: boolean;
    pipeUtility: boolean;
  }>({
    brightSpot: false,
    hyperbola: false,
    delamination: false,
    subslabVoid: false,
    diffuseScattering: false,
    jointInfiltration: false,
    dielectricShadow: false,
    thicknessVariation: false,
    pipeUtility: false,
  });

  const toggleDetectionSection = (key: keyof typeof detectionOpenSections) => {
    setDetectionOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Collapsible Accordion sections for Calibración view (ALL CONTRACTED BY DEFAULT!)
  const [openSections, setOpenSections] = useState<{
    antenna: boolean;
    header: boolean;
    geometry: boolean;
    timezero: boolean;
    display: boolean;
  }>({
    antenna: false, // Predeterminado colapsado según requerimiento
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

  const currentAntennaFreq = options.antennaFreqMHz || (header ? header.antennaFreqMHz : 400) || 400;
  const resolutionInfo = calculateResolution(currentAntennaFreq, options.dielectricPermittivity);

  const handleSelectAntenna = (freq: number, autoSyncFilters: boolean = true) => {
    const res = calculateResolution(freq, options.dielectricPermittivity);
    updateOption('antennaFreqMHz', freq);
    if (header && onHeaderChange) {
      onHeaderChange({
        ...header,
        antennaFreqMHz: freq,
      });
    }
    if (autoSyncFilters) {
      onChange({
        ...options,
        antennaFreqMHz: freq,
        hpCutoffMHz: res.recommendedHpMHz,
        lpCutoffMHz: res.recommendedLpMHz,
        dewowWindowNs: res.recommendedDewowNs,
      });
    }
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
          <span>Panel de Control y Análisis GPR</span>
        </div>
        <button
          onClick={onResetDSP}
          className="p-1.5 hover:bg-gray-200 text-text-secondary hover:text-text-primary rounded-lg transition"
          title="Restablecer Parámetros Predeterminados"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Bar: Modo | Procesamiento | Calibración | Detección */}
      <div className="grid grid-cols-4 bg-gray-100 p-1 border-b border-border text-xs gap-0.5">
        <button
          onClick={() => setActiveTab('mode')}
          className={`py-2 flex items-center justify-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'mode'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Modo de Señal (Dato Crudo / Procesado)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate">Modo</span>
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-2 flex items-center justify-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'filters'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Filtros y Procesamiento DSP"
        >
          <Activity className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate">Procesamiento</span>
        </button>
        <button
          onClick={() => setActiveTab('calibracion')}
          className={`py-2 flex items-center justify-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'calibracion'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Calibración Centralizada (Cabecera, Geometría, Time-Zero, Paleta)"
        >
          <Sliders className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate">Calibración</span>
        </button>
        <button
          onClick={() => setActiveTab('deteccion')}
          className={`py-2 flex items-center justify-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'deteccion'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Detección Automática sobre Perfil"
        >
          <Scan className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate">Detección</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs text-text-secondary">
        {/* ============================================================ */}
        {/* TAB 1: CENTRALIZED CALIBRATION (Collapsible Accordion Cards)  */}
        {/* ============================================================ */}
        {activeTab === 'calibracion' && (
          <div className="space-y-3">
            {/* 0. ANTENA & FRECUENCIA CENTRAL (Akula9000C) */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleSection('antenna')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Radio className="w-4 h-4 text-primary" />
                  <span>Antena & Frecuencia Central</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-primary text-[10px] font-mono font-bold px-2 py-0.5">
                    {currentAntennaFreq} MHz
                  </span>
                  {openSections.antenna ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {openSections.antenna && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10.5px] text-text-muted leading-relaxed">
                    Determina la antena de adquisición. Afecta directamente el límite de resolución vertical de Rayleigh (λ/4), la penetración esperada y el rango de frecuencias de los filtros.
                  </p>

                  <div>
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Antenas PROCIMEC Disponibles:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { freq: 200, label: '200 MHz', desc: 'Profunda (0-6m)' },
                        { freq: 400, label: '400 MHz', desc: 'Estándar (0-3.5m)' },
                        { freq: 500, label: '500 MHz', desc: 'Detalle (0-2.2m)' },
                      ].map((item) => (
                        <button
                          key={item.freq}
                          onClick={() => handleSelectAntenna(item.freq, true)}
                          className={`py-2 px-1 rounded-xl text-xs border transition flex flex-col items-center justify-center text-center ${
                            currentAntennaFreq === item.freq
                              ? 'bg-primary text-white border-primary font-bold shadow-xs'
                              : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                          }`}
                        >
                          <span className="font-bold">{item.label}</span>
                          <span className="text-[8.5px] opacity-85 mt-0.5">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Physical metrics for this antenna */}
                  <div className="p-2.5 bg-white rounded-xl border border-border text-[10px] font-mono space-y-1.5">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Longitud de Onda (λ = v/f):</span>
                      <strong className="text-primary">{(resolutionInfo.wavelengthM * 100).toFixed(1)} cm</strong>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Resolución Vert. Rayleigh (λ/4):</span>
                      <strong className="text-emerald-600">{(resolutionInfo.rayleighResolutionM * 100).toFixed(1)} cm</strong>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Banda IIR Recomendada:</span>
                      <span className="text-text-primary font-bold">
                        {resolutionInfo.recommendedHpMHz} - {resolutionInfo.recommendedLpMHz} MHz
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Ventana Dewow Recomendada:</span>
                      <span className="text-text-primary font-bold">
                        {resolutionInfo.recommendedDewowNs} ns
                      </span>
                    </div>
                  </div>

                  {/* Sync Filters Button */}
                  <button
                    onClick={() => handleSelectAntenna(currentAntennaFreq, true)}
                    className="w-full py-1.5 px-2.5 bg-primary-50 hover:bg-primary-100 text-primary border border-primary-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sincronizar Filtros DSP con Antena ({currentAntennaFreq} MHz)</span>
                  </button>
                </div>
              )}
            </div>

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
            {/* 1. SECCIÓN: FILTRO DEWOW (DERIVA DC EN NS)                   */}
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
                        value={options.dewowWindowNs || 2.0}
                        onChange={(e) => updateOption('dewowWindowNs', Math.max(0.5, parseFloat(e.target.value) || 2.0))}
                        className="input text-xs py-1 font-mono font-bold text-amber-700 flex-1"
                      />
                      <span className="text-[10px] font-mono text-text-muted">ns</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 2. SECCIÓN: FILTROS DE PERFIL (IIR 10 dB)                    */}
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

                  {/* Antenna Adapt Badge */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 text-[10.5px]">
                    <span>Antena: <strong>{currentAntennaFreq} MHz</strong></span>
                    <button
                      onClick={() => {
                        updateOption('hpCutoffMHz', resolutionInfo.recommendedHpMHz);
                        updateOption('lpCutoffMHz', resolutionInfo.recommendedLpMHz);
                      }}
                      className="text-[10px] text-sky-700 hover:text-sky-900 underline font-semibold cursor-pointer"
                      title="Aplicar cortes IIR recomendados para esta antena"
                    >
                      Ajustar a Antena ({resolutionInfo.recommendedHpMHz}-{resolutionInfo.recommendedLpMHz} MHz)
                    </button>
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
            {/* 3. SECCIÓN: ELIMINACIÓN DE FONDO (BACKGROUND REMOVAL)        */}
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
            {/* 4. SECCIÓN: FUNCIÓN DE GANANCIA (GAIN FUNCTIONS & SEC)       */}
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
                  <div>
                    <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                      Modelo de Ganancia:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'auto', label: 'Auto SEC' },
                        { id: 'linear', label: 'Lineal' },
                        { id: 'logarithmic', label: 'Logarítmica' },
                        { id: 'power', label: 'Potencial' },
                        { id: 'custom', label: 'Curva Custom' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateOption('gainMode', m.id as DSPOptions['gainMode'])}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-medium border transition ${
                            (options.gainMode || 'auto') === m.id
                              ? 'bg-primary text-white border-primary font-bold shadow-xs'
                              : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-border">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-text-primary">Ganancia Máxima (dB):</span>
                      <span className="font-mono text-emerald-700 font-bold">
                        {options.maxGainDb || 40.0} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10.0}
                      max={80.0}
                      step={1.0}
                      value={options.maxGainDb || 40.0}
                      onChange={(e) => updateOption('maxGainDb', parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 bg-gray-200 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted font-mono">
                      <span>10 dB (Mín)</span>
                      <span>40 dB (Default)</span>
                      <span>80 dB (Máx)</span>
                    </div>
                  </div>

                  {options.gainMode === 'custom' && (
                    <div className="bg-white p-2.5 rounded-xl border border-border space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                          Curva Personalizada (Nodos)
                        </span>
                        <div className="flex items-center gap-1">
                          {[3, 5, 8].map((cnt) => (
                            <button
                              key={cnt}
                              onClick={() => handleSetPointCount(cnt)}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border transition ${
                                (options.customGainPoints || []).length === cnt
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-gray-50 text-text-secondary border-border hover:bg-gray-100'
                              }`}
                            >
                              {cnt} Pts
                            </button>
                          ))}
                        </div>
                      </div>

                      <GainCurveGraph
                        points={options.customGainPoints || []}
                        twNs={currentTwNs}
                        maxGainDb={options.maxGainDb || 40.0}
                        gainMode={options.gainMode || 'auto'}
                        onPointsChange={(pts) => updateOption('customGainPoints', pts)}
                      />

                      <div className="max-h-36 overflow-y-auto border border-border rounded-xl">
                        <table className="w-full text-[10px]">
                          <thead className="bg-gray-100 text-text-muted border-b border-border sticky top-0">
                            <tr>
                              <th className="py-1 px-2 text-left font-semibold">Nodo</th>
                              <th className="py-1 px-2 text-left font-semibold">Tiempo (ns)</th>
                              <th className="py-1 px-2 text-right font-semibold">Ganancia (dB)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {(options.customGainPoints || []).map((pt, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="py-1 px-2 font-bold text-text-primary">#{idx + 1}</td>
                                <td className="py-1 px-2 font-mono">{pt.timeNs.toFixed(1)} ns</td>
                                <td className="py-1 px-2 text-right">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
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
        {/* TAB 4: DETECCIÓN AUTOMÁTICA SOBRE PERFIL                     */}
        {/* ============================================================ */}
        {activeTab === 'deteccion' && (
          <div className="space-y-3">
            {/* ------------------------------------------------------------ */}
            {/* ROW 1: TUBERÍAS Y SERVICIOS ENTERRADOS                       */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('pipeUtility')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-[11px] shadow-2xs">
                    ⚡
                  </div>
                  <span>Tuberías y Servicios</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.pipeUtility.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('pipeUtility', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                    title="Activar / Desactivar Detección de Tuberías"
                  />
                  {detectionOpenSections.pipeUtility ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.pipeUtility && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5 text-xs">
                  {/* Material Filter */}
                  <div className="space-y-1">
                    <label className="text-text-secondary font-medium text-[11px] block">
                      Filtro de Material:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {([
                        { id: 'all', label: 'Todos' },
                        { id: 'metallic', label: '⚡ Metálicas' },
                        { id: 'plastic', label: '🔸 PVC / PEAD' },
                        { id: 'concrete', label: '🟢 Hormigón' },
                      ] as const).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateDetection('pipeUtility', 'materialFilter', m.id, true)}
                          className={`py-1 px-2 rounded-lg border text-left font-medium transition ${
                            localConfig.pipeUtility.materialFilter === m.id
                              ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                              : 'bg-white text-text-primary border-border hover:bg-gray-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Internal Content (Permittivity) */}
                  <div className="space-y-1">
                    <label className="text-text-secondary font-medium text-[11px] block">
                      Fluido / Contenido Interior:
                    </label>
                    <div className="grid grid-cols-3 gap-1 text-[10.5px]">
                      {([
                        { id: 'empty_gas', label: 'Vacía / Gas', eps: 'ε=1' },
                        { id: 'water', label: 'Agua', eps: 'ε=81' },
                        { id: 'drainage', label: 'Drenaje', eps: 'ε=25' },
                      ] as const).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => updateDetection('pipeUtility', 'pipeContent', c.id, true)}
                          className={`py-1 px-1.5 rounded-lg border text-center font-medium transition flex flex-col items-center ${
                            localConfig.pipeUtility.pipeContent === c.id
                              ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                              : 'bg-white text-text-primary border-border hover:bg-gray-100'
                          }`}
                        >
                          <span className="truncate w-full">{c.label}</span>
                          <span className="text-[9px] opacity-80">{c.eps}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hyperbolic Coherence R² Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-text-secondary text-[11px]">
                      <span>Coherencia Hiperbólica (R²):</span>
                      <strong className="text-text-primary font-mono font-bold">
                        {localConfig.pipeUtility.minCoherenceR2.toFixed(2)}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0.60"
                      max="0.95"
                      step="0.05"
                      value={localConfig.pipeUtility.minCoherenceR2}
                      onChange={(e) =>
                        updateDetection('pipeUtility', 'minCoherenceR2', parseFloat(e.target.value))
                      }
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted">
                      <span>0.60 (Permisivo)</span>
                      <span>0.75 (Estándar)</span>
                      <span>0.95 (Estricto)</span>
                    </div>
                  </div>

                  {/* Max Depth Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-text-secondary text-[11px]">
                      <span>Profundidad Máx. Exploración:</span>
                      <strong className="text-text-primary font-mono font-bold">
                        {localConfig.pipeUtility.maxDepthM.toFixed(1)} m
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.2"
                      value={localConfig.pipeUtility.maxDepthM}
                      onChange={(e) =>
                        updateDetection('pipeUtility', 'maxDepthM', parseFloat(e.target.value))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Physics info */}
                  <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[10.5px] text-amber-900 space-y-1 font-mono">
                    <div className="font-bold flex items-center gap-1 text-amber-950">
                      <span>Criterio Geofísico (ASCE 38-02):</span>
                    </div>
                    <p className="text-[10px] text-amber-800 leading-tight">
                      • Diámetro: D = c · Δt_solera / (2√ε_int)
                      <br />• Metal: Inversión 180° (R ≈ -1.0) y ringing
                      <br />• Plástico: Fase 0° (R &gt; 0, sin inversión)
                    </p>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults?.pipesUtilities
                        ? `${detectionResults.pipesUtilities.count} tuberías (${detectionResults.pipesUtilities.metallicCount} met., ${detectionResults.pipesUtilities.plasticCount} plást.)`
                        : '0 tuberías detectadas'}
                    </span>
                  </div>

                  {/* Mini Legend with yellow variations */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <div className="flex items-center gap-2 flex-wrap text-[9.5px]">
                      <span className="flex items-center gap-1 font-semibold text-amber-600">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs inline-block" style={{ backgroundColor: '#FFE600' }} />
                        Metal (Am. Eléctrico)
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-amber-700">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs inline-block" style={{ backgroundColor: '#FFB703' }} />
                        PVC (Ámbar)
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-lime-700">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs inline-block" style={{ backgroundColor: '#D4E157' }} />
                        Hormigón (Am. Esmeralda)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 2: BRIGHT SPOT (ACUMULACIÓN DE AGUA)                     */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('brightSpot')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  <span>Bright Spot (Acumulación de Agua)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.brightSpot.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('brightSpot', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.brightSpot ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.brightSpot && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Identifica zonas de saturación hídrica mediante alta permitividad (εr ≈ 81), inversión de fase e incremento anómalo de amplitud.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral de Amplitud (A &gt; μ + kσ):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-sky-600">
                          {localConfig.brightSpot.thresholdSigma.toFixed(1)}σ
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.5"
                        max="4.0"
                        step="0.1"
                        value={localConfig.brightSpot.thresholdSigma}
                        onChange={(e) =>
                          updateDetection('brightSpot', 'thresholdSigma', parseFloat(e.target.value))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted font-mono mt-0.5">
                        <span>1.5σ</span>
                        <span>Predet: 2.5σ</span>
                        <span>4.0σ</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <label className="text-[10px] font-semibold text-text-secondary">
                        Filtro de Fase: Solo Invertida (R &lt; 0)
                      </label>
                      <input
                        type="checkbox"
                        checked={localConfig.brightSpot.invertedOnly}
                        onChange={(e) =>
                          updateDetection('brightSpot', 'invertedOnly', e.target.checked, true)
                        }
                        className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Extensión Lateral Máxima (m):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.2"
                          min="0.4"
                          max="15.0"
                          value={localConfig.brightSpot.maxLateralExtentM}
                          onChange={(e) =>
                            updateDetection(
                              'brightSpot',
                              'maxLateralExtentM',
                              Math.max(0.2, parseFloat(e.target.value) || 2.0)
                            )
                          }
                          className="input text-xs py-1 font-mono font-bold text-primary flex-1"
                        />
                        <span className="text-[10px] font-mono text-text-muted">metros</span>
                      </div>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 rounded-xl border border-sky-200 text-sky-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults ? `${detectionResults.brightSpots.count} bright spots detected` : '0 bright spots detected'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="8" width="36" className="flex-shrink-0">
                      <line x1="0" y1="4" x2="36" y2="4" stroke="#00BFFF" strokeWidth="1" strokeDasharray="4,2" />
                    </svg>
                    <span className="truncate">Línea horizontal segmentada cian (1px, #00BFFF)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 2: HIPÉRBOLAS DE DIFRACCIÓN (ACERO / DISCONTINUIDADES)   */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('hyperbola')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <CircleDot className="w-4 h-4 text-rose-500" />
                  <span>Hipérbolas de Difracción (Acero / Discontinuidades)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.hyperbola.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('hyperbola', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.hyperbola ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.hyperbola && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Detección analítica de ramas de difracción t(x) = √(t₀² + 4Δx²/v²) originadas por varillas de acero, tuberías y bordes estructurales.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Tolerancia Desviación Profundidad (Δz):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-rose-600">
                          ±{localConfig.hyperbola.depthDeviationM.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.20"
                        step="0.01"
                        value={localConfig.hyperbola.depthDeviationM}
                        onChange={(e) =>
                          updateDetection('hyperbola', 'depthDeviationM', parseFloat(e.target.value))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral de Amplitud de Ápice (&gt; μ + kσ):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-rose-600">
                          &gt; {localConfig.hyperbola.amplitudeThresholdSigma.toFixed(1)}σ
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="4.0"
                        step="0.1"
                        value={localConfig.hyperbola.amplitudeThresholdSigma}
                        onChange={(e) =>
                          updateDetection('hyperbola', 'amplitudeThresholdSigma', parseFloat(e.target.value))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                          Ratio Asimetría (&gt;):
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="5.0"
                          value={localConfig.hyperbola.asymmetryRatio}
                          onChange={(e) =>
                            updateDetection(
                              'hyperbola',
                              'asymmetryRatio',
                              Math.max(1.0, parseFloat(e.target.value) || 1.3)
                            )
                          }
                          className="input text-xs py-1 font-mono font-bold text-primary w-full"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                          Velocidad Ajuste (m/ns):
                        </label>
                        <input
                          type="number"
                          step="0.005"
                          min="0.05"
                          max="0.25"
                          value={localConfig.hyperbola.velocityFitting}
                          onChange={(e) =>
                            updateDetection(
                              'hyperbola',
                              'velocityFitting',
                              Math.max(0.04, parseFloat(e.target.value) || 0.13)
                            )
                          }
                          className="input text-xs py-1 font-mono font-bold text-primary w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults ? `${detectionResults.hyperbolas.count} anomalous hyperbolas detected` : '0 anomalous hyperbolas detected'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="14" width="14" className="flex-shrink-0">
                      <circle cx="7" cy="7" r="6" fill="#FF4500" stroke="#FFFFFF" strokeWidth="1" />
                    </svg>
                    <span className="truncate">Círculo rojo-naranja (radio 8px, #FF4500)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 3: DELAMINACIÓN (SEPARACIÓN ENTRE CAPAS)                 */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('delamination')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Delaminación (Separación entre Capas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.delamination.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('delamination', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.delamination ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.delamination && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Identifica desprendimientos y huecos milimétricos entre capas de asfalto y losa por atenuación del eco subyacente.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    {/* Fixed Info */}
                    <div className="flex items-center justify-between bg-amber-50/70 p-2 rounded-lg border border-amber-200/80 text-[10px]">
                      <span className="font-semibold text-amber-900">Gap mínimo resoluble:</span>
                      <span className="font-mono font-bold text-amber-800">
                        Δt &gt; 0.33 ns (= 50 mm)
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral Pérdida de Reflexión Profunda:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-amber-700">
                          &gt; {localConfig.delamination.reflectionLossPercent}% caída
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="5"
                        value={localConfig.delamination.reflectionLossPercent}
                        onChange={(e) =>
                          updateDetection('delamination', 'reflectionLossPercent', parseInt(e.target.value, 10))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted font-mono mt-0.5">
                        <span>10%</span>
                        <span>Predet: 40%</span>
                        <span>80%</span>
                      </div>
                    </div>

                    <div className="p-2 bg-gray-50 rounded-lg border border-border text-[10px] text-text-secondary">
                      <span className="font-semibold text-primary">Condición de Fase: </span>
                      <span>Primer pico R &gt; 0 (sin inversión de fase por aire)</span>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults ? `${detectionResults.delaminations.count} delamination zones detected` : '0 delamination zones detected'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="8" width="36" className="flex-shrink-0">
                      <line x1="0" y1="4" x2="36" y2="4" stroke="#FFD700" strokeWidth="1.5" />
                    </svg>
                    <span className="truncate">Línea sólida dorada (1px, #FFD700)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 4: VACÍO SUB-LOSA (ALTA CRITICIDAD)                       */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('subslabVoid')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Vacío Sub-losa (Alta Criticidad)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.subslabVoid.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('subslabVoid', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.subslabVoid ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.subslabVoid && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Cavidad o socavación inferior bajo pavimento rígido. Detecta interfaz concreto-aire R₂ y fondo aire-suelo R₃ con pérdida energética posterior.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    {/* Fixed Info Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                        <span className="text-text-muted block text-[9px]">Altura mín. detectable:</span>
                        <strong className="text-red-700 font-mono">100 mm (Δt = 0.67 ns)</strong>
                      </div>
                      <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                        <span className="text-text-muted block text-[9px]">Umbral Amplitud R₂:</span>
                        <strong className="text-red-700 font-mono">&gt; μ + 2.0σ (sin inv.)</strong>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        R₃ debe seguir dentro de ventana (ns):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-text-muted">Min:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.3"
                            max="2.0"
                            value={localConfig.subslabVoid.r3FollowWindowMinNs}
                            onChange={(e) =>
                              updateDetection(
                                'subslabVoid',
                                'r3FollowWindowMinNs',
                                parseFloat(e.target.value) || 0.67
                              )
                            }
                            className="input text-xs py-1 font-mono font-bold w-full"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-text-muted">Max:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="1.0"
                            max="5.0"
                            value={localConfig.subslabVoid.r3FollowWindowMaxNs}
                            onChange={(e) =>
                              updateDetection(
                                'subslabVoid',
                                'r3FollowWindowMaxNs',
                                parseFloat(e.target.value) || 3.0
                              )
                            }
                            className="input text-xs py-1 font-mono font-bold w-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Pérdida de Señal Bajo R₃:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-red-600">
                          &gt; {localConfig.subslabVoid.signalLossPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        step="5"
                        value={localConfig.subslabVoid.signalLossPercent}
                        onChange={(e) =>
                          updateDetection('subslabVoid', 'signalLossPercent', parseInt(e.target.value, 10))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <label className="text-[10px] font-semibold text-text-secondary">
                        Animación pulsante si umbral crítico IS &gt; 1.0
                      </label>
                      <input
                        type="checkbox"
                        checked={localConfig.subslabVoid.pulsingCritical}
                        onChange={(e) =>
                          updateDetection('subslabVoid', 'pulsingCritical', e.target.checked, true)
                        }
                        className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-red-50 rounded-xl border border-red-200 text-red-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults
                        ? `${detectionResults.subslabVoids.count} voids detected — ${detectionResults.subslabVoids.criticalCount} critical`
                        : '0 voids detected — 0 critical'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="16" width="16" className="flex-shrink-0">
                      <circle cx="8" cy="8" r="6" fill="#FF0000" />
                    </svg>
                    <span className="truncate">Círculo rojo relleno (radio 12px, #FF0000)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 5: SCATTERING DIFUSO (FISURACIÓN MASIVA)                 */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('diffuseScattering')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Grid className="w-4 h-4 text-orange-500" />
                  <span>Scattering Difuso (Fisuración Masiva)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.diffuseScattering.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('diffuseScattering', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.diffuseScattering ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.diffuseScattering && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Identifica dispersión difusa e incoherencia de fase por microfisuras o degradación volumétrica del hormigón.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral Coeficiente Variación CV_A (&gt;):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-orange-600">
                          {localConfig.diffuseScattering.cvaThreshold.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.30"
                        max="0.90"
                        step="0.05"
                        value={localConfig.diffuseScattering.cvaThreshold}
                        onChange={(e) =>
                          updateDetection('diffuseScattering', 'cvaThreshold', parseFloat(e.target.value))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted font-mono mt-0.5">
                        <span>0.30</span>
                        <span>Predet: 0.50</span>
                        <span>0.90</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Extensión Lateral Mínima (m):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="1.0"
                          max="20.0"
                          value={localConfig.diffuseScattering.minLateralExtentM}
                          onChange={(e) =>
                            updateDetection(
                              'diffuseScattering',
                              'minLateralExtentM',
                              Math.max(0.5, parseFloat(e.target.value) || 3.0)
                            )
                          }
                          className="input text-xs py-1 font-mono font-bold text-primary flex-1"
                        />
                        <span className="text-[10px] font-mono text-text-muted">metros</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Caída Energía DC FFT vs Referencia:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-orange-600">
                          &gt; {localConfig.diffuseScattering.fftDcEnergyDropPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        step="5"
                        value={localConfig.diffuseScattering.fftDcEnergyDropPercent}
                        onChange={(e) =>
                          updateDetection(
                            'diffuseScattering',
                            'fftDcEnergyDropPercent',
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div className="p-2 bg-orange-50/60 rounded-lg border border-orange-200/80 text-[10px] text-orange-900">
                      <span className="font-semibold block mb-0.5">Clasificación de Severidad:</span>
                      <span>0.50–0.80 moderada | &gt; 0.80 severa</span>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 rounded-xl border border-orange-200 text-orange-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults
                        ? `${detectionResults.diffuseScattering.count} cracking zones — total ${detectionResults.diffuseScattering.totalAffectedM.toFixed(1)}m affected`
                        : '0 cracking zones — total 0.0m affected'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="12" width="24" className="flex-shrink-0">
                      <rect width="24" height="12" fill="#FF6600" fillOpacity="0.25" />
                    </svg>
                    <span className="truncate">Rectángulo naranja translúcido (#FF6600, 25% opacidad)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 6: INFILTRACIÓN EN JUNTAS (PATRÓN PERIÓDICO)             */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('jointInfiltration')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <GitCommit className="w-4 h-4 text-purple-600" />
                  <span>Infiltración en Juntas (Patrón Periódico)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.jointInfiltration.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('jointInfiltration', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.jointInfiltration ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.jointInfiltration && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Detecta anomalías de humedad recurrentes en juntas de dilatación o contracción con periodicidad L_j.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Espaciado Esperado de Juntas L_j (3 – 8 m):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="3.0"
                          max="8.0"
                          value={localConfig.jointInfiltration.expectedJointSpacingM}
                          onChange={(e) =>
                            updateDetection(
                              'jointInfiltration',
                              'expectedJointSpacingM',
                              Math.max(2.0, Math.min(10.0, parseFloat(e.target.value) || 4.5))
                            )
                          }
                          className="input text-xs py-1 font-mono font-bold text-primary flex-1"
                        />
                        <span className="text-[10px] font-mono text-text-muted">metros</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral Factor IDF (&gt;):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-purple-700">
                          {localConfig.jointInfiltration.idfThreshold.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="6.0"
                        step="0.2"
                        value={localConfig.jointInfiltration.idfThreshold}
                        onChange={(e) =>
                          updateDetection('jointInfiltration', 'idfThreshold', parseFloat(e.target.value))
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted font-mono mt-0.5">
                        <span>1.0</span>
                        <span>Predet: 2.0</span>
                        <span>6.0</span>
                      </div>
                    </div>

                    <div className="p-2 bg-purple-50/70 rounded-lg border border-purple-200/80 text-[10px] text-purple-900">
                      <span>IDF &lt; 2: Bueno | IDF 2–5: Daño moderado | IDF &gt; 5: Crítico</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Ventana Temporal de Análisis:
                      </label>
                      <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
                        <span>{localConfig.jointInfiltration.analysisWindowMinNs} ns</span>
                        <span>–</span>
                        <span>{localConfig.jointInfiltration.analysisWindowMaxNs} ns</span>
                      </div>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-purple-50 rounded-xl border border-purple-200 text-purple-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults
                        ? `${detectionResults.jointInfiltrations.count} infiltrated joints — max IDF: ${detectionResults.jointInfiltrations.maxIdf.toFixed(1)}`
                        : '0 infiltrated joints — max IDF: 0.0'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="14" width="14" className="flex-shrink-0">
                      <circle cx="7" cy="7" r="5" fill="none" stroke="#9B59B6" strokeWidth="2" />
                    </svg>
                    <span className="truncate">Círculo violeta (radio 6px, trazo 2px, #9B59B6)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 7: SOMBRA DIELÉCTRICA (PÉRDIDA PREMATURA DE SEÑAL)       */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('dielectricShadow')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span>Sombra Dieléctrica (Pérdida Prematura de Señal)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.dielectricShadow.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('dielectricShadow', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.dielectricShadow ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.dielectricShadow && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Extinción anticipada del pulso por alta conductividad (suelos arcillosos, humedad salina o escoria metálica).
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral de Pérdida (&lt; % Amplitud Superficie):
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-700">
                          &lt; {localConfig.dielectricShadow.signalLossThresholdPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={localConfig.dielectricShadow.signalLossThresholdPercent}
                        onChange={(e) =>
                          updateDetection(
                            'dielectricShadow',
                            'signalLossThresholdPercent',
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Ventana de Pérdida Sostenida (ns):
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="2"
                        max="15"
                        value={localConfig.dielectricShadow.sustainedLossWindowNs}
                        onChange={(e) =>
                          updateDetection(
                            'dielectricShadow',
                            'sustainedLossWindowNs',
                            Math.max(1, parseInt(e.target.value, 10) || 5)
                          )
                        }
                        className="input text-xs py-1 font-mono font-bold text-primary w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Tiempo de Extinción Crítico t_ext:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-700">
                          &lt; {localConfig.dielectricShadow.criticalExtinctionTimeNs} ns
                        </span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="25"
                        step="1"
                        value={localConfig.dielectricShadow.criticalExtinctionTimeNs}
                        onChange={(e) =>
                          updateDetection(
                            'dielectricShadow',
                            'criticalExtinctionTimeNs',
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                    </div>

                    <div className="p-2 bg-gray-50 rounded-lg border border-border text-[10px] text-text-secondary">
                      <span className="font-semibold text-primary">Estimación de Atenuación: </span>
                      <span>α = (15 - t_ext)/15 mapeado a dB/m</span>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-300 text-slate-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults
                        ? `${detectionResults.dielectricShadows.count} shadow zones — estimated α > 10 dB/m`
                        : '0 shadow zones — estimated α > 10 dB/m'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="14" width="26" className="flex-shrink-0">
                      <rect width="18" height="14" x="4" fill="#808080" fillOpacity="0.2" />
                      <line x1="13" y1="0" x2="13" y2="14" stroke="#808080" strokeWidth="1" strokeDasharray="3,2" />
                    </svg>
                    <span className="truncate">Línea vertical gris (1px, #808080) + banda translúcida (20%)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ROW 8: VARIACIÓN DE ESPESOR (INCONSISTENCIA ESTRUCTURAL)      */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-gray-50 rounded-2xl border border-border overflow-hidden transition shadow-2xs">
              <button
                onClick={() => toggleDetectionSection('thicknessVariation')}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-100/80 transition cursor-pointer select-none text-left"
              >
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Ruler className="w-4 h-4 text-emerald-600" />
                  <span>Variación de Espesor (Inconsistencia Estructural)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.thicknessVariation.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDetection('thicknessVariation', 'enabled', e.target.checked, true);
                    }}
                    className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                  />
                  {detectionOpenSections.thicknessVariation ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </div>
              </button>

              {detectionOpenSections.thicknessVariation && (
                <div className="p-3 pt-0 border-t border-border/60 space-y-3 mt-1.5">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Trazado automático de interfaz asfalto-base t₂(x) y detección de variaciones excesivas de espesor constructivo.
                  </p>

                  <div className="bg-white p-2.5 rounded-xl border border-border space-y-2.5">
                    <div className="flex items-center justify-between bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/80 text-[10px]">
                      <span className="font-semibold text-emerald-900">Seguimiento de Interfaz:</span>
                      <span className="font-mono font-bold text-emerald-800">
                        t₂(x) reflexión asfalto-base [auto]
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                        Ventana Media Móvil (m):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10.0"
                        value={localConfig.thicknessVariation.rollingMeanWindowM}
                        onChange={(e) =>
                          updateDetection(
                            'thicknessVariation',
                            'rollingMeanWindowM',
                            Math.max(0.5, parseFloat(e.target.value) || 2.0)
                          )
                        }
                        className="input text-xs py-1 font-mono font-bold text-primary w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-text-secondary">
                          Umbral de Desviación:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-emerald-700">
                          &gt; ±{localConfig.thicknessVariation.deviationThresholdNs.toFixed(1)} ns
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={localConfig.thicknessVariation.deviationThresholdNs}
                        onChange={(e) =>
                          updateDetection(
                            'thicknessVariation',
                            'deviationThresholdNs',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full accent-primary bg-gray-200 rounded h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted font-mono mt-0.5">
                        <span>0.5 ns</span>
                        <span>Predet: 1.5 ns</span>
                        <span>3.0 ns</span>
                      </div>
                    </div>

                    <div className="p-2 bg-gray-50 rounded-lg border border-border text-[10px] text-text-secondary">
                      <span className="font-semibold text-primary">Equivalencia en Profundidad: </span>
                      <span className="font-mono">
                        Δd = v·Δt/2 = ({(0.13 * localConfig.thicknessVariation.deviationThresholdNs * 50).toFixed(1)} cm a v=0.13)
                      </span>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <span>Resultado:</span>
                    <span>
                      {detectionResults
                        ? `${detectionResults.thicknessVariations.count} thickness anomaly zones — max deviation ±${detectionResults.thicknessVariations.maxDeviationCm.toFixed(1)} cm`
                        : '0 thickness anomaly zones — max deviation ±0.0 cm'}
                    </span>
                  </div>

                  {/* Mini Legend */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100/70 rounded-lg border border-border/70 text-[10px] text-text-secondary">
                    <span className="font-semibold text-text-primary flex-shrink-0">Leyenda:</span>
                    <svg height="10" width="34" className="flex-shrink-0">
                      <line x1="0" y1="5" x2="18" y2="5" stroke="#2ECC71" strokeWidth="1.5" strokeDasharray="2,2" />
                      <line x1="18" y1="5" x2="34" y2="5" stroke="#E74C3C" strokeWidth="1.5" strokeDasharray="2,2" />
                    </svg>
                    <span className="truncate">Curva punteada verde (#2ECC71) / roja (#E74C3C)</span>
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
                <div className="flex justify-between">
                  <span>Antena Central:</span>
                  <span className="font-bold text-amber-700">{currentAntennaFreq} MHz</span>
                </div>
                <div className="flex justify-between">
                  <span>Resolución Vert. (λ/4):</span>
                  <span className="font-bold text-emerald-700">{(resolutionInfo.rayleighResolutionM * 100).toFixed(1)} cm</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
