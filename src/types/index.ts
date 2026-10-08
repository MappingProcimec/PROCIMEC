// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type UserRole = 
  | 'admin' 
  | 'localizador' 
  | 'operator' 
  | 'pending' 
  | 'dibujo' 
  | 'drawing' 
  | 'hr' 
  | 'hseq' 
  | 'warehouse' 
  | 'purchasing' 
  | 'commercial' 
  | 'finance' 
  | 'accounting' 
  | 'management';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  nick_name?: string | null;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface ProjectDeduction {
  id: string;
  name: string;
  percentage: number;
  applies: boolean;
  is_custom?: boolean;
}

export interface ProjectFinancials {
  contract_value: number;
  deductions_percentage: number;
  deductions_amount: number;
  execution_value: number;
  deductions_config: ProjectDeduction[];
}

export interface Project {
  id: string;
  code?: string;
  cost_center: string;
  name: string;
  client: string;
  location: string;
  contract_number?: string;
  description?: string;
  target_ml?: number;
  target_m2?: number;
  target_metric_type?: 'ml' | 'm2';
  requires_mapping?: boolean;
  requires_positioning?: boolean;
  mapping_ml?: number;
  mapping_m2?: number;
  positioning_ml?: number;
  positioning_m2?: number;
  mapping_progress_pct?: number;
  positioning_progress_pct?: number;
  overall_progress_pct?: number;
  contract_value?: number;
  deductions_percentage?: number;
  deductions_amount?: number;
  execution_value?: number;
  deductions_config?: ProjectDeduction[];
  commercial_proposal_id?: string | null;
  commercial_closing_id?: string | null;
  commercial_budget_id?: string | null;
  commercial_proposal?: { quote_code?: string; client_name?: string } | null;
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
  diameter?: string;
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
  localizador_name?: string;
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

  // Supabase Storage & AI Report
  pdf_report_url?: string;
  pdf_storage_path?: string;
  ai_summary?: string;

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
  drive_file_id?: string;
  drive_webview_url?: string;
  drive_download_url?: string;
  storage_path?: string;
  storage_url?: string;
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
  localizador_name: string;
  operator_name?: string;
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
  activeLocators?: number;
  activeOperators?: number;
  activeProjects: number;
}

// ─── Multi-división: Tools, Forms, Roles, Divisions ──────────────────────────

export type ToolCategory = 'gpr' | 'cad' | 'admin' | 'universal' | 'hseq' | 'rrhh' | 'warehouse' | 'purchasing' | 'commercial' | 'finance' | 'accounting';

export type ToolSlug =
  | 'gsf-processor'
  | 'txt-dwg-viewer'
  | 'docx-generator'
  | 'backup-script-gen'
  | 'gpr-field-form'
  | 'cad-register-form'
  | 'cad-productivity-board'
  | 'gis-viewer'
  | 'internal-chat'
  | 'meeting-transcriber'
  | 'org-chart-ai'
  | 'dynamic-dashboard'
  | 'attendance-tracker'
  | 'evidence-board'
  | 'cartas-audit'
  | 'elaboracion-cartas'
  | 'warehouse-inventory'
  | 'purchasing-dashboard'
  | 'purchasing-suppliers'
  | 'commercial-pipeline'
  | 'commercial-clients'
  | 'finance-expenses-board'
  | 'accounting-invoices-board';

export interface Tool {
  id: string;
  slug: ToolSlug;
  name: string;
  description: string;
  category: ToolCategory;
  is_universal: boolean;
}

export interface Division {
  id: string;
  name: string;
  description?: string;
}

export interface Form {
  id: string;
  slug: string;
  name: string;
  description: string;
  steps_count: number;
  has_attachments: boolean;
}

export interface Role {
  id: string;
  name: string;
  division_id: string;
  is_system_role: boolean;
  tools?: Tool[];
  forms?: Form[];
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

// ─── Attendance Control (Control de Asistencia y Jornada) ────────────────────────
export interface FieldTrip {
  id: string;
  time: string;
  destination: string;
  location?: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_in_location: string | null;
  check_in_is_office: boolean;
  check_out_time: string | null;
  check_out_location: string | null;
  check_out_is_office: boolean;
  total_hours: number;
  status: 'checked_in' | 'field_trip' | 'completed';
  field_trips: FieldTrip[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  users?: {
    id: string;
    email: string;
    full_name: string;
    role?: string;
  };
}

// ─── HR Letters (Elaboración y Auditoría de Cartas RRHH) ─────────────────────────

export type HrLetterType =
  | '01_certificacion_laboral'
  | '02_presentacion_personal_obra'
  | '03_vinculacion_a_proyecto'
  | '04_terminacion_contrato'
  | '05_paz_y_salvo'
  | '06_permiso_laboral'
  | '07_solicitud_entidad_externa';

export interface HrLetterData {
  // Metadatos
  carta_fecha: string;
  carta_radicado: string;
  firma_tel?: string;

  // Destinatario
  dest_nombre?: string;
  dest_cargo?: string;
  dest_empresa?: string;
  dest_ciudad?: string;

  // Empleado / Colaborador
  emp_nombre?: string;
  emp_apellidos?: string;
  emp_tipo_doc?: string;
  emp_documento?: string;
  emp_ciudad_exp?: string;
  emp_eps?: string;
  emp_pension?: string;
  emp_arl?: string;

  // Cargo y Contrato
  cargo_nombre?: string;
  cargo_tipo_contrato?: string;
  cargo_fecha_inicio?: string;
  cargo_fecha_fin?: string;
  cargo_hora_inicio?: string;
  cargo_salario?: string;
  cargo_salario_letras?: string;
  cert_destino?: string;

  // Proyecto
  project_id?: string;
  proy_nombre?: string;
  proy_direccion?: string;
  proy_etapa?: string;
  proy_contrato?: string;
  proy_duracion?: string;
  proy_jefe_cargo?: string;
  proy_jefe_nombre?: string;
  carta_fecha_acepta?: string;

  // Terminación
  term_tipo?: string;
  term_fecha?: string;
  term_causas?: string;
  term_indem_texto?: string;
  term_fecha_entrega?: string;

  // Paz y Salvo
  psv_item_1?: string;
  psv_item_2?: string;
  psv_item_3?: string;
  psv_item_4?: string;
  psv_item_5?: string;
  psv_item_6?: string;
  psv_item_7?: string;
  psv_observaciones?: string;

  // Permiso
  perm_fecha_solicitud?: string;
  perm_decision?: string;
  perm_tipo?: string;
  perm_motivo?: string;
  perm_fecha_inicio?: string;
  perm_fecha_fin?: string;
  perm_hora_inicio?: string;
  perm_hora_fin?: string;
  perm_total?: string;
  perm_compensacion?: string;

  // Solicitud Externa
  sol_objeto?: string;
  sol_referencia?: string;
  sol_doc_adicional?: string;
  sol_nota?: string;
  empresa_email?: string;
}

export interface HrLetter {
  id: string;
  project_id?: string | null;
  user_id: string;
  created_at: string;
  status: 'draft' | 'submitted' | 'audited' | 'cancelled';
  letter_type: HrLetterType;
  letter_title: string;
  radicado: string;
  employee_name?: string | null;
  employee_document?: string | null;
  recipient_name?: string | null;
  recipient_entity?: string | null;
  letter_data: HrLetterData;
  rendered_text: string;
  docx_url?: string | null;
  pdf_url?: string | null;
  docx_base64?: string | null;
  pdf_base64?: string | null;
  email_recipient?: string | null;
  email_sent: boolean;
  email_sent_at?: string | null;
  users?: {
    id: string;
    email: string;
    full_name: string;
    nick_name?: string | null;
    avatar_url?: string | null;
  };
  projects?: {
    id: string;
    name: string;
    code?: string;
  };
}

// ─── Equipment & Warehouse ───────────────────────────────────────────────────

export type EquipmentCategory = 
  | 'gpr'
  | 'antenna'
  | 'gnss'
  | 'total_station'
  | 'radiodetection'
  | 'vehicle'
  | 'accessory'
  | 'other';

export type EquipmentStatus = 
  | 'available'
  | 'in_field'
  | 'maintenance'
  | 'calibration'
  | 'decommissioned';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status: EquipmentStatus;
  calibration_date?: string | null;
  calibration_expiry_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type EquipmentCheckoutStatus = 'active' | 'returned' | 'overdue';

export interface EquipmentChecklist {
  batteries?: number;
  charger?: boolean;
  cables?: boolean;
  odometer?: boolean;
  pelican_case?: boolean;
  harness?: boolean;
  [key: string]: unknown;
}

export interface EquipmentCheckout {
  id: string;
  project_id: string;
  equipment_id: string;
  user_id: string;
  responsible_user_id?: string | null;
  responsible_name?: string | null;
  checkout_date: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  status: EquipmentCheckoutStatus;
  checklist?: EquipmentChecklist;
  notes?: string | null;
  return_notes?: string | null;
  return_checklist?: EquipmentChecklist;
  return_user_id?: string | null;
  return_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
  equipment?: Equipment;
  project?: {
    id: string;
    name: string;
    code?: string;
    client?: string;
  };
  responsible_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ConsumableEntry {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  invoice_number?: string | null;
  entry_date: string;
  notes?: string | null;
  user_id: string;
  created_at: string;
  users?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ─── Commercial Lifecycle & Engineering APU ──────────────────────────────────

export interface CommercialOpportunity {
  id: string;
  consecutive_number?: number | null;
  opportunity_code?: string | null;
  user_id: string;
  created_by_name?: string | null;
  created_by_email?: string | null;
  client_name: string;
  client_contact: string | null;
  client_email: string | null;
  client_phone: string | null;
  opportunity_title: string;
  service_type: string;
  estimated_value: number | null;
  deadline_date: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
}

export interface BudgetItem {
  id: string;
  category: 'materials' | 'equipment' | 'labor' | 'logistics' | 'subcontracts';
  description: string;
  brand?: string;
  suggested_supplier?: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
}

export interface CommercialBudget {
  id: string;
  consecutive_number: number;
  budget_code: string;
  opportunity_id: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email: string;
  client_name: string;
  project_title: string;
  service_category: string;
  direct_cost_materials: number;
  direct_cost_equipment: number;
  direct_cost_labor: number;
  direct_cost_logistics: number;
  total_direct_cost: number;
  aiu_percentage: number;
  suggested_sale_price: number;
  items_detail: BudgetItem[];
  status: 'draft' | 'approved' | 'quoted' | 'archived';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  commercial_opportunities?: { opportunity_code?: string; opportunity_title?: string; client_name?: string } | null;
}

export interface CommercialProposal {
  id: string;
  consecutive_number?: number | null;
  opportunity_id: string | null;
  budget_id: string | null;
  project_id: string | null;
  user_id: string;
  created_by_name?: string | null;
  created_by_email?: string | null;
  quote_code: string;
  client_name: string;
  scope_description: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  validity_days: number;
  delivery_weeks: number;
  notes: string | null;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  commercial_opportunities?: { opportunity_title?: string; service_type?: string; opportunity_code?: string } | null;
  commercial_budgets?: { budget_code?: string; total_direct_cost?: number; suggested_sale_price?: number } | null;
  projects?: { id?: string; code?: string; name?: string; cost_center?: string } | null;
}

export interface CommercialClosing {
  id: string;
  consecutive_number?: number | null;
  closing_code?: string | null;
  opportunity_id?: string | null;
  proposal_id: string | null;
  budget_id?: string | null;
  project_id?: string | null;
  sync_mode?: 'sync_to_quote' | 'keep_project_ceiling' | string | null;
  user_id: string;
  created_by_name?: string | null;
  created_by_email?: string | null;
  closing_type?: string;
  result?: string;
  final_value?: number;
  final_contract_value?: number;
  contract_number?: string | null;
  reason?: string | null;
  loss_reason?: string | null;
  feedback_notes?: string | null;
  closing_notes?: string | null;
  project_code?: string | null;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
  commercial_proposals?: { quote_code?: string; client_name?: string; total_amount?: number } | null;
  projects?: { id?: string; cost_center?: string; name?: string; client?: string; contract_value?: number; execution_value?: number } | null;
}

export interface CommercialPipelineStats {
  pipelineCOP: number;
  activeOpportunitiesCount: number;
  budgetsCount: number;
  issuedProposalsCount: number;
  wonContractsCOP: number;
  winRatePct: number;
}

export interface CommercialPipelineData {
  stats: CommercialPipelineStats;
  opportunities: CommercialOpportunity[];
  budgets: CommercialBudget[];
  proposals: CommercialProposal[];
  closings: CommercialClosing[];
  projects: Project[];
}

// ─── Directorio de Clientes (Comercial) ──────────────────────────────
export interface Client {
  id: string;
  company_name: string;
  nit?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  client_type?: 'corporativo' | 'publico' | 'contratista' | 'particular';
  economic_sector?: string | null;
  payment_terms?: string | null;
  status: 'active' | 'prospect' | 'inactive' | 'blocked';
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  // Campos calculados / agregados
  opportunities_count?: number;
  projects_count?: number;
  active_quotes_count?: number;
}

// ─── Directorio de Proveedores (Compras) ─────────────────────────────
export interface Supplier {
  id: string;
  company_name: string;
  nit: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  category?: string | null;
  payment_terms?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  notes?: string | null;
  status: 'active' | 'inactive' | 'blocked';
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Campos calculados / agregados
  purchase_orders_count?: number;
  evaluations_count?: number;
}



