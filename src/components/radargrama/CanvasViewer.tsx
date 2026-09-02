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

  // Horizontal Window & Panning state (Minimum window size = 10 meters)
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
    hasData: boolean;
  } | null>(null);

  // Hyperbola tool state
  const [hyperbolaApex, setHyperbolaApex] = useState<{ trace: number; sample: number } | null>(null);
  const [isDraggingApex, setIsDraggingApex] = useState<boolean>(false);

  const numTraces = processedMatrix ? processedMatrix.length : 0;
  const numSamples = processedMatrix && numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = traceDistanceStepM > 0 ? traceDistanceStepM : 1.0 / 112.0;
  const distTotalM = numTraces * dxM;

  // Minimum visible window in distance is ALWAYS 10.0 meters
  const MIN_WINDOW_M = 10.0;
  const effWindowM = windowMeters === 0
    ? Math.max(MIN_WINDOW_M, distTotalM)
    : Math.max(MIN_WINDOW_M, Math.min(windowMeters, distTotalM));

  const maxScrollM = Math.max(0, distTotalM - effWindowM);
  const startM = Math.max(0, Math.min(maxScrollM, scrollMeters));
  const endM = Math.min(distTotalM, startM + effWindowM);

  const startTrace = Math.max(0, Math.floor(startM / dxM));
  const endTrace = Math.min(numTraces, Math.ceil(endM / dxM));
  const visibleTraces = Math.max(1, endTrace - startTrace);
  const visibleDataDistM = visibleTraces * dxM;

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

  // Render Canvas with Minimum 10m Windowing & Blank Space for Short Profiles
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

    // Proportion of physical data width relative to 10m minimum window
    const dataFraction = Math.min(1.0, visibleDataDistM / effWindowM);
    const dataPlotWidth = Math.max(1, Math.floor(plotWidth * dataFraction));

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

    // Offscreen ImageData for current profile data (visibleTraces x numSamples)
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

    // Draw profile image strictly inside dataPlotWidth
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, visibleTraces, numSamples, margin.left, margin.top, dataPlotWidth, plotHeight);

    // Fill remaining horizontal area with clean white blank space when profile length < 10m
    if (dataPlotWidth < plotWidth) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(margin.left + dataPlotWidth, margin.top, plotWidth - dataPlotWidth, plotHeight);
    }

    // Hyperbola Tool Overlay
    if (showHyperbolaTool) {
      const defaultApexTrace = Math.floor((startTrace + endTrace) / 2);
      const apex = hyperbolaApex || { trace: defaultApexTrace, sample: Math.floor(numSamples / 3) };
      const dt = ventanaNs / numSamples;
      const vMPerNs = calculateVelocity(dielectricPermittivity);

      ctx.save();
      ctx.beginPath();
      ctx.rect(margin.left, margin.top, dataPlotWidth, plotHeight);
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

        const canvasX = margin.left + ((tr - startTrace) / visibleTraces) * dataPlotWidth;
        const canvasY = margin.top + (sIdx / numSamples) * plotHeight;

        if (tr === startTrace) ctx.moveTo(canvasX, canvasY);
        else ctx.lineTo(canvasX, canvasY);
      }
      ctx.stroke();

      if (apex.trace >= startTrace && apex.trace < endTrace) {
        const apexCanvasX = margin.left + ((apex.trace - startTrace) / visibleTraces) * dataPlotWidth;
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

    // 1. TOP AXIS: Número de Traza (Over dataPlotWidth span)
    ctx.fillStyle = '#1A252C';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Número de Traza', margin.left + dataPlotWidth / 2, margin.top - 20);

    ctx.font = '8px sans-serif';
    const numXTicks = 8;
    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const xPos = margin.left + frac * dataPlotWidth;
      const traceNum = Math.max(1, Math.round(startTrace + 1 + frac * Math.max(0, visibleTraces - 1)));

      ctx.beginPath();
      ctx.moveTo(xPos, margin.top);
      ctx.lineTo(xPos, margin.top - 4);
      ctx.stroke();
      ctx.fillText(`${traceNum}`, xPos, margin.top - 6);
    }

    // 2. BOTTOM AXIS: Distancia Recorrida (m) (0.00m to effWindowM minimum 10.0m)
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
    ctx.translate(15, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
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
    ctx.translate(width - 15, margin.top + plotHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#780000';
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
    visibleDataDistM,
    startM,
    endM,
    effWindowM,
    getPaletteColor,
    dataset,
  ]);

  // Mouse handlers (Locked cleanly to data plot region)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const margin = { top: 48, left: 68, right: 68, bottom: 42 };
    const plotWidth = rect.width - margin.left - margin.right;
    const plotHeight = rect.height - margin.top - margin.bottom;

    const dataFraction = Math.min(1.0, visibleDataDistM / effWindowM);
    const dataPlotWidth = Math.max(1, Math.floor(plotWidth * dataFraction));

    if (
      clickX >= margin.left &&
      clickX <= margin.left + dataPlotWidth &&
      clickY >= margin.top &&
      clickY <= margin.top + plotHeight
    ) {
      const normX = (clickX - margin.left) / dataPlotWidth;
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

    const dataFraction = Math.min(1.0, visibleDataDistM / effWindowM);
    const dataPlotWidth = Math.max(1, Math.floor(plotWidth * dataFraction));

    if (isDraggingApex && showHyperbolaTool) {
      const normX = (mouseX - margin.left) / dataPlotWidth;
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
      const normY = (mouseY - margin.top) / plotHeight;
      const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));
      const timeNs = (sampleIdx / Math.max(1, numSamples - 1)) * ventanaNs;
      const vMPerNs = calculateVelocity(dielectricPermittivity);
      const depthM = (timeNs * vMPerNs) / 2.0;

      if (mouseX <= margin.left + dataPlotWidth) {
        const normX = (mouseX - margin.left) / dataPlotWidth;
        const traceIdx = Math.max(0, Math.min(numTraces - 1, startTrace + Math.floor(normX * visibleTraces)));
        const distM = traceIdx * dxM;
        const amplitude = processedMatrix[traceIdx]?.[sampleIdx] || 0;

        setHoverInfo({
          traceIdx,
          sampleIdx,
          timeNs,
          depthM,
          distM,
          amplitude,
          hasData: true,
        });
      } else {
        const normXFull = (mouseX - margin.left) / plotWidth;
        const distM = startM + normXFull * effWindowM;

        setHoverInfo({
          traceIdx: numTraces,
          sampleIdx,
          timeNs,
          depthM,
          distM,
          amplitude: 0,
          hasData: false,
        });
      }
    } else {
      setHoverInfo(null);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingApex(false);
  };

  const handleMouseLeave = () => {
    setIsDraggingApex(false);
    setHoverInfo(null);
  };

  // Quick navigation helpers
  const handleScroll = (deltaM: number) => {
    setScrollMeters((prev) => Math.max(0, Math.min(maxScrollM, prev + deltaM)));
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      {/* Top Metadata Header Bar (Locked to fixed 40px height, 100% single line to prevent layout shift) */}
      <div className="h-10 bg-slate-900 text-slate-100 px-3 text-[11px] font-mono flex items-center justify-between border-b border-slate-800 shadow-sm flex-shrink-0 select-none overflow-hidden">
        {/* Left Side: File and GPR Geophysical Metadata (Single Line, No Wrap) */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar py-0.5 min-w-0">
          <span className="font-bold text-sky-400 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-800/60 text-xs flex-shrink-0">
            {dataset ? dataset.filename : 'Sin archivo'}
          </span>
          <span className="text-slate-400 flex-shrink-0">
            εr: <strong className="text-slate-100">{dielectricPermittivity.toFixed(1)}</strong>
          </span>
          <span className="text-slate-600 flex-shrink-0">•</span>
          <span className="text-slate-400 flex-shrink-0">
            v: <strong className="text-slate-100">{calculateVelocity(dielectricPermittivity).toFixed(3)} m/ns</strong>
          </span>
          <span className="text-slate-600 flex-shrink-0">•</span>
          <span className="text-slate-400 flex-shrink-0">
            Ventana: <strong className="text-amber-300">{ventanaNs.toFixed(1)} ns</strong>
          </span>
          <span className="text-slate-600 flex-shrink-0">•</span>
          <span className="text-slate-400 flex-shrink-0">
            Prof. Máx: <strong className="text-purple-300">{((calculateVelocity(dielectricPermittivity) * ventanaNs) / 2).toFixed(2)} m</strong>
          </span>
          <span className="text-slate-600 flex-shrink-0">•</span>
          <span className="text-slate-400 flex-shrink-0">
            Distancia: <strong className="text-emerald-400">{distTotalM.toFixed(2)} m</strong> <span className="text-slate-400 font-normal">({numTraces} tr)</span>
          </span>
        </div>

        {/* Right Side: Reserved Inspection Panel (Single Line, Never Alters Header Height) */}
        <div className="flex-shrink-0 ml-3 flex items-center">
          {hoverInfo && hoverInfo.hasData ? (
            <div className="flex items-center gap-2 bg-slate-800/90 px-2.5 py-0.5 rounded-md border border-slate-700 text-[11px] text-slate-200 shadow-inner whitespace-nowrap">
              <span>Tr: <strong className="text-white">#{hoverInfo.traceIdx + 1}</strong></span>
              <span className="text-slate-600">|</span>
              <span>Dist: <strong className="text-white">{hoverInfo.distM.toFixed(2)}m</strong></span>
              <span className="text-slate-600">|</span>
              <span>t: <strong className="text-amber-300">{hoverInfo.timeNs.toFixed(1)}ns</strong></span>
              <span className="text-slate-600">|</span>
              <span>z: <strong className="text-purple-300">{hoverInfo.depthM.toFixed(2)}m</strong></span>
              <span className="text-slate-600">|</span>
              <span>Amp: <strong className={hoverInfo.amplitude >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{Math.round(hoverInfo.amplitude)}</strong></span>
            </div>
          ) : hoverInfo && !hoverInfo.hasData ? (
            <div className="flex items-center gap-2 bg-slate-800/60 px-2.5 py-0.5 rounded-md border border-slate-700/60 text-[11px] text-slate-400 whitespace-nowrap">
              <span>Dist: <strong>{hoverInfo.distM.toFixed(2)}m</strong></span>
              <span className="italic text-slate-400">(Sin Datos)</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10.5px] text-slate-400 bg-slate-800/40 border border-slate-800/80 whitespace-nowrap">
              <span>Inspección: Mover cursor</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      {/* Bottom Navigation Toolbar */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-between gap-3 text-xs">
        {/* Scroll Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleScroll(-10)}
            disabled={scrollMeters <= 0}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
            title="Inicio / Retroceder 10m"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll(-2)}
            disabled={scrollMeters <= 0}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
            title="Retroceder 2m"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Range Slider for Panning */}
          <div className="w-48 sm:w-72 mx-2">
            <input
              type="range"
              min={0}
              max={maxScrollM || 0.01}
              step={0.1}
              value={scrollMeters}
              onChange={(e) => setScrollMeters(parseFloat(e.target.value))}
              disabled={maxScrollM <= 0}
              className="w-full accent-primary bg-slate-700 rounded h-1.5 cursor-pointer disabled:opacity-30"
            />
          </div>

          <button
            onClick={() => handleScroll(2)}
            disabled={scrollMeters >= maxScrollM}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
            title="Avanzar 2m"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll(10)}
            disabled={scrollMeters >= maxScrollM}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
            title="Fin / Avanzar 10m"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Window Selector & Range Readout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <span className="text-[10px] text-slate-400 px-1 font-medium">Ventana:</span>
            {[10, 20, 50, 0].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setWindowMeters(m);
                  setScrollMeters(0);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                  windowMeters === m
                    ? 'bg-primary text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {m === 0 ? 'Ver Todo' : `${m}m`}
              </button>
            ))}
          </div>

          <span className="font-mono text-[11px] text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
            {startM.toFixed(2)}m – {endM.toFixed(2)}m
          </span>
        </div>
      </div>
    </div>
  );
};
