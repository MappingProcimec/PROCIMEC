'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Check, ArrowRight, ArrowLeft, Shield, Wrench, FileText, Globe } from 'lucide-react';

interface Division { id: string; name: string }
interface Tool { id: string; slug: string; name: string; category: string }
interface Form { id: string; slug: string; name: string }

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  gpr: 'GPR / Geofísica',
  cad: 'CAD / BIM',
  admin: 'Administración',
  universal: 'Universal',
  hseq: 'HSEQ',
  rrhh: 'Recursos Humanos',
};

const CATEGORY_COLOR: Record<string, string> = {
  gpr: 'border-blue-200 bg-blue-50/60',
  cad: 'border-amber-200 bg-amber-50/60',
  admin: 'border-purple-200 bg-purple-50/60',
  universal: 'border-emerald-200 bg-emerald-50/60',
  hseq: 'border-teal-200 bg-teal-50/60',
  rrhh: 'border-indigo-200 bg-indigo-50/60',
};

async function fetchDivisions(): Promise<Division[]> {
  const res = await fetch('/api/admin/divisions');
  const json = await res.json();
  return json.data ?? [];
}

async function fetchTools(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  const json = await res.json();
  return json.data ?? [];
}

async function fetchForms(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return json.data ?? [];
}

export function CreateRoleModal({ isOpen, onClose, onCreated }: CreateRoleModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const { data: divisions = [] } = useQuery({ queryKey: ['admin-divisions'], queryFn: fetchDivisions, enabled: isOpen });
  const { data: tools = [] } = useQuery({ queryKey: ['admin-tools'], queryFn: fetchTools, enabled: isOpen });
  const { data: forms = [] } = useQuery({ queryKey: ['admin-forms'], queryFn: fetchForms, enabled: isOpen });

  // Preseleccionar herramientas de administración por defecto
  useEffect(() => {
    if (tools.length > 0 && selectedTools.size === 0) {
      const adminToolIds = tools.filter((t) => t.category === 'admin').map((t) => t.id);
      setSelectedTools(new Set(adminToolIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, isOpen]);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setName('');
      setDivisionId('');
      setSelectedTools(new Set());
      setSelectedForms(new Set());
      setError('');
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          division_id: divisionId || null,
          tool_ids: Array.from(selectedTools),
          form_ids: Array.from(selectedForms),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear rol');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      if (onCreated) onCreated();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toolsByCategory = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleForm = (id: string) => {
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del rol es obligatorio');
      return;
    }
    setError('');
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Crear Nuevo Rol</h2>
              <p className="text-xs text-text-muted">Paso {step} de 2 — {step === 1 ? 'Datos Principales' : 'Asignación de Formularios y Herramientas'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-3">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s
                      ? 'bg-primary text-white shadow-xs'
                      : s < step
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-text-muted'
                  }`}
                >
                  {s < step ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : s}
                </div>
                <span className={`text-xs font-semibold ${step === s ? 'text-text-primary' : 'text-text-muted'}`}>
                  {s === 1 ? 'Información' : 'Herramientas y Formularios'}
                </span>
                {s < 2 && <span className="text-gray-300 text-xs">→</span>}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <form id="step1-form" onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Nombre del Rol <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Técnico GPR Senior, Modelador BIM, etc."
                  className="input text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  División Asignada
                </label>
                <div className="relative">
                  <select
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="input text-sm pl-9"
                  >
                    <option value="">🌐 Sin división (Global — aplicable a todas las áreas)</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <Globe className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                </div>
                <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                  Los roles globales pueden seleccionarse para colaboradores de cualquier división operativa de PROCIMEC.
                </p>
              </div>

              {error && <p className="text-xs text-error font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ {error}</p>}
            </form>
          ) : (
            <div className="space-y-6">
              {/* Sección Herramientas */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h3 className="font-bold text-text-primary text-sm">Asignar Herramientas ({selectedTools.size})</h3>
                </div>
                <p className="text-xs text-text-muted mb-3">Selecciona las herramientas técnicas a las que tendrá acceso este rol:</p>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(toolsByCategory).map(([cat, catTools]) => (
                    <div key={cat} className={`rounded-xl border p-3 ${CATEGORY_COLOR[cat] ?? 'border-gray-200 bg-gray-50'}`}>
                      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                        {CATEGORY_LABEL[cat] ?? cat}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catTools.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 cursor-pointer group text-xs text-text-primary">
                            <input
                              type="checkbox"
                              checked={selectedTools.has(t.id)}
                              onChange={() => toggleTool(t.id)}
                              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                            />
                            <span className="group-hover:text-primary transition-colors font-medium">
                              {t.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {tools.length === 0 && (
                    <p className="text-text-muted text-xs italic">No hay herramientas en el catálogo.</p>
                  )}
                </div>
              </div>

              {/* Sección Formularios */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <h3 className="font-bold text-text-primary text-sm">Asignar Formularios ({selectedForms.size})</h3>
                </div>
                <p className="text-xs text-text-muted mb-3">Formatos de captura de datos disponibles en "Mis Formularios":</p>

                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 max-h-48 overflow-y-auto">
                  {forms.length === 0 ? (
                    <p className="text-text-muted text-xs italic">No hay formularios disponibles.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {forms.map((f) => (
                        <label key={f.id} className="flex items-center gap-2 cursor-pointer group text-xs text-text-primary">
                          <input
                            type="checkbox"
                            checked={selectedForms.has(f.id)}
                            onChange={() => toggleForm(f.id)}
                            className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                          />
                          <span className="group-hover:text-primary transition-colors font-medium">
                            📋 {f.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-error font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">⚠️ {error}</p>}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface/50 gap-3">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs py-2 px-4 rounded-xl font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="step1-form"
                className="btn-primary text-xs py-2 px-5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <span>Continuar</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="btn-ghost text-xs py-2 px-4 rounded-xl font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Atrás</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost text-xs py-2 px-3 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="btn-primary text-xs py-2 px-5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Guardar y Activar Rol'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
