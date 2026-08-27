'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Division {
  id: string;
  name: string;
  description?: string;
  role_count: number;
  project_total: number;
  project_active: number;
  created_at: string;
}

interface ProjectOption { id: string; code: string; name: string; is_active: boolean }

async function fetchDivisions(): Promise<Division[]> {
  const res = await fetch('/api/admin/divisions');
  const json = await res.json();
  return json.data ?? [];
}

async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const res = await fetch('/api/admin/projects');
  const json = await res.json();
  return (json.data ?? []).map((p: ProjectOption) => ({
    id: p.id, code: p.code, name: p.name, is_active: p.is_active,
  }));
}

export default function AdminDivisionsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [roleNames, setRoleNames] = useState<string[]>(['']);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['admin-divisions'],
    queryFn: fetchDivisions,
  });

  const { data: projectOptions = [] } = useQuery({
    queryKey: ['project-options'],
    queryFn: fetchProjectOptions,
    enabled: showModal,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          role_names: roleNames.filter(Boolean),
          project_ids: Array.from(selectedProjects),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear división');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      closeModal();
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeModal = () => {
    setShowModal(false);
    setForm({ name: '', description: '' });
    setRoleNames(['']);
    setSelectedProjects(new Set());
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    createMutation.mutate();
  };

  const addRoleInput = () => setRoleNames((prev) => [...prev, '']);
  const removeRoleInput = (i: number) => setRoleNames((prev) => prev.filter((_, idx) => idx !== i));
  const updateRoleName = (i: number, val: string) =>
    setRoleNames((prev) => prev.map((n, idx) => (idx === i ? val : n)));

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <BackButton href="/admin/dashboard" label="Dashboard" />
          <div className="flex items-center justify-between mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Divisiones</h1>
              <p className="text-white/70 text-sm mt-1">Unidades organizativas de la empresa</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nueva División
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
                        <Link
                          href={`/admin/divisions/${d.id}`}
                          className="text-primary text-xs font-semibold hover:underline"
                        >
                          Gestionar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva División */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">Nueva División</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nombre y descripción */}
              <div className="space-y-4">
                <div className="form-group">
                  <label className="label label-required">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Área GPR"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="label">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripción opcional..."
                    rows={2}
                    className="textarea"
                  />
                </div>
              </div>

              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Roles de la División</label>
                  <button type="button" onClick={addRoleInput} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Agregar rol
                  </button>
                </div>
                <div className="space-y-2">
                  {roleNames.map((name, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => updateRoleName(i, e.target.value)}
                        placeholder={`Nombre del rol ${i + 1}`}
                        className="input flex-1 text-sm"
                      />
                      {roleNames.length > 1 && (
                        <button type="button" onClick={() => removeRoleInput(i)} className="p-2 text-text-muted hover:text-error transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Proyectos */}
              {projectOptions.length > 0 && (
                <div>
                  <label className="label mb-2 block">Proyectos vinculados</label>
                  <div className="border border-border rounded-xl max-h-40 overflow-y-auto divide-y divide-border">
                    {projectOptions.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProjects.has(p.id)}
                          onChange={() => toggleProject(p.id)}
                          className="rounded text-primary"
                        />
                        <span className="text-xs font-bold text-text-muted w-14 flex-shrink-0">{p.code}</span>
                        <span className="text-sm text-text-primary flex-1 truncate">{p.name}</span>
                        {p.is_active && <span className="text-xs text-success font-medium">Activo</span>}
                      </label>
                    ))}
                  </div>
                  {selectedProjects.size > 0 && (
                    <p className="text-xs text-text-muted mt-1">{selectedProjects.size} proyecto{selectedProjects.size !== 1 ? 's' : ''} seleccionado{selectedProjects.size !== 1 ? 's' : ''}</p>
                  )}
                </div>
              )}

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
    </div>
  );
}
