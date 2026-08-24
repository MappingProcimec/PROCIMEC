'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FieldReport {
  id: string;
  report_date: string;
  operator_name?: string;
  cad_priority?: string;
  status: string;
  operational_summary: { ml?: number }[];
  docx_drive_url?: string;
  drive_session_folder_url?: string;
}

interface DrawingActivity {
  id: string;
  project_name: string;
  software: string;
  hours_worked: number;
  is_rework: boolean;
  responsible: string;
  activity_date: string;
}

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
  field_reports_count?: number;
  drawing_count?: number;
  total_ml?: number;
  total_drawing_hours?: number;
  field_reports?: FieldReport[];
  drawing_activities?: DrawingActivity[];
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/admin/projects');
  const data = await res.json();
  return data.data || [];
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailFilter, setDetailFilter] = useState<'all' | 'campo' | 'dibujo'>('all');

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
            <p className="text-white/70 text-sm">{projects.filter((p) => p.is_active).length} activos de {projects.length} totales</p>
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
                    <th className="text-center">Registros Totales</th>
                    <th className="text-right">Métricas</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const totalRecords = p.report_count ?? 0;
                    const fieldCount = p.field_reports_count ?? 0;
                    const drawingCount = p.drawing_count ?? 0;
                    const ml = p.total_ml ?? 0;
                    const drawingHours = p.total_drawing_hours ?? 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedProject(p);
                          setDetailFilter('all');
                        }}
                      >
                        <td>
                          <span className="badge badge-primary text-xs">{p.code}</span>
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold text-sm text-text-primary hover:text-primary transition-colors flex items-center gap-1.5">
                              {p.name}
                              <span className="text-xs text-primary font-normal opacity-0 group-hover:opacity-100">🔍</span>
                            </p>
                            <p className="text-xs text-text-muted">
                              {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: es })}
                            </p>
                          </div>
                        </td>
                        <td className="text-sm font-medium">{p.client}</td>
                        <td className="text-sm text-text-muted max-w-[150px] truncate">{p.location}</td>
                        <td className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-sm text-text-primary">{totalRecords}</span>
                            <div className="flex items-center gap-1">
                              {fieldCount > 0 && (
                                <span className="badge bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5">
                                  📍 {fieldCount}
                                </span>
                              )}
                              {drawingCount > 0 && (
                                <span className="badge bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5">
                                  ✏️ {drawingCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-xs">
                          {ml > 0 && (
                            <div className="font-semibold text-primary">{ml.toFixed(1)} ml</div>
                          )}
                          {drawingHours > 0 && (
                            <div className="font-semibold text-amber-700">{drawingHours.toFixed(1)} h</div>
                          )}
                          {ml === 0 && drawingHours === 0 && <span className="text-text-muted">—</span>}
                        </td>
                        <td>
                          <span className={`badge text-xs ${p.is_active ? 'badge-success' : 'badge-gray'}`}>
                            {p.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedProject(p);
                                setDetailFilter('all');
                              }}
                              className="btn-sm btn-outline text-xs flex items-center gap-1"
                            >
                              🔍 Ver registros
                            </button>
                            {p.drive_folder_url && (
                              <a
                                href={p.drive_folder_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-sm btn-ghost text-xs"
                                title="Abrir Drive"
                              >
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Detalle de Registros del Proyecto ─────────────────────── */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="bg-primary text-white px-6 py-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white font-mono text-xs px-2 py-0.5 rounded-md">{selectedProject.code}</span>
                  <span className="text-xs text-white/80">{selectedProject.client} — {selectedProject.location}</span>
                </div>
                <h2 className="text-xl font-bold mt-1 text-white">{selectedProject.name}</h2>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Stats & Filters */}
            <div className="bg-gray-50 border-b border-border px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-text-muted">Total Registros</div>
                  <div className="text-lg font-bold text-text-primary">{selectedProject.report_count ?? 0}</div>
                </div>
                <div className="border-l border-border pl-6">
                  <div className="text-xs text-text-muted">Campo (ML)</div>
                  <div className="text-lg font-bold text-primary">{(selectedProject.total_ml ?? 0).toFixed(1)} ml</div>
                </div>
                <div className="border-l border-border pl-6">
                  <div className="text-xs text-text-muted">Dibujo (Horas)</div>
                  <div className="text-lg font-bold text-amber-700">{(selectedProject.total_drawing_hours ?? 0).toFixed(1)} h</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-border">
                <button
                  onClick={() => setDetailFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-100'
                  }`}
                >
                  Todos ({selectedProject.report_count ?? 0})
                </button>
                <button
                  onClick={() => setDetailFilter('campo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'campo' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:bg-gray-100'
                  }`}
                >
                  📍 Campo ({selectedProject.field_reports_count ?? 0})
                </button>
                <button
                  onClick={() => setDetailFilter('dibujo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'dibujo' ? 'bg-amber-600 text-white' : 'text-text-secondary hover:bg-gray-100'
                  }`}
                >
                  ✏️ Dibujo ({selectedProject.drawing_count ?? 0})
                </button>
              </div>
            </div>

            {/* Modal Body: Tabla de Registros */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const fieldList = (selectedProject.field_reports || []).map((r) => {
                  const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
                  const ml = rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
                  return {
                    id: `campo-${r.id}`,
                    area: 'campo' as const,
                    date: r.report_date || '',
                    responsible: r.operator_name || '—',
                    detail: `${ml.toFixed(1)} ml`,
                    statusOrType: r.status === 'submitted' ? 'Enviado' : r.status === 'reviewed' ? 'Revisado' : 'Borrador',
                    docxUrl: r.docx_drive_url,
                    driveUrl: r.drive_session_folder_url,
                  };
                });

                const drawingList = (selectedProject.drawing_activities || []).map((a) => ({
                  id: `dibujo-${a.id}`,
                  area: 'dibujo' as const,
                  date: a.activity_date || '',
                  responsible: a.responsible || '—',
                  detail: `${Number(a.hours_worked).toFixed(1)} h (${a.software})`,
                  statusOrType: a.is_rework ? 'Reproceso' : 'Normal',
                  docxUrl: undefined,
                  driveUrl: undefined,
                }));

                let filtered = [...fieldList, ...drawingList];
                if (detailFilter === 'campo') filtered = fieldList;
                if (detailFilter === 'dibujo') filtered = drawingList;

                filtered.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

                if (filtered.length === 0) {
                  return <div className="py-12 text-center text-text-muted text-sm">No hay registros para este filtro en este proyecto.</div>;
                }

                return (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Área</th>
                          <th>Responsable</th>
                          <th>Detalle</th>
                          <th>Estado / Tipo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((item) => (
                          <tr key={item.id}>
                            <td className="whitespace-nowrap text-sm">
                              {item.date ? format(new Date(item.date.includes('T') ? item.date : item.date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                            </td>
                            <td>
                              <span className={`badge text-xs ${item.area === 'campo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                {item.area === 'campo' ? '📍 Campo' : '✏️ Dibujo'}
                              </span>
                            </td>
                            <td className="text-sm font-medium text-text-primary">{item.responsible}</td>
                            <td className="font-semibold text-primary text-sm">{item.detail}</td>
                            <td>
                              <span className={`badge text-xs ${
                                item.statusOrType === 'Enviado' || item.statusOrType === 'Normal' ? 'badge-success' :
                                item.statusOrType === 'Revisado' ? 'badge-primary' :
                                item.statusOrType === 'Reproceso' ? 'badge-error' : 'badge-warning'
                              }`}>
                                {item.statusOrType}
                              </span>
                            </td>
                            <td>
                              {item.area === 'campo' ? (
                                <div className="flex items-center gap-1.5">
                                  {item.docxUrl && (
                                    <a href={item.docxUrl} target="_blank" rel="noopener noreferrer" className="btn-sm btn-primary py-1 text-xs">
                                      .docx
                                    </a>
                                  )}
                                  {item.driveUrl && (
                                    <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" className="btn-sm btn-ghost py-1 text-xs">
                                      Drive
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Proyecto */}
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
                  <label className="label label-required">Código</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="PROC-2024-01"
                    className={`input ${formErrors.code ? 'input-error' : ''}`}
                  />
                  {formErrors.code && <p className="error-msg">⚠️ {formErrors.code}</p>}
                </div>
                <div className="form-group">
                  <label className="label label-required">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nombre del proyecto"
                    className={`input ${formErrors.name ? 'input-error' : ''}`}
                  />
                  {formErrors.name && <p className="error-msg">⚠️ {formErrors.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label label-required">Cliente</label>
                  <input
                    type="text"
                    value={form.client}
                    onChange={(e) => setForm({ ...form, client: e.target.value })}
                    placeholder="Empresa cliente"
                    className={`input ${formErrors.client ? 'input-error' : ''}`}
                  />
                  {formErrors.client && <p className="error-msg">⚠️ {formErrors.client}</p>}
                </div>
                <div className="form-group">
                  <label className="label label-required">Ubicación</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Ciudad, Depto"
                    className={`input ${formErrors.location ? 'input-error' : ''}`}
                  />
                  {formErrors.location && <p className="error-msg">⚠️ {formErrors.location}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="label">Número de contrato (opcional)</label>
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                  placeholder="CTO-2024-001"
                  className="input"
                />
              </div>

              <div className="form-group">
                <label className="label">Descripción / Objeto (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="input"
                />
              </div>

              {createMutation.isError && (
                <p className="error-msg text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ {createMutation.error instanceof Error ? createMutation.error.message : 'Error al crear proyecto'}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleSubmit} disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creando...' : 'Crear Proyecto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
