'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface DivisionOption { id: string; name: string }
interface RoleOption { id: string; name: string; division_id: string | null; divisions?: { name: string } | null }
interface ProjectOption { id: string; code?: string; cost_center?: string; name: string; is_active?: boolean; divisions?: { id: string }[] }

interface UserDivisionRole { division_id: string; role_id: string | null }
interface User {
  id: string; email: string; full_name: string; avatar_url?: string;
  role: 'admin' | 'operator' | 'pending' | 'dibujo';
  role_id: string | null;
  roles: { id: string; name: string } | null;
  is_active: boolean; created_at: string;
  user_projects?: { project_id: string }[];
  user_division_roles?: UserDivisionRole[];
}

interface DivisionBlock { divisionId: string; roleId: string; projectIds: Set<string> }

async function fetchAll() {
  const [usersRes, projectsRes, rolesRes, divisionsRes] = await Promise.all([
    fetch('/api/admin/users'),
    fetch('/api/admin/projects'),
    fetch('/api/admin/roles'),
    fetch('/api/admin/divisions'),
  ]);
  return {
    users: (await usersRes.json()).data ?? [],
    projects: (await projectsRes.json()).data ?? [],
    roles: (await rolesRes.json()).data ?? [],
    divisions: (await divisionsRes.json()).data ?? [],
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

  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchAll });

  const users: User[] = data?.users ?? [];
  const allProjects: ProjectOption[] = data?.projects ?? [];
  const roleOptions: RoleOption[] = data?.roles ?? [];
  const divisions: DivisionOption[] = data?.divisions ?? [];

  const projectsForDiv = (divId: string) =>
    allProjects.filter(p => (p.divisions ?? []).some(d => d.id === divId));

  // Initialize blocks when data and user are ready
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

    setBlocksReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingUser, accessType, blocksReady, roleOptions.length, allProjects.length]);

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string; role?: string; role_id?: string | null;
      is_active?: boolean; project_ids?: string[];
      division_roles?: { division_id: string; role_id: string | null }[];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
    },
  });

  const openEdit = (user: User) => {
    setEditingUser(user);
    setAccessType(user.role === 'admin' ? 'admin' : user.role === 'pending' ? 'pending' : 'division');
    setEditBlocks([]);
    setBlocksReady(false);
  };

  const handleSave = () => {
    if (!editingUser) return;
    if (accessType === 'admin') {
      updateMutation.mutate({ id: editingUser.id, role: 'admin', role_id: null, division_roles: [], project_ids: [] });
    } else if (accessType === 'pending') {
      updateMutation.mutate({ id: editingUser.id, role: 'pending', role_id: null, division_roles: [], project_ids: [] });
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
  const onRoleChange = (i: number, roleId: string) =>
    setEditBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, roleId } : b));

  const onToggleProject = (blockIndex: number, projId: string) =>
    setEditBlocks(prev => prev.map((b, idx) => {
      if (idx !== blockIndex) return b;
      const next = new Set(b.projectIds);
      if (next.has(projId)) next.delete(projId); else next.add(projId);
      return { ...b, projectIds: next };
    }));

  const usedDivisionIds = editBlocks.map(b => b.divisionId).filter(Boolean);
  const pendingCount = users.filter(u => u.role === 'pending').length;

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
                        {user.role !== 'pending' && user.role !== 'admin' && (
                          <p className="text-xs text-text-muted mt-1">
                            {user.user_projects?.length ?? 0} proyecto{user.user_projects?.length !== 1 ? 's' : ''} asignado{user.user_projects?.length !== 1 ? 's' : ''}
                          </p>
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
          <div className="card w-full max-w-lg animate-slide-up max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-text-primary">Editar Usuario</h3>
              <button onClick={() => setEditingUser(null)} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* User info */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                {editingUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingUser.avatar_url} alt={editingUser.full_name} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary font-bold">{editingUser.full_name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-text-primary">{editingUser.full_name}</p>
                  <p className="text-xs text-text-muted">{editingUser.email}</p>
                </div>
              </div>

              {/* Access type */}
              <div className="form-group">
                <label className="label font-semibold text-sm mb-2 block">Tipo de acceso</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'pending', 'division'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setAccessType(t)}
                      className={`py-2 px-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        accessType === t
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-text-secondary hover:border-primary/40'
                      }`}>
                      {t === 'admin' ? '🔑 Administrador' : t === 'pending' ? '⏳ Pendiente' : '🏢 División'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Division blocks */}
              {accessType === 'division' && (
                <div className="space-y-3">
                  {!blocksReady && (
                    <div className="text-xs text-text-muted animate-pulse text-center py-2">Cargando asignaciones...</div>
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
                </div>
              )}

              {updateMutation.isError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al actualizar usuario'}
                </p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
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
