'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { indexBy } from '@/lib/indexing';

import {
  User,
  RoleOption,
  ProjectOption,
  DivisionOption,
  ToolOption,
  FormOption,
} from '@/components/admin/users/types';
import { UserRow } from '@/components/admin/users/UserRow';
import { UserEditModal } from '@/components/admin/users/UserEditModal';
import { UserDeactivateModal } from '@/components/admin/users/UserDeactivateModal';

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

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  // Estados de modales y acciones
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<User | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Estados de filtrado y búsqueda (Paso 4)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  // Notificación tipo toast corporativo (Paso 5)
  const [toastNotice, setToastNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastNotice({ message, type });
    setTimeout(() => {
      setToastNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAll,
  });

  const users: User[] = useMemo(() => data?.users ?? [], [data?.users]);
  const allProjects: ProjectOption[] = useMemo(() => data?.projects ?? [], [data?.projects]);
  const roleOptions: RoleOption[] = useMemo(() => data?.roles ?? [], [data?.roles]);
  const divisions: DivisionOption[] = useMemo(() => data?.divisions ?? [], [data?.divisions]);
  const allTools: ToolOption[] = useMemo(() => data?.tools ?? [], [data?.tools]);
  const allForms: FormOption[] = useMemo(() => data?.forms ?? [], [data?.forms]);

  const rolesById = useMemo(() => indexBy(roleOptions, (r) => r.id), [roleOptions]);

  const projectsByDivisionId = useMemo(() => {
    const map = new Map<string, ProjectOption[]>();
    for (let i = 0; i < allProjects.length; i++) {
      const p = allProjects[i];
      const pDivs = p.divisions;
      if (pDivs && pDivs.length > 0) {
        for (let j = 0; j < pDivs.length; j++) {
          const divId = pDivs[j].id;
          const list = map.get(divId);
          if (list) {
            list.push(p);
          } else {
            map.set(divId, [p]);
          }
        }
      }
    }
    return map;
  }, [allProjects]);

  const rolesByDivisionId = useMemo(() => {
    const map = new Map<string, RoleOption[]>();
    for (let i = 0; i < roleOptions.length; i++) {
      const r = roleOptions[i];
      if (r.division_id) {
        const list = map.get(r.division_id);
        if (list) list.push(r);
        else map.set(r.division_id, [r]);
      }
    }
    return map;
  }, [roleOptions]);

  const globalRoles = useMemo(() => roleOptions.filter((r) => !r.division_id), [roleOptions]);

  // Mutación de actualización de usuario
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      role?: string;
      role_id?: string | null;
      is_active?: boolean;
      project_ids?: string[];
      division_roles?: { division_id: string; role_id: string | null }[];
      tool_ids?: string[];
      form_ids?: string[];
      full_name?: string;
      nick_name?: string | null;
      email?: string;
      phone?: string | null;
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
        showToast(resData.warning, 'warning');
      } else {
        showToast('Usuario actualizado con éxito', 'success');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar';
      showToast(msg, 'error');
    },
  });

  const toggleActive = (user: User) => {
    updateMutation.mutate({ id: user.id, is_active: !user.is_active });
  };

  // Contadores
  const pendingCount = useMemo(() => users.filter((u) => u.role === 'pending').length, [users]);
  const activeCount = useMemo(() => users.filter((u) => u.is_active && u.role !== 'pending').length, [users]);
  const inactiveCount = useMemo(() => users.filter((u) => !u.is_active).length, [users]);

  // Filtrado reactivo de usuarios
  const filteredUsers = useMemo(() => {
    let list = [...users];

    // Filtro por Estado
    if (statusFilter === 'pending') {
      list = list.filter((u) => u.role === 'pending');
    } else if (statusFilter === 'active') {
      list = list.filter((u) => u.is_active && u.role !== 'pending');
    } else if (statusFilter === 'inactive') {
      list = list.filter((u) => !u.is_active);
    }

    // Filtro por División
    if (divisionFilter !== 'all') {
      list = list.filter((u) => {
        const inUdr = (u.user_division_roles ?? []).some((udr) => udr.division_id === divisionFilter);
        const inDirect = (u as { division_id?: string }).division_id === divisionFilter;
        return inUdr || inDirect;
      });
    }

    // Filtro por Búsqueda (Nombre, Apodo, Correo, Teléfono)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          (u.nick_name && u.nick_name.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q))
      );
    }

    // Ordenamiento canónico: Pendientes primero, luego activos
    return list.sort((a, b) => {
      if (a.role === 'pending' && b.role !== 'pending') return -1;
      if (a.role !== 'pending' && b.role === 'pending') return 1;
      return 0;
    });
  }, [users, statusFilter, divisionFilter, searchTerm]);

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico según AGENTS.md */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto space-y-2">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Gestión de Usuarios
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Administración centralizada de colaboradores, roles por división y permisos de acceso.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-8 pb-20 w-full flex-1 space-y-4">
        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-3.5 sm:p-4 bg-white border border-border shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Buscador reactivo */}
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, correo, apodo o teléfono..."
                className="input pl-9 pr-8 py-2 text-xs sm:text-sm w-full bg-slate-50 focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selector de División */}
            {divisions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Building2 className="w-4 h-4 text-text-muted hidden sm:block" strokeWidth={1.75} />
                <select
                  value={divisionFilter}
                  onChange={(e) => setDivisionFilter(e.target.value)}
                  className="select text-xs py-2 bg-slate-50 focus:bg-white"
                >
                  <option value="all">Todas las divisiones</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Píldoras de Filtro por Estado */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                  statusFilter === 'all'
                    ? 'bg-primary-900 text-white shadow-sm'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200/70'
                }`}
              >
                Todos <span className="opacity-75 font-mono ml-1">({users.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-[0.98] ${
                  statusFilter === 'pending'
                    ? 'bg-accent text-primary-950 font-bold shadow-sm'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200/70'
                }`}
              >
                <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                Pendientes
                {pendingCount > 0 && (
                  <span className="bg-amber-400 text-primary-950 px-1.5 py-0.2 rounded-full text-[11px] font-bold font-mono">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                  statusFilter === 'active'
                    ? 'bg-primary-900 text-white shadow-sm'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200/70'
                }`}
              >
                Activos <span className="opacity-75 font-mono ml-1">({activeCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                  statusFilter === 'inactive'
                    ? 'bg-primary-900 text-white shadow-sm'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200/70'
                }`}
              >
                Inactivos <span className="opacity-75 font-mono ml-1">({inactiveCount})</span>
              </button>
            </div>

            {/* Contador de resultados */}
            <span className="text-xs text-text-muted font-mono">
              Mostrando {filteredUsers.length} de {users.length}
            </span>
          </div>
        </div>

        {/* Tabla / Listado de Usuarios */}
        <div className="card overflow-visible bg-white border border-border shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted space-y-2">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Cargando colaboradores...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-text-muted space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-primary">No se encontraron usuarios</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                No hay ningún colaborador que coincida con los criterios de búsqueda o filtros seleccionados.
              </p>
              {(searchTerm || statusFilter !== 'all' || divisionFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setDivisionFilter('all');
                  }}
                  className="btn-sm btn-outline text-xs px-3 py-1.5 inline-flex items-center gap-1.5 mt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  roleOptions={roleOptions}
                  rolesById={rolesById}
                  isMenuOpen={openMenuId === user.id}
                  onToggleMenu={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                  onCloseMenu={() => setOpenMenuId(null)}
                  onEdit={() => setEditingUser(user)}
                  onToggleActive={() => toggleActive(user)}
                  onConfirmDeactivate={() => setConfirmDeactivateUser(user)}
                  isActionPending={updateMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edición Desacoplado */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          allProjects={allProjects}
          roleOptions={roleOptions}
          divisions={divisions}
          allTools={allTools}
          allForms={allForms}
          rolesById={rolesById}
          projectsByDivisionId={projectsByDivisionId}
          rolesByDivisionId={rolesByDivisionId}
          globalRoles={globalRoles}
          isPending={updateMutation.isPending}
          onClose={() => setEditingUser(null)}
          onSave={(payload) => updateMutation.mutate(payload)}
          mutationError={
            updateMutation.isError
              ? updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Error al actualizar usuario'
              : null
          }
        />
      )}

      {/* Modal de Desactivación Desacoplado */}
      {confirmDeactivateUser && (
        <UserDeactivateModal
          user={confirmDeactivateUser}
          isPending={updateMutation.isPending}
          onClose={() => setConfirmDeactivateUser(null)}
          onConfirm={() => {
            toggleActive(confirmDeactivateUser);
            setConfirmDeactivateUser(null);
          }}
        />
      )}

      {/* Toast Notificación Corporativa */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border bg-primary-950 text-white border-primary-800">
          {toastNotice.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" strokeWidth={2} />
          )}
          {toastNotice.type === 'warning' && (
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" strokeWidth={2} />
          )}
          {toastNotice.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={2} />
          )}
          <span className="text-xs font-medium text-white/95 max-w-sm">{toastNotice.message}</span>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-white/60 hover:text-white ml-2 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
