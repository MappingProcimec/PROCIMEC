import React from 'react';
import {
  Radio,
  PenTool,
  ShieldCheck,
  Globe,
  Users,
} from 'lucide-react';
import {
  User,
  RoleOption,
  ProjectOption,
  DivisionBlock,
} from './types';

export function deriveSystemRole(
  roleName: string
):
  | 'localizador'
  | 'operator'
  | 'dibujo'
  | 'warehouse'
  | 'purchasing'
  | 'commercial'
  | 'finance'
  | 'accounting'
  | 'management'
  | 'hseq'
  | 'hr' {
  const n = roleName.toLowerCase();
  if (n.includes('almacén') || n.includes('almacen') || n.includes('warehouse') || n.includes('almacenista')) return 'warehouse';
  if (n.includes('compras') || n.includes('purchasing') || n.includes('adquisiciones')) return 'purchasing';
  if (n.includes('comercial') || n.includes('commercial') || n.includes('ventas')) return 'commercial';
  if (n.includes('finanzas') || n.includes('finance') || n.includes('tesoreria')) return 'finance';
  if (n.includes('contabilidad') || n.includes('accounting') || n.includes('contador')) return 'accounting';
  if (n.includes('gerencia') || n.includes('management') || n.includes('gerente') || n.includes('direccion')) return 'management';
  if (n.includes('hseq') || n.includes('seguridad')) return 'hseq';
  if (n.includes('rrhh') || n.includes('humano') || n.includes('recursos humanos') || n.includes('hr')) return 'hr';
  return n.includes('dibujo') || n.includes('cad') ? 'dibujo' : 'localizador';
}

export const SYSTEM_BADGE: Record<string, string> = {
  admin: 'badge-primary',
  pending: 'badge-warning',
  operator: 'badge-accent',
  localizador: 'badge-accent',
  dibujo: 'badge-success',
  warehouse: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
  purchasing: 'bg-blue-100 text-blue-900 border border-blue-300 font-semibold',
  commercial: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold',
  finance: 'bg-violet-100 text-violet-900 border border-violet-300 font-semibold',
  accounting: 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-semibold',
  management: 'bg-slate-200 text-slate-900 border border-slate-400 font-semibold',
  hseq: 'bg-teal-100 text-teal-800 border border-teal-200 font-semibold',
  hr: 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold',
};

export function getRoleBadgeClass(roleName?: string, userRole: string = 'localizador'): string {
  if (!roleName) return SYSTEM_BADGE[userRole] ?? 'badge-accent';
  const lower = roleName.toLowerCase();
  if (lower.includes('almacén') || lower.includes('almacen') || lower.includes('warehouse') || lower.includes('almacenista')) {
    return 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold';
  }
  if (lower.includes('compras') || lower.includes('purchasing')) {
    return 'bg-blue-100 text-blue-900 border border-blue-300 font-semibold';
  }
  if (lower.includes('comercial') || lower.includes('commercial') || lower.includes('ventas')) {
    return 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold';
  }
  if (lower.includes('finanzas') || lower.includes('finance') || lower.includes('tesorer')) {
    return 'bg-violet-100 text-violet-900 border border-violet-300 font-semibold';
  }
  if (lower.includes('contabilidad') || lower.includes('accounting') || lower.includes('contador')) {
    return 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-semibold';
  }
  if (lower.includes('gerencia') || lower.includes('management') || lower.includes('gerente') || lower.includes('direcci')) {
    return 'bg-slate-200 text-slate-900 border border-slate-400 font-semibold';
  }
  if (lower.includes('hseq')) return 'bg-teal-100 text-teal-800 border border-teal-200 font-semibold';
  if (lower.includes('rrhh') || lower.includes('humano')) return 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold';
  if (lower.includes('dibujo') || lower.includes('cad')) return 'badge-success';
  return SYSTEM_BADGE[userRole] ?? 'badge-accent';
}

export function userDisplayBadge(
  user: User,
  roleOptions: RoleOption[] = [],
  rolesById?: Map<string, RoleOption>
) {
  if (user.role === 'admin') return { label: 'Administrador', badge: 'badge-primary' };
  if (user.role === 'pending') return { label: 'Pendiente', badge: 'badge-warning' };
  if (user.role === 'warehouse') return { label: 'Almacén', badge: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold' };
  if (user.role === 'purchasing') return { label: 'Compras', badge: 'bg-blue-100 text-blue-900 border border-blue-300 font-semibold' };
  if (user.role === 'commercial') return { label: 'Comercial', badge: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold' };
  if (user.role === 'finance') return { label: 'Finanzas', badge: 'bg-violet-100 text-violet-900 border border-violet-300 font-semibold' };
  if (user.role === 'accounting') return { label: 'Contabilidad', badge: 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-semibold' };
  if (user.role === 'management') return { label: 'Gerencia', badge: 'bg-slate-200 text-slate-900 border border-slate-400 font-semibold' };
  if (user.role === 'hseq') return { label: 'HSEQ', badge: 'bg-teal-100 text-teal-800 border border-teal-200 font-semibold' };
  if (user.role === 'hr') return { label: 'Gestión Humana', badge: 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold' };
  if (user.roles?.name) return { label: user.roles.name, badge: getRoleBadgeClass(user.roles.name, user.role) };

  const udrList = user.user_division_roles;
  if (udrList && udrList.length > 0) {
    for (let i = 0; i < udrList.length; i++) {
      const udrRoleId = udrList[i].role_id;
      if (udrRoleId) {
        const foundRole = rolesById ? rolesById.get(udrRoleId) : roleOptions.find((r) => r.id === udrRoleId);
        if (foundRole) return { label: foundRole.name, badge: getRoleBadgeClass(foundRole.name, user.role) };
      }
    }
  }

  const defaultLabel = user.role === 'dibujo' || user.role === 'drawing' ? 'Dibujo' : 'Localizador';
  return { label: defaultLabel, badge: SYSTEM_BADGE[user.role] ?? 'badge-accent' };
}

export const TOOL_CATEGORY_STYLES: Record<string, { label: string; type: string; bg: string; text: string }> = {
  gpr: { label: 'GPR / Geofísica', type: 'gpr', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  cad: { label: 'CAD / BIM', type: 'cad', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800' },
  admin: { label: 'Administración', type: 'admin', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800' },
  universal: { label: 'Universal', type: 'universal', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
  hseq: { label: 'HSEQ / Seguridad', type: 'hseq', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800' },
  rrhh: { label: 'RRHH / Gestión Humana', type: 'rrhh', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800' },
  warehouse: { label: 'Almacén / Bodega', type: 'warehouse', bg: 'bg-amber-100/70 border-amber-300', text: 'text-amber-900' },
  purchasing: { label: 'Compras / Proveedores', type: 'purchasing', bg: 'bg-blue-100/70 border-blue-300', text: 'text-blue-900' },
  commercial: { label: 'Comercial / Pipeline', type: 'commercial', bg: 'bg-emerald-100/70 border-emerald-300', text: 'text-emerald-900' },
  finance: { label: 'Finanzas / Viáticos', type: 'finance', bg: 'bg-violet-100/70 border-violet-300', text: 'text-violet-900' },
  accounting: { label: 'Contabilidad / Facturas', type: 'accounting', bg: 'bg-cyan-100/70 border-cyan-300', text: 'text-cyan-900' },
};

export function ToolCategoryIcon({ type }: { type: string }) {
  if (type === 'gpr') return <Radio className="w-4 h-4 text-accent" strokeWidth={1.75} />;
  if (type === 'cad') return <PenTool className="w-4 h-4 text-slate-700" strokeWidth={1.75} />;
  if (type === 'admin') return <ShieldCheck className="w-4 h-4 text-purple-600" strokeWidth={1.75} />;
  if (type === 'hseq') return <ShieldCheck className="w-4 h-4 text-teal-600" strokeWidth={1.75} />;
  if (type === 'rrhh') return <Users className="w-4 h-4 text-indigo-600" strokeWidth={1.75} />;
  return <Globe className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />;
}

export function getUserRoleIds(user: User, roleOptions: RoleOption[]): string[] {
  const ids = new Set<string>();
  if (user.role_id) ids.add(user.role_id);
  const udrList = user.user_division_roles;
  if (udrList) {
    for (let i = 0; i < udrList.length; i++) {
      if (udrList[i].role_id) ids.add(udrList[i].role_id!);
    }
  }
  if (ids.size === 0 && user.role && user.role !== 'admin' && user.role !== 'pending') {
    const roleLower = user.role.toLowerCase();
    const match = roleOptions.find((r) => {
      const rNameLower = r.name.toLowerCase();
      return (
        rNameLower === roleLower ||
        ((user.role === 'operator' || user.role === 'localizador') &&
          (rNameLower.includes('localizador') || rNameLower.includes('operador'))) ||
        (user.role === 'dibujo' && (rNameLower.includes('dibujo') || rNameLower.includes('cad'))) ||
        (user.role === 'warehouse' &&
          (rNameLower.includes('almacén') ||
            rNameLower.includes('almacen') ||
            rNameLower.includes('warehouse') ||
            rNameLower.includes('almacenista'))) ||
        (user.role === 'purchasing' &&
          (rNameLower.includes('compras') ||
            rNameLower.includes('purchasing') ||
            rNameLower.includes('adquisiciones'))) ||
        (user.role === 'commercial' &&
          (rNameLower.includes('comercial') ||
            rNameLower.includes('commercial') ||
            rNameLower.includes('ventas'))) ||
        (user.role === 'finance' &&
          (rNameLower.includes('finanzas') ||
            rNameLower.includes('finance') ||
            rNameLower.includes('tesoreria'))) ||
        (user.role === 'accounting' &&
          (rNameLower.includes('contabilidad') ||
            rNameLower.includes('accounting') ||
            rNameLower.includes('contador'))) ||
        (user.role === 'management' &&
          (rNameLower.includes('gerencia') ||
            rNameLower.includes('management') ||
            rNameLower.includes('gerente') ||
            rNameLower.includes('direccion'))) ||
        (user.role === 'hseq' && (rNameLower.includes('hseq') || rNameLower.includes('seguridad'))) ||
        (user.role === 'hr' &&
          (rNameLower.includes('rrhh') ||
            rNameLower.includes('humano') ||
            rNameLower.includes('recursos humanos') ||
            rNameLower.includes('hr')))
      );
    });
    if (match) ids.add(match.id);
  }
  return Array.from(ids);
}

export function getToolsAndFormsFromRoles(
  roleIds: string[],
  roleOptions: RoleOption[],
  rolesById?: Map<string, RoleOption>
) {
  const toolIds = new Set<string>();
  const formIds = new Set<string>();

  for (let i = 0; i < roleIds.length; i++) {
    const rid = roleIds[i];
    const r = rolesById ? rolesById.get(rid) : roleOptions.find((opt) => opt.id === rid);
    if (r) {
      (r.role_tools ?? []).forEach((rt) => {
        if (rt.tools?.id) toolIds.add(rt.tools.id);
      });
      (r.role_forms ?? []).forEach((rf) => {
        if (rf.forms?.id) formIds.add(rf.forms.id);
      });
    }
  }

  return { toolIds, formIds };
}

export function getUserEffectiveToolsAndForms(user: User) {
  const toolIds = new Set<string>((user.user_tools ?? []).map((ut) => ut.tool_id));
  const formIds = new Set<string>((user.user_forms ?? []).map((uf) => uf.form_id));

  return {
    toolCount: toolIds.size,
    formCount: formIds.size,
    toolIds,
    formIds,
  };
}

export function buildInitialDivisionBlocks(
  user: User,
  rolesById: Map<string, RoleOption>,
  allProjects: ProjectOption[],
  projectsByDivisionId: Map<string, ProjectOption[]>
): DivisionBlock[] {
  const userProjIds = new Set(user.user_projects?.map((up) => up.project_id) ?? []);
  const udrList = user.user_division_roles ?? [];

  const projectsForDiv = (divId: string) => (divId ? projectsByDivisionId.get(divId) || [] : []);

  if (udrList.length > 0) {
    const blocks = udrList
      .filter((u) => u.division_id)
      .map((u) => {
        const divProjs = projectsForDiv(u.division_id);
        const selected = divProjs.filter((p) => userProjIds.has(p.id)).map((p) => p.id);
        return {
          divisionId: u.division_id,
          roleId: u.role_id ?? '',
          projectIds: new Set<string>(selected.length > 0 ? selected : divProjs.map((p) => p.id)),
        };
      });
    return blocks.length > 0 ? blocks : [{ divisionId: '', roleId: '', projectIds: new Set() }];
  } else if (user.role_id) {
    const role = rolesById.get(user.role_id);
    if (role?.division_id) {
      const divProjs = projectsForDiv(role.division_id);
      const selected = divProjs.filter((p) => userProjIds.has(p.id)).map((p) => p.id);
      return [
        {
          divisionId: role.division_id,
          roleId: user.role_id,
          projectIds: new Set(selected.length > 0 ? selected : divProjs.map((p) => p.id)),
        },
      ];
    } else {
      let inferredDivId = '';
      if (userProjIds.size > 0) {
        const firstProj = allProjects.find((p) => userProjIds.has(p.id));
        if (firstProj?.divisions && firstProj.divisions.length > 0) {
          inferredDivId = firstProj.divisions[0].id;
        }
      }
      const divProjs = inferredDivId ? projectsForDiv(inferredDivId) : [];
      const selected = divProjs.filter((p) => userProjIds.has(p.id)).map((p) => p.id);
      return [
        {
          divisionId: inferredDivId,
          roleId: user.role_id,
          projectIds: new Set(selected.length > 0 ? selected : inferredDivId ? divProjs.map((p) => p.id) : []),
        },
      ];
    }
  }

  return [{ divisionId: '', roleId: '', projectIds: new Set() }];
}
