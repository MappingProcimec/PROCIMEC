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
import { BackButton } from '@/components/BackButton';
import { Radio, Loader2 } from 'lucide-react';

async function uploadFileToSupabase(
  fileItem: UploadedFile,
  fieldReportId: string,
  onProgress: (percent: number) => void
): Promise<{ storageUrl: string; storagePath: string }> {
  const formData = new FormData();
  formData.append('file', fileItem.file);
  formData.append('fieldReportId', fieldReportId);
  formData.append('fileType', fileItem.fileType || 'photo');
  if (fileItem.caption) {
    formData.append('caption', fileItem.caption);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/reports/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.data?.storageUrl) {
            resolve({
              storageUrl: res.data.storageUrl,
              storagePath: res.data.storagePath,
            });
            return;
          }
          reject(new Error('Respuesta del servidor incompleta al almacenar archivo'));
        } catch {
          reject(new Error('Error al interpretar respuesta de subida'));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error || `Error ${xhr.status} al guardar archivo en la nube`));
        } catch {
          reject(new Error(`Error ${xhr.status} al guardar archivo`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Error de conexión al subir archivo'));
    xhr.send(formData);
  });
}

export default function NewReportPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId as string) || '';
  const {
    currentStep,
    setCurrentStep,
    setProjectId,
    updateSection1,
    section1,
    resetForm,
    updateFileProgress,
  } = useFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  useEffect(() => {
    if (projectId) {
      setProjectId(projectId);
    }
    const currentUserName = session?.user?.fullName || session?.user?.name || '';
    if (currentUserName && (!section1.localizador_name && !section1.operator_name)) {
      updateSection1({ localizador_name: currentUserName, operator_name: currentUserName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, session]);

  const goNext = () => setCurrentStep(Math.min(currentStep + 1, 3));
  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const handleSubmit = async () => {
    const store = useFormStore.getState();
    if (!store.projectId) {
      alert('Por favor selecciona un proyecto en la Sección 1 antes de guardar.');
      return;
    }
    setIsSubmitting(true);
    setUploadStatusMsg('Registrando información operativa en Supabase...');

    try {
      const reportData = {
        project_id: store.projectId,
        report_date: store.section1.report_date,
        report_time: store.section1.report_time,
        report_end_time: store.section1.report_end_time || null,
        localizador_name: store.section1.localizador_name || store.section1.operator_name,
        operator_name: store.section1.localizador_name || store.section1.operator_name,
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

      // 1. Guardar datos principales en Supabase DB
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
      const { fieldReportId, sessionFolderUrl } = result.data;

      // 2. Subir archivos a Supabase Storage con seguimiento de progreso
      const allFileItems: { fileItem: UploadedFile; type: 'raw_gpr' | 'gps' | 'photo' }[] = [
        ...store.section3.rawGprFiles.map(f => ({ fileItem: { ...f, fileType: 'raw_gpr' as const }, type: 'raw_gpr' as const })),
        ...store.section3.gpsFiles.map(f => ({ fileItem: { ...f, fileType: 'gps' as const }, type: 'gps' as const })),
        ...store.section3.photoFiles.map(f => ({ fileItem: { ...f, fileType: 'photo' as const }, type: 'photo' as const })),
      ];

      for (let i = 0; i < allFileItems.length; i++) {
        const { fileItem } = allFileItems[i];
        setUploadStatusMsg(`Almacenando archivo ${i + 1} de ${allFileItems.length}: ${fileItem.file.name}`);

        await uploadFileToSupabase(fileItem, fieldReportId, (percent) => {
          updateFileProgress(fileItem.id, percent);
        });
      }

      // 3. Finalizar y generar Reporte Diario en PDF asistido por Google Gemini AI
      setUploadStatusMsg('Sintetizando informe técnico con Google Gemini AI y generando PDF...');
      const finalRes = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize', fieldReportId }),
      });

      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error(err.error || 'Error al compilar el reporte PDF');
      }

      const finalResult = await finalRes.json();
      const { pdfReportUrl, docxDriveUrl } = finalResult.data || {};

      resetForm();
      const targetProjectId = projectId || store.projectId;
      router.push(
        `/projects/${targetProjectId}/reports/${fieldReportId}/success?pdfUrl=${encodeURIComponent(pdfReportUrl || '')}&folderUrl=${encodeURIComponent(sessionFolderUrl || '')}&docxUrl=${encodeURIComponent(docxDriveUrl || '')}`
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
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-3xl mx-auto">
          <BackButton href={projectId ? `/projects/${projectId}` : '/admin/forms'} label={projectId ? 'Volver al proyecto' : 'Formularios'} />
          <div className="flex items-center gap-3 mt-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Formulario de Campo GPR
              </h1>
              <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                Reporte operacional de exploración, volumetría por tramos y medición subsuperficial
              </p>
            </div>
          </div>
        </div>
      </div>

      <Stepper currentStep={currentStep} />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {uploadStatusMsg && (
          <div className="card p-4 mb-4 bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 animate-fade-in shadow-sm">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" strokeWidth={2} />
            <p className="text-sm font-semibold text-text-primary">{uploadStatusMsg}</p>
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
