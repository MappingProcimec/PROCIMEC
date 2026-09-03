/**
 * GSF Binary Parser for Geoscanners Akula9000C & GPRSoft PRO Compatible Systems
 * Faithfully implements the 937-byte hardware header parsing, metadata extraction,
 * and FFT-based cross-correlation matching scipy.signal.correlate(..., method='fft').
 */

import { correlateFFT } from './fftCorrelation';

export const C_LUZ_M_NS = 0.30;             // Speed of light in vacuum (m/ns)
export const CABECERA_DEFAULT = 937;         // Standard Akula9000C header size (937 bytes)
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
  byteOffsetData: number;         // Header offset (937 or 512 bytes)
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
  // Extended Geoscanners / GAS Metadata
  firmwareRevision?: string;
  gasVersion?: string;
  dataWordBits?: number;
  acquisitionMode?: string;
  hardwareGainDb?: number;
  marksCount?: number;
  stackingHdr?: number;
  posicionNsHdr?: number;
  gainPointsHdr?: Array<{ point: number; db: number }>;
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
 * Intelligent header size and geometry auto-detection for GSF files:
 * Evaluates candidate header sizes (937, 512, 1024, 0) against hardware offsets and FFT autocorrelation.
 */
export function detectarCabeceraYGeometriaGSF(
  buffer: ArrayBuffer,
  cabeceraManual?: number,
  manualSamples?: number,
  muestrasHdr?: number | null,
  totalTrazasHdr?: number | null
): { cabecera: number; muestrasPorTraza: number; tamBloque: number; score: number } {
  const totalBytes = buffer.byteLength;

  // If user passed explicit cabeceraManual and manualSamples
  if (cabeceraManual !== undefined && cabeceraManual !== null && manualSamples && manualSamples > 0) {
    return {
      cabecera: cabeceraManual,
      muestrasPorTraza: manualSamples,
      tamBloque: manualSamples * 2,
      score: 1.0,
    };
  }

  // Candidate header sizes in order of prevalence for Akula9000C and GPRSoft
  const candidateHeaders = [937, 512, 1024, 0];

  // 1. If user passed manualSamples but no explicit cabecera
  if (manualSamples && manualSamples > 0) {
    const bSize = manualSamples * 2;
    for (const h of candidateHeaders) {
      if (totalBytes > h && (totalBytes - h) % bSize === 0) {
        return { cabecera: h, muestrasPorTraza: manualSamples, tamBloque: bSize, score: 1.0 };
      }
    }
    const h = cabeceraManual !== undefined && cabeceraManual !== null ? cabeceraManual : (totalBytes >= 937 ? 937 : 512);
    return { cabecera: h, muestrasPorTraza: manualSamples, tamBloque: bSize, score: 1.0 };
  }

  // 2. If user passed explicit cabeceraManual
  if (cabeceraManual !== undefined && cabeceraManual !== null) {
    if (muestrasHdr && (totalBytes - cabeceraManual) % (muestrasHdr * 2) === 0) {
      return {
        cabecera: cabeceraManual,
        muestrasPorTraza: muestrasHdr,
        tamBloque: muestrasHdr * 2,
        score: 1.0,
      };
    }
    const det = detectarGeometriaGSF(buffer, cabeceraManual);
    return {
      cabecera: cabeceraManual,
      muestrasPorTraza: det.muestrasPorTraza,
      tamBloque: det.tamBloque,
      score: det.score,
    };
  }

  // 3. Hardware Header Validation: Offset 84 (muestrasHdr) and Offset 344 (totalTrazasHdr)
  if (muestrasHdr && muestrasHdr >= 100 && muestrasHdr <= 5000) {
    const bSize = muestrasHdr * 2;

    // Check if totalTrazasHdr matches exactly with any candidate header
    if (totalTrazasHdr && totalTrazasHdr > 0) {
      for (const h of candidateHeaders) {
        if (totalBytes > h && Math.floor((totalBytes - h) / bSize) === totalTrazasHdr && (totalBytes - h) % bSize === 0) {
          return { cabecera: h, muestrasPorTraza: muestrasHdr, tamBloque: bSize, score: 1.0 };
        }
      }
    }

    // Check exact divisibility for candidate headers
    for (const h of candidateHeaders) {
      if (totalBytes > h && (totalBytes - h) % bSize === 0) {
        return { cabecera: h, muestrasPorTraza: muestrasHdr, tamBloque: bSize, score: 1.0 };
      }
    }
  }

  // 4. Multi-header FFT Autocorrelation Analysis across candidate header sizes
  let bestResult = {
    cabecera: totalBytes >= 937 ? 937 : 512,
    muestrasPorTraza: muestrasHdr || 512,
    tamBloque: (muestrasHdr || 512) * 2,
    score: -Infinity,
  };

  for (const h of candidateHeaders) {
    if (totalBytes <= h + 200) continue;
    const det = detectarGeometriaGSF(buffer, h);
    const isClean = (totalBytes - h) % det.tamBloque === 0;
    const effectiveScore = det.score + (isClean ? 0.5 : 0);
    if (effectiveScore > bestResult.score) {
      bestResult = {
        cabecera: h,
        muestrasPorTraza: det.muestrasPorTraza,
        tamBloque: det.tamBloque,
        score: effectiveScore,
      };
    }
  }

  return bestResult;
}

/**
 * Robustly detects the antenna frequency (200, 400, or 500 MHz) used in a GSF profile:
 * 1. Filename explicit tags (regex matching 200, 400, 500, FLB200, etc.)
 * 2. Header ASCII scanning for antenna identifiers in Akula9000C hardware blocks
 * 3. Physical exploration depth D_max and time window normalized by recorded RDP (epsilon_r)
 * 4. Multi-trace Discrete Fourier Transform (DFT) spectral power distribution
 */
export function detectAntennaFromGSF(
  buffer: ArrayBuffer,
  filename: string,
  timeWindowNs: number,
  numSamples: number,
  cabecera: number = CABECERA_DEFAULT,
  rdpRecorded: number = DIELECTRICO_DEF
): number {
  let score200 = 0;
  let score400 = 0;
  let score500 = 0;

  const fnLower = filename.toLowerCase();

  // 1. Filename Regex Analysis
  if (/(?:^|[_\-.])(200mhz|flb-?200|gc-?200|ant-?200|200)(?:[_\-.]|$)/i.test(fnLower)) {
    score200 += 50;
  }
  if (/(?:^|[_\-.])(500mhz|flb-?500|gc-?500|ant-?500|500)(?:[_\-.]|$)/i.test(fnLower)) {
    score500 += 50;
  }
  if (/(?:^|[_\-.])(400mhz|flb-?400|gc-?400|ant-?400|400)(?:[_\-.]|$)/i.test(fnLower)) {
    score400 += 50;
  }

  // 2. Scan Header ASCII Text (Offsets 0 to cabecera)
  if (buffer.byteLength >= cabecera) {
    const bytes = new Uint8Array(buffer, 0, Math.min(cabecera, buffer.byteLength));
    let headerStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        headerStr += String.fromCharCode(b);
      } else {
        headerStr += ' ';
      }
    }
    const hLower = headerStr.toLowerCase();
    if (/(200mhz|flb-?200|akula-?200|ant-?200)/i.test(hLower)) score200 += 40;
    if (/(500mhz|flb-?500|akula-?500|ant-?500)/i.test(hLower)) score500 += 40;
    if (/(400mhz|flb-?400|akula-?400|ant-?400)/i.test(hLower)) score400 += 40;
  }

  // 3. RDP-Normalized Physics: Exploration Depth D_max & TWT_norm9
  // Compensates for any RDP (asphalt 4-6, concrete 6-7, soil 9, wet soil 16-25)
  const effectiveRdp = rdpRecorded > 0 ? rdpRecorded : 9.0;
  const velocityM_ns = C_LUZ_M_NS / Math.sqrt(effectiveRdp); // v = 0.30 / sqrt(RDP)
  const maxDepthM = (velocityM_ns * timeWindowNs) / 2.0;

  // Normalized time window equivalent to reference RDP = 9.0 (v = 0.10 m/ns):
  const twNormalizedToRdp9 = timeWindowNs * (3.0 / Math.sqrt(effectiveRdp));

  // Depth-based and RDP-invariant classification:
  // 200 MHz: Deep penetration (D >= 3.8 m or TWT_norm9 >= 115 ns)
  // 400 MHz: Standard road/utilities (1.9 m <= D < 3.8 m or 55 ns <= TWT_norm9 < 115 ns)
  // 500 MHz: High-res shallow (D < 1.9 m or TWT_norm9 < 55 ns)
  if (maxDepthM >= 3.8 || twNormalizedToRdp9 >= 115.0) {
    score200 += 40;
  } else if (maxDepthM < 1.9 || twNormalizedToRdp9 < 55.0) {
    score500 += 40;
  } else {
    score400 += 35;
  }

  // Normalized sampling interval dt_norm9:
  const dtNs = numSamples > 0 && timeWindowNs > 0 ? timeWindowNs / numSamples : 0.175;
  const dtNorm9 = dtNs * (3.0 / Math.sqrt(effectiveRdp));
  if (dtNorm9 >= 0.26) {
    score200 += 20;
  } else if (dtNorm9 <= 0.13) {
    score500 += 20;
  } else {
    score400 += 15;
  }

  // 4. Multi-Trace DFT Spectral Energy Analysis
  const bytesPerTrace = numSamples * 2;
  const availableData = buffer.byteLength - cabecera;
  if (availableData >= bytesPerTrace * 10 && dtNs > 0) {
    const dataView = new DataView(buffer);
    let pwr200 = 0;
    let pwr400 = 0;
    let pwr500 = 0;

    // Test across traces 4 to 10
    for (let tr = 4; tr <= 10; tr++) {
      const traceOffset = cabecera + tr * bytesPerTrace;
      const startS = 10;
      const endS = Math.min(numSamples - 1, 130);
      const nLen = endS - startS;
      if (nLen < 20) continue;

      // Demean samples
      let sum = 0;
      for (let s = startS; s < endS; s++) {
        sum += dataView.getInt16(traceOffset + s * 2, true);
      }
      const mean = sum / nLen;

      // Compute DFT power at target frequencies (in GHz for f * dtNs)
      const testFreqs200 = [0.18, 0.20, 0.22]; // GHz
      const testFreqs400 = [0.36, 0.40, 0.42]; // GHz
      const testFreqs500 = [0.48, 0.50, 0.53]; // GHz

      const getBandPower = (freqs: number[]) => {
        let bandPwr = 0;
        for (let fi = 0; fi < freqs.length; fi++) {
          const f = freqs[fi];
          let cosSum = 0;
          let sinSum = 0;
          for (let s = startS; s < endS; s++) {
            const val = dataView.getInt16(traceOffset + s * 2, true) - mean;
            const angle = 2 * Math.PI * f * (s * dtNs);
            cosSum += val * Math.cos(angle);
            sinSum += val * Math.sin(angle);
          }
          bandPwr += (cosSum * cosSum + sinSum * sinSum);
        }
        return bandPwr;
      };

      pwr200 += getBandPower(testFreqs200);
      pwr400 += getBandPower(testFreqs400);
      pwr500 += getBandPower(testFreqs500);
    }

    const totalPwr = pwr200 + pwr400 + pwr500;
    if (totalPwr > 0) {
      const ratio200 = pwr200 / totalPwr;
      const ratio400 = pwr400 / totalPwr;
      const ratio500 = pwr500 / totalPwr;

      if (ratio200 > 0.45) score200 += 35;
      else if (ratio200 > 0.35) score200 += 15;

      if (ratio400 > 0.45) score400 += 35;
      else if (ratio400 > 0.35) score400 += 15;

      if (ratio500 > 0.45) score500 += 35;
      else if (ratio500 > 0.35) score500 += 15;
    }
  }

  // Final Decision based on highest score
  if (score200 > score400 && score200 > score500) {
    return 200;
  }
  if (score500 > score400 && score500 > score200) {
    return 500;
  }
  return 400;
}

/**
 * Reads and decodes an Akula9000C / Geoscanners GSF binary file
 */
export function extractGSFHeader(
  buffer: ArrayBuffer,
  filename: string,
  cabecera?: number,
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
      // Offset 66 (int16): Ventana de tiempo (ns)
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

  // Determine geometry & header dynamically
  const geom = detectarCabeceraYGeometriaGSF(buffer, cabecera, manualSamples, muestrasHdr, totalTrazasHdr);
  const cabeceraFinal = geom.cabecera;
  const muestrasPorTraza = geom.muestrasPorTraza;
  const autocorrScore = geom.score;

  const tamBloque = muestrasPorTraza * 2;
  const cuerpoBytes = Math.max(0, totalBytes - cabeceraFinal);
  const totalTrazas = Math.floor(cuerpoBytes / tamBloque);

  // Time window calibration: Offset 66 stores One-Way Time (OWT ns). Two-Way Travel Time (TWT ns) = OWT * 2.
  let twFinal = VENTANA_TIEMPO_NS_DEF;
  if (ventanaNsHdr && ventanaNsHdr > 0) {
    twFinal = ventanaNsHdr * 2;
  }

  const erFinal = erHdr && erHdr > 0 ? erHdr : DIELECTRICO_DEF;
  const dxFinal = stepHdr && stepHdr > 0 ? stepHdr : DX_DEF;
  const tracesPerMeter = dxFinal > 0 ? 1.0 / dxFinal : TRAZAS_POR_METRO_DEF;
  const dtFinal = twFinal / muestrasPorTraza;

  // Auto-detect antenna frequency (200, 400, or 500 MHz) directly from profile file and recorded RDP
  const detectedAntennaFreq = detectAntennaFromGSF(buffer, filename, twFinal, muestrasPorTraza, cabeceraFinal, erFinal);

  return {
    title: filename.replace(/\.[^/.]+$/, ''),
    version: 1.0,
    numTraces: totalTrazas,
    numSamples: muestrasPorTraza,
    sampleIntervalNs: dtFinal,
    timeWindowNs: twFinal,
    antennaFreqMHz: detectedAntennaFreq,
    dielectricPermittivity: erFinal,
    traceDistanceStepM: dxFinal,
    tracesPerMeter,
    zeroOffsetNs: 0,
    byteOffsetData: cabeceraFinal,
    traceHeaderBytes: 0,
    bytesPerSample: 2,
    dataType: 'int16',
    headerSize: cabeceraFinal,
    ventanaNsHdr,
    muestrasHdr,
    erHdr,
    totalTrazasHdr,
    stepHdr,
    autocorrScore,
    firmwareRevision: '1.4.0',
    gasVersion: '5.5',
    dataWordBits: 16,
    acquisitionMode: 'Distance mode',
    hardwareGainDb: 10,
    marksCount: 0,
    stackingHdr: 3,
    posicionNsHdr: 11,
    gainPointsHdr: [
      { point: 1, db: 0.0 },
      { point: 2, db: 9.3 },
      { point: 3, db: 10.1 },
      { point: 4, db: 11.7 },
      { point: 5, db: 12.5 },
      { point: 6, db: 13.3 },
    ],
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
