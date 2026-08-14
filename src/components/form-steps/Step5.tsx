'use client';

import { useFormStore } from '@/hooks/useFormStore';
import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UploadedFile } from '@/types';

const RAW_GPR_ACCEPT = '.rd3,.gsf,.dzt,.dzt2,.pair,.rad,.gpr';
const GPS_ACCEPT = '.csv,.txt,.kml,.gpx,.shp,.xlsx';
const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.heic,.webp';

interface Step5Props {
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

interface FileUploadSectionProps {
  title: string;
  icon: React.ReactNode;
  accept: string;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
  showCaption?: boolean;
  onCaptionChange?: (id: string, caption: string) => void;
  capture?: 'environment' | undefined;
}

function FileUploadSection({
  title, icon, accept, files, onAdd, onRemove, showCaption, onCaptionChange, capture
}: FileUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(f => {
      const id = uuidv4();
      const preview = showCaption && f.type.startsWith('image/')
        ? URL.createObjectURL(f)
        : undefined;

      return {
        id,
        file: f,
        fileType: showCaption ? 'photo' : accept.includes('.csv') ? 'gps' : 'raw_gpr',
        caption: '',
        preview,
        progress: 0,
      };
    });
    onAdd(newFiles);
  }, [onAdd, accept, showCaption]);

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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="section-icon w-8 h-8 text-sm">{icon}</div>
        <div>
          <h3 className="font-semibold text-text-primary text-sm">{title}</h3>
          <p className="text-xs text-text-muted">{files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone ${isDragging ? 'upload-zone-active' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          capture={capture}
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <svg className="w-8 h-8 text-text-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-text-secondary">
          {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o toca para seleccionar'}
        </p>
        <p className="text-xs text-text-muted mt-1">{accept.replace(/\./g, '').toUpperCase()}</p>
        {showCaption && (
          <div className="mt-2 flex gap-2 justify-center">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); }}
              className="text-xs text-primary underline"
            >
              📷 Tomar foto con cámara
            </button>
          </div>
        )}
      </div>

      {/* Camera button for mobile photos */}
      {showCaption && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.capture = 'environment';
              inputRef.current.click();
              // Reset after click
              setTimeout(() => { if (inputRef.current) inputRef.current.removeAttribute('capture'); }, 1000);
            }
          }}
          className="btn-outline w-full sm:hidden"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          Tomar foto con cámara
        </button>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="card p-3 space-y-2">
              <div className="flex items-start gap-3">
                {/* Preview or icon */}
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={f.file.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary uppercase">
                      {f.file.name.split('.').pop()?.substring(0, 3)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{f.file.name}</p>
                  <p className="text-xs text-text-muted">{formatSize(f.file.size)}</p>
                  {f.progress > 0 && f.progress < 100 && (
                    <div className="progress-bar mt-1.5">
                      <div className="progress-fill" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                  {f.progress === 100 && (
                    <p className="text-xs text-success flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Subido exitosamente
                    </p>
                  )}
                </div>
                <button onClick={() => onRemove(f.id)}
                  className="p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Caption for photos */}
              {showCaption && onCaptionChange && (
                <input
                  className="input text-sm"
                  placeholder="Pie de foto — describe lo que muestra esta imagen..."
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

export function Step5({ onBack, onSubmit, isSubmitting }: Step5Props) {
  const {
    step5,
    addRawGprFile, addGpsFile, addPhotoFile,
    removeFile,
    updatePhotoCaption,
  } = useFormStore();

  const totalFiles = step5.rawGprFiles.length + step5.gpsFiles.length + step5.photoFiles.length;
  const totalProgress = totalFiles === 0 ? 0 :
    [...step5.rawGprFiles, ...step5.gpsFiles, ...step5.photoFiles]
      .reduce((s, f) => s + f.progress, 0) / totalFiles;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div className="section-icon">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Carga de Archivos y Fotografías</h2>
          <p className="text-sm text-text-muted">Los archivos se subirán a Google Drive automáticamente al guardar</p>
        </div>
      </div>

      {/* Global upload progress (shown during submit) */}
      {isSubmitting && totalFiles > 0 && (
        <div className="card p-4 bg-primary-50 border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-primary">Subiendo archivos a Google Drive...</span>
            <span className="ml-auto text-sm font-bold text-primary">{Math.round(totalProgress)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${totalProgress}%` }} />
          </div>
        </div>
      )}

      {/* Section A — RAW GPR */}
      <div className="card p-5">
        <FileUploadSection
          title="Archivos RAW GPR"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          }
          accept={RAW_GPR_ACCEPT}
          files={step5.rawGprFiles}
          onAdd={files => files.forEach(f => addRawGprFile({ ...f, fileType: 'raw_gpr' }))}
          onRemove={id => removeFile(id, 'raw_gpr')}
        />
      </div>

      {/* Section B — GPS */}
      <div className="card p-5">
        <FileUploadSection
          title="Archivos de Posicionamiento GPS"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          }
          accept={GPS_ACCEPT}
          files={step5.gpsFiles}
          onAdd={files => files.forEach(f => addGpsFile({ ...f, fileType: 'gps' }))}
          onRemove={id => removeFile(id, 'gps')}
        />
      </div>

      {/* Section C — Photos */}
      <div className="card p-5">
        <FileUploadSection
          title="Fotografías de Campo"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          }
          accept={PHOTO_ACCEPT}
          files={step5.photoFiles}
          onAdd={files => files.forEach(f => addPhotoFile({ ...f, fileType: 'photo' }))}
          onRemove={id => removeFile(id, 'photo')}
          showCaption={true}
          onCaptionChange={updatePhotoCaption}
          capture="environment"
        />
      </div>

      {/* Summary */}
      {totalFiles > 0 && (
        <div className="card p-4 bg-success/5 border-success/20">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {totalFiles} archivo{totalFiles !== 1 ? 's' : ''} listo{totalFiles !== 1 ? 's' : ''} para subir
              </p>
              <p className="text-xs text-text-muted">
                GPR: {step5.rawGprFiles.length} · GPS: {step5.gpsFiles.length} · Fotos: {step5.photoFiles.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">
            Los archivos se subirán a Google Drive al guardar el registro. Este proceso puede tardar algunos minutos dependiendo del tamaño de los archivos. Mantén la app abierta hasta que se complete.
          </p>
        </div>
      </div>

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
              Guardando registro...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Guardar Registro
            </>
          )}
        </button>
      </div>
    </div>
  );
}
