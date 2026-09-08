'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

interface DivisionOption { id: string; name: string }
interface RoleOption {
  id: string;
  name: string;
  division_id: string | null;
  divisions?: { name: string } | null;
  role_tools?: { tools: { id: string; slug?: string; name?: string; category?: string } }[];
  role_forms?: { forms: { id: string; slug?: string; name?: string } }[];
}
interface ProjectOption { id: string; code?: string; cost_center?: string; name: string; is_active?: boolean; divisions?: { id: string }[] }
interface ToolOption { id: string; slug: string; name: string; category: string; is_universal: boolean }
interface FormOption { id: string; slug: string; name: string; description?: string; steps_count?: number }

interface UserDivisionRole { division_id: string; role_id: string | null }
interface User {
  id: string; email: string; full_name: string; avatar_url?: string;
  role: 'admin' | 'operator' | 'pending' | 'dibujo';
  role_id: string | null;
  roles: { id: string; name: string } | null;
  is_active: boolean; created_at: string;
  user_projects?: { project_id: string }[];
  user_division_roles?: UserDivisionRole[];
  user_tools?: { tool_id: string }[];
  user_forms?: { form_id: string }[];
}

interface DivisionBlock { divisionId: string; roleId: string; projectIds: Set<string> }

async function fetchAll() {
  const [usersRes, projectsRes, rolesRes, divisionsRes, toolsRes, formsRes] = await Promise.all([
    fetch('/api/admin/users'),
    fetch('/api/admin/projects'),
    fetch('/api/admin/roles'),
    fetch('/api/admin/divisions'),
    fetch('/api/admin/tools'),
    fetch('/api/admin/forms'),
  ]);
  return {
    users: (await usersRes.json()).data ?? [],
    projects: (await projectsRes.json()).data ?? [],
    roles: (await rolesRes.json()).data ?? [],
    divisions: (await divisionsRes.json()).data ?? [],
    tools: (await toolsRes.json()).data ?? [],
    forms: (await formsRes.json()).data ?? [],
  };
}

function deriveSystemRole(roleName: string): 'operator' | 'dibujo' {
  const n = roleName.toLowerCase();
  return n.includes('dibujo') || n.includes('cad') ? 'dibujo' : 'operator';
}

const SYSTEM_BADGE: Record<string, string> = {
  admin: 'badge-primary', pending: 'badge-warning', operator: 'badge-accent', dibujo: 'badge-success',
};

function userDisplayBadge(user: User) {
  if (user.role === 'admin') return { label: 'Administrador', badge: 'badge-primary' };
  if (user.role === 'pending') return { label: 'Pendiente', badge: 'badge-warning' };
  if (user.roles) return { label: user.roles.name, badge: SYSTEM_BADGE[user.role] ?? 'badge-accent' };
  return { label: user.role === 'dibujo' ? 'Dibujo' : 'Operador', badge: SYSTEM_BADGE[user.role] ?? 'badge-accent' };
}

const TOOL_CATEGORY_STYLES: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  gpr: { label: 'GPR / Geofísica', icon: '📡', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  cad: { label: 'CAD / BIM', icon: '✏️', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  admin: { label: 'Administración', icon: '⚙️', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  universal: { label: 'Universal', icon: '🌐', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
};

// ── Helpers para resolver herramientas y formularios del rol ──────────────────
function getUserRoleIds(user: User, roleOptions: RoleOption[]): string[] {
  const ids = new Set<string>();
  if (user.role_id) ids.add(user.role_id);
  (user.user_division_roles ?? []).forEach(udr => {
    if (udr.role_id) ids.add(udr.role_id);
  });
  if (ids.size === 0 && user.role && user.role !== 'admin' && user.role !== 'pending') {
    const match = roleOptions.find(r =>
      r.name.toLowerCase() === user.role.toLowerCase() ||
      (user.role === 'operator' && r.name.toLowerCase().includes('operador')) ||
      (user.role === 'dibujo' && r.name.toLowerCase().includes('dibujo'))
    );
    if (match) ids.add(match.id);
  }
  return Array.from(ids);
}

function getToolsAndFormsFromRoles(roleIds: string[], roleOptions: RoleOption[]) {
  const toolIds = new Set<string>();
  const formIds = new Set<string>();

  roleIds.forEach(rid => {
    const r = roleOptions.find(opt => opt.id === rid);
    if (r) {
      (r.role_tools ?? []).forEach(rt => {
        if (rt.tools?.id) toolIds.add(rt.tools.id);
      });
      (r.role_forms ?? []).forEach(rf => {
        if (rf.forms?.id) formIds.add(rf.forms.id);
      });
    }
  });

  return { toolIds, formIds };
}

function getUserEffectiveToolsAndForms(user: User, roleOptions: RoleOption[]) {
  const roleIds = getUserRoleIds(user, roleOptions);
  const { toolIds, formIds } = getToolsAndFormsFromRoles(roleIds, roleOptions);

  // Unir herramientas asignadas individualmente
  (user.user_tools ?? []).forEach(ut => toolIds.add(ut.tool_id));
  // Unir formularios asignados individualmente
  (user.user_forms ?? []).forEach(uf => formIds.add(uf.form_id));

  return {
    toolCount: toolIds.size,
    formCount: formIds.size,
    toolIds,
    formIds,
  };
}

// ── DivisionBlockCard ─────────────────────────────────────────────────────────
function DivisionBlockCard({
  block, blockIndex, divisions, roleOptions, allProjects, usedDivisionIds, canRemove,
  onDivisionChange, onRoleChange, onToggleProject, onRemove,
}: {
  block: DivisionBlock; blockIndex: number;
  divisions: DivisionOption[]; roleOptions: RoleOption[]; allProjects: ProjectOption[];
  usedDivisionIds: string[]; canRemove: boolean;
  onDivisionChange: (i: number, divId: string) => void;
  onRoleChange: (i: number, roleId: string) => void;
  onToggleProject: (i: number, projId: string) => void;
  onRemove: (i: number) => void;
}) {
  const [search, setSearch] = useState('');
  const divProjects = allProjects.filter(p => (p.divisions ?? []).some(d => d.id === block.divisionId));
  const filtered = search
    ? divProjects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || ((p.cost_center || p.code || '').toLowerCase().includes(search.toLowerCase())))
    : divProjects;
  const divRoles = roleOptions.filter(r => r.division_id === block.divisionId);

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-gray-50/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">División</span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(blockIndex)} className="text-xs text-error hover:underline">
            Quitar
          </button>
        )}
      </div>

      {/* Division selector */}
      <select
        value={block.divisionId}
        onChange={e => onDivisionChange(blockIndex, e.target.value)}
        className="select text-sm"
      >
        <option value="">— Seleccionar división —</option>
        {divisions
          .filter(d => d.id === block.divisionId || !usedDivisionIds.includes(d.id))
          .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {block.divisionId && (
        <>
          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label text-xs">
                Proyectos
                <span className="ml-1 text-text-muted font-normal">
                  ({block.projectIds.size}/{divProjects.length})
                </span>
              </label>
              {divProjects.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => divProjects.forEach(p => {
                      if (!block.projectIds.has(p.id)) onToggleProject(blockIndex, p.id);
                    })}
                    className="text-primary hover:underline font-semibold"
                  >
                    Todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => divProjects.forEach(p => {
                      if (block.projectIds.has(p.id)) onToggleProject(blockIndex, p.id);
                    })}
                    className="text-text-muted hover:text-error hover:underline font-medium"
                  >
                    Ninguno
                  </button>
                </div>
              )}
            </div>

            {divProjects.length === 0 ? (
              <p className="text-xs text-text-muted">Esta división no tiene proyectos vinculados.</p>
            ) : (
              <>
                <div className="relative mb-1.5">
                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar proyecto..." className="input pl-7 py-1 text-xs"
                  />
                </div>
                <div className="border border-border rounded-xl max-h-36 overflow-y-auto divide-y divide-border bg-white">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-text-muted text-center">Sin resultados</p>
                  ) : filtered.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox" checked={block.projectIds.has(p.id)}
                        onChange={() => onToggleProject(blockIndex, p.id)}
                        className="rounded text-primary"
                      />
                      <span className="text-xs font-bold text-text-muted w-12 flex-shrink-0">{p.code}</span>
                      <span className="text-sm text-text-primary flex-1 truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="label text-xs mb-1.5 block">Rol</label>
            <select
              value={block.roleId}
              onChange={e => onRoleChange(blockIndex, e.target.value)}
              className="select text-sm"
            >
              <option value="">— Seleccionar rol —</option>
              {divRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {divRoles.length === 0 && (
              <p className="text-xs text-text-muted mt-1">Esta división no tiene roles asignados.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [accessType, setAccessType] = useState<'admin' | 'pending' | 'division'>('division');
  const [editBlocks, setEditBlocks] = useState<DivisionBlock[]>([]);
  const [blocksReady, setBlocksReady] = useState(false);

  // Pestaña activa dentro del modal de edición
  const [sectionTab, setSectionTab] = useState<'division' | 'tools' | 'forms'>('division');

  // Herramientas y Formularios asignados al usuario específico
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [toolSearch, setToolSearch] = useState('');
  const [formSearch, setFormSearch] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchAll });

  const users: User[] = useMemo(() => data?.users ?? [], [data?.users]);
  const allProjects: ProjectOption[] = useMemo(() => data?.projects ?? [], [data?.projects]);
  const roleOptions: RoleOption[] = useMemo(() => data?.roles ?? [], [data?.roles]);
  const divisions: DivisionOption[] = useMemo(() => data?.divisions ?? [], [data?.divisions]);
  const allTools: ToolOption[] = useMemo(() => data?.tools ?? [], [data?.tools]);
  const allForms: FormOption[] = useMemo(() => data?.forms ?? [], [data?.forms]);

  const projectsForDiv = (divId: string) =>
    allProjects.filter(p => (p.divisions ?? []).some(d => d.id === divId));

  // Initialize blocks and sync role tools/forms when data and user are ready
  useEffect(() => {
    if (!editingUser || accessType !== 'division' || blocksReady) return;
    if (!roleOptions.length || !allProjects.length) return;

    const userProjIds = new Set(editingUser.user_projects?.map(up => up.project_id) ?? []);
    const udrList = editingUser.user_division_roles ?? [];

    if (udrList.length > 0) {
      const blocks = udrList.filter(u => u.division_id).map(u => {
        const divProjs = projectsForDiv(u.division_id);
        const selected = divProjs.filter(p => userProjIds.has(p.id)).map(p => p.id);
        return {
          divisionId: u.division_id,
          roleId: u.role_id ?? '',
          projectIds: new Set<string>(selected.length > 0 ? selected : divProjs.map(p => p.id)),
        };
      });
      setEditBlocks(blocks.length > 0 ? blocks : [{ divisionId: '', roleId: '', projectIds: new Set() }]);
    } else if (editingUser.role_id) {
      const role = roleOptions.find(r => r.id === editingUser.role_id);
      if (role?.division_id) {
        const divProjs = projectsForDiv(role.division_id);
        const selected = divProjs.filter(p => userProjIds.has(p.id)).map(p => p.id);
        setEditBlocks([{
          divisionId: role.division_id,
          roleId: editingUser.role_id,
          projectIds: new Set(selected.length > 0 ? selected : divProjs.map(p => p.id)),
        }]);
      } else {
        setEditBlocks([{ divisionId: '', roleId: '', projectIds: new Set() }]);
      }
    } else {
      setEditBlocks([{ divisionId: '', roleId: '', projectIds: new Set() }]);
    }

    // Pre-cargar herramientas y formularios (del rol + individuales)
    const effective = getUserEffectiveToolsAndForms(editingUser, roleOptions);
    setSelectedToolIds(prev => prev.size > 0 ? prev : new Set(effective.toolIds));
    setSelectedFormIds(prev => prev.size > 0 ? prev : new Set(effective.formIds));

    setBlocksReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingUser, accessType, blocksReady, roleOptions.length, allProjects.length]);

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string; role?: string; role_id?: string | null;
      is_active?: boolean; project_ids?: string[];
      division_roles?: { division_id: string; role_id: string | null }[];
      tool_ids?: string[];
      form_ids?: string[];
    }) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al actualizar usuario');
      return json;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      if (resData?.warning) {
        alert(resData.warning);
      }
    },
  });

  const openEdit = (user: User) => {
    setEditingUser(user);
    setAccessType(user.role === 'admin' ? 'admin' : user.role === 'pending' ? 'pending' : 'division');
    setEditBlocks([]);
    setBlocksReady(false);
    setSectionTab('division');

    // Pre-cargar las herramientas y formularios que YA tiene asignados (por su rol + asignaciones individuales)
    const effective = getUserEffectiveToolsAndForms(user, roleOptions);
    setSelectedToolIds(new Set(effective.toolIds));
    setSelectedFormIds(new Set(effective.formIds));

    setToolSearch('');
    setFormSearch('');
  };

  const handleSave = () => {
    if (!editingUser) return;
    const tool_ids = Array.from(selectedToolIds);
    const form_ids = Array.from(selectedFormIds);

    if (accessType === 'admin') {
      updateMutation.mutate({
        id: editingUser.id,
        role: 'admin',
        role_id: null,
        division_roles: [],
        project_ids: [],
        tool_ids,
        form_ids,
      });
    } else if (accessType === 'pending') {
      updateMutation.mutate({
        id: editingUser.id,
        role: 'pending',
        role_id: null,
        division_roles: [],
        project_ids: [],
        tool_ids,
        form_ids,
      });
    } else {
      const valid = editBlocks.filter(b => b.divisionId);
      const division_roles = valid.map(b => ({ division_id: b.divisionId, role_id: b.roleId || null }));
      const project_ids = Array.from(new Set(valid.flatMap(b => Array.from(b.projectIds))));
      const primaryRole = roleOptions.find(r => r.id === valid[0]?.roleId);
      const sysRole = primaryRole ? deriveSystemRole(primaryRole.name) : 'operator';
      updateMutation.mutate({
        id: editingUser.id,
        role: sysRole,
        role_id: valid[0]?.roleId || null,
        division_roles,
        project_ids,
        tool_ids,
        form_ids,
      });
    }
  };

  const toggleActive = (user: User) => updateMutation.mutate({ id: user.id, is_active: !user.is_active });

  // Block operations
  const addBlock = () => setEditBlocks(prev => [...prev, { divisionId: '', roleId: '', projectIds: new Set() }]);
  const removeBlock = (i: number) => setEditBlocks(prev => prev.filter((_, idx) => idx !== i));

  const onDivisionChange = (i: number, divId: string) => {
    const divProjs = projectsForDiv(divId);
    setEditBlocks(prev => prev.map((b, idx) => idx === i ? {
      divisionId: divId, roleId: '', projectIds: new Set(divProjs.map(p => p.id)),
    } : b));
  };

  // Al cambiar de rol, fusionar automáticamente las herramientas y formularios correspondientes
  const onRoleChange = (i: number, roleId: string) => {
    setEditBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, roleId } : b));
    if (roleId) {
      const { toolIds: newToolIds, formIds: newFormIds } = getToolsAndFormsFromRoles([roleId], roleOptions);
      setSelectedToolIds(prev => {
        const next = new Set(prev);
        newToolIds.forEach(id => next.add(id));
        return next;
      });
      setSelectedFormIds(prev => {
        const next = new Set(prev);
        newFormIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const onToggleProject = (blockIndex: number, projId: string) =>
    setEditBlocks(prev => prev.map((b, idx) => {
      if (idx !== blockIndex) return b;
      const next = new Set(b.projectIds);
      if (next.has(projId)) next.delete(projId); else next.add(projId);
      return { ...b, projectIds: next };
    }));

  // Toggle de herramienta específica
  const onToggleTool = (toolId: string) => {
    setSelectedToolIds(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId); else next.add(toolId);
      return next;
    });
  };

  // Toggle de formulario específico
  const onToggleForm = (formId: string) => {
    setSelectedFormIds(prev => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId); else next.add(formId);
      return next;
    });
  };

  const usedDivisionIds = editBlocks.map(b => b.divisionId).filter(Boolean);
  const pendingCount = users.filter(u => u.role === 'pending').length;

  // Filtrado de herramientas por búsqueda
  const filteredTools = allTools.filter(t =>
    t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
    t.slug.toLowerCase().includes(toolSearch.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(toolSearch.toLowerCase()))
  );

  // Filtrado de formularios por búsqueda
  const filteredForms = allForms.filter(f =>
    f.name.toLowerCase().includes(formSearch.toLowerCase()) ||
    f.slug.toLowerCase().includes(formSearch.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(formSearch.toLowerCase()))
  );

  // Permisos otorgados por el rol activo en el modal
  const currentModalRoleIds = useMemo(() => {
    const fromBlocks = editBlocks.map(b => b.roleId).filter(Boolean);
    if (fromBlocks.length > 0) return fromBlocks;
    if (editingUser) return getUserRoleIds(editingUser, roleOptions);
    return [];
  }, [editBlocks, editingUser, roleOptions]);

  const currentRolePermissions = useMemo(() => {
    return getToolsAndFormsFromRoles(currentModalRoleIds, roleOptions);
  }, [currentModalRoleIds, roleOptions]);

  // Función para restablecer exactamente a las herramientas de su rol
  const handleResetToRoleDefaults = () => {
    setSelectedToolIds(new Set(currentRolePermissions.toolIds));
    setSelectedFormIds(new Set(currentRolePermissions.formIds));
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Gestión de Usuarios</h1>
          <div className="flex items-center gap-3">
            <p className="text-white/70 text-sm">{users.length} usuarios registrados</p>
            {pendingCount > 0 && (
              <span className="badge bg-amber-400 text-white animate-pulse-soft">
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Cargando usuarios...</div>
          ) : (
            <div className="divide-y divide-border">
              {users
                .sort((a, b) => {
                  if (a.role === 'pending' && b.role !== 'pending') return -1;
                  if (a.role !== 'pending' && b.role === 'pending') return 1;
                  return 0;
                })
                .map(user => {
                  const badge = userDisplayBadge(user);
                  const effective = getUserEffectiveToolsAndForms(user, roleOptions);
                  const toolsCount = effective.toolCount;
                  const formsCount = effective.formCount;
                  const projsCount = user.user_projects?.length ?? 0;

                  return (
                    <div key={user.id} className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                      user.role === 'pending' ? 'bg-amber-50' : !user.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                    }`}>
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt={user.full_name} className="w-11 h-11 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold">{user.full_name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-text-primary text-sm">{user.full_name}</p>
                          <span className={`badge ${badge.badge} text-xs`}>{badge.label}</span>
                          {!user.is_active && <span className="badge badge-gray text-xs">Inactivo</span>}
                          {user.role === 'pending' && (
                            <span className="badge bg-amber-400 text-white text-xs animate-pulse-soft">⏳ Aprobación pendiente</span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">{user.email}</p>

                        {/* Metadatos de asignación del usuario (Proyectos, Herramientas, Formularios) */}
                        {user.role !== 'pending' && user.role !== 'admin' && (
                          <div className="flex items-center gap-2.5 text-xs text-text-muted mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-medium">
                              📁 {projsCount} proyecto{projsCount !== 1 ? 's' : ''}
                            </span>
                            {toolsCount > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                  ⏱️ {toolsCount} herramienta{toolsCount !== 1 ? 's' : ''} asignada{toolsCount !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                            {formsCount > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                  📝 {formsCount} formulario{formsCount !== 1 ? 's' : ''} asignado{formsCount !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(user)} className="btn-sm btn-outline text-xs">✏️ Editar</button>
                        <button
                          onClick={() => toggleActive(user)}
                          disabled={updateMutation.isPending}
                          className={`btn-sm text-xs ${user.is_active ? 'btn-ghost text-error' : 'btn-outline'}`}
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-xl animate-slide-up max-h-[92vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-text-primary text-base">Editar Usuario</h3>
                <p className="text-xs text-text-muted">Configura accesos, proyectos, herramientas y formularios de este usuario</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* User info Card */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-border">
                {editingUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingUser.avatar_url} alt={editingUser.full_name} className="w-12 h-12 rounded-full border border-border flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-lg">{editingUser.full_name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-bold text-text-primary text-sm sm:text-base">{editingUser.full_name}</p>
                  <p className="text-xs text-text-muted">{editingUser.email}</p>
                </div>
              </div>

              {/* Access type buttons */}
              <div className="form-group">
                <label className="label font-semibold text-xs text-text-secondary uppercase tracking-wider mb-2 block">
                  Tipo de acceso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'pending', 'division'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setAccessType(t)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        accessType === t
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-border text-text-secondary hover:border-primary/40 bg-white'
                      }`}>
                      {t === 'admin' ? '🔑 Administrador' : t === 'pending' ? '⏳ Pendiente' : '🏢 División'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenido según tipo de acceso */}
              {accessType === 'admin' && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-1">
                  <p className="font-bold">🔑 Acceso Total de Administrador</p>
                  <p>Este usuario cuenta con permisos ilimitados sobre todos los proyectos, herramientas y formularios de la plataforma PROCIMEC.</p>
                </div>
              )}

              {accessType === 'pending' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <p className="font-bold">⏳ Estado Pendiente de Aprobación</p>
                  <p>El usuario no tendrá acceso a ninguna división, herramienta ni formulario hasta que se apruebe su rol.</p>
                </div>
              )}

              {accessType === 'division' && (
                <div className="space-y-4">
                  {/* Selector de Pestañas: División vs Herramientas vs Formularios */}
                  <div className="flex border-b border-border gap-1 bg-gray-50/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSectionTab('division')}
                      className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        sectionTab === 'division'
                          ? 'bg-white text-primary shadow-sm border border-border'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span>🏢 División & Proyectos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectionTab('tools')}
                      className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        sectionTab === 'tools'
                          ? 'bg-white text-primary shadow-sm border border-border'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span>⏱️ Herramientas</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedToolIds.size > 0 ? 'bg-primary-100 text-primary' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {selectedToolIds.size}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectionTab('forms')}
                      className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        sectionTab === 'forms'
                          ? 'bg-white text-primary shadow-sm border border-border'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span>📝 Formularios</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedFormIds.size > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {selectedFormIds.size}
                      </span>
                    </button>
                  </div>

                  {/* PESTAÑA 1: DIVISIÓN, PROYECTOS Y ROL */}
                  {sectionTab === 'division' && (
                    <div className="space-y-3">
                      {!blocksReady && (
                        <div className="text-xs text-text-muted animate-pulse text-center py-4">Cargando asignaciones...</div>
                      )}
                      {blocksReady && editBlocks.map((block, i) => (
                        <DivisionBlockCard
                          key={i}
                          block={block}
                          blockIndex={i}
                          divisions={divisions}
                          roleOptions={roleOptions}
                          allProjects={allProjects}
                          usedDivisionIds={usedDivisionIds}
                          canRemove={editBlocks.length > 1}
                          onDivisionChange={onDivisionChange}
                          onRoleChange={onRoleChange}
                          onToggleProject={onToggleProject}
                          onRemove={removeBlock}
                        />
                      ))}

                      {blocksReady && (
                        <button
                          type="button"
                          onClick={addBlock}
                          disabled={usedDivisionIds.length >= divisions.length}
                          className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-xs text-text-muted hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          + Otra división
                        </button>
                      )}

                      {/* Atajo visual a herramientas y formularios con conteo activo */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">Herramientas y Formularios asignados:</p>
                          <p className="text-slate-600 text-xs mt-0.5">
                            <span className="font-semibold text-primary">{selectedToolIds.size} herramienta(s)</span> y{' '}
                            <span className="font-semibold text-emerald-700">{selectedFormIds.size} formulario(s)</span> habilitados
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSectionTab('tools')}
                          className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-50 rounded-lg border border-primary/30 transition-colors shadow-sm bg-white"
                        >
                          Personalizar →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: HERRAMIENTAS ASIGNADAS */}
                  {sectionTab === 'tools' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                            Herramientas del Usuario
                          </h4>
                          <p className="text-[11px] text-text-muted">
                            Asignadas a {editingUser.full_name} ({selectedToolIds.size}/{allTools.length})
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={handleResetToRoleDefaults}
                            className="text-indigo-600 hover:underline font-semibold"
                            title="Restablecer a las herramientas otorgadas por su rol"
                          >
                            🔄 Según su rol
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedToolIds(new Set(allTools.map(t => t.id)))}
                            className="text-primary hover:underline font-semibold"
                          >
                            Todas
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedToolIds(new Set())}
                            className="text-text-muted hover:text-error hover:underline font-medium"
                          >
                            Ninguna
                          </button>
                        </div>
                      </div>

                      {/* Buscador de herramientas */}
                      <div className="relative">
                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                          type="text"
                          value={toolSearch}
                          onChange={e => setToolSearch(e.target.value)}
                          placeholder="Buscar herramienta por nombre o categoría..."
                          className="input pl-7 py-1.5 text-xs"
                        />
                      </div>

                      {/* Lista de herramientas */}
                      <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border bg-white">
                        {filteredTools.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-text-muted text-center">No se encontraron herramientas</p>
                        ) : (
                          filteredTools.map(tool => {
                            const isChecked = selectedToolIds.has(tool.id);
                            const isGrantedByRole = currentRolePermissions.toolIds.has(tool.id);
                            const catStyle = TOOL_CATEGORY_STYLES[tool.category] ?? {
                              label: tool.category, icon: '⚙️', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700',
                            };

                            return (
                              <label
                                key={tool.id}
                                className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                                  isChecked ? 'bg-primary-50/30' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => onToggleTool(tool.id)}
                                  className="rounded text-primary focus:ring-primary w-4 h-4"
                                />
                                <span className="text-base flex-shrink-0">{catStyle.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-text-primary truncate">{tool.name}</span>
                                    <span className={`px-1.5 py-0.2 rounded border text-[10px] font-medium ${catStyle.bg} ${catStyle.text}`}>
                                      {catStyle.label}
                                    </span>
                                    {isGrantedByRole && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        ✓ En su rol
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 3: FORMULARIOS ASIGNADOS */}
                  {sectionTab === 'forms' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                            Formularios del Usuario
                          </h4>
                          <p className="text-[11px] text-text-muted">
                            Asignados a {editingUser.full_name} ({selectedFormIds.size}/{allForms.length})
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={handleResetToRoleDefaults}
                            className="text-indigo-600 hover:underline font-semibold"
                            title="Restablecer a los formularios otorgados por su rol"
                          >
                            🔄 Según su rol
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFormIds(new Set(allForms.map(f => f.id)))}
                            className="text-primary hover:underline font-semibold"
                          >
                            Todos
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFormIds(new Set())}
                            className="text-text-muted hover:text-error hover:underline font-medium"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>

                      {/* Buscador de formularios */}
                      <div className="relative">
                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                          type="text"
                          value={formSearch}
                          onChange={e => setFormSearch(e.target.value)}
                          placeholder="Buscar formulario..."
                          className="input pl-7 py-1.5 text-xs"
                        />
                      </div>

                      {/* Lista de formularios */}
                      <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border bg-white">
                        {filteredForms.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-text-muted text-center">No se encontraron formularios</p>
                        ) : (
                          filteredForms.map(form => {
                            const isChecked = selectedFormIds.has(form.id);
                            const isGrantedByRole = currentRolePermissions.formIds.has(form.id);

                            return (
                              <label
                                key={form.id}
                                className={`flex items-start gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                                  isChecked ? 'bg-emerald-50/40' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => onToggleForm(form.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-text-primary">{form.name}</p>
                                    {isGrantedByRole && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        ✓ En su rol
                                      </span>
                                    )}
                                  </div>
                                  {form.description && (
                                    <p className="text-[11px] text-text-muted mt-0.5">{form.description}</p>
                                  )}
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                  {form.slug}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {updateMutation.isError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al actualizar usuario'}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-border flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setEditingUser(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary flex-1">
                {updateMutation.isPending
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                  : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
