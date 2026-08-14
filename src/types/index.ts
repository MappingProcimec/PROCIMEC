// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator' | 'pending';

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
  surface_type: string;
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

  // Step 1
  operator_name?: string;
  gpr_equipment?: string;
  antenna_frequency?: string;
  capture_method?: string;
  positioning_equipment?: string;
  terrain_conditions?: string;
  weather_conditions?: string;

  // Step 2
  operational_summary: OperationalRow[];
  total_ml?: number;
  total_m2?: number;
  global_max_depth?: number;

  // Step 3
  detected_utilities: DetectedUtility[];
  anomalies_notes?: string;
  site_restrictions?: string;

  // Step 4
  cad_priority?: 'Alta' | 'Media' | 'Baja';
  processing_recommendations?: string;
  filter_gain_notes?: string;
  additional_notes?: string;
  elaborated_by?: string;
  reviewed_by?: string;

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

// ─── Form State (multi-step) ──────────────────────────────────────────────────

export interface Step1Data {
  report_date: string;
  report_time: string;
  operator_name: string;
  gpr_equipment: string;
  antenna_frequency: string;
  capture_method: string;
  positioning_equipment: string;
  terrain_conditions: string;
  weather_conditions: string;
}

export interface Step2Data {
  operational_summary: OperationalRow[];
  global_max_depth: number | '';
}

export interface Step3Data {
  detected_utilities: DetectedUtility[];
  anomalies_notes: string;
  site_restrictions: string;
}

export interface Step4Data {
  cad_priority: 'Alta' | 'Media' | 'Baja' | '';
  processing_recommendations: string;
  filter_gain_notes: string;
  additional_notes: string;
  elaborated_by: string;
  reviewed_by: string;
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

export interface Step5Data {
  rawGprFiles: UploadedFile[];
  gpsFiles: UploadedFile[];
  photoFiles: UploadedFile[];
}

export interface FormStore {
  projectId: string;
  currentStep: number;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
  isDraft: boolean;
  lastSaved?: string;
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
