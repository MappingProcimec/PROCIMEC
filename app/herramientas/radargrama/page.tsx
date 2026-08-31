'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GPRDataset, GPRTrace, parseGSFBuffer } from '@/lib/gpr/gsfParser';
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

  // Display Render parameters
  const [palette, setPalette] = useState<ColorPalette>('grayscale');
  const [contrast, setContrast] = useState<number>(1.2);
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
        newOptionsMap[ds.id] = { ...DEFAULT_DSP_OPTIONS };
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

  // Generate Synthetic Demo GSF Radargram for testing if no file uploaded
  const handleLoadDemoDataset = () => {
    const numTraces = 300;
    const numSamples = 512;
    const sampleIntervalNs = 0.1; // 100ps -> 51.2ns time window
    const traceDistanceStepM = 0.05; // 5cm between traces

    const rawMatrix: Float32Array[] = [];
    const processedMatrix: Float32Array[] = [];
    const traces: GPRTrace[] = [];

    // Synthesize radargram with direct wave, soil layers, and diffraction hyperbolas
    for (let t = 0; t < numTraces; t++) {
      const trace = new Float32Array(numSamples);
      const xM = t * traceDistanceStepM;

      for (let s = 0; s < numSamples; s++) {
        const tNs = s * sampleIntervalNs;
        let amp = 0;

        // Direct ground wave at t ~ 4ns
        amp += 3000 * Math.sin((tNs - 4) * 0.8) * Math.exp(-Math.pow((tNs - 4) / 1.5, 2));

        // Horizontal reflection layer 1 at t ~ 15ns
        amp += 1800 * Math.sin((tNs - 15) * 0.6) * Math.exp(-Math.pow((tNs - 15) / 2.0, 2));

        // Hyperbola 1 apex at trace 100, t0 = 24ns
        const dist1 = xM - (100 * traceDistanceStepM);
        const tHyp1 = Math.sqrt(24 * 24 + (4 * dist1 * dist1) / (0.1 * 0.1));
        amp += 2500 * Math.sin((tNs - tHyp1) * 0.7) * Math.exp(-Math.pow((tNs - tHyp1) / 1.8, 2));

        // Hyperbola 2 apex at trace 210, t0 = 35ns
        const dist2 = xM - (210 * traceDistanceStepM);
        const tHyp2 = Math.sqrt(35 * 35 + (4 * dist2 * dist2) / (0.1 * 0.1));
        amp += 3200 * Math.sin((tNs - tHyp2) * 0.7) * Math.exp(-Math.pow((tNs - tHyp2) / 2.0, 2));

        // Noise
        amp += (Math.random() - 0.5) * 150;

        trace[s] = amp;
      }

      rawMatrix.push(trace);
      processedMatrix.push(new Float32Array(trace));

      traces.push({
        id: t,
        positionM: xM,
        timeZeroShiftNs: 0,
        elevationM: 0,
        rawSamples: trace,
        processedSamples: trace,
      });
    }

    const demoDataset: GPRDataset = {
      id: `demo_${Date.now()}`,
      filename: 'Radargrama_Demostracion_GSF.gsf',
      header: {
        title: 'Radargrama Demostración GPRSoft',
        version: 1.0,
        numTraces,
        numSamples,
        sampleIntervalNs,
        timeWindowNs: numSamples * sampleIntervalNs,
        antennaFreqMHz: 500,
        dielectricPermittivity: 9.0,
        traceDistanceStepM,
        zeroOffsetNs: 0,
        byteOffsetData: 1024,
        bytesPerSample: 2,
        dataType: 'int16',
        headerSize: 1024,
      },
      traces,
      rawMatrix,
      processedMatrix,
      minAmplitude: -3500,
      maxAmplitude: 3500,
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
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Workstation Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-lg shadow-lg shadow-sky-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 flex items-center gap-2">
              Procesador Web de Radargramas (.GSF)
              <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                GPRSoft Engine v2.4
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Procesamiento Digital de Señales (DSP) en memoria de alto rendimiento
            </p>
          </div>
        </div>

        {/* Header Action Toolbar */}
        <div className="flex items-center gap-3">
          {/* File Upload Button */}
          <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition shadow-md shadow-sky-600/30">
            <Upload className="w-4 h-4" />
            <span>Cargar Archivo .GSF</span>
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
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2 transition border border-slate-700"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Cargar Ejemplo Demo</span>
          </button>

          {/* Export Dropdown Group */}
          {activeDataset && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              <button
                onClick={handleExportJPG}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
                title="Exportar Imagen JPG"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>JPG</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
                title="Exportar Reporte Técnico PDF"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                <span>Reporte PDF</span>
              </button>
              <button
                onClick={handleExportGSF}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
                title="Descargar Binario GSF Modificado"
              >
                <FileDown className="w-4 h-4 text-sky-400" />
                <span>Binario GSF</span>
              </button>
              {datasets.length > 1 && (
                <button
                  onClick={handleExportBatchPPTX}
                  className="p-1.5 hover:bg-slate-700 rounded text-amber-300 hover:text-amber-200 transition text-xs flex items-center gap-1 font-semibold"
                  title="Exportar Presentación PPTX en Lote"
                >
                  <Presentation className="w-4 h-4 text-amber-400" />
                  <span>PPTX Lote ({datasets.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Dataset Tab Bar (Multi-file batch manager) */}
      {datasets.length > 0 && (
        <div className="h-10 bg-slate-900/60 border-b border-slate-800 px-4 flex items-center gap-2 overflow-x-auto">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              onClick={() => setActiveDatasetId(ds.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer text-xs transition ${
                activeDatasetId === ds.id
                  ? 'bg-slate-950 border-slate-700 text-sky-400 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="max-w-[150px] truncate">{ds.filename}</span>
              <button
                onClick={(e) => handleRemoveDataset(ds.id, e)}
                className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeDataset ? (
          <>
            {/* Center Canvas Viewport */}
            <div className="flex-1 p-3 flex flex-col bg-slate-950 relative overflow-hidden">
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
            <DSPOptionsPanel
              options={activeOptions}
              onChange={handleDSPOptionsChange}
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
          </>
        ) : (
          /* Empty State Dropzone */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
            <div className="max-w-md w-full p-8 bg-slate-900/60 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center text-center space-y-4 backdrop-blur-xl shadow-2xl">
              <div className="p-4 bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20">
                <Upload className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-100">Sin Radargrama Cargado</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Arrastra y suelta tus archivos binarios <code>.gsf</code> aquí o carga el conjunto de demostración para iniciar el análisis DSP en vivo.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-lg shadow-sky-600/30">
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar Archivo GSF</span>
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
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition border border-slate-700"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
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

  // Compute FFT Frequency Spectrum
  const { magnitudes } = computeFFT(processedTrace);

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Center baseline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Find max amp
    let maxA = 0;
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(processedTrace[i]) > maxA) maxA = Math.abs(processedTrace[i]);
    }
    if (maxA === 0) maxA = 1;

    // Draw trace waveform
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

  // Render FFT Spectrum Canvas
  useEffect(() => {
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Find max magnitude
    let maxMag = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
    }
    if (maxMag === 0) maxMag = 1;

    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Inspección de Traza A-Scan #{traceIdx}</span>
            <span className="text-xs font-mono text-slate-400">({distM.toFixed(2)}m)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Waveform Plot */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-semibold">Señal Temporal A-Scan (Amplitud vs Tiempo/Muestras)</span>
              <span className="font-mono text-slate-400">{numSamples} muestras</span>
            </div>
            <canvas
              ref={waveformCanvasRef}
              width={600}
              height={140}
              className="w-full h-36 border border-slate-800 rounded-lg block"
            />
          </div>

          {/* FFT Spectrum Plot */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-semibold">Espectro de Frecuencias (Transformada FFT)</span>
              <span className="font-mono text-amber-400">Dominio de Frecuencia</span>
            </div>
            <canvas
              ref={fftCanvasRef}
              width={600}
              height={140}
              className="w-full h-36 border border-slate-800 rounded-lg block"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
          >
            Cerrar Inspección
          </button>
        </div>
      </div>
    </div>
  );
}
