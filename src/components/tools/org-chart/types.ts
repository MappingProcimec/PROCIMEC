export type NodeType =
  | 'direction'
  | 'division'
  | 'role'
  | 'user'
  | 'project'
  | 'system-service'
  | 'database'
  | 'client';

export type ReachMode = 'upstream' | 'downstream' | null;

export type ViewMode = 'org' | 'pipeline';

export interface DiagramNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  category?: string; // division slug or architecture tier
  badge?: string;
  status?: 'active' | 'warning' | 'idle' | 'busy';
  avatarUrl?: string;
  email?: string;
  meta?: Record<string, string | number | boolean>;
  tags?: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  parentId?: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'accent';
  animated?: boolean;
}

export interface DiagramGroup {
  id: string;
  title: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramPayload {
  mode: ViewMode;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  lastSyncedAt: string;
  stats: {
    totalUsers: number;
    totalDivisions: number;
    totalRoles: number;
    totalProjects: number;
    activeNodes: number;
  };
}

export interface AiDiagnosisResult {
  title: string;
  score: number; // 0-100
  summary: string;
  bottlenecks: {
    nodeId: string;
    nodeTitle: string;
    severity: 'alta' | 'media' | 'baja';
    issue: string;
    recommendation: string;
  }[];
  strengths: string[];
  actionItems: string[];
}
