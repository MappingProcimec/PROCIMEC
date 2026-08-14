'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Stepper } from '@/components/layout/Stepper';
import { FloatingDraftButton } from '@/components/layout/FloatingDraftButton';
import { Step1 } from '@/components/form-steps/Step1';
import { Step2 } from '@/components/form-steps/Step2';
import { Step3 } from '@/components/form-steps/Step3';
import { Step4 } from '@/components/form-steps/Step4';
import { Step5 } from '@/components/form-steps/Step5';
import { useFormStore } from '@/hooks/useFormStore';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NewReportPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { currentStep, setCurrentStep, setProjectId, updateStep1, step1, resetForm } = useFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setProjectId(projectId);
    // Pre-fill operator name from session
    if (session?.user?.fullName && !step1.operator_name) {
      updateStep1({ operator_name: session.user.fullName });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, session]);

  const goNext = () => setCurrentStep(Math.min(currentStep + 1, 5));
  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const handleSubmit = async () => {
    const store = useFormStore.getState();
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      const reportData = {
        project_id: store.projectId,
        report_date: store.step1.report_date,
        report_time: store.step1.report_time,
        operator_name: store.step1.operator_name,
        gpr_equipment: store.step1.gpr_equipment,
        antenna_frequency: store.step1.antenna_frequency,
        capture_method: store.step1.capture_method,
        positioning_equipment: store.step1.positioning_equipment,
        terrain_conditions: store.step1.terrain_conditions,
        weather_conditions: store.step1.weather_conditions,
        operational_summary: store.step2.operational_summary,
        global_max_depth: store.step2.global_max_depth || null,
        detected_utilities: store.step3.detected_utilities,
        anomalies_notes: store.step3.anomalies_notes,
        site_restrictions: store.step3.site_restrictions,
        cad_priority: store.step4.cad_priority,
        processing_recommendations: store.step4.processing_recommendations,
        filter_gain_notes: store.step4.filter_gain_notes,
        additional_notes: store.step4.additional_notes,
        elaborated_by: store.step4.elaborated_by,
        reviewed_by: store.step4.reviewed_by,
      };

      formData.append('reportData', JSON.stringify(reportData));

      // Attach files
      store.step5.rawGprFiles.forEach((f, i) => {
        formData.append(`file_raw_gpr_${i}`, f.file);
      });
      store.step5.gpsFiles.forEach((f, i) => {
        formData.append(`file_gps_${i}`, f.file);
      });
      store.step5.photoFiles.forEach((f, i) => {
        formData.append(`file_photo_${i}`, f.file);
        if (f.caption) formData.append(`caption_photo_${i}`, f.caption);
      });

      const res = await fetch('/api/reports', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar el registro');
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
        {currentStep === 3 && <Step3 onNext={goNext} onBack={goBack} />}
        {currentStep === 4 && <Step4 onNext={goNext} onBack={goBack} />}
        {currentStep === 5 && <Step5 onBack={goBack} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
      </div>

      <FloatingDraftButton />
    </div>
  );
}
