'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function FloatingDraftButton() {
  const { isDirty, draftSavedAt, saveDraft } = useFormStore();

  if (!isDirty && !draftSavedAt) return null;

  return (
    <button
      onClick={saveDraft}
      className="floating-btn animate-fade-in"
      title="Guardar borrador localmente"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      <span className="hidden sm:inline">
        {isDirty ? 'Guardar borrador' : (
          draftSavedAt ? `Guardado ${format(new Date(draftSavedAt), 'HH:mm', { locale: es })}` : 'Guardar borrador'
        )}
      </span>
      {isDirty && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse-soft" />
      )}
    </button>
  );
}
