'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { calculateVelocity } from '@/lib/gpr/dspEngine';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export type ColorPalette = 'grayscale' | 'seismic' | 'bone' | 'sepia' | 'jet';

interface CanvasViewerProps {
  dataset: GPRDataset | null;
  processedMatrix: Float32Array[] | null;
  palette: ColorPalette;
  contrast: number; // 0.1 to 5.0
  brightness: number; // -100 to 100
  dielectricPermittivity: number;
  ventanaNs: number;
  traceDistanceStepM: number;
  onSelectTrace?: (traceIdx: number) => void;
  showHyperbolaTool: boolean;
}

export const CanvasViewer: React.FC<CanvasViewerProps> = ({
  dataset,
  processedMatrix,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  dielectricPermittivity = 6.0,
  ventanaNs = 90.0,
  traceDistanceStepM = 1.0 / 112.0,
  onSelectTrace,
  showHyperbolaTool,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Horizontal Window & Panning state (Default 10 meters visible window)
  const [windowMeters, setWindowMeters] = useState<number>(10.0);
  const [scrollMeters, setScrollMeters] = useState<number>(0.0);

  // Mouse hover info
  const [hoverInfo, setHoverInfo] = useState<{
    traceIdx: number;
    sampleIdx: number;
    timeNs: number;
    depthM: number;
    distM: number;
    amplitude: number;
  } | null>(null);

  // Hyperbola tool state
  const [hyperbolaApex, setHyperbolaApex] = useState<{ trace: number; sample: number } | null>(null);
  const [isDraggingApex, setIsDraggingApex] = useState<boolean>(false);

  const numTraces = processedMatrix ? processedMatrix.length : 0;
  const numSamples = processedMatrix && numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = traceDistanceStepM > 0 ? traceDistanceStepM : 1.0 / 112.0;
  const distTotalM = numTraces * dxM;

  // Calculate visible window and trace range
  const effWindowM = windowMeters === 0 ? distTotalM : Math.min(windowMeters, distTotalM);
  const maxScrollM = Math.max(0, distTotalM - effWindowM);
  const startM = Math.max(0, Math.min(maxScrollM, scrollMeters));
  const endM = Math.min(distTotalM, startM + effWindowM);

  const startTrace = Math.max(0, Math.floor(startM / dxM));
  const endTrace = Math.min(numTraces, Math.ceil(endM / dxM));
  const visibleTraces = Math.max(1, endTrace - startTrace);

  // Convert bipolar amplitude value [-1, 1] to RGB matching Python matplotlib colormaps
  const getPaletteColor = useCallback(
    (normVal: number): [number, number, number] => {
      const val = Math.max(-1.0, Math.min(1.0, normVal * contrast + brightness / 100));

      if (palette === 'seismic') {
        if (val < 0) {
          const t = 1.0 + val;
          const r = Math.floor(255 * t);
          const g = Math.floor(255 * t);
          const b = 255;
          return [r, g, b];
        } else {
          const t = 1.0 - val;
          const r = 255;
          const g = Math.floor(255 * t);
          const b = Math.floor(255 * t);
          return [r, g, b];
        }
      } else if (palette === 'grayscale') {
        const gray = Math.floor(((val + 1) / 2) * 255);
        return [gray, gray, gray];
      } else if (palette === 'bone') {
        const v = (val + 1) / 2;
        let r = 0, g = 0, b = 0;
        if (v < 0.36) {
          r = Math.floor(v * 211);
          g = Math.floor(v * 211);
          b = Math.floor(v * 280);
        } else if (v < 0.75) {
          r = Math.floor(v * 211);
          g = Math.floor(v * 255 + (v - 0.36) * 100);
          b = Math.floor(v * 211);
        } else {
          r = Math.floor(v * 255 + (v - 0.75) * 100);
          g = Math.floor(255);
          b = Math.floor(255);
        }
        return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
      } else if (palette === 'sepia') {
        const v = (val + 1) / 2;
        return [
          Math.floor(v * 230 + 25),
          Math.floor(v * 180 + 15),
          Math.floor(v * 120 + 10),
        ];
      } else {
        const v = (val + 1) / 2;
        const r = Math.max(0, Math.min(255, Math.floor(255 * Math.sin(v * Math.PI))));
        const g = Math.max(0, Math.min(255, Math.floor(255 * Math.sin((v - 0.25) * Math.PI))));
        const b = Math.max(0, Math.min(255, Math.floor(255 * Math.cos(v * Math.PI * 0.5))));
        return [r, g, b];
      }
    },
    [palette, contrast, brightness]
  );

  // Render Canvas with 10m Windowing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processedMatrix || numTraces === 0 || numSamples === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width || 1000);
    const height = Math.floor(rect.height || 550);

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 4-Axis Margins matching Python matplotlib layout
    const margin = { top: 48, left: 68, right: 68, bottom: 42 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    if (plotWidth <= 0 || plotHeight <= 0) return;

    // Symmetric 98.5-percentile clipping across visible traces
    const allAbs: number[] = [];
    const step = Math.max(1, Math.floor(visibleTraces / 100));
    for (let t = startTrace; t < endTrace; t += step) {
      const tr = processedMatrix[t];
      if (!tr) continue;
      for (let s = 0; s < numSamples; s += 4) {
        allAbs.push(Math.abs(tr[s]));
      }
    }
    allAbs.sort((a, b) => a - b);
    const pIdx = Math.floor(allAbs.length * 0.985);
    const vmax = allAbs[pIdx] || (allAbs.length > 0 ? allAbs[allAbs.length - 1] : 1.0) || 1.0;

    // Offscreen ImageData for current 10m window (visibleTraces x numSamples)
    const imgData = ctx.createImageData(visibleTraces, numSamples);
    const data = imgData.data;

    let ptr = 0;
    for (let s = 0; s < numSamples; s++) {
      for (let t = 0; t < visibleTraces; t++) {
        const traceIdx = startTrace + t;
        const amp = processedMatrix[traceIdx]?.[s] || 0;
        const normVal = Math.max(-1.0, Math.min(1.0, amp / vmax));
        const [r, g, b] = getPaletteColor(normVal);

        data[ptr] = r;
        data[ptr + 1] = g;
        data[ptr + 2] = b;
        data[ptr + 3] = 255;
        ptr += 4;
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = visibleTraces;
    offCanvas.height = numSamples;
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
    }

    // Draw image locked solidly inside plot area [margin.left ... plotWidth, margin.top ... plotHeight]
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, visibleTraces, numSamples, margin.left, margin.top, plotWidth, plotHeight);

    // Hyperbola Tool Overlay
    if (showHyperbolaTool) {
      const defaultApexTrace = Math.floor((startTrace + endTrace) / 2);
      const apex = hyperbolaApex || { trace: defaultApexTrace, sample: Math.floor(numSamples / 3) };
      const dt = ventanaNs / numSamples;
      const vMPerNs = calculateVelocity(dielectricPermittivity);

      ctx.save();
      ctx.beginPath();
      ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
      ctx.clip();

      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const t0Ns = apex.sample * dt;
      const x0M = apex.trace * dxM;

      for (let tr = startTrace; tr < endTrace; tr++) {
        const xM = tr * dxM;
        const distM = xM - x0M;
        const tNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vMPerNs * vMPerNs));
        const sIdx = tNs / dt;

        const canvasX = margin.left + ((tr - startTrace) / visibleTraces) * plotWidth;
        const canvasY = margin.top + (sIdx / numSamples) * plotHeight;

        if (tr === startTrace) ctx.moveTo(canvasX, canvasY);
        else ctx.lineTo(canvasX, canvasY);
      }
      ctx.stroke();

      if (apex.trace >= startTrace && apex.trace < endTrace) {
        const apexCanvasX = margin.left + ((apex.trace - startTrace) / visibleTraces) * plotWidth;
        const apexCanvasY = margin.top + (apex.sample / numSamples) * plotHeight;

        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        ctx.arc(apexCanvasX, apexCanvasY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- 4 GEOPHYSICAL AXES (Configurar Ejes Radargrama) ---
    ctx.strokeStyle = '#1A252C';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

    const twNs = ventanaNs;
    const vMPerNs = calculateVelocity(dielectricPermittivity);
    const profMaxM = (vMPerNs * twNs) / 2.0;

    // 1. TOP AXIS: Número de Traza (startTrace + 1 ... endTrace)
    ctx.fillStyle = '#1A252C';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Número de Traza', margin.left + plotWidth / 2, margin.top - 20);

    ctx.font = '8px sans-serif';
    const numXTicks = 8;
    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const xPos = margin.left + frac * plotWidth;
      const traceNum = Math.max(1, Math.round(startTrace + 1 + frac * Math.max(0, visibleTraces - 1)));

      ctx.beginPath();
      ctx.moveTo(xPos, margin.top);
      ctx.lineTo(xPos, margin.top - 4);
      ctx.stroke();
      ctx.fillText(`${traceNum}`, xPos, margin.top - 6);
    }

    // 2. BOTTOM AXIS: Distancia Recorrida (m)
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('Distancia Recorrida (m)', margin.left + plotWidth / 2, height - 10);

    ctx.font = '8px sans-serif';
    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const xPos = margin.left + frac * plotWidth;
      const dist = (startM + frac * effWindowM).toFixed(2);

      ctx.beginPath();
      ctx.moveTo(xPos, margin.top + plotHeight);
      ctx.lineTo(xPos, margin.top + plotHeight + 4);
      ctx.stroke();
      ctx.fillText(`${dist}`, xPos, margin.top + plotHeight + 14);
    }

    // 3. LEFT AXIS: Tiempo de Viaje (ns)
    ctx.save();
    ctx.translate(16, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('Tiempo de Viaje (ns)', 0, 0);
    ctx.restore();

    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    const numYTicks = 6;
    for (let j = 0; j <= numYTicks; j++) {
      const frac = j / numYTicks;
      const yPos = margin.top + frac * plotHeight;
      const tVal = (twNs * frac).toFixed(1);

      ctx.beginPath();
      ctx.moveTo(margin.left, yPos);
      ctx.lineTo(margin.left - 4, yPos);
      ctx.stroke();
      ctx.fillText(`${tVal}`, margin.left - 6, yPos + 3);
    }

    // 4. RIGHT AXIS: Profundidad Estimada (m)
    ctx.save();
    ctx.translate(width - 12, margin.top + plotHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#780000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Profundidad Estimada (m)', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#780000';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    for (let j = 0; j <= numYTicks; j++) {
      const frac = j / numYTicks;
      const yPos = margin.top + frac * plotHeight;
      const pVal = (profMaxM * frac).toFixed(2);

      ctx.beginPath();
      ctx.moveTo(margin.left + plotWidth, yPos);
      ctx.lineTo(margin.left + plotWidth + 4, yPos);
      ctx.stroke();
      ctx.fillText(`${pVal}`, margin.left + plotWidth + 6, yPos + 3);
    }
  }, [
    processedMatrix,
    numTraces,
    numSamples,
    palette,
    contrast,
    brightness,
    showHyperbolaTool,
    hyperbolaApex,
    dielectricPermittivity,
    ventanaNs,
    dxM,
    startTrace,
    endTrace,
    visibleTraces,
    startM,
    endM,
    effWindowM,
    getPaletteColor,
    dataset,
  ]);

  // Mouse handlers (Locked cleanly to plot coordinates & window)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const margin = { top: 48, left: 68, right: 68, bottom: 42 };
    const plotWidth = rect.width - margin.left - margin.right;
    const plotHeight = rect.height - margin.top - margin.bottom;

    if (
      clickX >= margin.left &&
      clickX <= margin.left + plotWidth &&
      clickY >= margin.top &&
      clickY <= margin.top + plotHeight
    ) {
      const normX = (clickX - margin.left) / plotWidth;
      const normY = (clickY - margin.top) / plotHeight;

      const traceIdx = Math.max(0, Math.min(numTraces - 1, startTrace + Math.floor(normX * visibleTraces)));
      const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

      if (showHyperbolaTool) {
        setHyperbolaApex({ trace: traceIdx, sample: sampleIdx });
        setIsDraggingApex(true);
      } else if (onSelectTrace) {
        onSelectTrace(traceIdx);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !processedMatrix || numTraces === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const margin = { top: 48, left: 68, right: 68, bottom: 42 };
    const plotWidth = rect.width - margin.left - margin.right;
    const plotHeight = rect.height - margin.top - margin.bottom;

    if (isDraggingApex && showHyperbolaTool) {
      const normX = (mouseX - margin.left) / plotWidth;
      const normY = (mouseY - margin.top) / plotHeight;

      const traceIdx = Math.max(0, Math.min(numTraces - 1, startTrace + Math.floor(normX * visibleTraces)));
      const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

      setHyperbolaApex({ trace: traceIdx, sample: sampleIdx });
      return;
    }

    if (
      mouseX >= margin.left &&
      mouseX <= margin.left + plotWidth &&
      mouseY >= margin.top &&
      mouseY <= margin.top + plotHeight
    ) {
      const normX = (mouseX - margin.left) / plotWidth;
      const normY = (mouseY - margin.top) / plotHeight;

      if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
        const traceIdx = Math.max(0, Math.min(numTraces - 1, startTrace + Math.floor(normX * visibleTraces)));
        const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

        const dtNs = ventanaNs / (numSamples || 512);
        const timeNs = sampleIdx * dtNs;
        const vMPerNs = calculateVelocity(dielectricPermittivity);
        const depthM = (timeNs * vMPerNs) / 2;
        const distM = traceIdx * dxM;
        const amplitude = processedMatrix[traceIdx]?.[sampleIdx] || 0;

        setHoverInfo({ traceIdx, sampleIdx, timeNs, depthM, distM, amplitude });
      } else {
        setHoverInfo(null);
      }
    } else {
      setHoverInfo(null);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingApex(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (distTotalM <= effWindowM || effWindowM <= 0) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const stepM = (effWindowM * 0.15) * (delta > 0 ? 1 : -1);
    setScrollMeters((prev) => Math.max(0, Math.min(maxScrollM, prev + stepM)));
  };

  const twNs = ventanaNs;
  const vMPerNs = calculateVelocity(dielectricPermittivity);
  const profMaxM = (vMPerNs * twNs) / 2.0;

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-white rounded-2xl border border-border overflow-hidden shadow-card">
      {/* Top Banner: PROCIMEC INGENIERIA SAS */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-white z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-sky-400">PROCIMEC INGENIERIA SAS</span>
            {dataset && (
              <span className="text-[11px] text-slate-300 font-mono">
                — {dataset.filename}
              </span>
            )}
          </div>
          {dataset && (
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              εr = {dielectricPermittivity.toFixed(1)} | v = {vMPerNs.toFixed(3)} m/ns | Ventana = {twNs.toFixed(1)} ns | Prof. Máx ≈ {profMaxM.toFixed(2)} m | Distancia Total = {distTotalM.toFixed(2)} m ({numTraces} trazas)
            </span>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Coordinate Info */}
        {hoverInfo && (
          <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 shadow-xl backdrop-blur-md flex items-center gap-4 z-10">
            <div>
              <span className="text-slate-400 font-sans">Traza:</span> <span className="text-sky-400 font-bold">{hoverInfo.traceIdx + 1}</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Distancia:</span> <span className="text-emerald-400 font-bold">{hoverInfo.distM.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Tiempo:</span> <span className="text-amber-400 font-bold">{hoverInfo.timeNs.toFixed(1)}ns</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Profundidad:</span> <span className="text-purple-400 font-bold">{hoverInfo.depthM.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Amplitud:</span> <span className="text-rose-400 font-bold">{hoverInfo.amplitude.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Horizontal Navigation & Scrollbar Bar (10m default window scrollbar) */}
      {dataset && numTraces > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-white z-10 select-none">
          {/* Left: Navigation Buttons & Range Slider */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto flex-1 max-w-xl">
            <button
              onClick={() => setScrollMeters(0)}
              disabled={scrollMeters <= 0}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded text-slate-300 hover:text-white transition flex-shrink-0"
              title="Ir al Inicio (0.00m)"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScrollMeters((prev) => Math.max(0, prev - (effWindowM > 0 ? effWindowM : 10)))}
              disabled={scrollMeters <= 0}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded text-slate-300 hover:text-white transition flex-shrink-0"
              title="Retroceder Ventana"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Horizontal Scrollbar Slider */}
            <div className="flex-1 px-2 flex items-center">
              <input
                type="range"
                min={0}
                max={maxScrollM}
                step={0.1}
                value={startM}
                onChange={(e) => setScrollMeters(parseFloat(e.target.value))}
                disabled={maxScrollM <= 0}
                className="w-full accent-sky-400 bg-slate-700 h-2 rounded cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={() => setScrollMeters((prev) => Math.min(maxScrollM, prev + (effWindowM > 0 ? effWindowM : 10)))}
              disabled={scrollMeters >= maxScrollM}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded text-slate-300 hover:text-white transition flex-shrink-0"
              title="Avanzar Ventana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScrollMeters(maxScrollM)}
              disabled={scrollMeters >= maxScrollM}
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded text-slate-300 hover:text-white transition flex-shrink-0"
              title="Ir al Final"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Window Presets (10m Default) & Distance Badge */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Window Selector Presets */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-[11px]">
              <span className="text-slate-400 px-1.5 text-[10px]">Ventana:</span>
              {[10, 20, 50, 0].map((w) => (
                <button
                  key={w}
                  onClick={() => {
                    setWindowMeters(w);
                    setScrollMeters(0);
                  }}
                  className={`px-2 py-0.5 rounded transition font-mono ${
                    windowMeters === w
                      ? 'bg-sky-500 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {w === 0 ? 'Ver Todo' : `${w}m`}
                </button>
              ))}
            </div>

            {/* Distance Window Badge */}
            <div className="text-[11px] font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-sky-300">
              {startM.toFixed(2)}m – {endM.toFixed(2)}m
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
