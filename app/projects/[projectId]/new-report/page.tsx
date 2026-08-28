'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Stepper } from '@/components/layout/Stepper';
import { FloatingDraftButton } from '@/components/layout/FloatingDraftButton';
import { Step1 } from '@/components/form-steps/Step1';
import { Step2 } from '@/components/form-steps/Step2';
import { Step3 } from '@/components/form-steps/Step3';
import { useFormStore } from '@/hooks/useFormStore';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UploadedFile } from '@/types';

async function uploadFileDirectToDrive(
  file: File,
  targetFolderId: string,
  onProgress: (percent: number) => void
): Promise<{ driveFileId: string }> {
  const sessionRes = await fetch('/api/drive/upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId: targetFolderId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }),
  });

  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    throw new Error(err.error || 'Error al iniciar sesión de subida a Drive');
  }

  const { uploadUrl } = await sessionRes.json();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const driveRes = JSON.parse(xhr.responseText);
          if (!driveRes.id) {
            reject(new Error(`Drive no devolvió ID para ${file.name}`));
            return;
          }
          resolve({ driveFileId: driveRes.id });
        } catch {
          reject(new Error(`Respuesta inválida de Drive al subir ${file.name}`));
        }
      } else {
        reject(new Error(`Error al subir ${file.name} a Drive (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error(`Error de red al subir ${file.name} a Google Drive`));
    xhr.send(file);
  });
}

import { BackButton } from '@/components/BackButton';

export default function NewReportPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId as string) || '';
  const {
    currentStep, setCurrentStep, setProjectId, updateSection1, section1, resetForm, updateFileProgress
  } = useFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  useEffect(() => {
    if (projectId) {
      setProjectId(projectId);
    }
    if (session?.user?.fullName && !section1.operator_name) {
      updateSection1({ operator_name: session.user.fullName });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, session]);

  const goNext = () => setCurrentStep(Math.min(currentStep + 1, 3));
  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const handleSubmit = async () => {
    const store = useFormStore.getState();
    if (!store.projectId) {
      alert('Por favor selecciona un proyecto en la Sección 1 antes de enviar.');
      return;
    }
    setIsSubmitting(true);
    setUploadStatusMsg('Guardando datos del reporte...');

    try {
      const reportData = {
        project_id: store.projectId,
        report_date: store.section1.report_date,
        report_time: store.section1.report_time,
        report_end_time: store.section1.report_end_time || null,
        operator_name: store.section1.operator_name,
        equipments_used: store.section1.equipments_used,
        gpr_equipment: store.section1.equipments_used.join(', '),
        positioning_equipment: store.section1.positioning_equipment,
        terrain_conditions: store.section1.terrain_conditions,
        weather_conditions: store.section1.weather_conditions,
        capture_method: store.section1.capture_method,
        operational_summary: store.section1.operational_summary,
        global_max_depth: store.section1.global_max_depth || null,

        antenna_frequency: store.section2.antenna_frequency,
        rdp_value: store.section2.rdp_value,
        scans_per_meter: store.section2.scans_per_meter,
        rd_data_notes: store.section2.rd_data_notes,
        filter_gain_notes: store.section2.filter_gain_notes,
        detected_utilities: store.section2.detected_utilities,
        anomalies_notes: store.section2.anomalies_notes,
        site_restrictions: store.section2.site_restrictions,
        cad_priority: store.section2.cad_priority,
        processing_recommendations: store.section2.processing_recommendations,
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let msg = 'Error al guardar el reporte';
        try {
          const parsed = JSON.parse(errText);
          msg = parsed.error || msg;
        } catch {
          msg = errText.substring(0, 150) || msg;
        }
        throw new Error(msg);
      }

      const result = await res.json();
      const { fieldReportId, rawGprFolderId, gpsFolderId, photosFolderId, sessionFolderUrl } = result.data;

      if (!rawGprFolderId || !gpsFolderId || !photosFolderId) {
        throw new Error(
          'No se pudieron crear las carpetas en Google Drive. Verifica que GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY y GOOGLE_DRIVE_ROOT_FOLDER_ID estén configurados en Vercel.'
        );
      }

      const allFileItems: { fileItem: UploadedFile; folderId: string; type: 'raw_gpr' | 'gps' | 'photo' }[] = [
        ...store.section3.rawGprFiles.map(f => ({ fileItem: f, folderId: rawGprFolderId, type: 'raw_gpr' as const })),
        ...store.section3.gpsFiles.map(f => ({ fileItem: f, folderId: gpsFolderId, type: 'gps' as const })),
        ...store.section3.photoFiles.map(f => ({ fileItem: f, folderId: photosFolderId, type: 'photo' as const })),
      ];

      for (let i = 0; i < allFileItems.length; i++) {
        const { fileItem, folderId, type } = allFileItems[i];
        setUploadStatusMsg(`Subiendo archivo ${i + 1} de ${allFileItems.length}: ${fileItem.file.name}`);

        const { driveFileId } = await uploadFileDirectToDrive(fileItem.file, folderId, (percent) => {
          updateFileProgress(fileItem.id, percent);
        });

        const addFileRes = await fetch('/api/reports', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_file',
            fieldReportId,
            fileType: type,
            originalName: fileItem.file.name,
            driveFileId,
            caption: fileItem.caption || '',
            sizeBytes: fileItem.file.size,
            mimeType: fileItem.file.type,
          }),
        });

        if (!addFileRes.ok) {
          const err = await addFileRes.json().catch(() => ({}));
          throw new Error(err.error || `Error al registrar ${fileItem.file.name} en la base de datos`);
        }
      }

      setUploadStatusMsg('Generando informe de Word (.docx)...');
      const finalRes = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize', fieldReportId }),
      });

      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error(err.error || 'Error al generar el reporte Word');
      }

      const finalResult = await finalRes.json();
      const { docxDriveUrl } = finalResult.data || {};

      resetForm();
      router.push(
        `/projects/${projectId}/reports/${fieldReportId}/success?folderUrl=${encodeURIComponent(sessionFolderUrl || '')}&docxUrl=${encodeURIComponent(docxDriveUrl || '')}`
      );
    } catch (err) {
      console.error('Submit error:', err);
      alert(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
      setUploadStatusMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-3xl mx-auto">
          <BackButton href={projectId ? `/projects/${projectId}` : '/admin/forms'} label={projectId ? 'Volver al proyecto' : 'Formularios'} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
            📍 Formulario de Campo GPR
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Reporte operacional de exploración, volumetría por tramos y medición GPR en campo
          </p>
        </div>
      </div>

      <Stepper currentStep={currentStep} />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {uploadStatusMsg && (
          <div className="card p-4 mb-4 bg-primary-50 border-primary-200 flex items-center gap-3 animate-fade-in">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm font-semibold text-primary">{uploadStatusMsg}</p>
          </div>
        )}

        {currentStep === 1 && <Step1 onNext={goNext} />}
        {currentStep === 2 && <Step2 onNext={goNext} onBack={goBack} />}
        {currentStep === 3 && <Step3 onBack={goBack} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
      </div>

      <FloatingDraftButton />
    </div>
  );
}
