'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  contract_number?: string;
  description?: string;
  drive_folder_url?: string;
  is_active: boolean;
  created_at: string;
  report_count?: number;
  total_ml?: number;
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/admin/projects');
  const data = await res.json();
  return data.data || [];
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    client: '',
    location: '',
    contract_number: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear proyecto');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setShowModal(false);
      setForm({ code: '', name: '', client: '', location: '', contract_number: '', description: '' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch('/api/admin/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-projects'] }),
  });

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    if (!form.code) errors.code = 'Requerido';
    if (!form.name) errors.name = 'Requerido';
    if (!form.client) errors.client = 'Requerido';
    if (!form.location) errors.location = 'Requerido';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Gestión de Proyectos</h1>
            <p className="text-white/70 text-sm">{projects.filter(p => p.is_active).length} activos de {projects.length} totales</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo Proyecto
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Cargando proyectos...</div>
          ) : projects.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-text-muted">Sin proyectos. Crea el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Proyecto</th>
                    <th>Cliente</th>
                    <th>Ubicación</th>
                    <th className="text-center">Registros</th>
                    <th className="text-right">Total ML</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span className="badge badge-primary text-xs">{p.code}</span>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-sm text-text-primary">{p.name}</p>
                          <p className="text-xs text-text-muted">
                            {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                      </td>
                      <td className="text-sm">{p.client}</td>
                      <td className="text-sm text-text-muted max-w-[150px] truncate">{p.location}</td>
                      <td className="text-center">
                        <span className="font-semibold text-sm">{p.report_count ?? 0}</span>
                      </td>
                      <td className="text-right font-semibold text-primary text-sm">
                        {(p.total_ml ?? 0).toFixed(1)}
                      </td>
                      <td>
                        <span className={`badge text-xs ${p.is_active ? 'badge-success' : 'badge-gray'}`}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {p.drive_folder_url && (
                            <a href={p.drive_folder_url} target="_blank" rel="noopener noreferrer"
                              className="btn-sm btn-ghost text-xs" title="Abrir Drive">
                              Drive
                            </a>
                          )}
                          <button
                            onClick={() => toggleMutation.mutate({ id: p.id, is_active: !p.is_active })}
                            className={`btn-sm text-xs ${p.is_active ? 'btn-ghost text-error' : 'btn-outline'}`}
                          >
                            {p.is_active ? 'Desactivar' : 'Activar'}
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

      {/* Create project modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-text-primary">Nuevo Proyecto</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label label-required">Código interno</label>
                  <input className={`input ${formErrors.code ? 'input-error' : ''}`}
                    placeholder="Ej: PROC-2024-001"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })} />
                  {formErrors.code && <p className="error-msg">⚠ {formErrors.code}</p>}
                </div>
                <div className="form-group">
                  <label className="label">N° de Contrato</label>
                  <input className="input" placeholder="Opcional"
                    value={form.contract_number}
                    onChange={e => setForm({ ...form, contract_number: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="label label-required">Nombre del proyecto</label>
                <input className={`input ${formErrors.name ? 'input-error' : ''}`}
                  placeholder="Nombre descriptivo del proyecto"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
                {formErrors.name && <p className="error-msg">⚠ {formErrors.name}</p>}
              </div>

              <div className="form-group">
                <label className="label label-required">Cliente</label>
                <input className={`input ${formErrors.client ? 'input-error' : ''}`}
                  placeholder="Nombre del cliente"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })} />
                {formErrors.client && <p className="error-msg">⚠ {formErrors.client}</p>}
              </div>

              <div className="form-group">
                <label className="label label-required">Ubicación</label>
                <input className={`input ${formErrors.location ? 'input-error' : ''}`}
                  placeholder="Ciudad, dirección o referencia del proyecto"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })} />
                {formErrors.location && <p className="error-msg">⚠ {formErrors.location}</p>}
              </div>

              <div className="form-group">
                <label className="label">Descripción</label>
                <textarea className="textarea" placeholder="Descripción adicional del proyecto..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3">
                <p className="text-xs text-primary">
                  <strong>💡 Nota:</strong> Al crear el proyecto, se creará automáticamente una carpeta en Google Drive con el nombre <code>{form.code || 'CODIGO'}_{form.name || 'NOMBRE'}</code>
                </p>
              </div>

              {createMutation.isError && (
                <p className="error-msg text-sm">⚠ {(createMutation.error as Error).message}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button onClick={handleSubmit} disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Crear Proyecto</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
