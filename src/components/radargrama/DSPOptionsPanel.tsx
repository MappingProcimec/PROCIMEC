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
  const [activeTab, setActiveTab] = useState<'mode' | 'geometry' | 'filters' | 'display' | 'header'>('geometry');

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
  const currentTwNs = header ? header.timeWindowNs : options.ventanaNs;
  const currentDepthM = (currentVelocity * currentTwNs) / 2.0;
  const numTraces = header ? header.numTraces : 1000;
  const currentDxM = header ? header.traceDistanceStepM : options.traceDistanceStepM;
  const currentTotalDistM = numTraces * currentDxM;
  const currentTracesPerMeter = currentDxM > 0 ? 1.0 / currentDxM : 112.0;

  // Handle setting explicit traces/meter (111, 112, 111.11, etc.)
  const handleSetTracesPerMeter = (trm: number) => {
    if (trm <= 0) return;
    const dx = 1.0 / trm;
    updateOption('traceDistanceStepM', dx);
    updateHeader('traceDistanceStepM', dx);
    updateHeader('tracesPerMeter', trm);
  };

  // Handle setting total length in meters (e.g. 50m, 100m)
  const handleSetTotalDistanceM = (totalM: number) => {
    if (totalM <= 0 || numTraces <= 0) return;
    const dx = totalM / numTraces;
    const trm = 1.0 / dx;
    updateOption('traceDistanceStepM', dx);
    updateHeader('traceDistanceStepM', dx);
    updateHeader('tracesPerMeter', trm);
  };

  // Handle setting explicit Time Window (ns)
  const handleSetTimeWindowNs = (tw: number) => {
    if (tw <= 0) return;
    const dt = tw / (header ? header.numSamples : 512);
    updateOption('ventanaNs', tw);
    updateHeader('timeWindowNs', tw);
    updateHeader('sampleIntervalNs', dt);
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
      <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Sliders className="w-4 h-4 text-primary" />
          <span>Panel de Calibración GPR</span>
        </div>
        <button
          onClick={onResetDSP}
          className="p-1.5 hover:bg-gray-200 text-text-secondary hover:text-text-primary rounded-lg transition"
          title="Restablecer Parámetros"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="grid grid-cols-5 bg-gray-100 p-1 border-b border-border text-xs gap-0.5">
        <button
          onClick={() => setActiveTab('geometry')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'geometry' ? 'bg-primary text-white shadow-xs font-bold' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Calibración de Distancia y Profundidad"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="text-[10px]">Geometría</span>
        </button>
        <button
          onClick={() => setActiveTab('mode')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'mode' ? 'bg-primary text-white shadow-xs font-bold' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Modo de Visualización"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="text-[10px]">Modo</span>
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'filters' ? 'bg-primary text-white shadow-xs font-bold' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Filtros DSP"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px]">Filtros</span>
        </button>
        <button
          onClick={() => setActiveTab('display')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'display' ? 'bg-primary text-white shadow-xs font-bold' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Paleta y Contraste"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[10px]">Paleta</span>
        </button>
        <button
          onClick={() => setActiveTab('header')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'header' ? 'bg-primary text-white shadow-xs font-bold' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Cabecera Akula GSF"
        >
          <span className="font-mono text-xs font-bold">937B</span>
          <span className="text-[10px]">Cabecera</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-text-secondary">
        {/* TAB 1: GEOMETRY (CALIBRACIÓN DE PROFUNDIDAD Y DISTANCIA) */}
        {activeTab === 'geometry' && (
          <div className="space-y-4">
            {/* 1. Odometría / Distancia Horizontal */}
            <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
              <div>
                <span className="font-bold text-text-primary block text-xs">Calibración de Odometría (Distancia)</span>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Ajusta las trazas por metro o la distancia total real del perfil:
                </p>
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

              {/* Custom Traces/Meter Input */}
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
            </div>

            {/* 2. Permittivity (RDP) & Depth Calibration */}
            <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
              <div>
                <span className="font-bold text-text-primary block text-xs">Calibración de Profundidad & Tiempo</span>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Ajusta la constante dieléctrica (RDP) y la ventana temporal:
                </p>
              </div>

              {/* Permittivity (RDP) */}
              <div>
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>Permitividad relativa (εr / RDP):</span>
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
              </div>

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
                  Hormigón / Suelo (ε=6)
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

              {/* Time Window (ns) Presets */}
              <div>
                <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                  Ventana de Tiempo (Two-Way Time - ns):
                </label>
                <div className="grid grid-cols-4 gap-1 mb-1.5">
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
              </div>

              {/* Custom Time Window & Target Depth */}
              <div className="grid grid-cols-2 gap-2">
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

            {/* Hyperbola Calibration Tool */}
            <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Calibrador de Hipérbola</span>
              <button
                onClick={() => onToggleHyperbolaTool(!showHyperbolaTool)}
                className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs transition shadow-sm ${
                  showHyperbolaTool ? 'bg-accent text-white shadow-glow-accent' : 'bg-white hover:bg-gray-100 text-text-primary border border-border'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>{showHyperbolaTool ? 'Desactivar Hipérbola' : 'Activar Hipérbola sobre Canvas'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MODE */}
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

        {/* TAB 3: FILTERS DSP */}
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
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
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
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
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
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
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
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
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
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
              />
            </div>
          </div>
        )}

        {/* TAB 4: DISPLAY / PALETTE */}
        {activeTab === 'display' && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Paleta de Colores</span>
              <div className="grid grid-cols-2 gap-2">
                {(['seismic', 'grayscale', 'bone', 'sepia', 'jet'] as ColorPalette[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => onPaletteChange(p)}
                    className={`py-2 px-2 rounded-xl border text-xs capitalize transition font-medium ${
                      palette === p
                        ? 'border-primary bg-primary text-white shadow-xs font-bold'
                        : 'border-border bg-white text-text-secondary hover:border-gray-300'
                    }`}
                  >
                    {p === 'seismic' ? 'Seismic (R/W/B)' : p}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
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

            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
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

        {/* TAB 5: HEADER AKULA GSF */}
        {activeTab === 'header' && header && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-2xl border border-border space-y-3">
              <div>
                <span className="font-bold text-text-primary block text-xs">Muestras por Traza</span>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Autodetección por correlación Akula9000C:
                </p>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[256, 512, 1024, 2048].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateHeader('numSamples', s)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-mono font-bold border transition ${
                      header.numSamples === s
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                  Tamaño Cabecera de Archivo:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[937, 1024, 512].map((off) => (
                    <button
                      key={off}
                      onClick={() => updateHeader('byteOffsetData', off)}
                      className={`py-1.5 rounded-lg text-xs font-mono border transition ${
                        header.byteOffsetData === off
                          ? 'bg-primary text-white border-primary font-bold'
                          : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                      }`}
                    >
                      {off} Bytes
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-border text-[11px] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Offset 66 (TW):</span>
                  <span className="text-primary font-bold">{header.ventanaNsHdr ?? 'N/A'} ns</span>
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
                  <span className="text-primary font-bold">{header.totalTrazasHdr ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Paso dx (Offset 406):</span>
                  <span className="text-primary font-bold">{(header.traceDistanceStepM).toFixed(4)} m</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
