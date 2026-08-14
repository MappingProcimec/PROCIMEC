'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Step1Data, Step2Data, Step3Data, Step4Data, Step5Data, UploadedFile } from '@/types';
import { format } from 'date-fns';

interface FormState {
  projectId: string;
  currentStep: number;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
  isDirty: boolean;
  draftSavedAt?: string;

  // Actions
  setProjectId: (id: string) => void;
  setCurrentStep: (step: number) => void;
  updateStep1: (data: Partial<Step1Data>) => void;
  updateStep2: (data: Partial<Step2Data>) => void;
  updateStep3: (data: Partial<Step3Data>) => void;
  updateStep4: (data: Partial<Step4Data>) => void;
  addRawGprFile: (file: UploadedFile) => void;
  addGpsFile: (file: UploadedFile) => void;
  addPhotoFile: (file: UploadedFile) => void;
  updateFileProgress: (id: string, progress: number) => void;
  removeFile: (id: string, fileType: 'raw_gpr' | 'gps' | 'photo') => void;
  updatePhotoCaption: (id: string, caption: string) => void;
  saveDraft: () => void;
  resetForm: () => void;
}

const defaultStep1: Step1Data = {
  report_date: format(new Date(), 'yyyy-MM-dd'),
  report_time: format(new Date(), 'HH:mm'),
  operator_name: '',
  gpr_equipment: '',
  antenna_frequency: '',
  capture_method: '',
  positioning_equipment: '',
  terrain_conditions: '',
  weather_conditions: '',
};

const defaultStep2: Step2Data = {
  operational_summary: [],
  global_max_depth: '',
};

const defaultStep3: Step3Data = {
  detected_utilities: [],
  anomalies_notes: '',
  site_restrictions: '',
};

const defaultStep4: Step4Data = {
  cad_priority: '' as 'Alta' | 'Media' | 'Baja' | '',
  processing_recommendations: '',
  filter_gain_notes: '',
  additional_notes: '',
  elaborated_by: '',
  reviewed_by: '',
};

const defaultStep5: Step5Data = {
  rawGprFiles: [],
  gpsFiles: [],
  photoFiles: [],
};

export const useFormStore = create<FormState>()(
  persist(
    (set, get) => ({
      projectId: '',
      currentStep: 1,
      step1: defaultStep1,
      step2: defaultStep2,
      step3: defaultStep3,
      step4: defaultStep4,
      step5: defaultStep5,
      isDirty: false,

      setProjectId: (id) => set({ projectId: id }),
      setCurrentStep: (step) => set({ currentStep: step }),

      updateStep1: (data) =>
        set((state) => ({ step1: { ...state.step1, ...data }, isDirty: true })),

      updateStep2: (data) =>
        set((state) => ({ step2: { ...state.step2, ...data }, isDirty: true })),

      updateStep3: (data) =>
        set((state) => ({ step3: { ...state.step3, ...data }, isDirty: true })),

      updateStep4: (data) =>
        set((state) => ({ step4: { ...state.step4, ...data }, isDirty: true })),

      addRawGprFile: (file) =>
        set((state) => ({
          step5: { ...state.step5, rawGprFiles: [...state.step5.rawGprFiles, file] },
          isDirty: true,
        })),

      addGpsFile: (file) =>
        set((state) => ({
          step5: { ...state.step5, gpsFiles: [...state.step5.gpsFiles, file] },
          isDirty: true,
        })),

      addPhotoFile: (file) =>
        set((state) => ({
          step5: { ...state.step5, photoFiles: [...state.step5.photoFiles, file] },
          isDirty: true,
        })),

      updateFileProgress: (id, progress) =>
        set((state) => {
          const updateList = (list: UploadedFile[]) =>
            list.map((f) => (f.id === id ? { ...f, progress } : f));
          return {
            step5: {
              rawGprFiles: updateList(state.step5.rawGprFiles),
              gpsFiles: updateList(state.step5.gpsFiles),
              photoFiles: updateList(state.step5.photoFiles),
            },
          };
        }),

      removeFile: (id, fileType) =>
        set((state) => {
          const filterList = (list: UploadedFile[]) => list.filter((f) => f.id !== id);
          const step5 = { ...state.step5 };
          if (fileType === 'raw_gpr') step5.rawGprFiles = filterList(step5.rawGprFiles);
          else if (fileType === 'gps') step5.gpsFiles = filterList(step5.gpsFiles);
          else step5.photoFiles = filterList(step5.photoFiles);
          return { step5, isDirty: true };
        }),

      updatePhotoCaption: (id, caption) =>
        set((state) => ({
          step5: {
            ...state.step5,
            photoFiles: state.step5.photoFiles.map((f) =>
              f.id === id ? { ...f, caption } : f
            ),
          },
        })),

      saveDraft: () =>
        set({
          isDirty: false,
          draftSavedAt: new Date().toISOString(),
        }),

      resetForm: () =>
        set({
          projectId: '',
          currentStep: 1,
          step1: { ...defaultStep1, report_date: format(new Date(), 'yyyy-MM-dd'), report_time: format(new Date(), 'HH:mm') },
          step2: defaultStep2,
          step3: defaultStep3,
          step4: defaultStep4,
          step5: defaultStep5,
          isDirty: false,
          draftSavedAt: undefined,
        }),
    }),
    {
      name: 'gpr-form-draft',
      storage: createJSONStorage(() => localStorage),
      // Don't persist File objects (can't serialize)
      partialize: (state) => ({
        projectId: state.projectId,
        currentStep: state.currentStep,
        step1: state.step1,
        step2: state.step2,
        step3: state.step3,
        step4: state.step4,
        isDirty: state.isDirty,
        draftSavedAt: state.draftSavedAt,
        // step5 files are NOT persisted (File objects not serializable)
      }),
    }
  )
);
