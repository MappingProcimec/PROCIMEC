/**
 * Export Engine for GPR Radargrams
 * Handles JPG image export, single-page PDF technical report generation,
 * modified GSF binary download, and batch PowerPoint (.pptx) deck generation.
 * Uses dynamic client-side imports for jsPDF and pptxgenjs to prevent Webpack build errors.
 */

import { GPRDataset, serializeGSF } from './gsfParser';
import { DSPOptions, calculateVelocity } from './dspEngine';

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
 * Captures an HTMLCanvasElement to a JPG Blob and downloads it.
 */
export async function exportRadargramJPG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${filename.replace(/\.[^/.]+$/, '')}_procesado.jpg`);
      }
      resolve();
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Generates and downloads a 1-Page Technical PDF Report for a processed radargram.
 */
export async function exportTechnicalPDFReport(
  dataset: GPRDataset,
  canvas: HTMLCanvasElement,
  options: DSPOptions
): Promise<void> {
  // Dynamically import jsPDF to ensure client-only execution
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
  pdf.rect(0, 0, pageWidth, 25, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('REPORTE TÉCNICO DE PROCESAMIENTO RADARGRAMA GPR', 12, 12);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(56, 189, 248); // Sky blue
  pdf.text(`Proyecto / Archivo: ${dataset.filename}`, 12, 19);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Fecha: ${dateStr}`, pageWidth - 70, 19);

  // Radargram Canvas Image Capture
  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const imgWidth = 180;
  const imgHeight = 110;
  pdf.addImage(imgData, 'JPEG', 12, 32, imgWidth, imgHeight);

  // Draw border around image
  pdf.setDrawColor(51, 65, 85);
  pdf.rect(12, 32, imgWidth, imgHeight);

  // Side Panel: Metadata & DSP Parameters
  const panelX = 200;
  let panelY = 32;

  // Box 1: Metadata Summary
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, 85, 48, 'F');
  pdf.rect(panelX, panelY, 85, 48, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Metadatos de Perfil', panelX + 5, panelY + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(51, 65, 85);

  const numTraces = dataset.processedMatrix.length;
  const numSamples = dataset.header.numSamples;
  const totalDist = (numTraces * dataset.header.traceDistanceStepM).toFixed(2);
  const timeWin = (numSamples * dataset.header.sampleIntervalNs).toFixed(1);
  const velocity = calculateVelocity(options.dielectricPermittivity);
  const depthM = ((parseFloat(timeWin) * velocity) / 2).toFixed(2);

  pdf.text(`Número de Trazas: ${numTraces}`, panelX + 5, panelY + 16);
  pdf.text(`Muestras por Traza: ${numSamples}`, panelX + 5, panelY + 22);
  pdf.text(`Distancia Total: ${totalDist} m`, panelX + 5, panelY + 28);
  pdf.text(`Ventana Temporal: ${timeWin} ns`, panelX + 5, panelY + 34);
  pdf.text(`Profundidad Est.: ${depthM} m`, panelX + 5, panelY + 40);
  pdf.text(`Frec. Antena: ${dataset.header.antennaFreqMHz} MHz`, panelX + 5, panelY + 46);

  // Box 2: Applied DSP Parameters
  panelY += 53;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(panelX, panelY, 85, 68, 'F');
  pdf.rect(panelX, panelY, 85, 68, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Parámetros y Filtros DSP', panelX + 5, panelY + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(51, 65, 85);

  pdf.text(`• Modo Señal: ${options.mode === 'crudo' ? 'Dato Crudo Original' : 'Procesado DSP'}`, panelX + 5, panelY + 16);
  pdf.text(`• Dewow (DC Offset): ${options.dewow ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 22);
  pdf.text(`• Time-Zero: ${options.timeZero ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 28);
  pdf.text(`• Ganancia SEC: ${options.secGain ? 'Activada' : 'Desactivada'}`, panelX + 5, panelY + 34);
  pdf.text(`• Pasa-Banda: ${options.bandpass ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 40);
  pdf.text(`• Bkg Removal: ${options.backgroundRemoval ? 'Activado' : 'Desactivado'}`, panelX + 5, panelY + 46);
  pdf.text(`• Dieléctrico (ε_r): ${options.dielectricPermittivity.toFixed(1)} (v=${velocity.toFixed(3)}m/ns)`, panelX + 5, panelY + 52);
  pdf.text(`• Migración Kirchhoff: ${options.enableMigration ? 'Activada' : 'Desactivada'}`, panelX + 5, panelY + 58);

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
 * Dynamically imports pptxgenjs client-side.
 */
export async function exportBatchPPTX(
  datasets: GPRDataset[],
  canvases: Map<string, HTMLCanvasElement>,
  optionsMap: Map<string, DSPOptions>
): Promise<void> {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const slide = pptx.addSlide();
    const opt = optionsMap.get(ds.id) || ({} as DSPOptions);
    const canvas = canvases.get(ds.id);

    // Slide Header
    slide.addShape(pptx.ShapeType?.rect || 'rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: '0F172A' },
    });

    slide.addText(`Radargrama GPR #${i + 1}: ${ds.filename}`, {
      x: 0.4,
      y: 0.25,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
    });

    // Image Capture if canvas is available
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      slide.addImage({
        data: dataUrl,
        x: 0.4,
        y: 1.0,
        w: 8.5,
        h: 5.2,
      });
    }

    // Metadata Table
    const numTraces = ds.processedMatrix.length;
    const numSamples = ds.header.numSamples;
    const distM = (numTraces * ds.header.traceDistanceStepM).toFixed(1);
    const vel = calculateVelocity(opt.dielectricPermittivity || 9.0);

    const rows = [
      [
        { text: 'Parámetro', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF' } },
        { text: 'Valor', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF' } },
      ],
      [{ text: 'Número de Trazas' }, { text: `${numTraces}` }],
      [{ text: 'Muestras / Traza' }, { text: `${numSamples}` }],
      [{ text: 'Longitud Perfil' }, { text: `${distM} m` }],
      [{ text: 'Frecuencia Antena' }, { text: `${ds.header.antennaFreqMHz} MHz` }],
      [{ text: 'Permitividad ε_r' }, { text: `${(opt.dielectricPermittivity || 6.0).toFixed(1)}` }],
      [{ text: 'Velocidad v' }, { text: `${vel.toFixed(3)} m/ns` }],
      [{ text: 'Modo' }, { text: `${opt.mode === 'crudo' ? 'Dato Crudo' : 'Procesado DSP'}` }],
      [{ text: 'Dewow' }, { text: `${opt.dewow ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Time-Zero' }, { text: `${opt.timeZero ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Ganancia SEC' }, { text: `${opt.secGain ? 'Activo' : 'Inactivo'}` }],
      [{ text: 'Background Removal' }, { text: `${opt.backgroundRemoval ? 'Activo' : 'Inactivo'}` }],
    ];

    slide.addTable(rows, {
      x: 9.1,
      y: 1.0,
      w: 3.8,
      colW: [2.0, 1.8],
      fontSize: 10,
      border: { pt: 0.5, color: 'CBD5E1' },
    });
  }

  await pptx.writeFile({ fileName: `PROCIMEC_Lote_Radargramas.pptx` });
}
