'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCcw, Check, PenTool, UserCheck } from 'lucide-react';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  roleLabel: string;
  initialName?: string;
  onSaveSignature: (name: string, signatureDataUrl: string) => void;
}

export function DigitalSignatureModal({
  isOpen,
  onClose,
  title,
  roleLabel,
  initialName = '',
  onSaveSignature,
}: DigitalSignatureModalProps) {
  const [fullName, setFullName] = useState(initialName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isNameValidRef = useRef(false);

  const isNameValid = fullName.trim().length >= 3;
  isNameValidRef.current = isNameValid;

  // 1. Bloquear scroll del body y prevenir rebote de pantalla mientras el modal está abierto
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }
  }, [isOpen]);

  // 2. Inicializar estado y canvas al abrir
  useEffect(() => {
    if (isOpen) {
      setFullName(initialName);
      setHasDrawn(false);
      setErrorMsg('');
      const timer = setTimeout(() => {
        setupCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialName]);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#0f172a'; // Slate 900
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  // 3. Conexión de eventos táctiles NATIVOS con passive: false (Evita scroll y movimiento de la ventana)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const getTouchCoords = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Bloquea scroll en el navegador
      e.stopPropagation();

      if (!isNameValidRef.current) {
        setErrorMsg('Por favor ingresa primero el nombre completo para desbloquear el recuadro de firma.');
        return;
      }

      setErrorMsg('');
      isDrawingRef.current = true;
      if (e.touches.length > 0) {
        lastPointRef.current = getTouchCoords(e.touches[0]);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Bloquea cualquier intento de mover la ventana modal o pantalla de fondo
      e.stopPropagation();

      if (!isDrawingRef.current || !lastPointRef.current || e.touches.length === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentPoint = getTouchCoords(e.touches[0]);

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();

      lastPointRef.current = currentPoint;
      setHasDrawn(true);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDrawingRef.current = false;
      lastPointRef.current = null;
    };

    // Agregar listeners nativos con passive: false
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isOpen]);

  // 4. Manejadores para Mouse (Escritorio)
  const getMouseCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isNameValid) {
      setErrorMsg('Por favor ingresa primero el nombre completo para desbloquear el recuadro de firma.');
      return;
    }
    setErrorMsg('');
    isDrawingRef.current = true;
    lastPointRef.current = getMouseCoords(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPoint = getMouseCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPointRef.current = currentPoint;
    if (!hasDrawn) setHasDrawn(true);
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    setupCanvas();
    setHasDrawn(false);
    setErrorMsg('');
  };

  const handleConfirm = () => {
    const cleanName = fullName.trim();
    if (cleanName.length < 3) {
      setErrorMsg('Debes ingresar el nombre completo oficial de quien firma.');
      return;
    }
    if (!hasDrawn || !canvasRef.current) {
      setErrorMsg('Por favor realiza el trazo de tu firma en el recuadro antes de confirmar.');
      return;
    }

    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSaveSignature(cleanName, dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overscroll-none touch-none animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] overscroll-contain">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 p-4 sm:p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
              <PenTool className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-snug">{title}</h3>
              <p className="text-[11px] sm:text-xs text-teal-100 font-medium">Firma Digital Oficial • {roleLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Paso 1: Verificación de Identidad (Nombre Completo) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-600" />
              1. Nombre Completo de Quien Firma <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (e.target.value.trim().length >= 3) setErrorMsg('');
              }}
              placeholder="Ej: Marcelo Barraza / Ing. Inspector SSTA"
              className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            />
            <p className="text-[11px] text-slate-500">
              {isNameValid ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  ✓ Identidad registrada. El recuadro de trazo táctil está desbloqueado.
                </span>
              ) : (
                <span className="text-amber-700">
                  ⚠️ Ingresa tu nombre completo arriba para habilitar el lienzo de firma.
                </span>
              )}
            </p>
          </div>

          {/* Paso 2: Lienzo de Firma */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                2. Trazo de Firma en Pantalla <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={!hasDrawn}
                className="text-xs text-slate-600 hover:text-red-600 font-medium flex items-center gap-1 transition-colors disabled:opacity-30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar trazo
              </button>
            </div>

            {/* Contenedor del Canvas bloqueado contra scroll y movimientos */}
            <div
              style={{ touchAction: 'none' }}
              className={`relative border-2 rounded-2xl overflow-hidden touch-none select-none transition-all ${
                isNameValid
                  ? 'border-dashed border-teal-400 bg-white shadow-inner cursor-crosshair'
                  : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <canvas
                ref={canvasRef}
                style={{ touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-44 sm:h-48 block touch-none select-none"
              />

              {!isNameValid && (
                <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-[1px] text-center pointer-events-none">
                  <p className="text-xs font-semibold text-slate-600">
                    🔒 Escribe tu nombre completo para habilitar la pantalla de firma
                  </p>
                </div>
              )}

              {isNameValid && !hasDrawn && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-medium">
                  ✍️ Dibuja tu firma aquí con el dedo o mouse
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Acciones */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isNameValid || !hasDrawn}
            className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Confirmar y Guardar Firma
          </button>
        </div>
      </div>
    </div>
  );
}
