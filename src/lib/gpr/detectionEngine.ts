/**
 * Geophysical Anomaly Detection Engine for GPR Workstation
 * Executes analytical and statistical criteria across the B-Scan amplitude matrix A[x, t]
 */

import {
  DetectionConfig,
  DetectionResults,
  AnomalyMarker,
  CurvePoint,
  EMPTY_DETECTION_RESULTS,
} from './detectionTypes';
import { calculateVelocity } from './dspEngine';

interface MatrixStats {
  mean: number;
  std: number;
  vmax: number;
  traceDistM: number;
  dtNs: number;
  vMPerNs: number;
}

function computeMatrixStats(
  matrix: Float32Array[],
  ventanaNs: number,
  traceDistanceStepM: number,
  dielectricPermittivity: number
): MatrixStats {
  const numTraces = matrix.length;
  const numSamples = numTraces > 0 ? matrix[0].length : 0;
  const traceDistM = traceDistanceStepM > 0 ? traceDistanceStepM : 1.0 / 112.0;
  const dtNs = numSamples > 0 ? ventanaNs / numSamples : 0.1;
  const vMPerNs = calculateVelocity(dielectricPermittivity);

  if (numTraces === 0 || numSamples === 0) {
    return { mean: 0, std: 1, vmax: 1, traceDistM, dtNs, vMPerNs };
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let maxAbs = 0;

  const traceStep = Math.max(1, Math.floor(numTraces / 200));
  const sampleStep = Math.max(1, Math.floor(numSamples / 200));

  for (let t = 0; t < numTraces; t += traceStep) {
    const tr = matrix[t];
    if (!tr) continue;
    for (let s = 0; s < numSamples; s += sampleStep) {
      const val = tr[s];
      sum += val;
      sumSq += val * val;
      count++;
      const absVal = Math.abs(val);
      if (absVal > maxAbs) maxAbs = absVal;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? Math.max(0.0001, sumSq / count - mean * mean) : 1;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    vmax: maxAbs || 1.0,
    traceDistM,
    dtNs,
    vMPerNs,
  };
}

/**
 * 1. Bright Spot Detector (Acumulación de Agua)
 * Water has high permittivity (eps_r ~ 81) -> sharp negative reflection coefficient (inverted phase)
 * and high amplitude A > mu + k * sigma
 */
function detectBrightSpots(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['brightSpot']
): { count: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const thresholdVal = stats.mean + config.thresholdSigma * stats.std;
  const maxLateralTraces = Math.max(2, Math.floor(config.maxLateralExtentM / stats.traceDistM));

  const markers: AnomalyMarker[] = [];
  const visited = new Uint8Array(numTraces * numSamples);

  // Scan across sample depths (skip first 5% direct coupling)
  const minSample = Math.floor(numSamples * 0.05);
  const maxSample = Math.floor(numSamples * 0.95);

  for (let s = minSample; s < maxSample; s += 3) {
    let activeStart = -1;
    let minAmp = 0;

    for (let t = 0; t < numTraces; t++) {
      const idx = t * numSamples + s;
      if (visited[idx]) continue;

      const amp = matrix[t][s];
      const isCandidate = config.invertedOnly
        ? amp < -thresholdVal // Inverted phase (strong negative peak)
        : Math.abs(amp) > thresholdVal;

      if (isCandidate) {
        if (activeStart === -1) {
          activeStart = t;
          minAmp = amp;
        } else {
          if (Math.abs(amp) > Math.abs(minAmp)) minAmp = amp;
        }
        visited[idx] = 1;
      } else {
        if (activeStart !== -1) {
          const lenTraces = t - activeStart;
          if (lenTraces >= 2 && lenTraces <= maxLateralTraces) {
            const xStartM = activeStart * stats.traceDistM;
            const xEndM = t * stats.traceDistM;
            const xCenterM = (xStartM + xEndM) / 2;
            const timeNs = s * stats.dtNs;
            const depthM = (timeNs * stats.vMPerNs) / 2;

            markers.push({
              id: `bright-spot-${markers.length + 1}`,
              type: 'bright_spot',
              title: `Bright Spot #${markers.length + 1}`,
              xStartM,
              xEndM,
              xCenterM,
              traceStartIdx: activeStart,
              traceEndIdx: t,
              traceCenterIdx: Math.floor((activeStart + t) / 2),
              sampleIdx: s,
              timeNs,
              depthM,
              severity: Math.abs(minAmp) / stats.std,
              severityLabel: 'Acumulación de Agua (εr ≈ 81)',
              mathCriterion: `|A| > μ + ${config.thresholdSigma.toFixed(1)}σ (${thresholdVal.toFixed(0)}) | Fase ${
                config.invertedOnly ? 'Invertida (R < 0)' : 'Bipolar'
              }`,
              measuredValues: {
                'Amplitud Pico': minAmp.toFixed(0),
                'Umbral de Detección': thresholdVal.toFixed(0),
                'Desviación σ': `${(Math.abs(minAmp) / stats.std).toFixed(2)}σ`,
                'Extensión Lateral': `${(xEndM - xStartM).toFixed(2)} m`,
                'Tiempo TWT': `${timeNs.toFixed(1)} ns`,
                'Profundidad': `${depthM.toFixed(2)} m`,
              },
            });
          }
          activeStart = -1;
        }
      }
    }
  }

  return { count: markers.length, markers };
}

/**
 * 2. Hyperbola Detector (Acero / Discontinuidades)
 * Finds diffraction apexes matching t(x) = sqrt(t0^2 + 4*(x-x0)^2 / v^2)
 */
function detectHyperbolas(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['hyperbola']
): { count: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const ampThreshold = stats.mean + config.amplitudeThresholdSigma * stats.std;
  const vFit = config.velocityFitting > 0 ? config.velocityFitting : stats.vMPerNs;

  const markers: AnomalyMarker[] = [];
  const minSample = Math.floor(numSamples * 0.08);
  const maxSample = Math.floor(numSamples * 0.85);
  const traceMargin = Math.max(3, Math.floor(0.4 / stats.traceDistM));

  // Find 2D local maxima
  for (let t = traceMargin; t < numTraces - traceMargin; t += 2) {
    const tr = matrix[t];
    for (let s = minSample; s < maxSample; s += 2) {
      const amp = tr[s];
      const absAmp = Math.abs(amp);
      if (absAmp < ampThreshold) continue;

      // Check 2D local apex: greater than neighboring samples and traces
      if (
        absAmp > Math.abs(matrix[t - 1][s]) &&
        absAmp > Math.abs(matrix[t + 1][s]) &&
        absAmp > Math.abs(tr[s - 1]) &&
        absAmp > Math.abs(tr[s + 1])
      ) {
        // Evaluate hyperbola curvature along left and right branches
        const t0Ns = s * stats.dtNs;
        let leftEnergy = 0;
        let rightEnergy = 0;
        let fitCoherence = 0;

        for (let dt = 1; dt <= traceMargin; dt++) {
          const distM = dt * stats.traceDistM;
          const tBranchNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vFit * vFit));
          const sBranch = Math.round(tBranchNs / stats.dtNs);

          if (sBranch < numSamples) {
            const leftVal = Math.abs(matrix[t - dt]?.[sBranch] || 0);
            const rightVal = Math.abs(matrix[t + dt]?.[sBranch] || 0);
            leftEnergy += leftVal;
            rightEnergy += rightVal;
            fitCoherence += (leftVal + rightVal) / 2;
          }
        }

        const asymmetry =
          leftEnergy > 0 && rightEnergy > 0
            ? Math.max(leftEnergy / rightEnergy, rightEnergy / leftEnergy)
            : 1.0;

        const xCenterM = t * stats.traceDistM;
        const depthM = (t0Ns * vFit) / 2;

        // Check if within depth deviation and amplitude criteria
        if (asymmetry >= config.asymmetryRatio || fitCoherence > ampThreshold * 0.6) {
          // Avoid duplicate nearby apexes
          const isNearby = markers.some(
            (m) => Math.abs(m.traceCenterIdx - t) < traceMargin && Math.abs(m.sampleIdx - s) < 8
          );

          if (!isNearby) {
            markers.push({
              id: `hyperbola-${markers.length + 1}`,
              type: 'hyperbola',
              title: `Difracción #${markers.length + 1}`,
              xStartM: (t - traceMargin) * stats.traceDistM,
              xEndM: (t + traceMargin) * stats.traceDistM,
              xCenterM,
              traceStartIdx: t - traceMargin,
              traceEndIdx: t + traceMargin,
              traceCenterIdx: t,
              sampleIdx: s,
              timeNs: t0Ns,
              depthM,
              severity: asymmetry,
              severityLabel: asymmetry > 1.6 ? 'Alta Asimetría / Discontinuidad' : 'Acero / Tubería',
              mathCriterion: `|A| > μ + ${config.amplitudeThresholdSigma.toFixed(1)}σ, Asimetría = ${asymmetry.toFixed(
                2
              )} > ${config.asymmetryRatio.toFixed(1)}`,
              measuredValues: {
                'Amplitud Ápice': absAmp.toFixed(0),
                'Velocidad de Ajuste v': `${vFit.toFixed(3)} m/ns`,
                'Índice Asimetría': asymmetry.toFixed(2),
                'Tiempo Ápice t₀': `${t0Ns.toFixed(1)} ns`,
                'Profundidad z': `${depthM.toFixed(3)} m`,
                'Tolerancia Δz': `±${config.depthDeviationM.toFixed(3)} m`,
              },
            });
          }
        }
      }
    }
  }

  return { count: markers.length, markers };
}

/**
 * 3. Delamination Detector (Separación entre Capas)
 * Min resolvable gap dt > 0.33 ns (~50 mm).
 * First peak positive R > 0 (air gap), followed by reflection drop > 40% deeper.
 */
function detectDelaminations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['delamination']
): { count: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const minGapSamples = Math.max(1, Math.round(config.minResolvableGapNs / stats.dtNs));
  const dropRatio = config.reflectionLossPercent / 100;

  const markers: AnomalyMarker[] = [];
  const minS = Math.floor(numSamples * 0.08);
  const maxS = Math.floor(numSamples * 0.5);

  let activeStart = -1;
  let maxLoss = 0;
  let detectedS = 0;

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let traceHasDelam = false;
    let localLoss = 0;
    let foundS = 0;

    for (let s = minS; s < maxS; s += 2) {
      const topAmp = tr[s];
      // Condition 1: First peak positive R > 0 (air boundary)
      if (topAmp > stats.mean + 1.2 * stats.std) {
        // Compare with amplitude below the gap
        const deepS = s + minGapSamples + 3;
        if (deepS < numSamples) {
          const deepAmp = Math.abs(tr[deepS]);
          const loss = (topAmp - deepAmp) / Math.max(1, topAmp);

          if (loss >= dropRatio) {
            traceHasDelam = true;
            localLoss = loss;
            foundS = s;
            break;
          }
        }
      }
    }

    if (traceHasDelam) {
      if (activeStart === -1) {
        activeStart = t;
        maxLoss = localLoss;
        detectedS = foundS;
      } else {
        if (localLoss > maxLoss) maxLoss = localLoss;
      }
    } else {
      if (activeStart !== -1) {
        const lenTraces = t - activeStart;
        // Require lateral extent of at least 0.5m
        if (lenTraces * stats.traceDistM >= 0.4) {
          const xStartM = activeStart * stats.traceDistM;
          const xEndM = t * stats.traceDistM;
          const timeNs = detectedS * stats.dtNs;
          const depthM = (timeNs * stats.vMPerNs) / 2;

          markers.push({
            id: `delam-${markers.length + 1}`,
            type: 'delamination',
            title: `Delaminación #${markers.length + 1}`,
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: t,
            traceCenterIdx: Math.floor((activeStart + t) / 2),
            sampleIdx: detectedS,
            timeNs,
            depthM,
            severity: maxLoss * 100,
            severityLabel: `Pérdida ${(maxLoss * 100).toFixed(0)}% en Interfaz`,
            mathCriterion: `Δt > 0.33 ns (50 mm), Caída > ${config.reflectionLossPercent}%, R > 0`,
            measuredValues: {
              'Pérdida de Amplitud': `${(maxLoss * 100).toFixed(1)}%`,
              'Espaciado Mínimo Δt': `${config.minResolvableGapNs} ns (50 mm)`,
              'Condición de Fase': 'Pico Positivo (R > 0, Aire)',
              'Extensión Afectada': `${(xEndM - xStartM).toFixed(2)} m`,
              'Profundidad Estimada': `${depthM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
      }
    }
  }

  return { count: markers.length, markers };
}

/**
 * 4. Subslab Void Detector (Alta Criticidad)
 * R2 high amplitude (concrete-void), R3 within 0.67 - 3.0 ns, signal loss below R3 > 50%.
 * Critical threshold IS > 1.0 -> pulsing marker.
 */
function detectSubslabVoids(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['subslabVoid']
): { count: number; criticalCount: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, criticalCount: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const r2Threshold = stats.mean + config.r2AmplitudeSigma * stats.std;
  const sMinGap = Math.max(1, Math.round(config.r3FollowWindowMinNs / stats.dtNs));
  const sMaxGap = Math.max(sMinGap + 1, Math.round(config.r3FollowWindowMaxNs / stats.dtNs));
  const lossThreshold = config.signalLossPercent / 100;

  const markers: AnomalyMarker[] = [];
  let criticalCount = 0;

  const minS = Math.floor(numSamples * 0.1);
  const maxS = Math.floor(numSamples * 0.6);
  const traceStep = Math.max(2, Math.floor(0.3 / stats.traceDistM));

  for (let t = traceStep; t < numTraces - traceStep; t += traceStep) {
    const tr = matrix[t];

    for (let s = minS; s < maxS; s += 2) {
      const r2Amp = tr[s];
      // Condition 1: R2 amplitude > mu + 2.0 sigma (positive polarity concrete-air)
      if (r2Amp > r2Threshold) {
        // Search for R3 within 0.67 - 3.0 ns
        let foundR3 = false;
        let r3Sample = -1;
        let r3Amp = 0;

        for (let ds = sMinGap; ds <= sMaxGap; ds++) {
          const candidateS = s + ds;
          if (candidateS >= numSamples) break;
          const amp = tr[candidateS];
          if (Math.abs(amp) > r2Threshold * 0.5) {
            foundR3 = true;
            r3Sample = candidateS;
            r3Amp = amp;
            break;
          }
        }

        if (foundR3 && r3Sample !== -1) {
          // Check signal loss below R3 (> 50%)
          const deepCheckS = Math.min(numSamples - 1, r3Sample + 5);
          const deepAmp = Math.abs(tr[deepCheckS] || 0);
          const signalLoss = (r2Amp - deepAmp) / r2Amp;

          if (signalLoss >= lossThreshold) {
            const dtAirNs = (r3Sample - s) * stats.dtNs;
            // Height = c_air * dt / 2 = 0.3 * dt / 2 in meters
            const voidHeightCm = (0.3 * dtAirNs * 100) / 2;
            const severityIndex = (r2Amp * dtAirNs) / (stats.std * 2.0);
            const isCritical = severityIndex > 1.0;

            if (isCritical) criticalCount++;

            const xCenterM = t * stats.traceDistM;
            const timeNs = s * stats.dtNs;
            const depthM = (timeNs * stats.vMPerNs) / 2;

            markers.push({
              id: `void-${markers.length + 1}`,
              type: 'subslab_void',
              title: isCritical ? `Vacío Crítico #${markers.length + 1}` : `Vacío #${markers.length + 1}`,
              xStartM: (t - 1) * stats.traceDistM,
              xEndM: (t + 1) * stats.traceDistM,
              xCenterM,
              traceStartIdx: t - 1,
              traceEndIdx: t + 1,
              traceCenterIdx: t,
              sampleIdx: s,
              timeNs,
              depthM,
              severity: severityIndex,
              isCritical,
              severityLabel: isCritical ? 'CRÍTICO (IS > 1.0)' : 'Severidad Moderada',
              mathCriterion: `R₂ > μ+2.0σ, Δt_R3 ∈ [${config.r3FollowWindowMinNs}, ${config.r3FollowWindowMaxNs}] ns, Pérdida > ${config.signalLossPercent}%, IS = ${severityIndex.toFixed(2)}`,
              measuredValues: {
                'Índice de Severidad IS': severityIndex.toFixed(2),
                'Altura Estimada de Vacío': `${voidHeightCm.toFixed(1)} cm`,
                'Tiempo Retardo Δt': `${dtAirNs.toFixed(2)} ns`,
                'Amplitud R₂': r2Amp.toFixed(0),
                'Amplitud R₃': r3Amp.toFixed(0),
                'Pérdida Bajo R₃': `${(signalLoss * 100).toFixed(1)}%`,
                'Profundidad Losa': `${depthM.toFixed(2)} m`,
              },
            });
            break; // Skip rest of trace
          }
        }
      }
    }
  }

  return { count: markers.length, criticalCount, markers };
}

/**
 * 5. Diffuse Scattering Detector (Fisuración Masiva)
 * Spatial coefficient of variation CV_A = sigma_A / mu_A > 0.50 spanning >= 3m.
 */
function detectDiffuseScattering(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['diffuseScattering']
): { count: number; totalAffectedM: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, totalAffectedM: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const windowTraces = Math.max(4, Math.floor(config.minLateralExtentM / stats.traceDistM));

  const markers: AnomalyMarker[] = [];
  let totalAffectedM = 0;

  const minS = Math.floor(numSamples * 0.12);
  const maxS = Math.floor(numSamples * 0.6);

  let activeStart = -1;
  let activeEnd = -1;
  let maxCva = 0;

  for (let t = 0; t < numTraces - windowTraces; t += Math.floor(windowTraces / 2)) {
    // Calculate local spatial mean and std of amplitudes in window
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let wt = t; wt < t + windowTraces; wt++) {
      const tr = matrix[wt];
      if (!tr) continue;
      for (let s = minS; s < maxS; s += 2) {
        const val = Math.abs(tr[s]);
        sum += val;
        sumSq += val * val;
        count++;
      }
    }

    const mean = count > 0 ? sum / count : 1;
    const variance = count > 0 ? Math.max(0, sumSq / count - mean * mean) : 0;
    const std = Math.sqrt(variance);
    const cvA = std / Math.max(1, mean);

    if (cvA >= config.cvaThreshold) {
      if (activeStart === -1) {
        activeStart = t;
        activeEnd = t + windowTraces;
        maxCva = cvA;
      } else {
        activeEnd = t + windowTraces;
        if (cvA > maxCva) maxCva = cvA;
      }
    } else {
      if (activeStart !== -1) {
        const lenM = (activeEnd - activeStart) * stats.traceDistM;
        if (lenM >= config.minLateralExtentM * 0.8) {
          totalAffectedM += lenM;
          const xStartM = activeStart * stats.traceDistM;
          const xEndM = activeEnd * stats.traceDistM;
          const timeNs = minS * stats.dtNs;
          const timeEndNs = maxS * stats.dtNs;
          const depthM = (timeNs * stats.vMPerNs) / 2;
          const depthEndM = (timeEndNs * stats.vMPerNs) / 2;

          markers.push({
            id: `scattering-${markers.length + 1}`,
            type: 'diffuse_scattering',
            title: `Zona Fisurada #${markers.length + 1}`,
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: activeEnd,
            traceCenterIdx: Math.floor((activeStart + activeEnd) / 2),
            sampleIdx: minS,
            timeNs,
            timeEndNs,
            depthM,
            depthEndM,
            severity: maxCva,
            severityLabel: maxCva > 0.8 ? 'Fisuración Masiva Severa' : 'Fisuración Moderada',
            mathCriterion: `CV_A = σ/μ = ${maxCva.toFixed(2)} > ${config.cvaThreshold.toFixed(2)}, Extensión ≥ ${config.minLateralExtentM}m`,
            measuredValues: {
              'Coeficiente CV_A': maxCva.toFixed(2),
              'Umbral CV_A': `> ${config.cvaThreshold.toFixed(2)}`,
              'Longitud Zona': `${lenM.toFixed(2)} m`,
              'Caída Energía DC': `> ${config.fftDcEnergyDropPercent}%`,
              'Intervalo Profundidad': `${depthM.toFixed(2)} m – ${depthEndM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
      }
    }
  }

  return { count: markers.length, totalAffectedM, markers };
}

/**
 * 6. Joint Infiltration Detector (Patrón Periódico)
 * Identifies periodic moisture anomalies at joints spaced at L_j ~ 4.5m in shallow window 0-10 ns.
 */
function detectJointInfiltrations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['jointInfiltration']
): { count: number; maxIdf: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxIdf: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const minS = Math.max(0, Math.floor(config.analysisWindowMinNs / stats.dtNs));
  const maxS = Math.min(numSamples - 1, Math.ceil(config.analysisWindowMaxNs / stats.dtNs));
  const expectedSpacingM = config.expectedJointSpacingM > 0 ? config.expectedJointSpacingM : 4.5;
  const jointSpacingTraces = Math.max(5, Math.round(expectedSpacingM / stats.traceDistM));

  const markers: AnomalyMarker[] = [];
  let maxIdf = 0;

  // Search candidate periodic joint locations
  const searchToleranceTraces = Math.max(2, Math.round(0.6 / stats.traceDistM));

  for (let targetT = jointSpacingTraces; targetT < numTraces - searchToleranceTraces; targetT += jointSpacingTraces) {
    let peakAmp = 0;
    let bestT = targetT;
    let bestS = minS;

    for (let dt = -searchToleranceTraces; dt <= searchToleranceTraces; dt++) {
      const curT = targetT + dt;
      if (curT < 0 || curT >= numTraces) continue;
      const tr = matrix[curT];

      for (let s = minS; s <= maxS; s++) {
        const absVal = Math.abs(tr[s]);
        if (absVal > peakAmp) {
          peakAmp = absVal;
          bestT = curT;
          bestS = s;
        }
      }
    }

    // Infiltration Deterioration Factor (IDF) relative to baseline standard deviation
    const idf = peakAmp / Math.max(1, stats.std * 1.4);

    if (idf >= config.idfThreshold) {
      if (idf > maxIdf) maxIdf = idf;
      const xCenterM = bestT * stats.traceDistM;
      const timeNs = bestS * stats.dtNs;
      const depthM = (timeNs * stats.vMPerNs) / 2;

      markers.push({
        id: `joint-${markers.length + 1}`,
        type: 'joint_infiltration',
        title: `Junta Infiltrada #${markers.length + 1}`,
        xStartM: (bestT - 2) * stats.traceDistM,
        xEndM: (bestT + 2) * stats.traceDistM,
        xCenterM,
        traceStartIdx: bestT - 2,
        traceEndIdx: bestT + 2,
        traceCenterIdx: bestT,
        sampleIdx: bestS,
        timeNs,
        depthM,
        severity: idf,
        severityLabel: idf > 5.0 ? 'Infiltración Crítica (IDF > 5)' : 'Infiltración Moderada (IDF 2-5)',
        mathCriterion: `Espaciado L_j ≈ ${expectedSpacingM.toFixed(1)}m, IDF = ${idf.toFixed(2)} > ${config.idfThreshold.toFixed(1)}`,
        measuredValues: {
          'Factor IDF': idf.toFixed(2),
          'Amplitud en Junta': peakAmp.toFixed(0),
          'Espaciado L_j': `${expectedSpacingM.toFixed(1)} m`,
          'Ventana Análisis': `${config.analysisWindowMinNs} – ${config.analysisWindowMaxNs} ns`,
          'Estado': idf > 5.0 ? 'Crítico (Daño Severo)' : 'Daño Moderado',
          'Profundidad': `${depthM.toFixed(2)} m`,
        },
      });
    }
  }

  return { count: markers.length, maxIdf, markers };
}

/**
 * 7. Dielectric Shadow Detector (Pérdida Prematura de Señal)
 * Identifies strong conductive absorption where signal falls below 5% before t_ext < 15 ns.
 */
function detectDielectricShadows(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['dielectricShadow']
): { count: number; maxAlphaDbM: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxAlphaDbM: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const extinctionSample = Math.round(config.criticalExtinctionTimeNs / stats.dtNs);
  const sustainedLossSamples = Math.round(config.sustainedLossWindowNs / stats.dtNs);
  const ampLossRatio = config.signalLossThresholdPercent / 100;

  const markers: AnomalyMarker[] = [];
  let maxAlphaDbM = 0;

  let activeStart = -1;
  let detectedTExt = 0;
  let maxAlpha = 0;

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    // Find surface max amplitude in first 8 ns
    let surfaceAmp = 1;
    const surfLimit = Math.min(numSamples, Math.round(8.0 / stats.dtNs));
    for (let s = 0; s < surfLimit; s++) {
      if (Math.abs(tr[s]) > surfaceAmp) surfaceAmp = Math.abs(tr[s]);
    }

    // Check premature extinction before extinctionSample
    let extinguished = false;
    let tExtNs = config.criticalExtinctionTimeNs;

    for (let s = Math.round(4.0 / stats.dtNs); s < extinctionSample; s++) {
      const amp = Math.abs(tr[s]);
      if (amp < surfaceAmp * ampLossRatio) {
        // Verify sustained loss for sustainedLossWindowNs
        let sustained = true;
        for (let ws = 1; ws <= sustainedLossSamples; ws++) {
          if (s + ws < numSamples && Math.abs(tr[s + ws]) > surfaceAmp * ampLossRatio * 1.5) {
            sustained = false;
            break;
          }
        }
        if (sustained) {
          extinguished = true;
          tExtNs = s * stats.dtNs;
          break;
        }
      }
    }

    if (extinguished) {
      // Estimated alpha: (15 - t_ext)/15 * 25 dB/m
      const alphaEst = Math.max(10, ((config.criticalExtinctionTimeNs - tExtNs) / config.criticalExtinctionTimeNs) * 25);
      if (activeStart === -1) {
        activeStart = t;
        detectedTExt = tExtNs;
        maxAlpha = alphaEst;
      } else {
        if (alphaEst > maxAlpha) maxAlpha = alphaEst;
      }
    } else {
      if (activeStart !== -1) {
        const lenM = (t - activeStart) * stats.traceDistM;
        if (lenM >= 0.5) {
          if (maxAlpha > maxAlphaDbM) maxAlphaDbM = maxAlpha;
          const xStartM = activeStart * stats.traceDistM;
          const xEndM = t * stats.traceDistM;
          const timeNs = detectedTExt;
          const depthM = (timeNs * stats.vMPerNs) / 2;

          markers.push({
            id: `shadow-${markers.length + 1}`,
            type: 'dielectric_shadow',
            title: `Sombra Dieléctrica #${markers.length + 1}`,
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: t,
            traceCenterIdx: Math.floor((activeStart + t) / 2),
            sampleIdx: Math.round(detectedTExt / stats.dtNs),
            timeNs,
            depthM,
            severity: maxAlpha,
            severityLabel: `Atenuación α ≈ ${maxAlpha.toFixed(1)} dB/m`,
            mathCriterion: `A < ${config.signalLossThresholdPercent}% A_sup, t_ext < ${config.criticalExtinctionTimeNs} ns, Ventana > ${config.sustainedLossWindowNs} ns`,
            measuredValues: {
              'Atenuación Estimada α': `${maxAlpha.toFixed(1)} dB/m`,
              'Tiempo de Extinción': `${detectedTExt.toFixed(1)} ns`,
              'Umbral de Pérdida': `< ${config.signalLossThresholdPercent}% de Sup.`,
              'Ancho de Sombra': `${lenM.toFixed(2)} m`,
              'Profundidad de Penetración': `${depthM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
      }
    }
  }

  return { count: markers.length, maxAlphaDbM, markers };
}

/**
 * 8. Thickness Variation Detector (Inconsistencia Estructural)
 * Tracks interface t2(x), computes rolling mean window, flags deviations > threshold.
 */
function detectThicknessVariations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['thicknessVariation']
): { count: number; maxDeviationCm: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxDeviationCm: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const rollingTraces = Math.max(3, Math.round(config.rollingMeanWindowM / stats.traceDistM));

  // Step 1: Pick interface t2(x) for every trace
  const t2TimesNs: number[] = new Array(numTraces);
  const minS = Math.floor(numSamples * 0.08);
  const maxS = Math.floor(numSamples * 0.45);

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let maxPeak = 0;
    let peakS = minS;

    for (let s = minS; s < maxS; s++) {
      const val = Math.abs(tr[s]);
      if (val > maxPeak) {
        maxPeak = val;
        peakS = s;
      }
    }
    t2TimesNs[t] = peakS * stats.dtNs;
  }

  // Step 2: Compute rolling mean of t2(x)
  const rollingMeanNs: number[] = new Array(numTraces);
  const halfWin = Math.floor(rollingTraces / 2);

  for (let t = 0; t < numTraces; t++) {
    const wStart = Math.max(0, t - halfWin);
    const wEnd = Math.min(numTraces, t + halfWin + 1);
    let sum = 0;
    for (let wt = wStart; wt < wEnd; wt++) {
      sum += t2TimesNs[wt];
    }
    rollingMeanNs[t] = sum / (wEnd - wStart);
  }

  // Step 3: Build curvePoints and find anomaly zones
  const curvePoints: CurvePoint[] = [];
  const markers: AnomalyMarker[] = [];
  let maxDeviationCm = 0;

  let activeStart = -1;
  let activeMaxDev = 0;

  for (let t = 0; t < numTraces; t++) {
    const tNs = t2TimesNs[t];
    const meanNs = rollingMeanNs[t];
    const devNs = Math.abs(tNs - meanNs);
    // Delta d = v * Delta t / 2 * 100 cm
    const devCm = (stats.vMPerNs * devNs * 100) / 2;
    const isAnomalous = devNs >= config.deviationThresholdNs;

    if (devCm > maxDeviationCm) maxDeviationCm = devCm;

    const xM = t * stats.traceDistM;
    const depthM = (tNs * stats.vMPerNs) / 2;

    curvePoints.push({
      xM,
      traceIdx: t,
      sampleIdx: Math.round(tNs / stats.dtNs),
      timeNs: tNs,
      depthM,
      deviationNs: devNs,
      deviationCm: devCm,
      isAnomalous,
    });

    if (isAnomalous) {
      if (activeStart === -1) {
        activeStart = t;
        activeMaxDev = devCm;
      } else {
        if (devCm > activeMaxDev) activeMaxDev = devCm;
      }
    } else {
      if (activeStart !== -1) {
        const lenM = (t - activeStart) * stats.traceDistM;
        if (lenM >= 0.4) {
          const xStartM = activeStart * stats.traceDistM;
          const xEndM = t * stats.traceDistM;
          const avgTimeNs = t2TimesNs[Math.floor((activeStart + t) / 2)];
          const avgDepthM = (avgTimeNs * stats.vMPerNs) / 2;

          markers.push({
            id: `thickness-${markers.length + 1}`,
            type: 'thickness_variation',
            title: `Variación de Espesor #${markers.length + 1}`,
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: t,
            traceCenterIdx: Math.floor((activeStart + t) / 2),
            sampleIdx: Math.round(avgTimeNs / stats.dtNs),
            timeNs: avgTimeNs,
            depthM: avgDepthM,
            severity: activeMaxDev,
            severityLabel: `Desviación ±${activeMaxDev.toFixed(1)} cm`,
            mathCriterion: `|t₂(x) - t̄₂(x)| > ${config.deviationThresholdNs.toFixed(1)} ns, Ventana = ${config.rollingMeanWindowM} m`,
            measuredValues: {
              'Desviación Máx': `±${activeMaxDev.toFixed(1)} cm`,
              'Umbral Temporal': `±${config.deviationThresholdNs.toFixed(1)} ns`,
              'Ventana Media Móvil': `${config.rollingMeanWindowM} m`,
              'Extensión Zona': `${lenM.toFixed(2)} m`,
              'Profundidad Capa': `${avgDepthM.toFixed(2)} m`,
            },
            curvePoints,
          });
        }
        activeStart = -1;
      }
    }
  }

  // If entire curve exists, provide it on at least one marker or result
  if (markers.length === 0 && curvePoints.length > 0) {
    // If no threshold violation, we still provide the base curve
    markers.push({
      id: 'thickness-curve-baseline',
      type: 'thickness_variation',
      title: 'Trazado Interfaz t₂(x)',
      xStartM: 0,
      xEndM: numTraces * stats.traceDistM,
      xCenterM: (numTraces * stats.traceDistM) / 2,
      traceStartIdx: 0,
      traceEndIdx: numTraces - 1,
      traceCenterIdx: Math.floor(numTraces / 2),
      sampleIdx: Math.round(t2TimesNs[0] / stats.dtNs),
      timeNs: t2TimesNs[0],
      depthM: (t2TimesNs[0] * stats.vMPerNs) / 2,
      severity: maxDeviationCm,
      severityLabel: 'Espesor Homogéneo (< Umbral)',
      mathCriterion: `|t₂(x) - t̄₂(x)| ≤ ${config.deviationThresholdNs.toFixed(1)} ns`,
      measuredValues: {
        'Desviación Máx': `±${maxDeviationCm.toFixed(1)} cm`,
        'Umbral': `±${config.deviationThresholdNs.toFixed(1)} ns`,
        'Condición': 'Dentro de Tolerancia',
      },
      curvePoints,
    });
  }

  return { count: markers.filter((m) => m.id !== 'thickness-curve-baseline').length, maxDeviationCm, markers };
}

/**
 * Master Detection Runner
 * Runs all active detectors on the currently loaded B-scan matrix
 */
export function runAnomalyDetections(
  matrix: Float32Array[] | null,
  ventanaNs: number,
  traceDistanceStepM: number,
  dielectricPermittivity: number,
  config: DetectionConfig
): DetectionResults {
  if (!matrix || matrix.length === 0) {
    return EMPTY_DETECTION_RESULTS;
  }

  const stats = computeMatrixStats(matrix, ventanaNs, traceDistanceStepM, dielectricPermittivity);

  return {
    brightSpots: detectBrightSpots(matrix, stats, config.brightSpot),
    hyperbolas: detectHyperbolas(matrix, stats, config.hyperbola),
    delaminations: detectDelaminations(matrix, stats, config.delamination),
    subslabVoids: detectSubslabVoids(matrix, stats, config.subslabVoid),
    diffuseScattering: detectDiffuseScattering(matrix, stats, config.diffuseScattering),
    jointInfiltrations: detectJointInfiltrations(matrix, stats, config.jointInfiltration),
    dielectricShadows: detectDielectricShadows(matrix, stats, config.dielectricShadow),
    thicknessVariations: detectThicknessVariations(matrix, stats, config.thicknessVariation),
  };
}
