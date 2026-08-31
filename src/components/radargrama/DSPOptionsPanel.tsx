'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DSPOptions, calculateVelocity } from '@/lib/gpr/dspEngine';
import { GSFHeader } from '@/lib/gpr/gsfParser';
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
  FileCog,
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
  const [activeTab, setActiveTab] = useState<'filters' | 'gain' | 'geometry' | 'migration' | 'display' | 'header'>('filters');

  // Custom Gain Curve Canvas Ref
  const gainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to update DSP options field
  const updateOption = <K extends keyof DSPOptions>(key: K, value: DSPOptions[K]) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  // Helper to update GSF header override
  const updateHeader = <K extends keyof GSFHeader>(key: K, value: GSFHeader[K]) => {
    if (!header || !onHeaderChange) return;
    onHeaderChange({
      ...header,
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
      const y = h - (pts[i] / 10) * h;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw control nodes
    for (let i = 0; i < pts.length; i++) {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (pts[i] / 10) * h;

      ctx.fillStyle = '#f5a623';
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
    <div className="w-80 h-full bg-white border-l border-border flex flex-col shadow-soft overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Sliders className="w-4 h-4 text-primary" />
          <span>Panel de Procesamiento DSP</span>
        </div>
        <button
          onClick={onResetDSP}
          className="p-1.5 hover:bg-gray-200 text-text-secondary hover:text-text-primary rounded-lg transition"
          title="Restablecer Filtros DSP"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="grid grid-cols-6 bg-gray-100 p-1 border-b border-border text-xs gap-0.5">
        <button
          onClick={() => setActiveTab('filters')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'filters' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Filtros"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px]">Filtros</span>
        </button>
        <button
          onClick={() => setActiveTab('gain')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'gain' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Ganancia"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[10px]">Ganancia</span>
        </button>
        <button
          onClick={() => setActiveTab('geometry')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'geometry' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Geometría"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[10px]">Geometría</span>
        </button>
        <button
          onClick={() => setActiveTab('migration')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'migration' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Migración"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[10px]">Migración</span>
        </button>
        <button
          onClick={() => setActiveTab('display')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'display' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Paleta"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[10px]">Paleta</span>
        </button>
        <button
          onClick={() => setActiveTab('header')}
          className={`py-1.5 flex flex-col items-center gap-1 rounded-lg font-medium transition ${
            activeTab === 'header' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-gray-200'
          }`}
          title="Calibración de Header"
        >
          <FileCog className="w-3.5 h-3.5" />
          <span className="text-[10px]">Header</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-text-secondary">
        {/* TAB 1: FILTERS */}
        {activeTab === 'filters' && (
          <div className="space-y-3">
            {/* Dewow */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Filtro Dewow (DC Offset)</span>
                <input
                  type="checkbox"
                  checked={options.dewow}
                  onChange={(e) => updateOption('dewow', e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
                />
              </div>
              {options.dewow && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Ventana Promedio:</span>
                    <span className="font-mono text-primary font-bold">{options.dewowWindow} muestras</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={128}
                    step={4}
                    value={options.dewowWindow}
                    onChange={(e) => updateOption('dewowWindow', parseInt(e.target.value, 10))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              )}
            </div>

            {/* Background Removal */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Background Removal</span>
                <input
                  type="checkbox"
                  checked={options.backgroundRemoval}
                  onChange={(e) => updateOption('backgroundRemoval', e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
                />
              </div>
              {options.backgroundRemoval && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Modo Ventana:</span>
                    <span className="font-mono text-primary font-bold">
                      {options.backgroundWindow === 0 ? 'Perfil Global Completo' : `${options.backgroundWindow} trazas`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={options.backgroundWindow}
                    onChange={(e) => updateOption('backgroundWindow', parseInt(e.target.value, 10))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              )}
            </div>

            {/* Digital Frequency Filters */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-3">
              <span className="font-semibold text-text-primary block">Filtro Digital Frecuencial</span>
              <select
                value={options.filterType}
                onChange={(e) => updateOption('filterType', e.target.value as DSPOptions['filterType'])}
                className="select w-full"
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
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>Corte Inferior:</span>
                        <span className="font-mono text-primary font-bold">{options.lowCutMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={1000}
                        step={10}
                        value={options.lowCutMHz}
                        onChange={(e) => updateOption('lowCutMHz', parseInt(e.target.value, 10))}
                        className="w-full accent-primary bg-gray-200 rounded"
                      />
                    </div>
                  )}

                  {(options.filterType === 'lowpass' || options.filterType === 'bandpass') && (
                    <div>
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>Corte Superior:</span>
                        <span className="font-mono text-primary font-bold">{options.highCutMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={2000}
                        step={25}
                        value={options.highCutMHz}
                        onChange={(e) => updateOption('highCutMHz', parseInt(e.target.value, 10))}
                        className="w-full accent-primary bg-gray-200 rounded"
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
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-3">
              <span className="font-semibold text-text-primary block">Función de Ganancia Temporal</span>
              <select
                value={options.gainType}
                onChange={(e) => updateOption('gainType', e.target.value as DSPOptions['gainType'])}
                className="select w-full"
              >
                <option value="none">Sin Ganancia Aplicada</option>
                <option value="linear">Ganancia Lineal</option>
                <option value="exp">Ganancia Exponencial / Cuadrática</option>
                <option value="agc">AGC (Control Automático de Ganancia)</option>
                <option value="custom">Curva Dibujable por Usuario</option>
              </select>

              {options.gainType === 'linear' && (
                <div>
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Factor Lineal:</span>
                    <span className="font-mono text-primary font-bold">{options.linearGain.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={10.0}
                    step={0.1}
                    value={options.linearGain}
                    onChange={(e) => updateOption('linearGain', parseFloat(e.target.value))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              )}

              {options.gainType === 'exp' && (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-text-muted">
                      <span>Tasa Alpha (e^αt):</span>
                      <span className="font-mono text-primary font-bold">{options.expGainAlpha.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.001}
                      max={0.2}
                      step={0.005}
                      value={options.expGainAlpha}
                      onChange={(e) => updateOption('expGainAlpha', parseFloat(e.target.value))}
                      className="w-full accent-primary bg-gray-200 rounded"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-text-muted">
                      <span>Potencia (t^p):</span>
                      <span className="font-mono text-primary font-bold">{options.expGainPower.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={options.expGainPower}
                      onChange={(e) => updateOption('expGainPower', parseFloat(e.target.value))}
                      className="w-full accent-primary bg-gray-200 rounded"
                    />
                  </div>
                </div>
              )}

              {options.gainType === 'agc' && (
                <div>
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Ventana RMS AGC:</span>
                    <span className="font-mono text-primary font-bold">{options.agcWindowSamples} muestras</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={256}
                    step={8}
                    value={options.agcWindowSamples}
                    onChange={(e) => updateOption('agcWindowSamples', parseInt(e.target.value, 10))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              )}

              {options.gainType === 'custom' && (
                <div className="space-y-2">
                  <span className="text-[11px] text-text-muted block">Haz clic para ajustar los nodos:</span>
                  <canvas
                    ref={gainCanvasRef}
                    width={260}
                    height={100}
                    onClick={handleGainCanvasClick}
                    className="w-full h-24 border border-border rounded-xl cursor-pointer block bg-slate-950"
                  />
                </div>
              )}
            </div>

            {/* Hilbert Envelope */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-text-primary block">Transformada Hilbert</span>
                <span className="text-[10px] text-text-muted">Envolvente de Amplitud Instantánea</span>
              </div>
              <input
                type="checkbox"
                checked={options.hilbertEnvelope}
                onChange={(e) => updateOption('hilbertEnvelope', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
              />
            </div>
          </div>
        )}

        {/* TAB 3: GEOMETRY */}
        {activeTab === 'geometry' && (
          <div className="space-y-3">
            {/* Zero-Time Shift */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Ajuste Cero Temporal (Zero-Time)</span>
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>Desplazamiento:</span>
                <span className="font-mono text-primary font-bold">{options.zeroTimeShiftNs.toFixed(1)} ns</span>
              </div>
              <input
                type="range"
                min={-20}
                max={50}
                step={0.5}
                value={options.zeroTimeShiftNs}
                onChange={(e) => updateOption('zeroTimeShiftNs', parseFloat(e.target.value))}
                className="w-full accent-primary bg-gray-200 rounded"
              />
            </div>

            {/* Trace Stacking */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Promediado de Trazas (Stacking)</span>
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>Factor Stacking:</span>
                <span className="font-mono text-primary font-bold">{options.stackingFactor}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={options.stackingFactor}
                onChange={(e) => updateOption('stackingFactor', parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-gray-200 rounded"
              />
            </div>

            {/* Trace Skipping */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Descarte de Trazas (Skipping)</span>
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>Paso:</span>
                <span className="font-mono text-primary font-bold">Cada {options.skipFactor} traza(s)</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={options.skipFactor}
                onChange={(e) => updateOption('skipFactor', parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-gray-200 rounded"
              />
            </div>
          </div>
        )}

        {/* TAB 4: MIGRATION & VELOCITY */}
        {activeTab === 'migration' && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-3">
              <span className="font-semibold text-text-primary block">Velocidad & Permitividad</span>
              <div>
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>Permitividad Dieléctrica (ε_r):</span>
                  <span className="font-mono text-accent-700 font-bold">{options.dielectricPermittivity.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={81.0}
                  step={0.5}
                  value={options.dielectricPermittivity}
                  onChange={(e) => updateOption('dielectricPermittivity', parseFloat(e.target.value))}
                  className="w-full accent-accent bg-gray-200 rounded"
                />
              </div>

              {/* Calculated Velocity pill */}
              <div className="bg-white p-2.5 rounded-xl flex items-center justify-between font-mono text-xs border border-border">
                <span className="text-text-muted font-sans">Velocidad propagación v:</span>
                <span className="text-primary font-bold">{currentVelocity.toFixed(4)} m/ns</span>
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted font-medium">Presets típicos:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 4.0)}
                    className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[11px] text-text-secondary hover:text-primary border border-border text-left transition"
                  >
                    Arena Seca (ε=4)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 6.0)}
                    className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[11px] text-text-secondary hover:text-primary border border-border text-left transition"
                  >
                    Hormigón (ε=6)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 9.0)}
                    className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[11px] text-text-secondary hover:text-primary border border-border text-left transition"
                  >
                    Suelo Húmedo (ε=9)
                  </button>
                  <button
                    onClick={() => updateOption('dielectricPermittivity', 16.0)}
                    className="px-2 py-1 bg-white hover:bg-primary-50 rounded-lg text-[11px] text-text-secondary hover:text-primary border border-border text-left transition"
                  >
                    Arcilla (ε=16)
                  </button>
                </div>
              </div>
            </div>

            {/* Hyperbola Tool Button */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
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

            {/* Kirchhoff Migration */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-text-primary block">Migración Kirchhoff</span>
                  <span className="text-[10px] text-text-muted">Colapso de Difracciones</span>
                </div>
                <input
                  type="checkbox"
                  checked={options.enableMigration}
                  onChange={(e) => updateOption('enableMigration', e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4"
                />
              </div>

              {options.enableMigration && (
                <div>
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>Apertura de Migración:</span>
                    <span className="font-mono text-primary font-bold">{options.migrationApertureTraces} trazas</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    step={2}
                    value={options.migrationApertureTraces}
                    onChange={(e) => updateOption('migrationApertureTraces', parseInt(e.target.value, 10))}
                    className="w-full accent-primary bg-gray-200 rounded"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: DISPLAY / RENDER */}
        {activeTab === 'display' && (
          <div className="space-y-3">
            {/* Color Palette Selection */}
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-2">
              <span className="font-semibold text-text-primary block">Paleta de Colores</span>
              <div className="grid grid-cols-2 gap-2">
                {(['grayscale', 'sepia', 'jet', 'seismic', 'bone'] as ColorPalette[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => onPaletteChange(p)}
                    className={`py-1.5 px-2 rounded-xl border text-xs capitalize transition ${
                      palette === p
                        ? 'border-primary bg-primary-50 text-primary font-bold shadow-xs'
                        : 'border-border bg-white text-text-secondary hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast Slider */}
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

            {/* Brightness Slider */}
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

        {/* TAB 6: HEADER & GEOMETRY CALIBRATION */}
        {activeTab === 'header' && header && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-border space-y-3">
              <div>
                <span className="font-semibold text-text-primary block">Calibración de Muestras / Traza</span>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Ajusta las muestras por traza si el perfil se ve desfasado o con líneas diagonales.
                </p>
              </div>

              {/* Quick sample count buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[256, 512, 1024, 2048].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateHeader('numSamples', s)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition ${
                      header.numSamples === s
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Custom sample count input */}
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                  Muestras por Traza (Personalizado):
                </label>
                <input
                  type="number"
                  value={header.numSamples}
                  onChange={(e) => updateHeader('numSamples', Math.max(32, parseInt(e.target.value, 10) || 512))}
                  className="input text-xs py-1.5"
                />
              </div>

              {/* Header Offset / Data Start */}
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                  Offset de Inicio de Datos (bytes):
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {[0, 512, 1024].map((off) => (
                    <button
                      key={off}
                      onClick={() => updateHeader('byteOffsetData', off)}
                      className={`py-1 rounded-lg text-[11px] font-mono border transition ${
                        header.byteOffsetData === off
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                      }`}
                    >
                      {off} B
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={header.byteOffsetData}
                  onChange={(e) => updateHeader('byteOffsetData', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="input text-xs py-1.5"
                />
              </div>

              {/* Trace Header size */}
              <div>
                <label className="text-[11px] font-semibold text-text-secondary block mb-1">
                  Header por Traza (bytes):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 16, 24, 32].map((th) => (
                    <button
                      key={th}
                      onClick={() => updateHeader('traceHeaderBytes', th)}
                      className={`py-1 rounded-lg text-[11px] font-mono border transition ${
                        header.traceHeaderBytes === th
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-text-secondary border-border hover:bg-gray-100'
                      }`}
                    >
                      {th} B
                    </button>
                  ))}
                </div>
              </div>

              {/* dt & dx */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                <div>
                  <label className="text-[10px] text-text-muted block">dt (ns):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={header.sampleIntervalNs}
                    onChange={(e) => updateHeader('sampleIntervalNs', parseFloat(e.target.value) || 0.1)}
                    className="input text-xs py-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block">dx (m):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={header.traceDistanceStepM}
                    onChange={(e) => updateHeader('traceDistanceStepM', parseFloat(e.target.value) || 0.05)}
                    className="input text-xs py-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
