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
} from '@/lib/gpr/exportEngine';
import {
  DetectionConfig,
  DetectionResults,
  DEFAULT_DETECTION_CONFIG,
  EMPTY_DETECTION_RESULTS,
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
} from 'lucide-react';

export default function RadargramaWorkstationPage() {
  // Datasets state
  const [datasets, setDatasets] = useState<GPRDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);

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

  // Apply specified DSP options to given dataset IDs
  const handleApplyOptionsToDatasets = (datasetIds: string[], options: DSPOptions) => {
    setDspOptionsMap((prev) => {
      const updated = { ...prev };
      datasetIds.forEach((id) => {
        updated[id] = { ...options };
      });
      return updated;
    });

    setBatchToast(`Procesamiento aplicado a ${datasetIds.length} perfiles.`);
    setTimeout(() => setBatchToast(null), 3500);
  };

  // Apply current active DSP options to ALL open datasets
  const handleBatchProcessAllOpen = () => {
    if (datasets.length === 0 || !activeOptions) return;
    const allIds = datasets.map((d) => d.id);
    handleApplyOptionsToDatasets(allIds, activeOptions);
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
          hpCutoffMHz: res.recommendedHpMHz,
          lpCutoffMHz: res.recommendedLpMHz,
          dewowWindowNs: res.recommendedDewowNs, // Siempre 2.0 o 3.0 ns
          dielectricPermittivity: ds.header.dielectricPermittivity || DIELECTRICO_DEF,
          ventanaNs: ds.header.timeWindowNs || VENTANA_TIEMPO_NS_DEF,
          traceDistanceStepM: ds.header.traceDistanceStepM || DX_DEF,
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
    const reBuiltDataset = buildDatasetFromHeader(activeDataset.rawBuffer, activeDataset.filename, updatedHeader);

    setDatasets((prev) =>
      prev.map((d) => (d.id === activeDataset.id ? { ...reBuiltDataset, id: d.id } : d))
    );
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

  // Single JPG Export (Full Distance Profile 0m to Total Distance)
  const handleExportJPG = async () => {
    if (activeDataset && activeProcessedMatrix) {
      await exportRadargramJPG(activeDataset, activeProcessedMatrix, activeOptions, palette, contrast, brightness);
    }
  };

  // Single PDF Technical Report Export (Full Distance Profile 0m to Total Distance)
  const handleExportPDF = async () => {
    if (activeDataset && activeProcessedMatrix) {
      await exportTechnicalPDFReport(activeDataset, activeProcessedMatrix, activeOptions, palette, contrast, brightness);
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

  // Batch PPTX Export (Full Distance Profile 0m to Total Distance for all datasets)
  const handleExportBatchPPTX = async () => {
    if (datasets.length === 0) return;
    const processedMatricesMap = new Map<string, Float32Array[]>();
    const optionsMap = new Map<string, DSPOptions>();

    datasets.forEach((ds) => {
      const opts = dspOptionsMap[ds.id] || DEFAULT_DSP_OPTIONS;
      const matrix = processRadargramDSP(ds, opts);
      processedMatricesMap.set(ds.id, matrix);
      optionsMap.set(ds.id, opts);
    });

    await exportBatchPPTX(datasets, processedMatricesMap, optionsMap, palette, contrast, brightness);
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
            <BackButton />
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
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-border py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border mb-1">
                      Formatos de Exportación
                    </div>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportJPG();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-emerald-50 flex items-center gap-2.5 transition text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Imagen JPG</div>
                        <div className="text-[10px] text-text-muted">Alta resolución con logo y escalas</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportPDF();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-red-50 flex items-center gap-2.5 transition text-left"
                    >
                      <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Reporte PDF (Bandera)</div>
                        <div className="text-[10px] text-text-muted">Formato continuo 1:1 con logo y metadatos</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportGSF();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-blue-50 flex items-center gap-2.5 transition text-left"
                    >
                      <FileDown className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-bold text-text-primary">Archivo Binario GSF</div>
                        <div className="text-[10px] text-text-muted">Dato binario procesado descargable</div>
                      </div>
                    </button>

                    <div className="border-t border-border my-1"></div>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportBatchPPTX();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-amber-50 flex items-center gap-2.5 transition text-left"
                    >
                      <Presentation className="w-4 h-4 text-accent flex-shrink-0" />
                      <div>
                        <div className="font-bold text-accent-700">Presentación PPTX ({datasets.length})</div>
                        <div className="text-[10px] text-text-muted">Diapositiva 16:9 con logo, radargrama y tabla</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dataset Tab Bar (Multi-file batch manager) */}
      {datasets.length > 0 && (
        <div className="bg-white border-b border-border px-4 sm:px-6 flex items-center justify-between overflow-x-auto h-11">
          <div className="flex items-center gap-2">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                onClick={() => setActiveDatasetId(ds.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                  activeDatasetId === ds.id
                    ? 'bg-primary-50 text-primary border-primary font-semibold shadow-xs'
                    : 'bg-gray-50 text-text-secondary border-border hover:bg-gray-100'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span className="max-w-[160px] truncate">{ds.filename}</span>
                <button
                  onClick={(e) => handleRemoveDataset(ds.id, e)}
                  className="p-0.5 hover:bg-red-100 rounded text-text-muted hover:text-red-600 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 max-w-[1600px] w-full mx-auto">
        {activeDataset ? (
          <>
            {/* Center Canvas Viewport */}
            <div className="flex-1 flex flex-col min-h-[600px] h-[calc(100vh-170px)]">
              <CanvasViewer
                dataset={activeDataset}
                processedMatrix={activeProcessedMatrix}
                palette={palette}
                contrast={contrast}
                brightness={brightness}
                dielectricPermittivity={activeOptions.dielectricPermittivity}
                ventanaNs={activeOptions.ventanaNs}
                traceDistanceStepM={activeOptions.traceDistanceStepM}
                onSelectTrace={(traceIdx) => setSelectedTraceIdx(traceIdx)}
                showHyperbolaTool={showHyperbolaTool}
                detectionConfig={activeDetectionConfig}
                detectionResults={activeDetectionResults}
              />
            </div>

            {/* Right DSP Options Panel */}
            <div className="h-[calc(100vh-170px)] rounded-2xl overflow-hidden border border-border">
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

                <button
                  onClick={handleLoadDemoDataset}
                  className="btn-outline btn-sm"
                >
                  <Sparkles className="w-4 h-4 text-accent-700" />
                  <span>Probar Demo</span>
                </button>
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
          customMacros={customMacros}
          onSaveCustomMacro={handleSaveCustomMacro}
          onApplyOptionsToDatasets={handleApplyOptionsToDatasets}
          onClose={() => setShowMacroModal(false)}
        />
      )}
    </div>
  );
}


