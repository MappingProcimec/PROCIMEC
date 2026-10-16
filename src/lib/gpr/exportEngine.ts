/**
 * Export Engine for GPR Radargrams
 * Handles full-profile High-Res JPG image export, single/multi-page extended PDF technical reports,
 * modified GSF binary download, and batch PowerPoint (.pptx) deck generation.
 */

import { GPRDataset, serializeGSF } from './gsfParser';
import { DSPOptions, calculateVelocity } from './dspEngine';
import { CORPORATE_LOGO_BASE64 } from './logoBase64';
import { DetectionConfig, DetectionResults } from './detectionTypes';

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
 * Draws active detection overlay markers (anomalies) directly on the exported canvas
 */
export function drawDetectionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  options: DSPOptions,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults,
  padL = 90,
  padT = 105,
  plotW = 1000,
  plotH = 500,
  dataPlotWidth = 1000,
  dispWindowM = 10,
  twNs = 90,
  dxM = 1.0 / 112.0
): void {
  if (!detectionConfig || !detectionResults) return;

  const getCanvasX = (distM: number) => {
    const fraction = dispWindowM > 0 ? distM / dispWindowM : 0;
    return padL + fraction * plotW;
  };

  const getCanvasY = (timeNs: number) => {
    const fraction = twNs > 0 ? timeNs / twNs : 0;
    return padT + fraction * plotH;
  };

  ctx.save();
  // Clip to data plot area so markers don't bleed into axes
  ctx.beginPath();
  ctx.rect(padL, padT, dataPlotWidth, plotH);
  ctx.clip();

  // 1. Bright Spots (dashed cyan line)
  if (detectionConfig.brightSpot?.enabled && detectionResults.brightSpots?.markers) {
    for (const m of detectionResults.brightSpots.markers) {
      const x1 = getCanvasX(m.xStartM);
      const x2 = getCanvasX(m.xEndM);
      const y = getCanvasY(m.timeNs);
      ctx.save();
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. Hyperbolas (orange-red circle)
  if (detectionConfig.hyperbola?.enabled && detectionResults.hyperbolas?.markers) {
    for (const m of detectionResults.hyperbolas.markers) {
      const cx = getCanvasX(m.xCenterM);
      const cy = getCanvasY(m.timeNs);
      ctx.save();
      ctx.fillStyle = '#FF4500';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Delaminations (solid gold line)
  if (detectionConfig.delamination?.enabled && detectionResults.delaminations?.markers) {
    for (const m of detectionResults.delaminations.markers) {
      const x1 = getCanvasX(m.xStartM);
      const x2 = getCanvasX(m.xEndM);
      const y = getCanvasY(m.timeNs);
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Subslab Voids (solid red circle + critical outer ring)
  if (detectionConfig.subslabVoid?.enabled && detectionResults.subslabVoids?.markers) {
    for (const m of detectionResults.subslabVoids.markers) {
      const cx = getCanvasX(m.xCenterM);
      const cy = getCanvasY(m.timeNs);
      ctx.save();
      if (m.isCritical) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#FF0000';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 5. Diffuse Scattering (semi-transparent orange rect)
  if (detectionConfig.diffuseScattering?.enabled && detectionResults.diffuseScattering?.markers) {
    for (const m of detectionResults.diffuseScattering.markers) {
      const x1 = getCanvasX(m.xStartM);
      const x2 = getCanvasX(m.xEndM);
      const y1 = getCanvasY(m.timeNs);
      const y2 = getCanvasY(m.timeEndNs || m.timeNs + 15);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 102, 0, 0.28)';
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.max(6, Math.abs(x2 - x1)), Math.max(10, Math.abs(y2 - y1)));
      ctx.restore();
    }
  }

  // 6. Joint Infiltrations (purple circle with white fill)
  if (detectionConfig.jointInfiltration?.enabled && detectionResults.jointInfiltrations?.markers) {
    for (const m of detectionResults.jointInfiltrations.markers) {
      const cx = getCanvasX(m.xCenterM);
      const cy = getCanvasY(m.timeNs);
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#9B59B6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 7. Dielectric Shadows (gray vertical band + center dashed line)
  if (detectionConfig.dielectricShadow?.enabled && detectionResults.dielectricShadows?.markers) {
    for (const m of detectionResults.dielectricShadows.markers) {
      const x1 = getCanvasX(m.xStartM);
      const x2 = getCanvasX(m.xEndM);
      const cx = getCanvasX(m.xCenterM);
      ctx.save();
      ctx.fillStyle = 'rgba(128, 128, 128, 0.20)';
      ctx.fillRect(Math.min(x1, x2), padT, Math.max(6, Math.abs(x2 - x1)), plotH);
      ctx.strokeStyle = '#808080';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 8. Thickness Variations (connecting line: green/red)
  if (detectionConfig.thicknessVariation?.enabled && detectionResults.thicknessVariations?.markers) {
    const firstMarker = detectionResults.thicknessVariations.markers[0];
    if (firstMarker && firstMarker.curvePoints && firstMarker.curvePoints.length > 1) {
      const pts = firstMarker.curvePoints;
      ctx.save();
      ctx.lineWidth = 2;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const x1 = getCanvasX(p1.traceIdx * dxM);
        const y1 = getCanvasY(p1.timeNs);
        const x2 = getCanvasX(p2.traceIdx * dxM);
        const y2 = getCanvasY(p2.timeNs);
        const isAnom = p1.isAnomalous || p2.isAnomalous;
        ctx.strokeStyle = isAnom ? '#E74C3C' : '#2ECC71';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 9. Pipes / Utilities (SEG Standard concentric rings with diameter label)
  if (detectionConfig.pipeUtility?.enabled && detectionResults.pipesUtilities?.markers) {
    for (const m of detectionResults.pipesUtilities.markers) {
      const cx = getCanvasX(m.xCenterM);
      const cy = getCanvasY(m.timeNs);
      const pipeColor =
        m.pipeMaterial === 'Metálica (Acero / Conductor)'
          ? '#FFE600'
          : m.pipeMaterial === 'Plástica (PVC / PEAD)'
          ? '#FFB703'
          : '#D4E157';

      ctx.save();
      ctx.strokeStyle = pipeColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = pipeColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = pipeColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pipeColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.font = 'bold 11px monospace';
      ctx.strokeText(`Ø${m.pipeDiameterMm}mm`, cx + 14, cy + 4);
      ctx.fillText(`Ø${m.pipeDiameterMm}mm`, cx + 14, cy + 4);

      ctx.restore();
    }
  }

  ctx.restore();
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
  brightness = 0,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults
): HTMLCanvasElement {
  const numTraces = processedMatrix.length;
  const numSamples = numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || (1.0 / 112.0);
  const distTotalM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthMaxM = (velocity * twNs) / 2.0;
  const antennaFreq = options.antennaFreqMHz || dataset.header.antennaFreqMHz || 400;
  const lambdaM = (velocity * 1e9) / (antennaFreq * 1e6);
  const lambdaQuarterCm = ((lambdaM / 4.0) * 100).toFixed(1);

  // Scale canvas width dynamically proportional to profile length (min 1800px)
  const dispWindowM = distTotalM > 0 ? distTotalM : 10.0;

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
  const dataPlotWidth = plotW;

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = numTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  if (imgCtx && numTraces > 0 && numSamples > 0) {
    const imgData = imgCtx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    let vmax = 32767.0;
    if (options.mode === 'procesado') {
      const allAbs: number[] = [];
      const step = Math.max(1, Math.floor(numTraces / 100));
      for (let t = 0; t < numTraces; t += step) {
        const tr = processedMatrix[t];
        if (!tr) continue;
        for (let s = 0; s < numSamples; s += 4) {
          allAbs.push(Math.abs(tr[s]));
        }
      }
      allAbs.sort((a, b) => a - b);
      const pIdx = Math.floor(allAbs.length * 0.985);
      vmax = allAbs[pIdx] || (allAbs.length > 0 ? allAbs[allAbs.length - 1] : 1.0) || 1.0;
      if (vmax <= 1e-6) vmax = 1.0;
    } else {
      vmax = 32767.0;
    }

    for (let t = 0; t < numTraces; t++) {
      const trace = processedMatrix[t];
      for (let s = 0; s < numSamples; s++) {
        const amp = trace ? trace[s] : 0;
        const normVal = Math.max(-1.0, Math.min(1.0, amp / vmax));
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
  }

  // Draw active anomaly detection markers directly onto the canvas plot
  if (detectionConfig && detectionResults) {
    drawDetectionsOnCanvas(
      ctx,
      options,
      detectionConfig,
      detectionResults,
      padL,
      padT,
      plotW,
      plotH,
      dataPlotWidth,
      dispWindowM,
      twNs,
      dxM
    );
  }

  // Plot Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // 3. Header Texts & Corporate Logo
  // Corporate Logo on Top-Right
  try {
    const logoImg = new Image();
    logoImg.src = CORPORATE_LOGO_BASE64;
    const logoH = 46;
    const logoW = Math.round(logoH * (256 / 73)); // ~161px
    const logoX = width - padR - logoW;
    const logoY = 12;
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  } catch (e) {
    console.error('Error rendering logo on full profile canvas', e);
  }

  // Line 1: Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`PROCIMEC INGENIERIA SAS  —  ${dataset.filename}`, padL, 26);

  // Line 2: Subtitle & Metadata
  ctx.font = '11.5px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `Antena: ${antennaFreq} MHz (λ/4: ${lambdaQuarterCm} cm) | εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Perfil: ${distTotalM.toFixed(2)} m (${numTraces} trazas)`,
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
  brightness = 0,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults
): Promise<void> {
  const fullCanvas = renderFullProfileCanvas(
    dataset,
    processedMatrix,
    options,
    palette,
    contrast,
    brightness,
    detectionConfig,
    detectionResults
  );
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
 * Renders a single technical profile page into a jsPDF document (Standard A4 Landscape)
 * with Dark Navy & Amber header, corporate logo, 3-box side panel on the left (Metadatos, Parámetros DSP, Hallazgos),
 * and the complete full-profile radargram canvas with active anomaly markers on the right.
 */
export function renderPDFBannerPage(
  pdf: any,
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults,
  isFirstPage = false
): void {
  const numTraces = processedMatrix.length;
  const numSamples = dataset.header.numSamples;
  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || 1.0 / 112.0;
  const totalDistM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthM = ((twNs * velocity) / 2).toFixed(2);

  // Standard A4 Landscape dimensions (297 x 210 mm)
  const pageWidthMm = 297;
  const pageHeightMm = 210;
  const marginMm = 12;

  if (isFirstPage) {
    // Current page is already the active first page
  } else {
    pdf.addPage('a4', 'landscape');
  }

  // Background Header Bar (Full A4 Width)
  pdf.setFillColor(15, 23, 42); // Dark Slate #0f172a
  pdf.rect(0, 0, pageWidthMm, 22, 'F');

  // Amber Accent Line below Header
  pdf.setFillColor(234, 160, 35); // #EAA023
  pdf.rect(0, 22, pageWidthMm, 1.2, 'F');

  // Header Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('REPORTE TÉCNICO DE PROCESAMIENTO RADARGRAMA GPR', marginMm, 9.5);

  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(56, 189, 248); // Sky blue
  pdf.text(`Proyecto / Archivo: ${dataset.filename}  (Perfil Continuo Completo)`, marginMm, 16.5);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Fecha: ${dateStr}`, pageWidthMm - 130, 16.5);

  // Corporate Logo on Top-Right of PDF Header Bar
  try {
    const logoPdfH = 13;
    const logoPdfW = logoPdfH * (256 / 73); // ~45.5mm
    const logoPdfX = pageWidthMm - marginMm - logoPdfW;
    const logoPdfY = 4.5;
    pdf.addImage(CORPORATE_LOGO_BASE64, 'PNG', logoPdfX, logoPdfY, logoPdfW, logoPdfH);
  } catch (e) {
    console.error('Error adding logo to PDF report', e);
  }

  // Left Side Panel: 3 Structured Blocks (Metadatos, Parámetros DSP, Hallazgos Geofísicos)
  const panelX = marginMm;
  const panelWidthMm = 82;
  const gapMm = 6;

  const antennaFreq = options.antennaFreqMHz || dataset.header.antennaFreqMHz || 400;
  const lambdaM = (velocity * 1e9) / (antennaFreq * 1e6);
  const lambdaQuarterCm = ((lambdaM / 4.0) * 100).toFixed(1);
  const tracesPerMeter = dxM > 0 ? Math.round(1.0 / dxM) : 112;

  // Box 1: Metadata Summary
  let panelY = 26;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, panelWidthMm, 48, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(panelX, panelY, panelWidthMm, 48, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Metadatos de Perfil', panelX + 4, panelY + 6.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.setTextColor(51, 65, 85);

  pdf.text(`Número de Trazas: ${numTraces}`, panelX + 4, panelY + 13);
  pdf.text(`Muestras por Traza: ${numSamples}`, panelX + 4, panelY + 18.5);
  pdf.text(`Distancia Total: ${totalDistM.toFixed(2)} m (${tracesPerMeter} tr/m)`, panelX + 4, panelY + 24);
  pdf.text(`Ventana Temporal: ${twNs.toFixed(1)} ns`, panelX + 4, panelY + 29.5);
  pdf.text(`Profundidad Est.: ${depthM} m`, panelX + 4, panelY + 35);
  pdf.text(`Frecuencia Antena: ${antennaFreq} MHz (Akula9000C)`, panelX + 4, panelY + 40.5);
  pdf.text(`Resolución Vert. (λ/4): ${lambdaQuarterCm} cm | v: ${velocity.toFixed(3)} m/ns`, panelX + 4, panelY + 46);

  // Box 2: Applied DSP Parameters
  panelY = 77;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, panelWidthMm, 53, 'F');
  pdf.rect(panelX, panelY, panelWidthMm, 53, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Parámetros y Filtros DSP', panelX + 4, panelY + 6.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.setTextColor(51, 65, 85);

  const isCrudoMode = options.mode === 'crudo';

  pdf.text(`• Modo Señal: ${isCrudoMode ? 'Dato Crudo Original' : 'Procesado DSP'}`, panelX + 4, panelY + 13);
  pdf.text(`• Dewow (DC Offset): ${!isCrudoMode && options.dewow ? `Activado (${options.dewowWindowNs || 2.0}ns)` : 'Desactivado'}`, panelX + 4, panelY + 18.5);
  pdf.text(`• Time-Zero: ${!isCrudoMode && options.timeZero ? `Activado (${options.timeZeroMode === 'auto' ? 'Auto' : 'Manual'})` : 'Desactivado'}`, panelX + 4, panelY + 24);
  pdf.text(`• Ganancia SEC: ${!isCrudoMode && options.secGain ? `Activada (${options.gainMode || 'auto'}, max ${options.maxGainDb || 40}dB)` : 'Desactivada'}`, panelX + 4, panelY + 29.5);
  pdf.text(`• Pasa-Banda IIR: ${!isCrudoMode && options.bandpass ? `Activado (${options.hpCutoffMHz}-${options.lpCutoffMHz}MHz)` : 'Desactivado'}`, panelX + 4, panelY + 35);
  pdf.text(`• Bkg Removal: ${!isCrudoMode && options.backgroundRemoval ? `Activado (${options.bkgRemovalPercent || 10}%)` : 'Desactivado'}`, panelX + 4, panelY + 40.5);
  pdf.text(`• Migración / ε_r: ${!isCrudoMode && options.enableMigration ? 'Kirchhoff' : 'Sin migración'} | ε_r = ${options.dielectricPermittivity.toFixed(1)}`, panelX + 4, panelY + 46);

  // Box 3: Hallazgos Geofísicos (Detecciones)
  panelY = 133;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, panelWidthMm, 50, 'F');
  pdf.rect(panelX, panelY, panelWidthMm, 50, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Hallazgos Geofísicos (Detecciones)', panelX + 4, panelY + 6.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.setTextColor(51, 65, 85);

  const findings: string[] = [];
  if (detectionConfig?.subslabVoid?.enabled && (detectionResults?.subslabVoids?.markers?.length || 0) > 0) {
    findings.push(`• Oquedades / Vacíos: ${detectionResults!.subslabVoids.markers.length}`);
  }
  if (detectionConfig?.jointInfiltration?.enabled && (detectionResults?.jointInfiltrations?.markers?.length || 0) > 0) {
    findings.push(`• Juntas infiltradas: ${detectionResults!.jointInfiltrations.markers.length}`);
  }
  if (detectionConfig?.pipeUtility?.enabled && (detectionResults?.pipesUtilities?.markers?.length || 0) > 0) {
    findings.push(`• Tuberías de redes: ${detectionResults!.pipesUtilities.markers.length}`);
  }
  if (detectionConfig?.hyperbola?.enabled && (detectionResults?.hyperbolas?.markers?.length || 0) > 0) {
    findings.push(`• Hipérbolas de difracción: ${detectionResults!.hyperbolas.markers.length}`);
  }
  if (detectionConfig?.brightSpot?.enabled && (detectionResults?.brightSpots?.markers?.length || 0) > 0) {
    findings.push(`• Bright Spots: ${detectionResults!.brightSpots.markers.length}`);
  }
  if (detectionConfig?.delamination?.enabled && (detectionResults?.delaminations?.markers?.length || 0) > 0) {
    findings.push(`• Delaminaciones: ${detectionResults!.delaminations.markers.length}`);
  }
  if (detectionConfig?.diffuseScattering?.enabled && (detectionResults?.diffuseScattering?.markers?.length || 0) > 0) {
    findings.push(`• Zonas de dispersión: ${detectionResults!.diffuseScattering.markers.length}`);
  }
  if (detectionConfig?.dielectricShadow?.enabled && (detectionResults?.dielectricShadows?.markers?.length || 0) > 0) {
    findings.push(`• Sombras dieléctricas: ${detectionResults!.dielectricShadows.markers.length}`);
  }
  if (detectionConfig?.thicknessVariation?.enabled && (detectionResults?.thicknessVariations?.markers?.length || 0) > 0) {
    findings.push(`• Variación de espesor detectada`);
  }

  if (findings.length === 0) {
    pdf.setTextColor(100, 116, 139);
    pdf.text('Sin anomalías geofísicas detectadas.', panelX + 4, panelY + 14);
    pdf.text('Reflectores estructurales conformes.', panelX + 4, panelY + 20);
  } else {
    let fy = panelY + 14;
    for (let f = 0; f < Math.min(5, findings.length); f++) {
      pdf.text(findings[f], panelX + 4, fy);
      fy += 5.5;
    }
  }

  // Right Side: Render Full Profile Radargram Canvas WITH active detections overlay
  const imgX = panelX + panelWidthMm + gapMm;
  const imgY = 26;
  const imgWidthMm = pageWidthMm - imgX - marginMm; // 297 - 100 - 12 = 185 mm
  const imgHeightMm = 157;

  const fullCanvas = renderPPTXProfileCanvas(
    dataset,
    processedMatrix,
    options,
    palette,
    contrast,
    brightness,
    detectionConfig,
    detectionResults
  );
  const imgData = fullCanvas.toDataURL('image/jpeg', 0.95);

  pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidthMm, imgHeightMm);

  // Border around radargram image
  pdf.setDrawColor(51, 65, 85);
  pdf.rect(imgX, imgY, imgWidthMm, imgHeightMm);

  // Footer
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    'PROCIMEC INGENIERÍA S.A.S. — Reporte Técnico Geofísico de Radargramas GPR — Perfil Continuo Completo (100%)',
    marginMm,
    pageHeightMm - 5
  );
}

/**
 * Generates an Extended Technical PDF Report (Standard A4 Landscape):
 * Entire profile rendered continuously on a single standard A4 page without chopping or compression.
 */
export async function exportTechnicalPDFReport(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  renderPDFBannerPage(
    pdf,
    dataset,
    processedMatrix,
    options,
    palette,
    contrast,
    brightness,
    detectionConfig,
    detectionResults,
    true // isFirstPage = true
  );

  pdf.save(`${dataset.filename.replace(/\.[^/.]+$/, '')}_ReporteTecnico.pdf`);
}

/**
 * Generates an Extended Multi-Page Batch PDF Technical Report:
 * Page 1: Formal Cover Sheet (Primera Hoja de Presentación) with summary table and technical standards.
 * Subsequent Pages: Continuous Banner Technical Report for each profile with 3-box side panel and detections.
 */
export async function exportBatchPDFReport(
  datasets: GPRDataset[],
  processedMatricesMap: Map<string, Float32Array[]>,
  optionsMap: Map<string, DSPOptions>,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  detectionConfigMap?: Record<string, DetectionConfig>,
  detectionResultsMap?: Record<string, DetectionResults>
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  // Page 1: Hoja de Presentación (Cover Sheet) en A4 Landscape
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4', // 297 x 210 mm
  });

  // Dark slate cover background
  pdf.setFillColor(15, 23, 42); // #0F172A
  pdf.rect(0, 0, 297, 210, 'F');

  // Amber accent border
  pdf.setDrawColor(234, 160, 35); // #EAA023
  pdf.setLineWidth(1.5);
  pdf.rect(10, 10, 277, 190, 'S');

  // Corporate Logo Top-Right
  try {
    const logoH = 16;
    const logoW = logoH * (256 / 73); // ~56mm
    pdf.addImage(CORPORATE_LOGO_BASE64, 'PNG', 297 - 20 - logoW, 18, logoW, logoH);
  } catch (e) {
    console.error('Error adding logo to cover', e);
  }

  // Title & Subtitle
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('INFORME TÉCNICO GEOFÍSICO DE RADARGRAMAS GPR', 20, 28);

  pdf.setFontSize(12);
  pdf.setTextColor(234, 160, 35); // #EAA023
  pdf.text('PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD', 20, 37);

  // Amber divider bar
  pdf.setFillColor(234, 160, 35);
  pdf.rect(20, 42, 257, 1.2, 'F');

  // Metadata Card
  pdf.setFillColor(30, 34, 41); // #1E2229
  pdf.rect(20, 48, 257, 26, 'F');
  pdf.setDrawColor(51, 65, 85);
  pdf.rect(20, 48, 257, 26, 'S');

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  pdf.setFontSize(8.5);
  pdf.setTextColor(203, 213, 225);
  pdf.text(`Fecha de Emisión: ${dateStr}`, 25, 56);
  pdf.text(`Cantidad de Perfiles Procesados: ${datasets.length}`, 25, 62);
  pdf.text('Entidad Emisora: PROCIMEC INGENIERÍA S.A.S. (Colombia)', 25, 68);

  pdf.text('Normativa ASCE 38-02: Calidad Geofísica y Localización de Redes Subterráneas', 140, 56);
  pdf.text('Normativa ASTM D6432: Guía Estándar para Sondeos con Georradar de Penetración', 140, 62);
  pdf.text('Plataforma: PCM CLOUD Geophysical Radargram Workstation v2.0', 140, 68);

  // Table of included profiles
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Resumen de Perfiles Incluidos en este Informe:', 20, 83);

  // Table Header
  const tableX = 20;
  let tableY = 88;
  pdf.setFillColor(42, 48, 60);
  pdf.rect(tableX, tableY, 257, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(234, 160, 35);
  pdf.text('#', tableX + 3, tableY + 5.5);
  pdf.text('Nombre de Archivo / Perfil', tableX + 12, tableY + 5.5);
  pdf.text('Antena (MHz)', tableX + 100, tableY + 5.5);
  pdf.text('Longitud (m)', tableX + 130, tableY + 5.5);
  pdf.text('Trazas', tableX + 160, tableY + 5.5);
  pdf.text('Hallazgos Geofísicos', tableX + 185, tableY + 5.5);

  tableY += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(226, 232, 240);

  const maxPdfRows = Math.min(18, datasets.length);
  const isCompactPdfTable = datasets.length > 10;
  const pdfRowH = isCompactPdfTable ? 5.2 : 7.0;
  const pdfFontSize = isCompactPdfTable ? 7.0 : 8.0;
  pdf.setFontSize(pdfFontSize);

  for (let i = 0; i < maxPdfRows; i++) {
    const ds = datasets[i];
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);
    const matrix = processedMatricesMap.get(ds.id) || ds.rawMatrix;
    const numTr = matrix.length;
    const dx = opt.traceDistanceStepM || ds.header.traceDistanceStepM || 1.0 / 112.0;
    const dist = (numTr * dx).toFixed(2);
    const ant = opt.antennaFreqMHz || ds.header.antennaFreqMHz || 400;

    const detRes = detectionResultsMap?.[ds.id];
    let totalAnomCount = 0;
    if (detRes) {
      totalAnomCount =
        (detRes.brightSpots?.markers?.length || 0) +
        (detRes.hyperbolas?.markers?.length || 0) +
        (detRes.delaminations?.markers?.length || 0) +
        (detRes.subslabVoids?.markers?.length || 0) +
        (detRes.diffuseScattering?.markers?.length || 0) +
        (detRes.jointInfiltrations?.markers?.length || 0) +
        (detRes.dielectricShadows?.markers?.length || 0) +
        (detRes.thicknessVariations?.markers?.length || 0) +
        (detRes.pipesUtilities?.markers?.length || 0);
    }

    const rowBg = i % 2 === 0 ? [24, 28, 36] : [18, 21, 27];
    pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    pdf.rect(tableX, tableY, 257, pdfRowH, 'F');

    const textBaselineY = tableY + (pdfRowH * 0.72);
    pdf.text(`${i + 1}`, tableX + 3, textBaselineY);
    pdf.text(ds.filename.length > 40 ? ds.filename.substring(0, 37) + '...' : ds.filename, tableX + 12, textBaselineY);
    pdf.text(`${ant} MHz`, tableX + 100, textBaselineY);
    pdf.text(`${dist} m`, tableX + 130, textBaselineY);
    pdf.text(`${numTr}`, tableX + 160, textBaselineY);
    pdf.text(
      totalAnomCount > 0 ? `${totalAnomCount} anomalía(s) identificada(s)` : 'Sin anomalías registradas',
      tableX + 185,
      textBaselineY
    );

    tableY += pdfRowH;
  }

  // Cover footer
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    'PROCIMEC INGENIERÍA S.A.S. — Todos los derechos reservados. Informe oficial de ingeniería geofísica.',
    20,
    195
  );

  // Subsequent Pages: Each profile in continuous banner format
  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const matrix = processedMatricesMap.get(ds.id) || ds.rawMatrix;
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);
    const detConfig = detectionConfigMap?.[ds.id];
    const detResults = detectionResultsMap?.[ds.id];

    renderPDFBannerPage(
      pdf,
      ds,
      matrix,
      opt,
      palette,
      contrast,
      brightness,
      detConfig,
      detResults,
      false // false = adds a new page
    );
  }

  pdf.save('PROCIMEC_Reporte_Lote_Radargramas.pdf');
}

/**
 * Re-encodes and downloads the modified GSF binary file.
 */
export function exportModifiedGSF(dataset: GPRDataset, options?: DSPOptions): void {
  const dsToExport = { ...dataset };
  if (options) {
    dsToExport.header = {
      ...dsToExport.header,
      antennaFreqMHz: options.antennaFreqMHz || dsToExport.header.antennaFreqMHz || 400,
      dielectricPermittivity: options.dielectricPermittivity || dsToExport.header.dielectricPermittivity || 6.0,
      timeWindowNs: options.ventanaNs || dsToExport.header.timeWindowNs || 90.0,
    };
  }
  const binaryBuffer = serializeGSF(dsToExport);
  const blob = new Blob([binaryBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, `${dataset.filename.replace(/\.[^/.]+$/, '')}_procesado.gsf`);
}

/**
 * Specialized high-resolution canvas renderer for PowerPoint 16:9 slides
 * Produces crisp, congruent 1:1.45 aspect ratio (2000x1380 px) matching 6.4" x 4.4"
 */
export function renderPPTXProfileCanvas(
  dataset: GPRDataset,
  processedMatrix: Float32Array[],
  options: DSPOptions,
  palette: string = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  detectionConfig?: DetectionConfig,
  detectionResults?: DetectionResults
): HTMLCanvasElement {
  const numTraces = processedMatrix.length;
  const numSamples = numTraces > 0 ? processedMatrix[0].length : 0;

  const dxM = options.traceDistanceStepM || dataset.header.traceDistanceStepM || (1.0 / 112.0);
  const distTotalM = numTraces * dxM;
  const twNs = options.ventanaNs || dataset.header.timeWindowNs || 90.0;
  const velocity = calculateVelocity(options.dielectricPermittivity || 6.0);
  const depthMaxM = (velocity * twNs) / 2.0;

  // Dynamic profile distance window: display 100% of the profile distance from 0m to distTotalM
  const dispWindowM = distTotalM > 0 ? distTotalM : 10.0;

  const width = 2000;
  const height = 1380;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const padL = 105;
  const padR = 95;
  const padT = 115;
  const padB = 85;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Full profile fills 100% of the data plot width with zero truncation
  const dataPlotWidth = plotW;

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = numTraces;
  imgCanvas.height = numSamples;
  const imgCtx = imgCanvas.getContext('2d');

  if (imgCtx && numTraces > 0 && numSamples > 0) {
    const imgData = imgCtx.createImageData(numTraces, numSamples);
    const data = imgData.data;

    // Symmetric 98.5-percentile clipping matching CanvasViewer exactly
    const allAbs: number[] = [];
    const step = Math.max(1, Math.floor(numTraces / 100));
    for (let t = 0; t < numTraces; t += step) {
      const tr = processedMatrix[t];
      if (!tr) continue;
      for (let s = 0; s < numSamples; s += 4) {
        allAbs.push(Math.abs(tr[s]));
      }
    }
    allAbs.sort((a, b) => a - b);
    const pIdx = Math.floor(allAbs.length * 0.985);
    const vmax = allAbs[pIdx] || (allAbs.length > 0 ? allAbs[allAbs.length - 1] : 1.0) || 1.0;

    for (let t = 0; t < numTraces; t++) {
      const trace = processedMatrix[t];
      for (let s = 0; s < numSamples; s++) {
        const amp = trace ? trace[s] : 0;
        const normVal = Math.max(-1.0, Math.min(1.0, amp / vmax));
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
  }

  // Draw active anomaly detection markers directly onto the canvas plot
  if (detectionConfig && detectionResults) {
    drawDetectionsOnCanvas(
      ctx,
      options,
      detectionConfig,
      detectionResults,
      padL,
      padT,
      plotW,
      plotH,
      dataPlotWidth,
      dispWindowM,
      twNs,
      dxM
    );
  }

  // Plot Border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // Corporate Logo on Top-Right
  try {
    const logoImg = new Image();
    logoImg.src = CORPORATE_LOGO_BASE64;
    const logoH = 50;
    const logoW = Math.round(logoH * (256 / 73)); // ~175px
    const logoX = width - padR - logoW;
    const logoY = 15;
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  } catch (e) {
    console.error('Error rendering logo on PPTX canvas', e);
  }

  const antennaFreq = options.antennaFreqMHz || dataset.header.antennaFreqMHz || 400;
  const lambdaM = (velocity * 1e9) / (antennaFreq * 1e6);
  const lambdaQuarterCm = ((lambdaM / 4.0) * 100).toFixed(1);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`PROCIMEC INGENIERIA SAS  —  ${dataset.filename}`, padL, 34);

  // Subtitle
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `Antena: ${antennaFreq} MHz (λ/4: ${lambdaQuarterCm} cm) | εr = ${options.dielectricPermittivity.toFixed(1)} | v = ${velocity.toFixed(3)} m/ns | Ventana = ${twNs.toFixed(1)} ns | Prof. Máx = ${depthMaxM.toFixed(2)} m | Perfil: ${distTotalM.toFixed(2)} m (${numTraces} trazas)`,
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
 * Fitted 100% inside 10.0" x 5.625" slide bounds so table and radargram NEVER overflow into gray area.
 */
export async function exportBatchPPTX(
  datasets: GPRDataset[],
  processedMatricesMap: Map<string, Float32Array[]>,
  optionsMap: Map<string, DSPOptions>,
  palette = 'grayscale',
  contrast = 1.0,
  brightness = 0,
  detectionConfigMap?: Record<string, DetectionConfig>,
  detectionResultsMap?: Record<string, DetectionResults>
): Promise<void> {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // SLIDE 1: PRIMERA HOJA DE PRESENTACIÓN (Cover Slide)
  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: '0F172A' }; // Dark navy

  // Corporate Logo Top-Right
  try {
    coverSlide.addImage({
      data: CORPORATE_LOGO_BASE64,
      x: 7.8,
      y: 0.35,
      w: 1.8,
      h: 0.52,
    });
  } catch (e) {
    console.error('Error adding logo to PPTX cover', e);
  }

  // Title
  coverSlide.addText('INFORME TÉCNICO GEOFÍSICO DE RADARGRAMAS GPR', {
    x: 0.6,
    y: 0.4,
    w: 7.0,
    h: 0.55,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
  });

  // Subtitle
  coverSlide.addText('PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD', {
    x: 0.6,
    y: 0.95,
    w: 7.0,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: 'EAA023',
    fontFace: 'Arial',
  });

  // Amber Accent Line
  coverSlide.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0.6,
    y: 1.35,
    w: 8.8,
    h: 0.04,
    fill: { color: 'EAA023' },
  });

  // Metadata Card (Table)
  coverSlide.addTable(
    [
      [
        { text: `Fecha de Emisión: ${dateStr}`, options: { color: 'E2E8F0', bold: true } },
        { text: `Normativa ASCE 38-02 (Localización de Redes)`, options: { color: 'E2E8F0' } },
      ],
      [
        { text: `Total Perfiles en Lote: ${datasets.length}`, options: { color: 'E2E8F0', bold: true } },
        { text: `Normativa ASTM D6432 (GPR Superficial)`, options: { color: 'E2E8F0' } },
      ],
      [
        { text: `Entidad: PROCIMEC INGENIERÍA S.A.S.`, options: { color: 'CBD5E1' } },
        { text: `Plataforma: PCM CLOUD Workstation v2.0`, options: { color: 'CBD5E1' } },
      ],
    ],
    {
      x: 0.6,
      y: 1.5,
      w: 8.8,
      colW: [4.4, 4.4],
      fontSize: 8.5,
      rowH: 0.28,
      margin: [1.5, 3, 1.5, 3],
      fill: { color: '1E2229' },
      border: { pt: 0.5, color: '334155' },
    }
  );

  // Summary Table of Included Profiles
  const profileRows: any[][] = [
    [
      { text: '#', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
      { text: 'Perfil / Archivo', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
      { text: 'Antena', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
      { text: 'Longitud', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
      { text: 'Trazas', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
      { text: 'Hallazgos Detectados', options: { bold: true, fill: { color: '2A303C' }, color: 'EAA023' } },
    ],
  ];

  const maxPptxRows = Math.min(18, datasets.length);
  const isCompactTable = datasets.length > 8;
  const tableFontSize = isCompactTable ? 6.8 : 8;
  const tableRowH = isCompactTable ? 0.165 : 0.28;
  const tableY = isCompactTable ? 2.45 : 2.65;

  for (let i = 0; i < maxPptxRows; i++) {
    const ds = datasets[i];
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);
    const matrix = processedMatricesMap.get(ds.id) || ds.rawMatrix;
    const numTr = matrix.length;
    const dx = opt.traceDistanceStepM || ds.header.traceDistanceStepM || 1.0 / 112.0;
    const dist = (numTr * dx).toFixed(2);
    const ant = opt.antennaFreqMHz || ds.header.antennaFreqMHz || 400;

    const detRes = detectionResultsMap?.[ds.id];
    let anomCount = 0;
    if (detRes) {
      anomCount =
        (detRes.brightSpots?.markers?.length || 0) +
        (detRes.hyperbolas?.markers?.length || 0) +
        (detRes.delaminations?.markers?.length || 0) +
        (detRes.subslabVoids?.markers?.length || 0) +
        (detRes.diffuseScattering?.markers?.length || 0) +
        (detRes.jointInfiltrations?.markers?.length || 0) +
        (detRes.dielectricShadows?.markers?.length || 0) +
        (detRes.thicknessVariations?.markers?.length || 0) +
        (detRes.pipesUtilities?.markers?.length || 0);
    }

    profileRows.push([
      { text: `${i + 1}` },
      { text: ds.filename.length > 32 ? ds.filename.substring(0, 30) + '...' : ds.filename },
      { text: `${ant} MHz` },
      { text: `${dist} m` },
      { text: `${numTr}` },
      { text: anomCount > 0 ? `${anomCount} anomalía(s)` : 'Sin anomalías' },
    ]);
  }

  coverSlide.addTable(profileRows, {
    x: 0.6,
    y: tableY,
    w: 8.8,
    colW: [0.5, 3.1, 1.1, 1.1, 1.0, 2.0],
    fontSize: tableFontSize,
    rowH: tableRowH,
    margin: [1.2, 2.0, 1.2, 2.0],
    fill: { color: '181C24' },
    color: 'E2E8F0',
    border: { pt: 0.5, color: '334155' },
  });

  // SUBSEQUENT SLIDES: ONE PER PROFILE
  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const matrix = processedMatricesMap.get(ds.id) || ds.rawMatrix;
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);
    const detConfig = detectionConfigMap?.[ds.id];
    const detResults = detectionResultsMap?.[ds.id];

    const slide = pptx.addSlide();

    // 1. Normalized Slide Header Bar (Dark Navy #0F172A, matching PDF)
    slide.addShape(pptx.ShapeType?.rect || 'rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.65,
      fill: { color: '0F172A' },
    });

    // Amber accent strip below header bar
    slide.addShape(pptx.ShapeType?.rect || 'rect', {
      x: 0,
      y: 0.65,
      w: '100%',
      h: 0.025,
      fill: { color: 'EAA023' },
    });

    // Header Title (PDF-matching)
    slide.addText('REPORTE TÉCNICO DE PROCESAMIENTO RADARGRAMA GPR', {
      x: 0.35,
      y: 0.10,
      fontSize: 12,
      bold: true,
      color: 'FFFFFF',
    });

    // Subtitle & Date
    slide.addText(`Proyecto / Archivo: ${ds.filename}  (Perfil Continuo Completo)`, {
      x: 0.35,
      y: 0.36,
      fontSize: 8.5,
      color: '38BDF8', // Sky blue
    });

    slide.addText(`Fecha: ${dateStr}`, {
      x: 6.0,
      y: 0.36,
      fontSize: 8,
      color: '94A3B8',
    });

    // Corporate Logo on Top-Right of Header Bar
    try {
      slide.addImage({
        data: CORPORATE_LOGO_BASE64,
        x: 8.35,
        y: 0.10,
        w: 1.35,
        h: 0.40,
      });
    } catch (e) {
      console.error('Error adding logo to PPTX slide', e);
    }

    // Left Side: 3 Blocks (Metadatos, Parámetros DSP, Hallazgos Geofísicos)
    const numTraces = matrix.length;
    const numSamples = ds.header.numSamples;
    const dxM = opt.traceDistanceStepM || ds.header.traceDistanceStepM || 1.0 / 112.0;
    const distM = (numTraces * dxM).toFixed(2);
    const vel = calculateVelocity(opt.dielectricPermittivity || 6.0);
    const isCrudo = opt.mode === 'crudo';
    const antennaFreq = opt.antennaFreqMHz || ds.header.antennaFreqMHz || 400;
    const lambdaM = (vel * 1e9) / (antennaFreq * 1e6);
    const lambdaQuarterCm = ((lambdaM / 4.0) * 100).toFixed(1);
    const twNs = opt.ventanaNs || ds.header.timeWindowNs || 90.0;
    const depthM = ((twNs * vel) / 2).toFixed(2);

    // Block 1: Metadatos de Perfil
    const metaRows: any[] = [
      [
        { text: 'Metadatos de Perfil', options: { bold: true, fill: { color: '0F172A' }, color: 'FFFFFF', colspan: 2 } },
      ],
      [{ text: 'Trazas / Muestras' }, { text: `${numTraces} tr · ${numSamples} m` }],
      [{ text: 'Longitud / Prof.' }, { text: `${distM} m · ${depthM} m` }],
      [{ text: 'Antena / λ/4' }, { text: `${antennaFreq} MHz · ${lambdaQuarterCm} cm` }],
      [{ text: 'Velocidad / εr' }, { text: `${vel.toFixed(3)} m/ns · ${(opt.dielectricPermittivity || 6.0).toFixed(1)}` }],
    ];

    slide.addTable(metaRows, {
      x: 0.35,
      y: 0.78,
      w: 3.1,
      colW: [1.45, 1.65],
      fontSize: 7.2,
      rowH: 0.27,
      margin: [1.0, 2.0, 1.0, 2.0],
      border: { pt: 0.5, color: 'CBD5E1' },
      fill: { color: 'F8FAFC' },
    });

    // Block 2: Parámetros y Filtros DSP
    const dspRows: any[] = [
      [
        { text: 'Parámetros y Filtros DSP', options: { bold: true, fill: { color: '0F172A' }, color: 'FFFFFF', colspan: 2 } },
      ],
      [{ text: 'Modo Señal' }, { text: isCrudo ? 'Dato Crudo' : 'Procesado DSP' }],
      [{ text: 'Dewow / TimeZero' }, { text: `${!isCrudo && opt.dewow ? 'Activo' : 'Off'} / ${!isCrudo && opt.timeZero ? 'Activo' : 'Off'}` }],
      [{ text: 'SEC / Pasa-Banda' }, { text: `${!isCrudo && opt.secGain ? 'Activo' : 'Off'} / ${!isCrudo && opt.bandpass ? 'Activo' : 'Off'}` }],
      [{ text: 'Bkg / Migración' }, { text: `${!isCrudo && opt.backgroundRemoval ? 'Activo' : 'Off'} / ${!isCrudo && opt.enableMigration ? 'Kirchhoff' : 'Off'}` }],
    ];

    slide.addTable(dspRows, {
      x: 0.35,
      y: 2.25,
      w: 3.1,
      colW: [1.45, 1.65],
      fontSize: 7.2,
      rowH: 0.27,
      margin: [1.0, 2.0, 1.0, 2.0],
      border: { pt: 0.5, color: 'CBD5E1' },
      fill: { color: 'F8FAFC' },
    });

    // Block 3: Hallazgos Geofísicos
    const findingsList: string[] = [];
    if (detConfig?.subslabVoid?.enabled && (detResults?.subslabVoids?.markers?.length || 0) > 0) {
      findingsList.push(`Oquedades bajo losa: ${detResults!.subslabVoids.markers.length}`);
    }
    if (detConfig?.jointInfiltration?.enabled && (detResults?.jointInfiltrations?.markers?.length || 0) > 0) {
      findingsList.push(`Juntas infiltradas: ${detResults!.jointInfiltrations.markers.length}`);
    }
    if (detConfig?.pipeUtility?.enabled && (detResults?.pipesUtilities?.markers?.length || 0) > 0) {
      findingsList.push(`Tuberías de servicios: ${detResults!.pipesUtilities.markers.length}`);
    }
    if (detConfig?.hyperbola?.enabled && (detResults?.hyperbolas?.markers?.length || 0) > 0) {
      findingsList.push(`Hipérbolas puntuales: ${detResults!.hyperbolas.markers.length}`);
    }
    if (detConfig?.brightSpot?.enabled && (detResults?.brightSpots?.markers?.length || 0) > 0) {
      findingsList.push(`Bright Spots: ${detResults!.brightSpots.markers.length}`);
    }
    if (detConfig?.delamination?.enabled && (detResults?.delaminations?.markers?.length || 0) > 0) {
      findingsList.push(`Delaminaciones: ${detResults!.delaminations.markers.length}`);
    }
    if (detConfig?.diffuseScattering?.enabled && (detResults?.diffuseScattering?.markers?.length || 0) > 0) {
      findingsList.push(`Zonas dispersas: ${detResults!.diffuseScattering.markers.length}`);
    }
    if (detConfig?.dielectricShadow?.enabled && (detResults?.dielectricShadows?.markers?.length || 0) > 0) {
      findingsList.push(`Sombras dieléctricas: ${detResults!.dielectricShadows.markers.length}`);
    }

    const findingRows: any[] = [
      [
        { text: 'Hallazgos Geofísicos', options: { bold: true, fill: { color: '0F172A' }, color: 'EAA023', colspan: 2 } },
      ],
    ];

    if (findingsList.length === 0) {
      findingRows.push([{ text: 'Sin anomalías activas detectadas en este perfil', options: { colspan: 2, color: '64748B' } }]);
    } else {
      for (let f = 0; f < Math.min(4, findingsList.length); f++) {
        const parts = findingsList[f].split(':');
        findingRows.push([{ text: parts[0] }, { text: parts[1] || '' }]);
      }
    }

    slide.addTable(findingRows, {
      x: 0.35,
      y: 3.75,
      w: 3.1,
      colW: [1.8, 1.3],
      fontSize: 7.2,
      rowH: 0.27,
      margin: [1.0, 2.0, 1.0, 2.0],
      border: { pt: 0.5, color: 'CBD5E1' },
      fill: { color: 'F8FAFC' },
    });

    // Right Side: Radargram Image WITH detection overlays!
    const fullCanvas = renderPPTXProfileCanvas(ds, matrix, opt, palette, contrast, brightness, detConfig, detResults);
    const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.95);

    slide.addImage({
      data: dataUrl,
      x: 3.65,
      y: 0.78,
      w: 6.0,
      h: 4.5,
    });
  }

  await pptx.writeFile({ fileName: `PROCIMEC_Lote_Radargramas.pptx` });
}
