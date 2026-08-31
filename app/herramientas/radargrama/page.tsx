'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { GPRDataset, GPRTrace, GSFHeader, parseGSFBuffer, buildDatasetFromHeader, CABECERA_DEFAULT, DX_DEF, DIELECTRICO_DEF, VENTANA_TIEMPO_NS_DEF, TRAZAS_POR_METRO_DEF } from '@/lib/gpr/gsfParser';
import { DSPOptions, DEFAULT_DSP_OPTIONS, processRadargramDSP, computeFFT } from '@/lib/gpr/dspEngine';
import { CanvasViewer, ColorPalette } from '@/components/radargrama/CanvasViewer';
import { DSPOptionsPanel } from '@/components/radargrama/DSPOptionsPanel';
import {
  exportRadargramJPG,
  exportTechnicalPDFReport,
  exportModifiedGSF,
  exportBatchPPTX,
} from '@/lib/gpr/exportEngine';
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
} from 'lucide-react';

export default function RadargramaWorkstationPage() {
  // Datasets state
  const [datasets, setDatasets] = useState<GPRDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);

  // DSP Options per dataset (map dataset ID -> options)
  const [dspOptionsMap, setDspOptionsMap] = useState<Record<string, DSPOptions>>({});

  // Display Render parameters (default 'seismic' matching the Python visualizer)
  const [palette, setPalette] = useState<ColorPalette>('seismic');
  const [contrast, setContrast] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(0);
  const [showHyperbolaTool, setShowHyperbolaTool] = useState<boolean>(false);

  // Processed trace matrix cache (map dataset ID -> Float32Array[])
  const [processedMatrices, setProcessedMatrices] = useState<Record<string, Float32Array[]>>({});

  // Selected A-Scan modal state
  const [selectedTraceIdx, setSelectedTraceIdx] = useState<number | null>(null);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;
  const activeOptions = activeDatasetId && dspOptionsMap[activeDatasetId]
    ? dspOptionsMap[activeDatasetId]
    : DEFAULT_DSP_OPTIONS;
  const activeProcessedMatrix = activeDatasetId ? processedMatrices[activeDatasetId] || null : null;

  // Run DSP pipeline whenever active dataset or its DSP options change
  useEffect(() => {
    if (!activeDataset) return;

    const processed = processRadargramDSP(activeDataset, activeOptions);
    setProcessedMatrices((prev) => ({
      ...prev,
      [activeDataset.id]: processed,
    }));
  }, [activeDataset, activeOptions]);

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
        newOptionsMap[ds.id] = {
          ...DEFAULT_DSP_OPTIONS,
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

      if (!activeDatasetId) {
        setActiveDatasetId(newDatasets[0].id);
      }
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

  // Single JPG Export
  const handleExportJPG = async () => {
    const canvas = document.querySelector('canvas');
    if (canvas && activeDataset) {
      await exportRadargramJPG(canvas, activeDataset.filename);
    }
  };

  // Single PDF Technical Report Export
  const handleExportPDF = async () => {
    const canvas = document.querySelector('canvas');
    if (canvas && activeDataset) {
      await exportTechnicalPDFReport(activeDataset, canvas, activeOptions);
    }
  };

  // Single GSF Binary Export
  const handleExportGSF = () => {
    if (activeDataset && activeProcessedMatrix) {
      const updatedDataset: GPRDataset = {
        ...activeDataset,
        processedMatrix: activeProcessedMatrix,
      };
      exportModifiedGSF(updatedDataset);
    }
  };

  // Batch PPTX Export
  const handleExportBatchPPTX = async () => {
    if (datasets.length === 0) return;
    const canvas = document.querySelector('canvas');
    const canvasMap = new Map<string, HTMLCanvasElement>();
    const optionsMap = new Map<string, DSPOptions>();

    datasets.forEach((ds) => {
      if (canvas) canvasMap.set(ds.id, canvas);
      optionsMap.set(ds.id, dspOptionsMap[ds.id] || DEFAULT_DSP_OPTIONS);
    });

    await exportBatchPPTX(datasets, canvasMap, optionsMap);
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-text-primary">
                  Procesador Web de Radargramas (.gsf)
                </h1>
                <span className="badge-primary text-[10px] px-2 py-0.5">Akula9000C / Geoscanners</span>
              </div>
              <p className="text-xs text-text-muted">
                Visualizador Geofísico GPR (Modo Crudo Original y Filtros DSP)
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Sample/Trace Switcher */}
            {activeDataset && (
              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-border">
                <span className="text-[10px] font-bold text-text-secondary mr-1">Muestras:</span>
                {[256, 512, 1024, 2048].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleHeaderOverride({ ...activeDataset.header, numSamples: s })}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                      activeDataset.header.numSamples === s
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-text-secondary hover:bg-gray-200 border border-border'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

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

            {/* Load Demo Data Button */}
            <button
              onClick={handleLoadDemoDataset}
              className="btn-outline btn-sm"
              title="Cargar radargrama de ejemplo"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-700" />
              <span>Cargar Ejemplo</span>
            </button>

            {/* Export Toolbar */}
            {activeDataset && (
              <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-border">
                <button
                  onClick={handleExportJPG}
                  className="px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-white rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                  title="Exportar imagen JPG"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>JPG</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-white rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                  title="Exportar reporte técnico PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={handleExportGSF}
                  className="px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-white rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                  title="Descargar binario GSF"
                >
                  <FileDown className="w-3.5 h-3.5 text-primary" />
                  <span>GSF</span>
                </button>
                {datasets.length > 1 && (
                  <button
                    onClick={handleExportBatchPPTX}
                    className="px-2.5 py-1 text-xs font-semibold text-accent-700 hover:bg-amber-50 rounded-lg transition flex items-center gap-1.5 border border-amber-200"
                    title="Exportar presentación en lote"
                  >
                    <Presentation className="w-3.5 h-3.5 text-accent" />
                    <span>PPTX Lote ({datasets.length})</span>
                  </button>
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
                onSelectTrace={(traceIdx) => setSelectedTraceIdx(traceIdx)}
                showHyperbolaTool={showHyperbolaTool}
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

      {/* Modal for Detailed Single A-Scan Inspection & FFT Spectrum */}
      {selectedTraceIdx !== null && activeDataset && activeProcessedMatrix && (
        <AScanInspectionModal
          traceIdx={selectedTraceIdx}
          dataset={activeDataset}
          processedTrace={activeProcessedMatrix[selectedTraceIdx]}
          onClose={() => setSelectedTraceIdx(null)}
        />
      )}
    </div>
  );
}

/**
 * Modal component for A-Scan waveform & FFT Spectrum inspection
 */
function AScanInspectionModal({
  traceIdx,
  dataset,
  processedTrace,
  onClose,
}: {
  traceIdx: number;
  dataset: GPRDataset;
  processedTrace: Float32Array;
  onClose: () => void;
}) {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const numSamples = processedTrace.length;
  const distM = traceIdx * dataset.header.traceDistanceStepM;

  const { magnitudes } = computeFFT(processedTrace);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    let maxA = 0;
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(processedTrace[i]) > maxA) maxA = Math.abs(processedTrace[i]);
    }
    if (maxA === 0) maxA = 1;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = (i / (numSamples - 1)) * w;
      const normVal = processedTrace[i] / maxA;
      const y = h / 2 - normVal * (h / 2 - 10);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [processedTrace, numSamples]);

  useEffect(() => {
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    let maxMag = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
    }
    if (maxMag === 0) maxMag = 1;

    ctx.strokeStyle = '#f5a623';
    ctx.fillStyle = 'rgba(245, 166, 35, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let i = 0; i < magnitudes.length; i++) {
      const x = (i / (magnitudes.length - 1)) * w;
      const normMag = magnitudes[i] / maxMag;
      const y = h - normMag * (h - 15);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, [magnitudes]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
            <Activity className="w-4 h-4 text-primary" />
            <span>Inspección de Traza A-Scan #{traceIdx + 1}</span>
            <span className="text-xs font-mono text-text-muted">({distM.toFixed(2)}m)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-full text-text-secondary hover:text-text-primary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-1.5 font-medium">
              <span>Señal Temporal A-Scan</span>
              <span className="font-mono text-text-muted">{numSamples} muestras</span>
            </div>
            <canvas
              ref={waveformCanvasRef}
              width={600}
              height={140}
              className="w-full h-36 border border-border rounded-2xl block bg-slate-950"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-1.5 font-medium">
              <span>Espectro de Frecuencias (Transformada FFT)</span>
              <span className="font-mono text-accent-700 font-bold">Dominio de Frecuencia</span>
            </div>
            <canvas
              ref={fftCanvasRef}
              width={600}
              height={140}
              className="w-full h-36 border border-border rounded-2xl block bg-slate-950"
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="btn-outline btn-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
