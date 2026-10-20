'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  X,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  FileText,
  RotateCcw,
  Layers,
  Activity,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import type { FieldExtractionData, HseqAuditData } from '@/core/ai';

interface GentleCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: {
    projectName?: string;
    client?: string;
  };
}

type CopilotTab = 'field_notes' | 'hseq_audit' | 'gpr_summary';

export function GentleCopilotModal({ isOpen, onClose, initialContext }: GentleCopilotModalProps) {
  const [activeTab, setActiveTab] = useState<CopilotTab>('field_notes');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resultados estructurados
  const [extractedData, setExtractedData] = useState<FieldExtractionData | null>(null);
  const [auditData, setAuditData] = useState<HseqAuditData | null>(null);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Inicializar Web Speech Recognition si el navegador lo soporta
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-CO';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[SpeechRecognition] Error de audio:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignorar limpieza de audio
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMessage('El reconocimiento de voz no está disponible en este navegador. Puedes escribir el texto.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setErrorMessage(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Error al iniciar micrófono:', err);
        setIsListening(false);
      }
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      setErrorMessage('Por favor ingresa o dicta notas de campo para procesar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (activeTab === 'field_notes') {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract_field_notes',
            payload: {
              rawText: inputText,
              projectContext: {
                name: initialContext?.projectName,
                client: initialContext?.client,
              },
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al procesar notas de campo');
        setExtractedData(data.data as FieldExtractionData);
      } else if (activeTab === 'hseq_audit') {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'audit_hseq',
            payload: {
              formTitle: 'Inspección Operativa Pre-Firma',
              formData: {
                notas: inputText,
                responsable: 'Cuadrilla de Campo',
                fecha: new Date().toISOString(),
              },
              projectContext: {
                name: initialContext?.projectName,
                client: initialContext?.client,
              },
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al auditar cumplimiento');
        setAuditData(data.data as HseqAuditData);
      } else if (activeTab === 'gpr_summary') {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'summarize_gpr',
            payload: {
              project: {
                name: initialContext?.projectName || 'Exploración Geofísica Subsuperficial',
                client: initialContext?.client || 'Cliente Principal',
                description: inputText,
              },
              report: {
                report_date: new Date().toISOString().split('T')[0],
                localizador_name: 'Especialista Georadar',
                anomalies_notes: inputText,
              },
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al generar síntesis');
        setSummaryResult(data.data.summary);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado con el copiloto');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadExample = () => {
    if (activeTab === 'field_notes') {
      setInputText(
        'Hoy en la Carrera 15 con Calle 93 exploramos 450 metros lineales con el GPR IDS Stream C a 600 MHz. Detectamos tubería de gas de 4 pulgadas a 1.20 metros de profundidad con alta certidumbre y red eléctrica de media tensión a 0.85 metros. Terreno en asfalto con tráfico denso, clima soleado.'
      );
    } else if (activeTab === 'hseq_audit') {
      setInputText(
        'Inspección preoperacional de camioneta y georadar. El extintor tiene fecha de vencimiento vigente, pero el botiquín carece de vendas elásticas y uno de los conos de señalización está roto. El operador cuenta con casco, botas y chaleco reflectivo reglamentario.'
      );
    } else {
      setInputText(
        'Levantamiento de interferencias en corredor férreo tramo 2. Se realizaron 6 pasadas longitudinales con antena dual. Se georreferenciaron ductos de fibra óptica y cruces transversales de acueducto.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-title"
    >
      <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header Institucional */}
        <div className="px-5 py-4 border-b border-[#2A303C] flex items-center justify-between bg-[#15181D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAA023]/15 border border-[#EAA023]/30 flex items-center justify-center text-[#EAA023]">
              <Sparkles className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="copilot-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Copiloto PROCIMEC
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAA023] text-primary-900 uppercase">
                  Gentle AI
                </span>
              </div>
              <p className="text-xs text-white/60">
                Asistencia operativa de campo y aseguramiento técnico con IA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar copiloto"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Pestañas de Modo */}
        <div className="flex border-b border-[#2A303C] bg-[#1E2229] px-3 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('field_notes'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'field_notes'
                ? 'border-[#EAA023] text-[#EAA023] bg-[#2A303C]/40'
                : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-4 h-4" strokeWidth={1.75} />
            <span>Notas de Voz / Campo</span>
          </button>

          <button
            onClick={() => { setActiveTab('hseq_audit'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'hseq_audit'
                ? 'border-[#EAA023] text-[#EAA023] bg-[#2A303C]/40'
                : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
            <span>Pre-Auditor HSEQ</span>
          </button>

          <button
            onClick={() => { setActiveTab('gpr_summary'); setErrorMessage(null); }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'gpr_summary'
                ? 'border-[#EAA023] text-[#EAA023] bg-[#2A303C]/40'
                : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            <span>Síntesis Ejecutiva</span>
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Área de Entrada de Texto / Dictado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/80">
                {activeTab === 'field_notes' && 'Dicta o pega notas de avance, equipos y servicios:'}
                {activeTab === 'hseq_audit' && 'Condiciones o respuestas del formato a evaluar:'}
                {activeTab === 'gpr_summary' && 'Parámetros o notas operativas para redactar:'}
              </label>

              <button
                type="button"
                onClick={loadExample}
                className="text-xs text-[#EAA023] hover:underline flex items-center gap-1 font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Cargar ejemplo</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  activeTab === 'field_notes'
                    ? 'Ej: "Avanzamos 320 metros lineales en el tramo sur con GPR IDS Stream C, localizamos gas de 4 pulgadas a 1.2 metros..."'
                    : 'Describe las condiciones inspeccionadas...'
                }
                rows={4}
                className="w-full bg-[#15181D] border border-[#2A303C] rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#EAA023] focus:ring-1 focus:ring-[#EAA023] transition-all resize-none"
              />

              {/* Botón de Dictado por Voz */}
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                      : 'bg-[#2A303C] text-white/80 hover:text-white hover:bg-[#323946]'
                  }`}
                  title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" strokeWidth={1.75} />
                      <span className="text-[11px] font-bold">Escuchando...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" strokeWidth={1.75} />
                      <span className="text-[11px] hidden sm:inline">Dictar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Botón de Acción Principal */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setInputText('');
                setExtractedData(null);
                setAuditData(null);
                setSummaryResult(null);
              }}
              disabled={isLoading || !inputText}
              className="text-xs text-white/50 hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Limpiar</span>
            </button>

            <button
              type="button"
              onClick={handleProcess}
              disabled={isLoading || !inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#EAA023] hover:bg-[#f5aa2c] text-primary-900 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                  <span>Procesando con Gentle AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" strokeWidth={2} />
                  <span>Procesar con Copiloto</span>
                </>
              )}
            </button>
          </div>

          {/* RESULTADOS: Pestaña 1 - Extracción de Notas de Campo */}
          {activeTab === 'field_notes' && extractedData && (
            <div className="p-4 rounded-xl bg-[#15181D] border border-[#2A303C] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#2A303C] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#EAA023] flex items-center gap-1.5">
                  <Activity className="w-4 h-4" strokeWidth={1.75} />
                  Parámetros Extraídos (Zod Validated)
                </span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(extractedData, null, 2))}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1 bg-[#2A303C] px-2.5 py-1 rounded-lg"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
                </button>
              </div>

              {/* Grid de Métricas Principales */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#1E2229] p-2.5 rounded-lg border border-[#2A303C]">
                  <p className="text-[10px] text-white/50 uppercase font-semibold">Metros Lineales</p>
                  <p className="text-base font-mono font-bold text-[#EAA023]">
                    {extractedData.metrics.linear_meters != null ? `${extractedData.metrics.linear_meters} ML` : 'N/A'}
                  </p>
                </div>
                <div className="bg-[#1E2229] p-2.5 rounded-lg border border-[#2A303C]">
                  <p className="text-[10px] text-white/50 uppercase font-semibold">Área m²</p>
                  <p className="text-base font-mono font-bold text-white">
                    {extractedData.metrics.square_meters != null ? `${extractedData.metrics.square_meters} m²` : 'N/A'}
                  </p>
                </div>
                <div className="bg-[#1E2229] p-2.5 rounded-lg border border-[#2A303C]">
                  <p className="text-[10px] text-white/50 uppercase font-semibold">Prof. Máx</p>
                  <p className="text-base font-mono font-bold text-white">
                    {extractedData.metrics.max_depth_m != null ? `${extractedData.metrics.max_depth_m} m` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Servicios Detectados */}
              {extractedData.detected_utilities.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white/70">Redes y Servicios Detectados:</p>
                  <div className="space-y-1.5">
                    {extractedData.detected_utilities.map((u, i) => (
                      <div
                        key={i}
                        className="bg-[#1E2229] px-3 py-2 rounded-lg border border-[#2A303C] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.type}</span>
                          {u.diameter && <span className="font-mono text-white/70">({u.diameter})</span>}
                          {u.estimated_depth_m && (
                            <span className="text-white/50 font-mono">@ {u.estimated_depth_m}m</span>
                          )}
                        </div>
                        {u.confidence && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.confidence === 'Alta'
                                ? 'bg-green-900/60 text-green-300'
                                : u.confidence === 'Media'
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {u.confidence}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen extraído */}
              <div className="text-xs text-white/75 bg-[#1E2229] p-3 rounded-lg border border-[#2A303C]">
                <p className="font-semibold text-white mb-1">Síntesis:</p>
                <p>{extractedData.summary}</p>
              </div>
            </div>
          )}

          {/* RESULTADOS: Pestaña 2 - Pre-Auditor HSEQ */}
          {activeTab === 'hseq_audit' && auditData && (
            <div className="p-4 rounded-xl bg-[#15181D] border border-[#2A303C] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#2A303C] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#EAA023] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                  Dictamen HSEQ Pre-Firma
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    auditData.approved_for_signature
                      ? 'bg-green-500 text-primary-900'
                      : 'bg-amber-500 text-primary-900'
                  }`}
                >
                  Puntaje: {auditData.compliance_score}/100
                </span>
              </div>

              <div className="text-xs text-white/80 bg-[#1E2229] p-3 rounded-lg border border-[#2A303C]">
                <p className="font-semibold text-white mb-1">Evaluación General:</p>
                <p>{auditData.overall_assessment}</p>
              </div>

              {auditData.missing_requirements.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Requisitos Faltantes:
                  </p>
                  <ul className="text-xs text-white/70 space-y-1 pl-4 list-disc">
                    {auditData.missing_requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {auditData.preventive_recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white/80">Recomendaciones Preventivas:</p>
                  <ul className="text-xs text-white/60 space-y-1 pl-4 list-disc">
                    {auditData.preventive_recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* RESULTADOS: Pestaña 3 - Síntesis Ejecutiva */}
          {activeTab === 'gpr_summary' && summaryResult && (
            <div className="p-4 rounded-xl bg-[#15181D] border border-[#2A303C] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#2A303C] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#EAA023] flex items-center gap-1.5">
                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                  Párrafo Ejecutivo Generado
                </span>
                <button
                  onClick={() => copyToClipboard(summaryResult)}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1 bg-[#2A303C] px-2.5 py-1 rounded-lg"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                </button>
              </div>

              <div className="text-xs sm:text-sm text-white/90 bg-[#1E2229] p-3.5 rounded-lg border border-[#2A303C] leading-relaxed">
                {summaryResult}
              </div>
            </div>
          )}
        </div>

        {/* Footer Institucional */}
        <div className="px-5 py-3 border-t border-[#2A303C] bg-[#15181D] flex items-center justify-between text-xs text-white/50">
          <span>PROCIMEC INGENIERÍA S.A.S.</span>
          <span className="font-mono text-[11px] text-[#EAA023]">PCM CLOUD v2.4</span>
        </div>
      </div>
    </div>
  );
}
