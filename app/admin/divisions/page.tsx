'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  Search,
  CheckSquare,
  Square,
  Pencil,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Division {
  id: string;
  name: string;
  description?: string;
  role_count: number;
  project_total: number;
  project_active: number;
  created_at: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface RoleOption {
  id: string;
  name: string;
  divisions?: { name: string } | null;
}

interface DivisionDetail {
  id: string;
  name: string;
  description?: string;
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
    id: p.id,
    code: p.code,
    name: p.name,
    is_active: p.is_active,
  }));
}

async function fetchRoleOptions(): Promise<RoleOption[]> {
  const res = await fetch('/api/admin/roles');
  return ((await res.json()).data ?? []).map((r: RoleOption) => ({
    id: r.id,
    name: r.name,
    divisions: r.divisions,
  }));
}

async function fetchDivisionDetail(id: string): Promise<DivisionDetail> {
  const res = await fetch(`/api/admin/divisions/${id}`);
  return (await res.json()).data;
}

// ── Role Rows Selector ────────────────────────────────────────────────────────
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
        <label className="label mb-0">Roles de la División</label>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-primary font-medium hover:text-accent flex items-center gap-1 transition-colors active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Nuevo rol
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
                className="p-2 text-text-muted hover:text-error transition-colors flex-shrink-0 active:scale-[0.98]"
                aria-label="Eliminar rol"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Project Checklist with Search & Bulk Select / Deselect ────────────────────
function ProjectChecklist({
  projectOptions,
  selected,
  onChange,
}: {
  projectOptions: ProjectOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [search, setSearch] = useState('');
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return projectOptions;
    const term = search.toLowerCase().trim();
    return projectOptions.filter(
      p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
    );
  }, [projectOptions, search]);

  const visibleIds = useMemo(() => filtered.map(p => p.id), [filtered]);
  const visibleSelectedCount = useMemo(
    () => visibleIds.filter(id => selected.has(id)).length,
    [visibleIds, selected]
  );

  const isAllVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const isSomeVisibleSelected = visibleSelectedCount > 0 && !isAllVisibleSelected;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  const handleToggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const handleSelectAll = () => {
    onChange(new Set(projectOptions.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    onChange(new Set());
  };

  const handleMasterToggle = () => {
    const next = new Set(selected);
    if (isAllVisibleSelected) {
      // Deseleccionar los visibles actuales
      visibleIds.forEach(id => next.delete(id));
    } else {
      // Seleccionar todos los visibles actuales
      visibleIds.forEach(id => next.add(id));
    }
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Proyectos vinculados</label>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">
            {selected.size} / {projectOptions.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-primary hover:text-accent font-medium transition-colors flex items-center gap-1 active:scale-[0.98]"
          >
            <CheckSquare className="w-3.5 h-3.5" strokeWidth={1.75} /> Seleccionar todos
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={selected.size === 0}
            className="text-text-muted hover:text-error disabled:opacity-40 disabled:hover:text-text-muted transition-colors flex items-center gap-1 active:scale-[0.98]"
          >
            <Square className="w-3.5 h-3.5" strokeWidth={1.75} /> Ninguno
          </button>
        </div>
      </div>

      <div className="relative mb-2">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proyecto por nombre o código..."
          className="input pl-9 pr-8 text-sm py-1.5"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-text-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {projectOptions.length === 0 ? (
        <p className="text-xs text-text-muted py-2">No hay proyectos disponibles.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-white shadow-2xs">
          {/* Barra de control rápido de selección */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-border text-xs text-text-secondary select-none">
            <label className="flex items-center gap-2.5 cursor-pointer font-medium">
              <input
                ref={masterCheckboxRef}
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={handleMasterToggle}
                className="w-4 h-4 rounded text-primary focus:ring-accent/30 cursor-pointer accent-[#1E2229]"
              />
              <span>
                {search
                  ? `Seleccionar visibles (${visibleSelectedCount}/${visibleIds.length})`
                  : `Seleccionar todos (${selected.size}/${projectOptions.length})`}
              </span>
            </label>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-text-muted hover:text-error transition-colors font-medium active:scale-[0.98]"
              >
                Deseleccionar todos ({selected.size})
              </button>
            )}
          </div>

          {/* Lista scrolleable de proyectos */}
          <div className="max-h-52 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-xs text-text-muted text-center">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map(p => {
                const isChecked = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      isChecked ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleOne(p.id)}
                      className="w-4 h-4 rounded text-primary focus:ring-accent/30 cursor-pointer accent-[#1E2229]"
                    />
                    <span className="text-xs font-mono font-bold text-text-muted w-24 flex-shrink-0 truncate">
                      {p.code}
                    </span>
                    <span className="text-sm text-text-primary flex-1 truncate font-medium">
                      {p.name}
                    </span>
                    {p.is_active ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded flex-shrink-0">
                        Activo
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        Inactivo
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {projectOptions.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-muted mt-1.5 px-0.5">
          <span>
            {selected.size === 0 ? (
              <span className="text-amber-700 font-medium">Ningún proyecto seleccionado</span>
            ) : (
              <span>
                <strong className="text-text-primary font-mono">{selected.size}</strong> proyecto
                {selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
            )}
          </span>
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-text-muted hover:text-error hover:underline transition-colors"
            >
              Deseleccionar todos
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-primary hover:text-accent hover:underline transition-colors"
            >
              Seleccionar todos ({projectOptions.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal Crear División ──────────────────────────────────────────────────────
function CreateDivisionModal({
  projectOptions,
  roleOptions,
  onClose,
  onSuccess,
}: {
  projectOptions: ProjectOption[];
  roleOptions: RoleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [roleIds, setRoleIds] = useState<string[]>(['']);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          role_ids: roleIds.filter(Boolean),
          project_ids: Array.from(selectedProjects),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear división');
      return json.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError('');
    createMutation.mutate();
  };

  const addRole = () => setRoleIds(prev => [...prev, '']);
  const removeRole = (i: number) => setRoleIds(prev => prev.filter((_, idx) => idx !== i));
  const updateRole = (i: number, v: string) => setRoleIds(prev => prev.map((r, idx) => (idx === i ? v : r)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Nueva División</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted transition-colors active:scale-[0.98]"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
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
            rows={roleIds}
            roleOptions={roleOptions}
            onAdd={addRole}
            onRemove={removeRole}
            onChange={updateRole}
          />

          <ProjectChecklist
            projectOptions={projectOptions}
            selected={selectedProjects}
            onChange={setSelectedProjects}
          />

          {error && (
            <p className="error-msg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              <span>{error}</span>
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1 py-2 text-sm rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold"
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear División'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Editar División ────────────────────────────────────────────────────
function EditDivisionModal({
  division,
  projectOptions,
  roleOptions,
  onClose,
  onSuccess,
}: {
  division: Division;
  projectOptions: ProjectOption[];
  roleOptions: RoleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: division.name,
    description: division.description ?? '',
  });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin-division', division.id],
    queryFn: () => fetchDivisionDetail(division.id),
    staleTime: 0,
  });

  useEffect(() => {
    if (detail && !isInitialized) {
      setForm({
        name: detail.name || division.name,
        description: detail.description ?? division.description ?? '',
      });
      setSelectedProjects(new Set(detail.projects?.map((p: { id: string }) => p.id) ?? []));
      setRoleIds(
        detail.roles && detail.roles.length > 0
          ? detail.roles.map((r: { id: string }) => r.id)
          : ['']
      );
      setIsInitialized(true);
    }
  }, [detail, isInitialized, division]);

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/divisions/${division.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          role_ids: roleIds.filter(Boolean),
          project_ids: Array.from(selectedProjects),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      return json.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError('');
    editMutation.mutate();
  };

  const addRole = () => setRoleIds(prev => [...prev, '']);
  const removeRole = (i: number) => setRoleIds(prev => prev.filter((_, idx) => idx !== i));
  const updateRole = (i: number, v: string) => setRoleIds(prev => prev.map((r, idx) => (idx === i ? v : r)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Editar División</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted transition-colors active:scale-[0.98]"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {loadingDetail || !isInitialized ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
            <span className="text-xs">Cargando datos de la división...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="form-group">
                <label className="label label-required">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="label">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="textarea"
                />
              </div>
            </div>

            <RoleRows
              rows={roleIds}
              roleOptions={roleOptions}
              onAdd={addRole}
              onRemove={removeRole}
              onChange={updateRole}
            />

            <ProjectChecklist
              projectOptions={projectOptions}
              selected={selectedProjects}
              onChange={setSelectedProjects}
            />

            {error && (
              <p className="error-msg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1 py-2 text-sm rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold"
              >
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function AdminDivisionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['admin-divisions'],
    queryFn: fetchDivisions,
  });

  const modalOpen = showCreateModal || !!editingDivision;

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

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
    queryClient.invalidateQueries({ queryKey: ['role-options'] });
    setShowCreateModal(false);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
    if (editingDivision) {
      queryClient.invalidateQueries({ queryKey: ['admin-division', editingDivision.id] });
    }
    queryClient.invalidateQueries({ queryKey: ['role-options'] });
    setEditingDivision(null);
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
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" strokeWidth={2} /> Nueva División
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-primary text-sm font-medium hover:underline active:scale-[0.98]"
              >
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
                    <tr
                      key={d.id}
                      onClick={() => router.push(`/admin/divisions/${d.id}`)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-4 font-semibold text-text-primary group-hover:text-primary transition-colors">
                        {d.name}
                      </td>
                      <td className="px-5 py-4 text-text-muted hidden sm:table-cell">
                        {d.description || <span className="italic text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary font-mono">
                          <span className="text-success font-bold">{d.project_active}</span>
                          <span className="text-text-muted">/ {d.project_total}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="badge badge-primary text-xs">{d.role_count}</span>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setEditingDivision(d)}
                            className="btn-sm btn-outline text-xs px-2.5 py-1 flex items-center gap-1.5 hover:bg-gray-100 rounded-lg shadow-2xs font-medium text-text-primary transition-colors active:scale-[0.98]"
                          >
                            <Pencil className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />
                            <span>Editar</span>
                          </button>
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
      {showCreateModal && (
        <CreateDivisionModal
          projectOptions={projectOptions}
          roleOptions={roleOptions}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* ── Modal Editar División ──────────────────────────────────────────── */}
      {editingDivision && (
        <EditDivisionModal
          division={editingDivision}
          projectOptions={projectOptions}
          roleOptions={roleOptions}
          onClose={() => setEditingDivision(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
