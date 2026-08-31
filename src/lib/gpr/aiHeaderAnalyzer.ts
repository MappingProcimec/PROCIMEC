/**
 * Gemini AI & Correlation-Based Header Analyzer for GPR Radargrams (.gsf)
 */

import { GSFHeader } from './gsfParser';

export interface AIAnalysisResult {
  numSamples: number;
  byteOffsetData: number;
  traceHeaderBytes: number;
  dataType: 'int16' | 'uint16' | 'float32';
  sampleIntervalNs: number;
  traceDistanceStepM: number;
  antennaFreqMHz: number;
  explanation?: string;
}

/**
 * Converts ArrayBuffer to Hex Dump representation
 */
export function bufferToHexDump(buffer: ArrayBuffer, maxBytes: number = 512): string {
  const bytes = new Uint8Array(buffer.slice(0, maxBytes));
  let result = '';
  for (let i = 0; i < bytes.length; i += 16) {
    const offsetHex = i.toString(16).padStart(4, '0');
    const chunk = bytes.slice(i, i + 16);
    const hexParts: string[] = [];
    let asciiPart = '';

    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        hexParts.push(chunk[j].toString(16).padStart(2, '0'));
        asciiPart += chunk[j] >= 32 && chunk[j] <= 126 ? String.fromCharCode(chunk[j]) : '.';
      } else {
        hexParts.push('  ');
      }
    }
    result += `${offsetHex}: ${hexParts.join(' ')}  |${asciiPart}|\n`;
  }
  return result;
}

/**
 * Extracts printable ASCII text from buffer
 */
export function bufferToAscii(buffer: ArrayBuffer, maxBytes: number = 4096): string {
  const bytes = new Uint8Array(buffer.slice(0, maxBytes));
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    str += (b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9 ? String.fromCharCode(b) : ' ';
  }
  return str;
}

/**
 * Calls Gemini AI API to analyze the GSF file header and determine exact matrix parameters.
 */
export async function analyzeHeaderWithGemini(
  buffer: ArrayBuffer,
  filename: string
): Promise<AIAnalysisResult | null> {
  try {
    const headerAscii = bufferToAscii(buffer, 4096);
    const headerHex = bufferToHexDump(buffer, 512);

    const res = await fetch('/api/gpr/analyze-header', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headerAscii,
        headerHex,
        fileSizeBytes: buffer.byteLength,
        filename,
      }),
    });

    if (!res.ok) {
      console.warn('API analyze-header request failed:', res.statusText);
      return null;
    }

    const json = await res.json();
    if (json.success && json.data) {
      const data = json.data;
      return {
        numSamples: Number(data.numSamples) || 512,
        byteOffsetData: Number(data.byteOffsetData) || 1024,
        traceHeaderBytes: Number(data.traceHeaderBytes) || 0,
        dataType: data.dataType === 'float32' ? 'float32' : 'int16',
        sampleIntervalNs: Number(data.sampleIntervalNs) || 0.1,
        traceDistanceStepM: Number(data.traceDistanceStepM) || 0.05,
        antennaFreqMHz: Number(data.antennaFreqMHz) || 450,
        explanation: data.explanation || 'Calibrado por Gemini AI',
      };
    }
    return null;
  } catch (err) {
    console.error('Error calling analyzeHeaderWithGemini:', err);
    return null;
  }
}

/**
 * Auto-detects optimal trace stride using adjacent trace cross-correlation.
 * Finds the exact trace header size and sample count that maximizes horizontal reflection continuity.
 */
export function autoDetectTraceStride(buffer: ArrayBuffer, currentHeader: GSFHeader): GSFHeader {
  const dataView = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  const candidateOffsets = [currentHeader.byteOffsetData, 512, 1024, 2048, 0];
  const candidateSamples = [currentHeader.numSamples, 512, 1024, 256, 2048, 128];
  const candidateTraceHeaders = [0, 24, 32, 16, 20, 28, 64];

  let bestScore = -Infinity;
  let bestHeader = { ...currentHeader };

  // Test across combinations on first 30 traces
  for (const offset of candidateOffsets) {
    for (const samples of candidateSamples) {
      for (const thBytes of candidateTraceHeaders) {
        const bytesPerTrace = samples * 2 + thBytes;
        if (bytesPerTrace <= 0 || offset + bytesPerTrace * 10 > totalBytes) continue;

        // Compute adjacent trace correlation
        let totalCorr = 0;
        const testTraces = Math.min(20, Math.floor((totalBytes - offset) / bytesPerTrace) - 1);
        if (testTraces < 3) continue;

        for (let t = 0; t < testTraces; t++) {
          const t1Start = offset + t * bytesPerTrace + thBytes;
          const t2Start = offset + (t + 1) * bytesPerTrace + thBytes;

          let dot = 0;
          let norm1 = 0;
          let norm2 = 0;

          for (let s = 0; s < samples; s += 2) {
            const v1 = dataView.getInt16(t1Start + s * 2, true);
            const v2 = dataView.getInt16(t2Start + s * 2, true);
            dot += v1 * v2;
            norm1 += v1 * v1;
            norm2 += v2 * v2;
          }

          const denom = Math.sqrt(norm1 * norm2);
          if (denom > 0) {
            totalCorr += dot / denom;
          }
        }

        const avgCorr = totalCorr / testTraces;

        if (avgCorr > bestScore) {
          bestScore = avgCorr;
          bestHeader = {
            ...currentHeader,
            byteOffsetData: offset,
            numSamples: samples,
            traceHeaderBytes: thBytes,
          };
        }
      }
    }
  }

  return bestHeader;
}
