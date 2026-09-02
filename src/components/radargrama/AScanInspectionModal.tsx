'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { computeFFT } from '@/lib/gpr/dspEngine';
import { Activity, X, Crosshair, BarChart2, Clock } from 'lucide-react';

interface AScanInspectionModalProps {
  traceIdx: number;
  dataset: GPRDataset;
  processedTrace: Float32Array;
  onClose: () => void;
}

export const AScanInspectionModal: React.FC<AScanInspectionModalProps> = ({
  traceIdx,
  dataset,
  processedTrace,
  onClose,
}) => {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse hover state for Signal (Time Domain)
  const [timeHover, setTimeHover] = useState<{ sample: number; timeNs: number; amp: number; x: number; y: number } | null>(null);

  // Mouse hover state for FFT (Frequency Domain)
  const [fftHover, setFftHover] = useState<{ freqMHz: number; magnitude: number; x: number; y: number } | null>(null);

  const numSamples = processedTrace.length;
  const distM = traceIdx * dataset.header.traceDistanceStepM;
  const twNs = dataset.header.timeWindowNs || 90.0;
  const dtNs = numSamples > 0 ? twNs / numSamples : 0.18;

  // Nyquist Frequency in MHz (fs = 1000 / dtNs MHz, fNyquist = fs / 2)
  const fNyquistMHz = dtNs > 0 ? 500 / dtNs : 1000;

  // Compute FFT Spectrum
  const { magnitudes } = computeFFT(processedTrace);
  const numFreqs = magnitudes.length;

  // Find Peak Frequency
  let peakFreqMHz = 0;
  let maxMag = 0;
  for (let i = 0; i < numFreqs; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      peakFreqMHz = (i / Math.max(1, numFreqs - 1)) * fNyquistMHz;
    }
  }
  if (maxMag === 0) maxMag = 1;

  // Find Max Signal Amplitude
  let maxAmp = 0;
  for (let i = 0; i < numSamples; i++) {
    const absVal = Math.abs(processedTrace[i]);
    if (absVal > maxAmp) maxAmp = absVal;
  }
  if (maxAmp === 0) maxAmp = 1;

  // =========================================================================
  // RENDER CARTESIAN PLANE: TIME WAVEFORM A-SCAN
  // =========================================================================
  const renderTimeCartesianPlane = useCallback(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Layout Margins for Cartesian Axes
    const padL = 60; // Left margin for Amplitude Y-axis ticks
    const padR = 25; // Right margin
    const padT = 20; // Top margin
    const padB = 30; // Bottom margin for Time X-axis ticks

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const midY = padT + plotH / 2;

    // Background
    ctx.fillStyle = '#090d16'; // Deep dark navy
    ctx.fillRect(0, 0, width, height);

    // Plot Container Box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);

    // Grid Lines & Y-Axis Ticks (Amplitude)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px tabular-nums monospace, sans-serif';

    const yTicks = [
      { val: maxAmp, label: `+${Math.round(maxAmp)}` },
      { val: maxAmp / 2, label: `+${Math.round(maxAmp / 2)}` },
      { val: 0, label: '0' },
      { val: -maxAmp / 2, label: `-${Math.round(maxAmp / 2)}` },
      { val: -maxAmp, label: `-${Math.round(maxAmp)}` },
    ];

    yTicks.forEach((tick) => {
      const y = midY - (tick.val / maxAmp) * (plotH / 2 - 5);

      // Horizontal Grid line
      ctx.strokeStyle = tick.val === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(51, 65, 85, 0.4)';
      ctx.setLineDash(tick.val === 0 ? [] : [3, 3]);
      ctx.lineWidth = tick.val === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-Tick label
      ctx.fillStyle = tick.val === 0 ? '#38bdf8' : '#94a3b8';
      ctx.fillText(tick.label, padL - 8, y);
    });

    // Grid Lines & X-Axis Ticks (Time in ns)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const numXTicks = 7;

    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const x = padL + frac * plotW;
      const tVal = frac * twNs;

      // Vertical Grid line
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // X-Tick Mark & Label
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(x, padT + plotH);
      ctx.lineTo(x, padT + plotH + 4);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${tVal.toFixed(1)}ns`, x, padT + plotH + 7);
    }

    // Axis Titles
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Amp', 12, padT - 2);

    ctx.textAlign = 'right';
    ctx.fillText('Tiempo (ns)', padL + plotW, padT + plotH + 7);

    // Draw Signal Waveform Curve
    ctx.strokeStyle = '#38bdf8'; // Bright cyan
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = padL + (i / (numSamples - 1)) * plotW;
      const normVal = processedTrace[i] / maxAmp;
      const y = midY - normVal * (plotH / 2 - 5);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Crosshair & Mouse Cursor Readout
    if (timeHover) {
      const { x: hX, y: hY, sample, amp } = timeHover;

      if (hX >= padL && hX <= padL + plotW && hY >= padT && hY <= padT + plotH) {
        // Vertical Crosshair Line
        ctx.strokeStyle = '#60a5fa';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hX, padT);
        ctx.lineTo(hX, padT + plotH);
        ctx.stroke();

        // Horizontal Crosshair Line
        ctx.beginPath();
        ctx.moveTo(padL, hY);
        ctx.lineTo(padL + plotW, hY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Highlight Point on Curve
        const ptX = padL + (sample / (numSamples - 1)) * plotW;
        const ptY = midY - (amp / maxAmp) * (plotH / 2 - 5);

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(ptX, ptY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [processedTrace, numSamples, twNs, maxAmp, timeHover]);

  // =========================================================================
  // RENDER CARTESIAN PLANE: FFT FREQUENCY SPECTRUM
  // =========================================================================
  const renderFFTCartesianPlane = useCallback(() => {
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Layout Margins
    const padL = 60;
    const padR = 25;
    const padT = 20;
    const padB = 30;

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const baseY = padT + plotH;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Plot Container Box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);

    // Grid Lines & Y-Axis Ticks (FFT Magnitude)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px tabular-nums monospace, sans-serif';

    const yTicks = [
      { val: maxMag, label: `${Math.round(maxMag)}` },
      { val: maxMag / 2, label: `${Math.round(maxMag / 2)}` },
      { val: 0, label: '0' },
    ];

    yTicks.forEach((tick) => {
      const y = baseY - (tick.val / maxMag) * (plotH - 5);

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(tick.label, padL - 8, y);
    });

    // Grid Lines & X-Axis Ticks (Frequency in MHz)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Limit X-axis display up to Nyquist or 1200 MHz for standard GPR band
    const maxDispFreqMHz = Math.min(1200, fNyquistMHz);
    const numXTicks = 6;

    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const x = padL + frac * plotW;
      const freqVal = frac * maxDispFreqMHz;

      // Vertical Grid line
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tick mark
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY + 4);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${Math.round(freqVal)}`, x, baseY + 7);
    }

    // Axis Titles
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Mag', 12, padT - 2);

    ctx.textAlign = 'right';
    ctx.fillText('Frecuencia (MHz)', padL + plotW, baseY + 7);

    // Draw Peak Frequency Vertical Indicator Line
    if (peakFreqMHz > 0 && peakFreqMHz <= maxDispFreqMHz) {
      const peakX = padL + (peakFreqMHz / maxDispFreqMHz) * plotW;
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(peakX, padT);
      ctx.lineTo(peakX, baseY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText(`Peak: ${Math.round(peakFreqMHz)}MHz`, peakX, padT + 4);
    }

    // Draw Spectrum Area & Curve
    ctx.strokeStyle = '#fbbf24'; // Amber
    ctx.lineWidth = 1.8;

    const gradient = ctx.createLinearGradient(0, padT, 0, baseY);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0.02)');

    ctx.beginPath();
    ctx.moveTo(padL, baseY);

    for (let i = 0; i < numFreqs; i++) {
      const freq = (i / (numFreqs - 1)) * fNyquistMHz;
      if (freq > maxDispFreqMHz) break;

      const x = padL + (freq / maxDispFreqMHz) * plotW;
      const normMag = magnitudes[i] / maxMag;
      const y = baseY - normMag * (plotH - 5);

      ctx.lineTo(x, y);
    }

    ctx.lineTo(padL + plotW, baseY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.stroke();

    // Draw Crosshair & Mouse Cursor Readout
    if (fftHover) {
      const { x: hX, y: hY, freqMHz, magnitude } = fftHover;

      if (hX >= padL && hX <= padL + plotW && hY >= padT && hY <= padT + plotH) {
        ctx.strokeStyle = '#fbbf24';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hX, padT);
        ctx.lineTo(hX, baseY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(padL, hY);
        ctx.lineTo(padL + plotW, hY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Highlight Point on Spectrum Curve
        const ptX = padL + (freqMHz / maxDispFreqMHz) * plotW;
        const ptY = baseY - (magnitude / maxMag) * (plotH - 5);

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(ptX, ptY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [magnitudes, numFreqs, fNyquistMHz, maxMag, peakFreqMHz, fftHover]);

  useEffect(() => {
    renderTimeCartesianPlane();
  }, [renderTimeCartesianPlane]);

  useEffect(() => {
    renderFFTCartesianPlane();
  }, [renderFFTCartesianPlane]);

  // Handle Mouse Events for Time Waveform Canvas
  const handleTimeMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padL = 60;
    const padR = 25;
    const plotW = canvas.width - padL - padR;

    if (x < padL || x > padL + plotW) {
      setTimeHover(null);
      return;
    }

    const frac = (x - padL) / plotW;
    const sample = Math.min(numSamples - 1, Math.max(0, Math.round(frac * (numSamples - 1))));
    const timeNs = frac * twNs;
    const amp = processedTrace[sample] || 0;

    setTimeHover({ sample, timeNs, amp, x, y });
  };

  // Handle Mouse Events for FFT Spectrum Canvas
  const handleFFTMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padL = 60;
    const padR = 25;
    const plotW = canvas.width - padL - padR;
    const maxDispFreqMHz = Math.min(1200, fNyquistMHz);

    if (x < padL || x > padL + plotW) {
      setFftHover(null);
      return;
    }

    const frac = (x - padL) / plotW;
    const freqMHz = frac * maxDispFreqMHz;
    const binIdx = Math.min(numFreqs - 1, Math.max(0, Math.round((freqMHz / fNyquistMHz) * (numFreqs - 1))));
    const magnitude = magnitudes[binIdx] || 0;

    setFftHover({ freqMHz, magnitude, x, y });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-border rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5 text-text-primary font-bold text-sm">
            <div className="p-1.5 bg-primary-100 text-primary rounded-xl">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span>Inspección de Traza A-Scan #{traceIdx + 1}</span>
            <span className="text-xs font-mono px-2 py-0.5 bg-gray-200 text-text-secondary rounded-lg font-normal">
              Distancia: {distM.toFixed(2)}m
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-full text-text-secondary hover:text-text-primary transition"
            title="Cerrar Inspección"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* SECTION 1: SEÑAL TEMPORAL A-SCAN */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-secondary font-medium px-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Señal Temporal A-Scan (Plano Cartesiano)</span>
              </div>
              {timeHover ? (
                <div className="flex items-center gap-2 font-mono text-[11px] bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-lg border border-sky-200 font-bold">
                  <span>t: {timeHover.timeNs.toFixed(2)} ns</span>
                  <span>|</span>
                  <span>Muestra: #{timeHover.sample + 1}</span>
                  <span>|</span>
                  <span>Amp: {timeHover.amp > 0 ? `+${Math.round(timeHover.amp)}` : Math.round(timeHover.amp)}</span>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-text-muted flex items-center gap-2">
                  <span>Ventana: {twNs.toFixed(1)} ns</span>
                  <span>•</span>
                  <span>{numSamples} muestras</span>
                </div>
              )}
            </div>

            {/* Time Waveform Canvas */}
            <div className="relative">
              <canvas
                ref={waveformCanvasRef}
                width={680}
                height={160}
                onMouseMove={handleTimeMouseMove}
                onMouseLeave={() => setTimeHover(null)}
                className="w-full h-40 border border-slate-800 rounded-2xl block bg-slate-950 cursor-crosshair shadow-inner"
              />
            </div>
          </div>

          {/* SECTION 2: ESPECTRO DE FRECUENCIAS FFT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-secondary font-medium px-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Espectro de Frecuencias (Transformada FFT)</span>
              </div>
              {fftHover ? (
                <div className="flex items-center gap-2 font-mono text-[11px] bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-lg border border-amber-200 font-bold">
                  <span>f: {Math.round(fftHover.freqMHz)} MHz</span>
                  <span>|</span>
                  <span>Mag FFT: {Math.round(fftHover.magnitude)}</span>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-bold flex items-center gap-1.5">
                  <span>Frec. Central Peak: {Math.round(peakFreqMHz)} MHz</span>
                </div>
              )}
            </div>

            {/* FFT Spectrum Canvas */}
            <div className="relative">
              <canvas
                ref={fftCanvasRef}
                width={680}
                height={160}
                onMouseMove={handleFFTMouseMove}
                onMouseLeave={() => setFftHover(null)}
                className="w-full h-40 border border-slate-800 rounded-2xl block bg-slate-950 cursor-crosshair shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
            <Crosshair className="w-3.5 h-3.5 text-primary" />
            <span>Pasa el cursor sobre los planos cartesianos para inspeccionar valores exactos en tiempo real.</span>
          </div>
          <button
            onClick={onClose}
            className="btn-outline btn-sm px-5 py-1.5 rounded-xl font-bold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
