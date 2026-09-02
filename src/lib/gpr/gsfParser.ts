/**
 * GSF Binary Parser for Geoscanners Akula9000C & GPRSoft PRO Compatible Systems
 * Faithfully implements the 937-byte hardware header parsing, metadata extraction,
 * and FFT-based cross-correlation matching scipy.signal.correlate(..., method='fft').
 */

import { correlateFFT } from './fftCorrelation';

export const C_LUZ_M_NS = 0.30;             // Speed of light in vacuum (m/ns)
export const CABECERA_DEFAULT = 512;         // Standard default header size (512 bytes)
export const DIELECTRICO_DEF = 6.0;          // Default relative permittivity (RDP)
export const VENTANA_TIEMPO_NS_DEF = 90.0;   // Default time window in ns
export const TRAZAS_POR_METRO_DEF = 112.0;   // Standard Geoscanners odometer (112 traces/m)
export const DX_DEF = 1.0 / 112.0;           // Horizontal step = 0.00892857 m/trace

export interface GSFHeader {
  title: string;
  version: number;
  numTraces: number;
  numSamples: number;             // Samples per trace
  sampleIntervalNs: number;       // dt in nanoseconds
  timeWindowNs: number;           // Two-Way Time (ns)
  antennaFreqMHz: number;
  dielectricPermittivity: number; // RDP (epsilon_r)
  traceDistanceStepM: number;     // dx in meters (1/112 m = 0.00892857m)
  tracesPerMeter: number;         // Odometry calibration (default 112 or 111 tr/m)
  zeroOffsetNs: number;
  byteOffsetData: number;         // 512 bytes default
  traceHeaderBytes: number;       // 0 bytes (contiguous trace data)
  bytesPerSample: number;         // 2 bytes (Int16)
  dataType: 'int16';
  headerSize: number;
  // Hardware extracted headers
  ventanaNsHdr: number | null;
  muestrasHdr: number | null;
  erHdr: number | null;
  totalTrazasHdr: number | null;
  stepHdr: number | null;
  autocorrScore?: number;
}

export interface GPRTrace {
  id: number;
  positionM: number;
  timeZeroShiftNs: number;
  elevationM: number;
  rawSamples: Float32Array;
  processedSamples: Float32Array;
}

export interface GPRDataset {
  id: string;
  filename: string;
  rawBuffer: ArrayBuffer;
  header: GSFHeader;
  traces: GPRTrace[];
  rawMatrix: Float32Array[];       // Shape: [numTraces][numSamples]
  processedMatrix: Float32Array[]; // Shape: [numTraces][numSamples]
  minAmplitude: number;
  maxAmplitude: number;
  createdTime: number;
}

/**
 * Autocorrelation-based geometry detection for .gsf data block using FFT.
 * Exactly replicates scipy.signal.correlate(raw, raw, mode='full', method='fft') from Python.
 */
export function detectarGeometriaGSF(
  buffer: ArrayBuffer,
  cabecera: number = CABECERA_DEFAULT,
  maxBytesAnalisis: number = 200000
): { tamBloque: number; muestrasPorTraza: number; score: number } {
  const totalBytes = buffer.byteLength;
  const datosUtilesLen = totalBytes - cabecera;
  if (datosUtilesLen <= 0) {
    return { tamBloque: 1024, muestrasPorTraza: 512, score: 0 };
  }

  const analBytesLen = Math.min(datosUtilesLen, maxBytesAnalisis);
  const nShorts = Math.floor(analBytesLen / 2);
  const dataView = new DataView(buffer, cabecera, nShorts * 2);

  const raw = new Float32Array(nShorts);
  let mean = 0;
  for (let i = 0; i < nShorts; i++) {
    const val = dataView.getInt16(i * 2, true);
    raw[i] = val;
    mean += val;
  }
  mean /= nShorts;
  for (let i = 0; i < nShorts; i++) {
    raw[i] -= mean;
  }

  // Correlación FFT idéntica a scipy.signal.correlate(raw, raw, method='fft')
  const corr = correlateFFT(raw);
  const corr0 = corr[0] !== 0 ? corr[0] : 1.0;

  const maxLag = Math.min(2500, corr.length);
  const candidatos: Array<{ score: number; tamBloque: number; muestras: number }> = [];

  for (let lag = 100; lag < maxLag; lag++) {
    const bLag = lag * 2;
    const score = corr[lag] / corr0;
    if (datosUtilesLen % bLag === 0) {
      candidatos.push({ score, tamBloque: bLag, muestras: lag });
    }
  }

  if (candidatos.length > 0) {
    candidatos.sort((a, b) => b.score - a.score);
    return {
      tamBloque: candidatos[0].tamBloque,
      muestrasPorTraza: candidatos[0].muestras,
      score: candidatos[0].score,
    };
  }

  // Si ninguno divide exactamente el residuo, buscar el lag de máxima correlación
  let bestLag = 512;
  let maxScore = -Infinity;
  for (let lag = 100; lag < maxLag; lag++) {
    const score = corr[lag] / corr0;
    if (score > maxScore) {
      maxScore = score;
      bestLag = lag;
    }
  }

  return {
    tamBloque: bestLag * 2,
    muestrasPorTraza: bestLag,
    score: maxScore,
  };
}

/**
 * Reads and decodes an Akula9000C / Geoscanners GSF binary file
 */
export function extractGSFHeader(
  buffer: ArrayBuffer,
  filename: string,
  cabecera: number = CABECERA_DEFAULT,
  manualSamples?: number
): GSFHeader {
  const dataView = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  let ventanaNsHdr: number | null = null;
  let muestrasHdr: number | null = null;
  let erHdr: number | null = null;
  let totalTrazasHdr: number | null = null;
  let stepHdr: number | null = null;

  // Extract Akula9000C Hardware Header (Offsets 66, 84, 86, 344, 406)
  if (totalBytes >= 410) {
    try {
      // Offset 66 (int16): Ventana / One-Way time
      const vVal = dataView.getInt16(66, true);
      if (vVal >= 1 && vVal <= 1000) {
        ventanaNsHdr = vVal;
      }

      // Offset 84 (int16): Muestras configuradas
      const mVal = dataView.getInt16(84, true);
      if (mVal >= 100 && mVal <= 5000) {
        muestrasHdr = mVal;
      }

      // Offset 86 (float32): Constante dieléctrica grabada (RDP)
      const erVal = dataView.getFloat32(86, true);
      if (erVal >= 1.0 && erVal <= 81.0) {
        erHdr = erVal;
      }

      // Offset 344 (int16): Total de trazas grabadas
      const tVal = dataView.getInt16(344, true);
      if (tVal >= 10 && tVal <= 50000) {
        totalTrazasHdr = tVal;
      }

      // Offset 406 (float32): Paso horizontal
      const sVal = dataView.getFloat32(406, true);
      if (sVal >= 0.001 && sVal <= 2.0) {
        stepHdr = sVal;
      }
    } catch (e) {
      console.warn('Error al leer offsets de cabecera Akula:', e);
    }
  }

  // Determine geometry (muestras por traza y total de trazas)
  let muestrasPorTraza = 512;
  let autocorrScore = 1.0;

  if (manualSamples && manualSamples > 0) {
    muestrasPorTraza = manualSamples;
  } else if (muestrasHdr && (totalBytes - cabecera) % (muestrasHdr * 2) === 0) {
    muestrasPorTraza = muestrasHdr;
  } else {
    const det = detectarGeometriaGSF(buffer, cabecera);
    muestrasPorTraza = det.muestrasPorTraza;
    autocorrScore = det.score;
  }

  const tamBloque = muestrasPorTraza * 2;
  const cuerpoBytes = Math.max(0, totalBytes - cabecera);
  const totalTrazas = Math.floor(cuerpoBytes / tamBloque);

  // Time window calibration
  let twFinal = VENTANA_TIEMPO_NS_DEF;
  if (ventanaNsHdr && ventanaNsHdr > 0) {
    twFinal = ventanaNsHdr;
  }

  const erFinal = erHdr && erHdr > 0 ? erHdr : DIELECTRICO_DEF;
  
  // Standard Odometry: 112 traces/meter (dx = 1/112 m)
  const dxFinal = DX_DEF;
  const tracesPerMeter = TRAZAS_POR_METRO_DEF;

  const dtFinal = twFinal / muestrasPorTraza;

  return {
    title: filename.replace(/\.[^/.]+$/, ''),
    version: 1.0,
    numTraces: totalTrazas,
    numSamples: muestrasPorTraza,
    sampleIntervalNs: dtFinal,
    timeWindowNs: twFinal,
    antennaFreqMHz: 400,
    dielectricPermittivity: erFinal,
    traceDistanceStepM: dxFinal,
    tracesPerMeter,
    zeroOffsetNs: 0,
    byteOffsetData: cabecera,
    traceHeaderBytes: 0,
    bytesPerSample: 2,
    dataType: 'int16',
    headerSize: cabecera,
    ventanaNsHdr,
    muestrasHdr,
    erHdr,
    totalTrazasHdr,
    stepHdr,
    autocorrScore,
  };
}

/**
 * Builds GPRDataset matrix from buffer and header
 */
export function buildDatasetFromHeader(
  buffer: ArrayBuffer,
  filename: string,
  header: GSFHeader
): GPRDataset {
  const dataView = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  const rawMatrix: Float32Array[] = [];
  const processedMatrix: Float32Array[] = [];
  const traces: GPRTrace[] = [];

  let minAmp = Infinity;
  let maxAmp = -Infinity;

  const bytesPerTrace = header.numSamples * 2;
  const availableBytes = Math.max(0, totalBytes - header.byteOffsetData);
  const maxPossibleTraces = Math.floor(availableBytes / bytesPerTrace);
  const numTraces = maxPossibleTraces;

  for (let t = 0; t < numTraces; t++) {
    const traceStartOffset = header.byteOffsetData + t * bytesPerTrace;
    const rawSamples = new Float32Array(header.numSamples);
    const processedSamples = new Float32Array(header.numSamples);

    for (let s = 0; s < header.numSamples; s++) {
      const sampleOffset = traceStartOffset + s * 2;
      let value = 0;

      if (sampleOffset + 2 <= totalBytes) {
        value = dataView.getInt16(sampleOffset, true); // Little Endian
      }

      rawSamples[s] = value;
      processedSamples[s] = value;

      if (value < minAmp) minAmp = value;
      if (value > maxAmp) maxAmp = value;
    }

    rawMatrix.push(rawSamples);
    processedMatrix.push(processedSamples);

    traces.push({
      id: t + 1,
      positionM: t * header.traceDistanceStepM,
      timeZeroShiftNs: 0,
      elevationM: 0,
      rawSamples,
      processedSamples,
    });
  }

  if (minAmp === Infinity) minAmp = -32768;
  if (maxAmp === -Infinity) maxAmp = 32767;

  return {
    id: `gpr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    filename,
    rawBuffer: buffer,
    header: { ...header, numTraces },
    traces,
    rawMatrix,
    processedMatrix,
    minAmplitude: minAmp,
    maxAmplitude: maxAmp,
    createdTime: Date.now(),
  };
}

/**
 * Parses GSF buffer into full GPRDataset
 */
export function parseGSFBuffer(buffer: ArrayBuffer, filename: string): GPRDataset {
  const header = extractGSFHeader(buffer, filename);
  return buildDatasetFromHeader(buffer, filename, header);
}

/**
 * Re-encodes a GPRDataset back into a binary ArrayBuffer (.gsf format)
 */
export function serializeGSF(dataset: GPRDataset): ArrayBuffer {
  const { header, processedMatrix } = dataset;
  const numTraces = processedMatrix.length;
  const numSamples = header.numSamples;
  const cabecera = header.byteOffsetData || CABECERA_DEFAULT;
  const dataSize = numTraces * numSamples * 2;
  const totalSize = cabecera + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(buffer);

  if (dataset.rawBuffer && dataset.rawBuffer.byteLength >= cabecera) {
    const origBytes = new Uint8Array(dataset.rawBuffer, 0, cabecera);
    const destBytes = new Uint8Array(buffer, 0, cabecera);
    destBytes.set(origBytes);
  }

  let offset = cabecera;
  for (let t = 0; t < numTraces; t++) {
    const trace = processedMatrix[t];
    for (let s = 0; s < numSamples; s++) {
      const rawVal = trace[s];
      const clampedVal = Math.max(-32768, Math.min(32767, Math.round(rawVal)));
      dataView.setInt16(offset, clampedVal, true);
      offset += 2;
    }
  }

  return buffer;
}
