/**
 * High-Performance Digital Signal Processing (DSP) Engine for GPR Radargrams
 * Operates on Float32Array trace matrices without mutating raw binary data.
 */

import { GPRDataset } from './gsfParser';

export interface DSPOptions {
  // Dewow
  dewow: boolean;
  dewowWindow: number; // Number of samples for mean calculation

  // Background Removal
  backgroundRemoval: boolean;
  backgroundWindow: number; // 0 = global full profile background removal, >0 = sliding trace window

  // Bandpass Filter
  filterType: 'none' | 'lowpass' | 'highpass' | 'bandpass';
  lowCutMHz: number;
  highCutMHz: number;

  // Gain Functions
  gainType: 'none' | 'linear' | 'exp' | 'agc' | 'custom';
  linearGain: number;       // Linear gain factor
  expGainAlpha: number;     // Exponential gain rate
  expGainPower: number;     // Power parameter (e.g. 1.0 or 2.0)
  agcWindowSamples: number; // AGC sliding window size in samples
  customGainCurve: number[];// Array of gain values (0.0 to 10.0) sampled along depth

  // Hilbert Transform (Envelope)
  hilbertEnvelope: boolean;

  // Geometry & Alignment
  zeroTimeShiftNs: number;  // Global zero-time shift in ns
  stackingFactor: number;   // 1 = no stacking, 2 = 2x average, etc.
  skipFactor: number;       // 1 = keep all, 2 = keep every 2nd trace

  // Migration & Velocity
  dielectricPermittivity: number; // Epsilon_r (default 9.0)
  enableMigration: boolean;
  migrationApertureTraces: number;
}

export const DEFAULT_DSP_OPTIONS: DSPOptions = {
  dewow: true,
  dewowWindow: 32,
  backgroundRemoval: false,
  backgroundWindow: 0,
  filterType: 'none',
  lowCutMHz: 100,
  highCutMHz: 800,
  gainType: 'none',
  linearGain: 1.0,
  expGainAlpha: 0.05,
  expGainPower: 1.0,
  agcWindowSamples: 64,
  customGainCurve: [1, 1, 1, 1, 1],
  hilbertEnvelope: false,
  zeroTimeShiftNs: 0,
  stackingFactor: 1,
  skipFactor: 1,
  dielectricPermittivity: 9.0,
  enableMigration: false,
  migrationApertureTraces: 10,
};

/**
 * Calculates propagation velocity v in m/ns from dielectric constant epsilon_r
 * v = c / sqrt(epsilon_r), where c ~ 0.29979 m/ns
 */
export function calculateVelocity(dielectricPermittivity: number): number {
  const c = 0.299792458; // Speed of light in m/ns
  return c / Math.sqrt(Math.max(1, dielectricPermittivity));
}

/**
 * Calculates dielectric constant from velocity v (m/ns)
 */
export function calculateDielectric(velocityMPerNs: number): number {
  const c = 0.299792458;
  if (velocityMPerNs <= 0) return 1.0;
  return Math.pow(c / velocityMPerNs, 2);
}

/**
 * Executes the complete DSP pipeline on a GPRDataset.
 * Returns a new processed Float32Array[] trace matrix.
 */
export function processRadargramDSP(dataset: GPRDataset, options: DSPOptions): Float32Array[] {
  const { rawMatrix, header } = dataset;
  const numTraces = rawMatrix.length;
  if (numTraces === 0) return [];
  const numSamples = header.numSamples;

  // 1. Initial Clone & Stacking/Skipping
  let processed: Float32Array[] = [];
  
  // Stacking & Skipping
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

  // 2. Zero-Time Shift Correction (Static Correction)
  if (options.zeroTimeShiftNs !== 0 && header.sampleIntervalNs > 0) {
    const sampleShift = Math.round(options.zeroTimeShiftNs / header.sampleIntervalNs);
    if (sampleShift !== 0) {
      for (let t = 0; t < currentTraces; t++) {
        const shifted = new Float32Array(numSamples);
        for (let s = 0; s < numSamples; s++) {
          const srcIdx = s - sampleShift;
          if (srcIdx >= 0 && srcIdx < numSamples) {
            shifted[s] = processed[t][srcIdx];
          } else {
            shifted[s] = 0;
          }
        }
        processed[t] = shifted;
      }
    }
  }

  // 3. Dewow Filter (Baseline Low-Frequency Shift Removal)
  if (options.dewow) {
    const window = Math.min(numSamples, Math.max(4, options.dewowWindow));
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      // Compute mean of early window or cumulative mean
      let sum = 0;
      for (let s = 0; s < window; s++) {
        sum += trace[s];
      }
      const dewowBias = sum / window;
      for (let s = 0; s < numSamples; s++) {
        trace[s] -= dewowBias;
      }
    }
  }

  // 4. Background Removal (Spatial Clutter Reduction)
  if (options.backgroundRemoval) {
    if (options.backgroundWindow === 0) {
      // Global average trace subtraction
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
    } else {
      // Sliding window background removal
      const win = Math.max(2, options.backgroundWindow);
      const halfWin = Math.floor(win / 2);
      for (let t = 0; t < currentTraces; t++) {
        const tStart = Math.max(0, t - halfWin);
        const tEnd = Math.min(currentTraces, t + halfWin + 1);
        const count = tEnd - tStart;
        for (let s = 0; s < numSamples; s++) {
          let sum = 0;
          for (let k = tStart; k < tEnd; k++) {
            sum += processed[k][s];
          }
          processed[t][s] -= sum / count;
        }
      }
    }
  }

  // 5. Digital Frequency Filtering (Bandpass / Lowpass / Highpass)
  if (options.filterType !== 'none') {
    for (let t = 0; t < currentTraces; t++) {
      processed[t] = applyFrequencyFilter(processed[t], options);
    }
  }

  // 6. Gain Adjustments
  if (options.gainType === 'linear') {
    const gainFactor = options.linearGain;
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      for (let s = 0; s < numSamples; s++) {
        const timeScale = 1 + (s / numSamples) * gainFactor;
        trace[s] *= timeScale;
      }
    }
  } else if (options.gainType === 'exp') {
    const alpha = options.expGainAlpha;
    const power = options.expGainPower;
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      for (let s = 0; s < numSamples; s++) {
        const tNs = s * header.sampleIntervalNs;
        const gain = Math.pow(tNs, power) * Math.exp(alpha * tNs);
        trace[s] *= Math.min(100, Math.max(1, gain));
      }
    }
  } else if (options.gainType === 'agc') {
    const halfWin = Math.max(2, Math.floor(options.agcWindowSamples / 2));
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      const copy = new Float32Array(trace);
      for (let s = 0; s < numSamples; s++) {
        const sStart = Math.max(0, s - halfWin);
        const sEnd = Math.min(numSamples, s + halfWin + 1);
        let sumSq = 0;
        let cnt = 0;
        for (let k = sStart; k < sEnd; k++) {
          sumSq += copy[k] * copy[k];
          cnt++;
        }
        const rms = Math.sqrt(sumSq / cnt);
        if (rms > 1e-6) {
          trace[s] = copy[s] / rms;
        }
      }
    }
  } else if (options.gainType === 'custom' && options.customGainCurve.length > 1) {
    const curve = options.customGainCurve;
    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      for (let s = 0; s < numSamples; s++) {
        const normDepth = s / (numSamples - 1);
        const gainVal = interpolateCurve(curve, normDepth);
        trace[s] *= gainVal;
      }
    }
  }

  // 7. Hilbert Transform (Instantaneous Amplitude / Envelope)
  if (options.hilbertEnvelope) {
    for (let t = 0; t < currentTraces; t++) {
      processed[t] = computeHilbertEnvelope(processed[t]);
    }
  }

  // 8. Kirchhoff Migration (Hyperbola collapse)
  if (options.enableMigration) {
    const v = calculateVelocity(options.dielectricPermittivity);
    processed = performKirchhoffMigration(processed, header.sampleIntervalNs, header.traceDistanceStepM, v, options.migrationApertureTraces);
  }

  return processed;
}

/**
 * Piecewise linear curve interpolation for custom gain
 */
function interpolateCurve(points: number[], position: number): number {
  if (points.length === 0) return 1.0;
  if (points.length === 1) return points[0];
  const clampedPos = Math.max(0, Math.min(1, position));
  const segmentLength = 1 / (points.length - 1);
  const idx = Math.min(points.length - 2, Math.floor(clampedPos / segmentLength));
  const t = (clampedPos - idx * segmentLength) / segmentLength;
  return points[idx] * (1 - t) + points[idx + 1] * t;
}

/**
 * Digital Bandpass/Lowpass/Highpass filter using a smoothed moving FIR window
 */
function applyFrequencyFilter(trace: Float32Array, options: DSPOptions): Float32Array {
  const n = trace.length;
  const filtered = new Float32Array(n);

  // 5-tap moving average / highpass FIR implementation
  for (let i = 0; i < n; i++) {
    const prev2 = i > 1 ? trace[i - 2] : trace[i];
    const prev1 = i > 0 ? trace[i - 1] : trace[i];
    const curr = trace[i];
    const next1 = i < n - 1 ? trace[i + 1] : trace[i];
    const next2 = i < n - 2 ? trace[i + 2] : trace[i];

    if (options.filterType === 'lowpass') {
      filtered[i] = (prev2 + 2 * prev1 + 3 * curr + 2 * next1 + next2) / 9;
    } else if (options.filterType === 'highpass') {
      const low = (prev2 + 2 * prev1 + 3 * curr + 2 * next1 + next2) / 9;
      filtered[i] = curr - low;
    } else if (options.filterType === 'bandpass') {
      const low = (prev2 + 2 * prev1 + 3 * curr + 2 * next1 + next2) / 9;
      const high = curr - (prev1 + curr + next1) / 3;
      filtered[i] = (low + high) / 2;
    } else {
      filtered[i] = curr;
    }
  }

  return filtered;
}

/**
 * Computes Instantaneous Amplitude (Envelope) using Hilbert Transform approximation.
 */
export function computeHilbertEnvelope(trace: Float32Array): Float32Array {
  const n = trace.length;
  const envelope = new Float32Array(n);

  // Quadrature phase shift via discrete Hilbert transform filter
  for (let i = 0; i < n; i++) {
    let q = 0;
    for (let k = 1; k <= 15; k++) {
      if ((k % 2) !== 0) {
        const left = i - k >= 0 ? trace[i - k] : 0;
        const right = i + k < n ? trace[i + k] : 0;
        q += (right - left) / (Math.PI * k);
      }
    }
    const real = trace[i];
    envelope[i] = Math.sqrt(real * real + q * q);
  }

  return envelope;
}

/**
 * Cooley-Tukey Radix-2 1D FFT implementation for spectral inspection
 */
export function computeFFT(trace: Float32Array): { frequencies: Float32Array; magnitudes: Float32Array } {
  const N = Math.pow(2, Math.ceil(Math.log2(trace.length)));
  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  for (let i = 0; i < trace.length; i++) {
    real[i] = trace[i];
  }

  // Bit reversal permutation
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

  // FFT Computation
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
    frequencies[i] = i; // Normalized bin frequency
  }

  return { frequencies, magnitudes };
}

/**
 * Performs 2D Kirchhoff Migration to collapse hyperbolic diffraction patterns.
 */
function performKirchhoffMigration(
  matrix: Float32Array[],
  dtNs: number,
  dxM: number,
  vMPerNs: number,
  apertureTraces: number
): Float32Array[] {
  const numTraces = matrix.length;
  if (numTraces === 0) return matrix;
  const numSamples = matrix[0].length;

  const migrated: Float32Array[] = [];
  for (let t = 0; t < numTraces; t++) {
    migrated.push(new Float32Array(numSamples));
  }

  for (let t0 = 0; t0 < numTraces; t0++) {
    const x0 = t0 * dxM;
    const startT = Math.max(0, t0 - apertureTraces);
    const endT = Math.min(numTraces - 1, t0 + apertureTraces);

    for (let s0 = 0; s0 < numSamples; s0++) {
      const z0 = (s0 * dtNs * vMPerNs) / 2.0; // Depth in meters
      if (z0 <= 0) continue;

      let sum = 0;
      let count = 0;

      for (let t = startT; t <= endT; t++) {
        const x = t * dxM;
        const dx = x - x0;
        // Hyperbolic travel time t = (2 / v) * sqrt(z0^2 + dx^2)
        const tTravelNs = (2.0 / vMPerNs) * Math.sqrt(z0 * z0 + dx * dx);
        const sIdx = Math.round(tTravelNs / dtNs);

        if (sIdx >= 0 && sIdx < numSamples) {
          sum += matrix[t][sIdx];
          count++;
        }
      }

      if (count > 0) {
        migrated[t0][s0] = sum / count;
      }
    }
  }

  return migrated;
}
