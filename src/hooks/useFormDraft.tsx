'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RotateCcw, Trash2, X } from 'lucide-react';

interface DraftPayload<T> {
  timestamp: string;
  data: T;
}

interface UseFormDraftOptions<T> {
  formKey: string;
  currentValues: T;
  onRestore: (draftData: T) => void;
  isDirty?: boolean;
  debounceMs?: number;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0 || isNaN(diffMs)) return 'recientemente';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'hace un momento';
    if (minutes === 1) return 'hace 1 minuto';
    if (minutes < 60) return `hace ${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'hace 1 hora';
    if (hours < 24) return `hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'hace 1 día';
    return `hace ${days} días`;
  } catch {
    return 'recientemente';
  }
}

export function useFormDraft<T>({
  formKey,
  currentValues,
  onRestore,
  isDirty = true,
  debounceMs = 400,
}: UseFormDraftOptions<T>) {
  const storageKey = `pcm_draft_${formKey}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<T | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // 1. Detectar borrador previo al montar el componente
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: DraftPayload<T> = JSON.parse(raw);
        if (parsed && parsed.data) {
          setHasDraft(true);
          setDraftTimestamp(parsed.timestamp);
          setDraftData(parsed.data);
        }
      }
    } catch (e) {
      console.warn(`Error al leer borrador de ${formKey}:`, e);
    }
    isInitializedRef.current = true;
  }, [storageKey, formKey]);

  // 2. Auto-guardado con debounce cuando currentValues cambia
  useEffect(() => {
    if (!isInitializedRef.current || !isDirty || typeof window === 'undefined') return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        // No guardar si currentValues está vacío o nulo
        if (!currentValues) return;
        const payload: DraftPayload<T> = {
          timestamp: new Date().toISOString(),
          data: currentValues,
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (e) {
        console.warn(`Error al auto-guardar borrador de ${formKey}:`, e);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentValues, isDirty, storageKey, debounceMs, formKey]);

  // 3. Restaurar borrador
  const restoreDraft = useCallback(() => {
    if (draftData) {
      onRestore(draftData);
      setHasDraft(false);
    }
  }, [draftData, onRestore]);

  // 4. Limpiar borrador (por ejemplo, tras envío exitoso)
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn(`Error al limpiar borrador de ${formKey}:`, e);
    }
    setHasDraft(false);
    setDraftData(null);
    setDraftTimestamp(null);
  }, [storageKey, formKey]);

  // 5. Descartar visualmente el aviso sin borrarlo
  const dismissDraft = useCallback(() => {
    setHasDraft(false);
  }, []);

  return {
    hasDraft,
    draftTimestamp,
    draftData,
    restoreDraft,
    clearDraft,
    dismissDraft,
  };
}

/**
 * Componente visual de alerta para restaurar un borrador no enviado.
 * Cumple estrictamente con la Ley 5 (WCAG AAA, sin emojis, sobrio).
 */
export function DraftRecoveryAlert({
  hasDraft,
  draftTimestamp,
  onRestore,
  onDismiss,
  onClear,
}: {
  hasDraft: boolean;
  draftTimestamp: string | null;
  onRestore: () => void;
  onDismiss?: () => void;
  onClear?: () => void;
}) {
  if (!hasDraft) return null;

  const timeLabel = draftTimestamp ? formatRelativeTime(draftTimestamp) : 'de una sesión anterior';

  return (
    <div className="bg-amber-50/95 border border-amber-300/80 rounded-2xl p-4 shadow-sm mb-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-900 flex-shrink-0 mt-0.5 sm:mt-0">
            <Clock className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-amber-950">
              Borrador local disponible ({timeLabel})
            </h4>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              Detectamos datos no enviados de tu última sesión en este dispositivo. Puedes recuperarlos para continuar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold px-3 py-2 rounded-xl text-amber-900/70 hover:text-red-700 hover:bg-amber-100/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descartar y borrar borrador"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Descartar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestore}
            className="btn-accent text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Cargar datos del borrador"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Recuperar borrador</span>
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-amber-900/60 hover:text-amber-950 hover:bg-amber-100/80 rounded-lg transition-colors cursor-pointer"
              title="Ocultar aviso"
              aria-label="Cerrar aviso de borrador"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
