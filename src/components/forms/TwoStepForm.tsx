'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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

function makeDefault(field: Field, projectId?: string): unknown {
  switch (field.type) {
    case 'toggle': return false;
    case 'software-group': return {};
    case 'checkbox-group': return [];
    case 'select': return field.key === 'project_id' && projectId ? projectId : '';
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
  backHref = '/projects',
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
    } catch { /* ignore parse errors */ }
  }, [draftKey]);

  // Autosave draft
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(values)); } catch { /* ignore */ }
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

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={val as string}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={val as string}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="input"
            min={0}
            step={0.5}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={val as string}
            onChange={(e) => set(field.key, e.target.value)}
            className="input"
          />
        );

      case 'select': {
        if (field.key === 'project_id') {
          if (projectId) {
            const p = projects.find((pr) => pr.id === projectId);
            return (
              <div className="input bg-gray-50 text-text-secondary cursor-not-allowed select-none">
                {p ? `${p.cost_center || p.code || ''} — ${p.name}` : projectId}
              </div>
            );
          }
          return (
            <select value={val as string} onChange={(e) => set(field.key, e.target.value)} className="input">
              <option value="">Seleccionar proyecto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.cost_center || p.code || ''} — {p.name}</option>
              ))}
            </select>
          );
        }
        return (
          <select value={val as string} onChange={(e) => set(field.key, e.target.value)} className="input">
            <option value="">Seleccionar...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }

      case 'textarea':
        return (
          <textarea
            value={val as string}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="textarea"
          />
        );

      case 'toggle': {
        const checked = val as boolean;
        return (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => set(field.key, !checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              checked ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                checked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );
      }

      case 'software-group': {
        const sw = (val ?? {}) as SoftwareMap;
        return (
          <div className="space-y-3">
            {(field.options ?? []).map((opt) => {
              const entry = sw[opt.value] ?? { selected: false, hours: '' };
              return (
                <div key={opt.value}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.selected}
                      onChange={(e) =>
                        set(field.key, { ...sw, [opt.value]: { ...entry, selected: e.target.checked } })
                      }
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                  </label>

                  {entry.selected && (
                    <div className="ml-7 mt-2 space-y-2">
                      {opt.allowCustom && (
                        <input
                          type="text"
                          value={entry.customName ?? ''}
                          onChange={(e) =>
                            set(field.key, { ...sw, [opt.value]: { ...entry, customName: e.target.value } })
                          }
                          placeholder="Nombre del software..."
                          className="input text-sm"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={entry.hours}
                          onChange={(e) =>
                            set(field.key, { ...sw, [opt.value]: { ...entry, hours: e.target.value } })
                          }
                          placeholder="0"
                          className="input w-24 text-sm"
                          min={0}
                          step={0.5}
                        />
                        <span className="text-xs text-text-muted">horas</span>
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
    <div className="space-y-6">
      {/* Draft indicator */}
      {hasDraft && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-white border border-border shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-text-secondary">Borrador guardado</span>
            <button
              type="button"
              onClick={resetDraft}
              className="ml-1 text-xs text-text-muted hover:text-error transition-colors"
            >
              Borrar
            </button>
          </div>
        </div>
      )}

      {/* Step indicator (only when > 1 step) */}
      {totalSteps > 1 && (
        <div className="flex items-center gap-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-primary text-white' : s < step ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className={`text-sm font-medium ${step === s ? 'text-text-primary' : 'text-text-muted'}`}>
                {s === 1 ? 'Información' : 'Adjuntos'}
              </span>
              {s < totalSteps && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>
      )}

      <div className="card border border-border shadow-sm p-5 sm:p-6">
        {step === 1 ? (
          <div className="space-y-5">
            {formConfig.step1Fields.map((field) => {
              if (!isVisible(field, values)) return null;
              return (
                <div key={field.key} className="form-group">
                  <div className="flex items-center gap-3">
                    <label className={`label mb-0 ${field.required ? 'label-required' : ''}`}>
                      {field.label}
                    </label>
                    {field.type === 'toggle' && renderField(field)}
                  </div>
                  {field.type !== 'toggle' && (
                    <div className="mt-1.5">{renderField(field)}</div>
                  )}
                  {field.hint && <p className="text-xs text-text-muted mt-1">{field.hint}</p>}
                </div>
              );
            })}

            {submitError && <p className="error-msg">⚠️ {submitError}</p>}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="btn-ghost flex-1 py-2.5 text-sm rounded-xl"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleNextOrSubmit}
                disabled={submitting}
                className="btn-primary flex-1 py-2.5 text-sm rounded-xl font-semibold disabled:opacity-60"
              >
                {submitting
                  ? 'Enviando...'
                  : totalSteps > 1
                    ? 'Siguiente →'
                    : 'Enviar Formulario'}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Attachments */
          <div className="space-y-5">
            <div
              onDrop={(e) => {
                e.preventDefault();
                setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setAttachments((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
              <svg className="w-10 h-10 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-text-primary">Arrastra archivos o haz clic para seleccionar</p>
              <p className="text-xs text-text-muted mt-1">PDF, DWG, imágenes — máx. 50 MB por archivo</p>
            </div>

            {attachments.length > 0 && (
              <ul className="space-y-2">
                {attachments.map((file, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
                    <span className="truncate text-text-primary font-medium flex-1 mr-3">{file.name}</span>
                    <span className="text-text-muted text-xs flex-shrink-0 mr-3">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="text-error hover:text-error/80 text-lg leading-none flex-shrink-0"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {submitError && <p className="error-msg">⚠️ {submitError}</p>}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => { setStep(1); setSubmitError(''); }}
                className="btn-ghost flex-1 py-2.5 text-sm rounded-xl"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={handleNextOrSubmit}
                disabled={submitting}
                className="btn-primary flex-1 py-2.5 text-sm rounded-xl font-semibold disabled:opacity-60"
              >
                {submitting ? 'Enviando...' : 'Enviar Formulario'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
