'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  UploadCloud,
  ArrowRight,
  ArrowLeft,
  Send,
  X,
  AlertCircle,
} from 'lucide-react';

// --- Field type system ---

export interface FieldOption {
  value: string;
  label: string;
  allowCustom?: boolean;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'toggle'
  | 'checkbox-group'
  | 'software-group';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
  hint?: string;
  colSpan?: 'full' | 'half';
  isCurrency?: boolean;
  isCode?: boolean;
  conditionalOn?: { key: string; truthy?: boolean; value?: string };
}

export interface FormConfig {
  name: string;
  description: string;
  hasAttachments: boolean;
  step1Fields: Field[];
}

export interface Project {
  id: string;
  name: string;
  cost_center?: string;
  code?: string;
}

interface TwoStepFormProps {
  formConfig: FormConfig;
  formSlug: string;
  projectId?: string;
  projects?: Project[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  backHref?: string;
}

type FormValues = Record<string, unknown>;
type SoftwareMap = Record<string, { selected: boolean; hours: string; customName?: string }>;

// --- Helpers ---

function isVisible(field: Field, values: FormValues): boolean {
  if (!field.conditionalOn) return true;
  const dep = values[field.conditionalOn.key];
  if (field.conditionalOn.truthy !== undefined) return Boolean(dep) === field.conditionalOn.truthy;
  if (field.conditionalOn.value !== undefined) return dep === field.conditionalOn.value;
  return true;
}

function isCurrencyField(field: Field): boolean {
  if (field.isCurrency) return true;
  const k = field.key.toLowerCase();
  return (
    k.includes('amount') ||
    k.includes('value') ||
    k.includes('subtotal') ||
    k.includes('total') ||
    k.includes('balance') ||
    k.includes('spent') ||
    k.includes('transport') ||
    k.includes('lodging') ||
    k.includes('meals') ||
    k.includes('tolls') ||
    k.includes('fuel') ||
    k.includes('tax')
  );
}

function isCodeField(field: Field): boolean {
  if (field.isCode) return true;
  const k = field.key.toLowerCase();
  return k.includes('code') || k.includes('nit') || k.includes('acta_number') || k.includes('reference');
}

function isFullWidthField(field: Field): boolean {
  if (field.colSpan === 'full') return true;
  if (field.colSpan === 'half') return false;
  if (field.type === 'textarea' || field.type === 'software-group' || field.type === 'checkbox-group') return true;
  const k = field.key.toLowerCase();
  if (k === 'title' || k === 'justification' || k === 'items_text' || k === 'scope_description' || k === 'project_id') {
    return true;
  }
  return false;
}

function makeDefault(field: Field, projectId?: string): unknown {
  switch (field.type) {
    case 'toggle': return false;
    case 'software-group': return {};
    case 'checkbox-group': return [];
    case 'select': {
      if (field.key === 'project_id' && projectId) return projectId;
      if (field.key.endsWith('_score')) return '5';
      if (field.key === 'priority' || field.key === 'cad_priority') return 'media';
      return '';
    }
    default: return '';
  }
}

function initValues(fields: Field[], projectId?: string): FormValues {
  return Object.fromEntries(fields.map((f) => [f.key, makeDefault(f, projectId)]));
}

// --- Main component ---

export default function TwoStepForm({
  formConfig,
  formSlug,
  projectId,
  projects = [],
  onSubmit,
  backHref = '/dashboard',
}: TwoStepFormProps) {
  const router = useRouter();
  const draftKey = `draft_${formSlug}_${projectId ?? 'global'}`;
  const totalSteps = formConfig.hasAttachments ? 2 : 1;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [values, setValues] = useState<FormValues>(() => initValues(formConfig.step1Fields, projectId));

  // Load draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        setValues((prev) => ({ ...prev, ...(JSON.parse(raw) as FormValues) }));
        setHasDraft(true);
      }
    } catch { /* ignore */ }
  }, [draftKey]);

  // Autosave draft con debounce (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values));
      } catch { /* ignore */ }
    }, 350);

    return () => clearTimeout(timer);
  }, [values, draftKey]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setHasDraft(false);
  }, [draftKey]);

  const resetDraft = () => {
    clearDraft();
    setValues(initValues(formConfig.step1Fields, projectId));
  };

  const set = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  // Validation
  const validate = (): string | null => {
    for (const field of formConfig.step1Fields) {
      if (!field.required || !isVisible(field, values)) continue;
      if (field.type === 'toggle') continue;
      if (field.type === 'software-group') {
        const sw = (values[field.key] ?? {}) as SoftwareMap;
        const selected = Object.values(sw).filter((e) => e.selected);
        if (selected.length === 0) return 'Selecciona al menos un software.';
        if (selected.some((e) => !e.hours)) return 'Ingresa las horas para cada software seleccionado.';
        continue;
      }
      const val = values[field.key];
      if (!val || (typeof val === 'string' && !val.trim())) {
        return `El campo "${field.label}" es obligatorio.`;
      }
    }
    return null;
  };

  const handleNextOrSubmit = async () => {
    const err = validate();
    if (err) { setSubmitError(err); return; }
    setSubmitError('');
    if (step < totalSteps) { setStep(2); return; }
    setSubmitting(true);
    try {
      await onSubmit(values);
      clearDraft();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error al enviar el formulario');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Field renderers ---

  const renderField = (field: Field) => {
    if (!isVisible(field, values)) return null;
    const val = values[field.key];
    const isCurrency = isCurrencyField(field);
    const isCode = isCodeField(field);

    // Interactive score selector 1-5 (Sobrio, sin spam de colores)
    if (field.key.endsWith('_score')) {
      const currentScore = String(val ?? '5');
      return (
        <div className="grid grid-cols-5 gap-2">
          {['1', '2', '3', '4', '5'].map((num) => {
            const isSelected = currentScore === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => set(field.key, num)}
                className={`py-2 rounded-xl text-center border font-mono font-bold text-sm transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-primary-700 text-white border-primary-800 ring-1 ring-accent shadow-xs'
                    : 'bg-white hover:bg-gray-50 border-border text-text-secondary'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      );
    }

    // Priority selector (Sobrio, profesional)
    if (field.key === 'priority' || field.key === 'cad_priority') {
      const currentPriority = String(val ?? 'media').toLowerCase();
      const priorities = [
        { id: 'baja', label: 'Baja' },
        { id: 'media', label: 'Media' },
        { id: 'alta', label: 'Alta' },
        { id: 'urgente', label: 'Urgente' },
      ];

      return (
        <div className="grid grid-cols-4 gap-2">
          {priorities.map((p) => {
            const isSelected = currentPriority === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => set(field.key, p.id)}
                className={`py-2 text-xs font-semibold rounded-xl border text-center transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-primary-700 text-white border-primary-800 ring-1 ring-accent shadow-xs'
                    : 'bg-white hover:bg-gray-50 border-border text-text-secondary'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      );
    }

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={(val as string) ?? ''}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`input ${isCode ? 'font-mono uppercase font-semibold text-text-primary' : ''}`}
          />
        );

      case 'number':
        return (
          <div className="relative">
            {isCurrency && (
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-text-muted pointer-events-none select-none">
                $
              </span>
            )}
            <input
              type="number"
              value={(val as string) ?? ''}
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder ?? (isCurrency ? '0.00' : '0')}
              className={`input font-mono ${isCurrency ? 'pl-8' : ''}`}
              min={0}
              step={isCurrency ? '100' : '0.5'}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={(val as string) ?? ''}
            onChange={(e) => set(field.key, e.target.value)}
            className="input text-text-primary font-mono"
          />
        );

      case 'select': {
        if (field.key === 'project_id') {
          if (projectId) {
            const p = projects.find((pr) => pr.id === projectId);
            return (
              <div className="input bg-gray-50 text-text-secondary cursor-not-allowed select-none flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-medium truncate">{p ? `${p.cost_center || p.code || ''} — ${p.name}` : projectId}</span>
              </div>
            );
          }
          return (
            <select
              value={(val as string) ?? ''}
              onChange={(e) => set(field.key, e.target.value)}
              className="select font-medium"
            >
              <option value="">Seleccionar proyecto asignado...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.cost_center || p.code ? `[${p.cost_center || p.code}] ` : ''}{p.name}
                </option>
              ))}
            </select>
          );
        }
        return (
          <select
            value={(val as string) ?? ''}
            onChange={(e) => set(field.key, e.target.value)}
            className="select"
          >
            <option value="">Seleccionar una opción...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      case 'textarea':
        return (
          <textarea
            value={(val as string) ?? ''}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={field.key.includes('items') ? 4 : 3}
            className="textarea leading-relaxed text-sm"
          />
        );

      case 'toggle': {
        const checked = Boolean(val);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => set(field.key, !checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
              checked ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                checked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );
      }

      case 'software-group': {
        const sw = (val ?? {}) as SoftwareMap;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-gray-50/70 rounded-xl border border-border">
            {(field.options ?? []).map((opt) => {
              const entry = sw[opt.value] ?? { selected: false, hours: '' };
              return (
                <div
                  key={opt.value}
                  className={`p-3 rounded-lg border transition-all ${
                    entry.selected
                      ? 'bg-white border-primary shadow-xs'
                      : 'bg-white/60 border-border/70 hover:border-gray-300'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.selected}
                      onChange={(e) =>
                        set(field.key, { ...sw, [opt.value]: { ...entry, selected: e.target.checked } })
                      }
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                  </label>

                  {entry.selected && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 space-y-2">
                      {opt.allowCustom && (
                        <input
                          type="text"
                          value={entry.customName ?? ''}
                          onChange={(e) =>
                            set(field.key, { ...sw, [opt.value]: { ...entry, customName: e.target.value } })
                          }
                          placeholder="Nombre del software..."
                          className="input text-xs py-1.5"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={entry.hours}
                          onChange={(e) =>
                            set(field.key, { ...sw, [opt.value]: { ...entry, hours: e.target.value } })
                          }
                          placeholder="8.5"
                          className="input w-24 text-xs py-1.5 font-mono text-center"
                          min={0}
                          step={0.5}
                        />
                        <span className="text-xs text-text-muted font-medium">horas</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // --- Render ---

  return (
    <div className="space-y-5">
      {/* Draft indicator */}
      {hasDraft && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-white/95 backdrop-blur-md border border-border shadow-soft rounded-xl px-3.5 py-2 flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-text-secondary font-medium">Borrador guardado</span>
            <button
              type="button"
              onClick={resetDraft}
              className="text-text-muted hover:text-error transition-colors underline font-medium ml-1"
            >
              Borrar
            </button>
          </div>
        </div>
      )}

      {/* Stepper minimalista */}
      {totalSteps > 1 && (
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Paso {step} de {totalSteps}:
            </span>
            <span className="text-xs font-semibold text-text-primary">
              {step === 1 ? 'Información y Registro' : 'Documentación y Adjuntos'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-10 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
            <div className={`h-1.5 w-10 rounded-full transition-colors ${step >= 2 ? 'bg-accent' : 'bg-gray-200'}`} />
          </div>
        </div>
      )}

      {/* Tarjeta principal del formulario */}
      <div className="card bg-white border border-border shadow-card p-5 sm:p-7 rounded-2xl">
        {step === 1 ? (
          <div className="space-y-5">
            {/* Grid ergonómico de campos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              {formConfig.step1Fields.map((field) => {
                if (!isVisible(field, values)) return null;
                const fullWidth = isFullWidthField(field);

                return (
                  <div
                    key={field.key}
                    className={`form-group ${fullWidth ? 'sm:col-span-2' : 'sm:col-span-1'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className={`label mb-1 text-xs font-semibold text-text-secondary ${field.required ? 'label-required' : ''}`}>
                        {field.label}
                      </label>
                      {field.type === 'toggle' && renderField(field)}
                    </div>
                    {field.type !== 'toggle' && (
                      <div>{renderField(field)}</div>
                    )}
                    {field.hint && (
                      <p className="text-[11px] text-text-muted mt-1 leading-normal">{field.hint}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="btn-ghost flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                Volver
              </button>
              <button
                type="button"
                onClick={handleNextOrSubmit}
                disabled={submitting}
                className="btn bg-primary-700 text-white hover:bg-primary-800 flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm hover:shadow-card disabled:opacity-60"
              >
                {submitting ? (
                  <span>Enviando información...</span>
                ) : totalSteps > 1 ? (
                  <>
                    <span>Siguiente: Adjuntos</span>
                    <ArrowRight className="w-4 h-4 text-accent" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-accent" strokeWidth={1.75} />
                    <span>Radicar Registro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Paso 2: Adjuntos */
          <div className="space-y-5">
            <div
              onDrop={(e) => {
                e.preventDefault();
                setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent hover:bg-gray-50/50 transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setAttachments((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-text-muted flex items-center justify-center mx-auto mb-2.5 group-hover:text-accent group-hover:bg-amber-50 transition-colors">
                <UploadCloud className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-text-primary">
                Arrastra tus archivos aquí o <span className="text-accent underline">selecciona desde tu equipo</span>
              </p>
              <p className="text-xs text-text-muted mt-1">PDF, DWG, DOCX, imágenes o ZIP (hasta 50 MB por archivo)</p>
            </div>

            {/* Lista de archivos */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Archivos adjuntos ({attachments.length})
                </p>
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 text-xs bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 truncate mr-3">
                        <FileText className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={1.75} />
                        <span className="font-medium text-text-primary truncate">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-text-muted text-[11px]">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className="w-5 h-5 rounded hover:bg-red-50 text-text-muted hover:text-error flex items-center justify-center transition-colors"
                          title="Remover archivo"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Acciones paso 2 */}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => { setStep(1); setSubmitError(''); }}
                className="btn-ghost flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                Atrás
              </button>
              <button
                type="button"
                onClick={handleNextOrSubmit}
                disabled={submitting}
                className="btn bg-primary-700 text-white hover:bg-primary-800 flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm hover:shadow-card disabled:opacity-60"
              >
                {submitting ? (
                  <span>Enviando información...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-accent" strokeWidth={1.75} />
                    <span>Finalizar y Radicar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
