'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DSPOptions, calculateVelocity } from '@/lib/gpr/dspEngine';
import { ColorPalette } from './CanvasViewer';
import {
  Sliders,
  Activity,
  Layers,
  Zap,
  Globe,
  Palette,
  Crosshair,
  RefreshCw,
} from 'lucide-react';

interface DSPOptionsPanelProps {
  options: DSPOptions;
  onChange: (updatedOptions: DSPOptions) => void;
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
  onChange,
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
  const [activeTab, setActiveTab] = useState<'filters' | 'gain' | 'geometry' | 'migration' | 'display'>('filters');

  // Custom Gain Curve Canvas Ref
  const gainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to update DSP options field
  const updateOption = <K extends keyof DSPOptions>(key: K, value: DSPOptions[K]) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  const currentVelocity = calculateVelocity(options.dielectricPermittivity);

  // Draw custom gain curve canvas
  useEffect(() => {
    if (activeTab !== 'gain' || options.gainType !== 'custom') return;
    const canvas = gainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Draw Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw Curve
    const pts = options.customGainCurve || [1, 1, 1, 1, 1];
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < pts.length; i++) {
      const x = (i / (pts.length - 1)) * w;
      // Gain 0 to 10 mapped to y=h to y=0
      const y = h - (pts[i] / 10) * h;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw control nodes
    for (let i = 0; i < pts.length; i++) {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (pts[i] / 10) * h;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [activeTab, options.gainType, options.customGainCurve]);

  // Handle custom gain curve canvas click to adjust node
  const handleGainCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = gainCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const pts = [...(options.customGainCurve || [1, 1, 1, 1, 1])];
    const segmentWidth = rect.width / (pts.length - 1);
    const closestIdx = Math.min(pts.length - 1, Math.max(0, Math.round(clickX / segmentWidth)));

    const newGain = Math.max(0.1, Math.min(10.0, (1 - clickY / rect.height) * 10));
    pts[closestIdx] = parseFloat(newGain.toFixed(1));

    updateOption('customGainCurve', pts);
  };

  return (
    <div className="w-80 h-full bg-slate-900/95 border-l border-slate-800 flex flex-col backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
          <Sliders className="w-4 h-4 text-sky-400" />
          <span>Panel de Procesamiento DSP</span>
        </div>
        <button
          onClick={onResetDSP}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
          title="Restablecer Filtros DSP"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="grid grid-cols-5 bg-slate-950 p-1 border-b border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-2 flex flex-col items-center gap-1 rounded font-medium transition ${
            activeTab === 'filters' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Filtros"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px]">Filtros</span>
        </button>
        <button
          onClick={() => setActiveTab('gain')}
          className={`py-2 flex flex-col items-center gap-1 rounded font-medium transition ${
            activeTab === 'gain' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Ganancia"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[10px]">Ganancia</span>
        </button>
        <button
          onClick={() => setActiveTab('geometry')}
          className={`py-2 flex flex-col items-center gap-1 rounded font-medium transition ${
            activeTab === 'geometry' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Geometría"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[10px]">Geometría</span>
        </button>
        <button
          onClick={() => setActiveTab('migration')}
          className={`py-2 flex flex-col items-center gap-1 rounded font-medium transition ${
            activeTab === 'migration' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Migración"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[10px]">Migración</span>
        </button>
        <button
          onClick={() => setActiveTab('display')}
          className={`py-2 flex flex-col items-center gap-1 rounded font-medium transition ${
            activeTab === 'display' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Render"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[10px]">Render</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
        {/* TAB 1: FILTERS */}
        {activeTab === 'filters' && (
          <div className="space-y-4">
            {/* Dewow */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Filtro Dewow (DC Offset)</span>
                <input
                  type="checkbox"
                  checked={options.dewow}
                  onChange={(e) => updateOption('dewow', e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 w-4 h-4"
                />
              </div>
              {options.dewow && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Ventana Promedio:</span>
                    <span className="font-mono text-sky-400">{options.dewowWindow} muestras</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={128}
                    step={4}
                    value={options.dewowWindow}
                    onChange={(e) => updateOption('dewowWindow', parseInt(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 rounded"
                  />
                </div>
              )}
            </div>

            {/* Background Removal */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Background Removal</span>
                <input
                  type="checkbox"
                  checked={options.backgroundRemoval}
                  onChange={(e) => updateOption('backgroundRemoval', e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 w-4 h-4"
                />
              </div>
              {options.backgroundRemoval && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Modo Ventana:</span>
                    <span className="font-mono text-sky-400">
                      {options.backgroundWindow === 0 ? 'Perfil Global Completo' : `${options.backgroundWindow} trazas`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={options.backgroundWindow}
                    onChange={(e) => updateOption('backgroundWindow', parseInt(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 rounded"
                  />
                </div>
              )}
            </div>

            {/* Digital Frequency Filters */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
              <span className="font-semibold text-slate-200 block">Filtro Digital Frecuencial</span>
              <select
                value={options.filterType}
                onChange={(e) => updateOption('filterType', e.target.value as DSPOptions['filterType'])}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none"
              >
                <option value="none">Sin Filtro Frecuencial</option>
                <option value="lowpass">Pasa-Bajas (Lowpass)</option>
                <option value="highpass">Pasa-Altas (Highpass)</option>
                <option value="bandpass">Pasa-Banda (Bandpass)</option>
              </select>

              {options.filterType !== 'none' && (
                <div className="space-y-2 pt-1">
                  {(options.filterType === 'highpass' || options.filterType === 'bandpass') && (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Corte Inferior (Low Cut):</span>
                        <span className="font-mono text-sky-400">{options.lowCutMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={1000}
                        step={10}
                        value={options.lowCutMHz}
                        onChange={(e) => updateOption('lowCutMHz', parseInt(e.target.value))}
                        className="w-full accent-sky-500 bg-slate-800 rounded"
                      />
                    </div>
                  )}

                  {(options.filterType === 'lowpass' || options.filterType === 'bandpass') && (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Corte Superior (High Cut):</span>
                        <span className="font-mono text-sky-400">{options.highCutMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={2000}
                        step={25}
                        value={options.highCutMHz}
                        onChange={(e) => updateOption('highCutMHz', parseInt(e.target.value))}
                        className="w-full accent-sky-500 bg-slate-800 rounded"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GAIN */}
        {activeTab === 'gain' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
              <span className="font-semibold text-slate-200 block">Función de Ganancia Temporal</span>
              <select
                value={options.gainType}
                onChange={(e) => updateOption('gainType', e.target.value as DSPOptions['gainType'])}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1"
              >
                <option value="none">Sin Ganancia Aplicada</option>
                <option value="linear">Ganancia Lineal</option>
                <option value="exp">Ganancia Exponencial / Cuadrática</option>
                <option value="agc">AGC (Control Automático de Ganancia)</option>
                <option value="custom">Curva Dibujable por Usuario</option>
              </select>

              {options.gainType === 'linear' && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Factor Lineal:</span>
                    <span className="font-mono text-sky-400">{options.linearGain.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={10.0}
                    step={0.1}
                    value={options.linearGain}
                    onChange={(e) => updateOption('linearGain', parseFloat(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 rounded"
                  />
                </div>
              )}

              {options.gainType === 'exp' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Tasa Alpha (e^αt):</span>
                      <span className="font-mono text-sky-400">{options.expGainAlpha.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.001}
                      max={0.2}
                      step={0.005}
                      value={options.expGainAlpha}
                      onChange={(e) => updateOption('expGainAlpha', parseFloat(e.target.value))}
                      className="w-full accent-sky-500 bg-slate-800 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Potencia (t^p):</span>
                      <span className="font-mono text-sky-400">{options.expGainPower.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={options.expGainPower}
                      onChange={(e) => updateOption('expGainPower', parseFloat(e.target.value))}
                      className="w-full accent-sky-500 bg-slate-800 rounded"
                    />
                  </div>
                </div>
              )}

              {options.gainType === 'agc' && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Ventana RMS AGC:</span>
                    <span className="font-mono text-sky-400">{options.agcWindowSamples} muestras</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={256}
                    step={8}
                    value={options.agcWindowSamples}
                    onChange={(e) => updateOption('agcWindowSamples', parseInt(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 rounded"
                  />
                </div>
              )}

              {options.gainType === 'custom' && (
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block">Haz clic para ajustar la curva de ganancia:</span>
                  <canvas
                    ref={gainCanvasRef}
                    width={260}
                    height={100}
                    onClick={handleGainCanvasClick}
                    className="w-full h-24 border border-slate-700 rounded cursor-pointer block"
                  />
                </div>
              )}
            </div>

            {/* Hilbert Envelope */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Transformada Hilbert</span>
                <span className="text-[10px] text-slate-400">Envolvente de Amplitud Instantánea</span>
              </div>
              <input
                type="checkbox"
                checked={options.hilbertEnvelope}
                onChange={(e) => updateOption('hilbertEnvelope', e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 w-4 h-4"
              />
            </div>
          </div>
        )}

        {/* TAB 3: GEOMETRY */}
        {activeTab === 'geometry' && (
          <div className="space-y-4">
            {/* Zero-Time Shift */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">Ajuste Cero Temporal (Zero-Time)</span>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Desplazamiento Estático:</span>
                <span className="font-mono text-sky-400">{options.zeroTimeShiftNs.toFixed(1)} ns</span>
              </div>
              <input
                type="range"
                min={-20}
                max={50}
                step={0.5}
                value={options.zeroTimeShiftNs}
                onChange={(e) => updateOption('zeroTimeShiftNs', parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded"
              />
            </div>

            {/* Trace Stacking */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">Promediado de Trazas (Stacking)</span>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Factor Stacking:</span>
                <span className="font-mono text-sky-400">{options.stackingFactor}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={options.stackingFactor}
                onChange={(e) => updateOption('stackingFactor', parseInt(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded"
              />
            </div>

            {/* Trace Skipping */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">Descarte de Trazas (Skipping)</span>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Pasar cada:</span>
                <span className="font-mono text-sky-400">{options.skipFactor} traza(s)</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={options.skipFactor}
                onChange={(e) => updateOption('skipFactor', parseInt(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded"
              />
            </div>
          </div>
        )}

        {/* TAB 4: MIGRATION & VELOCITY */}
        {activeTab === 'migration' && (
          <div className="space-y-4">
            {/* Permittivity & Velocity */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
              <span className="font-semibold text-slate-200 block">Análisis de Velocidad & Permitividad</span>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Permitividad Dieléctrica (ε_r):</span>
                  <span className="font-mono text-amber-400 font-bold">{options.dielectricPermittivity.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={81.0}
                  step={0.5}
                  value={options.dielectricPermittivity}
                  onChange={(e) => updateOption('dielectricPermittivity', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 rounded"
                />
              </div>

              {/* Calculated Velocity pill */}
              <div className="bg-slate-900 p-2 rounded flex items-center justify-between font-mono text-xs border border-slate-800">
                <span className="text-slate-400">Velocidad v:</span>
                <span className="text-emerald-400 font-bold">{currentVelocity.toFixed(4)} m/ns</span>
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">Presets de Medio:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 4.0)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 text-left"
                  >
                    Arena Seca (ε_r=4)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 6.0)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 text-left"
                  >
                    Hormigón (ε_r=6)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 9.0)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 text-left"
                  >
                    Suelo Húmedo (ε_r=9)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 16.0)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 text-left"
                  >
                    Arcilla (ε_r=16)
                  </button>
                </div>
              </div>
            </div>

            {/* Hyperbola Tool Button */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">Ajuste de Hipérbolas Interactivo</span>
              <button
                onClick={() => onToggleHyperbolaTool(!showHyperbolaTool)}
                className={`w-full py-2 px-3 rounded flex items-center justify-center gap-2 font-medium text-xs transition ${
                  showHyperbolaTool ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>{showHyperbolaTool ? 'Ocultar Calibrador Hipérbola' : 'Activar Calibrador Hipérbola'}</span>
              </button>
            </div>

            {/* Kirchhoff Migration */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">Migración Kirchhoff</span>
                  <span className="text-[10px] text-slate-400">Colapso Estructural de Hipérbolas</span>
                </div>
                <input
                  type="checkbox"
                  checked={options.enableMigration}
                  onChange={(e) => updateOption('enableMigration', e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500 w-4 h-4"
                />
              </div>

              {options.enableMigration && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Apertura de Migración:</span>
                    <span className="font-mono text-sky-400">{options.migrationApertureTraces} trazas</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    step={2}
                    value={options.migrationApertureTraces}
                    onChange={(e) => updateOption('migrationApertureTraces', parseInt(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 rounded"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: DISPLAY / RENDER */}
        {activeTab === 'display' && (
          <div className="space-y-4">
            {/* Color Palette Selection */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">Paleta de Colores</span>
              <div className="grid grid-cols-2 gap-2">
                {(['grayscale', 'sepia', 'jet', 'seismic', 'bone'] as ColorPalette[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => onPaletteChange(p)}
                    className={`py-1.5 px-2 rounded border text-xs capitalize transition ${
                      palette === p
                        ? 'border-sky-500 bg-sky-950/50 text-sky-300 font-semibold'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast Slider */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-200">Contraste:</span>
                <span className="font-mono text-sky-400">{contrast.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={4.0}
                step={0.1}
                value={contrast}
                onChange={(e) => onContrastChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded"
              />
            </div>

            {/* Brightness Slider */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-200">Brillo:</span>
                <span className="font-mono text-sky-400">{brightness}</span>
              </div>
              <input
                type="range"
                min={-80}
                max={80}
                step={5}
                value={brightness}
                onChange={(e) => onBrightnessChange(parseInt(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
