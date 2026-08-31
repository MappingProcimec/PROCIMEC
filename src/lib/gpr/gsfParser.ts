/**
 * GSF Binary Parser & Serialization Engine for GPR Radargrams
 * Supports parsing Geotech / ImpulseRadar / standard GPR binary format (.gsf)
 */

export interface GSFHeader {
  title: string;
  version: number;
  numTraces: number;
  numSamples: number;
  sampleIntervalNs: number; // dt in nanoseconds
  timeWindowNs: number;     // Total time window = numSamples * sampleIntervalNs
  antennaFreqMHz: number;
  dielectricPermittivity: number; // Initial dielectric constant epsilon_r (e.g. 9 for soil)
  traceDistanceStepM: number;     // Distance between traces in meters
  zeroOffsetNs: number;           // Time zero offset
  byteOffsetData: number;         // Offset where trace sample data starts
  bytesPerSample: number;         // 2 (int16) or 4 (float32)
  dataType: 'int16' | 'uint16' | 'float32';
  headerSize: number;
}

export interface GPRTrace {
  id: number;
  positionM: number;       // Distance coordinate along profile
  timeZeroShiftNs: number; // Individual trace zero shift if available
  elevationM: number;      // Topographic elevation if available
  rawSamples: Float32Array; // Original sample data
  processedSamples: Float32Array; // Currently active/processed sample data
}

export interface GPRDataset {
  id: string;
  filename: string;
  header: GSFHeader;
  traces: GPRTrace[];
  rawMatrix: Float32Array[];       // Array of Float32Array traces [numTraces][numSamples]
  processedMatrix: Float32Array[]; // Array of Float32Array traces [numTraces][numSamples]
  minAmplitude: number;
  maxAmplitude: number;
  createdTime: number;
}

/**
 * Parses an ArrayBuffer containing a .gsf binary radargram file.
 */
export function parseGSFBuffer(buffer: ArrayBuffer, filename: string): GPRDataset {
  const dataView = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  // Default fallback header values in case header fields are partially defined
  let header: GSFHeader = {
    title: filename.replace(/\.[^/.]+$/, ""),
    version: 1.0,
    numTraces: 0,
    numSamples: 512,
    sampleIntervalNs: 0.1, // 100 ps default
    timeWindowNs: 51.2,
    antennaFreqMHz: 500,
    dielectricPermittivity: 9.0,
    traceDistanceStepM: 0.05,
    zeroOffsetNs: 0,
    byteOffsetData: 1024, // Standard GSF header offset
    bytesPerSample: 2,
    dataType: 'int16',
    headerSize: 1024,
  };

  // Check GSF header signature or read metadata if available
  if (totalBytes >= 128) {
    try {
      // GSF format header decoding (supports standard ImpulseRadar/Geotech GSF headers)
      // Check for magic string "GSF" or "GEOTECH" or standard byte header fields
      const magicStr = readAsciiString(dataView, 0, 16).trim();
      if (magicStr.includes("GSF") || magicStr.includes("Impulse") || magicStr.includes("Geotech")) {
        header.title = magicStr || header.title;
      }

      // Read common header uint16/uint32 offsets
      // Byte 16: Version or Header Size
      const headerSize = dataView.getUint16(16, true);
      if (headerSize >= 128 && headerSize <= 4096) {
        header.headerSize = headerSize;
        header.byteOffsetData = headerSize;
      }

      // Byte 18: Samples per trace
      const ns = dataView.getUint16(18, true);
      if (ns > 32 && ns <= 16384) {
        header.numSamples = ns;
      }

      // Byte 20: Number of traces (or auto-calculated below)
      const nt = dataView.getUint32(20, true);
      if (nt > 0 && nt < 100000) {
        header.numTraces = nt;
      }

      // Byte 24: Sample interval in picoseconds (ps) -> convert to ns
      const sampleIntPs = dataView.getFloat32(24, true);
      if (sampleIntPs > 0 && sampleIntPs < 100000) {
        header.sampleIntervalNs = sampleIntPs < 10 ? sampleIntPs : sampleIntPs / 1000.0;
      }

      // Byte 28: Antenna Frequency MHz
      const freq = dataView.getFloat32(28, true);
      if (freq > 10 && freq < 10000) {
        header.antennaFreqMHz = freq;
      }

      // Byte 32: Trace distance step
      const step = dataView.getFloat32(32, true);
      if (step > 0 && step < 10) {
        header.traceDistanceStepM = step;
      }

      // Byte 36: Data type code (0 = int16, 1 = float32, 2 = uint16)
      const typeCode = dataView.getUint16(36, true);
      if (typeCode === 1) {
        header.dataType = 'float32';
        header.bytesPerSample = 4;
      } else if (typeCode === 2) {
        header.dataType = 'uint16';
        header.bytesPerSample = 2;
      } else {
        header.dataType = 'int16';
        header.bytesPerSample = 2;
      }
    } catch (e) {
      console.warn("GSF Header auto-detection warning, falling back to heuristic parsing:", e);
    }
  }

  // Calculate actual trace counts based on file size if header didn't specify or was corrupt
  const bytesPerTrace = header.numSamples * header.bytesPerSample;
  const availableDataBytes = Math.max(0, totalBytes - header.byteOffsetData);
  const calculatedTraces = Math.floor(availableDataBytes / bytesPerTrace);

  if (calculatedTraces > 0) {
    header.numTraces = calculatedTraces;
  } else {
    // Fallback: If header size offset is larger than file, start at byte 0 or 512
    const altOffset = totalBytes > 512 ? 512 : 0;
    header.byteOffsetData = altOffset;
    header.numTraces = Math.floor((totalBytes - altOffset) / bytesPerTrace);
  }

  header.timeWindowNs = header.numSamples * header.sampleIntervalNs;

  // Extract Traces
  const rawMatrix: Float32Array[] = [];
  const processedMatrix: Float32Array[] = [];
  const traces: GPRTrace[] = [];

  let minAmp = Infinity;
  let maxAmp = -Infinity;
  let currentByteOffset = header.byteOffsetData;

  for (let t = 0; t < header.numTraces; t++) {
    const rawSamples = new Float32Array(header.numSamples);
    const processedSamples = new Float32Array(header.numSamples);

    for (let s = 0; s < header.numSamples; s++) {
      let value = 0;
      if (currentByteOffset + header.bytesPerSample <= totalBytes) {
        if (header.dataType === 'float32') {
          value = dataView.getFloat32(currentByteOffset, true);
        } else if (header.dataType === 'uint16') {
          value = dataView.getUint16(currentByteOffset, true) - 32768;
        } else {
          value = dataView.getInt16(currentByteOffset, true);
        }
        currentByteOffset += header.bytesPerSample;
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
    header,
    traces,
    rawMatrix,
    processedMatrix,
    minAmplitude: minAmp,
    maxAmplitude: maxAmp,
    createdTime: Date.now(),
  };
}

/**
 * Helper to read ASCII string from DataView
 */
function readAsciiString(dataView: DataView, offset: number, length: number): string {
  let str = "";
  for (let i = 0; i < length; i++) {
    if (offset + i < dataView.byteLength) {
      const charCode = dataView.getUint8(offset + i);
      if (charCode === 0) break;
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
  const bytesPerSample = 2; // Export standard Int16 format for max compatibility
  const headerSize = 1024;
  const dataSize = numTraces * numSamples * bytesPerSample;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(buffer);

  // Write Magic Signature
  const magic = "GSF IMPULSERADAR";
  for (let i = 0; i < magic.length; i++) {
    dataView.setUint8(i, magic.charCodeAt(i));
  }

  // Header fields
  dataView.setUint16(16, headerSize, true);
  dataView.setUint16(18, numSamples, true);
  dataView.setUint32(20, numTraces, true);
  dataView.setFloat32(24, header.sampleIntervalNs * 1000.0, true); // Save as ps
  dataView.setFloat32(28, header.antennaFreqMHz, true);
  dataView.setFloat32(32, header.traceDistanceStepM, true);
  dataView.setUint16(36, 0, true); // 0 = int16 format

  // Write Trace Binary Data
  let offset = headerSize;
  for (let t = 0; t < numTraces; t++) {
    const trace = processedMatrix[t];
    for (let s = 0; s < numSamples; s++) {
      const rawVal = trace[s];
      // Clamp values to Int16 bounds [-32768, 32767]
      const clampedVal = Math.max(-32768, Math.min(32767, Math.round(rawVal)));
      dataView.setInt16(offset, clampedVal, true);
      offset += 2;
    }
  }

  return buffer;
}
