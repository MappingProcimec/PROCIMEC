'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UploadedFile } from '@/types';

const RAW_GPR_ACCEPT = '.gsf,.rd3,.dzt,.pair,.rad,.gpr,.pptx,.ppt';
const GPS_ACCEPT = '.dwg,.txt,.csv,.kml,.gpx,.shp,.xlsx,.pdf';
const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.heic,.webp';

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_WIDTH = 1600;
      const MAX_HEIGHT = 1600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => resolve(file);
    img.src = url;
  });
}

interface Step3Props {
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

interface FileUploadSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accept: string;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  isPhotoSection?: boolean;
  onCaptionChange?: (id: string, caption: string) => void;
}

function FileUploadSection({
  title, subtitle, icon, accept, files, onAdd, onRemove, isPhotoSection, onCaptionChange
}: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setIsProcessing(true);
    try {
      const rawArray = Array.from(fileList);
      const processedFiles: UploadedFile[] = [];

      for (const f of rawArray) {
        const fileToUse = isPhotoSection ? await compressImageFile(f) : f;
        const id = uuidv4();
        const preview = isPhotoSection && fileToUse.type.startsWith('image/')
          ? URL.createObjectURL(fileToUse)
          : undefined;

        processedFiles.push({
          id,
          file: fileToUse,
          fileType: isPhotoSection ? 'photo' : accept.includes('.dwg') ? 'gps' : 'raw_gpr',
          caption: '',
          preview,
          progress: 0,
        });
      }

      onAdd(processedFiles);
    } catch (err) {
      console.error('File processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [onAdd, accept, isPhotoSection]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-primary-50 text-primary rounded-xl flex items-center justify-center flex-shrink-0 font-bold">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-text-primary text-sm">{title}</h3>
          <p className="text-xs text-text-muted">{subtitle} · {files.length} archivo{files.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {isPhotoSection && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      )}

      {/* Drop zone / main upload trigger */}
      <div
        className={`upload-zone cursor-pointer ${isDragging ? 'upload-zone-active' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        {isProcessing ? (
          <div className="py-2 text-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-primary">Procesando y optimizando imagen...</p>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-primary mx-auto mb-2 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-semibold text-text-primary">
              {isPhotoSection ? 'Subir fotos desde celular o computador' : 'Seleccionar o arrastrar archivos'}
            </p>
            <p className="text-xs text-text-muted mt-1">{accept.replace(/\./g, ' ').toUpperCase()}</p>
          </>
        )}
      </div>

      {/* Optional secondary Camera button for photos */}
      {isPhotoSection && (
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => cameraInputRef.current?.click()}
          className="btn-outline w-full text-xs py-2 justify-center disabled:opacity-50"
        >
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          📷 O bien tomar foto directamente con la cámara
        </button>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2 pt-1">
          {files.map(f => (
            <div key={f.id} className="card p-3 space-y-2 bg-gray-50/70 border-border">
              <div className="flex items-center gap-3">
                {/* Preview or icon */}
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={f.file.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary uppercase">
                      {f.file.name.split('.').pop()?.substring(0, 4)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{f.file.name}</p>
                  <p className="text-xs text-text-muted">{formatSize(f.file.size)}</p>
                  {f.progress > 0 && f.progress < 100 && (
                    <div className="progress-bar mt-1.5">
                      <div className="progress-fill" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                </div>
                <button onClick={() => onRemove(f.id)}
                  className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Eliminar archivo">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Photo caption */}
              {isPhotoSection && onCaptionChange && (
                <input
                  className="input text-xs py-1.5"
                  placeholder="Pie de foto — describe esta imagen..."
                  value={f.caption || ''}
                  onChange={e => onCaptionChange(f.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Step3({ onBack, onSubmit, isSubmitting }: Step3Props) {
  const {
    section3,
    addRawGprFile, addGpsFile, addPhotoFile,
    removeFile, updatePhotoCaption
  } = useFormStore();

  const totalFiles = section3.rawGprFiles.length + section3.gpsFiles.length + section3.photoFiles.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Sección 3 — Carga de Archivos y Fotografías</h2>
          <p className="text-sm text-text-muted">Subida de datos crudos/procesados GPR/PPR, posicionamiento y fotos</p>
        </div>
      </div>

      {/* Section A — RAW GPR & PPR */}
      <FileUploadSection
        title="Archivos de Datos GPR / PPR y Presentaciones"
        subtitle="Crudosa (.gsf, .rd3, .dzt, .rad, .gpr), procesadas o PPTX marcadas"
        icon="📡"
        accept={RAW_GPR_ACCEPT}
        files={section3.rawGprFiles}
        onAdd={files => files.forEach(f => addRawGprFile({ ...f, fileType: 'raw_gpr' }))}
        onRemove={id => removeFile(id, 'raw_gpr')}
      />

      {/* Section B — Positioning (GPS, Estación, etc.) */}
      <FileUploadSection
        title="Archivos de Posicionamiento (GPS / Estación Total / Planos)"
        subtitle=".dwg, .txt, .csv, .kml, .gpx, .shp, .xlsx, .pdf"
        icon="📍"
        accept={GPS_ACCEPT}
        files={section3.gpsFiles}
        onAdd={files => files.forEach(f => addGpsFile({ ...f, fileType: 'gps' }))}
        onRemove={id => removeFile(id, 'gps')}
      />

      {/* Section C — Photos */}
      <FileUploadSection
        title="Registro Fotográfico de Campo"
        subtitle="Fotografías del sitio, terreno o hallazgos (optimizadas automáticamente)"
        icon="📷"
        accept={PHOTO_ACCEPT}
        files={section3.photoFiles}
        onAdd={files => files.forEach(f => addPhotoFile({ ...f, fileType: 'photo' }))}
        onRemove={id => removeFile(id, 'photo')}
        isPhotoSection={true}
        onCaptionChange={updatePhotoCaption}
      />

      {/* File summary */}
      {totalFiles > 0 && (
        <div className="card p-4 bg-success/10 border-success/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {totalFiles} archivo{totalFiles !== 1 ? 's' : ''} seleccionado{totalFiles !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-text-muted">
                GPR/PPR: {section3.rawGprFiles.length} · Posicionamiento: {section3.gpsFiles.length} · Fotos: {section3.photoFiles.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} disabled={isSubmitting} className="btn-ghost disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Anterior
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="btn-accent btn-lg disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando registro y subiendo archivos...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Guardar Registro de Campo
            </>
          )}
        </button>
      </div>
    </div>
  );
}
