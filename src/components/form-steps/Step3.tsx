'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DetectedUtility } from '@/types';

const UTILITY_TYPES = [
  'Tubería Agua', 'Gas', 'Electricidad BT', 'Electricidad AT',
  'Telecomunicaciones', 'Alcantarillado', 'Cavidad', 'Sin identificar'
];
const CONFIDENCE_LEVELS = ['Alta', 'Media', 'Baja'] as const;

interface Step3Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step3({ onNext, onBack }: Step3Props) {
  const { step3, updateStep3 } = useFormStore();
  const [utilities, setUtilities] = useState<DetectedUtility[]>(step3.detected_utilities);
  const [anomaliesNotes, setAnomaliesNotes] = useState(step3.anomalies_notes);
  const [siteRestrictions, setSiteRestrictions] = useState(step3.site_restrictions);

  const addUtility = () => {
    setUtilities([...utilities, {
      id: uuidv4(),
      type: '',
      estimated_depth_m: '',
      confidence: '',
      description: '',
    }]);
  };

  const removeUtility = (id: string) => {
    setUtilities(utilities.filter(u => u.id !== id));
  };

  const updateUtility = (id: string, field: keyof DetectedUtility, value: string | number) => {
    setUtilities(utilities.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const handleNext = () => {
    updateStep3({
      detected_utilities: utilities,
      anomalies_notes: anomaliesNotes,
      site_restrictions: siteRestrictions,
    });
    onNext();
  };

  const confidenceColor = (confidence: string) => {
    if (confidence === 'Alta') return 'badge-success';
    if (confidence === 'Media') return 'badge-warning';
    if (confidence === 'Baja') return 'badge-error';
    return 'badge-gray';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Hallazgos y Anomalías Preliminares</h2>
          <p className="text-sm text-text-muted">Servicios y estructuras detectadas — sujeto a posprocesamiento</p>
        </div>
      </div>

      {/* Utilities list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-text-primary text-sm">Servicios / Interferencias Detectadas</h3>
          <span className="badge badge-primary">{utilities.length} detectados</span>
        </div>

        {utilities.length === 0 && (
          <div className="card p-6 text-center text-text-muted border-dashed">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm">Sin servicios detectados aún</p>
            <p className="text-xs mt-1">Agrega los servicios o estructuras identificadas durante el levantamiento</p>
          </div>
        )}

        <div className="space-y-3">
          {utilities.map((util, idx) => (
            <div key={util.id} className="card p-4 space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary">Servicio {idx + 1}</span>
                  {util.confidence && (
                    <span className={`badge ${confidenceColor(util.confidence)}`}>
                      Confianza {util.confidence}
                    </span>
                  )}
                </div>
                <button onClick={() => removeUtility(util.id)}
                  className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group sm:col-span-2">
                  <label className="label">Tipo de servicio</label>
                  <select className="select" value={util.type}
                    onChange={e => updateUtility(util.id, 'type', e.target.value)}>
                    <option value="">Seleccionar tipo...</option>
                    {UTILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Prof. Est. (m)</label>
                  <input type="number" min="0" step="0.01" className="input" placeholder="0.00"
                    value={util.estimated_depth_m}
                    onChange={e => updateUtility(util.id, 'estimated_depth_m', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Nivel de confianza</label>
                <div className="flex gap-2">
                  {CONFIDENCE_LEVELS.map(level => (
                    <button key={level} type="button"
                      onClick={() => updateUtility(util.id, 'confidence', level)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        util.confidence === level
                          ? level === 'Alta' ? 'bg-success border-success text-white'
                            : level === 'Media' ? 'bg-warning border-warning text-white'
                            : 'bg-error border-error text-white'
                          : 'border-border text-text-secondary hover:border-primary hover:bg-primary-50'
                      }`}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="label">Descripción</label>
                <textarea className="textarea min-h-[70px]" placeholder="Descripción del servicio detectado, características, notas..."
                  value={util.description}
                  onChange={e => updateUtility(util.id, 'description', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={addUtility} className="btn-outline w-full mt-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar servicio detectado
        </button>
      </div>

      {/* Anomalies notes */}
      <div className="form-group">
        <label className="label">Anomalías destacadas</label>
        <textarea className="textarea" placeholder="Describa anomalías encontradas durante el levantamiento (sujeto a posprocesamiento)..."
          value={anomaliesNotes}
          onChange={e => setAnomaliesNotes(e.target.value)} />
      </div>

      {/* Site restrictions */}
      <div className="form-group">
        <label className="label">Restricciones o limitaciones encontradas en sitio</label>
        <textarea className="textarea" placeholder="Ej: Zona de alto tráfico, cobertura vegetal densa, interferencias metálicas..."
          value={siteRestrictions}
          onChange={e => setSiteRestrictions(e.target.value)} />
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-ghost">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Anterior
        </button>
        <button type="button" onClick={handleNext} className="btn-primary btn-lg">
          Siguiente
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
