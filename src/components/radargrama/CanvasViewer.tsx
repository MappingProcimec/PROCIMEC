'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { calculateVelocity } from '@/lib/gpr/dspEngine';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export type ColorPalette = 'seismic' | 'grayscale' | 'bone' | 'sepia' | 'jet';

interface CanvasViewerProps {
  dataset: GPRDataset | null;
  processedMatrix: Float32Array[] | null;
  palette: ColorPalette;
  contrast: number; // 0.1 to 5.0
  brightness: number; // -100 to 100
  dielectricPermittivity: number;
  onSelectTrace?: (traceIdx: number) => void;
  showHyperbolaTool: boolean;
}

export const CanvasViewer: React.FC<CanvasViewerProps> = ({
  dataset,
  processedMatrix,
  palette = 'seismic',
  contrast = 1.0,
  brightness = 0,
  dielectricPermittivity = 6.0,
  onSelectTrace,
  showHyperbolaTool,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan & Zoom state
  const [zoomX, setZoomX] = useState<number>(1.0);
  const [zoomY, setZoomY] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Reset view
  const handleResetView = () => {
    setZoomX(1.0);
    setZoomY(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Convert bipolar amplitude value [-1, 1] to RGB matching Python matplotlib colormaps
  const getPaletteColor = useCallback(
    (normVal: number): [number, number, number] => {
      // normVal is in range [-1.0, 1.0]
      const val = Math.max(-1.0, Math.min(1.0, normVal * contrast + brightness / 100));

      if (palette === 'seismic') {
        // Matplotlib seismic: Red (+), White (0), Blue (-)
        if (val < 0) {
          const t = 1.0 + val; // 0 to 1
          const r = Math.floor(255 * t);
          const g = Math.floor(255 * t);
          const b = 255;
          return [r, g, b];
        } else {
          const t = 1.0 - val; // 1 to 0
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
        // Jet
        const v = (val + 1) / 2;
        const r = Math.max(0, Math.min(255, Math.floor(255 * Math.sin(v * Math.PI))));
        const g = Math.max(0, Math.min(255, Math.floor(255 * Math.sin((v - 0.25) * Math.PI))));
        const b = Math.max(0, Math.min(255, Math.floor(255 * Math.cos(v * Math.PI * 0.5))));
        return [r, g, b];
      }
    },
    [palette, contrast, brightness]
  );

  // Render Canvas
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

    // Symmetric 98.5-percentile clipping (normalizar_clipping_simetrico)
    const allAbs: number[] = [];
    const step = Math.max(1, Math.floor(numTraces / 100));
    for (let t = 0; t < numTraces; t += step) {
      const tr = processedMatrix[t];
      for (let s = 0; s < numSamples; s += 4) {
        allAbs.push(Math.abs(tr[s]));
      }
    }
    allAbs.sort((a, b) => a - b);
    const pIdx = Math.floor(allAbs.length * 0.985);
    const vmax = allAbs[pIdx] || (allAbs.length > 0 ? allAbs[allAbs.length - 1] : 1.0) || 1.0;

    // Offscreen ImageData (numTraces x numSamples)
    const imgData = ctx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    let ptr = 0;
    for (let s = 0; s < numSamples; s++) {
      for (let t = 0; t < numTraces; t++) {
        const amp = processedMatrix[t][s];
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
    offCanvas.width = numTraces;
    offCanvas.height = numSamples;
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
    }

    // Clip to plot area & draw image with pan/zoom
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
    ctx.clip();

    ctx.translate(margin.left + panOffset.x, margin.top + panOffset.y);
    ctx.scale(zoomX, zoomY);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, numTraces, numSamples, 0, 0, plotWidth, plotHeight);

    // Hyperbola Tool Overlay
    if (showHyperbolaTool && dataset) {
      const apex = hyperbolaApex || { trace: Math.floor(numTraces / 2), sample: Math.floor(numSamples / 3) };
      const dt = dataset.header.sampleIntervalNs;
      const dx = dataset.header.traceDistanceStepM;
      const vMPerNs = calculateVelocity(dielectricPermittivity);

      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 2.5 / Math.min(zoomX, zoomY);
      ctx.beginPath();

      const t0Ns = apex.sample * dt;
      const x0M = apex.trace * dx;

      for (let tr = 0; tr < numTraces; tr++) {
        const xM = tr * dx;
        const distM = xM - x0M;
        const tNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vMPerNs * vMPerNs));
        const sIdx = tNs / dt;

        const canvasX = (tr / numTraces) * plotWidth;
        const canvasY = (sIdx / numSamples) * plotHeight;

        if (tr === 0) ctx.moveTo(canvasX, canvasY);
        else ctx.lineTo(canvasX, canvasY);
      }
      ctx.stroke();

      const apexCanvasX = (apex.trace / numTraces) * plotWidth;
      const apexCanvasY = (apex.sample / numSamples) * plotHeight;

      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(apexCanvasX, apexCanvasY, 6 / Math.min(zoomX, zoomY), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / Math.min(zoomX, zoomY);
      ctx.stroke();
    }

    ctx.restore();

    // --- 4 GEOPHYSICAL AXES (Configurar Ejes Radargrama) ---
    ctx.strokeStyle = '#1A252C';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

    const twNs = dataset ? dataset.header.timeWindowNs : 90.0;
    const dxM = dataset ? dataset.header.traceDistanceStepM : 1.0 / 112.0;
    const vMPerNs = calculateVelocity(dielectricPermittivity);
    const profMaxM = (vMPerNs * twNs) / 2.0;
    const distTotalM = numTraces * dxM;

    // 1. TOP AXIS: Número de Traza (1 ... Nt)
    ctx.fillStyle = '#1A252C';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Número de Traza', margin.left + plotWidth / 2, margin.top - 20);

    ctx.font = '8px sans-serif';
    const numXTicks = 8;
    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const xPos = margin.left + frac * plotWidth;
      const traceNum = Math.max(1, Math.round(frac * numTraces));

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
      const dist = (distTotalM * frac).toFixed(2);

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
    zoomX,
    zoomY,
    panOffset,
    showHyperbolaTool,
    hyperbolaApex,
    dielectricPermittivity,
    getPaletteColor,
    dataset,
  ]);

  // Mouse handlers
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
      if (e.shiftKey || showHyperbolaTool) {
        const normX = (clickX - margin.left - panOffset.x) / (plotWidth * zoomX);
        const normY = (clickY - margin.top - panOffset.y) / (plotHeight * zoomY);

        const traceIdx = Math.max(0, Math.min(numTraces - 1, Math.floor(normX * numTraces)));
        const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

        if (showHyperbolaTool) {
          setHyperbolaApex({ trace: traceIdx, sample: sampleIdx });
          setIsDraggingApex(true);
        } else if (onSelectTrace) {
          onSelectTrace(traceIdx);
        }
      } else {
        setIsPanning(true);
        setDragStart({ x: clickX - panOffset.x, y: clickY - panOffset.y });
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

    if (isPanning) {
      setPanOffset({
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y,
      });
      return;
    }

    if (isDraggingApex && showHyperbolaTool) {
      const normX = (mouseX - margin.left - panOffset.x) / (plotWidth * zoomX);
      const normY = (mouseY - margin.top - panOffset.y) / (plotHeight * zoomY);

      const traceIdx = Math.max(0, Math.min(numTraces - 1, Math.floor(normX * numTraces)));
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
      const normX = (mouseX - margin.left - panOffset.x) / (plotWidth * zoomX);
      const normY = (mouseY - margin.top - panOffset.y) / (plotHeight * zoomY);

      if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
        const traceIdx = Math.floor(normX * numTraces);
        const sampleIdx = Math.floor(normY * numSamples);

        const dtNs = dataset ? dataset.header.sampleIntervalNs : 0.0976;
        const dxM = dataset ? dataset.header.traceDistanceStepM : 1.0 / 112.0;
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
    setIsPanning(false);
    setIsDraggingApex(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    if (e.shiftKey) {
      setZoomX((prev) => Math.max(0.2, Math.min(30.0, prev * factor)));
    } else {
      setZoomX((prev) => Math.max(0.2, Math.min(30.0, prev * factor)));
      setZoomY((prev) => Math.max(0.2, Math.min(10.0, prev * factor)));
    }
  };

  const twNs = dataset ? dataset.header.timeWindowNs : 90.0;
  const dxM = dataset ? dataset.header.traceDistanceStepM : 1.0 / 112.0;
  const vMPerNs = calculateVelocity(dielectricPermittivity);
  const profMaxM = (vMPerNs * twNs) / 2.0;
  const distTotalM = numTraces * dxM;

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-white rounded-2xl border border-border overflow-hidden shadow-card">
      {/* Top Banner: PROCIMEC INGENIERIA SAS */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-white z-10">
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
              εr = {dielectricPermittivity.toFixed(1)} | v = {vMPerNs.toFixed(3)} m/ns | Ventana = {twNs.toFixed(1)} ns | Prof. Máx ≈ {profMaxM.toFixed(2)} m | Distancia ≈ {distTotalM.toFixed(2)} m ({numTraces} trazas × {numSamples} muestras)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setZoomX((z) => Math.min(30, z * 1.25));
              setZoomY((z) => Math.min(10, z * 1.25));
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
            title="Acercar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoomX((z) => Math.max(0.2, z * 0.8));
              setZoomY((z) => Math.max(0.2, z * 0.8));
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
            title="Alejar Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomX((z) => Math.min(30, z * 1.5))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition text-[10px] font-bold"
            title="Expandir Horizontalmente"
          >
            ↔ Estirar
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
            title="Vista Completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 ml-1 font-mono">{Math.round(zoomX * 100)}%</span>
        </div>
      </div>

      {/* Main Canvas */}
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
    </div>
  );
};
