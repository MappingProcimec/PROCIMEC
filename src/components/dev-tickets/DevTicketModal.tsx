'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Lightbulb, X, Send, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DevTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevTicketModal({ isOpen, onClose }: DevTicketModalProps) {
  const pathname = usePathname();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/dev-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          contextUrl: pathname,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo registrar el ticket.');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al enviar el ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#1E2229] border border-[#2A303C] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2A303C] flex items-center justify-between bg-[#15181D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAA023]/15 border border-[#EAA023]/40 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 id="ticket-modal-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
                Proponer Ticket Técnico / Idea
              </h2>
              <p className="text-xs text-white/60">
                Planificación autónoma y ciclo DevOps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {success ? (
            <div className="py-8 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Ticket Enviado con Éxito</h3>
              <p className="text-xs text-white/70 max-w-sm">
                La IA ha redactado el plan técnico y lo ha enviado al Administrador para su aprobación vía WhatsApp y Panel.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Context Pill */}
              <div className="flex items-center gap-2 text-xs bg-[#15181D] px-3 py-1.5 rounded-lg border border-[#2A303C] text-white/70">
                <span className="font-semibold text-[#EAA023]">Contexto de ruta:</span>
                <span className="font-mono text-white/90 truncate">{pathname}</span>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label htmlFor="ticket-title" className="block text-xs font-semibold text-white/90 mb-1">
                  Título de la propuesta o ajuste *
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Añadir filtro por proyecto en el kárdex de almacén"
                  className="w-full px-3.5 py-2.5 bg-[#15181D] border border-[#2A303C] focus:border-[#EAA023] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="ticket-desc" className="block text-xs font-semibold text-white/90 mb-1">
                  Descripción detallada del requerimiento *
                </label>
                <textarea
                  id="ticket-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe qué necesitas cambiar, agregar o solucionar..."
                  className="w-full px-3.5 py-2.5 bg-[#15181D] border border-[#2A303C] focus:border-[#EAA023] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors resize-none"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Footer info & CTA */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#2A303C]">
                <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <Sparkles className="w-3.5 h-3.5 text-[#EAA023]" />
                  <span>Formulado con IA & Zod</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 text-xs font-semibold text-white/70 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EAA023] hover:bg-[#d68f1c] text-[#1E2229] font-bold text-xs transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#1E2229] border-t-transparent rounded-full animate-spin" />
                        <span>Planificando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
