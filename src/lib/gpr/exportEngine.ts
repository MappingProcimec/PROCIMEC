/**
 * Export Engine for GPR Radargrams
 * Handles full-profile JPG image export (entire profile 0m to total distance),
 * single-page PDF technical report generation, modified GSF binary download,
 * and batch PowerPoint (.pptx) deck generation.
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
 * Renders an off-screen HTMLCanvasElement containing the ENTIRE profile (all traces from 0m to total distance)
 * with complete axes, ticks, distance, depth, and header metadata.
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

  // High-resolution canvas for crisp export
  const canvas = document.createElement('canvas');
  const width = Math.max(1600, Math.min(3200, numTraces * 2));
  const height = 900;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Layout Margins
  const padL = 75;
  const padR = 75;
  const padT = 65;
  const padB = 60;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // 1. Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Render Radargram Image (All Traces 0 to numTraces)
  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = numTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  const MIN_WINDOW_M = 10.0;
  const dispWindowM = Math.max(MIN_WINDOW_M, distTotalM);
  const dataFraction = Math.min(1.0, distTotalM / dispWindowM);
  const dataPlotWidth = plotW * dataFraction;

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

    // Fill remaining horizontal area with clean white blank space if data length < 10m
    if (dataPlotWidth < plotW) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(padL + dataPlotWidth, padT, plotW - dataPlotWidth, plotH);
    }
  }

  // Plot Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`PROCIMEC INGENIERIA SAS  —  ${dataset.filename}`, padL, 25);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Distancia Total = ${distTotalM.toFixed(2)} m (${numTraces} trazas)`,
    padL,
    46
  );

  // Top X-Axis Ticks: Trace Numbers (Over dataPlotWidth)
  ctx.fillStyle = '#334155';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Número de Traza', padL + dataPlotWidth / 2, padT - 22);

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

  // Bottom X-Axis Ticks: Distance in Meters (0.00m to dispWindowM, minimum 10.0m)
  ctx.fillText('Distancia Recorrida (m)', padL + plotW / 2, padT + plotH + 45);

  for (let i = 0; i <= numTricks; i++) {
    const frac = i / numTricks;
    const x = padL + frac * plotW;
    const mVal = frac * dispWindowM;

    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 5);
    ctx.stroke();

    ctx.fillText(`${mVal.toFixed(2)}`, x, padT + plotH + 20);
  }

  // Left Y-Axis Ticks: Time (ns)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
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
  ctx.fillText('Tiempo (ns)', padL - 10, padT - 10);

  // Right Y-Axis Ticks: Depth (m)
  ctx.textAlign = 'left';
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
  ctx.fillText('Prof. Est (m)', padL + plotW + 8, padT - 10);

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
 * Export full-profile JPG image (entire distance profile from 0m to total distance)
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
 * Generates and downloads a 1-Page Technical PDF Report for full distance profile.
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

  // Render Full Profile Canvas
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
  const totalDist = (numTraces * dxM).toFixed(2);
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthM = ((twNs * velocity) / 2).toFixed(2);

  pdf.text(`Número de Trazas: ${numTraces}`, panelX + 5, panelY + 15);
  pdf.text(`Muestras por Traza: ${numSamples}`, panelX + 5, panelY + 21);
  pdf.text(`Distancia Total: ${totalDist} m`, panelX + 5, panelY + 27);
  pdf.text(`Ventana Temporal: ${twNs.toFixed(1)} ns`, panelX + 5, panelY + 33);
  pdf.text(`Profundidad Est.: ${depthM} m`, panelX + 5, panelY + 39);
  pdf.text(`Frec. Antena: ${dataset.header.antennaFreqMHz || 400} MHz`, panelX + 5, panelY + 45);

  // Box 2: Applied DSP Parameters
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

  pdf.text(`• Modo Señal: ${options.mode === 'crudo' ? 'Dato Crudo Original' : 'Procesado DSP'}`, panelX + 5, panelY + 15);
  pdf.text(`• Dewow (DC Offset): ${options.dewow ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 21);
  pdf.text(`• Time-Zero: ${options.timeZero ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 27);
  pdf.text(`• Ganancia SEC: ${options.secGain ? 'Activada' : 'Desactivada'}`, panelX + 5, panelY + 33);
  pdf.text(`• Pasa-Banda: ${options.bandpass ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 39);
  pdf.text(`• Bkg Removal: ${options.backgroundRemoval ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 45);
  pdf.text(`• Dieléctrico (ε_r): ${options.dielectricPermittivity.toFixed(1)} (v=${velocity.toFixed(3)} m/ns)`, panelX + 5, panelY + 51);
  pdf.text(`• Migración Kirchhoff: ${options.enableMigration ? 'Activada' : 'Desactivada'}`, panelX + 5, panelY + 57);

  // Footer Signature & Branding
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Generado automáticamente por PROCIMEC Radargram Processing Workstation', 12, pageHeight - 8);

  pdf.save(`${dataset.filename.replace(/\.[^/.]+$/, '')}_ReporteTecnico.pdf`);
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
 * Generates a batch PowerPoint (.pptx) presentation deck for multiple GPR datasets.
 * Full distance profile on left, perfectly fitted parameter table on right without overflow.
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

    // Slide Header Bar
    slide.addShape(pptx.ShapeType?.rect || 'rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.75,
      fill: { color: '0F172A' },
    });

    slide.addText(`Radargrama GPR #${i + 1}: ${ds.filename}`, {
      x: 0.4,
      y: 0.22,
      fontSize: 16,
      bold: true,
      color: 'FFFFFF',
    });

    // Render Full Profile Canvas for Slide
    const fullCanvas = renderFullProfileCanvas(ds, matrix, opt, palette, contrast, brightness);
    const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.88);

    // Full Profile Image on Left Side
    slide.addImage({
      data: dataUrl,
      x: 0.4,
      y: 0.9,
      w: 8.5,
      h: 6.0,
    });

    // Metadata Table on Right Side (Fit inside 16x9 layout without overflow)
    const numTraces = matrix.length;
    const numSamples = ds.header.numSamples;
    const dxM = opt.traceDistanceStepM || ds.header.traceDistanceStepM || 1.0 / 112.0;
    const distM = (numTraces * dxM).toFixed(1);
    const vel = calculateVelocity(opt.dielectricPermittivity || 6.0);

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
      [{ text: 'Modo Señal' }, { text: `${opt.mode === 'crudo' ? 'Dato Crudo' : 'Procesado DSP'}` }],
      [{ text: 'Dewow' }, { text: `${opt.dewow ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Time-Zero' }, { text: `${opt.timeZero ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Ganancia SEC' }, { text: `${opt.secGain ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Bkg Removal' }, { text: `${opt.backgroundRemoval ? 'Activo' : 'Inactivo'}` }],
    ];

    slide.addTable(rows, {
      x: 9.0,
      y: 0.9,
      w: 3.9,
      colW: [2.0, 1.9],
      fontSize: 8.5,
      border: { pt: 0.5, color: 'CBD5E1' },
    });
  }

  await pptx.writeFile({ fileName: `PROCIMEC_Lote_Radargramas.pptx` });
}
