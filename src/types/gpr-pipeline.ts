export type GprPipelineStepKey = 
  | 'cad_2d' 
  | 'gpr_raw_proc' 
  | 'cad_2d_refine' 
  | 'bim_3d_rvt' 
  | 'project_report';

export type GprPipelineStatus = 'draft' | 'in_progress' | 'completed' | 'failed';
export type GprStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GprPipelineCostRates {
  cad_2d_rate_per_ml: number;
  gpr_proc_rate_per_ml: number;
  cad_refine_rate_per_utility: number;
  bim_3d_rate_per_ml: number;
  report_fixed_rate: number;
}

export interface GprPipelineCostBreakdown {
  cad_2d_cost: number;
  gpr_proc_cost: number;
  cad_refine_cost: number;
  bim_3d_cost: number;
  report_cost: number;
}

export interface GprPipelineInputMetrics {
  total_ml: number;
  total_m2: number;
  utilities_count: number;
  reports_count: number;
  tramos_count: number;
  max_depth_m: number;
  selected_report_ids?: string[];
}

export interface GprPipelineStep {
  id: string;
  job_id: string;
  step_order: number;
  step_key: GprPipelineStepKey;
  step_name: string;
  status: GprStepStatus;
  cost_cop: number;
  template_file_url?: string | null;
  template_file_name?: string | null;
  output_file_url?: string | null;
  output_file_name?: string | null;
  output_file_type?: string | null;
  ai_prompt?: string | null;
  ai_response?: string | null;
  ai_model_used?: string | null;
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
  } | null;
  execution_logs?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GprPipelineJob {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  status: GprPipelineStatus;
  current_step: GprPipelineStepKey;
  input_metrics: GprPipelineInputMetrics;
  cost_rates: GprPipelineCostRates;
  cost_breakdown: GprPipelineCostBreakdown;
  total_cost_cop: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  steps?: GprPipelineStep[];
}

export interface ReportFileItem {
  id: string;
  field_report_id: string;
  file_type: 'raw_gpr' | 'gps' | 'photo' | string;
  original_name: string;
  url?: string | null;
  caption?: string | null;
  created_at?: string;
}

export interface RawFieldReportItem {
  id: string;
  report_date: string;
  report_time?: string | null;
  localizador_name: string;
  global_max_depth?: number | null;
  antenna_frequency?: string | null;
  gpr_equipment?: string | null;
  terrain_conditions?: string | null;
  weather_conditions?: string | null;
  capture_method?: string | null;
  operational_summary?: Array<{
    sector?: string;
    ml?: number;
    m2?: number;
    max_depth_m?: number;
    observations?: string;
  }> | null;
  detected_utilities?: Array<{
    type?: string;
    diameter?: string;
    estimated_depth_m?: number;
    confidence?: string;
    description?: string;
  }> | null;
  total_ml: number;
  total_m2: number;
  utilities_count: number;
  files_count?: number;
  raw_gpr_count?: number;
  gps_count?: number;
  photos_count?: number;
  files?: ReportFileItem[];
  created_at: string;
}

export interface ProjectGprDataSummary {
  project_id: string;
  project_name: string;
  client: string;
  cost_center?: string;
  location?: string;
  total_ml: number;
  total_m2: number;
  max_depth_m: number;
  reports_count: number;
  tramos: Array<{
    id?: string;
    sector: string;
    ml: number;
    m2: number;
    max_depth_m: number;
    observations?: string;
    report_date: string;
    localizador_name: string;
  }>;
  detected_utilities: Array<{
    id?: string;
    type: string;
    diameter?: string;
    estimated_depth_m: number;
    confidence: string;
    description?: string;
    report_date: string;
  }>;
  raw_gpr_files_count: number;
  gps_files_count: number;
  photos_count: number;
  field_reports?: RawFieldReportItem[];
}
