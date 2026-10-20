export type DevTicketStatus =
  | 'pending_spec'
  | 'awaiting_approval'
  | 'approved'
  | 'in_progress'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AffectedFilePlan {
  path: string;
  action: 'modify' | 'create' | 'delete';
  reason: string;
}

export interface ExternalAction {
  type: 'supabase_sql' | 'env_var' | 'manual_permission';
  title: string;
  instructions: string;
  payload?: string;
}

export interface TechnicalSpec {
  summary: string;
  affectedFiles: AffectedFilePlan[];
  risks: string[];
  verificationCommands: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  externalActions?: ExternalAction[];
}

export interface FeedbackEntry {
  author: 'admin' | 'ai';
  message: string;
  timestamp: string;
  version: number;
}

export interface DevTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  context_url?: string | null;
  status: DevTicketStatus;
  technical_spec: TechnicalSpec;
  feedback_history: FeedbackEntry[];
  commit_hash?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
    role: string;
    nick_name?: string | null;
  };
}

export interface DevTicketLog {
  id: string;
  ticket_id: string;
  stage: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
