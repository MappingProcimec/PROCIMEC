'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { calculateVelocity } from '@/lib/gpr/dspEngine';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Radio,
  Crosshair,
} from 'lucide-react';
import { DetectionConfig, DetectionResults, AnomalyMarker } from '@/lib/gpr/detectionTypes';

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
  mode?: 'crudo' | 'procesado';
  onSelectTrace?: (traceIdx: number) => void;
  showHyperbolaTool: boolean;
  detectionConfig?: DetectionConfig;
  detectionResults?: DetectionResults;
  selectedMarker?: AnomalyMarker | null;
  onSelectMarker?: (marker: AnomalyMarker | null) => void;
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
  mode = 'crudo',
  onSelectTrace,
  showHyperbolaTool,
  detectionConfig,
  detectionResults,
  selectedMarker: externalSelectedMarker,
  onSelectMarker,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Horizontal Window & Panning state (0 = "Ver Todo" / Full Profile View)
  const [windowMeters, setWindowMeters] = useState<number>(0);
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

  // Anomaly detection overlay states
  const [plotMetrics, setPlotMetrics] = useState<{
    width: number;
    height: number;
    marginLeft: number;
    marginTop: number;
    dataPlotWidth: number;
    plotHeight: number;
    startTrace: number;
    visibleTraces: number;
  } | null>(null);

  const [hoveredMarker, setHoveredMarker] = useState<AnomalyMarker | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [internalSelectedMarker, setInternalSelectedMarker] = useState<AnomalyMarker | null>(null);
  const selectedMarker = externalSelectedMarker !== undefined ? externalSelectedMarker : internalSelectedMarker;

  // Anti-jitter / anti-flicker hover timer ref for adjacent and overlapping markers
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMarkerMouseEnter = useCallback((e: React.MouseEvent, m: AnomalyMarker) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredMarker(m);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMarkerMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMarkerMouseLeave = useCallback((m: AnomalyMarker) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredMarker((current) => (current?.id === m.id ? null : current));
    }, 120);
  }, []);

  // Gather all active anomaly markers
  const allActiveMarkers: AnomalyMarker[] = useMemo(() => {
    if (!detectionResults || !detectionConfig) return [];
    const list: AnomalyMarker[] = [];
    if (detectionConfig.brightSpot?.enabled) list.push(...(detectionResults.brightSpots?.markers || []));
    if (detectionConfig.hyperbola?.enabled) list.push(...(detectionResults.hyperbolas?.markers || []));
    if (detectionConfig.delamination?.enabled) list.push(...(detectionResults.delaminations?.markers || []));
    if (detectionConfig.subslabVoid?.enabled) list.push(...(detectionResults.subslabVoids?.markers || []));
    if (detectionConfig.diffuseScattering?.enabled) list.push(...(detectionResults.diffuseScattering?.markers || []));
    if (detectionConfig.jointInfiltration?.enabled) list.push(...(detectionResults.jointInfiltrations?.markers || []));
    if (detectionConfig.dielectricShadow?.enabled) list.push(...(detectionResults.dielectricShadows?.markers || []));
    if (detectionConfig.thicknessVariation?.enabled) list.push(...(detectionResults.thicknessVariations?.markers || []));
    if (detectionConfig.pipeUtility?.enabled) list.push(...(detectionResults.pipesUtilities?.markers || []));
    return list;
  }, [detectionResults, detectionConfig]);

  // Find co-located or nearby markers for the hovered marker (within 0.35m and 6ns)
  const coLocatedHoveredMarkers = useMemo(() => {
    if (!hoveredMarker) return [];
    return allActiveMarkers.filter(
      (other) =>
        other.id !== hoveredMarker.id &&
        Math.abs(other.xCenterM - hoveredMarker.xCenterM) < 0.35 &&
        Math.abs(other.timeNs - hoveredMarker.timeNs) < 6.0
    );
  }, [hoveredMarker, allActiveMarkers]);

  // Find co-located or nearby markers for the selected marker
  const coLocatedSelectedMarkers = useMemo(() => {
    if (!selectedMarker) return [];
    const cluster = allActiveMarkers.filter(
      (other) =>
        Math.abs(other.xCenterM - selectedMarker.xCenterM) < 0.40 &&
        Math.abs(other.timeNs - selectedMarker.timeNs) < 8.0
    );
    if (!cluster.some((m) => m.id === selectedMarker.id)) {
      cluster.unshift(selectedMarker);
    }
    return cluster;
  }, [selectedMarker, allActiveMarkers]);

  const numTraces = processedMatrix ? processedMatrix.length : 0;
  const numSamples = processedMatrix && numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = traceDistanceStepM > 0 ? traceDistanceStepM : 1.0 / 112.0;
  const distTotalM = numTraces * dxM;

  // Horizontal windowing: windowMeters === 0 shows 100% of the profile horizontally
  const effWindowM = windowMeters === 0 ? distTotalM : Math.min(windowMeters, distTotalM);

  const maxScrollM = Math.max(0, distTotalM - effWindowM);

  const setSelectedMarker = useCallback((m: AnomalyMarker | null) => {
    setInternalSelectedMarker(m);
    onSelectMarker?.(m);
    if (m && windowMeters > 0) {
      const targetScroll = Math.max(0, Math.min(maxScrollM, m.xCenterM - effWindowM / 2));
      setScrollMeters(targetScroll);
    }
  }, [onSelectMarker, windowMeters, maxScrollM, effWindowM]);

  // Sync when externalSelectedMarker changes
  useEffect(() => {
    if (externalSelectedMarker && windowMeters > 0) {
      const targetScroll = Math.max(0, Math.min(maxScrollM, externalSelectedMarker.xCenterM - effWindowM / 2));
      setScrollMeters(targetScroll);
    }
  }, [externalSelectedMarker, windowMeters, maxScrollM, effWindowM]);

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

    // Proportion of physical data width relative to visible window
    const dataFraction = effWindowM > 0 ? Math.min(1.0, visibleDataDistM / effWindowM) : 1.0;
    const dataPlotWidth = Math.max(1, Math.floor(plotWidth * dataFraction));

    setPlotMetrics({
      width,
      height,
      marginLeft: margin.left,
      marginTop: margin.top,
      dataPlotWidth,
      plotHeight,
      startTrace,
      visibleTraces,
    });

    // Dynamic range normalization: symmetric 98.5-percentile clipping across visible traces
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
    let vmax = allAbs[pIdx] || (allAbs.length > 0 ? allAbs[allAbs.length - 1] : 1.0) || 1.0;
    if (vmax <= 1e-6) vmax = 1.0;
    // In raw mode, ensure minimum scale floor of 1000 to avoid over-amplifying pure background noise
    if (mode === 'crudo') {
      vmax = Math.max(1000.0, vmax);
    }


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
    mode,
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

  // Coordinate mapping helpers for Anomaly SVG overlay
  const getCanvasXFromTrace = (trace: number) => {
    if (!plotMetrics) return 0;
    const normX = (trace - plotMetrics.startTrace) / Math.max(1, plotMetrics.visibleTraces);
    return plotMetrics.marginLeft + normX * plotMetrics.dataPlotWidth;
  };

  const getCanvasXFromDistM = (distM: number) => {
    const tr = distM / dxM;
    return getCanvasXFromTrace(tr);
  };

  const getCanvasYFromTimeNs = (timeNs: number) => {
    if (!plotMetrics) return 0;
    const normY = timeNs / Math.max(0.1, ventanaNs);
    return plotMetrics.marginTop + normY * plotMetrics.plotHeight;
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden relative">
      {/* Fila 1: Metadatos Fijos del Perfil (Altura fija de 32px, 100% estable sin saltos de tamaño) */}
      <div className="h-8 min-h-[32px] bg-slate-900 text-slate-100 px-3 text-[11px] font-mono flex items-center border-b border-slate-800 shadow-2xs select-none overflow-x-auto no-scrollbar flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap whitespace-nowrap min-w-0">
          <span className="font-bold text-sky-400 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-800/60 text-xs flex-shrink-0">
            {dataset ? dataset.filename : 'Sin archivo'}
          </span>
          <span className="bg-[#EAA023] text-primary-900 font-bold px-2 py-0.5 rounded text-xs flex-shrink-0 flex items-center gap-1 shadow-xs">
            <Radio className="w-3 h-3 text-primary-900" />
            <span>{dataset?.header?.antennaFreqMHz || 400} MHz</span>
          </span>
          <span className="text-slate-600 flex-shrink-0">•</span>
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
            Distancia: <strong className="text-emerald-400">{distTotalM.toFixed(2)} m</strong> <span className="text-slate-400 font-normal">({numTraces} tr · {Math.round(1.0 / dxM)} tr/m)</span>
          </span>
        </div>
      </div>

      {/* Fila 2: Información de Inspección en Tiempo Real del Cursor (Altura fija de 28px, NUNCA altera el tamaño del perfil) */}
      <div className="h-7 min-h-[28px] bg-slate-950 text-slate-300 px-3 text-[11px] font-mono flex items-center justify-between border-b border-slate-800/90 shadow-inner select-none overflow-hidden flex-shrink-0">
        {hoverInfo && hoverInfo.hasData ? (
          <div className="flex items-center gap-2 sm:gap-3 flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar py-0.5">
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Crosshair className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Inspección:</span>
            </span>
            <span>Traza: <strong className="text-white font-bold">#{hoverInfo.traceIdx + 1}</strong></span>
            <span className="text-slate-700">|</span>
            <span>Distancia X: <strong className="text-white font-bold">{hoverInfo.distM.toFixed(2)}m</strong></span>
            <span className="text-slate-700">|</span>
            <span>Tiempo TWT: <strong className="text-amber-300 font-bold">{hoverInfo.timeNs.toFixed(1)}ns</strong></span>
            <span className="text-slate-700">|</span>
            <span>Profundidad Z: <strong className="text-purple-300 font-bold">{hoverInfo.depthM.toFixed(2)}m</strong></span>
            <span className="text-slate-700">|</span>
            <span>Amplitud: <strong className={`font-bold ${hoverInfo.amplitude >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.round(hoverInfo.amplitude)}</strong></span>
          </div>
        ) : hoverInfo && !hoverInfo.hasData ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-0.5">
            <Crosshair className="w-3 h-3 text-slate-500" />
            <span>Distancia: <strong className="text-slate-200 font-bold">{hoverInfo.distM.toFixed(2)}m</strong></span>
            <span className="italic text-slate-500">(Zona sin datos)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px] py-0.5">
            <Crosshair className="w-3 h-3 text-slate-600 flex-shrink-0" />
            <span>Pase el cursor dentro del perfil para inspeccionar traza, posición x, tiempo, profundidad y amplitud</span>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden flex items-center justify-center p-2">
        <div className="relative w-full h-full">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full block cursor-crosshair"
          />

          {/* SVG Anomaly Markers Overlay */}
          {plotMetrics && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              viewBox={`0 0 ${plotMetrics.width} ${plotMetrics.height}`}
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id="gpr-plot-area-clip">
                  <rect
                    x={plotMetrics.marginLeft}
                    y={plotMetrics.marginTop}
                    width={plotMetrics.dataPlotWidth}
                    height={plotMetrics.plotHeight}
                  />
                </clipPath>
              </defs>

              <g clipPath="url(#gpr-plot-area-clip)">
                {/* 1. BRIGHT SPOT MARKERS: Dashed cyan-blue horizontal line (1px, #00BFFF) */}
                {detectionConfig?.brightSpot.enabled &&
                  detectionResults?.brightSpots.markers.map((m) => {
                    const x1 = getCanvasXFromDistM(m.xStartM);
                    const x2 = getCanvasXFromDistM(m.xEndM);
                    const y = getCanvasYFromTimeNs(m.timeNs);
                    return (
                      <g key={m.id} className="pointer-events-auto">
                        <line
                          x1={x1}
                          y1={y}
                          x2={x2}
                          y2={y}
                          stroke="#00BFFF"
                          strokeWidth="1"
                          strokeDasharray="4,2"
                        />
                        {/* Interactive invisible hit area */}
                        <line
                          x1={x1}
                          y1={y}
                          x2={x2}
                          y2={y}
                          stroke="transparent"
                          strokeWidth="12"
                          className="cursor-pointer"
                          onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                          onMouseMove={handleMarkerMouseMove}
                          onMouseLeave={() => handleMarkerMouseLeave(m)}
                          onClick={() => setSelectedMarker(m)}
                        />
                      </g>
                    );
                  })}

                {/* 2. HYPERBOLA MARKERS: Orange-red circle (radius 8px, #FF4500) */}
                {detectionConfig?.hyperbola.enabled &&
                  detectionResults?.hyperbolas.markers.map((m) => {
                    const cx = getCanvasXFromDistM(m.xCenterM);
                    const cy = getCanvasYFromTimeNs(m.timeNs);
                    return (
                      <g key={m.id} className="pointer-events-auto">
                        <circle
                          cx={cx}
                          cy={cy}
                          r="8"
                          fill="#FF4500"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                          className="cursor-pointer hover:opacity-80 transition"
                          onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                          onMouseMove={handleMarkerMouseMove}
                          onMouseLeave={() => handleMarkerMouseLeave(m)}
                          onClick={() => setSelectedMarker(m)}
                        />
                      </g>
                    );
                  })}

                {/* 3. DELAMINATION MARKERS: Solid gold horizontal line (1px, #FFD700) */}
                {detectionConfig?.delamination.enabled &&
                  detectionResults?.delaminations.markers.map((m) => {
                    const x1 = getCanvasXFromDistM(m.xStartM);
                    const x2 = getCanvasXFromDistM(m.xEndM);
                    const y = getCanvasYFromTimeNs(m.timeNs);
                    return (
                      <g key={m.id} className="pointer-events-auto">
                        <line
                          x1={x1}
                          y1={y}
                          x2={x2}
                          y2={y}
                          stroke="#FFD700"
                          strokeWidth="1.5"
                        />
                        {/* Interactive hit area */}
                        <line
                          x1={x1}
                          y1={y}
                          x2={x2}
                          y2={y}
                          stroke="transparent"
                          strokeWidth="12"
                          className="cursor-pointer"
                          onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                          onMouseMove={handleMarkerMouseMove}
                          onMouseLeave={() => handleMarkerMouseLeave(m)}
                          onClick={() => setSelectedMarker(m)}
                        />
                      </g>
                    );
                  })}

                {/* 4. SUB-SLAB VOID MARKERS: Filled red circle (radius 12px, #FF0000) with pulsing animation */}
                {detectionConfig?.subslabVoid.enabled &&
                  detectionResults?.subslabVoids.markers.map((m) => {
                    const cx = getCanvasXFromDistM(m.xCenterM);
                    const cy = getCanvasYFromTimeNs(m.timeNs);
                    return (
                      <g
                        key={m.id}
                        className="pointer-events-auto cursor-pointer"
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                        onMouseMove={handleMarkerMouseMove}
                        onMouseLeave={() => handleMarkerMouseLeave(m)}
                        onClick={() => setSelectedMarker(m)}
                      >
                        {m.isCritical && detectionConfig.subslabVoid.pulsingCritical && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r="12"
                            fill="none"
                            stroke="#FF0000"
                            strokeWidth="2.5"
                            className="pointer-events-none"
                            style={{ pointerEvents: 'none' }}
                          >
                            <animate attributeName="r" values="12;24;12" dur="1.3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.3s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="12"
                          fill="#FF0000"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          className="hover:opacity-90 transition shadow"
                        />
                      </g>
                    );
                  })}

                {/* 5. DIFFUSE SCATTERING MARKERS: Orange semi-transparent rectangle (#FF6600, 25% opacity) */}
                {detectionConfig?.diffuseScattering.enabled &&
                  detectionResults?.diffuseScattering.markers.map((m) => {
                    const x1 = getCanvasXFromDistM(m.xStartM);
                    const x2 = getCanvasXFromDistM(m.xEndM);
                    const y1 = getCanvasYFromTimeNs(m.timeNs);
                    const y2 = getCanvasYFromTimeNs(m.timeEndNs || m.timeNs + 15);
                    return (
                      <rect
                        key={m.id}
                        x={Math.min(x1, x2)}
                        y={Math.min(y1, y2)}
                        width={Math.max(4, Math.abs(x2 - x1))}
                        height={Math.max(8, Math.abs(y2 - y1))}
                        fill="#FF6600"
                        fillOpacity="0.25"
                        stroke="none"
                        className="pointer-events-auto cursor-pointer hover:fill-opacity-40 transition"
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                        onMouseMove={handleMarkerMouseMove}
                        onMouseLeave={() => handleMarkerMouseLeave(m)}
                        onClick={() => setSelectedMarker(m)}
                      />
                    );
                  })}

                {/* 6. JOINT INFILTRATION MARKERS: Purple circle (radius 6px, stroke 2px, #9B59B6) */}
                {detectionConfig?.jointInfiltration.enabled &&
                  detectionResults?.jointInfiltrations.markers.map((m) => {
                    const cx = getCanvasXFromDistM(m.xCenterM);
                    const cy = getCanvasYFromTimeNs(m.timeNs);
                    return (
                      <circle
                        key={m.id}
                        cx={cx}
                        cy={cy}
                        r="6"
                        fill="#FFFFFF"
                        stroke="#9B59B6"
                        strokeWidth="2.5"
                        className="pointer-events-auto cursor-pointer hover:stroke-purple-300 hover:fill-purple-100 transition-colors"
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                        onMouseMove={handleMarkerMouseMove}
                        onMouseLeave={() => handleMarkerMouseLeave(m)}
                        onClick={() => setSelectedMarker(m)}
                      />
                    );
                  })}

                {/* 7. DIELECTRIC SHADOW MARKERS: Gray vertical dashed line (1px, #808080) + vertical band (opacity 20%) */}
                {detectionConfig?.dielectricShadow.enabled &&
                  detectionResults?.dielectricShadows.markers.map((m) => {
                    const x1 = getCanvasXFromDistM(m.xStartM);
                    const x2 = getCanvasXFromDistM(m.xEndM);
                    const cx = getCanvasXFromDistM(m.xCenterM);
                    return (
                      <g
                        key={m.id}
                        className="pointer-events-auto cursor-pointer"
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                        onMouseMove={handleMarkerMouseMove}
                        onMouseLeave={() => handleMarkerMouseLeave(m)}
                        onClick={() => setSelectedMarker(m)}
                      >
                        <rect
                          x={Math.min(x1, x2)}
                          y={plotMetrics.marginTop}
                          width={Math.max(4, Math.abs(x2 - x1))}
                          height={plotMetrics.plotHeight}
                          fill="#808080"
                          fillOpacity="0.20"
                          stroke="none"
                          className="hover:fill-opacity-35 transition"
                        />
                        <line
                          x1={cx}
                          y1={plotMetrics.marginTop}
                          x2={cx}
                          y2={plotMetrics.marginTop + plotMetrics.plotHeight}
                          stroke="#808080"
                          strokeWidth="1"
                          strokeDasharray="4,3"
                        />
                      </g>
                    );
                  })}

                {/* 8. THICKNESS VARIATION MARKERS: Dotted green line (#2ECC71) following t2(x), turns red (#E74C3C) on anomaly */}
                {detectionConfig?.thicknessVariation.enabled &&
                  (detectionResults?.thicknessVariations.markers.length ?? 0) > 0 &&
                  (() => {
                    const firstMarker = detectionResults?.thicknessVariations.markers[0];
                    if (!firstMarker) return null;
                    const pts = firstMarker.curvePoints || [];
                    if (pts.length < 2) return null;

                    const segments: React.ReactNode[] = [];
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p1 = pts[i];
                      const p2 = pts[i + 1];
                      const x1 = getCanvasXFromTrace(p1.traceIdx);
                      const y1 = getCanvasYFromTimeNs(p1.timeNs);
                      const x2 = getCanvasXFromTrace(p2.traceIdx);
                      const y2 = getCanvasYFromTimeNs(p2.timeNs);
                      const isAnom = p1.isAnomalous || p2.isAnomalous;

                      segments.push(
                        <line
                          key={`thick-seg-${i}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={isAnom ? '#E74C3C' : '#2ECC71'}
                          strokeWidth={isAnom ? '2' : '1.5'}
                          strokeDasharray="3,2"
                          className="pointer-events-auto cursor-pointer"
                          onMouseEnter={(e) => handleMarkerMouseEnter(e, firstMarker)}
                          onMouseMove={handleMarkerMouseMove}
                          onMouseLeave={() => handleMarkerMouseLeave(firstMarker)}
                          onClick={() => setSelectedMarker(firstMarker)}
                        />
                      );
                    }
                    return segments;
                  })()}

                {/* 9. PIPES & UTILITIES (SEG STANDARD): Double concentric ring in Yellow variations */}
                {detectionConfig?.pipeUtility.enabled &&
                  detectionResults?.pipesUtilities.markers.map((m) => {
                    const cx = getCanvasXFromDistM(m.xCenterM);
                    const cy = getCanvasYFromTimeNs(m.timeNs);
                    const pipeColor =
                      m.pipeMaterial === 'Metálica (Acero / Conductor)'
                        ? '#FFE600'
                        : m.pipeMaterial === 'Plástica (PVC / PEAD)'
                        ? '#FFB703'
                        : '#D4E157';

                    return (
                      <g
                        key={m.id}
                        className="pointer-events-auto cursor-pointer"
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, m)}
                        onMouseMove={handleMarkerMouseMove}
                        onMouseLeave={() => handleMarkerMouseLeave(m)}
                        onClick={() => setSelectedMarker(m)}
                      >
                        {/* Outer Glow / Dashed Target Ring */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="13"
                          fill="none"
                          stroke={pipeColor}
                          strokeWidth="1.8"
                          strokeDasharray="2,2"
                          className="opacity-90 pointer-events-none"
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Semi-transparent Middle Ring */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="8.5"
                          fill={pipeColor}
                          fillOpacity="0.30"
                          stroke={pipeColor}
                          strokeWidth="2"
                          className="hover:stroke-[3px] transition-all"
                        />
                        {/* Solid Inner Core */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="3"
                          fill={pipeColor}
                          stroke="#000000"
                          strokeWidth="0.8"
                        />
                        {/* Diameter Text Label */}
                        <text
                          x={cx + 15}
                          y={cy + 4}
                          fill={pipeColor}
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#000000"
                          strokeWidth="0.6"
                          paintOrder="stroke fill"
                          className="pointer-events-none select-none"
                          style={{ pointerEvents: 'none' }}
                        >
                          Ø{m.pipeDiameterMm}mm
                        </text>
                      </g>
                    );
                  })}
              </g>
            </svg>
          )}
        </div>
      </div>

      {/* Floating Tooltip on Marker Hover */}
      {hoveredMarker && (
        <div
          style={{
            left: `${Math.min(typeof window !== 'undefined' ? window.innerWidth - 260 : 800, Math.max(10, tooltipPos.x + 14))}px`,
            top: `${Math.max(10, tooltipPos.y - 50)}px`,
          }}
          className="fixed z-40 pointer-events-none bg-slate-900/95 text-white p-2.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur text-xs space-y-1 max-w-xs animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <strong className="text-sky-300 font-semibold">{hoveredMarker.title}</strong>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
              {hoveredMarker.severityLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono pt-0.5">
            <div>X: <span className="text-white">{hoveredMarker.xCenterM.toFixed(2)} m</span></div>
            <div>Prof: <span className="text-purple-300">{hoveredMarker.depthM.toFixed(2)} m</span></div>
            <div>TWT: <span className="text-amber-300">{hoveredMarker.timeNs.toFixed(1)} ns</span></div>
            <div>Severidad: <span className="text-emerald-400">{hoveredMarker.severity.toFixed(2)}</span></div>
          </div>
          {coLocatedHoveredMarkers.length > 0 && (
            <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-amber-300 flex items-center gap-1 font-sans">
              <span className="font-bold">+{coLocatedHoveredMarkers.length} en esta zona:</span>
              <span className="truncate text-slate-300 font-mono">{coLocatedHoveredMarkers.map((c: AnomalyMarker) => c.title).join(', ')}</span>
            </div>
          )}
          <p className="text-[9px] text-slate-400 italic pt-0.5">
            {coLocatedHoveredMarkers.length > 0
              ? 'Click para ver y alternar entre detecciones'
              : 'Click para ver ficha técnica detallada'}
          </p>
        </div>
      )}

      {/* Detail Card Modal on Marker Click */}
      {selectedMarker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-border max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{selectedMarker.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  {selectedMarker.severityLabel}
                </span>
              </div>
              <button
                onClick={() => setSelectedMarker(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de detecciones cuando hay 2 o más juntas / co-localizadas */}
            {coLocatedSelectedMarkers.length > 1 && (
              <div className="p-2.5 bg-slate-100 border-b border-slate-200">
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Detecciones en esta zona ({coLocatedSelectedMarkers.length}):
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium">Haga click para alternar</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {coLocatedSelectedMarkers.map((item: AnomalyMarker) => {
                    const isCurrent = item.id === selectedMarker.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedMarker(item)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                          isCurrent
                            ? 'bg-[#1E2229] text-[#EAA023] ring-1 ring-[#EAA023] shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                        }`}
                      >
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  Ubicación Geofísica
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>Posición X: <strong>{selectedMarker.xCenterM.toFixed(2)} m</strong></div>
                  <div>Profundidad z: <strong className="text-purple-700">{selectedMarker.depthM.toFixed(3)} m</strong></div>
                  <div>Tiempo TWT: <strong className="text-amber-700">{selectedMarker.timeNs.toFixed(1)} ns</strong></div>
                  <div>Extensión Lateral: <strong>{(selectedMarker.xEndM - selectedMarker.xStartM).toFixed(2)} m</strong></div>
                </div>
              </div>

              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">
                  Criterio Matemático Disparado
                </span>
                <code className="text-xs font-mono font-bold text-primary block bg-white p-2 rounded-lg border border-blue-200/80 break-words">
                  {selectedMarker.mathCriterion}
                </code>
              </div>

              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  Valores Medidos
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedMarker.measuredValues).map(([k, v]) => (
                    <div key={k} className="p-2 bg-gray-50 rounded-lg border border-border flex flex-col">
                      <span className="text-[9px] text-text-muted">{k}</span>
                      <span className="font-mono font-bold text-primary text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedMarker(null)}
                className="btn btn-primary btn-sm px-4 py-1.5 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={() => {
                setWindowMeters(0);
                setScrollMeters(0);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                windowMeters === 0
                  ? 'bg-primary text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Ver Todo ({distTotalM.toFixed(1)}m)
            </button>
            {[10, 20, 50].filter((m) => distTotalM > m).map((m) => (
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
                {m}m
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
