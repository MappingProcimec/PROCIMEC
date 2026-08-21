'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'operator' | 'pending' | 'dibujo';
  is_active: boolean;
  created_at: string;
  user_projects?: { project_id: string }[];
}

interface Project {
  id: string;
  code: string;
  name: string;
}

async function fetchUsersAndProjects() {
  const [usersRes, projectsRes] = await Promise.all([
    fetch('/api/admin/users'),
    fetch('/api/admin/projects'),
  ]);
  const users = (await usersRes.json()).data || [];
  const projects = (await projectsRes.json()).data || [];
  return { users, projects };
}

const ROLE_LABELS: Record<string, { label: string; badge: string }> = {
  admin: { label: 'Administrador', badge: 'badge-primary' },
  operator: { label: 'Operador', badge: 'badge-accent' },
  pending: { label: 'Pendiente', badge: 'badge-warning' },
  dibujo: { label: 'Dibujo', badge: 'badge-success' },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editProjects, setEditProjects] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsersAndProjects,
  });

  const users: User[] = data?.users || [];
  const projects: Project[] = data?.projects || [];

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; role?: string; is_active?: boolean; project_ids?: string[] }) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
    },
  });

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditProjects(user.user_projects?.map(up => up.project_id) || []);
  };

  const handleSave = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      role: editRole,
      project_ids: editProjects,
    });
  };

  const toggleActive = (user: User) => {
    updateMutation.mutate({ id: user.id, is_active: !user.is_active });
  };

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
              {/* Pending users first */}
              {users
                .sort((a, b) => {
                  if (a.role === 'pending' && b.role !== 'pending') return -1;
                  if (a.role !== 'pending' && b.role === 'pending') return 1;
                  return 0;
                })
                .map(user => {
                  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.pending;
                  return (
                    <div key={user.id} className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                      user.role === 'pending' ? 'bg-amber-50' : !user.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                    }`}>
                      {/* Avatar */}
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt={user.full_name} className="w-11 h-11 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold">{user.full_name.charAt(0)}</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-text-primary text-sm">{user.full_name}</p>
                          <span className={`badge ${roleInfo.badge} text-xs`}>{roleInfo.label}</span>
                          {!user.is_active && <span className="badge badge-gray text-xs">Inactivo</span>}
                          {user.role === 'pending' && (
                            <span className="badge bg-amber-400 text-white text-xs animate-pulse-soft">⏳ Aprobación pendiente</span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">{user.email}</p>
                        {user.role === 'operator' && (
                          <p className="text-xs text-text-muted mt-1">
                            {user.user_projects?.length || 0} proyecto{user.user_projects?.length !== 1 ? 's' : ''} asignado{user.user_projects?.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(user)} className="btn-sm btn-outline text-xs">
                          ✏️ Editar
                        </button>
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

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md animate-slide-up">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-text-primary">Editar Usuario</h3>
              <button onClick={() => setEditingUser(null)} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
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

              {/* Role */}
              <div className="form-group">
                <label className="label">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['admin', 'operator', 'pending', 'dibujo'] as const).map(role => (
                    <button key={role} type="button"
                      onClick={() => setEditRole(role)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        editRole === role
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-text-secondary hover:border-primary-200'
                      }`}>
                      {ROLE_LABELS[role].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Projects (only for operator) */}
              {editRole === 'operator' && (
                <div className="form-group">
                  <label className="label">Proyectos asignados</label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2">
                    {projects.filter((p: Project) => (p as Project & { is_active: boolean }).is_active !== false).map((p: Project) => (
                      <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox"
                          className="w-4 h-4 accent-primary"
                          checked={editProjects.includes(p.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditProjects([...editProjects, p.id]);
                            } else {
                              setEditProjects(editProjects.filter(id => id !== p.id));
                            }
                          }} />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{p.name}</p>
                          <p className="text-xs text-text-muted">{p.code}</p>
                        </div>
                      </label>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-sm text-text-muted text-center py-3">Sin proyectos creados</p>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {editProjects.length} proyecto{editProjects.length !== 1 ? 's' : ''} seleccionado{editProjects.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {updateMutation.isError && (
                <p className="error-msg">⚠ Error al actualizar usuario</p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary flex-1">
                  {updateMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                  ) : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
