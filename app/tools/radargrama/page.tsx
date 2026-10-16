'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { GPRDataset, GPRTrace, GSFHeader, parseGSFBuffer, buildDatasetFromHeader, CABECERA_DEFAULT, DX_DEF, DIELECTRICO_DEF, VENTANA_TIEMPO_NS_DEF, TRAZAS_POR_METRO_DEF } from '@/lib/gpr/gsfParser';
import { DSPOptions, DEFAULT_DSP_OPTIONS, processRadargramDSP, GPRMacro, calculateResolution } from '@/lib/gpr/dspEngine';
import { CanvasViewer, ColorPalette } from '@/components/radargrama/CanvasViewer';
import { DSPOptionsPanel } from '@/components/radargrama/DSPOptionsPanel';
import { AScanInspectionModal } from '@/components/radargrama/AScanInspectionModal';
import { MacroManagerModal } from '@/components/radargrama/MacroManagerModal';
import {
  exportRadargramJPG,
  exportTechnicalPDFReport,
  exportModifiedGSF,
  exportBatchPPTX,
  exportBatchPDFReport,
} from '@/lib/gpr/exportEngine';
import {
  DetectionConfig,
  DetectionResults,
  DEFAULT_DETECTION_CONFIG,
  EMPTY_DETECTION_RESULTS,
  AnomalyMarker,
} from '@/lib/gpr/detectionTypes';
import { runAnomalyDetections } from '@/lib/gpr/detectionEngine';
import {
  Upload,
  FileSpreadsheet,
  FileDown,
  FileText,
  Presentation,
  Activity,
  Sparkles,
  X,
  FolderOpen,
  Wand2,
  Zap,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

/**
 * Miniature radargram preview for PowerPoint-style left slide sorter
 */
const ProfileMiniatureThumbnail: React.FC<{ dataset: GPRDataset; isActive: boolean }> = ({ dataset }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataset.rawMatrix || dataset.rawMatrix.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const matrix = dataset.rawMatrix;
    const numTraces = matrix.length;
    const numSamples = matrix[0]?.length || 0;
    if (numTraces === 0 || numSamples === 0) return;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    // Fast subsampling loop to fill w x h with real stratigraphy
    for (let y = 0; y < h; y++) {
      const sIdx = Math.floor((y / h) * numSamples);
      for (let x = 0; x < w; x++) {
        const tIdx = Math.floor((x / w) * numTraces);
        const amp = matrix[tIdx]?.[sIdx] || 0;
        const norm = Math.max(-1.0, Math.min(1.0, amp / 5000.0));
        const gray = Math.floor(((norm + 1.0) / 2.0) * 255);
        const ptr = (y * w + x) * 4;
        data[ptr] = gray;
        data[ptr + 1] = gray;
        data[ptr + 2] = gray;
        data[ptr + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [dataset]);

  return (
    <canvas
      ref={canvasRef}
      width={140}
      height={45}
      className="w-full h-full object-cover block opacity-90 group-hover:opacity-100 transition"
    />
  );
};

export default function RadargramaWorkstationPage() {
  // Datasets state
  const [datasets, setDatasets] = useState<GPRDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // DSP Options per dataset (map dataset ID -> options)
  const [dspOptionsMap, setDspOptionsMap] = useState<Record<string, DSPOptions>>({});

  // Display Render parameters (default 'grayscale')
  const [palette, setPalette] = useState<ColorPalette>('grayscale');
  const [contrast, setContrast] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(0);
  const [showHyperbolaTool, setShowHyperbolaTool] = useState<boolean>(false);

  // Processed trace matrix cache (map dataset ID -> Float32Array[])
  const [processedMatrices, setProcessedMatrices] = useState<Record<string, Float32Array[]>>({});

  // Selected A-Scan modal state
  const [selectedTraceIdx, setSelectedTraceIdx] = useState<number | null>(null);

  // Anomaly Detection State per dataset (map dataset ID -> DetectionConfig)
  const [detectionConfigMap, setDetectionConfigMap] = useState<Record<string, DetectionConfig>>({});
  const [detectionResultsMap, setDetectionResultsMap] = useState<Record<string, DetectionResults>>({});
  const [selectedAnomalyMarker, setSelectedAnomalyMarker] = useState<AnomalyMarker | null>(null);

  // Macro Manager & Batch Processing state
  const [showMacroModal, setShowMacroModal] = useState<boolean>(false);
  const [customMacros, setCustomMacros] = useState<GPRMacro[]>([]);
  const [batchToast, setBatchToast] = useState<string | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;
  const activeOptions = activeDatasetId && dspOptionsMap[activeDatasetId]
    ? dspOptionsMap[activeDatasetId]
    : DEFAULT_DSP_OPTIONS;
  const activeProcessedMatrix = activeDatasetId ? processedMatrices[activeDatasetId] || null : null;

  const activeDetectionConfig = activeDatasetId && detectionConfigMap[activeDatasetId]
    ? detectionConfigMap[activeDatasetId]
    : DEFAULT_DETECTION_CONFIG;

  const activeDetectionResults = activeDatasetId && detectionResultsMap[activeDatasetId]
    ? detectionResultsMap[activeDatasetId]
    : EMPTY_DETECTION_RESULTS;

  const handleDetectionConfigChange = (newConfig: DetectionConfig) => {
    if (!activeDatasetId) return;
    setDetectionConfigMap((prev) => ({
      ...prev,
      [activeDatasetId]: newConfig,
    }));
  };

  // Apply specified DSP options AND detection configuration to given dataset IDs
  const handleApplyOptionsToDatasets = (
    datasetIds: string[],
    options: DSPOptions,
    detectionConfig?: DetectionConfig
  ) => {
    const configToApply: DetectionConfig = detectionConfig
      ? JSON.parse(JSON.stringify(detectionConfig))
      : JSON.parse(JSON.stringify(activeDetectionConfig));

    setDspOptionsMap((prev) => {
      const updated = { ...prev };
      datasetIds.forEach((id) => {
        updated[id] = { ...options };
      });
      return updated;
    });

    setDetectionConfigMap((prev) => {
      const updated = { ...prev };
      datasetIds.forEach((id) => {
        updated[id] = JSON.parse(JSON.stringify(configToApply));
      });
      return updated;
    });

    // Recompute DSP matrices and run anomaly detections immediately for all affected datasets
    const newMatrices: Record<string, Float32Array[]> = {};
    const newDetections: Record<string, DetectionResults> = {};

    datasets.forEach((ds) => {
      if (datasetIds.includes(ds.id)) {
        const matrix = processRadargramDSP(ds, options);
        newMatrices[ds.id] = matrix;

        const results = runAnomalyDetections(
          matrix,
          options.ventanaNs,
          options.traceDistanceStepM,
          options.dielectricPermittivity,
          configToApply
        );
        newDetections[ds.id] = results;
      }
    });

    setProcessedMatrices((prev) => ({ ...prev, ...newMatrices }));
    setDetectionResultsMap((prev) => ({ ...prev, ...newDetections }));

    setBatchToast(`Procesamiento DSP y configuración de detección aplicados a ${datasetIds.length} perfiles.`);
    setTimeout(() => setBatchToast(null), 3500);
  };

  // Apply current active DSP options AND active detection config to ALL open datasets
  const handleBatchProcessAllOpen = () => {
    if (datasets.length === 0 || !activeOptions) return;
    const allIds = datasets.map((d) => d.id);
    handleApplyOptionsToDatasets(allIds, activeOptions, activeDetectionConfig);
  };

  // Save new custom macro preset
  const handleSaveCustomMacro = (macro: GPRMacro) => {
    setCustomMacros((prev) => [...prev, macro]);
  };

  // Run DSP pipeline whenever active dataset or its DSP options change
  useEffect(() => {
    if (!activeDataset) return;

    const processed = processRadargramDSP(activeDataset, activeOptions);
    setProcessedMatrices((prev) => ({
      ...prev,
      [activeDataset.id]: processed,
    }));
  }, [activeDataset, activeOptions]);

  // Run anomaly detections whenever dataset, processedMatrix, or detection configuration changes
  useEffect(() => {
    if (!activeDatasetId || !activeProcessedMatrix) return;

    const results = runAnomalyDetections(
      activeProcessedMatrix,
      activeOptions.ventanaNs,
      activeOptions.traceDistanceStepM,
      activeOptions.dielectricPermittivity,
      activeDetectionConfig
    );

    setDetectionResultsMap((prev) => ({
      ...prev,
      [activeDatasetId]: results,
    }));
  }, [
    activeDatasetId,
    activeProcessedMatrix,
    activeDetectionConfig,
    activeOptions.ventanaNs,
    activeOptions.traceDistanceStepM,
    activeOptions.dielectricPermittivity,
  ]);

  // Handle Binary GSF File Upload (Single or Batch)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDatasets: GPRDataset[] = [];
    const newOptionsMap: Record<string, DSPOptions> = { ...dspOptionsMap };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const ds = parseGSFBuffer(buffer, file.name);
        newDatasets.push(ds);

        // Cada perfil selecciona sus condiciones automáticamente según la antena detectada
        const detectedFreq = ds.header.antennaFreqMHz || 400;
        const res = calculateResolution(detectedFreq, ds.header.dielectricPermittivity || DIELECTRICO_DEF);
        newOptionsMap[ds.id] = {
          ...DEFAULT_DSP_OPTIONS,
          antennaFreqMHz: detectedFreq,
          hpCutoffMHz: ds.header.hpFilterHdr || res.recommendedHpMHz,
          lpCutoffMHz: ds.header.lpFilterHdr || res.recommendedLpMHz,
          dewowWindowNs: res.recommendedDewowNs, // Siempre 2.0 o 3.0 ns
          dielectricPermittivity: ds.header.dielectricPermittivity || DIELECTRICO_DEF,
          ventanaNs: ds.header.timeWindowNs || VENTANA_TIEMPO_NS_DEF,
          traceDistanceStepM: ds.header.traceDistanceStepM || DX_DEF,
          stackingFactor: ds.header.stackingHdr || 1,
        };
      } catch (err) {
        console.error(`Error al parsear el archivo ${file.name}:`, err);
      }
    }

    if (newDatasets.length > 0) {
      setDatasets((prev) => [...prev, ...newDatasets]);
      setDspOptionsMap(newOptionsMap);
      // Automatically switch view to newly uploaded profile
      setActiveDatasetId(newDatasets[newDatasets.length - 1].id);
    }
  };

  // Handle Header Calibration Override (live re-parsing from raw buffer)
  const handleHeaderOverride = (updatedHeader: GSFHeader) => {
    if (!activeDataset) return;
    const numSamples = updatedHeader.numSamples;
    const traceStrideBytes = updatedHeader.traceStrideBytes || ((numSamples + 10) * 2 + 40);
    const startByte = updatedHeader.byteOffsetData || 914;
    const maxTraces = Math.floor(Math.max(0, activeDataset.rawBuffer.byteLength - startByte - 23) / traceStrideBytes);
    const safeHeader: GSFHeader = {
      ...updatedHeader,
      traceStrideBytes,
      numTraces: updatedHeader.numTraces > 0 && updatedHeader.numTraces <= maxTraces ? updatedHeader.numTraces : (maxTraces > 0 ? maxTraces : updatedHeader.numTraces),
    };
    const reBuiltDataset = buildDatasetFromHeader(activeDataset.rawBuffer, activeDataset.filename, safeHeader);

    setDatasets((prev) =>
      prev.map((d) => (d.id === activeDataset.id ? { ...reBuiltDataset, id: d.id } : d))
    );

    // Live update active DSP options with new calibration
    setDspOptionsMap((prev) => ({
      ...prev,
      [activeDataset.id]: {
        ...(prev[activeDataset.id] || DEFAULT_DSP_OPTIONS),
        dielectricPermittivity: updatedHeader.dielectricPermittivity,
        ventanaNs: updatedHeader.timeWindowNs,
        traceDistanceStepM: updatedHeader.traceDistanceStepM,
        antennaFreqMHz: updatedHeader.antennaFreqMHz,
        hpCutoffMHz: updatedHeader.hpFilterHdr || prev[activeDataset.id]?.hpCutoffMHz || DEFAULT_DSP_OPTIONS.hpCutoffMHz,
        lpCutoffMHz: updatedHeader.lpFilterHdr || prev[activeDataset.id]?.lpCutoffMHz || DEFAULT_DSP_OPTIONS.lpCutoffMHz,
      },
    }));
  };

  // Generate Synthetic Demo GSF Radargram for testing if no file uploaded
  const handleLoadDemoDataset = () => {
    const numTraces = 400;
    const numSamples = 512;
    const sampleIntervalNs = 90.0 / numSamples;
    const traceDistanceStepM = DX_DEF;

    const rawMatrix: Float32Array[] = [];
    const processedMatrix: Float32Array[] = [];
    const traces: GPRTrace[] = [];

    for (let t = 0; t < numTraces; t++) {
      const trace = new Float32Array(numSamples);
      const xM = t * traceDistanceStepM;

      for (let s = 0; s < numSamples; s++) {
        const tNs = s * sampleIntervalNs;
        let amp = 0;

        amp += 6000 * Math.sin((tNs - 4.5) * 1.2) * Math.exp(-Math.pow((tNs - 4.5) / 1.6, 2));
        amp += 2800 * Math.sin((tNs - 18.0) * 0.9) * Math.exp(-Math.pow((tNs - 18.0) / 2.0, 2));
        amp += 2000 * Math.sin((tNs - 36.0) * 0.7) * Math.exp(-Math.pow((tNs - 36.0) / 2.5, 2));

        const dist1 = xM - (180 * traceDistanceStepM);
        const tHyp1 = Math.sqrt(24.0 * 24.0 + (4 * dist1 * dist1) / (0.122 * 0.122));
        amp += 4500 * Math.sin((tNs - tHyp1) * 1.1) * Math.exp(-Math.pow((tNs - tHyp1) / 1.8, 2));
        amp += (Math.random() - 0.5) * 150;

        trace[s] = amp;
      }

      rawMatrix.push(trace);
      processedMatrix.push(new Float32Array(trace));

      traces.push({
        id: t + 1,
        positionM: xM,
        timeZeroShiftNs: 0,
        elevationM: 0,
        rawSamples: trace,
        processedSamples: trace,
      });
    }

    const demoHeader: GSFHeader = {
      title: 'Radargrama_Demostracion_PROCIMEC',
      version: 1.0,
      numTraces,
      numSamples,
      sampleIntervalNs,
      timeWindowNs: 90.0,
      antennaFreqMHz: 400,
      dielectricPermittivity: 6.0,
      traceDistanceStepM,
      tracesPerMeter: TRAZAS_POR_METRO_DEF,
      zeroOffsetNs: 0,
      byteOffsetData: CABECERA_DEFAULT,
      traceHeaderBytes: 0,
      bytesPerSample: 2,
      dataType: 'int16',
      headerSize: CABECERA_DEFAULT,
      ventanaNsHdr: 90,
      muestrasHdr: 512,
      erHdr: 6.0,
      totalTrazasHdr: 400,
      stepHdr: DX_DEF,
    };

    const demoBuffer = new ArrayBuffer(CABECERA_DEFAULT + numTraces * numSamples * 2);

    const demoDataset: GPRDataset = {
      id: `demo_${Date.now()}`,
      filename: 'Perfil_Akula9000C_Demo.gsf',
      rawBuffer: demoBuffer,
      header: demoHeader,
      traces,
      rawMatrix,
      processedMatrix,
      minAmplitude: -6500,
      maxAmplitude: 6500,
      createdTime: Date.now(),
    };

    setDatasets((prev) => [...prev, demoDataset]);
    setDspOptionsMap((prev) => ({ ...prev, [demoDataset.id]: { ...DEFAULT_DSP_OPTIONS } }));
    setActiveDatasetId(demoDataset.id);
  };

  // Update active options
  const handleDSPOptionsChange = (newOptions: DSPOptions) => {
    if (!activeDatasetId) return;
    setDspOptionsMap((prev) => ({
      ...prev,
      [activeDatasetId]: newOptions,
    }));
  };

  // Reset active DSP
  const handleResetDSP = () => {
    if (!activeDatasetId) return;
    setDspOptionsMap((prev) => ({
      ...prev,
      [activeDatasetId]: { ...DEFAULT_DSP_OPTIONS },
    }));
  };

  // Single JPG Export (Full Distance Profile 0m to Total Distance with detections)
  const handleExportJPG = async () => {
    if (activeDataset && activeProcessedMatrix) {
      await exportRadargramJPG(
        activeDataset,
        activeProcessedMatrix,
        activeOptions,
        palette,
        contrast,
        brightness,
        activeDetectionConfig,
        activeDetectionResults
      );
    }
  };

  // Single PDF Technical Report Export (Full Distance Profile 0m to Total Distance with detections)
  const handleExportPDF = async () => {
    if (activeDataset && activeProcessedMatrix) {
      await exportTechnicalPDFReport(
        activeDataset,
        activeProcessedMatrix,
        activeOptions,
        palette,
        contrast,
        brightness,
        activeDetectionConfig,
        activeDetectionResults
      );
    }
  };

  // Single GSF Binary Export
  const handleExportGSF = () => {
    if (activeDataset && activeProcessedMatrix) {
      const updatedDataset: GPRDataset = {
        ...activeDataset,
        processedMatrix: activeProcessedMatrix,
      };
      exportModifiedGSF(updatedDataset, activeOptions);
    }
  };

  // Batch PPTX Export (Full Distance Profile 0m to Total Distance for all datasets with cover slide)
  const handleExportBatchPPTX = async () => {
    if (datasets.length === 0) return;
    const processedMatricesMap = new Map<string, Float32Array[]>();
    const optionsMap = new Map<string, DSPOptions>();
    const fullDetectionConfigMap: Record<string, DetectionConfig> = { ...detectionConfigMap };
    const fullDetectionResultsMap: Record<string, DetectionResults> = { ...detectionResultsMap };

    datasets.forEach((ds) => {
      const opts = dspOptionsMap[ds.id] || DEFAULT_DSP_OPTIONS;
      const matrix = processedMatrices[ds.id] || processRadargramDSP(ds, opts);
      processedMatricesMap.set(ds.id, matrix);
      optionsMap.set(ds.id, opts);

      const detCfg = fullDetectionConfigMap[ds.id] || activeDetectionConfig || DEFAULT_DETECTION_CONFIG;
      fullDetectionConfigMap[ds.id] = detCfg;

      if (!fullDetectionResultsMap[ds.id]) {
        fullDetectionResultsMap[ds.id] = runAnomalyDetections(
          matrix,
          opts.ventanaNs,
          opts.traceDistanceStepM,
          opts.dielectricPermittivity,
          detCfg
        );
      }
    });

    await exportBatchPPTX(
      datasets,
      processedMatricesMap,
      optionsMap,
      palette,
      contrast,
      brightness,
      fullDetectionConfigMap,
      fullDetectionResultsMap
    );
  };

  // Batch PDF Export (Full Distance Profile 0m to Total Distance for all datasets with cover sheet)
  const handleExportBatchPDF = async () => {
    if (datasets.length === 0) return;
    const processedMatricesMap = new Map<string, Float32Array[]>();
    const optionsMap = new Map<string, DSPOptions>();
    const fullDetectionConfigMap: Record<string, DetectionConfig> = { ...detectionConfigMap };
    const fullDetectionResultsMap: Record<string, DetectionResults> = { ...detectionResultsMap };

    datasets.forEach((ds) => {
      const opts = dspOptionsMap[ds.id] || DEFAULT_DSP_OPTIONS;
      const matrix = processedMatrices[ds.id] || processRadargramDSP(ds, opts);
      processedMatricesMap.set(ds.id, matrix);
      optionsMap.set(ds.id, opts);

      const detCfg = fullDetectionConfigMap[ds.id] || activeDetectionConfig || DEFAULT_DETECTION_CONFIG;
      fullDetectionConfigMap[ds.id] = detCfg;

      if (!fullDetectionResultsMap[ds.id]) {
        fullDetectionResultsMap[ds.id] = runAnomalyDetections(
          matrix,
          opts.ventanaNs,
          opts.traceDistanceStepM,
          opts.dielectricPermittivity,
          detCfg
        );
      }
    });

    await exportBatchPDFReport(
      datasets,
      processedMatricesMap,
      optionsMap,
      palette,
      contrast,
      brightness,
      fullDetectionConfigMap,
      fullDetectionResultsMap
    );
  };

  // Remove dataset
  const handleRemoveDataset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    if (activeDatasetId === id) {
      const remaining = datasets.filter((d) => d.id !== id);
      setActiveDatasetId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans select-none">
      {/* PROCIMEC Navigation Header */}
      <Navbar />

      {/* Hero / Header Bar */}
      <div className="bg-white border-b border-border shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton href="/dashboard" label="Volver a Mi Panel" variant="default" />
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">
                Procesador de Radargramas GPR
              </h1>
              <p className="text-xs text-text-muted">
                Workstation Geofísica de Procesamiento, Filtros DSP y Calibración (.gsf)
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* File Upload Button */}
            <label className="btn-primary btn-sm cursor-pointer shadow-glow">
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar .GSF</span>
              <input
                type="file"
                accept=".gsf,.bin"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Batch Process All Open Profiles */}
            <button
              onClick={handleBatchProcessAllOpen}
              disabled={datasets.length === 0}
              className="btn-outline btn-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 shadow-xs disabled:opacity-40"
              title="Aplicar el procesamiento actual a todos los perfiles abiertos"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Aplicar a Todos ({datasets.length})</span>
            </button>

            {/* Macros Manager Modal Button */}
            <button
              onClick={() => setShowMacroModal(true)}
              disabled={datasets.length === 0}
              className="btn-outline btn-sm font-bold text-primary bg-primary-50 hover:bg-primary-100 border-primary-300 shadow-xs disabled:opacity-40"
              title="Abrir gestor de macros y procesamiento por lotes o selección"
            >
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              <span>Macros (Lote)</span>
            </button>

            {/* Unified Export Button & Dropdown Menu */}
            {activeDataset && (
              <div className="relative" ref={exportDropdownRef}>
                <button
                  onClick={() => setShowExportDropdown((prev) => !prev)}
                  className="btn-outline btn-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-300 shadow-xs flex items-center gap-1.5"
                  title="Exportar radargrama en diferentes formatos"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Exportar</span>
                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showExportDropdown && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-border py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border mb-1">
                      Exportación Individual (Perfil Activo)
                    </div>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportJPG();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-emerald-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Imagen JPG</div>
                        <div className="text-[10px] text-text-muted">Alta resolución con escalas y anomalías</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportPDF();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-red-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Reporte PDF (Bandera)</div>
                        <div className="text-[10px] text-text-muted">Formato continuo 1:1 con logo y 3 bloques</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportGSF();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-blue-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Archivo Binario GSF</div>
                        <div className="text-[10px] text-text-muted">Dato binario procesado descargable</div>
                      </div>
                    </button>

                    <div className="border-t border-border my-1.5"></div>

                    <div className="px-3 py-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider border-b border-border mb-1 bg-amber-50/60">
                      Exportación en Lote (Todos los Perfiles)
                    </div>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportBatchPPTX();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-amber-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                    >
                      <Presentation className="w-4 h-4 text-accent flex-shrink-0" />
                      <div>
                        <div className="font-bold text-accent-700">Presentación PPTX en Lote ({datasets.length})</div>
                        <div className="text-[10px] text-text-muted">Con carátula, 3 bloques y detecciones</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportBatchPDF();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-rose-50 flex items-center gap-2.5 transition text-left cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-rose-700">Reporte PDF en Lote ({datasets.length})</div>
                        <div className="text-[10px] text-text-muted">Con carátula y perfiles continuos</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workstation Layout with PowerPoint-Style Left Sidebar */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3 w-full">
        {activeDataset ? (
          <>
            {/* LEFT: PowerPoint-Style Profile Slide Deck */}
            {datasets.length > 0 && (
              <aside
                className={`bg-white rounded-2xl border border-border shadow-2xs flex flex-col overflow-hidden flex-shrink-0 h-[calc(100vh-140px)] transition-all duration-200 ${
                  isSidebarCollapsed ? 'w-14' : 'w-56 sm:w-64'
                }`}
              >
                {/* Header of Slide Deck */}
                <div className="p-2.5 border-b border-border bg-gray-50/80 flex items-center justify-between">
                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-xs font-bold text-text-primary truncate">Perfiles GPR</span>
                      <span className="badge-primary text-[10px] px-1.5 py-0.2 font-mono font-bold flex-shrink-0">
                        {datasets.length}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {!isSidebarCollapsed && (
                      <label
                        className="p-1 hover:bg-gray-200 text-text-secondary hover:text-primary rounded-lg transition cursor-pointer"
                        title="Cargar más archivos .GSF"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <input type="file" accept=".gsf,.bin" multiple onChange={handleFileUpload} className="hidden" />
                      </label>
                    )}
                    <button
                      onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                      className="p-1 text-text-muted hover:text-text-primary hover:bg-gray-200 rounded-lg transition cursor-pointer"
                      title={isSidebarCollapsed ? 'Expandir panel de diapositivas' : 'Colapsar panel'}
                    >
                      {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Slides List (Vertical Scroll) */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {datasets.map((ds, index) => {
                    const isActive = activeDatasetId === ds.id;
                    const totalDistM = ds.header.numTraces * (ds.header.traceDistanceStepM || 1.0 / 112.0);

                    if (isSidebarCollapsed) {
                      return (
                        <div
                          key={ds.id}
                          onClick={() => setActiveDatasetId(ds.id)}
                          className={`w-10 h-10 mx-auto rounded-xl flex flex-col items-center justify-center cursor-pointer border transition text-xs font-mono font-bold ${
                            isActive
                              ? 'bg-[#EAA023] text-primary-900 border-amber-500 shadow-xs'
                              : 'bg-gray-50 text-text-secondary border-border hover:bg-gray-100'
                          }`}
                          title={`${ds.filename} (${ds.header.antennaFreqMHz || 400} MHz, ${totalDistM.toFixed(1)}m)`}
                        >
                          <span>{index + 1}</span>
                          <span className="text-[7.5px] font-sans opacity-85 leading-none">{ds.header.antennaFreqMHz || 400}M</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={ds.id}
                        onClick={() => setActiveDatasetId(ds.id)}
                        className={`group relative rounded-xl border transition-all cursor-pointer p-2 flex flex-col gap-1.5 select-none ${
                          isActive
                            ? 'bg-amber-50/70 border-accent ring-2 ring-accent shadow-xs'
                            : 'bg-white border-border hover:border-slate-300 hover:bg-gray-50/80 shadow-2xs'
                        }`}
                      >
                        {/* Slide Top: Number, Name, Delete */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 ${
                                isActive ? 'bg-[#EAA023] text-primary-900' : 'bg-gray-100 text-text-muted group-hover:bg-gray-200'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="text-xs font-bold text-text-primary truncate" title={ds.filename}>
                              {ds.filename}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleRemoveDataset(ds.id, e)}
                            className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded transition opacity-60 group-hover:opacity-100 flex-shrink-0"
                            title="Cerrar perfil"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Slide Preview Canvas */}
                        <div className="w-full h-14 bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 flex items-center justify-center shadow-inner">
                          <ProfileMiniatureThumbnail dataset={ds} isActive={isActive} />
                        </div>

                        {/* Slide Bottom Info: Frequency Badge and Total Distance */}
                        <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
                          <span className="bg-[#EAA023] text-primary-900 font-bold px-1.5 py-0.2 rounded text-[9px] shadow-2xs">
                            {ds.header.antennaFreqMHz || 400} MHz
                          </span>
                          <span className="text-text-secondary font-semibold">
                            {totalDistM.toFixed(1)}m <span className="text-text-muted font-normal">({ds.header.numTraces} tr)</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* Center Canvas Viewport */}
            <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-140px)]">
              <CanvasViewer
                dataset={activeDataset}
                processedMatrix={activeProcessedMatrix}
                palette={palette}
                contrast={contrast}
                brightness={brightness}
                dielectricPermittivity={activeOptions.dielectricPermittivity}
                ventanaNs={activeOptions.ventanaNs}
                traceDistanceStepM={activeOptions.traceDistanceStepM}
                mode={activeOptions.mode}
                onSelectTrace={(traceIdx) => setSelectedTraceIdx(traceIdx)}
                showHyperbolaTool={showHyperbolaTool}
                detectionConfig={activeDetectionConfig}
                detectionResults={activeDetectionResults}
                selectedMarker={selectedAnomalyMarker}
                onSelectMarker={setSelectedAnomalyMarker}
              />
            </div>

            {/* Right DSP Options Panel */}
            <div className="w-80 h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-border flex-shrink-0">
              <DSPOptionsPanel
                options={activeOptions}
                header={activeDataset.header}
                onChange={handleDSPOptionsChange}
                onHeaderChange={handleHeaderOverride}
                palette={palette}
                onPaletteChange={setPalette}
                contrast={contrast}
                onContrastChange={setContrast}
                brightness={brightness}
                onBrightnessChange={setBrightness}
                showHyperbolaTool={showHyperbolaTool}
                onToggleHyperbolaTool={setShowHyperbolaTool}
                onResetDSP={handleResetDSP}
                detectionConfig={activeDetectionConfig}
                onDetectionConfigChange={handleDetectionConfigChange}
                detectionResults={activeDetectionResults}
                onSelectMarker={setSelectedAnomalyMarker}
              />
            </div>
          </>
        ) : (
          /* Empty State Dropzone */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-md w-full p-8 bg-white border-2 border-dashed border-border rounded-3xl flex flex-col items-center text-center space-y-4 shadow-card">
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary">
                <Upload className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-text-primary">Sin Radargrama Cargado</h2>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Carga tus archivos <code>.gsf</code> (Geoscanners Akula9000C / GPRSoft) para visualizar el perfil geofísico en modo crudo o con filtros DSP.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="btn-primary btn-sm cursor-pointer shadow-glow">
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar Archivo .GSF</span>
                  <input
                    type="file"
                    accept=".gsf,.bin"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Processing Toast Alert */}
      {batchToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-bounce">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xl">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs font-semibold">{batchToast}</span>
        </div>
      )}

      {/* Modal for Detailed Single A-Scan Inspection & FFT Spectrum */}
      {selectedTraceIdx !== null && activeDataset && activeProcessedMatrix && (
        <AScanInspectionModal
          traceIdx={selectedTraceIdx}
          dataset={activeDataset}
          processedTrace={activeProcessedMatrix[selectedTraceIdx]}
          onClose={() => setSelectedTraceIdx(null)}
        />
      )}

      {/* Modal for Batch Processing & Macros Management */}
      {showMacroModal && (
        <MacroManagerModal
          datasets={datasets}
          activeOptions={activeOptions}
          activeDetectionConfig={activeDetectionConfig}
          customMacros={customMacros}
          onSaveCustomMacro={handleSaveCustomMacro}
          onApplyOptionsToDatasets={handleApplyOptionsToDatasets}
          onClose={() => setShowMacroModal(false)}
        />
      )}
    </div>
  );
}


