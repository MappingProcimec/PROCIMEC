'use client';

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { User } from './types';

export interface UserDeactivateModalProps {
  user: User;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UserDeactivateModal({
  user,
  isPending,
  onClose,
  onConfirm,
}: UserDeactivateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="card w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl space-y-4 border border-border animate-slide-up">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-600" strokeWidth={1.75} />
        </div>
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-bold text-text-primary">¿Desactivar este usuario?</h3>
          <p className="text-xs text-text-secondary">
            Estás a punto de desactivar a{' '}
            <span className="font-bold text-text-primary">{user.full_name}</span>{' '}
            <span className="font-mono text-text-muted">({user.email})</span>.
          </p>
          <div className="text-xs text-amber-900 bg-amber-50/80 p-3 rounded-xl border border-amber-200 mt-2 text-left leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>
              <strong>Nota de Seguridad:</strong> El colaborador perderá inmediatamente el acceso y
              no podrá iniciar sesión en <strong>PROCIMEC (PCM CLOUD)</strong> hasta que sea
              reactivado por un administrador.
            </span>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-ghost flex-1 text-xs py-2.5 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 text-xs py-2.5 bg-primary-900 hover:bg-black text-amber-400 border border-primary-800 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
          >
            {isPending ? 'Desactivando...' : 'Sí, desactivar'}
          </button>
        </div>
      </div>
    </div>
  );
}
