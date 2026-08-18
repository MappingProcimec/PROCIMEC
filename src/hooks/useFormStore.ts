'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Section1Data, Section2Data, Section3Data, UploadedFile, FormStore } from '@/types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const defaultSection1: Section1Data = {
  report_date: format(new Date(), 'yyyy-MM-dd'),
  report_time: format(new Date(), 'HH:mm'),
  report_end_time: '',
  operator_name: '',
  equipments_used: ['GPR'],
  positioning_equipment: '',
  terrain_conditions: '',
  weather_conditions: '',
  capture_method: '',
  operational_summary: [
    { id: uuidv4(), sector: '', ml: '', m2: '', max_depth_m: '', observations: '' },
  ],
  global_max_depth: '',
};

const defaultSection2: Section2Data = {
  antenna_frequency: '',
  rdp_value: '',
  filter_gain_notes: '',
  scans_per_meter: '',
  rd_data_notes: '',
  detected_utilities: [],
  anomalies_notes: '',
  site_restrictions: '',
  cad_priority: '',
  processing_recommendations: '',
};

const defaultSection3: Section3Data = {
  rawGprFiles: [],
  gpsFiles: [],
  photoFiles: [],
};

export const useFormStore = create<FormStore>()(
  persist(
    (set) => ({
      projectId: '',
      currentStep: 1,
      section1: defaultSection1,
      section2: defaultSection2,
      section3: defaultSection3,
      isDirty: false,
      draftSavedAt: undefined,

      setProjectId: (id) => set({ projectId: id }),
      setCurrentStep: (step) => set({ currentStep: step }),

      updateSection1: (data) =>
        set((state) => ({ section1: { ...state.section1, ...data }, isDirty: true })),

      updateSection2: (data) =>
        set((state) => ({ section2: { ...state.section2, ...data }, isDirty: true })),

      addRawGprFile: (file) =>
        set((state) => ({
          section3: { ...state.section3, rawGprFiles: [...state.section3.rawGprFiles, file] },
          isDirty: true,
        })),

      addGpsFile: (file) =>
        set((state) => ({
          section3: { ...state.section3, gpsFiles: [...state.section3.gpsFiles, file] },
          isDirty: true,
        })),

      addPhotoFile: (file) =>
        set((state) => ({
          section3: { ...state.section3, photoFiles: [...state.section3.photoFiles, file] },
          isDirty: true,
        })),

      updateFileProgress: (id, progress) =>
        set((state) => {
          const updateList = (list: UploadedFile[]) =>
            list.map((f) => (f.id === id ? { ...f, progress } : f));
          return {
            section3: {
              rawGprFiles: updateList(state.section3.rawGprFiles),
              gpsFiles: updateList(state.section3.gpsFiles),
              photoFiles: updateList(state.section3.photoFiles),
            },
          };
        }),

      removeFile: (id, fileType) =>
        set((state) => {
          const filterList = (list: UploadedFile[]) => list.filter((f) => f.id !== id);
          const section3 = { ...state.section3 };
          if (fileType === 'raw_gpr') section3.rawGprFiles = filterList(section3.rawGprFiles);
          else if (fileType === 'gps') section3.gpsFiles = filterList(section3.gpsFiles);
          else section3.photoFiles = filterList(section3.photoFiles);
          return { section3, isDirty: true };
        }),

      updatePhotoCaption: (id, caption) =>
        set((state) => ({
          section3: {
            ...state.section3,
            photoFiles: state.section3.photoFiles.map((f) =>
              f.id === id ? { ...f, caption } : f
            ),
          },
          isDirty: true,
        })),

      saveDraft: () =>
        set({ isDirty: false, draftSavedAt: new Date().toISOString() }),

      resetForm: () =>
        set({
          currentStep: 1,
          section1: defaultSection1,
          section2: defaultSection2,
          section3: defaultSection3,
          isDirty: false,
          draftSavedAt: undefined,
        }),
    }),
    {
      name: 'gpr_form_draft_v2',
      storage: createJSONStorage(() => localStorage),
      // Exclude File objects from localStorage as they are non-serializable
      partialize: (state) => ({
        projectId: state.projectId,
        currentStep: state.currentStep,
        section1: state.section1,
        section2: state.section2,
        draftSavedAt: state.draftSavedAt,
      }),
    }
  )
);
