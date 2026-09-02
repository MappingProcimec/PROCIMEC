/**
 * Geophysical Anomaly Detection Types & Constants for GPR Workstation
 * Standardized per physical constants:
 * c = 3x10^8 m/s | f = 500 MHz | v_default = 0.13 m/ns | lambda/4 = 6.5 cm | TWT = 0-40 ns
 */

export const GPR_PHYSICAL_CONSTANTS = {
  c_m_per_ns: 0.3, // 3x10^8 m/s = 0.3 m/ns
  f_hz: 500e6, // 500 MHz
  v_default: 0.13, // m/ns default EM velocity in dry asphalt/concrete
  getEpsilonR: (v: number) => Math.pow(0.3 / (v > 0 ? v : 0.13), 2),
  lambda_quarter_m: 0.065, // 6.5 cm
  twt_range_ns: [0, 40] as [number, number],
};

export type AnomalyType =
  | 'bright_spot'
  | 'hyperbola'
  | 'delamination'
  | 'subslab_void'
  | 'diffuse_scattering'
  | 'joint_infiltration'
  | 'dielectric_shadow'
  | 'thickness_variation'
  | 'pipe_utility';

// 1. Bright Spot Config
export interface BrightSpotConfig {
  enabled: boolean;
  thresholdSigma: number; // 1.5 - 4.0, default 2.5
  invertedOnly: boolean; // default true
  maxLateralExtentM: number; // default 2.0 m
}

// 2. Hyperbola Config
export interface HyperbolaConfig {
  enabled: boolean;
  depthDeviationM: number; // default 0.05 m
  amplitudeThresholdSigma: number; // default 2.0
  asymmetryRatio: number; // default 1.3
  velocityFitting: number; // default 0.13 m/ns
}

// 3. Delamination Config
export interface DelaminationConfig {
  enabled: boolean;
  minResolvableGapNs: number; // fixed 0.33 ns (= 50 mm)
  reflectionLossPercent: number; // default 40%
  phaseCondition: string; // 'First peak R > 0 (no inversion)'
}

// 4. Subslab Void Config
export interface SubslabVoidConfig {
  enabled: boolean;
  minVoidHeightMm: number; // 100 mm (dt = 0.67 ns)
  r2AmplitudeSigma: number; // > mu + 2.0 sigma
  r3FollowWindowMinNs: number; // 0.67 ns
  r3FollowWindowMaxNs: number; // 3.0 ns
  signalLossPercent: number; // default 50%
  pulsingCritical: boolean; // default true
}

// 5. Diffuse Scattering Config
export interface DiffuseScatteringConfig {
  enabled: boolean;
  cvaThreshold: number; // 0.30 - 0.90, default 0.50
  minLateralExtentM: number; // default 3 m
  fftDcEnergyDropPercent: number; // default 60%
}

// 6. Joint Infiltration Config
export interface JointInfiltrationConfig {
  enabled: boolean;
  expectedJointSpacingM: number; // 3 - 8 m, default 4.5 m
  idfThreshold: number; // 1.0 - 6.0, default 2.0
  analysisWindowMinNs: number; // default 0 ns
  analysisWindowMaxNs: number; // default 10 ns
}

// 7. Dielectric Shadow Config
export interface DielectricShadowConfig {
  enabled: boolean;
  signalLossThresholdPercent: number; // default 5%
  sustainedLossWindowNs: number; // default 5 ns
  criticalExtinctionTimeNs: number; // 8 - 25 ns, default 15 ns
}

// 8. Thickness Variation Config
export interface ThicknessVariationConfig {
  enabled: boolean;
  rollingMeanWindowM: number; // default 2 m
  deviationThresholdNs: number; // 0.5 - 3.0 ns, default 1.5 ns
}

// 9. Pipe & Buried Utility Config (SEG Standard - Society of Exploration Geophysicists)
export interface PipeUtilityConfig {
  enabled: boolean;
  materialFilter: 'all' | 'metallic' | 'plastic' | 'concrete';
  pipeContent: 'empty_gas' | 'water' | 'drainage';
  minCoherenceR2: number; // 0.60 - 0.95, default 0.75
  minDiameterMm: number; // default 50 mm
  maxDepthM: number; // default 3.5 m
}

export interface DetectionConfig {
  brightSpot: BrightSpotConfig;
  hyperbola: HyperbolaConfig;
  delamination: DelaminationConfig;
  subslabVoid: SubslabVoidConfig;
  diffuseScattering: DiffuseScatteringConfig;
  jointInfiltration: JointInfiltrationConfig;
  dielectricShadow: DielectricShadowConfig;
  thicknessVariation: ThicknessVariationConfig;
  pipeUtility: PipeUtilityConfig;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  brightSpot: {
    enabled: false,
    thresholdSigma: 2.5,
    invertedOnly: true,
    maxLateralExtentM: 2.0,
  },
  hyperbola: {
    enabled: false,
    depthDeviationM: 0.05,
    amplitudeThresholdSigma: 2.0,
    asymmetryRatio: 1.3,
    velocityFitting: 0.13,
  },
  delamination: {
    enabled: false,
    minResolvableGapNs: 0.33,
    reflectionLossPercent: 40,
    phaseCondition: 'First peak R > 0 (no inversion)',
  },
  subslabVoid: {
    enabled: false,
    minVoidHeightMm: 100,
    r2AmplitudeSigma: 2.0,
    r3FollowWindowMinNs: 0.67,
    r3FollowWindowMaxNs: 3.0,
    signalLossPercent: 50,
    pulsingCritical: true,
  },
  diffuseScattering: {
    enabled: false,
    cvaThreshold: 0.50,
    minLateralExtentM: 3.0,
    fftDcEnergyDropPercent: 60,
  },
  jointInfiltration: {
    enabled: false,
    expectedJointSpacingM: 4.5,
    idfThreshold: 2.0,
    analysisWindowMinNs: 0,
    analysisWindowMaxNs: 10,
  },
  dielectricShadow: {
    enabled: false,
    signalLossThresholdPercent: 5,
    sustainedLossWindowNs: 5,
    criticalExtinctionTimeNs: 15,
  },
  thicknessVariation: {
    enabled: false,
    rollingMeanWindowM: 2.0,
    deviationThresholdNs: 1.5,
  },
  pipeUtility: {
    enabled: false,
    materialFilter: 'all',
    pipeContent: 'empty_gas',
    minCoherenceR2: 0.75,
    minDiameterMm: 50,
    maxDepthM: 3.5,
  },
};

export interface CurvePoint {
  xM: number;
  traceIdx: number;
  sampleIdx: number;
  timeNs: number;
  depthM: number;
  deviationNs: number;
  deviationCm: number;
  isAnomalous: boolean;
}

export interface AnomalyMarker {
  id: string;
  type: AnomalyType;
  title: string;
  // Spatial coordinates
  xStartM: number;
  xEndM: number;
  xCenterM: number;
  traceStartIdx: number;
  traceEndIdx: number;
  traceCenterIdx: number;
  sampleIdx: number;
  timeNs: number;
  timeEndNs?: number;
  depthM: number;
  depthEndM?: number;
  // Metric and Severity
  severity: number;
  severityLabel: string;
  isCritical?: boolean;
  // Mathematical explanation & criterion
  mathCriterion: string;
  measuredValues: Record<string, string | number>;
  // For anomaly 8 following curve
  curvePoints?: CurvePoint[];
  // For anomaly 9 pipe utility (SEG Standard)
  pipeMaterial?: 'Metálica (Acero / Conductor)' | 'Plástica (PVC / PEAD)' | 'Hormigón / Concreto';
  pipeDiameterMm?: number;
  pipeDiameterInches?: string;
  wallThicknessMm?: number;
  pipeContentLabel?: string;
  coherenceR2?: number;
  phaseInverted?: boolean;
}

export interface DetectionResults {
  brightSpots: {
    count: number;
    markers: AnomalyMarker[];
  };
  hyperbolas: {
    count: number;
    markers: AnomalyMarker[];
  };
  delaminations: {
    count: number;
    markers: AnomalyMarker[];
  };
  subslabVoids: {
    count: number;
    criticalCount: number;
    markers: AnomalyMarker[];
  };
  diffuseScattering: {
    count: number;
    totalAffectedM: number;
    markers: AnomalyMarker[];
  };
  jointInfiltrations: {
    count: number;
    maxIdf: number;
    markers: AnomalyMarker[];
  };
  dielectricShadows: {
    count: number;
    maxAlphaDbM: number;
    markers: AnomalyMarker[];
  };
  thicknessVariations: {
    count: number;
    maxDeviationCm: number;
    markers: AnomalyMarker[];
  };
  pipesUtilities: {
    count: number;
    metallicCount: number;
    plasticCount: number;
    concreteCount: number;
    markers: AnomalyMarker[];
  };
}

export const EMPTY_DETECTION_RESULTS: DetectionResults = {
  brightSpots: { count: 0, markers: [] },
  hyperbolas: { count: 0, markers: [] },
  delaminations: { count: 0, markers: [] },
  subslabVoids: { count: 0, criticalCount: 0, markers: [] },
  diffuseScattering: { count: 0, totalAffectedM: 0, markers: [] },
  jointInfiltrations: { count: 0, maxIdf: 0, markers: [] },
  dielectricShadows: { count: 0, maxAlphaDbM: 0, markers: [] },
  thicknessVariations: { count: 0, maxDeviationCm: 0, markers: [] },
  pipesUtilities: {
    count: 0,
    metallicCount: 0,
    plasticCount: 0,
    concreteCount: 0,
    markers: [],
  },
};
