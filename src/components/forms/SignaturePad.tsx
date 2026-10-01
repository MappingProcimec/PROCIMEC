'use client';

import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  value,
  onChange,
  required = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value && value.startsWith('data:image')));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ajustar resolución interna para pantallas retina / high-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#0F172A'; // Tinta oscura formal para documentos

        // Si ya hay un valor cargado, dibujarlo
        if (value && value.startsWith('data:image')) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = value;
        }
      }
    }
  }, [value]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generar imagen PNG en Base64
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/80 font-medium flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
          <span>{label}</span>
          {required && <span className="text-accent">*</span>}
        </label>

        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-red-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
            <span>Limpiar Trazo</span>
          </button>
        )}
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border-default bg-[#F8FAFC]">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-28 touch-none cursor-crosshair block"
        />

        {/* Línea guía de firma institucional */}
        <div className="absolute bottom-5 left-6 right-6 border-b border-dashed border-slate-300 pointer-events-none" />
        <span className="absolute bottom-1.5 right-6 text-[10px] text-slate-400 font-mono pointer-events-none">
          Línea de firma
        </span>

        {/* Indicador de firma registrada */}
        {hasDrawn && (
          <div className="absolute top-2 right-2 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5 flex items-center gap-1 pointer-events-none">
            <Check className="w-3 h-3 text-emerald-600" strokeWidth={2.5} />
            <span className="text-[10px] font-semibold text-emerald-700">Firma Capturada</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-white/40">
        Traza la firma con el ratón o dispositivo táctil para estamparla en el formato oficial.
      </p>
    </div>
  );
};
