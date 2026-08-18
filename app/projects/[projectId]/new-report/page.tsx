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

export default function NewReportPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { currentStep, setCurrentStep, setProjectId, updateSection1, section1, resetForm } = useFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setProjectId(projectId);
    // Pre-fill operator name from session
    if (session?.user?.fullName && !section1.operator_name) {
      updateSection1({ operator_name: session.user.fullName });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, session]);

  const goNext = () => setCurrentStep(Math.min(currentStep + 1, 3));
  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const handleSubmit = async () => {
    const store = useFormStore.getState();
    setIsSubmitting(true);

    try {
      const formData = new FormData();

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

      formData.append('reportData', JSON.stringify(reportData));

      // Attach files
      store.section3.rawGprFiles.forEach((f, i) => {
        formData.append(`file_raw_gpr_${i}`, f.file);
      });
      store.section3.gpsFiles.forEach((f, i) => {
        formData.append(`file_gps_${i}`, f.file);
      });
      store.section3.photoFiles.forEach((f, i) => {
        formData.append(`file_photo_${i}`, f.file);
        if (f.caption) formData.append(`caption_photo_${i}`, f.caption);
      });

      const res = await fetch('/api/reports', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = 'Error al guardar el registro';
        try {
          const text = await res.text();
          try {
            const err = JSON.parse(text);
            errorMsg = err.error || errorMsg;
          } catch {
            if (res.status === 413 || text.includes('Request Entity Too Large')) {
              errorMsg = 'El tamaño total de los archivos excede el límite de subida (4.5 MB). Por favor selecciona fotos o archivos más livianos.';
            } else {
              errorMsg = text.substring(0, 150) || errorMsg;
            }
          }
        } catch {
          // fallback
        }
        throw new Error(errorMsg);
      }

      const result = await res.json();
      const { fieldReportId, sessionFolderUrl, docxDriveUrl } = result.data;

      resetForm();
      router.push(
        `/projects/${projectId}/reports/${fieldReportId}/success?folderUrl=${encodeURIComponent(sessionFolderUrl || '')}&docxUrl=${encodeURIComponent(docxDriveUrl || '')}`
      );
    } catch (err) {
      console.error('Submit error:', err);
      alert(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <Stepper currentStep={currentStep} />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {currentStep === 1 && <Step1 onNext={goNext} />}
        {currentStep === 2 && <Step2 onNext={goNext} onBack={goBack} />}
        {currentStep === 3 && <Step3 onBack={goBack} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
      </div>

      <FloatingDraftButton />
    </div>
  );
}
