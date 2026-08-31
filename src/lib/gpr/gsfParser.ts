/**
 * Advanced GSF Binary Parser & Serialization Engine for GPR Radargrams
 * Supports ImpulseRadar (CrossOver, Raptor, PinPoint), Geotech, and standard GPR binary formats.
 */

export interface GSFHeader {
  title: string;
  version: number;
  numTraces: number;
  numSamples: number;             // Samples per trace (typically 256, 512, 1024, 2048)
  sampleIntervalNs: number;       // dt in nanoseconds
  timeWindowNs: number;           // Total time window = numSamples * sampleIntervalNs
  antennaFreqMHz: number;
  dielectricPermittivity: number; // Initial dielectric constant epsilon_r (e.g. 9 for soil)
  traceDistanceStepM: number;     // Distance between traces in meters (dx)
  zeroOffsetNs: number;           // Time zero offset
  byteOffsetData: number;         // Byte offset where trace sample data starts (typically 1024)
  traceHeaderBytes: number;       // Bytes per trace header (0, 16, 24, 32, etc.)
  bytesPerSample: number;         // 2 (int16) or 4 (float32)
  dataType: 'int16' | 'uint16' | 'float32';
  headerSize: number;
}

export interface GPRTrace {
  id: number;
  positionM: number;              // Distance coordinate along profile
  timeZeroShiftNs: number;
  elevationM: number;
  rawSamples: Float32Array;
  processedSamples: Float32Array;
}

export interface GPRDataset {
  id: string;
  filename: string;
  rawBuffer: ArrayBuffer;         // Keep raw buffer in memory for dynamic re-parsing/calibration
  header: GSFHeader;
  traces: GPRTrace[];
  rawMatrix: Float32Array[];
  processedMatrix: Float32Array[];
  minAmplitude: number;
  maxAmplitude: number;
  createdTime: number;
}

/**
 * Extracts and parses GSF header from an ArrayBuffer using ASCII metadata + binary fallback.
 */
export function extractGSFHeader(buffer: ArrayBuffer, filename: string): GSFHeader {
  const dataView = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  // Defaults
  const header: GSFHeader = {
    title: filename.replace(/\.[^/.]+$/, ''),
    version: 1.0,
    numTraces: 0,
    numSamples: 512,
    sampleIntervalNs: 0.1, // 100 ps default
    timeWindowNs: 51.2,
    antennaFreqMHz: 450,
    dielectricPermittivity: 9.0,
    traceDistanceStepM: 0.05,
    zeroOffsetNs: 0,
    byteOffsetData: 1024,
    traceHeaderBytes: 0,
    bytesPerSample: 2,
    dataType: 'int16',
    headerSize: 1024,
  };

  // 1. Try reading first 4096 bytes as ASCII text metadata
  const maxHeaderBytes = Math.min(totalBytes, 4096);
  const headerText = readAsciiString(dataView, 0, maxHeaderBytes);

  // Check if text header contains ASCII key-values
  let foundAsciiSamples = false;

  // Regex patterns for ImpulseRadar / Geotech / GPR ASCII headers
  const samplesMatch = headerText.match(/(?:SAMPLES|POINTS|NUM_SAMPLES|MUESTRAS|SAMP_PER_TRACE|NS|SAMPLES_PER_TRACE)[\s:=]+([0-9]+)/i);
  if (samplesMatch) {
    const s = parseInt(samplesMatch[1], 10);
    if (s >= 32 && s <= 8192) {
      header.numSamples = s;
      foundAsciiSamples = true;
    }
  }

  const tracesMatch = headerText.match(/(?:TRACES|NUM_TRACES|NUMBER_OF_TRACES|TOTAL_TRACES|NT)[\s:=]+([0-9]+)/i);
  if (tracesMatch) {
    const t = parseInt(tracesMatch[1], 10);
    if (t > 0 && t < 200000) {
      header.numTraces = t;
    }
  }

  const dtMatch = headerText.match(/(?:SAMPLEINTERVAL|SAMPLE_INTERVAL|TIME_INCREMENT|DT|SAMPLE_INT|TIME_STEP)[\s:=]+([0-9.]+)/i);
  if (dtMatch) {
    const dt = parseFloat(dtMatch[1]);
    if (dt > 0) {
      // If dt > 5, it's likely in picoseconds -> convert to ns
      header.sampleIntervalNs = dt > 5 ? dt / 1000.0 : dt;
    }
  }

  const timeWinMatch = headerText.match(/(?:TIMEWINDOW|TIME_WINDOW|RANGE|WINDOW_NS|TIME_RANGE)[\s:=]+([0-9.]+)/i);
  if (timeWinMatch) {
    const win = parseFloat(timeWinMatch[1]);
    if (win > 0 && win < 10000) {
      header.timeWindowNs = win;
      if (header.numSamples > 0 && !dtMatch) {
        header.sampleIntervalNs = win / header.numSamples;
      }
    }
  }

  const freqMatch = headerText.match(/(?:FREQUENCY|FREQ|ANTENNA_FREQ|ANTENNA_FREQUENCY|ANTENNA)[\s:=]+([0-9.]+)/i);
  if (freqMatch) {
    const f = parseFloat(freqMatch[1]);
    if (f >= 10 && f <= 10000) {
      header.antennaFreqMHz = f;
    }
  }

  const dxMatch = headerText.match(/(?:TRACEINTERVAL|TRACE_INTERVAL|DX|STEP|DISTANCE_INCREMENT|DISTANCE_INTERVAL)[\s:=]+([0-9.]+)/i);
  if (dxMatch) {
    const dx = parseFloat(dxMatch[1]);
    if (dx > 0 && dx < 50) {
      header.traceDistanceStepM = dx;
    }
  }

  const offsetMatch = headerText.match(/(?:HEADER_SIZE|HEADERSIZE|DATA_OFFSET|OFFSET_BYTES|OFFSET)[\s:=]+([0-9]+)/i);
  if (offsetMatch) {
    const off = parseInt(offsetMatch[1], 10);
    if (off >= 0 && off < totalBytes) {
      header.byteOffsetData = off;
      header.headerSize = off;
    }
  } else {
    // Detect binary start: Look for null terminators or start at 1024 or 512
    if (totalBytes >= 1024) {
      header.byteOffsetData = 1024;
      header.headerSize = 1024;
    } else if (totalBytes >= 512) {
      header.byteOffsetData = 512;
      header.headerSize = 512;
    } else {
      header.byteOffsetData = 0;
      header.headerSize = 0;
    }
  }

  const traceHeadMatch = headerText.match(/(?:TRACE_HEADER_SIZE|TRACEHEADER|TRACE_HEADER)[\s:=]+([0-9]+)/i);
  if (traceHeadMatch) {
    header.traceHeaderBytes = parseInt(traceHeadMatch[1], 10);
  }

  // 2. Fallback heuristic if no ASCII samples tag was found
  if (!foundAsciiSamples) {
    // Check standard power-of-two samples: 512, 1024, 256, 2048, 4096
    const candidateSamples = [512, 1024, 256, 2048, 128, 4096];
    const dataLen = totalBytes - header.byteOffsetData;

    let bestSamples = 512;
    for (const cand of candidateSamples) {
      const bytesPerTrace = cand * 2 + header.traceHeaderBytes;
      if (bytesPerTrace > 0 && dataLen % bytesPerTrace === 0) {
        bestSamples = cand;
        break;
      }
    }
    header.numSamples = bestSamples;
  }

  // 3. Compute final trace counts
  const bytesPerTrace = header.numSamples * header.bytesPerSample + header.traceHeaderBytes;
  const availableBytes = Math.max(0, totalBytes - header.byteOffsetData);
  const calculatedTraces = Math.floor(availableBytes / bytesPerTrace);

  if (calculatedTraces > 0) {
    header.numTraces = calculatedTraces;
  } else {
    header.numTraces = Math.max(1, Math.floor(availableBytes / (header.numSamples * 2)));
  }

  header.timeWindowNs = header.numSamples * header.sampleIntervalNs;

  return header;
}

/**
 * Parses trace matrix from raw buffer according to specified or detected GSFHeader.
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

  const bytesPerTrace = header.numSamples * header.bytesPerSample + header.traceHeaderBytes;
  const maxPossibleTraces = Math.floor(Math.max(0, totalBytes - header.byteOffsetData) / bytesPerTrace);
  const numTraces = Math.min(header.numTraces || maxPossibleTraces, maxPossibleTraces);

  for (let t = 0; t < numTraces; t++) {
    const traceStartOffset = header.byteOffsetData + t * bytesPerTrace + header.traceHeaderBytes;
    const rawSamples = new Float32Array(header.numSamples);
    const processedSamples = new Float32Array(header.numSamples);

    for (let s = 0; s < header.numSamples; s++) {
      const sampleOffset = traceStartOffset + s * header.bytesPerSample;
      let value = 0;

      if (sampleOffset + header.bytesPerSample <= totalBytes) {
        if (header.dataType === 'float32') {
          value = dataView.getFloat32(sampleOffset, true);
        } else if (header.dataType === 'uint16') {
          value = dataView.getUint16(sampleOffset, true) - 32768;
        } else {
          value = dataView.getInt16(sampleOffset, true);
        }
      }

      rawSamples[s] = value;
      processedSamples[s] = value;

      if (value < minAmp) minAmp = value;
      if (value > maxAmp) maxAmp = value;
    }

    rawMatrix.push(rawSamples);
    processedMatrix.push(processedSamples);

    traces.push({
      id: t,
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
 * Top-level function to parse ArrayBuffer into GPRDataset.
 */
export function parseGSFBuffer(buffer: ArrayBuffer, filename: string): GPRDataset {
  const header = extractGSFHeader(buffer, filename);
  return buildDatasetFromHeader(buffer, filename, header);
}

/**
 * Helper to read ASCII string from DataView
 */
function readAsciiString(dataView: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    if (offset + i < dataView.byteLength) {
      const charCode = dataView.getUint8(offset + i);
      if (charCode === 0) continue; // Skip nulls in headers
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}

/**
 * Re-encodes a GPRDataset back into a binary ArrayBuffer (.gsf format).
 */
export function serializeGSF(dataset: GPRDataset): ArrayBuffer {
  const { header, processedMatrix } = dataset;
  const numTraces = processedMatrix.length;
  const numSamples = header.numSamples;
  const headerSize = 1024;
  const dataSize = numTraces * numSamples * 2;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(buffer);

  // Write ASCII / GSF Header Block
  const headerLines = [
    '// ImpulseRadar GSF File Export',
    `TITLE=${header.title}`,
    `SAMPLES=${numSamples}`,
    `TRACES=${numTraces}`,
    `SAMPLEINTERVAL=${(header.sampleIntervalNs).toFixed(6)}`,
    `TIMEWINDOW=${(header.timeWindowNs).toFixed(2)}`,
    `FREQUENCY=${header.antennaFreqMHz}`,
    `TRACEINTERVAL=${header.traceDistanceStepM}`,
    `DATA_TYPE=16`,
    `HEADER_SIZE=${headerSize}`,
  ].join('\r\n');

  for (let i = 0; i < headerLines.length && i < headerSize; i++) {
    dataView.setUint8(i, headerLines.charCodeAt(i));
  }

  // Write Trace Binary Data
  let offset = headerSize;
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
