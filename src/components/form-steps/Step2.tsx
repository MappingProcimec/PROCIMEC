'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DetectedUtility } from '@/types';

const UTILITY_TYPES = [
  'Tubería Agua', 'Gas', 'Electricidad BT', 'Electricidad AT',
  'Telecomunicaciones', 'Alcantarillado', 'Cavidad', 'Sin identificar', 'Otro'
];

const CONFIDENCE_LEVELS = ['Alta', 'Media', 'Baja'] as const;

const PRIORITIES = [
  { value: 'Alta', color: 'error', desc: 'Urgente para entrega', icon: '🔴' },
  { value: 'Media', color: 'warning', desc: 'Prioridad normal', icon: '🟡' },
  { value: 'Baja', color: 'success', desc: 'Sin urgencia especial', icon: '🟢' },
] as const;

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step2({ onNext, onBack }: Step2Props) {
  const { section1, section2, updateSection2 } = useFormStore();

  const equipments = section1.equipments_used || ['GPR'];
  const hasGprOrPpr = equipments.some(e => e === 'GPR' || e === 'PPR');
  const hasRd = equipments.some(e => e === 'RD');

  const [antennaFrequency, setAntennaFrequency] = useState(section2.antenna_frequency || '');
  const [rdpValue, setRdpValue] = useState(section2.rdp_value || '');
  const [filterGainNotes, setFilterGainNotes] = useState(section2.filter_gain_notes || '');
  const [scansPerMeter, setScansPerMeter] = useState(section2.scans_per_meter || '');
  const [rdDataNotes, setRdDataNotes] = useState(section2.rd_data_notes || '');

  const [utilities, setUtilities] = useState<DetectedUtility[]>(section2.detected_utilities || []);
  const [anomaliesNotes, setAnomaliesNotes] = useState(section2.anomalies_notes || '');
  const [siteRestrictions, setSiteRestrictions] = useState(section2.site_restrictions || '');
  const [cadPriority, setCadPriority] = useState<'Alta' | 'Media' | 'Baja' | ''>(section2.cad_priority || 'Media');
  const [processingRecommendations, setProcessingRecommendations] = useState(section2.processing_recommendations || '');

  const [priorityError, setPriorityError] = useState('');

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

  const confidenceColor = (confidence: string) => {
    if (confidence === 'Alta') return 'badge-success';
    if (confidence === 'Media') return 'badge-warning';
    if (confidence === 'Baja') return 'badge-error';
    return 'badge-gray';
  };

  const handleNext = () => {
    if (!cadPriority) {
      setPriorityError('La prioridad de digitalización es requerida');
      return;
    }

    updateSection2({
      antenna_frequency: antennaFrequency,
      rdp_value: rdpValue,
      filter_gain_notes: filterGainNotes,
      scans_per_meter: scansPerMeter,
      rd_data_notes: rdDataNotes,
      detected_utilities: utilities,
      anomalies_notes: anomaliesNotes,
      site_restrictions: siteRestrictions,
      cad_priority: cadPriority,
      processing_recommendations: processingRecommendations,
    });
    onNext();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9.75 0H12" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Sección 2 — Configuración Técnica, Hallazgos y Notas de Oficina</h2>
          <p className="text-sm text-text-muted">Parámetros técnicos de equipos, interferencias halladas y prioridad CAD</p>
        </div>
      </div>

      {/* Dynamic Equipment Settings */}
      {hasGprOrPpr && (
        <div className="card p-5 space-y-4 bg-primary-50/40 border-primary-200">
          <h3 className="font-bold text-primary text-sm flex items-center gap-2">
            📡 Configuración Técnica GPR / PPR
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Frecuencia de antena</label>
              <input className="input" placeholder="Ej: 400 MHz, 800 MHz, 1.5 GHz..."
                value={antennaFrequency} onChange={e => setAntennaFrequency(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">RDP / Constante dieléctrica / Vel.</label>
              <input className="input" placeholder="Ej: RDP = 9 (v = 0.1 m/ns)"
                value={rdpValue} onChange={e => setRdpValue(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Filtro o rango recomendado</label>
              <input className="input" placeholder="Ej: Dewow, filtro de tiempo, ganancia SEC"
                value={filterGainNotes} onChange={e => setFilterGainNotes(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">Trazas por metro (Scans/m)</label>
              <input className="input" placeholder="Ej: 50 trazas/m"
                value={scansPerMeter} onChange={e => setScansPerMeter(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {hasRd && (
        <div className="card p-5 space-y-3 bg-amber-50/50 border-amber-200">
          <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2">
            ⚡ Datos y Configuración RD (Detector Electromagnético)
          </h3>
          <div className="form-group">
            <label className="label">Modos y frecuencias RD utilizadas</label>
            <textarea className="textarea min-h-[75px]" placeholder="Indica frecuencias (ej: 8kHz, 33kHz, Power, Radio) y modo directo/inductivo..."
              value={rdDataNotes} onChange={e => setRdDataNotes(e.target.value)} />
          </div>
        </div>
      )}

      {/* Hallazgos y Servicios Detectados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            🔍 Servicios e Interferencias Detectadas
          </h3>
          <span className="badge badge-primary">{utilities.length} detectados</span>
        </div>

        {utilities.length === 0 && (
          <div className="card p-6 text-center text-text-muted border-dashed">
            <p className="text-sm">Sin servicios registrados en esta sección aún</p>
            <p className="text-xs mt-1">Si identificaste tuberías, cables o anomalías, agrégalas aquí</p>
          </div>
        )}

        <div className="space-y-3">
          {utilities.map((util, idx) => (
            <div key={util.id} className="card p-4 space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary">Hallazgo {idx + 1}</span>
                  {util.confidence && (
                    <span className={`badge ${confidenceColor(util.confidence)}`}>
                      Confianza {util.confidence}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => removeUtility(util.id)}
                  className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group sm:col-span-2">
                  <label className="label">Tipo de servicio / anomalía</label>
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
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
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
                <textarea className="textarea min-h-[60px]" placeholder="Descripción del hallazgo, ubicación o notas..."
                  value={util.description}
                  onChange={e => updateUtility(util.id, 'description', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addUtility} className="btn-outline w-full mt-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar hallazgo / servicio detectado
        </button>
      </div>

      {/* Anomalies Notes */}
      <div className="form-group">
        <label className="label">Anomalías destacadas</label>
        <textarea className="textarea" placeholder="Describa anomalías encontradas durante el levantamiento..."
          value={anomaliesNotes} onChange={e => setAnomaliesNotes(e.target.value)} />
      </div>

      {/* Restrictions */}
      <div className="form-group">
        <label className="label">Restricciones o limitaciones encontradas en el sitio</label>
        <textarea className="textarea" placeholder="Ej: Cobertura vegetal, vehículos estacionados, interferencia metálica..."
          value={siteRestrictions} onChange={e => setSiteRestrictions(e.target.value)} />
      </div>

      {/* CAD Priority */}
      <div className="form-group pt-2 border-t border-border">
        <label className="label label-required">Prioridad de digitalización para Oficina / CAD</label>
        <div className="grid grid-cols-3 gap-3">
          {PRIORITIES.map(({ value, color, desc, icon }) => (
            <button key={value} type="button"
              onClick={() => { setCadPriority(value); setPriorityError(''); }}
              className={`card p-3 text-center transition-all duration-200 border-2 ${
                cadPriority === value
                  ? color === 'error' ? 'border-error bg-red-50 shadow-sm'
                    : color === 'warning' ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-success bg-emerald-50 shadow-sm'
                  : 'border-border hover:border-primary-200'
              }`}>
              <div className="text-xl mb-1">{icon}</div>
              <div className={`font-bold text-xs ${
                cadPriority === value
                  ? color === 'error' ? 'text-error' : color === 'warning' ? 'text-amber-600' : 'text-success'
                  : 'text-text-primary'
              }`}>{value}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
        {priorityError && <p className="error-msg">⚠ {priorityError}</p>}
      </div>

      {/* Additional CAD Notes */}
      <div className="form-group">
        <label className="label">Observaciones adicionales para posprocesamiento / CAD</label>
        <textarea className="textarea" placeholder="Instrucciones específicas para la digitalización del plano..."
          value={processingRecommendations} onChange={e => setProcessingRecommendations(e.target.value)} />
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
          Siguiente: Sección 3 (Archivos y Fotos)
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
