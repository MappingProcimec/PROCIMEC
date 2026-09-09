'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DivisionOption { id: string; name: string }

interface FieldReport {
  id: string;
  report_date: string;
  localizador_name?: string;
  operator_name?: string;
  cad_priority?: string;
  status: string;
  operational_summary: { ml?: number; m2?: number }[];
  docx_drive_url?: string;
  drive_session_folder_url?: string;
  gpr_equipment?: string;
  positioning_equipment?: string;
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
  cost_center: string;
  code?: string;
  name: string;
  client: string;
  location: string;
  contract_number?: string;
  description?: string;
  target_ml?: number;
  target_m2?: number;
  target_metric_type?: 'ml' | 'm2';
  requires_mapping?: boolean;
  requires_positioning?: boolean;
  mapping_ml?: number;
  mapping_m2?: number;
  positioning_ml?: number;
  positioning_m2?: number;
  mapping_progress_pct?: number;
  positioning_progress_pct?: number;
  overall_progress_pct?: number;
  drive_folder_url?: string;
  is_active: boolean;
  created_at: string;
  report_count?: number;
  field_reports_count?: number;
  drawing_count?: number;
  total_ml?: number;
  total_m2?: number;
  total_drawing_hours?: number;
  field_reports?: FieldReport[];
  drawing_activities?: DrawingActivity[];
  divisions?: DivisionOption[];
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/admin/projects');
  const data = await res.json();
  const rawList: (Project & { code?: string })[] = data.data || [];
  return rawList.map((p) => ({
    ...p,
    cost_center: p.cost_center || p.code || '',
  }));
}

async function fetchDivisionOptions(): Promise<DivisionOption[]> {
  const res = await fetch('/api/admin/divisions');
  const json = await res.json();
  return (json.data ?? []).map((d: DivisionOption) => ({ id: d.id, name: d.name }));
}

type SortField = 'cost_center' | 'name' | 'client' | 'records' | 'progress' | 'metrics' | 'status' | 'date';

function CircularProgress({
  percentage,
  size = 54,
  strokeWidth = 5,
  color = '#2563eb',
  label,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPct = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (validPct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="text-gray-200"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-bold text-text-primary leading-none">
          {validPct.toFixed(0)}%
        </span>
        {label && <span className="text-[8px] text-text-muted leading-tight mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailFilter, setDetailFilter] = useState<'all' | 'campo' | 'dibujo'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeactivateProject, setConfirmDeactivateProject] = useState<Project | null>(null);

  // Filtros de encabezado
  const [filterCostCenter, setFilterCostCenter] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [form, setForm] = useState({
    cost_center: '',
    name: '',
    client: '',
    location: '',
    contract_number: '',
    description: '',
    target_ml: '',
    target_m2: '',
    target_metric_type: 'ml' as 'ml' | 'm2',
    requires_mapping: true,
    requires_positioning: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedDivisions, setSelectedDivisions] = useState<Set<string>>(new Set());

  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    cost_center: '',
    name: '',
    client: '',
    location: '',
    contract_number: '',
    description: '',
    target_ml: '',
    target_m2: '',
    target_metric_type: 'ml' as 'ml' | 'm2',
    requires_mapping: true,
    requires_positioning: true,
  });
  const [editDivisions, setEditDivisions] = useState<Set<string>>(new Set());

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: fetchProjects,
  });

  const { data: divisionOptions = [] } = useQuery({
    queryKey: ['division-options'],
    queryFn: fetchDivisionOptions,
    enabled: showModal || !!editProject,
  });

  // Mantener actualizado selectedProject si cambian los proyectos
  const currentSelected = useMemo(() => {
    if (!selectedProject) return null;
    return projects.find((p) => p.id === selectedProject.id) || selectedProject;
  }, [projects, selectedProject]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_center: data.cost_center.trim().toUpperCase(),
          code: data.cost_center.trim().toUpperCase(),
          name: data.name,
          client: data.client,
          location: data.location,
          contract_number: data.contract_number,
          description: data.description,
          target_ml: data.target_ml ? Number(data.target_ml) : 0,
          target_m2: data.target_m2 ? Number(data.target_m2) : 0,
          target_metric_type: data.target_metric_type,
          requires_mapping: data.requires_mapping,
          requires_positioning: data.requires_positioning,
          division_ids: Array.from(selectedDivisions),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear proyecto');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      setShowModal(false);
      setForm({
        cost_center: '',
        name: '',
        client: '',
        location: '',
        contract_number: '',
        description: '',
        target_ml: '',
        target_m2: '',
        target_metric_type: 'ml',
        requires_mapping: true,
        requires_positioning: true,
      });
      setSelectedDivisions(new Set());
    },
  });

  const toggleDivision = (id: string) =>
    setSelectedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleEditDivision = (id: string) =>
    setEditDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const openEdit = (p: Project) => {
    setEditProject(p);
    setEditForm({
      cost_center: p.cost_center || p.code || '',
      name: p.name,
      client: p.client,
      location: p.location,
      contract_number: p.contract_number ?? '',
      description: p.description ?? '',
      target_ml: p.target_ml !== undefined && p.target_ml > 0 ? String(p.target_ml) : '',
      target_m2: p.target_m2 !== undefined && p.target_m2 > 0 ? String(p.target_m2) : '',
      target_metric_type: p.target_metric_type || 'ml',
      requires_mapping: p.requires_mapping ?? true,
      requires_positioning: p.requires_positioning ?? true,
    });
    setEditDivisions(new Set((p.divisions ?? []).map((d) => d.id)));
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editProject) return;
      const res = await fetch('/api/admin/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editProject.id,
          cost_center: editForm.cost_center.trim().toUpperCase(),
          code: editForm.cost_center.trim().toUpperCase(),
          name: editForm.name.trim(),
          client: editForm.client.trim(),
          location: editForm.location.trim(),
          contract_number: editForm.contract_number.trim() || null,
          description: editForm.description.trim() || null,
          target_ml: editForm.target_ml ? Number(editForm.target_ml) : 0,
          target_m2: editForm.target_m2 ? Number(editForm.target_m2) : 0,
          target_metric_type: editForm.target_metric_type,
          requires_mapping: editForm.requires_mapping,
          requires_positioning: editForm.requires_positioning,
          division_ids: Array.from(editDivisions),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al actualizar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      setEditProject(null);
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
    if (!form.cost_center) errors.cost_center = 'Requerido';
    if (!form.name) errors.name = 'Requerido';
    if (!form.client) errors.client = 'Requerido';
    if (!form.location) errors.location = 'Requerido';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    createMutation.mutate(form);
  };

  // Manejo de ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-gray-400 opacity-40 ml-1 text-xs">↕</span>;
    return <span className="text-primary font-bold ml-1 text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  // Proyectos filtrados y ordenados
  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const cc = (p.cost_center || p.code || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const client = (p.client || '').toLowerCase();

      if (filterCostCenter && !cc.includes(filterCostCenter.toLowerCase())) return false;
      if (filterName && !name.includes(filterName.toLowerCase())) return false;
      if (filterClient && !client.includes(filterClient.toLowerCase())) return false;

      if (filterStatus === 'active' && !p.is_active) return false;
      if (filterStatus === 'inactive' && p.is_active) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'cost_center':
          valA = (a.cost_center || a.code || '').toLowerCase();
          valB = (b.cost_center || b.code || '').toLowerCase();
          break;
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'client':
          valA = a.client.toLowerCase();
          valB = b.client.toLowerCase();
          break;
        case 'records':
          valA = a.report_count ?? 0;
          valB = b.report_count ?? 0;
          break;
        case 'progress':
          valA = a.overall_progress_pct ?? 0;
          valB = b.overall_progress_pct ?? 0;
          break;
        case 'metrics':
          valA = (a.total_ml ?? 0) + (a.total_drawing_hours ?? 0);
          valB = (b.total_ml ?? 0) + (b.total_drawing_hours ?? 0);
          break;
        case 'status':
          valA = a.is_active ? 1 : 0;
          valB = b.is_active ? 1 : 0;
          break;
        case 'date':
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projects, filterCostCenter, filterName, filterClient, filterStatus, sortField, sortOrder]);

  const hasActiveFilters = filterCostCenter || filterName || filterClient || filterStatus !== 'active';

  const clearFilters = () => {
    setFilterCostCenter('');
    setFilterName('');
    setFilterClient('');
    setFilterStatus('active');
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
          <button onClick={() => setShowModal(true)} className="btn-accent shadow-md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo Proyecto
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-20">
        <div className="card overflow-hidden shadow-lg border border-border">
          
          {/* Header Bar con Estado de Filtros */}
          {hasActiveFilters && (
            <div className="bg-primary-50 px-5 py-2.5 border-b border-primary-100 flex items-center justify-between text-xs text-primary-800">
              <div className="flex items-center gap-2">
                <span className="font-semibold">🔍 Filtros activos:</span>
                <span>Mostrando {filteredAndSortedProjects.length} de {projects.length} proyectos</span>
              </div>
              <button
                onClick={clearFilters}
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                ✕ Limpiar filtros
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Cargando proyectos...</div>
          ) : projects.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-text-muted">Sin proyectos. Crea el primero.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="text-xs text-text-muted px-4 py-1.5 bg-gray-50/50 border-b border-border sm:hidden flex items-center justify-between">
                <span>👈 Desliza horizontalmente para ver todas las columnas y acciones 👉</span>
              </div>
              <table className="table-base w-full min-w-[1020px]">
                <thead>
                  {/* Fila de Títulos con Ordenamiento */}
                  <tr className="bg-gray-50 border-b border-border text-xs text-text-secondary select-none">
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-left transition-colors"
                      onClick={() => handleSort('cost_center')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Centro de Costo</span>
                        {getSortIcon('cost_center')}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-left transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Proyecto</span>
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-left transition-colors"
                      onClick={() => handleSort('client')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Cliente</span>
                        {getSortIcon('client')}
                      </div>
                    </th>
                    <th className="hidden lg:table-cell py-3 px-4 text-left">Divisiones</th>
                    
                    {/* Nueva Columna: Avance de Campo hacia el 100% */}
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-center transition-colors min-w-[170px]"
                      onClick={() => handleSort('progress')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Avance de Campo</span>
                        {getSortIcon('progress')}
                      </div>
                    </th>

                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-center transition-colors"
                      onClick={() => handleSort('records')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Registros</span>
                        {getSortIcon('records')}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-right transition-colors"
                      onClick={() => handleSort('metrics')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Métricas</span>
                        {getSortIcon('metrics')}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer hover:bg-gray-100 py-3 px-4 text-left transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Estado</span>
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>

                  {/* Fila de Filtros en Encabezado */}
                  <tr className="bg-gray-50/70 border-b border-border">
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Filtrar C.C..."
                        value={filterCostCenter}
                        onChange={(e) => setFilterCostCenter(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-primary"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Buscar proyecto..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-primary"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-primary"
                      />
                    </td>
                    <td className="hidden lg:table-cell p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none focus:border-primary"
                      >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-[11px] font-semibold text-primary hover:underline px-1.5 py-0.5"
                          title="Limpiar filtros"
                        >
                          Limpiar
                        </button>
                      )}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-text-muted text-sm">
                        No se encontraron proyectos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedProjects.map((p) => {
                      const totalRecords = p.report_count ?? 0;
                      const fieldCount = p.field_reports_count ?? 0;
                      const drawingCount = p.drawing_count ?? 0;
                      const ml = p.total_ml ?? 0;
                      const drawingHours = p.total_drawing_hours ?? 0;
                      const ccDisplay = p.cost_center || p.code || '—';

                      const targetVal = p.target_metric_type === 'm2' ? p.target_m2 : p.target_ml;
                      const hasTarget = targetVal !== undefined && targetVal > 0;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedProject(p);
                            setDetailFilter('all');
                          }}
                        >
                          <td className="whitespace-nowrap">
                            <span className="badge badge-primary text-xs font-mono font-bold px-2 py-1">
                              {ccDisplay}
                            </span>
                          </td>
                          <td>
                            <div>
                              <p className="font-semibold text-sm text-text-primary hover:text-primary transition-colors flex items-center gap-1.5">
                                {p.name}
                                <span className="text-xs text-primary font-normal opacity-0 group-hover:opacity-100">🔍</span>
                              </p>
                              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                <span>{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: es })}</span>
                                {p.contract_number && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[11px] text-gray-500">CTO: {p.contract_number}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-sm font-medium">{p.client}</td>
                          <td className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(p.divisions ?? []).length === 0
                                ? <span className="text-xs text-text-muted italic">—</span>
                                : (p.divisions ?? []).map((d) => (
                                    <span key={d.id} className="badge badge-accent text-xs">{d.name}</span>
                                  ))
                              }
                            </div>
                          </td>

                          {/* Celda Avance de Campo (Mapeo vs Geolocalización) */}
                          <td className="text-center whitespace-nowrap px-3">
                            <div className="flex flex-col items-center gap-1.5">
                              {/* Barra general */}
                              {hasTarget ? (
                                <div className="w-full max-w-[140px]">
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="font-bold text-primary">{(p.overall_progress_pct ?? 0).toFixed(0)}%</span>
                                    <span className="text-[10px] text-text-muted">
                                      {targetVal} {p.target_metric_type?.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-primary h-full rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(100, p.overall_progress_pct ?? 0)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic bg-gray-100 px-2 py-0.5 rounded-full">
                                  Sin meta definida
                                </span>
                              )}

                              {/* Mini píldoras de Mapeo y Geolocalización */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 ${
                                    p.requires_mapping !== false
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-gray-100 text-gray-400 line-through'
                                  }`}
                                  title={p.requires_mapping !== false ? `Mapeo: ${(p.mapping_progress_pct ?? 0).toFixed(0)}%` : 'No requiere mapeo'}
                                >
                                  📡 {p.requires_mapping !== false ? `${(p.mapping_progress_pct ?? 0).toFixed(0)}%` : 'N/A'}
                                </span>

                                <span
                                  className={`px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 ${
                                    p.requires_positioning !== false
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : 'bg-gray-100 text-gray-400 line-through'
                                  }`}
                                  title={p.requires_positioning !== false ? `Geolocalización: ${(p.positioning_progress_pct ?? 0).toFixed(0)}%` : 'No requiere geolocalización'}
                                >
                                  🛰️ {p.requires_positioning !== false ? `${(p.positioning_progress_pct ?? 0).toFixed(0)}%` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="text-center whitespace-nowrap">
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
                          <td className="text-right text-xs whitespace-nowrap">
                            {ml > 0 && (
                              <div className="font-semibold text-primary">{ml.toFixed(1)} ml</div>
                            )}
                            {drawingHours > 0 && (
                              <div className="font-semibold text-amber-700">{drawingHours.toFixed(1)} h</div>
                            )}
                            {ml === 0 && drawingHours === 0 && <span className="text-text-muted">—</span>}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className={`badge text-xs ${p.is_active ? 'badge-success' : 'badge-gray'}`}>
                              {p.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                className="btn-sm btn-outline text-xs px-2.5 py-1 flex items-center gap-1 hover:bg-gray-100 rounded-lg shadow-2xs font-medium text-text-primary"
                              >
                                <span>⚙️ Acciones</span>
                                <span className="text-[9px] text-text-muted">▼</span>
                              </button>

                              {openMenuId === p.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20 cursor-default"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-border py-1.5 z-30 animate-slide-up origin-top-right">
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        openEdit(p);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
                                    >
                                      <span>✏️</span> Editar proyecto y metas
                                    </button>

                                    {p.drive_folder_url && (
                                      <a
                                        href={p.drive_folder_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setOpenMenuId(null)}
                                        className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
                                      >
                                        <span>📁</span> Abrir carpeta en Drive
                                      </a>
                                    )}

                                    <div className="border-t border-gray-100 my-1" />

                                    {p.is_active ? (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          setConfirmDeactivateProject(p);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold transition-colors"
                                      >
                                        <span>🚫</span> Desactivar proyecto
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          toggleMutation.mutate({ id: p.id, is_active: true });
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-semibold transition-colors"
                                      >
                                        <span>✅</span> Activar proyecto
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Detalle Completo del Proyecto (Ficha, Metas, Gráficos y Registros) ─────────────────────── */}
      {currentSelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up shadow-2xl border border-border">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-6 py-5 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-white/20 text-white font-mono text-xs px-2.5 py-0.5 rounded-md font-bold">
                    C.C.: {currentSelected.cost_center || currentSelected.code || '—'}
                  </span>
                  <span className="text-xs text-white/80">{currentSelected.client} · {currentSelected.location}</span>
                  {currentSelected.contract_number && (
                    <span className="bg-white/10 text-white text-[11px] px-2 py-0.5 rounded border border-white/20 font-mono">
                      Contrato: {currentSelected.contract_number}
                    </span>
                  )}
                  <span className={`badge text-[11px] ${currentSelected.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>
                    {currentSelected.is_active ? 'Proyecto Activo' : 'Inactivo'}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{currentSelected.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(currentSelected)}
                  className="btn-sm bg-white/15 hover:bg-white/25 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 transition-all"
                >
                  <span>✏️</span> Editar Proyecto y Metas
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Ficha Descriptiva y Metas del Proyecto */}
            <div className="bg-slate-50 border-b border-border px-6 py-4">
              {currentSelected.description && (
                <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200 text-xs text-text-secondary leading-relaxed">
                  <span className="font-bold text-text-primary block mb-0.5">📌 Objeto / Descripción del Proyecto:</span>
                  {currentSelected.description}
                </div>
              )}

              {/* ── LOS 2 GRÁFICOS DE PROGRESO DE CAMPO (Mapeo vs Geolocalización) ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* GRÁFICO 1: Mapeo / Localización Subterránea */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  currentSelected.requires_mapping !== false
                    ? 'bg-white border-blue-200 shadow-xs'
                    : 'bg-gray-100/70 border-gray-300 opacity-60'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">📡</span>
                        <h4 className="font-bold text-sm text-text-primary truncate">Localización Subterránea / Mapeo</h4>
                      </div>
                      
                      {currentSelected.requires_mapping !== false ? (
                        <>
                          <p className="text-xs text-text-muted mb-2">
                            GPR, Radiodetección (RD), PPR, Sondas y equipos geofísicos
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-text-muted">Metraje ejecutado:</span>
                              <span className="font-bold text-blue-700 text-sm">
                                {currentSelected.target_metric_type === 'm2'
                                  ? `${(currentSelected.mapping_m2 ?? 0).toFixed(1)} m²`
                                  : `${(currentSelected.mapping_ml ?? 0).toFixed(1)} ML`}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-text-muted">Meta programada:</span>
                              <span className="font-medium text-text-primary">
                                {currentSelected.target_metric_type === 'm2'
                                  ? `${currentSelected.target_m2 || 0} m²`
                                  : `${currentSelected.target_ml || 0} ML`}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-2">
                          <span className="badge badge-gray text-xs">No requerido en este proyecto</span>
                          <p className="text-xs text-text-muted mt-1">Este proyecto no computa avance de exploración subterránea.</p>
                        </div>
                      )}
                    </div>

                    {currentSelected.requires_mapping !== false && (
                      <CircularProgress
                        percentage={currentSelected.mapping_progress_pct ?? 0}
                        color="#2563eb"
                        label="Mapeo"
                      />
                    )}
                  </div>

                  {currentSelected.requires_mapping !== false && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Estado de cobertura:</span>
                      <span className={`font-semibold ${
                        (currentSelected.mapping_progress_pct ?? 0) >= 100
                          ? 'text-emerald-700'
                          : (currentSelected.mapping_progress_pct ?? 0) > 0
                          ? 'text-blue-700'
                          : 'text-amber-700'
                      }`}>
                        {(currentSelected.mapping_progress_pct ?? 0) >= 100
                          ? '✅ 100% Completado'
                          : (currentSelected.mapping_progress_pct ?? 0) > 0
                          ? `⏳ ${(currentSelected.mapping_progress_pct ?? 0).toFixed(1)}% ejecutado`
                          : '⚠️ Pendiente por iniciar'}
                      </span>
                    </div>
                  )}
                </div>

                {/* GRÁFICO 2: Geolocalización / Posicionamiento */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  currentSelected.requires_positioning !== false
                    ? 'bg-white border-indigo-200 shadow-xs'
                    : 'bg-gray-100/70 border-gray-300 opacity-60'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🛰️</span>
                        <h4 className="font-bold text-sm text-text-primary truncate">Geolocalización / Posicionamiento</h4>
                      </div>

                      {currentSelected.requires_positioning !== false ? (
                        <>
                          <p className="text-xs text-text-muted mb-2">
                            GNSS RTK, Estación Total, GPS Topográfico y amarre
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-text-muted">Metraje georreferenciado:</span>
                              <span className="font-bold text-indigo-700 text-sm">
                                {currentSelected.target_metric_type === 'm2'
                                  ? `${(currentSelected.positioning_m2 ?? 0).toFixed(1)} m²`
                                  : `${(currentSelected.positioning_ml ?? 0).toFixed(1)} ML`}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-text-muted">Meta programada:</span>
                              <span className="font-medium text-text-primary">
                                {currentSelected.target_metric_type === 'm2'
                                  ? `${currentSelected.target_m2 || 0} m²`
                                  : `${currentSelected.target_ml || 0} ML`}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-2">
                          <span className="badge badge-gray text-xs">No requerido en este proyecto</span>
                          <p className="text-xs text-text-muted mt-1">Este proyecto no computa avance de georreferenciación.</p>
                        </div>
                      )}
                    </div>

                    {currentSelected.requires_positioning !== false && (
                      <CircularProgress
                        percentage={currentSelected.positioning_progress_pct ?? 0}
                        color="#4f46e5"
                        label="Geo"
                      />
                    )}
                  </div>

                  {currentSelected.requires_positioning !== false && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Estado de cobertura:</span>
                      <span className={`font-semibold ${
                        (currentSelected.positioning_progress_pct ?? 0) >= 100
                          ? 'text-emerald-700'
                          : (currentSelected.positioning_progress_pct ?? 0) > 0
                          ? 'text-indigo-700'
                          : 'text-amber-700'
                      }`}>
                        {(currentSelected.positioning_progress_pct ?? 0) >= 100
                          ? '✅ 100% Completado'
                          : (currentSelected.positioning_progress_pct ?? 0) > 0
                          ? `⏳ ${(currentSelected.positioning_progress_pct ?? 0).toFixed(1)}% ejecutado`
                          : '⚠️ Pendiente por iniciar'}
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Barra de Progreso Global del Proyecto */}
              <div className="mt-4 bg-white p-3 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">
                    <span>🏁 Progreso General del Proyecto:</span>
                    <span className="text-primary font-extrabold text-sm">{(currentSelected.overall_progress_pct ?? 0).toFixed(1)}%</span>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {currentSelected.requires_mapping && currentSelected.requires_positioning
                      ? 'Promedio de Mapeo y Geolocalización'
                      : currentSelected.requires_mapping
                      ? 'Basado en Mapeo Subterráneo'
                      : currentSelected.requires_positioning
                      ? 'Basado en Geolocalización'
                      : 'Sin requerimientos activos'}
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      (currentSelected.overall_progress_pct ?? 0) >= 100
                        ? 'bg-emerald-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, currentSelected.overall_progress_pct ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Stats & Filters */}
            <div className="bg-white border-b border-border px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-text-muted">Total Registros</div>
                  <div className="text-base font-bold text-text-primary">{currentSelected.report_count ?? 0}</div>
                </div>
                <div className="border-l border-border pl-6">
                  <div className="text-xs text-text-muted">Campo (ML)</div>
                  <div className="text-base font-bold text-primary">{(currentSelected.total_ml ?? 0).toFixed(1)} ml</div>
                </div>
                <div className="border-l border-border pl-6">
                  <div className="text-xs text-text-muted">Dibujo (Horas)</div>
                  <div className="text-base font-bold text-amber-700">{(currentSelected.total_drawing_hours ?? 0).toFixed(1)} h</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-border">
                <button
                  onClick={() => setDetailFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-secondary hover:bg-white'
                  }`}
                >
                  Todos ({currentSelected.report_count ?? 0})
                </button>
                <button
                  onClick={() => setDetailFilter('campo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'campo' ? 'bg-blue-600 text-white shadow-xs' : 'text-text-secondary hover:bg-white'
                  }`}
                >
                  📍 Campo ({currentSelected.field_reports_count ?? 0})
                </button>
                <button
                  onClick={() => setDetailFilter('dibujo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    detailFilter === 'dibujo' ? 'bg-amber-600 text-white shadow-xs' : 'text-text-secondary hover:bg-white'
                  }`}
                >
                  ✏️ Dibujo ({currentSelected.drawing_count ?? 0})
                </button>
              </div>
            </div>

            {/* Modal Body: Tabla de Registros */}
            <div className="p-6 overflow-y-auto flex-1 bg-surface">
              {(() => {
                const fieldList = (currentSelected.field_reports || []).map((r) => {
                  const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
                  const ml = rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
                  const m2 = rows.reduce((s, row) => s + (Number(row.m2) || 0), 0);
                  
                  const isLoc = (r.gpr_equipment || '').trim().toLowerCase() !== 'ninguno' && (r.gpr_equipment || '').trim().length > 0;
                  const isPos = (r.positioning_equipment || '').trim().toLowerCase() !== 'sin posicionamiento' && (r.positioning_equipment || '').trim().length > 0;

                  return {
                    id: `campo-${r.id}`,
                    area: 'campo' as const,
                    date: r.report_date || '',
                    responsible: r.localizador_name || r.operator_name || '—',
                    detail: `${ml.toFixed(1)} ml${m2 > 0 ? ` · ${m2.toFixed(1)} m²` : ''}`,
                    equipmentInfo: `${isLoc ? '📡 Mapeo' : ''}${isLoc && isPos ? ' + ' : ''}${isPos ? '🛰️ Geo' : ''}`,
                    statusOrType: r.status === 'submitted' ? 'Enviado' : r.status === 'reviewed' ? 'Revisado' : 'Borrador',
                    docxUrl: r.docx_drive_url,
                    driveUrl: r.drive_session_folder_url,
                  };
                });

                const drawingList = (currentSelected.drawing_activities || []).map((a) => ({
                  id: `dibujo-${a.id}`,
                  area: 'dibujo' as const,
                  date: a.activity_date || '',
                  responsible: a.responsible || '—',
                  detail: `${Number(a.hours_worked).toFixed(1)} h (${a.software})`,
                  equipmentInfo: '—',
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
                  <div className="overflow-x-auto border border-border rounded-xl bg-white shadow-xs">
                    <table className="table-base w-full min-w-[700px]">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Área</th>
                          <th>Responsable</th>
                          <th>Metraje / Horas</th>
                          <th>Frente de Trabajo</th>
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
                              <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                {item.equipmentInfo}
                              </span>
                            </td>
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

      {/* ── Modal Editar Proyecto ────────────────────────────────────────── */}
      {editProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-border flex items-center justify-between z-10">
              <h3 className="font-bold text-text-primary text-base">Editar Proyecto y Metas</h3>
              <button onClick={() => setEditProject(null)} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label label-required">Centro de Costo</label>
                  <input
                    type="text"
                    value={editForm.cost_center}
                    onChange={(e) => setEditForm({ ...editForm, cost_center: e.target.value.toUpperCase() })}
                    className="input font-mono"
                    placeholder="CC-001"
                  />
                </div>
                <div className="form-group">
                  <label className="label label-required">Nombre</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label label-required">Cliente</label>
                  <input
                    type="text"
                    value={editForm.client}
                    onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label label-required">Ubicación</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Sección de Metas y Alcance del Proyecto */}
              <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-primary-900 flex items-center gap-1.5">
                    <span>🎯</span> Metas de Cumplimiento (Alcance)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">Métrica principal:</span>
                    <select
                      value={editForm.target_metric_type}
                      onChange={(e) => setEditForm({ ...editForm, target_metric_type: e.target.value as 'ml' | 'm2' })}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white font-semibold"
                    >
                      <option value="ml">Metros Lineales (ML)</option>
                      <option value="m2">Área (m²)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label text-xs">Meta en Metros Lineales (ML)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.target_ml}
                      onChange={(e) => setEditForm({ ...editForm, target_ml: e.target.value })}
                      className="input text-sm"
                      placeholder="Ej: 1500"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label text-xs">Meta en Área (m²)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.target_m2}
                      onChange={(e) => setEditForm({ ...editForm, target_m2: e.target.value })}
                      className="input text-sm"
                      placeholder="Ej: 5000"
                    />
                  </div>
                </div>

                {/* Requerimientos del proyecto */}
                <div className="pt-2 border-t border-primary-100/70 space-y-2">
                  <span className="text-[11px] font-bold text-text-secondary block">Frentes requeridos para computar el 100%:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={editForm.requires_mapping}
                        onChange={(e) => setEditForm({ ...editForm, requires_mapping: e.target.checked })}
                        className="rounded text-primary"
                      />
                      <span className="text-xs text-text-primary font-medium">📡 Requiere Mapeo Subterráneo</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={editForm.requires_positioning}
                        onChange={(e) => setEditForm({ ...editForm, requires_positioning: e.target.checked })}
                        className="rounded text-primary"
                      />
                      <span className="text-xs text-text-primary font-medium">🛰️ Requiere Geolocalización</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Número de contrato</label>
                <input
                  type="text"
                  value={editForm.contract_number}
                  onChange={(e) => setEditForm({ ...editForm, contract_number: e.target.value })}
                  className="input"
                  placeholder="CTO-2024-001"
                />
              </div>
              <div className="form-group">
                <label className="label">Descripción / Objeto</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="input"
                />
              </div>
              {divisionOptions.length > 0 && (
                <div className="form-group">
                  <label className="label">Divisiones</label>
                  <div className="border border-border rounded-xl max-h-36 overflow-y-auto divide-y divide-border">
                    {divisionOptions.map((d) => (
                      <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDivisions.has(d.id)}
                          onChange={() => toggleEditDivision(d.id)}
                          className="rounded text-primary"
                        />
                        <span className="text-sm text-text-primary">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {editMutation.isError && (
                <p className="error-msg text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ {editMutation.error instanceof Error ? editMutation.error.message : 'Error al actualizar'}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditProject(null)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="btn-primary flex-1">
                  {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear Proyecto ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-border flex items-center justify-between z-10">
              <h3 className="font-bold text-text-primary text-base">Nuevo Proyecto</h3>
              <button onClick={() => { setShowModal(false); setSelectedDivisions(new Set()); }} className="btn-icon btn-ghost">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label label-required">Centro de Costo</label>
                  <input
                    type="text"
                    value={form.cost_center}
                    onChange={(e) => setForm({ ...form, cost_center: e.target.value.toUpperCase() })}
                    placeholder="CC-31002"
                    className={`input font-mono ${formErrors.cost_center ? 'input-error' : ''}`}
                  />
                  {formErrors.cost_center && <p className="error-msg">⚠️ {formErrors.cost_center}</p>}
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

              {/* Metas del Proyecto */}
              <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-primary-900 flex items-center gap-1.5">
                    <span>🎯</span> Metas de Cumplimiento (Alcance)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">Métrica principal:</span>
                    <select
                      value={form.target_metric_type}
                      onChange={(e) => setForm({ ...form, target_metric_type: e.target.value as 'ml' | 'm2' })}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white font-semibold"
                    >
                      <option value="ml">Metros Lineales (ML)</option>
                      <option value="m2">Área (m²)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label text-xs">Meta en Metros Lineales (ML)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.target_ml}
                      onChange={(e) => setForm({ ...form, target_ml: e.target.value })}
                      placeholder="Ej: 1500"
                      className="input text-sm"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label text-xs">Meta en Área (m²)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.target_m2}
                      onChange={(e) => setForm({ ...form, target_m2: e.target.value })}
                      placeholder="Ej: 5000"
                      className="input text-sm"
                    />
                  </div>
                </div>

                {/* Requerimientos del proyecto */}
                <div className="pt-2 border-t border-primary-100/70 space-y-2">
                  <span className="text-[11px] font-bold text-text-secondary block">Frentes requeridos para computar el 100%:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.requires_mapping}
                        onChange={(e) => setForm({ ...form, requires_mapping: e.target.checked })}
                        className="rounded text-primary"
                      />
                      <span className="text-xs text-text-primary font-medium">📡 Requiere Mapeo Subterráneo</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.requires_positioning}
                        onChange={(e) => setForm({ ...form, requires_positioning: e.target.checked })}
                        className="rounded text-primary"
                      />
                      <span className="text-xs text-text-primary font-medium">🛰️ Requiere Geolocalización</span>
                    </label>
                  </div>
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
                  placeholder="Detalles u objeto del proyecto..."
                  rows={2}
                  className="input"
                />
              </div>

              {divisionOptions.length > 0 && (
                <div className="form-group">
                  <label className="label">Divisiones</label>
                  <div className="border border-border rounded-xl max-h-36 overflow-y-auto divide-y divide-border">
                    {divisionOptions.map((d) => (
                      <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDivisions.has(d.id)}
                          onChange={() => toggleDivision(d.id)}
                          className="rounded text-primary"
                        />
                        <span className="text-sm text-text-primary">{d.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedDivisions.size > 0 && (
                    <p className="text-xs text-text-muted mt-1">
                      {selectedDivisions.size} división{selectedDivisions.size !== 1 ? 'es' : ''} seleccionada{selectedDivisions.size !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {createMutation.isError && (
                <p className="error-msg text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ {createMutation.error instanceof Error ? createMutation.error.message : 'Error al crear proyecto'}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowModal(false); setSelectedDivisions(new Set()); }} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleSubmit} disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creando...' : 'Crear Proyecto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Desactivación de Proyecto ───────────────────── */}
      {confirmDeactivateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl space-y-4 border border-border animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-text-primary">¿Desactivar este proyecto?</h3>
              <p className="text-xs text-text-secondary">
                Estás a punto de desactivar{' '}
                <span className="font-bold text-text-primary">{confirmDeactivateProject.name}</span>{' '}
                ({confirmDeactivateProject.cost_center || confirmDeactivateProject.code || 'Sin C.C.'}).
              </p>
              <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 text-left leading-relaxed">
                ℹ️ <strong>Nota:</strong> El proyecto pasará a estado inactivo y no aparecerá disponible para que los localizadores creen nuevos reportes de campo ni registros de dibujo hasta que sea reactivado.
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDeactivateProject(null)}
                className="btn-ghost flex-1 text-xs py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  toggleMutation.mutate({ id: confirmDeactivateProject.id, is_active: false });
                  setConfirmDeactivateProject(null);
                }}
                disabled={toggleMutation.isPending}
                className="flex-1 text-xs py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                {toggleMutation.isPending ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
