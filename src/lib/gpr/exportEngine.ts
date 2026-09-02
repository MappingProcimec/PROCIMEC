/**
 * Export Engine for GPR Radargrams
 * Handles full-profile High-Res JPG image export, single/multi-page extended PDF technical reports,
 * modified GSF binary download, and batch PowerPoint (.pptx) deck generation.
 */

import { GPRDataset, serializeGSF } from './gsfParser';
import { DSPOptions, calculateVelocity } from './dspEngine';

/**
 * Converts bipolar amplitude value [-1, 1] to RGB matching selected colormap palette
 */
function getExportPaletteColor(
  normVal: number,
  palette: string = 'grayscale',
  contrast = 1.0,
  brightness = 0
): [number, number, number] {
  const val = Math.max(-1.0, Math.min(1.0, normVal * contrast + brightness / 100));

  if (palette === 'seismic') {
    if (val < 0) {
      const t = 1.0 + val;
      return [Math.floor(255 * t), Math.floor(255 * t), 255];
    } else {
      const t = 1.0 - val;
      return [255, Math.floor(255 * t), Math.floor(255 * t)];
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
      g = 255;
      b = 255;
    }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  } else if (palette === 'sepia') {
    const v = (val + 1) / 2;
    return [Math.floor(v * 230 + 25), Math.floor(v * 180 + 15), Math.floor(v * 120 + 10)];
  } else {
    const v = (val + 1) / 2;
    const r = Math.max(0, Math.min(255, Math.floor(255 * Math.sin(v * Math.PI))));
    const g = Math.max(0, Math.min(255, Math.floor(255 * Math.sin((v - 0.25) * Math.PI))));
    const b = Math.max(0, Math.min(255, Math.floor(255 * Math.cos(v * Math.PI * 0.5))));
    return [r, g, b];
  }
}

/**
 * Renders an off-screen HTMLCanvasElement containing the ENTIRE profile (0m to total distance)
 * with ample padding and zero text collisions. Dynamically expands canvas width for long profiles.
 */
export function renderFullProfileCanvas(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette: string = 'grayscale',
  contrast = 1.0,
  brightness = 0
): HTMLCanvasElement {
  const numTraces = processedMatrix.length;
  const numSamples = numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || (1.0 / 112.0);
  const distTotalM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthMaxM = (velocity * twNs) / 2.0;

  // Scale canvas width dynamically proportional to profile length (min 1800px)
  const MIN_WINDOW_M = 10.0;
  const dispWindowM = Math.max(MIN_WINDOW_M, distTotalM);

  const canvas = document.createElement('canvas');
  const width = Math.max(1800, Math.min(4800, Math.round((dispWindowM / 10.0) * 1800)));
  const height = 950;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Generous Layout Margins to completely avoid text overlaps
  const padL = 90;
  const padR = 90;
  const padT = 105; // 105px top padding for clean, un-crowded headers
  const padB = 65;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // 1. Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Render Radargram Image (All Traces 0 to numTraces)
  const dataFraction = Math.min(1.0, distTotalM / dispWindowM);
  const dataPlotWidth = Math.max(1, Math.floor(plotW * dataFraction));

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = numTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  if (imgCtx && numTraces > 0 && numSamples > 0) {
    const imgData = imgCtx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    let maxAmp = 0;
    for (let t = 0; t < numTraces; t += 4) {
      for (let s = 0; s < numSamples; s += 4) {
        const a = Math.abs(processedMatrix[t][s]);
        if (a > maxAmp) maxAmp = a;
      }
    }
    if (maxAmp === 0) maxAmp = 1;

    for (let t = 0; t < numTraces; t++) {
      const trace = processedMatrix[t];
      for (let s = 0; s < numSamples; s++) {
        const normVal = trace[s] / maxAmp;
        const [r, g, b] = getExportPaletteColor(normVal, palette, contrast, brightness);

        const pxIdx = (s * numTraces + t) * 4;
        data[pxIdx] = r;
        data[pxIdx + 1] = g;
        data[pxIdx + 2] = b;
        data[pxIdx + 3] = 255;
      }
    }

    imgCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(imgCanvas, padL, padT, dataPlotWidth, plotH);

    // Fill remaining area with clean white space if profile < 10m
    if (dataPlotWidth < plotW) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(padL + dataPlotWidth, padT, plotW - dataPlotWidth, plotH);
    }
  }

  // Plot Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // 3. Header Texts (Well-spaced without any overlaps)
  // Line 1: Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`PROCIMEC INGENIERIA SAS  —  ${dataset.filename}`, padL, 26);

  // Line 2: Subtitle & Metadata
  ctx.font = '11.5px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Distancia Total = ${distTotalM.toFixed(2)} m (${numTraces} trazas)`,
    padL,
    48
  );

  // Top X-Axis Header: Número de Traza
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Número de Traza', padL + dataPlotWidth / 2, 70);

  // Top X-Axis Ticks: Trace Numbers
  ctx.font = '10px sans-serif';
  const numTricks = 8;
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * dataPlotWidth;
    const tVal = Math.round(frac * (numTraces - 1)) + 1;

    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT - 5);
    ctx.stroke();

    ctx.fillText(`${tVal}`, x, padT - 8);
  }

  // Bottom X-Axis Ticks: Distance in Meters
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Distancia Recorrida (m)', padL + plotW / 2, padT + plotH + 48);

  ctx.font = '10px sans-serif';
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * plotW;
    const mVal = frac * dispWindowM;

    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 5);
    ctx.stroke();

    ctx.fillText(`${mVal.toFixed(2)}`, x, padT + plotH + 22);
  }

  // Left Y-Axis Ticks: Time (ns)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '10px sans-serif';
  const numTTicks = 6;

  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const tVal = frac * twNs;

    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL - 5, y);
    ctx.stroke();

    ctx.fillText(`${tVal.toFixed(1)}`, padL - 8, y);
  }

  // Left Y-Axis Title (Placed cleanly above Y-axis at padL - 10, y = padT - 18)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Tiempo (ns)', padL - 10, padT - 18);

  // Right Y-Axis Ticks: Depth (m)
  ctx.textAlign = 'left';
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#b91c1c'; // Dark red

  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const dVal = frac * depthMaxM;

    ctx.beginPath();
    ctx.moveTo(padL + plotW, y);
    ctx.lineTo(padL + plotW + 5, y);
    ctx.stroke();

    ctx.fillText(`${dVal.toFixed(2)}`, padL + plotW + 8, y);
  }

  // Right Y-Axis Title
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Prof. Est (m)', padL + plotW + 8, padT - 18);

  return canvas;
}

/**
 * Renders an off-screen Canvas segment for a 10-meter section of a profile (High-Res 1:1 Scale)
 */
export function renderSegmentProfileCanvas(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  startM: number,
  segmentLenM: number = 10.0,
  palette: string = 'grayscale',
  contrast = 1.0,
  brightness = 0
): HTMLCanvasElement {
  const numTraces = processedMatrix.length;
  const numSamples = numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || (1.0 / 112.0);
  const distTotalM = numTraces * dxM;
  const endM = Math.min(distTotalM, startM + segmentLenM);

  const startTrace = Math.max(0, Math.floor(startM / dxM));
  const endTrace = Math.min(numTraces, Math.ceil(endM / dxM));
  const visibleTraces = Math.max(1, endTrace - startTrace);

  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthMaxM = (velocity * twNs) / 2.0;

  const canvas = document.createElement('canvas');
  const width = 1800;
  const height = 850;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const padL = 90;
  const padR = 90;
  const padT = 95;
  const padB = 65;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const dataFraction = Math.min(1.0, (endM - startM) / segmentLenM);
  const dataPlotWidth = Math.max(1, Math.floor(plotW * dataFraction));

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = visibleTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  if (imgCtx && visibleTraces > 0 && numSamples > 0) {
    const imgData = imgCtx.createImageData(visibleTraces, numSamples);
    const data = imgData.data;

    let maxAmp = 0;
    for (let t = startTrace; t < endTrace; t += 4) {
      for (let s = 0; s < numSamples; s += 4) {
        const a = Math.abs(processedMatrix[t][s]);
        if (a > maxAmp) maxAmp = a;
      }
    }
    if (maxAmp === 0) maxAmp = 1;

    let ptr = 0;
    for (let s = 0; s < numSamples; s++) {
      for (let t = 0; t < visibleTraces; t++) {
        const traceIdx = startTrace + t;
        const normVal = (processedMatrix[traceIdx]?.[s] || 0) / maxAmp;
        const [r, g, b] = getExportPaletteColor(normVal, palette, contrast, brightness);

        data[ptr] = r;
        data[ptr + 1] = g;
        data[ptr + 2] = b;
        data[ptr + 3] = 255;
        ptr += 4;
      }
    }

    imgCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(imgCanvas, padL, padT, dataPlotWidth, plotH);

    if (dataPlotWidth < plotW) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(padL + dataPlotWidth, padT, plotW - dataPlotWidth, plotH);
    }
  }

  // Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `SECCIÓN DETALLADA DE PERFIL: ${startM.toFixed(2)}m – ${endM.toFixed(2)}m  (${dataset.filename})`,
    padL,
    25
  );

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Trazas ${startTrace + 1} a ${endTrace}`,
    padL,
    45
  );

  // Top Ticks (Trace numbers)
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Número de Traza', padL + dataPlotWidth / 2, 65);

  ctx.font = '10px sans-serif';
  const numTricks = 8;
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * dataPlotWidth;
    const tVal = Math.round(startTrace + 1 + frac * Math.max(0, visibleTraces - 1));

    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT - 5);
    ctx.stroke();

    ctx.fillText(`${tVal}`, x, padT - 8);
  }

  // Bottom Ticks (Distance in meters)
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Distancia Recorrida (m)', padL + plotW / 2, padT + plotH + 48);

  ctx.font = '10px sans-serif';
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * plotW;
    const mVal = startM + frac * segmentLenM;

    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 5);
    ctx.stroke();

    ctx.fillText(`${mVal.toFixed(2)}`, x, padT + plotH + 22);
  }

  // Left Y-Axis Ticks
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '10px sans-serif';
  const numTTicks = 6;
  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const tVal = frac * twNs;

    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL - 5, y);
    ctx.stroke();

    ctx.fillText(`${tVal.toFixed(1)}`, padL - 8, y);
  }
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Tiempo (ns)', padL - 10, padT - 18);

  // Right Y-Axis Ticks
  ctx.textAlign = 'left';
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#b91c1c';
  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const dVal = frac * depthMaxM;

    ctx.beginPath();
    ctx.moveTo(padL + plotW, y);
    ctx.lineTo(padL + plotW + 5, y);
    ctx.stroke();

    ctx.fillText(`${dVal.toFixed(2)}`, padL + plotW + 8, y);
  }
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Prof. Est (m)', padL + plotW + 8, padT - 18);

  return canvas;
}

/**
 * Downloads a Blob object as a file in browser
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export High-Resolution Extended JPG image (entire profile with uncompressed horizontal width)
 */
export async function exportRadargramJPG(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0
): Promise<void> {
  const fullCanvas = renderFullProfileCanvas(dataset, processedMatrix, options, palette, contrast, brightness);
  return new Promise((resolve) => {
    fullCanvas.toBlob(
      (blob) => {
        if (blob) {
          downloadBlob(blob, `${dataset.filename.replace(/\.[^/.]+$/, '')}_PerfilCompleto.jpg`);
        }
        resolve();
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Generates an Extended PDF Technical Report:
 * Page 1: Executive Technical Report Overview.
 * Subsequent Pages (for profiles > 10m): High-Resolution 10-meter Segment Panels.
 */
export async function exportTechnicalPDFReport(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Background Header Bar
  pdf.setFillColor(15, 23, 42); // Dark Slate #0f172a
  pdf.rect(0, 0, pageWidth, 24, 'F');

  // Header Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('REPORTE TÉCNICO DE PROCESAMIENTO RADARGRAMA GPR', 12, 11);

  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(56, 189, 248); // Sky blue
  pdf.text(`Proyecto / Archivo: ${dataset.filename}`, 12, 18);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Fecha: ${dateStr}`, pageWidth - 75, 18);

  // Render Full Overview Canvas
  const fullCanvas = renderFullProfileCanvas(dataset, processedMatrix, options, palette, contrast, brightness);
  const imgData = fullCanvas.toDataURL('image/jpeg', 0.92);

  const imgWidth = 185;
  const imgHeight = 125;
  pdf.addImage(imgData, 'JPEG', 12, 30, imgWidth, imgHeight);

  // Border around radargram image
  pdf.setDrawColor(51, 65, 85);
  pdf.rect(12, 30, imgWidth, imgHeight);

  // Side Panel: Metadata & DSP Parameters (x: 202, w: 83mm)
  const panelX = 202;
  const panelW = 83;
  let panelY = 30;

  // Box 1: Metadata Summary
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, panelW, 50, 'F');
  pdf.rect(panelX, panelY, panelW, 50, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Metadatos de Perfil', panelX + 5, panelY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);

  const numTraces = processedMatrix.length;
  const numSamples = dataset.header.numSamples;
  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || 1.0 / 112.0;
  const totalDistM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthM = ((twNs * velocity) / 2).toFixed(2);

  pdf.text(`Número de Trazas: ${numTraces}`, panelX + 5, panelY + 15);
  pdf.text(`Muestras por Traza: ${numSamples}`, panelX + 5, panelY + 21);
  pdf.text(`Distancia Total: ${totalDistM.toFixed(2)} m`, panelX + 5, panelY + 27);
  pdf.text(`Ventana Temporal: ${twNs.toFixed(1)} ns`, panelX + 5, panelY + 33);
  pdf.text(`Profundidad Est.: ${depthM} m`, panelX + 5, panelY + 39);
  pdf.text(`Frec. Antena: ${dataset.header.antennaFreqMHz || 400} MHz`, panelX + 5, panelY + 45);

  // Box 2: Applied DSP Parameters (Truthful reporting based on Signal Mode)
  panelY += 54;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, panelW, 71, 'F');
  pdf.rect(panelX, panelY, panelW, 71, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Parámetros y Filtros DSP', panelX + 5, panelY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);

  const isCrudoMode = options.mode === 'crudo';

  pdf.text(
    `• Modo Señal: ${isCrudoMode ? 'Dato Crudo Original (Sin Filtros)' : 'Procesado DSP'}`,
    panelX + 5,
    panelY + 15
  );
  pdf.text(
    `• Dewow (DC Offset): ${!isCrudoMode && options.dewow ? `Activado (${options.dewowWindowNs || 2.0}ns)` : 'Desactivado'}`,
    panelX + 5,
    panelY + 21
  );
  pdf.text(
    `• Time-Zero: ${!isCrudoMode && options.timeZero ? `Activado (${options.timeZeroMode === 'auto' ? 'Auto Pulso+2%' : 'Manual'})` : 'Desactivado'}`,
    panelX + 5,
    panelY + 27
  );
  pdf.text(
    `• Ganancia SEC: ${!isCrudoMode && options.secGain ? `Activada (${options.gainMode || 'auto'}, max ${options.maxGainDb || 40}dB)` : 'Desactivada'}`,
    panelX + 5,
    panelY + 33
  );
  pdf.text(
    `• Pasa-Banda IIR: ${!isCrudoMode && options.bandpass ? `Activado (${options.hpCutoffMHz}-${options.lpCutoffMHz}MHz)` : 'Desactivado'}`,
    panelX + 5,
    panelY + 39
  );
  pdf.text(
    `• Bkg Removal: ${!isCrudoMode && options.backgroundRemoval ? `Activado (${options.bkgRemovalPercent || 10}%)` : 'Desactivado'}`,
    panelX + 5,
    panelY + 45
  );
  pdf.text(
    `• Dieléctrico (ε_r): ${options.dielectricPermittivity.toFixed(1)} (v=${velocity.toFixed(3)} m/ns)`,
    panelX + 5,
    panelY + 51
  );
  pdf.text(
    `• Migración Kirchhoff: ${!isCrudoMode && options.enableMigration ? 'Activada' : 'Desactivada'}`,
    panelX + 5,
    panelY + 57
  );

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Generado automáticamente por PROCIMEC Radargram Processing Workstation — Página 1 (Resumen)', 12, pageHeight - 8);

  // IF PROFILE > 10 METERS: ADD EXTENDED HIGH-RES 10m SEGMENT PAGES
  const SEGMENT_LEN_M = 10.0;
  if (totalDistM > SEGMENT_LEN_M) {
    const numSegments = Math.ceil(totalDistM / SEGMENT_LEN_M);

    for (let segIdx = 0; segIdx < numSegments; segIdx++) {
      const segStartM = segIdx * SEGMENT_LEN_M;
      const segEndM = Math.min(totalDistM, segStartM + SEGMENT_LEN_M);

      pdf.addPage('a4', 'landscape');

      // Header Bar
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 20, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(`PERFIL EXTENDIDO SECCIÓN #${segIdx + 1}: ${segStartM.toFixed(2)}m – ${segEndM.toFixed(2)}m`, 12, 10);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(56, 189, 248);
      pdf.text(`Archivo: ${dataset.filename} (Distancia Total: ${totalDistM.toFixed(2)}m)`, 12, 16);

      pdf.setTextColor(148, 163, 184);
      pdf.text(`Página ${segIdx + 2} de ${numSegments + 1}`, pageWidth - 45, 16);

      // Render High-Res Segment Canvas
      const segCanvas = renderSegmentProfileCanvas(
        dataset,
        processedMatrix,
        options,
        segStartM,
        SEGMENT_LEN_M,
        palette,
        contrast,
        brightness
      );
      const segImgData = segCanvas.toDataURL('image/jpeg', 0.95);

      const segW = 273;
      const segH = 160;
      pdf.addImage(segImgData, 'JPEG', 12, 25, segW, segH);

      pdf.setDrawColor(51, 65, 85);
      pdf.rect(12, 25, segW, segH);

      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `PROCIMEC Radargram Workstation — Sección ${segStartM.toFixed(2)}m a ${segEndM.toFixed(2)}m (Alta Resolución 1:1)`,
        12,
        pageHeight - 6
      );
    }
  }

  pdf.save(`${dataset.filename.replace(/\.[^/.]+$/, '')}_ReporteTecnicoExtendido.pdf`);
}

/**
 * Re-encodes and downloads the modified GSF binary file.
 */
export function exportModifiedGSF(dataset: GPRDataset): void {
  const binaryBuffer = serializeGSF(dataset);
  const blob = new Blob([binaryBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, `${dataset.filename.replace(/\.[^/.]+$/, '')}_procesado.gsf`);
}

/**
 * Specialized high-resolution canvas renderer for PowerPoint 16:9 slides
 * Produces crisp, congruent 1:1.91 aspect ratio (2400x1250 px) matching 8.8" x 4.6"
 */
export function renderPPTXProfileCanvas(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette: string = 'grayscale',
  contrast = 1.0,
  brightness = 0
): HTMLCanvasElement {
  const numTraces = processedMatrix.length;
  const numSamples = numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || (1.0 / 112.0);
  const distTotalM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthMaxM = (velocity * twNs) / 2.0;

  const MIN_WINDOW_M = 10.0;
  const dispWindowM = Math.max(MIN_WINDOW_M, distTotalM);

  const width = 2400;
  const height = 1250;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const padL = 110;
  const padR = 100;
  const padT = 115;
  const padB = 85;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const dataFraction = Math.min(1.0, distTotalM / dispWindowM);
  const dataPlotWidth = Math.max(1, Math.floor(plotW * dataFraction));

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = numTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  if (imgCtx && numTraces > 0 && numSamples > 0) {
    const imgData = imgCtx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    let maxAmp = 0;
    for (let t = 0; t < numTraces; t += 4) {
      for (let s = 0; s < numSamples; s += 4) {
        const a = Math.abs(processedMatrix[t][s]);
        if (a > maxAmp) maxAmp = a;
      }
    }
    if (maxAmp === 0) maxAmp = 1;

    for (let t = 0; t < numTraces; t++) {
      const trace = processedMatrix[t];
      for (let s = 0; s < numSamples; s++) {
        const normVal = trace[s] / maxAmp;
        const [r, g, b] = getExportPaletteColor(normVal, palette, contrast, brightness);

        const pxIdx = (s * numTraces + t) * 4;
        data[pxIdx] = r;
        data[pxIdx + 1] = g;
        data[pxIdx + 2] = b;
        data[pxIdx + 3] = 255;
      }
    }

    imgCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(imgCanvas, padL, padT, dataPlotWidth, plotH);

    if (dataPlotWidth < plotW) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(padL + dataPlotWidth, padT, plotW - dataPlotWidth, plotH);
    }
  }

  // Plot Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`PROCIMEC INGENIERIA SAS  —  ${dataset.filename}`, padL, 34);

  // Subtitle
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Distancia Total = ${distTotalM.toFixed(2)} m (${numTraces} trazas)`,
    padL,
    62
  );

  // Top X-Axis Header
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Número de Traza', padL + dataPlotWidth / 2, 88);

  // Top X-Axis Ticks
  ctx.font = '13px sans-serif';
  const numTricks = 8;
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * dataPlotWidth;
    const tVal = Math.round(frac * (numTraces - 1)) + 1;

    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT - 6);
    ctx.stroke();

    ctx.fillText(`${tVal}`, x, padT - 10);
  }

  // Bottom X-Axis Ticks: Distance in Meters
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Distancia Recorrida (m)', padL + plotW / 2, padT + plotH + 60);

  ctx.font = '13px sans-serif';
  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * plotW;
    const mVal = frac * dispWindowM;

    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 6);
    ctx.stroke();

    ctx.fillText(`${mVal.toFixed(2)}`, x, padT + plotH + 26);
  }

  // Left Y-Axis Ticks: Time (ns)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '13px sans-serif';
  const numTTicks = 6;

  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const tVal = frac * twNs;

    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL - 6, y);
    ctx.stroke();

    ctx.fillText(`${tVal.toFixed(1)}`, padL - 10, y);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Tiempo (ns)', padL - 12, padT - 18);

  // Right Y-Axis Ticks: Depth (m)
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b91c1c';

  for (let i = 0; i <= numTTicks; i++) {
    const frac = i / numTTicks;
    const y = padT + frac * plotH;
    const dVal = frac * depthMaxM;

    ctx.beginPath();
    ctx.moveTo(padL + plotW, y);
    ctx.lineTo(padL + plotW + 6, y);
    ctx.stroke();

    ctx.fillText(`${dVal.toFixed(2)}`, padL + plotW + 10, y);
  }

  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Prof. Est (m)', padL + plotW + 10, padT - 18);

  return canvas;
}

/**
 * Generates a batch PowerPoint (.pptx) presentation deck for multiple GPR datasets.
 * Congruent 1:1.91 (max 1:2) radargram aspect ratio and strictly contained right-hand metadata table.
 */
export async function exportBatchPPTX(
  datasets: GPRDataset[],
  processedMatricesMap: Map<string, Float32Array[]>,
  optionsMap: Map<string, DSPOptions>,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0
): Promise<void> {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const matrix = processedMatricesMap.get(ds.id) || ds.rawMatrix;
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);

    const slide = pptx.addSlide();

    // Slide Header Bar (Dark Navy #0F172A)
    slide.addShape(pptx.ShapeType?.rect || 'rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: '0F172A' },
    });

    // Header Title: Radargrama GPR: [filename]
    slide.addText(`Radargrama GPR: ${ds.filename}`, {
      x: 0.6,
      y: 0.24,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
    });

    // Render High-Resolution 1:1.91 Canvas specifically optimized for 16:9 slides
    const fullCanvas = renderPPTXProfileCanvas(ds, matrix, opt, palette, contrast, brightness);
    const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.95);

    // Profile Image on Left Side (Aspect ratio 8.8 : 4.6 = 1.91 : 1, max 1:2, fully contained)
    slide.addImage({
      data: dataUrl,
      x: 0.6,
      y: 1.15,
      w: 8.8,
      h: 4.6,
    });

    // Metadata Table on Right Side (x=9.6, w=3.2, y=1.15, rowH=0.34, fits 100% inside slide)
    const numTraces = matrix.length;
    const numSamples = ds.header.numSamples;
    const dxM = opt.traceDistanceStepM || ds.header.traceDistanceStepM || 1.0 / 112.0;
    const distM = (numTraces * dxM).toFixed(1);
    const vel = calculateVelocity(opt.dielectricPermittivity || 6.0);
    const isCrudo = opt.mode === 'crudo';

    const rows = [
      [
        { text: 'Parámetro', options: { bold: true, fill: { color: '0F172A' }, color: 'FFFFFF' } },
        { text: 'Valor', options: { bold: true, fill: { color: '0F172A' }, color: 'FFFFFF' } },
      ],
      [{ text: 'Número de Trazas' }, { text: `${numTraces}` }],
      [{ text: 'Muestras / Traza' }, { text: `${numSamples}` }],
      [{ text: 'Longitud Perfil' }, { text: `${distM} m` }],
      [{ text: 'Frecuencia Antena' }, { text: `${ds.header.antennaFreqMHz || 400} MHz` }],
      [{ text: 'Permitividad ε_r' }, { text: `${(opt.dielectricPermittivity || 6.0).toFixed(1)}` }],
      [{ text: 'Velocidad v' }, { text: `${vel.toFixed(3)} m/ns` }],
      [{ text: 'Modo Señal' }, { text: `${isCrudo ? 'Dato Crudo' : 'Procesado DSP'}` }],
      [{ text: 'Dewow' }, { text: `${!isCrudo && opt.dewow ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Time-Zero' }, { text: `${!isCrudo && opt.timeZero ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Ganancia SEC' }, { text: `${!isCrudo && opt.secGain ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Bkg Removal' }, { text: `${!isCrudo && opt.backgroundRemoval ? 'Activo' : 'Inactivo'}` }],
    ];

    slide.addTable(rows, {
      x: 9.6,
      y: 1.15,
      w: 3.2,
      colW: [1.7, 1.5],
      fontSize: 8.5,
      rowH: 0.34,
      margin: [2, 3, 2, 3],
      border: { pt: 0.5, color: 'CBD5E1' },
    });
  }

  await pptx.writeFile({ fileName: `PROCIMEC_Lote_Radargramas.pptx` });
}
