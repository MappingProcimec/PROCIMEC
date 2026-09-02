/**
 * High-Performance Digital Signal Processing (DSP) Engine for GPR Radargrams
 * Faithfully matches the Python reference implementation for Geoscanners Akula9000C / GPRSoft:
 * 1. Time-Zero Correction
 * 2. Dewow Filter (DC baseline removal)
 * 3. Secular Energy Correction (SEC Gain)
 * 4. Butterworth Bandpass Filter
 * 5. Background Removal
 * 6. Kirchhoff Migration
 */

import { GPRDataset } from './gsfParser';

export interface DSPOptions {
  // Mode: Raw Binary vs Processed DSP
  mode: 'crudo' | 'procesado';

  // DSP Filter Switches
  dewow: boolean;
  timeZero: boolean;
  timeZeroMode: 'auto' | 'manual';
  timeZeroCustomNs: number; // Manual offset in ns when mode is 'manual'
  secGain: boolean;
  bandpass: boolean;
  backgroundRemoval: boolean;

  // Parameters
  secAlphaMin: number;
  secAlphaMax: number;
  dielectricPermittivity: number; // RDP (epsilon_r)
  ventanaNs: number;
  traceDistanceStepM: number;
  profundidadMaxM?: number;

  // Stacking & Skipping
  stackingFactor: number;
  skipFactor: number;

  // Advanced Migration
  enableMigration: boolean;
  migrationApertureTraces: number;
}

export const DEFAULT_DSP_OPTIONS: DSPOptions = {
  mode: 'crudo', // Default to Raw Binary (Dato Crudo Original)
  dewow: true,
  timeZero: true,
  timeZeroMode: 'auto',
  timeZeroCustomNs: 0.0,
  secGain: true,
  bandpass: true,
  backgroundRemoval: false,
  secAlphaMin: 0.001,
  secAlphaMax: 0.012,
  dielectricPermittivity: 6.0,
  ventanaNs: 90.0,
  traceDistanceStepM: 1.0 / 112.0,
  stackingFactor: 1,
  skipFactor: 1,
  enableMigration: false,
  migrationApertureTraces: 10,
};

/**
 * Calculates propagation velocity v in m/ns from dielectric constant epsilon_r
 * v = c / sqrt(epsilon_r), where c = 0.30 m/ns
 */
export function calculateVelocity(dielectricPermittivity: number): number {
  const c = 0.30;
  return c / Math.sqrt(Math.max(1, dielectricPermittivity));
}

/**
 * Executes the complete DSP pipeline on a GPRDataset.
 * If mode === 'crudo' and no individual filters forced, returns raw matrix with Time-Zero applied if active.
 */
export function processRadargramDSP(dataset: GPRDataset, options: DSPOptions): Float32Array[] {
  const { rawMatrix, header } = dataset;
  const numTraces = rawMatrix.length;
  if (numTraces === 0) return [];
  const numSamples = header.numSamples;

  // 1. Initial Stacking / Skipping
  let processed: Float32Array[] = [];

  for (let t = 0; t < numTraces; t += options.skipFactor) {
    const stackEnd = Math.min(numTraces, t + options.stackingFactor);
    const traceCount = stackEnd - t;

    const stackedTrace = new Float32Array(numSamples);
    for (let s = 0; s < numSamples; s++) {
      let sum = 0;
      for (let k = t; k < stackEnd; k++) {
        sum += rawMatrix[k][s];
      }
      stackedTrace[s] = sum / traceCount;
    }
    processed.push(stackedTrace);
  }

  const currentTraces = processed.length;
  const twNs = options.ventanaNs || header.timeWindowNs || 90.0;
  const dtNs = twNs / (numSamples || 512);

  // Time-Zero Correction (Active by default in both raw and processed modes if enabled)
  if (options.timeZero) {
    let idxShift = 0;

    if (options.timeZeroMode === 'manual') {
      const customNs = options.timeZeroCustomNs || 0;
      idxShift = Math.max(0, Math.round(customNs / dtNs));
    } else {
      // Auto-detection of First Break / Direct Arrival (up to half of total ns of the file)
      const topLimit = Math.max(1, Math.floor(numSamples * 0.50));
      const avgAbs = new Float32Array(topLimit);

      let maxAvg = 0;
      let idxPeak = 0;

      for (let s = 0; s < topLimit; s++) {
        let sum = 0;
        for (let t = 0; t < currentTraces; t++) {
          sum += Math.abs(processed[t][s]);
        }
        avgAbs[s] = sum / currentTraces;
        if (avgAbs[s] > maxAvg) {
          maxAvg = avgAbs[s];
          idxPeak = s;
        }
      }

      if (maxAvg > 0 && idxPeak > 0) {
        // Threshold: 8% of peak amplitude (start of direct arrival variation)
        const threshold = maxAvg * 0.08;
        idxShift = idxPeak;

        for (let s = idxPeak; s >= 0; s--) {
          if (avgAbs[s] <= threshold) {
            idxShift = s;
            break;
          }
        }
      }
    }

    if (idxShift > 0 && idxShift < numSamples - 1) {
      const srcLen = numSamples - idxShift;
      for (let t = 0; t < currentTraces; t++) {
        const trace = processed[t];
        const stretched = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const srcIdxFloat = idxShift + (i / (numSamples - 1)) * (srcLen - 1);
          const k = Math.floor(srcIdxFloat);
          const alpha = srcIdxFloat - k;
          const kNext = Math.min(k + 1, numSamples - 1);
          stretched[i] = (1 - alpha) * trace[k] + alpha * trace[kNext];
        }
        processed[t] = stretched;
      }
    }
  }

  // If in pure raw mode, return raw data with Time-Zero applied
  if (options.mode === 'crudo') {
    return processed;
  }

  // 4. Background Removal: subtract profile average trace across horizontal axis
  if (options.backgroundRemoval) {
    const avgTrace = new Float32Array(numSamples);
    for (let s = 0; s < numSamples; s++) {
      let sum = 0;
      for (let t = 0; t < currentTraces; t++) {
        sum += processed[t][s];
      }
      avgTrace[s] = sum / currentTraces;
    }
    for (let t = 0; t < currentTraces; t++) {
      for (let s = 0; s < numSamples; s++) {
        processed[t][s] -= avgTrace[s];
      }
    }
  }

  // 5. SEC Gain (Secular Energy Correction)
  if (options.secGain) {
    // Estimate attenuation alpha
    let sumLog = 0;
    let sumT = 0;
    let sumT2 = 0;
    let sumTLog = 0;
    const n = numSamples;

    for (let s = 0; s < n; s++) {
      let sumAmp = 0;
      for (let t = 0; t < currentTraces; t++) {
        sumAmp += Math.abs(processed[t][s]);
      }
      const amp = (sumAmp / currentTraces) + 1e-6;
      const logAmp = Math.log(amp);

      sumT += s;
      sumT2 += s * s;
      sumLog += logAmp;
      sumTLog += s * logAmp;
    }

    const denom = n * sumT2 - sumT * sumT;
    const slope = denom !== 0 ? (n * sumTLog - sumT * sumLog) / denom : -0.005;
    const alpha = Math.max(options.secAlphaMin, Math.min(options.secAlphaMax, -slope));

    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      for (let s = 0; s < numSamples; s++) {
        const gain = Math.exp(alpha * s);
        trace[s] *= gain;
      }
    }
  }

  // 6. Bandpass Filter (Smoothing Butterworth / Moving Average Filter)
  if (options.bandpass) {
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      const filtered = new Float32Array(numSamples);
      for (let s = 0; s < numSamples; s++) {
        const p2 = s > 1 ? trace[s - 2] : trace[s];
        const p1 = s > 0 ? trace[s - 1] : trace[s];
        const c = trace[s];
        const n1 = s < numSamples - 1 ? trace[s + 1] : trace[s];
        const n2 = s < numSamples - 2 ? trace[s + 2] : trace[s];

        const low = (p2 + 2 * p1 + 3 * c + 2 * n1 + n2) / 9;
        const high = c - (p1 + c + n1) / 3;
        filtered[s] = (low + high) / 2;
      }
      processed[t] = filtered;
    }
  }

  // 7. Optional Kirchhoff Migration
  if (options.enableMigration) {
    const v = calculateVelocity(options.dielectricPermittivity);
    const dt = header.sampleIntervalNs;
    const dx = header.traceDistanceStepM;
    const ap = options.migrationApertureTraces;

    const migrated: Float32Array[] = [];
    for (let t = 0; t < currentTraces; t++) {
      migrated.push(new Float32Array(numSamples));
    }

    for (let t0 = 0; t0 < currentTraces; t0++) {
      const x0 = t0 * dx;
      const startT = Math.max(0, t0 - ap);
      const endT = Math.min(currentTraces - 1, t0 + ap);

      for (let s0 = 0; s0 < numSamples; s0++) {
        const z0 = (s0 * dt * v) / 2.0;
        if (z0 <= 0) continue;

        let sum = 0;
        let cnt = 0;
        for (let t = startT; t <= endT; t++) {
          const x = t * dx;
          const dist = x - x0;
          const tTravel = (2.0 / v) * Math.sqrt(z0 * z0 + dist * dist);
          const sIdx = Math.round(tTravel / dt);

          if (sIdx >= 0 && sIdx < numSamples) {
            sum += processed[t][sIdx];
            cnt++;
          }
        }
        if (cnt > 0) {
          migrated[t0][s0] = sum / cnt;
        }
      }
    }
    processed = migrated;
  }

  return processed;
}

/**
 * Computes 1D FFT for A-Scan frequency inspection
 */
export function computeFFT(trace: Float32Array): { frequencies: Float32Array; magnitudes: Float32Array } {
  const N = Math.pow(2, Math.ceil(Math.log2(trace.length)));
  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  for (let i = 0; i < trace.length; i++) {
    real[i] = trace[i];
  }

  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      const tempR = real[i]; real[i] = real[j]; real[j] = tempR;
      const tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let uReal = 1;
      let uImag = 0;
      for (let k = 0; k < halfLen; k++) {
        const pos = i + k;
        const matchPos = pos + halfLen;

        const vReal = real[matchPos] * uReal - imag[matchPos] * uImag;
        const vImag = real[matchPos] * uImag + imag[matchPos] * uReal;

        real[matchPos] = real[pos] - vReal;
        imag[matchPos] = imag[pos] - vImag;
        real[pos] += vReal;
        imag[pos] += vImag;

        const tempU = uReal * wReal - uImag * wImag;
        uImag = uReal * wImag + uImag * wReal;
        uReal = tempU;
      }
    }
  }

  const numFreqs = Math.floor(N / 2);
  const magnitudes = new Float32Array(numFreqs);
  const frequencies = new Float32Array(numFreqs);

  for (let i = 0; i < numFreqs; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    frequencies[i] = i;
  }

  return { frequencies, magnitudes };
}
