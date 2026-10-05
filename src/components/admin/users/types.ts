export interface DivisionOption {
  id: string;
  name: string;
}

export interface RoleOption {
  id: string;
  name: string;
  division_id: string | null;
  divisions?: { name: string } | null;
  role_tools?: { tools: { id: string; slug?: string; name?: string; category?: string } }[];
  role_forms?: { forms: { id: string; slug?: string; name?: string } }[];
}

export interface ProjectOption {
  id: string;
  code?: string;
  cost_center?: string;
  name: string;
  is_active?: boolean;
  divisions?: { id: string }[];
}

export interface ToolOption {
  id: string;
  slug: string;
  name: string;
  category: string;
  is_universal: boolean;
}

export interface FormOption {
  id: string;
  slug: string;
  name: string;
  description?: string;
  steps_count?: number;
}

export interface UserDivisionRole {
  division_id: string;
  role_id: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  nick_name?: string | null;
  avatar_url?: string;
  phone?: string | null;
  role:
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
  role_id: string | null;
  roles: { id: string; name: string } | null;
  is_active: boolean;
  created_at: string;
  user_projects?: { project_id: string }[];
  user_division_roles?: UserDivisionRole[];
  user_tools?: { tool_id: string }[];
  user_forms?: { form_id: string }[];
}

export interface DivisionBlock {
  divisionId: string;
  roleId: string;
  projectIds: Set<string>;
}
