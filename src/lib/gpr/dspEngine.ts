/**
 * High-Performance Digital Signal Processing (DSP) Engine for GPR Radargrams
 * Faithfully matches the Python reference implementation for Geoscanners Akula9000C / GPRSoft:
 * 1. Time-Zero Correction (Pulse + 2% TWT margin + variation > 1000)
 * 2. Dewow Filter (DC baseline removal with configurable time window in ns)
 * 3. IIR Profile Bandpass Filter (10dB attenuation, HP & LP in MHz)
 * 4. Background Removal (Configurable trace percentage, default 10%)
 * 5. Multi-Mode Gain Functions (Auto SEC, Linear, Logarithmic, Power, Custom multi-point curve 10-80 dB)
 * 6. Velocity Analysis & Kirchhoff Migration
 */

import { GPRDataset } from './gsfParser';

export interface GainPoint {
  timeNs: number;
  gainDb: number;
}

export interface DSPOptions {
  // Mode: Raw Binary vs Processed DSP
  mode: 'crudo' | 'procesado';

  // 1. Dewow Filter
  dewow: boolean;
  dewowWindowNs: number; // Default 5.0 ns

  // 2. Time-Zero Correction
  timeZero: boolean;
  timeZeroMode: 'auto' | 'manual';
  timeZeroCustomNs: number; // Manual offset in ns when mode is 'manual'
  timeZeroMarginNs?: number;

  // 3. IIR Profile Bandpass Filter
  bandpass: boolean;
  filterAttenuationDb: number; // Default 10 dB attenuation
  hpCutoffMHz: number; // High-pass cutoff in MHz (e.g. 100 MHz)
  lpCutoffMHz: number; // Low-pass cutoff in MHz (e.g. 800 MHz)

  // 4. Background Removal
  backgroundRemoval: boolean;
  bkgRemovalPercent: number; // Default 10% of profile traces

  // 5. Gain Functions
  secGain: boolean;
  gainMode: 'auto' | 'linear' | 'logarithmic' | 'power' | 'custom' | 'agc';
  maxGainDb: number; // Max gain 10 dB to 80 dB (default 40 dB)
  customGainPoints: GainPoint[];

  // 6. Velocity Analysis & Parameters
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

  // Antenna Central Frequency (Standard: 200, 400, 500 MHz)
  antennaFreqMHz?: number;
}

export const DEFAULT_DSP_OPTIONS: DSPOptions = {
  mode: 'crudo', // Predeterminado: Dato Crudo Original (Binario Original)
  dewow: true,
  dewowWindowNs: 2.0,
  timeZero: true,
  timeZeroMode: 'auto',
  timeZeroCustomNs: 0.0,
  timeZeroMarginNs: undefined,
  bandpass: true,
  filterAttenuationDb: 10.0,
  hpCutoffMHz: 200.0,
  lpCutoffMHz: 800.0,
  backgroundRemoval: true, // Encendido por defecto
  bkgRemovalPercent: 10.0,
  secGain: true,
  gainMode: 'auto',
  maxGainDb: 40.0,
  customGainPoints: [
    { timeNs: 0.0, gainDb: 0.0 },
    { timeNs: 22.5, gainDb: 15.0 },
    { timeNs: 45.0, gainDb: 28.0 },
    { timeNs: 67.5, gainDb: 35.0 },
    { timeNs: 90.0, gainDb: 40.0 },
  ],
  secAlphaMin: 0.001,
  secAlphaMax: 0.012,
  dielectricPermittivity: 6.0,
  ventanaNs: 90.0,
  traceDistanceStepM: 1.0 / 112.0,
  stackingFactor: 1,
  skipFactor: 1,
  enableMigration: false,
  migrationApertureTraces: 10,
  antennaFreqMHz: 400,
};

/**
 * Coeficientes Biquad de 2do orden para filtrado digital IIR
 */
interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function designButterworthLowPass(wNormalized: number): BiquadCoeffs {
  const w = Math.min(0.99, Math.max(0.01, wNormalized));
  const theta = Math.PI * w;
  const Q = 1.0 / Math.SQRT2;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const alpha = sinT / (2 * Q);

  const b0 = (1 - cosT) / 2;
  const b1 = 1 - cosT;
  const b2 = (1 - cosT) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosT;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

function designButterworthHighPass(wNormalized: number): BiquadCoeffs {
  const w = Math.min(0.99, Math.max(0.01, wNormalized));
  const theta = Math.PI * w;
  const Q = 1.0 / Math.SQRT2;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const alpha = sinT / (2 * Q);

  const b0 = (1 + cosT) / 2;
  const b1 = -(1 + cosT);
  const b2 = (1 + cosT) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosT;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Filtro Biquad digital de fase cero adelante-atrás (equivalente a scipy filtfilt)
 * Elimina por completo el desfase temporal/profundo en radargramas.
 */
function applyBiquadZeroPhase(signal: Float32Array, coeffs: BiquadCoeffs): Float32Array {
  const n = signal.length;
  if (n < 6) return new Float32Array(signal);

  const { b0, b1, b2, a1, a2 } = coeffs;
  const forward = new Float32Array(n);

  const xInit = signal[0];
  let x1 = xInit, x2 = xInit;
  let y1 = xInit, y2 = xInit;

  for (let i = 0; i < n; i++) {
    const x0 = signal[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    forward[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  const result = new Float32Array(n);
  const xEnd = forward[n - 1];
  x1 = xEnd; x2 = xEnd;
  y1 = xEnd; y2 = xEnd;

  for (let i = n - 1; i >= 0; i--) {
    const x0 = forward[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    result[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return result;
}

/**
 * Calculates the free-space and medium wavelength lambda, Rayleigh vertical resolution limit (lambda / 4),
 * and suggested dependent DSP parameters (IIR cutoffs, Dewow window) based on antenna frequency:
 * - Antena 200 MHz: HP = 100 MHz, LP = 400 MHz (Dewow = 3.0 ns)
 * - Antena 400 MHz: HP = 200 MHz, LP = 800 MHz (Dewow = 2.0 ns)
 * - Antena 500 MHz: HP = 250 MHz, LP = 1000 MHz (Dewow = 2.0 ns)
 */
export function calculateResolution(freqMHz: number = 400, permittivity: number = 6.0): {
  velocityM_ns: number;
  wavelengthM: number;
  rayleighResolutionM: number;
  recommendedDewowNs: number;
  recommendedHpMHz: number;
  recommendedLpMHz: number;
} {
  const v = calculateVelocity(permittivity); // m/ns
  const fHz = freqMHz * 1e6;
  const vM_s = v * 1e9;
  const lambdaM = vM_s / fHz; // m
  const rayleighM = lambdaM / 4.0;
  // Remoción DC Dewow siempre es 2.0 o 3.0 ns según estándar geofísico de adquisición PROCIMEC
  const recommendedDewowNs = freqMHz <= 200 ? 3.0 : 2.0;
  // Cortes IIR Pasa-Banda: HP = f*0.5, LP = f*2.0
  const recommendedHpMHz = Math.round(freqMHz * 0.5);
  const recommendedLpMHz = Math.round(freqMHz * 2.0);

  return {
    velocityM_ns: v,
    wavelengthM: lambdaM,
    rayleighResolutionM: rayleighM,
    recommendedDewowNs,
    recommendedHpMHz,
    recommendedLpMHz,
  };
}

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

  // 2. Time-Zero Correction: Akula Hardware Sync Line Detection + 2% TWT Margin + Amplitude Variation > 1000
  if (options.timeZero) {
    let idxShift = 0;

    if (options.timeZeroMode === 'manual') {
      const customNs = options.timeZeroCustomNs || 0;
      idxShift = Math.max(0, Math.round(customNs / dtNs));
    } else {
      // Auto-detection: Locate Akula hardware sync pulse (abrupt white line ~24,000 amp)
      const topLimit = Math.max(1, Math.floor(numSamples * 0.60));
      const avgTrace = new Float32Array(topLimit);

      for (let s = 0; s < topLimit; s++) {
        let sum = 0;
        for (let t = 0; t < currentTraces; t++) {
          sum += processed[t][s];
        }
        avgTrace[s] = sum / currentTraces;
      }

      let maxSpikeJump = 0;
      let idxSpike = 0;

      for (let s = 1; s < topLimit - 1; s++) {
        const absVal = Math.abs(avgTrace[s]);
        const absJump = Math.abs(avgTrace[s] - avgTrace[s - 1]);
        if (absVal > 4000 && absJump > maxSpikeJump) {
          maxSpikeJump = absJump;
          idxSpike = s;
        }
      }

      if (idxSpike === 0) {
        let maxVal = 0;
        for (let s = 0; s < topLimit; s++) {
          if (Math.abs(avgTrace[s]) > maxVal) {
            maxVal = Math.abs(avgTrace[s]);
            idxSpike = s;
          }
        }
      }

      const margin2PctSamples = Math.round((0.02 * twNs) / dtNs);
      const startScanIdx = Math.min(numSamples - 15, idxSpike + margin2PctSamples);

      let idxFirstVar = startScanIdx;
      for (let s = startScanIdx; s < numSamples - 1; s++) {
        const val = Math.abs(avgTrace[s]);
        const diff = Math.abs(avgTrace[s] - avgTrace[s - 1]);
        if (val > 1000 || diff > 1000) {
          idxFirstVar = s;
          break;
        }
      }

      idxShift = Math.min(numSamples - 10, idxFirstVar);
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

  // 3. Dewow Filter (DC Offset Removal with fast O(1) sliding window accumulator)
  if (options.dewow) {
    const dewowWinSamples = Math.max(3, Math.round((options.dewowWindowNs || 2.0) / dtNs));
    const halfWin = Math.floor(dewowWinSamples / 2);

    for (let t = 0; t < currentTraces; t++) {
      const trace = processed[t];
      const dewowed = new Float32Array(numSamples);

      // Fast sliding window sum accumulator: O(N) per trace
      let winSum = 0;
      let winCount = 0;
      const initialEnd = Math.min(numSamples, halfWin + 1);
      for (let k = 0; k < initialEnd; k++) {
        winSum += trace[k];
        winCount++;
      }

      for (let s = 0; s < numSamples; s++) {
        const leftLeaving = s - halfWin - 1;
        if (leftLeaving >= 0) {
          winSum -= trace[leftLeaving];
          winCount--;
        }
        const rightEntering = s + halfWin;
        if (rightEntering < numSamples && rightEntering >= initialEnd) {
          winSum += trace[rightEntering];
          winCount++;
        }

        const mean = winCount > 0 ? winSum / winCount : 0;
        dewowed[s] = trace[s] - mean;
      }
      processed[t] = dewowed;
    }
  }

  // 4. IIR Profile Bandpass Filter (Filtro Digital Butterworth Fase Cero - Pasa-Alto & Pasa-Bajo en MHz)
  // Se aplica ANTES de la ganancia para erradicar ruido de alta/baja frecuencia sin amplificarlo
  if (options.bandpass) {
    const hpMHz = options.hpCutoffMHz || 100.0;
    const lpMHz = options.lpCutoffMHz || 800.0;
    const fNyquistMHz = dtNs > 0 ? 500.0 / dtNs : 1000.0;

    const normHp = Math.min(0.95, Math.max(0.01, hpMHz / fNyquistMHz));
    const normLp = Math.min(0.99, Math.max(normHp + 0.02, lpMHz / fNyquistMHz));

    const hpCoeffs = designButterworthHighPass(normHp);
    const lpCoeffs = designButterworthLowPass(normLp);

    for (let t = 0; t < currentTraces; t++) {
      // 1. Pasa-Alto: suprime oscilaciones residuales bajo corte HP
      const afterHp = applyBiquadZeroPhase(processed[t], hpCoeffs);
      // 2. Pasa-Bajo: suprime ruido electrónico y espigas sobre corte LP
      processed[t] = applyBiquadZeroPhase(afterHp, lpCoeffs);
    }
  }

  // 5. Background Removal: subtract horizontal moving average over configurable percentage of traces (default 10%)
  if (options.backgroundRemoval) {
    const pct = Math.max(1, Math.min(100, options.bkgRemovalPercent || 10));
    const winTraces = Math.max(1, Math.round(currentTraces * (pct / 100)));
    const halfWinT = Math.floor(winTraces / 2);

    const bkgFiltered: Float32Array[] = [];
    for (let t = 0; t < currentTraces; t++) {
      bkgFiltered.push(new Float32Array(numSamples));
    }

    for (let s = 0; s < numSamples; s++) {
      for (let t = 0; t < currentTraces; t++) {
        const startT = Math.max(0, t - halfWinT);
        const endT = Math.min(currentTraces, t + halfWinT + 1);
        let sum = 0;
        for (let k = startT; k < endT; k++) {
          sum += processed[k][s];
        }
        const avgVal = sum / (endT - startT);
        bkgFiltered[t][s] = processed[t][s] - avgVal;
      }
    }
    processed = bkgFiltered;
  }

  // 6. Gain Functions (Auto SEC, Linear, Logarithmic, Power, AGC, Custom Multi-point 10 to 80 dB)
  if (options.secGain) {
    const maxDb = Math.max(10, Math.min(80, options.maxGainDb || 40.0));
    const maxGainFactor = Math.pow(10, maxDb / 20.0);
    const gainMode = options.gainMode || 'auto';

    if (gainMode === 'agc') {
      // Automatic Gain Control (AGC) over sliding gate window (standard geophysics)
      const agcWindowNs = 12.0;
      const halfGate = Math.max(3, Math.round((agcWindowNs / dtNs) / 2));
      const targetRms = 2500.0;

      for (let t = 0; t < currentTraces; t++) {
        const trace = processed[t];
        const gainTrace = new Float32Array(numSamples);

        for (let s = 0; s < numSamples; s++) {
          const start = Math.max(0, s - halfGate);
          const end = Math.min(numSamples, s + halfGate + 1);
          let sumSq = 0;
          for (let k = start; k < end; k++) {
            sumSq += trace[k] * trace[k];
          }
          const rms = Math.sqrt(sumSq / (end - start)) + 1e-4;
          const factor = Math.min(maxGainFactor, Math.max(0.1, targetRms / rms));
          gainTrace[s] = trace[s] * factor;
        }
        processed[t] = gainTrace;
      }
    } else {
      const gainCurve = new Float32Array(numSamples);

      if (gainMode === 'auto') {
        // Estimate attenuation alpha for SEC
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
          const amp = sumAmp / currentTraces + 1e-6;
          const logAmp = Math.log(amp);

          sumT += s;
          sumT2 += s * s;
          sumLog += logAmp;
          sumTLog += s * logAmp;
        }

        const denom = n * sumT2 - sumT * sumT;
        const slope = denom !== 0 ? (n * sumTLog - sumT * sumLog) / denom : -0.005;
        const alpha = Math.max(options.secAlphaMin, Math.min(options.secAlphaMax, -slope));

        for (let s = 0; s < numSamples; s++) {
          const rawGain = Math.exp(alpha * s);
          // Scale so max gain equals maxGainFactor
          gainCurve[s] = Math.min(maxGainFactor, rawGain);
        }
      } else if (gainMode === 'linear') {
        for (let s = 0; s < numSamples; s++) {
          const frac = s / Math.max(1, numSamples - 1);
          gainCurve[s] = 1.0 + (maxGainFactor - 1.0) * frac;
        }
      } else if (gainMode === 'logarithmic') {
        for (let s = 0; s < numSamples; s++) {
          const frac = s / Math.max(1, numSamples - 1);
          gainCurve[s] = 1.0 + (maxGainFactor - 1.0) * (Math.log(1.0 + 9.0 * frac) / Math.LN10);
        }
      } else if (gainMode === 'power') {
        for (let s = 0; s < numSamples; s++) {
          const frac = s / Math.max(1, numSamples - 1);
          gainCurve[s] = 1.0 + (maxGainFactor - 1.0) * Math.pow(frac, 2);
        }
      } else if (gainMode === 'custom' && options.customGainPoints && options.customGainPoints.length > 0) {
        // Custom multi-point gain curve interpolation
        const sortedPoints = [...options.customGainPoints].sort((a, b) => a.timeNs - b.timeNs);
        for (let s = 0; s < numSamples; s++) {
          const tNs = s * dtNs;
          let interpDb = sortedPoints[0].gainDb;

          if (tNs <= sortedPoints[0].timeNs) {
            interpDb = sortedPoints[0].gainDb;
          } else if (tNs >= sortedPoints[sortedPoints.length - 1].timeNs) {
            interpDb = sortedPoints[sortedPoints.length - 1].gainDb;
          } else {
            for (let p = 0; p < sortedPoints.length - 1; p++) {
              if (tNs >= sortedPoints[p].timeNs && tNs <= sortedPoints[p + 1].timeNs) {
                const span = sortedPoints[p + 1].timeNs - sortedPoints[p].timeNs;
                const alpha = span > 0 ? (tNs - sortedPoints[p].timeNs) / span : 0;
                interpDb = (1 - alpha) * sortedPoints[p].gainDb + alpha * sortedPoints[p + 1].gainDb;
                break;
              }
            }
          }
          gainCurve[s] = Math.pow(10, interpDb / 20.0);
        }
      }

      for (let t = 0; t < currentTraces; t++) {
        const trace = processed[t];
        for (let s = 0; s < numSamples; s++) {
          trace[s] *= gainCurve[s];
        }
      }
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

export interface GPRMacro {
  id: string;
  name: string;
  description: string;
  options: DSPOptions;
}

export const BUILTIN_MACROS: GPRMacro[] = [
  {
    id: 'macro-standard',
    name: 'Standard Geoscanners',
    description: 'Dewow 2ns + Pasa-Banda 100–800MHz + Ganancia SEC Auto 40dB',
    options: {
      mode: 'procesado',
      dewow: true,
      dewowWindowNs: 2.0,
      timeZero: true,
      timeZeroMode: 'auto',
      timeZeroCustomNs: 0,
      bandpass: true,
      filterAttenuationDb: 10,
      hpCutoffMHz: 100,
      lpCutoffMHz: 800,
      backgroundRemoval: false,
      bkgRemovalPercent: 10,
      secGain: true,
      gainMode: 'auto',
      maxGainDb: 40,
      customGainPoints: [],
      secAlphaMin: 0.001,
      secAlphaMax: 0.012,
      dielectricPermittivity: 6.0,
      ventanaNs: 90.0,
      traceDistanceStepM: 1.0 / 112.0,
      stackingFactor: 1,
      skipFactor: 1,
      enableMigration: false,
      migrationApertureTraces: 10,
    },
  },
  {
    id: 'macro-concrete',
    name: 'Hormigón & Puentes',
    description: 'Dewow 2ns + Pasa-Banda 200–800MHz + Bkg Removal 10% + SEC 40dB (εr=6.0)',
    options: {
      mode: 'procesado',
      dewow: true,
      dewowWindowNs: 2.0,
      timeZero: true,
      timeZeroMode: 'auto',
      timeZeroCustomNs: 0,
      bandpass: true,
      filterAttenuationDb: 10,
      hpCutoffMHz: 200,
      lpCutoffMHz: 800,
      backgroundRemoval: true,
      bkgRemovalPercent: 10,
      secGain: true,
      gainMode: 'auto',
      maxGainDb: 40,
      customGainPoints: [],
      secAlphaMin: 0.001,
      secAlphaMax: 0.012,
      dielectricPermittivity: 6.0,
      ventanaNs: 90.0,
      traceDistanceStepM: 1.0 / 112.0,
      stackingFactor: 1,
      skipFactor: 1,
      enableMigration: false,
      migrationApertureTraces: 10,
    },
  },
  {
    id: 'macro-pavement',
    name: 'Vías & Pavimentos / Asfalto',
    description: 'Dewow 2ns + Pasa-Banda 250–1000MHz + Bkg Removal 15% + Log 45dB (εr=5.0)',
    options: {
      mode: 'procesado',
      dewow: true,
      dewowWindowNs: 2.0,
      timeZero: true,
      timeZeroMode: 'auto',
      timeZeroCustomNs: 0,
      bandpass: true,
      filterAttenuationDb: 10,
      hpCutoffMHz: 250,
      lpCutoffMHz: 1000,
      backgroundRemoval: true,
      bkgRemovalPercent: 15,
      secGain: true,
      gainMode: 'logarithmic',
      maxGainDb: 45,
      customGainPoints: [],
      secAlphaMin: 0.001,
      secAlphaMax: 0.012,
      dielectricPermittivity: 5.0,
      ventanaNs: 90.0,
      traceDistanceStepM: 1.0 / 112.0,
      stackingFactor: 1,
      skipFactor: 1,
      enableMigration: false,
      migrationApertureTraces: 10,
    },
  },
  {
    id: 'macro-utilities',
    name: 'Tuberías & Servicios Subterráneos',
    description: 'Dewow 3ns + Pasa-Banda 100–400MHz + Bkg Removal 8% + SEC 50dB (εr=9.0)',
    options: {
      mode: 'procesado',
      dewow: true,
      dewowWindowNs: 3.0,
      timeZero: true,
      timeZeroMode: 'auto',
      timeZeroCustomNs: 0,
      bandpass: true,
      filterAttenuationDb: 10,
      hpCutoffMHz: 100,
      lpCutoffMHz: 400,
      backgroundRemoval: true,
      bkgRemovalPercent: 8,
      secGain: true,
      gainMode: 'auto',
      maxGainDb: 50,
      customGainPoints: [],
      secAlphaMin: 0.001,
      secAlphaMax: 0.012,
      dielectricPermittivity: 9.0,
      ventanaNs: 90.0,
      traceDistanceStepM: 1.0 / 112.0,
      stackingFactor: 1,
      skipFactor: 1,
      enableMigration: false,
      migrationApertureTraces: 10,
    },
  },
  {
    id: 'macro-voids',
    name: 'Oquedades & Cavidades Críticas',
    description: 'Dewow 3ns + Pasa-Banda 80–450MHz + Bkg Removal 12% + Power 45dB (εr=4.5)',
    options: {
      mode: 'procesado',
      dewow: true,
      dewowWindowNs: 3.0,
      timeZero: true,
      timeZeroMode: 'auto',
      timeZeroCustomNs: 0,
      bandpass: true,
      filterAttenuationDb: 10,
      hpCutoffMHz: 80,
      lpCutoffMHz: 450,
      backgroundRemoval: true,
      bkgRemovalPercent: 12,
      secGain: true,
      gainMode: 'power',
      maxGainDb: 45,
      customGainPoints: [],
      secAlphaMin: 0.001,
      secAlphaMax: 0.012,
      dielectricPermittivity: 4.5,
      ventanaNs: 90.0,
      traceDistanceStepM: 1.0 / 112.0,
      stackingFactor: 1,
      skipFactor: 1,
      enableMigration: false,
      migrationApertureTraces: 10,
    },
  },
];
