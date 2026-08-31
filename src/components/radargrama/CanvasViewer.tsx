'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { calculateVelocity } from '@/lib/gpr/dspEngine';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export type ColorPalette = 'grayscale' | 'sepia' | 'jet' | 'seismic' | 'bone';

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
  palette,
  contrast,
  brightness,
  dielectricPermittivity,
  onSelectTrace,
  showHyperbolaTool,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
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
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Convert normalized amplitude to RGBA color based on selected palette
  const getPaletteColor = useCallback(
    (normVal: number): [number, number, number] => {
      // normVal is [-1, 1]
      const val = Math.max(-1, Math.min(1, normVal * contrast + brightness / 100));

      if (palette === 'grayscale') {
        const gray = Math.floor(((val + 1) / 2) * 255);
        return [gray, gray, gray];
      } else if (palette === 'sepia') {
        const v = (val + 1) / 2;
        return [
          Math.floor(v * 230 + 25),
          Math.floor(v * 180 + 15),
          Math.floor(v * 120 + 10),
        ];
      } else if (palette === 'seismic') {
        // Red - White - Blue
        if (val < 0) {
          const r = Math.floor(255 * (1 + val));
          const g = Math.floor(255 * (1 + val));
          const b = 255;
          return [r, g, b];
        } else {
          const r = 255;
          const g = Math.floor(255 * (1 - val));
          const b = Math.floor(255 * (1 - val));
          return [r, g, b];
        }
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
      } else {
        // Jet / Rainbow
        const v = (val + 1) / 2; // 0 to 1
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

    // High resolution rendering
    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width || 800);
    const height = Math.floor(rect.height || 500);

    canvas.width = width;
    canvas.height = height;

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Margins for rulers
    const margin = { top: 30, left: 65, right: 20, bottom: 45 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    if (plotWidth <= 0 || plotHeight <= 0) return;

    // Offscreen ImageData rendering
    const imgData = ctx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    // Find min & max amplitude for normalization
    let minA = Infinity;
    let maxA = -Infinity;
    for (let t = 0; t < numTraces; t++) {
      const tr = processedMatrix[t];
      for (let s = 0; s < numSamples; s++) {
        const v = tr[s];
        if (v < minA) minA = v;
        if (v > maxA) maxA = v;
      }
    }
    const maxAbs = Math.max(Math.abs(minA), Math.abs(maxA)) || 1.0;

    // Populate pixels
    let ptr = 0;
    for (let s = 0; s < numSamples; s++) {
      for (let t = 0; t < numTraces; t++) {
        const amp = processedMatrix[t][s];
        const normVal = amp / maxAbs;
        const [r, g, b] = getPaletteColor(normVal);

        data[ptr] = r;
        data[ptr + 1] = g;
        data[ptr + 2] = b;
        data[ptr + 3] = 255;
        ptr += 4;
      }
    }

    // Create offscreen canvas to scale and transform plot area
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
    ctx.scale(zoom, zoom);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offCanvas, 0, 0, numTraces, numSamples, 0, 0, plotWidth, plotHeight);

    // Draw Hyperbola tool overlay if active
    if (showHyperbolaTool && dataset) {
      const apex = hyperbolaApex || { trace: Math.floor(numTraces / 2), sample: Math.floor(numSamples / 3) };
      const dt = dataset.header.sampleIntervalNs;
      const dx = dataset.header.traceDistanceStepM;
      const vMPerNs = calculateVelocity(dielectricPermittivity);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();

      const t0Ns = apex.sample * dt;
      const x0M = apex.trace * dx;

      // Draw hyperbola curve t(x) = sqrt(t0^2 + 4 * (x - x0)^2 / v^2)
      for (let tr = 0; tr < numTraces; tr++) {
        const xM = tr * dx;
        const distM = xM - x0M;
        const tNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vMPerNs * vMPerNs));
        const sIdx = tNs / dt;

        const canvasX = (tr / numTraces) * plotWidth;
        const canvasY = (sIdx / numSamples) * plotHeight;

        if (tr === 0) {
          ctx.moveTo(canvasX, canvasY);
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      }
      ctx.stroke();

      // Draw Apex handle point
      const apexCanvasX = (apex.trace / numTraces) * plotWidth;
      const apexCanvasY = (apex.sample / numSamples) * plotHeight;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(apexCanvasX, apexCanvasY, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.restore();

    // Draw Rulers & Grid Axes
    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';

    // Outer border around plot
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

    // Top X-Axis: Distance (m) & Trace #
    const numXTicks = 6;
    for (let i = 0; i <= numXTicks; i++) {
      const frac = i / numXTicks;
      const xPos = margin.left + frac * plotWidth;

      ctx.beginPath();
      ctx.moveTo(xPos, margin.top);
      ctx.lineTo(xPos, margin.top - 5);
      ctx.stroke();

      const distM = (dataset ? dataset.header.traceDistanceStepM * numTraces * frac : frac * 100).toFixed(1);
      ctx.textAlign = 'center';
      ctx.fillText(`${distM}m`, xPos, margin.top - 8);
    }

    // Left Y-Axis: Time (ns) & Depth (m)
    const numYTicks = 6;
    const dtNs = dataset ? dataset.header.sampleIntervalNs : 0.1;
    const totalTimeNs = numSamples * dtNs;
    const vMPerNs = calculateVelocity(dielectricPermittivity);
    const totalDepthM = (totalTimeNs * vMPerNs) / 2;

    for (let j = 0; j <= numYTicks; j++) {
      const frac = j / numYTicks;
      const yPos = margin.top + frac * plotHeight;

      ctx.beginPath();
      ctx.moveTo(margin.left, yPos);
      ctx.lineTo(margin.left - 5, yPos);
      ctx.stroke();

      const timeVal = (totalTimeNs * frac).toFixed(0);
      const depthVal = (totalDepthM * frac).toFixed(2);

      ctx.textAlign = 'right';
      ctx.fillText(`${timeVal}ns`, margin.left - 8, yPos - 2);
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${depthVal}m`, margin.left - 8, yPos + 10);
      ctx.fillStyle = '#94a3b8';
    }

    // Labels
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Distancia (m)', margin.left + plotWidth / 2, 14);

    ctx.save();
    ctx.translate(14, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Tiempo (ns) / Prof. (m)', 0, 0);
    ctx.restore();
  }, [
    processedMatrix,
    numTraces,
    numSamples,
    palette,
    contrast,
    brightness,
    zoom,
    panOffset,
    showHyperbolaTool,
    hyperbolaApex,
    dielectricPermittivity,
    getPaletteColor,
    dataset,
  ]);

  // Mouse handlers for pan, zoom, hover & hyperbola apex dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const margin = { top: 30, left: 65, right: 20, bottom: 45 };
    const plotWidth = rect.width - margin.left - margin.right;
    const plotHeight = rect.height - margin.top - margin.bottom;

    // Check if clicking inside plot area
    if (
      clickX >= margin.left &&
      clickX <= margin.left + plotWidth &&
      clickY >= margin.top &&
      clickY <= margin.top + plotHeight
    ) {
      if (e.shiftKey || showHyperbolaTool) {
        // Hyperbola apex movement or trace selection
        const normX = (clickX - margin.left - panOffset.x) / (plotWidth * zoom);
        const normY = (clickY - margin.top - panOffset.y) / (plotHeight * zoom);

        const traceIdx = Math.max(0, Math.min(numTraces - 1, Math.floor(normX * numTraces)));
        const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

        if (showHyperbolaTool) {
          setHyperbolaApex({ trace: traceIdx, sample: sampleIdx });
          setIsDraggingApex(true);
        } else if (onSelectTrace) {
          onSelectTrace(traceIdx);
        }
      } else {
        // Start Panning
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

    const margin = { top: 30, left: 65, right: 20, bottom: 45 };
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
      const normX = (mouseX - margin.left - panOffset.x) / (plotWidth * zoom);
      const normY = (mouseY - margin.top - panOffset.y) / (plotHeight * zoom);

      const traceIdx = Math.max(0, Math.min(numTraces - 1, Math.floor(normX * numTraces)));
      const sampleIdx = Math.max(0, Math.min(numSamples - 1, Math.floor(normY * numSamples)));

      setHyperbolaApex({ trace: traceIdx, sample: sampleIdx });
      return;
    }

    // Hover Info Calculation
    if (
      mouseX >= margin.left &&
      mouseX <= margin.left + plotWidth &&
      mouseY >= margin.top &&
      mouseY <= margin.top + plotHeight
    ) {
      const normX = (mouseX - margin.left - panOffset.x) / (plotWidth * zoom);
      const normY = (mouseY - margin.top - panOffset.y) / (plotHeight * zoom);

      if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
        const traceIdx = Math.floor(normX * numTraces);
        const sampleIdx = Math.floor(normY * numSamples);

        const dtNs = dataset ? dataset.header.sampleIntervalNs : 0.1;
        const dxM = dataset ? dataset.header.traceDistanceStepM : 0.05;
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
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.5, Math.min(10.0, prev * zoomFactor)));
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Overlay Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="font-semibold text-sky-400">Visualizador B-Scan</span>
          {dataset && (
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
              {dataset.filename} ({numTraces} trazas, {numSamples} muestras)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Buttons */}
          <button
            onClick={() => setZoom((z) => Math.min(10, z * 1.25))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            title="Acercar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            title="Alejar Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
            title="Restablecer Vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <span className="text-xs text-slate-400 ml-2 font-mono">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 w-full h-full bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Coordinate Info Pill */}
        {hoverInfo && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 shadow-xl backdrop-blur-md flex items-center gap-4">
            <div>
              <span className="text-slate-400">Traza:</span> <span className="text-sky-400 font-bold">{hoverInfo.traceIdx}</span>
            </div>
            <div>
              <span className="text-slate-400">Dist:</span> <span className="text-emerald-400 font-bold">{hoverInfo.distM.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400">Tiempo:</span> <span className="text-amber-400 font-bold">{hoverInfo.timeNs.toFixed(1)}ns</span>
            </div>
            <div>
              <span className="text-slate-400">Prof:</span> <span className="text-purple-400 font-bold">{hoverInfo.depthM.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400">Amp:</span> <span className="text-rose-400 font-bold">{hoverInfo.amplitude.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
