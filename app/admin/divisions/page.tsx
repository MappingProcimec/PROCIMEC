'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Division {
  id: string; name: string; description?: string;
  role_count: number; project_total: number; project_active: number; created_at: string;
}
interface ProjectOption { id: string; code: string; name: string; is_active: boolean }
interface RoleOption { id: string; name: string; divisions?: { name: string } | null }
interface DivisionDetail {
  id: string; name: string; description?: string;
  projects?: { id: string }[];
  roles?: { id: string; name: string; is_system_role: boolean; user_count: number }[];
}

async function fetchDivisions(): Promise<Division[]> {
  const res = await fetch('/api/admin/divisions');
  return (await res.json()).data ?? [];
}
async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const res = await fetch('/api/admin/projects');
  return ((await res.json()).data ?? []).map((p: ProjectOption) => ({
    id: p.id, code: p.code, name: p.name, is_active: p.is_active,
  }));
}
async function fetchRoleOptions(): Promise<RoleOption[]> {
  const res = await fetch('/api/admin/roles');
  return ((await res.json()).data ?? []).map((r: RoleOption) => ({
    id: r.id, name: r.name, divisions: r.divisions,
  }));
}
async function fetchDivisionDetail(id: string): Promise<DivisionDetail> {
  const res = await fetch(`/api/admin/divisions/${id}`);
  return (await res.json()).data;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function PlusIcon({ sm }: { sm?: boolean }) {
  return (
    <svg className={sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

// Role row selector shared between create and edit
function RoleRows({
  rows,
  roleOptions,
  onAdd,
  onRemove,
  onChange,
}: {
  rows: string[];
  roleOptions: RoleOption[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, val: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label">Roles de la División</label>
        <button type="button" onClick={onAdd} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
          <PlusIcon sm /> Nuevo rol
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((rid, i) => (
          <div key={i} className="flex gap-2">
            <select
              value={rid}
              onChange={e => onChange(i, e.target.value)}
              className="select flex-1 text-sm"
            >
              <option value="">— Seleccionar rol —</option>
              {roleOptions
                .filter(r => r.id === rid || !rows.some((s, si) => si !== i && s === r.id))
                .map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.divisions?.name ? ` (${r.divisions.name})` : ''}
                  </option>
                ))}
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="p-2 text-text-muted hover:text-error transition-colors flex-shrink-0"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Project list with search
function ProjectChecklist({
  projectOptions,
  selected,
  onToggle,
}: {
  projectOptions: ProjectOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? projectOptions.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
      )
    : projectOptions;

  return (
    <div>
      <label className="label mb-2 block">Proyectos vinculados</label>
      <div className="relative mb-2">
        <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proyecto..."
          className="input pl-8 text-sm py-1.5"
        />
      </div>
      {projectOptions.length === 0 ? (
        <p className="text-xs text-text-muted">No hay proyectos disponibles.</p>
      ) : (
        <>
          <div className="border border-border rounded-xl max-h-48 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-text-muted text-center">Sin resultados</p>
            ) : filtered.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => onToggle(p.id)}
                  className="rounded text-primary"
                />
                <span className="text-xs font-bold text-text-muted w-14 flex-shrink-0">{p.code}</span>
                <span className="text-sm text-text-primary flex-1 truncate">{p.name}</span>
                {p.is_active && <span className="text-xs text-success font-medium flex-shrink-0">Activo</span>}
              </label>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">
            {selected.size} proyecto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function AdminDivisionsPage() {
  const queryClient = useQueryClient();

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [createRoleIds, setCreateRoleIds] = useState<string[]>(['']);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  // Edit modal
  const [editDivision, setEditDivision] = useState<Division | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editProjects, setEditProjects] = useState<Set<string>>(new Set());
  const [editError, setEditError] = useState('');

  // ── queries ──
  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['admin-divisions'],
    queryFn: fetchDivisions,
  });
  const modalOpen = showModal || !!editDivision;
  const { data: projectOptions = [] } = useQuery({
    queryKey: ['project-options'],
    queryFn: fetchProjectOptions,
    enabled: modalOpen,
  });
  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options'],
    queryFn: fetchRoleOptions,
    enabled: modalOpen,
  });
  const { data: editDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin-division', editDivision?.id],
    queryFn: () => fetchDivisionDetail(editDivision!.id),
    enabled: !!editDivision,
    staleTime: 0,
  });

  // Effective edit state (lazy-init from detail)
  const detailProjectIds = editDetail?.projects?.map(p => p.id) ?? [];
  const detailRoleIds    = editDetail?.roles?.map(r => r.id) ?? [];
  const effectiveEditProjects = editProjects.size === 0 && detailProjectIds.length > 0
    ? new Set(detailProjectIds) : editProjects;
  const effectiveEditRoleIds = editRoleIds.length === 0 && detailRoleIds.length > 0
    ? detailRoleIds : editRoleIds.length === 0 ? [''] : editRoleIds;

  // ── mutations ──
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          role_ids: createRoleIds.filter(Boolean),
          project_ids: Array.from(selectedProjects),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear división');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      queryClient.invalidateQueries({ queryKey: ['role-options'] });
      closeModal();
    },
    onError: (e: Error) => setError(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/divisions/${editDivision!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          role_ids: effectiveEditRoleIds.filter(Boolean),
          project_ids: Array.from(effectiveEditProjects),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-division', editDivision?.id] });
      queryClient.invalidateQueries({ queryKey: ['role-options'] });
      closeEdit();
    },
    onError: (e: Error) => setEditError(e.message),
  });

  // ── handlers ──
  const closeModal = () => {
    setShowModal(false);
    setForm({ name: '', description: '' });
    setCreateRoleIds(['']);
    setSelectedProjects(new Set());
    setError('');
  };

  const openEdit = (d: Division) => {
    setEditDivision(d);
    setEditForm({ name: d.name, description: d.description ?? '' });
    setEditRoleIds([]);
    setEditProjects(new Set());
    setEditError('');
  };

  const closeEdit = () => {
    setEditDivision(null);
    setEditRoleIds([]);
    setEditProjects(new Set());
    setEditError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    createMutation.mutate();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError('El nombre es obligatorio'); return; }
    setEditError('');
    editMutation.mutate();
  };

  // create role rows
  const addCreateRole    = () => setCreateRoleIds(p => [...p, '']);
  const removeCreateRole = (i: number) => setCreateRoleIds(p => p.filter((_, idx) => idx !== i));
  const updateCreateRole = (i: number, v: string) => setCreateRoleIds(p => p.map((r, idx) => idx === i ? v : r));

  // edit role rows (always start from effectiveEditRoleIds)
  const addEditRole    = () => setEditRoleIds([...effectiveEditRoleIds, '']);
  const removeEditRole = (i: number) => setEditRoleIds(effectiveEditRoleIds.filter((_, idx) => idx !== i));
  const updateEditRole = (i: number, v: string) => setEditRoleIds(effectiveEditRoleIds.map((r, idx) => idx === i ? v : r));

  // project toggles
  const toggleProject = (id: string) =>
    setSelectedProjects(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const toggleEditProject = (id: string) => {
    const base = editProjects.size === 0 && detailProjectIds.length > 0 ? new Set(detailProjectIds) : new Set(editProjects);
    if (base.has(id)) base.delete(id); else base.add(id);
    setEditProjects(base);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Divisiones</h1>
              <p className="text-white/70 text-sm mt-1">Unidades organizativas de la empresa</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              <PlusIcon /> Nueva División
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20">
        <div className="card shadow-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-text-muted animate-pulse">Cargando divisiones...</div>
          ) : divisions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-text-muted text-sm">No hay divisiones creadas.</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-primary text-sm font-medium hover:underline">
                Crear la primera división
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-text-secondary">División</th>
                    <th className="text-left px-5 py-3 font-semibold text-text-secondary hidden sm:table-cell">Descripción</th>
                    <th className="text-center px-5 py-3 font-semibold text-text-secondary">Proyectos</th>
                    <th className="text-center px-5 py-3 font-semibold text-text-secondary">Roles</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {divisions.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-text-primary">{d.name}</td>
                      <td className="px-5 py-4 text-text-muted hidden sm:table-cell">
                        {d.description || <span className="italic text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary">
                          <span className="text-success font-bold">{d.project_active}</span>
                          <span className="text-text-muted">/ {d.project_total}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="badge badge-primary text-xs">{d.role_count}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEdit(d)}
                            className="text-text-muted text-xs font-semibold hover:text-primary transition-colors"
                          >
                            ✏️ Editar
                          </button>
                          <Link href={`/admin/divisions/${d.id}`} className="text-primary text-xs font-semibold hover:underline">
                            Gestionar →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Nueva División ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">Nueva División</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="form-group">
                  <label className="label label-required">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Área GPR"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="label">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripción opcional..."
                    rows={2}
                    className="textarea"
                  />
                </div>
              </div>

              <RoleRows
                rows={createRoleIds}
                roleOptions={roleOptions}
                onAdd={addCreateRole}
                onRemove={removeCreateRole}
                onChange={updateCreateRole}
              />

              <ProjectChecklist
                projectOptions={projectOptions}
                selected={selectedProjects}
                onToggle={toggleProject}
              />

              {error && <p className="error-msg">⚠️ {error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost flex-1 py-2 text-sm rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold">
                  {createMutation.isPending ? 'Guardando...' : 'Crear División'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Editar División ──────────────────────────────────────────── */}
      {editDivision && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">Editar División</h2>
              <button onClick={closeEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                <CloseIcon />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-10 text-center text-text-muted animate-pulse">Cargando...</div>
            ) : (
              <form onSubmit={handleEditSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label label-required">Nombre</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="input"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Descripción</label>
                    <textarea
                      value={editForm.description}
                      onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="textarea"
                    />
                  </div>
                </div>

                <RoleRows
                  rows={effectiveEditRoleIds}
                  roleOptions={roleOptions}
                  onAdd={addEditRole}
                  onRemove={removeEditRole}
                  onChange={updateEditRole}
                />

                <ProjectChecklist
                  projectOptions={projectOptions}
                  selected={effectiveEditProjects}
                  onToggle={toggleEditProject}
                />

                {editError && <p className="error-msg">⚠️ {editError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeEdit} className="btn-ghost flex-1 py-2 text-sm rounded-xl">
                    Cancelar
                  </button>
                  <button type="submit" disabled={editMutation.isPending} className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold">
                    {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
