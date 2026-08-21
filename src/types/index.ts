// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator' | 'pending' | 'dibujo';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  contract_number?: string;
  description?: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface ProjectWithStats extends Project {
  report_count?: number;
  total_ml?: number;
}

// ─── Operational Summary Row ──────────────────────────────────────────────────

export interface OperationalRow {
  id: string; // local uuid for list key
  sector: string;
  ml: number | '';
  m2: number | '';
  max_depth_m: number | '';
  observations: string;
}

// ─── Detected Utility ─────────────────────────────────────────────────────────

export interface DetectedUtility {
  id: string; // local uuid
  type: string;
  estimated_depth_m: number | '';
  confidence: 'Alta' | 'Media' | 'Baja' | '';
  description: string;
}

// ─── Field Report ─────────────────────────────────────────────────────────────

export interface FieldReport {
  id: string;
  project_id: string;
  created_by: string;
  report_date: string;
  report_time?: string;
  report_end_time?: string;

  // Section 1
  operator_name?: string;
  equipments_used?: string[];
  gpr_equipment?: string;
  positioning_equipment?: string;
  terrain_conditions?: string;
  weather_conditions?: string;
  capture_method?: string;

  // Section 1: Volumetría
  operational_summary: OperationalRow[];
  total_ml?: number;
  total_m2?: number;
  global_max_depth?: number;

  // Section 2: Configuración técnica
  antenna_frequency?: string;
  rdp_value?: string;
  scans_per_meter?: string;
  filter_gain_notes?: string;
  rd_data_notes?: string;

  // Section 2: Hallazgos y Oficina
  detected_utilities: DetectedUtility[];
  anomalies_notes?: string;
  site_restrictions?: string;
  cad_priority?: 'Alta' | 'Media' | 'Baja';
  processing_recommendations?: string;
  additional_notes?: string;

  // Drive metadata
  drive_session_folder_id?: string;
  drive_session_folder_url?: string;
  docx_drive_file_id?: string;
  docx_drive_url?: string;

  status: 'draft' | 'submitted' | 'reviewed';
  created_at: string;
  updated_at: string;
}

// ─── Report File ──────────────────────────────────────────────────────────────

export type FileType = 'raw_gpr' | 'gps' | 'photo';

export interface ReportFile {
  id: string;
  field_report_id: string;
  file_type: FileType;
  original_name: string;
  drive_file_id: string;
  drive_webview_url?: string;
  drive_download_url?: string;
  caption?: string;
  size_bytes?: number;
  mime_type?: string;
  created_at: string;
}

// ─── Form State (3-section form) ──────────────────────────────────────────────

export interface Section1Data {
  report_date: string;
  report_time: string;
  report_end_time: string;
  operator_name: string;
  equipments_used: string[];
  positioning_equipment: string;
  terrain_conditions: string;
  weather_conditions: string;
  capture_method: string;
  operational_summary: OperationalRow[];
  global_max_depth: number | '';
}

export interface Section2Data {
  antenna_frequency: string;
  rdp_value: string;
  filter_gain_notes: string;
  scans_per_meter: string;
  rd_data_notes: string;
  detected_utilities: DetectedUtility[];
  anomalies_notes: string;
  site_restrictions: string;
  cad_priority: 'Alta' | 'Media' | 'Baja' | '';
  processing_recommendations: string;
}

export interface UploadedFile {
  id: string; // local uuid
  file: File;
  fileType: FileType;
  caption?: string; // for photos
  preview?: string; // data URL for photos
  progress: number;
  driveFileId?: string;
  driveWebviewUrl?: string;
  error?: string;
}

export interface Section3Data {
  rawGprFiles: UploadedFile[];
  gpsFiles: UploadedFile[];
  photoFiles: UploadedFile[];
}

export interface FormStore {
  projectId: string;
  currentStep: number; // 1, 2, 3
  section1: Section1Data;
  section2: Section2Data;
  section3: Section3Data;
  isDirty: boolean;
  draftSavedAt?: string;
  setProjectId: (id: string) => void;
  setCurrentStep: (step: number) => void;
  updateSection1: (data: Partial<Section1Data>) => void;
  updateSection2: (data: Partial<Section2Data>) => void;
  addRawGprFile: (file: UploadedFile) => void;
  addGpsFile: (file: UploadedFile) => void;
  addPhotoFile: (file: UploadedFile) => void;
  updateFileProgress: (id: string, progress: number) => void;
  removeFile: (id: string, fileType: FileType) => void;
  updatePhotoCaption: (id: string, caption: string) => void;
  saveDraft: () => void;
  resetForm: () => void;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface SaveReportResult {
  fieldReportId: string;
  sessionFolderUrl: string;
  docxDriveUrl: string;
  docxFileId: string;
}

// ─── Drive ────────────────────────────────────────────────────────────────────

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  size?: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalML: number;
  totalReports: number;
  activeOperators: number;
  activeProjects: number;
}

// ─── Drawing Activities (rol dibujo) ──────────────────────────────────────────────

export type DrawingActivity = {
  id: string;
  created_at: string;
  project_name: string;
  activity_date: string;
  responsible: string;
  software: 'CIVIL 3D' | 'REVIT' | 'OTRO';
  elaboration_stage?: 'INICIO' | 'PROCESO' | 'FINAL';
  other_software_name?: string;
  hours_worked: number;
  is_rework: boolean;
  rework_observations?: string;
  user_id?: string;
};
