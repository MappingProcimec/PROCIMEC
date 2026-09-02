'use client';

import React, { useState } from 'react';
import { GPRDataset } from '@/lib/gpr/gsfParser';
import { DSPOptions, GPRMacro, BUILTIN_MACROS } from '@/lib/gpr/dspEngine';
import { Sparkles, Wand2, CheckSquare, Square, X, Save, Layers, Check, Zap } from 'lucide-react';

interface MacroManagerModalProps {
  datasets: GPRDataset[];
  activeOptions: DSPOptions;
  customMacros: GPRMacro[];
  onSaveCustomMacro: (macro: GPRMacro) => void;
  onApplyOptionsToDatasets: (datasetIds: string[], options: DSPOptions) => void;
  onClose: () => void;
}

export const MacroManagerModal: React.FC<MacroManagerModalProps> = ({
  datasets,
  activeOptions,
  customMacros,
  onSaveCustomMacro,
  onApplyOptionsToDatasets,
  onClose,
}) => {
  // File selection state (default all selected)
  const [selectedIds, setSelectedIds] = useState<string[]>(datasets.map((d) => d.id));

  // Custom macro creation input
  const [macroName, setMacroName] = useState('');
  const [macroDesc, setMacroDesc] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected macro to preview/apply
  const [activeMacro, setActiveMacro] = useState<GPRMacro>(BUILTIN_MACROS[0]);

  const allMacros = [...BUILTIN_MACROS, ...customMacros];

  const handleToggleSelectAll = () => {
    if (selectedIds.length === datasets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(datasets.map((d) => d.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Apply current active DSP options to selected or all files
  const handleApplyCurrentToSelected = () => {
    if (selectedIds.length === 0) return;
    onApplyOptionsToDatasets(selectedIds, activeOptions);
    setSuccessMessage(`Procesamiento actual aplicado a ${selectedIds.length} perfiles.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Apply chosen Macro options to selected files
  const handleApplyMacroToSelected = (macro: GPRMacro) => {
    if (selectedIds.length === 0) return;
    onApplyOptionsToDatasets(selectedIds, macro.options);
    setSuccessMessage(`Macro "${macro.name}" aplicada a ${selectedIds.length} perfiles.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Apply chosen Macro options to ALL files
  const handleApplyMacroToAll = (macro: GPRMacro) => {
    const allIds = datasets.map((d) => d.id);
    onApplyOptionsToDatasets(allIds, macro.options);
    setSuccessMessage(`Macro "${macro.name}" aplicada a TODOS los (${allIds.length}) perfiles.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save current active DSP configuration as a new custom Macro
  const handleSaveMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroName.trim()) return;

    const newMacro: GPRMacro = {
      id: `custom-macro-${Date.now()}`,
      name: macroName.trim(),
      description: macroDesc.trim() || 'Macro personalizada definida por usuario',
      options: { ...activeOptions },
    };

    onSaveCustomMacro(newMacro);
    setMacroName('');
    setMacroDesc('');
    setSuccessMessage(`Macro "${newMacro.name}" guardada correctamente.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-border rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5 text-text-primary font-bold text-base">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <span>Gestor de Macros & Procesamiento en Lote</span>
              <p className="text-xs text-text-muted font-normal">
                Aplica configuraciones DSP a todos o algunos de los perfiles abiertos ({datasets.length} perfiles)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-full text-text-secondary hover:text-text-primary transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* LEFT COLUMN: File Selector for Open Datasets (4 Cols) */}
          <div className="md:col-span-5 space-y-3 bg-slate-50 p-4 rounded-2xl border border-border flex flex-col">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>Perfiles Abiertos ({datasets.length})</span>
              </span>
              <button
                onClick={handleToggleSelectAll}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {selectedIds.length === datasets.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" /> Desmarcar Todos
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" /> Seleccionar Todos
                  </>
                )}
              </button>
            </div>

            {/* File List Checkboxes */}
            <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {datasets.map((ds) => {
                const isSelected = selectedIds.includes(ds.id);
                return (
                  <div
                    key={ds.id}
                    onClick={() => handleToggleSelect(ds.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-white border-primary text-primary font-semibold shadow-2xs'
                        : 'bg-white/60 border-border text-text-secondary hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-border text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                      />
                      <span className="truncate max-w-[180px]">{ds.filename}</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">
                      {ds.processedMatrix.length} tr
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Action: Apply current DSP to selected files */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={handleApplyCurrentToSelected}
                disabled={selectedIds.length === 0}
                className="w-full btn-primary btn-sm rounded-xl py-2 flex items-center justify-center gap-2 font-bold text-xs disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Aplicar Procesamiento Actual a ({selectedIds.length}) Seleccionados</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Macros Library & Save Custom Macro (7 Cols) */}
          <div className="md:col-span-7 space-y-5">
            {/* SECTION 1: Built-in & Custom Macros Library */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Biblioteca de Macros Preset</span>
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  {allMacros.length} macros disponibles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {allMacros.map((macro) => {
                  const isSelected = activeMacro.id === macro.id;
                  return (
                    <div
                      key={macro.id}
                      onClick={() => setActiveMacro(macro)}
                      className={`p-3 rounded-2xl border text-xs transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-50/70 border-amber-300 text-amber-900 shadow-2xs'
                          : 'bg-gray-50 border-border text-text-secondary hover:bg-white'
                      }`}
                    >
                      <div className="space-y-0.5 max-w-[65%]">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>{macro.name}</span>
                        </div>
                        <p className="text-[10px] text-text-muted truncate">{macro.description}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyMacroToSelected(macro);
                          }}
                          disabled={selectedIds.length === 0}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-800 transition disabled:opacity-50"
                          title="Aplicar solo a los perfiles seleccionados"
                        >
                          Aplicar a Seleccionados ({selectedIds.length})
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyMacroToAll(macro);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition"
                          title="Aplicar a TODOS los perfiles abiertos"
                        >
                          A Todos ({datasets.length})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: Save Current Configuration as New Custom Macro */}
            <form onSubmit={handleSaveMacro} className="bg-gray-50 p-4 rounded-2xl border border-border space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <Save className="w-4 h-4 text-primary" />
                <span>Guardar Procesamiento Actual como Nueva Macro</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                    Nombre de la Macro:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Macro Detección Puentes"
                    value={macroName}
                    onChange={(e) => setMacroName(e.target.value)}
                    className="input text-xs py-1.5 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary block mb-1">
                    Descripción Breve:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Dewow 4ns + IIR 200-900MHz"
                    value={macroDesc}
                    onChange={(e) => setMacroDesc(e.target.value)}
                    className="input text-xs py-1.5 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!macroName.trim()}
                  className="btn-primary btn-sm rounded-xl px-4 py-1.5 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Macro</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Selecciona uno o varios perfiles a la izquierda y elige qué macro o filtro deseas aplicar.
          </span>
          <button
            onClick={onClose}
            className="btn-outline btn-sm px-5 py-1.5 rounded-xl font-bold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
