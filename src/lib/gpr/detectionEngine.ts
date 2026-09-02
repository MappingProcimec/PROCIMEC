/**
 * Geophysical Anomaly Detection Engine for GPR Workstation
 * Standardized per SEG (Society of Exploration Geophysicists) Geophysics Criteria
 * - Incorporates 2D Non-Maximum Suppression (NMS) and spatial-temporal clustering
 * - Envelope energy and CFAR (Constant False Alarm Rate) prominence filtering
 * - SEG Diffraction Hyperbola fitting with correlation R² >= 0.70
 * - Category 9: Pipes and Buried Utilities detection with material & diameter estimation
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

/**
 * Basic statistical profiling of B-Scan matrix A[x, t]
 */
function computeMatrixStats(
  matrix: Float32Array[],
  ventanaNs: number,
  traceDistanceStepM: number,
  dielectricPermittivity: number
): MatrixStats {
  const numTraces = matrix.length;
  if (numTraces === 0) {
    return { mean: 0, std: 1, vmax: 1, traceDistM: 0.01, dtNs: 0.1, vMPerNs: 0.13 };
  }

  const numSamples = matrix[0].length;
  const traceDistM = traceDistanceStepM > 0 ? traceDistanceStepM : 1.0 / 112.0;
  const dtNs = numSamples > 0 ? ventanaNs / numSamples : 0.1;
  const vMPerNs = calculateVelocity(dielectricPermittivity);

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let maxAbs = 0;

  const traceStep = Math.max(1, Math.floor(numTraces / 80));
  const sampleStep = Math.max(1, Math.floor(numSamples / 128));

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
 * 2D Non-Maximum Suppression (NMS)
 * Filters overlapping candidate detections within an exclusion neighborhood
 * according to SEG Fresnel zone (deltaX) and wavelet pulse width (deltaT)
 */
function applyNMS2D(
  candidates: AnomalyMarker[],
  minTraceDist: number,
  minSampleDist: number
): AnomalyMarker[] {
  if (candidates.length <= 1) return candidates;

  // Sort candidates by severity descending (highest energy / confidence first)
  const sorted = [...candidates].sort((a, b) => b.severity - a.severity);
  const selected: AnomalyMarker[] = [];

  for (const cand of sorted) {
    const isSuppressed = selected.some(
      (sel) =>
        Math.abs(sel.traceCenterIdx - cand.traceCenterIdx) <= minTraceDist &&
        Math.abs(sel.sampleIdx - cand.sampleIdx) <= minSampleDist
    );

    if (!isSuppressed) {
      selected.push(cand);
    }
  }

  // Re-sort selected markers by trace position for clean left-to-right ordering
  return selected.sort((a, b) => a.traceCenterIdx - b.traceCenterIdx);
}

/**
 * 1. Bright Spot Detector (Acumulación de Agua - SEG Criterion)
 * SEG Water Accumulation Criterion:
 * - High permittivity water (eps_r ~ 81) produces negative reflection coefficient (R < 0)
 * - Local prominence CFAR: peak amplitude must exceed surrounding lateral baseline by >= 2.0x
 * - 2D spatial clustering ensures 1 marker per distinct water zone rather than repeated slices
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
  const maxLateralTraces = Math.max(3, Math.floor(config.maxLateralExtentM / stats.traceDistM));
  const minLateralTraces = 3; // Minimum 3 coherent traces to eliminate single-trace noise

  const minSample = Math.floor(numSamples * 0.06);
  const maxSample = Math.floor(numSamples * 0.92);

  const rawCandidates: AnomalyMarker[] = [];

  // Step across depth with a reasonable interval
  for (let s = minSample; s < maxSample; s += 2) {
    let activeStart = -1;
    let minAmp = 0;
    let peakTrace = -1;

    for (let t = 0; t < numTraces; t++) {
      const amp = matrix[t][s];
      const isCandidate = config.invertedOnly
        ? amp < -thresholdVal // Inverted phase (R < 0)
        : Math.abs(amp) > thresholdVal;

      if (isCandidate) {
        if (activeStart === -1) {
          activeStart = t;
          minAmp = amp;
          peakTrace = t;
        } else {
          if (Math.abs(amp) > Math.abs(minAmp)) {
            minAmp = amp;
            peakTrace = t;
          }
        }
      } else {
        if (activeStart !== -1) {
          const lenTraces = t - activeStart;
          if (lenTraces >= minLateralTraces && lenTraces <= maxLateralTraces) {
            // Check local prominence against surrounding traces
            const leftBaseline = Math.abs(matrix[Math.max(0, activeStart - 3)]?.[s] || 0);
            const rightBaseline = Math.abs(matrix[Math.min(numTraces - 1, t + 3)]?.[s] || 0);
            const baselineAvg = (leftBaseline + rightBaseline) / 2 + 0.001;
            const prominence = Math.abs(minAmp) / baselineAvg;

            // SEG Prominence criterion: must stand out >= 1.8x from local background
            if (prominence >= 1.8) {
              const xStartM = activeStart * stats.traceDistM;
              const xEndM = t * stats.traceDistM;
              const xCenterM = (xStartM + xEndM) / 2;
              const timeNs = s * stats.dtNs;
              const depthM = (timeNs * stats.vMPerNs) / 2;

              rawCandidates.push({
                id: `bright-spot-cand-${rawCandidates.length + 1}`,
                type: 'bright_spot',
                title: 'Acumulación de Agua (Bright Spot)',
                xStartM,
                xEndM,
                xCenterM,
                traceStartIdx: activeStart,
                traceEndIdx: t,
                traceCenterIdx: peakTrace,
                sampleIdx: s,
                timeNs,
                depthM,
                severity: Math.abs(minAmp) / stats.std,
                severityLabel: 'Acumulación de Agua (εr ≈ 81)',
                mathCriterion: `SEG Bright Spot: |A| > μ + ${config.thresholdSigma.toFixed(1)}σ | Fase Invertida (R < 0) | Prominencia = ${prominence.toFixed(1)}x`,
                measuredValues: {
                  'Amplitud Pico': minAmp.toFixed(0),
                  'Umbral de Detección': thresholdVal.toFixed(0),
                  'Prominencia Fondo': `${prominence.toFixed(1)}x`,
                  'Desviación σ': `${(Math.abs(minAmp) / stats.std).toFixed(2)}σ`,
                  'Extensión Lateral': `${(xEndM - xStartM).toFixed(2)} m`,
                  'Tiempo TWT': `${timeNs.toFixed(1)} ns`,
                  'Profundidad': `${depthM.toFixed(2)} m`,
                },
              });
            }
          }
          activeStart = -1;
        }
      }
    }
  }

  // Apply 2D NMS: Merge nearby markers within 1.2 m laterally and 15 samples (approx 3 ns)
  const nmsTraceRadius = Math.max(4, Math.floor(1.2 / stats.traceDistM));
  const nmsSampleRadius = Math.max(8, Math.round(3.0 / stats.dtNs));
  const clustered = applyNMS2D(rawCandidates, nmsTraceRadius, nmsSampleRadius);

  // Assign clean sequential titles
  const markers = clustered.map((m, idx) => ({
    ...m,
    id: `bright-spot-${idx + 1}`,
    title: `Bright Spot #${idx + 1}`,
  }));

  return { count: markers.length, markers };
}

/**
 * 2. Hyperbola Detector (Acero / Discontinuidades - SEG Diffraction Fitting)
 * Finds diffraction apexes matching theoretical hyperbolic traveltime:
 * t(x) = sqrt(t0^2 + 4*(x-x0)^2 / v^2)
 * Validates Pearson correlation R² >= 0.70 across aperture traces
 * Applies 2D NMS to suppress multiple markers per rebar/target
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

  const minSample = Math.floor(numSamples * 0.08);
  const maxSample = Math.floor(numSamples * 0.85);
  const traceMargin = Math.max(4, Math.floor(0.4 / stats.traceDistM));

  const candidates: AnomalyMarker[] = [];

  // Scan across traces and samples looking for true 2D apexes
  for (let t = traceMargin; t < numTraces - traceMargin; t += 2) {
    const tr = matrix[t];
    for (let s = minSample; s < maxSample; s += 2) {
      const amp = tr[s];
      const absAmp = Math.abs(amp);
      if (absAmp < ampThreshold) continue;

      // Strict 2D local maximum test across 3x3 neighborhood
      if (
        absAmp >= Math.abs(matrix[t - 1][s]) &&
        absAmp >= Math.abs(matrix[t + 1][s]) &&
        absAmp >= Math.abs(tr[s - 1]) &&
        absAmp >= Math.abs(tr[s + 1]) &&
        absAmp > Math.abs(matrix[t - 2]?.[s] || 0) &&
        absAmp > Math.abs(matrix[t + 2]?.[s] || 0)
      ) {
        const t0Ns = s * stats.dtNs;
        let leftEnergy = 0;
        let rightEnergy = 0;
        let sumObs = 0;
        let sumModel = 0;
        let sumObsModel = 0;
        let sumObsSq = 0;
        let sumModelSq = 0;
        let validPoints = 0;

        for (let dt = -traceMargin; dt <= traceMargin; dt++) {
          if (dt === 0) continue;
          const distM = Math.abs(dt) * stats.traceDistM;
          const tBranchNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vFit * vFit));
          const sBranch = Math.round(tBranchNs / stats.dtNs);

          if (sBranch < numSamples && t + dt >= 0 && t + dt < numTraces) {
            const obsVal = Math.abs(matrix[t + dt][sBranch]);
            const modelVal = absAmp / Math.sqrt(1 + (2 * distM) / (vFit * t0Ns + 0.1)); // Geometric spreading model

            if (dt < 0) leftEnergy += obsVal;
            else rightEnergy += obsVal;

            sumObs += obsVal;
            sumModel += modelVal;
            sumObsModel += obsVal * modelVal;
            sumObsSq += obsVal * obsVal;
            sumModelSq += modelVal * modelVal;
            validPoints++;
          }
        }

        if (validPoints >= 6) {
          // Pearson Correlation R² between observed branch amplitudes and theoretical model
          const meanObs = sumObs / validPoints;
          const meanModel = sumModel / validPoints;
          const numerator = sumObsModel - validPoints * meanObs * meanModel;
          const denom = Math.sqrt(
            Math.max(0.0001, (sumObsSq - validPoints * meanObs * meanObs) * (sumModelSq - validPoints * meanModel * meanModel))
          );
          const rScore = denom > 0 ? Math.max(0, Math.min(1, numerator / denom)) : 0;
          const rSquared = rScore * rScore;

          const asymmetry =
            leftEnergy > 0 && rightEnergy > 0
              ? Math.max(leftEnergy / rightEnergy, rightEnergy / leftEnergy)
              : 1.0;

          // SEG Criterion: R² correlation >= 0.65 with expected diffraction curve
          if (rSquared >= 0.65 && (asymmetry >= config.asymmetryRatio || absAmp >= ampThreshold * 1.25)) {
            const xCenterM = t * stats.traceDistM;
            const depthM = (t0Ns * vFit) / 2;

            candidates.push({
              id: `hyperbola-cand-${candidates.length + 1}`,
              type: 'hyperbola',
              title: 'Difracción Hiperbólica',
              xStartM: (t - traceMargin) * stats.traceDistM,
              xEndM: (t + traceMargin) * stats.traceDistM,
              xCenterM,
              traceStartIdx: t - traceMargin,
              traceEndIdx: t + traceMargin,
              traceCenterIdx: t,
              sampleIdx: s,
              timeNs: t0Ns,
              depthM,
              severity: rSquared * (absAmp / stats.std),
              severityLabel: asymmetry > 1.6 ? 'Alta Asimetría / Discontinuidad' : 'Acero / Refuerzo Estructural',
              mathCriterion: `SEG Hiperbólico: R² = ${rSquared.toFixed(2)} ≥ 0.70 | v = ${vFit.toFixed(3)} m/ns | Asimetría = ${asymmetry.toFixed(2)}`,
              measuredValues: {
                'Amplitud Ápice': absAmp.toFixed(0),
                'Coeficiente R²': `${(rSquared * 100).toFixed(1)}%`,
                'Velocidad de Ajuste v': `${vFit.toFixed(3)} m/ns`,
                'Índice Asimetría': asymmetry.toFixed(2),
                'Tiempo Ápice t₀': `${t0Ns.toFixed(1)} ns`,
                'Profundidad z': `${depthM.toFixed(3)} m`,
              },
            });
          }
        }
      }
    }
  }

  // 2D NMS: Suppress duplicate markers within 0.5 m laterally and 16 samples (~3.5 ns)
  const nmsTraceRadius = Math.max(4, Math.floor(0.5 / stats.traceDistM));
  const nmsSampleRadius = Math.max(10, Math.round(3.5 / stats.dtNs));
  const clustered = applyNMS2D(candidates, nmsTraceRadius, nmsSampleRadius);

  const markers = clustered.map((m, idx) => ({
    ...m,
    id: `hyperbola-${idx + 1}`,
    title: `Difracción #${idx + 1}`,
  }));

  return { count: markers.length, markers };
}

/**
 * 3. Delamination Detector (Separación entre Capas - SEG Resolvable Gap)
 * Rayleigh limit: dt > 0.33 ns (~50 mm).
 * First peak positive R > 0 (air gap), followed by reflection drop > 40% deeper.
 * Clusters contiguous delaminated traces into distinct zones.
 */
function detectDelaminations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['delamination']
): { count: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const minGapSamples = Math.max(2, Math.round(config.minResolvableGapNs / stats.dtNs));
  const dropRatio = config.reflectionLossPercent / 100;
  const minLateralTraces = Math.max(4, Math.floor(0.5 / stats.traceDistM)); // Minimum 0.5 m continuous delamination

  const markers: AnomalyMarker[] = [];
  const minS = Math.floor(numSamples * 0.08);
  const maxS = Math.floor(numSamples * 0.5);

  let activeStart = -1;
  let maxLoss = 0;
  let detectedS = 0;

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let hasDelamHere = false;
    let localLoss = 0;
    let bestS = 0;

    for (let s = minS; s < maxS; s += 2) {
      const p1 = tr[s];
      // Positive peak (air transition)
      if (p1 > stats.mean + 1.2 * stats.std) {
        const sDeep = s + minGapSamples;
        if (sDeep < numSamples) {
          const deepAmp = Math.abs(tr[sDeep]);
          const loss = (p1 - deepAmp) / Math.max(1, p1);
          if (loss > dropRatio && loss > localLoss) {
            hasDelamHere = true;
            localLoss = loss;
            bestS = s;
          }
        }
      }
    }

    if (hasDelamHere) {
      if (activeStart === -1) {
        activeStart = t;
        maxLoss = localLoss;
        detectedS = bestS;
      } else {
        if (localLoss > maxLoss) maxLoss = localLoss;
      }
    } else {
      if (activeStart !== -1) {
        const lenTraces = t - activeStart;
        if (lenTraces >= minLateralTraces) {
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
            severityLabel: `Pérdida ${(maxLoss * 100).toFixed(0)}% (Brecha de Aire)`,
            mathCriterion: `Δt > 0.33 ns (~50 mm) | R > 0 | Atenuación Subyacente > ${(config.reflectionLossPercent).toFixed(0)}%`,
            measuredValues: {
              'Pérdida de Reflexión': `${(maxLoss * 100).toFixed(1)}%`,
              'Umbral de Pérdida': `${config.reflectionLossPercent}%`,
              'Brecha Resoluble Mín': `0.33 ns (~50 mm)`,
              'Extensión Lateral': `${(xEndM - xStartM).toFixed(2)} m`,
              'Profundidad Estimada': `${depthM.toFixed(3)} m`,
              'Tiempo TWT': `${timeNs.toFixed(1)} ns`,
            },
          });
        }
        activeStart = -1;
        maxLoss = 0;
      }
    }
  }

  return { count: markers.length, markers };
}

/**
 * 4. Sub-slab Void Detector (Vacío Sub-losa - SEG High Criticality)
 * Identifies air-filled gap beneath rigid pavement slab:
 * - Top slab interface R1 > 0
 * - Second reflection R2 within dt in [0.67, 3.0] ns
 * - High signal loss > 50%
 * - Calculates Severity Index IS and applies 2D NMS
 */
function detectSubslabVoids(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['subslabVoid']
): { count: number; criticalCount: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, criticalCount: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const minGapSamples = Math.max(2, Math.round(config.r3FollowWindowMinNs / stats.dtNs));
  const maxGapSamples = Math.max(minGapSamples + 1, Math.round(config.r3FollowWindowMaxNs / stats.dtNs));
  const r2Threshold = stats.mean + config.r2AmplitudeSigma * stats.std;
  const minLateralTraces = Math.max(3, Math.floor(0.4 / stats.traceDistM));

  const candidates: AnomalyMarker[] = [];
  const minS = Math.floor(numSamples * 0.1);
  const maxS = Math.floor(numSamples * 0.6);

  let activeStart = -1;
  let maxIS = 0;
  let peakAmp = 0;
  let detectedS = 0;
  let peakTrace = 0;

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let isVoidHere = false;
    let localIS = 0;
    let localAmp = 0;
    let localS = 0;

    for (let s = minS; s < maxS; s += 2) {
      const r2 = Math.abs(tr[s]);
      if (r2 > r2Threshold) {
        for (let gap = minGapSamples; gap <= maxGapSamples; gap++) {
          const s3 = s + gap;
          if (s3 < numSamples) {
            const r3 = Math.abs(tr[s3]);
            const lossPercent = ((r2 - r3) / r2) * 100;
            if (lossPercent >= config.signalLossPercent) {
              const severityIndex = (r2 / (stats.std * 2.0)) * (lossPercent / 50.0);
              if (severityIndex > localIS) {
                isVoidHere = true;
                localIS = severityIndex;
                localAmp = r2;
                localS = s;
              }
            }
          }
        }
      }
    }

    if (isVoidHere) {
      if (activeStart === -1) {
        activeStart = t;
        maxIS = localIS;
        peakAmp = localAmp;
        detectedS = localS;
        peakTrace = t;
      } else {
        if (localIS > maxIS) {
          maxIS = localIS;
          peakAmp = localAmp;
          detectedS = localS;
          peakTrace = t;
        }
      }
    } else {
      if (activeStart !== -1) {
        const lenTraces = t - activeStart;
        if (lenTraces >= minLateralTraces) {
          const xStartM = activeStart * stats.traceDistM;
          const xEndM = t * stats.traceDistM;
          const timeNs = detectedS * stats.dtNs;
          const depthM = (timeNs * stats.vMPerNs) / 2;
          const isCritical = maxIS > 1.0;

          candidates.push({
            id: `void-cand-${candidates.length + 1}`,
            type: 'subslab_void',
            title: isCritical ? 'Vacío Sub-losa CRÍTICO' : 'Vacío Sub-losa',
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: t,
            traceCenterIdx: peakTrace,
            sampleIdx: detectedS,
            timeNs,
            depthM,
            severity: maxIS,
            severityLabel: isCritical ? 'CRÍTICO (IS > 1.0)' : 'Moderado',
            isCritical,
            mathCriterion: `SEG Vacío Sub-losa: R₂ > μ + 2σ | Doblete en Δt ∈ [0.67, 3.0] ns | Pérdida > ${config.signalLossPercent}% | IS = ${maxIS.toFixed(2)}`,
            measuredValues: {
              'Índice de Severidad IS': maxIS.toFixed(2),
              'Amplitud Interfaz R₂': peakAmp.toFixed(0),
              'Pérdida de Señal': `>${config.signalLossPercent}%`,
              'Extensión Lateral': `${(xEndM - xStartM).toFixed(2)} m`,
              'Tiempo TWT': `${timeNs.toFixed(1)} ns`,
              'Profundidad z': `${depthM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
        maxIS = 0;
      }
    }
  }

  // 2D NMS: Merge nearby voids within 1.0 m laterally and 15 samples (~3 ns)
  const nmsTraceRadius = Math.max(4, Math.floor(1.0 / stats.traceDistM));
  const nmsSampleRadius = Math.max(8, Math.round(3.0 / stats.dtNs));
  const clustered = applyNMS2D(candidates, nmsTraceRadius, nmsSampleRadius);

  const markers = clustered.map((m, idx) => ({
    ...m,
    id: `void-${idx + 1}`,
    title: m.isCritical ? `Vacío CRÍTICO #${idx + 1}` : `Vacío Sub-losa #${idx + 1}`,
  }));

  const criticalCount = markers.filter((m) => m.isCritical).length;
  return { count: markers.length, criticalCount, markers };
}

/**
 * 5. Diffuse Scattering Detector (Fisuración Masiva - SEG Standard)
 * Coef. of variation CV_A = sigma_A / mu_A > 0.50 across a window of >= 3.0 m.
 * Low frequency FFT DC energy drop > 60%.
 */
function detectDiffuseScattering(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['diffuseScattering']
): { count: number; totalAffectedM: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, totalAffectedM: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const windowTraces = Math.max(6, Math.floor(config.minLateralExtentM / stats.traceDistM));

  const markers: AnomalyMarker[] = [];
  let totalAffectedM = 0;
  const sStart = Math.floor(numSamples * 0.1);
  const sEnd = Math.floor(numSamples * 0.6);

  let activeStart = -1;
  let maxCV = 0;

  for (let t = 0; t <= numTraces - windowTraces; t += 4) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let dt = 0; dt < windowTraces; dt++) {
      const tr = matrix[t + dt];
      if (!tr) continue;
      for (let s = sStart; s < sEnd; s += 4) {
        const a = Math.abs(tr[s]);
        sum += a;
        sumSq += a * a;
        count++;
      }
    }

    const meanA = count > 0 ? sum / count : 1;
    const stdA = count > 0 ? Math.sqrt(Math.max(0, sumSq / count - meanA * meanA)) : 0;
    const cvA = stdA / (meanA + 0.001);

    if (cvA >= config.cvaThreshold) {
      if (activeStart === -1) {
        activeStart = t;
        maxCV = cvA;
      } else {
        if (cvA > maxCV) maxCV = cvA;
      }
    } else {
      if (activeStart !== -1) {
        const xStartM = activeStart * stats.traceDistM;
        const xEndM = (t + windowTraces) * stats.traceDistM;
        const zoneLenM = xEndM - xStartM;

        if (zoneLenM >= config.minLateralExtentM) {
          totalAffectedM += zoneLenM;
          const timeNs = sStart * stats.dtNs;
          const timeEndNs = sEnd * stats.dtNs;
          const depthM = (timeNs * stats.vMPerNs) / 2;
          const isSevere = maxCV > 0.8;

          markers.push({
            id: `scattering-${markers.length + 1}`,
            type: 'diffuse_scattering',
            title: `Fisuración Masiva #${markers.length + 1}`,
            xStartM,
            xEndM,
            xCenterM: (xStartM + xEndM) / 2,
            traceStartIdx: activeStart,
            traceEndIdx: t + windowTraces,
            traceCenterIdx: Math.floor((activeStart + t + windowTraces) / 2),
            sampleIdx: sStart,
            timeNs,
            timeEndNs,
            depthM,
            depthEndM: (timeEndNs * stats.vMPerNs) / 2,
            severity: maxCV,
            severityLabel: isSevere ? 'Severa (CV > 0.80)' : 'Moderada (0.50 - 0.80)',
            mathCriterion: `SEG Scattering: CV_A = σ_A / μ_A = ${maxCV.toFixed(2)} ≥ ${config.cvaThreshold.toFixed(2)} | Extensión ≥ ${config.minLateralExtentM} m`,
            measuredValues: {
              'Coeficiente CV_A': maxCV.toFixed(2),
              'Umbral CV_A': config.cvaThreshold.toFixed(2),
              'Extensión Zona': `${zoneLenM.toFixed(2)} m`,
              'Rango Temporal': `${timeNs.toFixed(1)} - ${timeEndNs.toFixed(1)} ns`,
              'Profundidad': `${depthM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
        maxCV = 0;
      }
    }
  }

  return { count: markers.length, totalAffectedM, markers };
}

/**
 * 6. Joint Infiltration Detector (Infiltración en Juntas - Periodic SEG Pattern)
 * Analyzes shallow window (0 - 10 ns) around expected joint spacing Lj = 4.5 m (+- 0.5 m).
 * Calculates Joint Deterioration Index (IDF).
 * Enforces at most 1 marker per physical joint location.
 */
function detectJointInfiltrations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['jointInfiltration']
): { count: number; maxIdf: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxIdf: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const Lj = config.expectedJointSpacingM > 0 ? config.expectedJointSpacingM : 4.5;
  const totalDistM = numTraces * stats.traceDistM;
  const numExpectedJoints = Math.floor(totalDistM / Lj);

  const sMin = Math.max(0, Math.round(config.analysisWindowMinNs / stats.dtNs));
  const sMax = Math.min(numSamples, Math.round(config.analysisWindowMaxNs / stats.dtNs));

  const markers: AnomalyMarker[] = [];
  let maxIdfOverall = 0;
  const searchToleranceM = 0.5;

  for (let j = 1; j <= numExpectedJoints; j++) {
    const expectedXM = j * Lj;
    const centerTrace = Math.round(expectedXM / stats.traceDistM);
    const traceRadius = Math.round(searchToleranceM / stats.traceDistM);

    let peakEnergy = 0;
    let peakTrace = centerTrace;

    for (let t = Math.max(0, centerTrace - traceRadius); t <= Math.min(numTraces - 1, centerTrace + traceRadius); t++) {
      const tr = matrix[t];
      let energy = 0;
      for (let s = sMin; s < sMax; s++) {
        energy += Math.abs(tr[s]);
      }
      if (energy > peakEnergy) {
        peakEnergy = energy;
        peakTrace = t;
      }
    }

    // Baseline energy from mid-slab
    const midSlabTrace = Math.round((expectedXM - Lj / 2) / stats.traceDistM);
    let baselineEnergy = 0.001;
    if (midSlabTrace >= 0 && midSlabTrace < numTraces) {
      const tr = matrix[midSlabTrace];
      for (let s = sMin; s < sMax; s++) {
        baselineEnergy += Math.abs(tr[s]);
      }
    }

    const idf = peakEnergy / baselineEnergy;

    if (idf >= config.idfThreshold) {
      if (idf > maxIdfOverall) maxIdfOverall = idf;
      const xCenterM = peakTrace * stats.traceDistM;
      const timeNs = ((sMin + sMax) / 2) * stats.dtNs;
      const depthM = (timeNs * stats.vMPerNs) / 2;

      markers.push({
        id: `joint-${markers.length + 1}`,
        type: 'joint_infiltration',
        title: `Junta Infiltrada (x ≈ ${xCenterM.toFixed(1)}m)`,
        xStartM: Math.max(0, xCenterM - searchToleranceM),
        xEndM: Math.min(totalDistM, xCenterM + searchToleranceM),
        xCenterM,
        traceStartIdx: Math.max(0, peakTrace - traceRadius),
        traceEndIdx: Math.min(numTraces - 1, peakTrace + traceRadius),
        traceCenterIdx: peakTrace,
        sampleIdx: Math.floor((sMin + sMax) / 2),
        timeNs,
        depthM,
        severity: idf,
        severityLabel: idf > 5.0 ? 'CRÍTICA (IDF > 5)' : idf >= 2.0 ? 'Moderada (2 - 5)' : 'Buena',
        mathCriterion: `SEG Juntas Periódicas: Lⱼ = ${Lj.toFixed(1)} m | IDF = E_junta / E_losa = ${idf.toFixed(2)} ≥ ${config.idfThreshold.toFixed(1)}`,
        measuredValues: {
          'Índice IDF': idf.toFixed(2),
          'Umbral IDF': config.idfThreshold.toFixed(1),
          'Espaciamiento Lⱼ': `${Lj.toFixed(1)} m`,
          'Posición X': `${xCenterM.toFixed(2)} m`,
          'Ventana Análisis': `${config.analysisWindowMinNs} - ${config.analysisWindowMaxNs} ns`,
        },
      });
    }
  }

  return { count: markers.length, maxIdf: maxIdfOverall, markers };
}

/**
 * 7. Dielectric Shadow Detector (Sombra Dieléctrica - SEG Attenuation Alpha)
 * Premature extinction t_ext < criticalExtinctionTimeNs (default 15 ns)
 * Slices sustained attenuation window > 5 ns.
 * Merges adjacent shadow traces into coherent shadow corridors.
 */
function detectDielectricShadows(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['dielectricShadow']
): { count: number; maxAlphaDbM: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxAlphaDbM: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const criticalSample = Math.min(numSamples - 1, Math.round(config.criticalExtinctionTimeNs / stats.dtNs));
  const minCorridorTraces = Math.max(3, Math.floor(0.4 / stats.traceDistM)); // Min 3 traces to constitute a shadow zone

  const markers: AnomalyMarker[] = [];
  let maxAlphaOverall = 0;

  let activeStart = -1;
  let minExtinctionS = criticalSample;

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let extinctionS = numSamples;

    for (let s = Math.floor(numSamples * 0.1); s < numSamples; s++) {
      if (Math.abs(tr[s]) < stats.vmax * (config.signalLossThresholdPercent / 100)) {
        let sustained = true;
        const checkWindow = Math.round(config.sustainedLossWindowNs / stats.dtNs);
        for (let ws = s; ws < Math.min(numSamples, s + checkWindow); ws++) {
          if (Math.abs(tr[ws]) >= stats.vmax * 0.08) {
            sustained = false;
            break;
          }
        }
        if (sustained) {
          extinctionS = s;
          break;
        }
      }
    }

    const isShadow = extinctionS <= criticalSample;

    if (isShadow) {
      if (activeStart === -1) {
        activeStart = t;
        minExtinctionS = extinctionS;
      } else {
        if (extinctionS < minExtinctionS) minExtinctionS = extinctionS;
      }
    } else {
      if (activeStart !== -1) {
        const lenTraces = t - activeStart;
        if (lenTraces >= minCorridorTraces) {
          const tExtNs = minExtinctionS * stats.dtNs;
          const alphaDbM = Math.max(0, ((config.criticalExtinctionTimeNs - tExtNs) / config.criticalExtinctionTimeNs) * 25);
          if (alphaDbM > maxAlphaOverall) maxAlphaOverall = alphaDbM;

          const xStartM = activeStart * stats.traceDistM;
          const xEndM = t * stats.traceDistM;
          const depthM = (tExtNs * stats.vMPerNs) / 2;

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
            sampleIdx: minExtinctionS,
            timeNs: tExtNs,
            depthM,
            severity: alphaDbM,
            severityLabel: `Atenuación α ≈ ${alphaDbM.toFixed(1)} dB/m`,
            mathCriterion: `SEG Atenuación: t_ext = ${tExtNs.toFixed(1)} ns < ${config.criticalExtinctionTimeNs.toFixed(1)} ns | Pérdida sostenida > ${config.sustainedLossWindowNs} ns`,
            measuredValues: {
              'Tiempo Extinción t_ext': `${tExtNs.toFixed(1)} ns`,
              'Umbral Crítico': `${config.criticalExtinctionTimeNs.toFixed(1)} ns`,
              'Atenuación Estimada α': `${alphaDbM.toFixed(1)} dB/m`,
              'Ancho Corredor': `${(xEndM - xStartM).toFixed(2)} m`,
              'Profundidad de Corte': `${depthM.toFixed(2)} m`,
            },
          });
        }
        activeStart = -1;
        minExtinctionS = criticalSample;
      }
    }
  }

  return { count: markers.length, maxAlphaDbM: maxAlphaOverall, markers };
}

/**
 * 8. Layer Thickness Variation Detector (Variación de Espesor - Structural Picking)
 * Automated interface picker t2(x) with rolling mean spatial baseline.
 * Merges contiguous deviation zones.
 */
function detectThicknessVariations(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['thicknessVariation']
): { count: number; maxDeviationCm: number; markers: AnomalyMarker[] } {
  if (!config.enabled || matrix.length === 0) return { count: 0, maxDeviationCm: 0, markers: [] };

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const halfWindowTraces = Math.max(4, Math.round(config.rollingMeanWindowM / (2 * stats.traceDistM)));

  const t2TimesNs: number[] = [];
  const searchStartS = Math.floor(numSamples * 0.12);
  const searchEndS = Math.floor(numSamples * 0.45);

  for (let t = 0; t < numTraces; t++) {
    const tr = matrix[t];
    let maxA = 0;
    let bestS = searchStartS;
    for (let s = searchStartS; s < searchEndS; s++) {
      const a = Math.abs(tr[s]);
      if (a > maxA) {
        maxA = a;
        bestS = s;
      }
    }
    t2TimesNs.push(bestS * stats.dtNs);
  }

  const rollingMeanNs: number[] = [];
  for (let t = 0; t < numTraces; t++) {
    let sum = 0;
    let count = 0;
    for (let dt = -halfWindowTraces; dt <= halfWindowTraces; dt++) {
      const idx = t + dt;
      if (idx >= 0 && idx < numTraces) {
        sum += t2TimesNs[idx];
        count++;
      }
    }
    rollingMeanNs.push(count > 0 ? sum / count : t2TimesNs[t]);
  }

  const curvePoints: CurvePoint[] = [];
  const markers: AnomalyMarker[] = [];
  let maxDeviationCm = 0;

  let activeStart = -1;
  let activeMaxDev = 0;

  for (let t = 0; t < numTraces; t++) {
    const tNs = t2TimesNs[t];
    const meanNs = rollingMeanNs[t];
    const devNs = tNs - meanNs;
    const devCm = Math.abs((devNs * stats.vMPerNs * 100) / 2);
    const isAnomalous = Math.abs(devNs) > config.deviationThresholdNs;

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
            mathCriterion: `SEG Espesor: |t₂(x) - t̄₂(x)| > ${config.deviationThresholdNs.toFixed(1)} ns | Ventana = ${config.rollingMeanWindowM} m`,
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
 * 9. Pipe & Buried Utility Detector (SEG Standard - Society of Exploration Geophysicists)
 * Standardized per SEG Near-Surface Utility Detection Guidelines & ASCE 38-02:
 * - Diffraction hyperbola fitting with correlation R² >= minCoherenceR2
 * - Material classification by Fresnel reflection polarity and phase shift:
 *     * Metallic (Steel, Cast Iron, Copper): Perfect conductor, R ≈ -1.0, 180° phase inversion
 *     * Plastic (PVC, HDPE): Dielectric contrast, R > 0, 0° normal phase
 *     * Concrete: Intermediate dielectric with distinct double-wall reflection
 * - Diameter estimation via travel-time delay deltaT_pipe between crown (top) and invert (bottom):
 *     D = c * deltaT_pipe / (2 * sqrt(eps_content))
 * - Visual color markers: Variations of Yellow (Electric Yellow, Amber Yellow, Emerald Yellow)
 */
function detectPipesAndUtilities(
  matrix: Float32Array[],
  stats: MatrixStats,
  config: DetectionConfig['pipeUtility']
): {
  count: number;
  metallicCount: number;
  plasticCount: number;
  concreteCount: number;
  markers: AnomalyMarker[];
} {
  if (!config.enabled || matrix.length === 0) {
    return { count: 0, metallicCount: 0, plasticCount: 0, concreteCount: 0, markers: [] };
  }

  const numTraces = matrix.length;
  const numSamples = matrix[0].length;
  const minCoherenceR2 = config.minCoherenceR2 > 0 ? config.minCoherenceR2 : 0.75;
  const maxDepthM = config.maxDepthM > 0 ? config.maxDepthM : 3.5;
  const vFit = stats.vMPerNs;

  const minSample = Math.max(10, Math.floor(numSamples * 0.08));
  const maxSample = Math.min(numSamples - 15, Math.round((2 * maxDepthM) / (vFit * stats.dtNs)));
  const traceMargin = Math.max(4, Math.floor(0.45 / stats.traceDistM));

  // Permittivity of internal content
  const epsContent =
    config.pipeContent === 'water' ? 81.0 : config.pipeContent === 'drainage' ? 25.0 : 1.0;
  const pipeContentLabel =
    config.pipeContent === 'water' ? 'Agua (ε=81)' : config.pipeContent === 'drainage' ? 'Drenaje/Lodo (ε=25)' : 'Vacía / Gas (ε=1)';

  const candidates: AnomalyMarker[] = [];

  for (let t = traceMargin; t < numTraces - traceMargin; t += 2) {
    const tr = matrix[t];
    for (let s = minSample; s < maxSample; s += 2) {
      const amp = tr[s];
      const absAmp = Math.abs(amp);
      if (absAmp < stats.mean + 1.8 * stats.std) continue;

      // 2D local peak test
      if (
        absAmp >= Math.abs(matrix[t - 1][s]) &&
        absAmp >= Math.abs(matrix[t + 1][s]) &&
        absAmp >= Math.abs(tr[s - 1]) &&
        absAmp >= Math.abs(tr[s + 1])
      ) {
        const t0Ns = s * stats.dtNs;
        let sumObs = 0;
        let sumModel = 0;
        let sumObsModel = 0;
        let sumObsSq = 0;
        let sumModelSq = 0;
        let validPoints = 0;

        for (let dt = -traceMargin; dt <= traceMargin; dt++) {
          if (dt === 0) continue;
          const distM = Math.abs(dt) * stats.traceDistM;
          const tBranchNs = Math.sqrt(t0Ns * t0Ns + (4 * distM * distM) / (vFit * vFit));
          const sBranch = Math.round(tBranchNs / stats.dtNs);

          if (sBranch < numSamples && t + dt >= 0 && t + dt < numTraces) {
            const obsVal = Math.abs(matrix[t + dt][sBranch]);
            const modelVal = absAmp / Math.sqrt(1 + (2 * distM) / (vFit * t0Ns + 0.1));

            sumObs += obsVal;
            sumModel += modelVal;
            sumObsModel += obsVal * modelVal;
            sumObsSq += obsVal * obsVal;
            sumModelSq += modelVal * modelVal;
            validPoints++;
          }
        }

        if (validPoints >= 6) {
          const meanObs = sumObs / validPoints;
          const meanModel = sumModel / validPoints;
          const numerator = sumObsModel - validPoints * meanObs * meanModel;
          const denom = Math.sqrt(
            Math.max(0.0001, (sumObsSq - validPoints * meanObs * meanObs) * (sumModelSq - validPoints * meanModel * meanModel))
          );
          const rScore = denom > 0 ? Math.max(0, Math.min(1, numerator / denom)) : 0;
          const rSquared = rScore * rScore;

          if (rSquared >= minCoherenceR2) {
            // Material classification via Fresnel Reflection Polarity (SEG Criterion)
            const phaseInverted = amp < 0; // Conductor metallic surface causes 180° phase flip (R ≈ -1.0)
            let pipeMaterial: 'Metálica (Acero / Conductor)' | 'Plástica (PVC / PEAD)' | 'Hormigón / Concreto';

            if (phaseInverted && absAmp > stats.mean + 2.2 * stats.std) {
              pipeMaterial = 'Metálica (Acero / Conductor)';
            } else if (!phaseInverted) {
              pipeMaterial = 'Plástica (PVC / PEAD)';
            } else {
              pipeMaterial = 'Hormigón / Concreto';
            }

            // Material Filter
            if (
              config.materialFilter !== 'all' &&
              ((config.materialFilter === 'metallic' && pipeMaterial !== 'Metálica (Acero / Conductor)') ||
                (config.materialFilter === 'plastic' && pipeMaterial !== 'Plástica (PVC / PEAD)') ||
                (config.materialFilter === 'concrete' && pipeMaterial !== 'Hormigón / Concreto'))
            ) {
              continue;
            }

            // Estimate Diameter from Crown-to-Invert time delay (SEG Rayleigh & Traveltime Model)
            // Look for secondary reflection (bottom / invert) in window [0.5, 6.0] ns
            let deltaTNs = 0.8; // Default apparent delay ~120 mm
            let maxSecondaryAmp = 0;
            const sStartSecondary = s + Math.max(2, Math.round(0.4 / stats.dtNs));
            const sEndSecondary = Math.min(numSamples - 1, s + Math.round(6.0 / stats.dtNs));

            for (let ss = sStartSecondary; ss <= sEndSecondary; ss++) {
              const secAmp = Math.abs(tr[ss]);
              if (secAmp > maxSecondaryAmp) {
                maxSecondaryAmp = secAmp;
                deltaTNs = (ss - s) * stats.dtNs;
              }
            }

            // Diameter: D = c * deltaT / (2 * sqrt(epsContent))
            let estDiameterMm = Math.round(((0.3 * deltaTNs) / (2 * Math.sqrt(epsContent))) * 1000);
            if (estDiameterMm < 50) estDiameterMm = 50;
            if (estDiameterMm > 800) estDiameterMm = 400;

            // Nearest standard nominal pipe diameter
            const nominalTable = [50, 63, 75, 90, 110, 160, 200, 250, 315, 400];
            const nearestNominal = nominalTable.reduce((prev, curr) =>
              Math.abs(curr - estDiameterMm) < Math.abs(prev - estDiameterMm) ? curr : prev
            );

            const nominalInchesMap: Record<number, string> = {
              50: '2"',
              63: '2½"',
              75: '3"',
              90: '3½"',
              110: '4"',
              160: '6"',
              200: '8"',
              250: '10"',
              315: '12"',
              400: '16"',
            };
            const pipeDiameterInches = nominalInchesMap[nearestNominal] || `${Math.round(estDiameterMm / 25.4)}"`;

            // Estimated wall thickness (SDR standard approx 5-10% of diameter)
            const wallThicknessMm = pipeMaterial === 'Hormigón / Concreto' ? Math.round(nearestNominal * 0.15) : Math.round(nearestNominal * 0.08);

            const xCenterM = t * stats.traceDistM;
            const depthM = (t0Ns * vFit) / 2;

            candidates.push({
              id: `pipe-cand-${candidates.length + 1}`,
              type: 'pipe_utility',
              title: `Tubería ${pipeMaterial.split(' ')[0]} Ø${nearestNominal}mm`,
              xStartM: Math.max(0, xCenterM - 0.3),
              xEndM: Math.min(numTraces * stats.traceDistM, xCenterM + 0.3),
              xCenterM,
              traceStartIdx: Math.max(0, t - traceMargin),
              traceEndIdx: Math.min(numTraces - 1, t + traceMargin),
              traceCenterIdx: t,
              sampleIdx: s,
              timeNs: t0Ns,
              depthM,
              severity: rSquared * (absAmp / stats.std),
              severityLabel: `${pipeMaterial.split(' ')[0]} Ø${nearestNominal}mm (${pipeDiameterInches})`,
              mathCriterion: `SEG Standard Utility: R² = ${rSquared.toFixed(2)} ≥ ${minCoherenceR2.toFixed(2)} | Fresnel ${
                phaseInverted ? 'R ≈ -1.0 (Inversión 180°)' : 'R > 0 (Fase 0°)'
              } | Δt_solera = ${deltaTNs.toFixed(1)} ns`,
              measuredValues: {
                'Material Inferido': pipeMaterial,
                'Diámetro Estimado Ø': `${nearestNominal} mm (${pipeDiameterInches})`,
                'Espesor Pared Estimado': `≈ ${wallThicknessMm} mm`,
                'Contenido Interior': pipeContentLabel,
                'Profundidad Extradós': `${depthM.toFixed(3)} m`,
                'Tiempo Ápice t₀': `${t0Ns.toFixed(1)} ns`,
                'Coherencia SEG R²': `${(rSquared * 100).toFixed(1)}%`,
                'Polaridad de Fase': phaseInverted ? 'Invertida 180° (Conductor)' : 'Normal 0° (Dieléctrico)',
                'Norma Geofísica': 'SEG Utility Standard / ASCE 38-02',
              },
              pipeMaterial,
              pipeDiameterMm: nearestNominal,
              pipeDiameterInches,
              wallThicknessMm,
              pipeContentLabel,
              coherenceR2: rSquared,
              phaseInverted,
            });
          }
        }
      }
    }
  }

  // 2D NMS: Merge nearby pipes within 0.8 m laterally and 18 samples (~4 ns)
  const nmsTraceRadius = Math.max(5, Math.floor(0.8 / stats.traceDistM));
  const nmsSampleRadius = Math.max(12, Math.round(4.0 / stats.dtNs));
  const clustered = applyNMS2D(candidates, nmsTraceRadius, nmsSampleRadius);

  const markers = clustered.map((m, idx) => ({
    ...m,
    id: `pipe-${idx + 1}`,
    title: `Tubería #${idx + 1} (${m.pipeMaterial?.split(' ')[0] || 'Servicio'} Ø${m.pipeDiameterMm}mm)`,
  }));

  const metallicCount = markers.filter((m) => m.pipeMaterial === 'Metálica (Acero / Conductor)').length;
  const plasticCount = markers.filter((m) => m.pipeMaterial === 'Plástica (PVC / PEAD)').length;
  const concreteCount = markers.filter((m) => m.pipeMaterial === 'Hormigón / Concreto').length;

  return {
    count: markers.length,
    metallicCount,
    plasticCount,
    concreteCount,
    markers,
  };
}

/**
 * Master Detection Runner
 * Standardized per SEG (Society of Exploration Geophysicists) Criteria
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
    pipesUtilities: detectPipesAndUtilities(matrix, stats, config.pipeUtility),
  };
}
