'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Download,
  History,
  PlusCircle,
  ExternalLink,
  RotateCcw,
  Clock,
  Layers,
  FileCheck,
  CheckCircle2,
  X,
  FileCode,
  Tag,
  Users,
  AlertCircle,
  FolderTree,
  Edit3,
  Database,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { DocumentFormatItem, FormatVersionHistoryItem } from '@/app/api/tools/version-control/route';

export const COMMON_SYSTEM_FORMS = [
  { slug: '', label: '-- Ninguno / Documento Físico o Descargable --' },
  { slug: 'analisis-planificacion-cambios-sig', label: 'FOR-SIG-001 — Análisis y Planificación de Cambios SIG' },
  { slug: 'hseq-report', label: 'FOR-HSEQ-... — Reportes Preoperacionales HSEQ (Drone, GPR, GPS, etc.)' },
  { slug: 'requerimiento-compra', label: 'FOR-COM-001 — Requerimiento de Compras y Suministros' },
  { slug: 'orden-compra', label: 'FOR-COM-002 — Orden de Compra Oficial' },
  { slug: 'evaluacion-proveedor', label: 'FOR-COM-003 — Evaluación y Reevaluación de Proveedores' },
  { slug: 'despacho-equipo', label: 'FOR-ALM-001 — Control de Salida / Despacho de Equipos' },
  { slug: 'retorno-equipo', label: 'FOR-ALM-002 — Control de Retorno / Ingreso de Equipos' },
  { slug: 'registro-equipo', label: 'FOR-ALM-003 — Registro e Inventario de Equipos' },
  { slug: 'gpr-field-form', label: 'FOR-GPR-001 — Reporte Diario de Campo GPR' },
  { slug: 'cad-register-form', label: 'FOR-CAD-001 — Bitácora de Producción CAD / BIM' },
  { slug: 'elaboracion-cartas', label: 'FOR-TH-... — Elaboración de Cartas y Certificaciones Laborales' },
  { slug: 'solicitud-viaticos', label: 'FOR-FIN-001 — Solicitud de Anticipo de Viáticos' },
  { slug: 'legalizacion-gastos', label: 'FOR-FIN-002 — Legalización de Gastos de Viaje' },
  { slug: 'registro-pago', label: 'FOR-FIN-003 — Registro de Pago y Egreso Bancario' },
  { slug: 'radicacion-factura', label: 'FOR-CNT-001 — Radicación de Facturas Recibidas' },
  { slug: 'soporte-cobro', label: 'FOR-CNT-002 — Cuentas de Cobro y Facturación Emitida' },
  { slug: 'registro-oportunidad', label: 'FOR-CMR-001 — Registro de Oportunidad Comercial' },
  { slug: 'cotizacion-comercial', label: 'FOR-CMR-002 — Cotización y Oferta Económica' },
  { slug: 'cierre-comercial', label: 'FOR-CMR-003 — Acta de Cierre y Adjudicación Comercial' },
];

export function VersionControlPanel() {
  const queryClient = useQueryClient();

  // Estados de Filtros
  const [search, setSearch] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Estados de Modales
  const [historyModalFormat, setHistoryModalFormat] = useState<DocumentFormatItem | null>(null);
  const [isBumpModalOpen, setIsBumpModalOpen] = useState(false);
  const [selectedFormatToBump, setSelectedFormatToBump] = useState<DocumentFormatItem | null>(null);
  const [isNewFormatModalOpen, setIsNewFormatModalOpen] = useState(false);

  // Estado Modal de Edición de Formato
  const [selectedFormatToEdit, setSelectedFormatToEdit] = useState<DocumentFormatItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    code: '',
    name: '',
    process: 'HSEQ & SIG',
    form_slug: '',
    roles_access_raw: 'Todos los Roles',
    is_universal: true,
    current_version: '1',
    effective_date: new Date().toISOString().slice(0, 10),
    status: 'active' as 'active' | 'obsolete' | 'draft',
    description: '',
    change_reason: '',
  });

  // Formularios de Modal
  const [bumpForm, setBumpForm] = useState({
    new_version: '',
    change_date: new Date().toISOString().slice(0, 10),
    change_reason: '',
    responsible_name: '',
    file_format: 'xlsx',
  });

  const [newFormatForm, setNewFormatForm] = useState({
    code: '',
    name: '',
    process: 'HSEQ & SIG',
    form_slug: '',
    roles_access_raw: 'Todos los Roles',
    is_universal: true,
    current_version: '1',
    effective_date: new Date().toISOString().slice(0, 10),
    description: '',
    change_reason: 'Creación y registro formal del formato en el listado maestro del SIG.',
  });

  // Estados de archivos adjuntos para plantillas
  const [bumpFile, setBumpFile] = useState<File | null>(null);
  const [newFormatFile, setNewFormatFile] = useState<File | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const uploadFileTemplate = async (file: File, code: string, version: string, formatId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('code', code);
    fd.append('version', version);
    if (formatId) fd.append('format_id', formatId);

    const res = await fetch('/api/tools/version-control/upload-template', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al subir archivo de formato');
    }
    return data as { url: string; file_format: string; editable_type: string };
  };

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Consulta de datos al backend
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['version-control-data', selectedProcess, selectedStatus, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProcess !== 'all') params.set('process', selectedProcess);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/tools/version-control?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar control de versiones');
      return res.json() as Promise<{
        data: DocumentFormatItem[];
        processes: string[];
        stats: {
          total_formats: number;
          active_formats: number;
          total_versions_tracked: number;
          processes_count: number;
          updated_2026_count: number;
        };
      }>;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const formats = responseData?.data ?? [];
  const processes = responseData?.processes ?? [];
  const stats = responseData?.stats ?? {
    total_formats: 0,
    active_formats: 0,
    total_versions_tracked: 0,
    processes_count: 0,
    updated_2026_count: 0,
  };

  // Mutación para incrementar versión
  const bumpVersionMutation = useMutation({
    mutationFn: async (payload: {
      format_id: string;
      new_version: string;
      change_date: string;
      change_reason: string;
      responsible_name: string;
      file_format: string;
      file_url?: string | null;
    }) => {
      const res = await fetch('/api/tools/version-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bump_version', ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar versión');
      return data;
    },
    onSuccess: (data) => {
      setActionFeedback({ type: 'success', message: data.message || 'Versión actualizada exitosamente.' });
      queryClient.invalidateQueries({ queryKey: ['version-control-data'] });
      setIsBumpModalOpen(false);
      setSelectedFormatToBump(null);
      setBumpFile(null);
      setBumpForm({
        new_version: '',
        change_date: new Date().toISOString().slice(0, 10),
        change_reason: '',
        responsible_name: '',
        file_format: 'xlsx',
      });
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: err.message });
      setTimeout(() => setActionFeedback(null), 5000);
    },
  });

  // Mutación para crear nuevo formato
  const createFormatMutation = useMutation({
    mutationFn: async (payload: typeof newFormatForm & { file_url?: string | null; file_format?: string }) => {
      const rolesArray = payload.is_universal
        ? ['Todos los Roles']
        : payload.roles_access_raw.split(',').map((r) => r.trim()).filter(Boolean);

      const res = await fetch('/api/tools/version-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_format',
          code: payload.code,
          name: payload.name,
          process: payload.process,
          form_slug: payload.form_slug || null,
          roles_access: rolesArray,
          is_universal: payload.is_universal,
          current_version: payload.current_version,
          effective_date: payload.effective_date,
          description: payload.description,
          change_reason: payload.change_reason,
          file_url: payload.file_url || null,
          file_format: payload.file_format || 'xlsx',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar formato');
      return data;
    },
    onSuccess: (data) => {
      setActionFeedback({ type: 'success', message: data.message || 'Formato registrado en listado maestro.' });
      queryClient.invalidateQueries({ queryKey: ['version-control-data'] });
      setIsNewFormatModalOpen(false);
      setNewFormatFile(null);
      setNewFormatForm({
        code: '',
        name: '',
        process: 'HSEQ & SIG',
        form_slug: '',
        roles_access_raw: 'Todos los Roles',
        is_universal: true,
        current_version: '1',
        effective_date: new Date().toISOString().slice(0, 10),
        description: '',
        change_reason: 'Creación y registro formal del formato en el listado maestro del SIG.',
      });
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: err.message });
      setTimeout(() => setActionFeedback(null), 5000);
    },
  });

  // Mutación para editar formato
  const editFormatMutation = useMutation({
    mutationFn: async (payload: typeof editForm & { file_url?: string | null; file_format?: string }) => {
      const rolesArray = payload.is_universal
        ? ['Todos los Roles']
        : payload.roles_access_raw.split(',').map((r) => r.trim()).filter(Boolean);

      const res = await fetch('/api/tools/version-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_format',
          id: payload.id,
          code: payload.code,
          name: payload.name,
          process: payload.process,
          form_slug: payload.form_slug || null,
          roles_access: rolesArray,
          is_universal: payload.is_universal,
          current_version: payload.current_version,
          effective_date: payload.effective_date,
          status: payload.status,
          description: payload.description,
          change_reason: payload.change_reason,
          file_url: payload.file_url,
          file_format: payload.file_format,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al modificar formato');
      return data;
    },
    onSuccess: (data) => {
      setActionFeedback({ type: 'success', message: data.message || 'Formato modificado correctamente.' });
      queryClient.invalidateQueries({ queryKey: ['version-control-data'] });
      queryClient.invalidateQueries({ queryKey: ['active-format-version'] });
      setIsEditModalOpen(false);
      setSelectedFormatToEdit(null);
      setEditFile(null);
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: err.message });
      setTimeout(() => setActionFeedback(null), 5000);
    },
  });


  // Mutación para sincronizar catálogo maestro a PostgreSQL
  const seedMasterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools/version-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_master_formats' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar catálogo maestro');
      return data;
    },
    onSuccess: (data) => {
      setActionFeedback({ type: 'success', message: data.message || 'Catálogo maestro sincronizado exitosamente.' });
      queryClient.invalidateQueries({ queryKey: ['version-control-data'] });
      queryClient.invalidateQueries({ queryKey: ['active-format-version'] });
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: err.message });
      setTimeout(() => setActionFeedback(null), 5000);
    },
  });

  const handleOpenEditModal = (fmt: DocumentFormatItem) => {
    setSelectedFormatToEdit(fmt);
    setEditForm({
      id: fmt.id,
      code: fmt.code,
      name: fmt.name,
      process: fmt.process,
      form_slug: fmt.form_slug || '',
      roles_access_raw: fmt.is_universal ? 'Todos los Roles' : fmt.roles_access.join(', '),
      is_universal: fmt.is_universal,
      current_version: fmt.current_version,
      effective_date: fmt.effective_date,
      status: fmt.status,
      description: fmt.description || '',
      change_reason: '',
    });
    setEditFile(null);
    setIsEditModalOpen(true);
  };

  const handleOpenBumpModal = (fmt: DocumentFormatItem) => {
    setSelectedFormatToBump(fmt);
    setBumpFile(null);
    const currentNum = parseInt(fmt.current_version, 10);
    const nextVer = isNaN(currentNum) ? `${fmt.current_version}.1` : String(currentNum + 1);
    setBumpForm({
      new_version: nextVer,
      change_date: new Date().toISOString().slice(0, 10),
      change_reason: '',
      responsible_name: '',
      file_format: fmt.editable_type || 'xlsx',
    });
    setIsBumpModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedProcess('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = Boolean(search.trim()) || selectedProcess !== 'all' || selectedStatus !== 'all';

  return (
    <div className="space-y-6">
      {/* ─── FEEDBACK TOAST / ALERTA DE ACCIÓN ─── */}
      {actionFeedback && (
        <div
          className={`card p-4 border flex items-center justify-between animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.75} />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" strokeWidth={1.75} />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-text-muted hover:text-text-primary p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 1. KPIS DEL LISTADO MAESTRO ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Formatos en Control</span>
            <FileCheck className="w-4 h-4 text-primary-700" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.total_formats}
          </p>
          <p className="text-xs text-text-muted mt-1">100% catalogados en listado maestro</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Versiones Trazadas</span>
            <History className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.total_versions_tracked}
          </p>
          <p className="text-xs text-text-muted mt-1">Historial y control de cambios</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Procesos SIG Cubiertos</span>
            <FolderTree className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.processes_count}
          </p>
          <p className="text-xs text-text-muted mt-1">Áreas operativas y de soporte</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Actualizados 2026</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.updated_2026_count}
          </p>
          <p className="text-xs text-text-muted mt-1">Conforme a norma ISO 9001/45001</p>
        </div>
      </div>

      {/* ─── 2. BARRA DE ACCIONES Y BOTONES DE EXPORTACIÓN ─── */}
      <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Exportar Listado Maestro:</span>
          <a
            href="/api/tools/version-control/export?format=xlsx"
            download
            className="btn btn-secondary text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
            title="Descargar matriz completa en Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
            Descargar Excel (.xlsx)
          </a>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => seedMasterMutation.mutate()}
            disabled={seedMasterMutation.isPending}
            className="btn btn-secondary text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5 hover:border-accent transition-colors"
            title="Sincronizar el catálogo maestro oficial completo en PostgreSQL"
          >
            <Database className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            <span>{seedMasterMutation.isPending ? 'Sincronizando...' : 'Sincronizar a BD'}</span>
          </button>
          <button
            onClick={() => setIsNewFormatModalOpen(true)}
            className="btn btn-accent text-xs font-bold py-1.5 px-3.5 flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-primary-900" strokeWidth={2} />
            <span>Registrar Nuevo Formato</span>
          </button>
        </div>
      </div>

      {/* ─── 3. BARRA DE BÚSQUEDA Y FILTROS TÉCNICOS ─── */}
      <div className="card p-4 border border-border bg-white shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Buscador */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código (FOR-...), nombre, proceso o rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Filtro por Proceso */}
          <div className="md:col-span-4">
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">Todos los Procesos / Áreas ({formats.length})</option>
              {processes.map((proc) => (
                <option key={proc} value={proc}>
                  {proc}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Solo Vigentes</option>
              <option value="obsolete">Obsoletos</option>
            </select>
          </div>

          {/* Botón Reset */}
          <div className="md:col-span-1 flex justify-end">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1 w-full text-text-muted hover:text-text-primary"
                title="Limpiar filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4. TABLA MAESTRA DE CONTROL DE VERSIONES ─── */}
      <div className="card border border-border bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" strokeWidth={1.75} />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Listado Maestro de Documentos Oficiales
            </h2>
          </div>
          <span className="text-xs font-mono font-medium text-text-muted">
            Mostrando {formats.length} formatos
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-text-muted font-medium">Cargando listado maestro de versiones...</p>
          </div>
        ) : formats.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-accent/60 mx-auto" />
            <p className="text-sm font-bold text-text-primary">No hay formatos registrados en el listado maestro</p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              La base de datos está lista para gestionar tus formatos oficiales. Puedes registrar el primer formato haciendo clic en el botón a continuación.
            </p>
            <button
              onClick={() => setIsNewFormatModalOpen(true)}
              className="btn btn-accent text-xs font-bold py-2 px-4 inline-flex items-center gap-1.5 mx-auto"
            >
              <PlusCircle className="w-4 h-4 text-primary-900" />
              <span>Registrar Nuevo Formato</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface/80 border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Código Oficial</th>
                  <th className="py-3 px-4">Nombre del Formato / Propósito</th>
                  <th className="py-3 px-4">Proceso SIG</th>
                  <th className="py-3 px-4">Roles con Acceso</th>
                  <th className="py-3 px-4 text-center">Versión Vigente</th>
                  <th className="py-3 px-4 text-center">Fecha Versión</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {formats.map((fmt) => (
                  <tr key={fmt.id || fmt.code} className="hover:bg-surface/50 transition-colors">
                    {/* Código Oficial */}
                    <td className="py-3 px-4 align-top">
                      <span className="font-mono font-bold text-primary-950 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded text-[11px] inline-block">
                        {fmt.code}
                      </span>
                      {fmt.form_slug && (
                        <div className="mt-1">
                          <Link
                            href={fmt.form_slug.startsWith('tools/') ? `/${fmt.form_slug}` : `/forms/${fmt.form_slug}`}
                            prefetch={false}
                            className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                          >
                            <span>Diligenciar en vivo</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )}
                    </td>

                    {/* Nombre y Descripción */}
                    <td className="py-3 px-4 align-top max-w-xs sm:max-w-md">
                      <p className="font-semibold text-text-primary text-sm">{fmt.name}</p>
                      {fmt.description && (
                        <p className="text-text-muted text-xs mt-0.5 line-clamp-2 leading-relaxed">
                          {fmt.description}
                        </p>
                      )}
                    </td>

                    {/* Proceso SIG */}
                    <td className="py-3 px-4 align-top">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {fmt.process}
                      </span>
                    </td>

                    {/* Roles con Acceso */}
                    <td className="py-3 px-4 align-top">
                      {fmt.is_universal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Users className="w-3 h-3" />
                          Todos los Roles
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {fmt.roles_access.map((role) => (
                            <span
                              key={role}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Versión Vigente */}
                    <td className="py-3 px-4 align-top text-center">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary-900 text-white">
                        v{fmt.current_version}
                      </span>
                      {fmt.versions_count > 1 && (
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {fmt.versions_count} versiones
                        </div>
                      )}
                    </td>

                    {/* Fecha de Vigencia */}
                    <td className="py-3 px-4 align-top text-center font-mono text-text-secondary whitespace-nowrap">
                      {fmt.effective_date}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end flex-wrap gap-1.5">
                        {/* Descargar Formato Editable Principal */}
                        <a
                          href={fmt.download_template_url || `/api/tools/version-control/download-template?code=${fmt.code}&format=editable&version=${fmt.current_version}`}
                          download
                          className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-emerald-500 hover:text-emerald-800 transition-colors"
                          title={`Descargar plantilla editable vigente (${fmt.editable_type ? fmt.editable_type.toUpperCase() : 'XLSX'})`}
                        >
                          {fmt.editable_type === 'docx' ? (
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                          ) : fmt.editable_type === 'pptx' ? (
                            <Layers className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>
                            {fmt.editable_type === 'docx'
                              ? 'Word (.docx)'
                              : fmt.editable_type === 'pptx'
                              ? 'PowerPoint (.pptx)'
                              : 'Excel (.xlsx)'}
                          </span>
                        </a>

                        {/* Opción adicional PowerPoint si aplica */}
                        {fmt.has_pptx && fmt.editable_type !== 'pptx' && (
                          <a
                            href={`/api/tools/version-control/download-template?code=${fmt.code}&format=pptx&version=${fmt.current_version}`}
                            download
                            className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-amber-500 hover:text-amber-800 transition-colors"
                            title="Descargar láminas editables en PowerPoint (.pptx)"
                          >
                            <Layers className="w-3.5 h-3.5 text-accent" />
                            <span>PowerPoint (.pptx)</span>
                          </a>
                        )}

                        {/* Opción adicional Excel si aplica */}
                        {fmt.has_xlsx && fmt.editable_type !== 'xlsx' && (
                          <a
                            href={`/api/tools/version-control/download-template?code=${fmt.code}&format=xlsx&version=${fmt.current_version}`}
                            download
                            className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-emerald-500 hover:text-emerald-800 transition-colors"
                            title="Descargar formato editable en Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Excel (.xlsx)</span>
                          </a>
                        )}

                        {/* Ver Historial de Versiones */}
                        <button
                          onClick={() => setHistoryModalFormat(fmt)}
                          className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-text-secondary hover:text-text-primary"
                          title="Ver control de cambios y versiones anteriores"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Historial</span>
                        </button>

                        {/* Nueva Versión */}
                        <button
                          onClick={() => handleOpenBumpModal(fmt)}
                          className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-text-primary hover:border-accent"
                          title="Incrementar versión por modificación del formato"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-primary-700" />
                          <span>Nueva Versión</span>
                        </button>

                        {/* Editar Formato */}
                        <button
                          onClick={() => handleOpenEditModal(fmt)}
                          className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-text-primary hover:border-accent hover:text-amber-900 transition-colors"
                          title="Modificar datos, código, versión o formulario relacionado"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
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

      {/* ─── 5. MODAL DE HISTORIAL DE VERSIONES ─── */}
      {historyModalFormat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card bg-white border border-border w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Historial de Versiones y Control de Cambios
                  </h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">
                    {historyModalFormat.code} — {historyModalFormat.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalFormat(null)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="bg-surface/70 p-3 rounded-lg border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-text-muted">Proceso:</span>{' '}
                  <strong className="text-text-primary">{historyModalFormat.process}</strong>
                </div>
                <div>
                  <span className="text-text-muted">Versión Vigente:</span>{' '}
                  <strong className="font-mono text-accent">v{historyModalFormat.current_version}</strong>
                </div>
                <div>
                  <span className="text-text-muted">Fecha Vigencia:</span>{' '}
                  <strong className="font-mono text-text-primary">{historyModalFormat.effective_date}</strong>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Línea de Tiempo de Modificaciones
                </h4>

                {historyModalFormat.history && historyModalFormat.history.length > 0 ? (
                  <div className="space-y-3">
                    {historyModalFormat.history.map((ver, idx) => (
                      <div
                        key={ver.id || idx}
                        className="p-4 rounded-lg border border-border bg-white shadow-xs hover:border-accent/40 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary-900 text-white">
                              Versión {ver.version}
                            </span>
                            {ver.version === historyModalFormat.current_version && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                VIGENTE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Si la versión tiene un archivo adjunto subido */}
                            {ver.file_url ? (
                              <a
                                href={ver.file_url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-emerald-500 hover:text-emerald-800 font-semibold"
                                title={`Descargar archivo editable adjunto versión ${ver.version}`}
                              >
                                {ver.file_format === 'docx' || ver.file_format === 'doc' ? (
                                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                                ) : ver.file_format === 'pptx' || ver.file_format === 'ppt' ? (
                                  <Layers className="w-3.5 h-3.5 text-accent" />
                                ) : (
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                <span>Descargar {ver.file_format ? ver.file_format.toUpperCase() : 'Plantilla'} v{ver.version}</span>
                              </a>
                            ) : (
                              <>
                                {/* Descarga editable para la versión histórica */}
                                {(historyModalFormat.editable_type === 'xlsx' || historyModalFormat.has_xlsx) && (
                                  <a
                                    href={`/api/tools/version-control/download-template?code=${historyModalFormat.code}&format=xlsx&version=${ver.version}`}
                                    download
                                    className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 hover:border-emerald-500 hover:text-emerald-800"
                                    title={`Descargar formato editable en Excel versión ${ver.version}`}
                                  >
                                    <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                    <span>Excel v{ver.version}</span>
                                  </a>
                                )}
                                {historyModalFormat.editable_type === 'docx' && (
                                  <a
                                    href={`/api/tools/version-control/download-template?code=${historyModalFormat.code}&format=docx&version=${ver.version}`}
                                    download
                                    className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 hover:border-blue-500 hover:text-blue-800"
                                    title={`Descargar formato editable en Word versión ${ver.version}`}
                                  >
                                    <FileText className="w-3 h-3 text-blue-600" />
                                    <span>Word v{ver.version}</span>
                                  </a>
                                )}
                                {(historyModalFormat.has_pptx || historyModalFormat.editable_type === 'pptx') && (
                                  <a
                                    href={`/api/tools/version-control/download-template?code=${historyModalFormat.code}&format=pptx&version=${ver.version}`}
                                    download
                                    className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1 hover:border-amber-500 hover:text-amber-800"
                                    title={`Descargar PowerPoint versión ${ver.version}`}
                                  >
                                    <Layers className="w-3 h-3 text-accent" />
                                    <span>PPTX v{ver.version}</span>
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-text-primary font-medium">
                          Motivo de Modificación / Control de Cambios:
                        </p>
                        <p className="text-xs text-text-secondary mt-1 bg-surface/50 p-2.5 rounded border border-border leading-relaxed">
                          {ver.change_reason}
                        </p>

                        <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1">
                          <span>Responsable de la elaboración / aprobación:</span>
                          <strong className="text-text-primary">{ver.responsible_name}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    No se registra historial detallado para versiones preliminares.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-surface/30">
              <button
                onClick={() => {
                  const targetFmt = historyModalFormat;
                  setHistoryModalFormat(null);
                  handleOpenBumpModal(targetFmt);
                }}
                className="btn btn-accent text-xs font-bold py-1.5 px-3 flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4 text-primary-900" />
                <span>Registrar Nueva Versión</span>
              </button>
              <button
                onClick={() => setHistoryModalFormat(null)}
                className="btn btn-secondary text-xs font-semibold py-1.5 px-4"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. MODAL PARA INCREMENTAR VERSIÓN ─── */}
      {isBumpModalOpen && selectedFormatToBump && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card bg-white border border-border w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Registrar Nueva Versión de Formato
                  </h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">
                    {selectedFormatToBump.code} — {selectedFormatToBump.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBumpModalOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedFormatToBump) return;
                try {
                  setIsUploadingFile(true);
                  let fileUrl: string | null = null;
                  let fileFormat = bumpForm.file_format || 'xlsx';

                  if (bumpFile) {
                    const upData = await uploadFileTemplate(
                      bumpFile,
                      selectedFormatToBump.code,
                      bumpForm.new_version,
                      selectedFormatToBump.id
                    );
                    fileUrl = upData.url;
                    fileFormat = upData.file_format;
                  }

                  await bumpVersionMutation.mutateAsync({
                    format_id: selectedFormatToBump.id,
                    new_version: bumpForm.new_version,
                    change_date: bumpForm.change_date,
                    change_reason: bumpForm.change_reason,
                    responsible_name: bumpForm.responsible_name,
                    file_format: fileFormat,
                    file_url: fileUrl,
                  });
                } catch (err: unknown) {
                  setActionFeedback({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Error al registrar nueva versión',
                  });
                } finally {
                  setIsUploadingFile(false);
                }
              }}
              className="p-4 sm:p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted font-semibold mb-1">
                    Versión Actual
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`Versión ${selectedFormatToBump.current_version}`}
                    className="w-full p-2 bg-surface border border-border rounded text-text-muted font-mono"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Nueva Versión Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={bumpForm.new_version}
                    onChange={(e) => setBumpForm({ ...bumpForm, new_version: e.target.value })}
                    placeholder="Ej: 3 o 02"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Fecha de Entrada en Vigencia *
                  </label>
                  <input
                    type="date"
                    required
                    value={bumpForm.change_date}
                    onChange={(e) => setBumpForm({ ...bumpForm, change_date: e.target.value })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Responsable de Elaboración / HSEQ *
                  </label>
                  <input
                    type="text"
                    required
                    value={bumpForm.responsible_name}
                    onChange={(e) => setBumpForm({ ...bumpForm, responsible_name: e.target.value })}
                    placeholder="Nombre o cargo responsable"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Motivo de la Modificación / Control de Cambios *
                </label>
                <textarea
                  required
                  rows={3}
                  value={bumpForm.change_reason}
                  onChange={(e) => setBumpForm({ ...bumpForm, change_reason: e.target.value })}
                  placeholder="Detalla de forma técnica qué se agregó, modificó o eliminó en el formato respecto a la versión anterior..."
                  className="w-full p-2.5 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent leading-relaxed"
                />
              </div>

              {/* Adjuntar Formato Editable con Campos Llenables */}
              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Adjuntar Formato Editable Oficial (Campos Llenables)
                </label>
                <div className="border border-dashed border-border rounded-lg p-3 bg-surface/40 hover:border-accent transition-colors">
                  <input
                    type="file"
                    id="bump-file-input"
                    accept=".xlsx,.xls,.docx,.doc,.pptx,.ppt,.xlsm"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setBumpFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {bumpFile ? (
                    <div className="flex items-center justify-between p-2.5 bg-white rounded border border-border shadow-xs">
                      <div className="flex items-center gap-2 overflow-hidden text-left">
                        {bumpFile.name.endsWith('.docx') || bumpFile.name.endsWith('.doc') ? (
                          <FileText className="w-5 h-5 text-blue-600 shrink-0" strokeWidth={1.75} />
                        ) : bumpFile.name.endsWith('.pptx') || bumpFile.name.endsWith('.ppt') ? (
                          <Layers className="w-5 h-5 text-accent shrink-0" strokeWidth={1.75} />
                        ) : (
                          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                        )}
                        <div className="truncate">
                          <p className="font-semibold text-text-primary truncate">{bumpFile.name}</p>
                          <p className="text-[10px] text-text-muted">
                            {(bumpFile.size / 1024).toFixed(1)} KB • Archivo con campos llenables listo para importar
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBumpFile(null)}
                        className="text-text-muted hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Quitar archivo adjunto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="bump-file-input"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-3 text-text-muted hover:text-text-primary group"
                    >
                      <div className="p-2 bg-amber-50 rounded-full text-accent group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <p className="text-xs font-semibold text-text-primary">
                        Haz clic aquí para seleccionar o importar la plantilla con campos llenables
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Formatos editables admitidos: Excel (.xlsx), Word (.docx) o PowerPoint (.pptx)
                      </p>
                    </label>
                  )}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Al confirmar, el listado maestro actualizará la versión vigente del formato a{' '}
                  <strong>v{bumpForm.new_version || '?'}</strong> con fecha{' '}
                  <strong>{bumpForm.change_date}</strong> y registrará la auditoría en el historial.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBumpModalOpen(false)}
                  className="btn btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bumpVersionMutation.isPending || isUploadingFile}
                  className="btn btn-accent py-1.5 px-4 text-xs font-bold text-primary-900"
                >
                  {isUploadingFile
                    ? 'Subiendo archivo...'
                    : bumpVersionMutation.isPending
                    ? 'Guardando...'
                    : 'Confirmar Nueva Versión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7. MODAL PARA REGISTRAR NUEVO FORMATO ─── */}
      {isNewFormatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card bg-white border border-border w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Registrar Nuevo Formato en el SIG
                  </h3>
                  <p className="text-xs text-text-muted">
                    Incorporar un nuevo documento formal al Listado Maestro
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewFormatModalOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsUploadingFile(true);
                  let fileUrl: string | null = null;
                  let fileFormat = 'xlsx';

                  if (newFormatFile) {
                    const upData = await uploadFileTemplate(
                      newFormatFile,
                      newFormatForm.code,
                      newFormatForm.current_version
                    );
                    fileUrl = upData.url;
                    fileFormat = upData.file_format;
                  }

                  await createFormatMutation.mutateAsync({
                    ...newFormatForm,
                    file_url: fileUrl,
                    file_format: fileFormat,
                  });
                } catch (err: unknown) {
                  setActionFeedback({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Error al registrar formato',
                  });
                } finally {
                  setIsUploadingFile(false);
                }
              }}
              className="p-4 sm:p-5 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Código Oficial del Formato *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFormatForm.code}
                    onChange={(e) => setNewFormatForm({ ...newFormatForm, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: FOR-HSEQ-030"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent uppercase"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Versión Inicial *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFormatForm.current_version}
                    onChange={(e) => setNewFormatForm({ ...newFormatForm, current_version: e.target.value })}
                    placeholder="1"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Nombre Completo del Formato / Documento *
                </label>
                <input
                  type="text"
                  required
                  value={newFormatForm.name}
                  onChange={(e) => setNewFormatForm({ ...newFormatForm, name: e.target.value })}
                  placeholder="Ej: Inspección de Equipos de Protección Contra Caídas"
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Proceso / Área del SIG *
                  </label>
                  <select
                    value={newFormatForm.process}
                    onChange={(e) => setNewFormatForm({ ...newFormatForm, process: e.target.value })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                  >
                    <option value="HSEQ & SIG">HSEQ & SIG</option>
                    <option value="Operaciones GPR / Geofísica">Operaciones GPR / Geofísica</option>
                    <option value="Ingeniería y Dibujo CAD/BIM">Ingeniería y Dibujo CAD/BIM</option>
                    <option value="Almacén y Logística">Almacén y Logística</option>
                    <option value="Compras y Adquisiciones">Compras y Adquisiciones</option>
                    <option value="Gestión Comercial">Gestión Comercial</option>
                    <option value="Finanzas y Tesorería">Finanzas y Tesorería</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Gestión del Talento Humano">Gestión del Talento Humano</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Fecha de Entrada en Vigencia *
                  </label>
                  <input
                    type="date"
                    required
                    value={newFormatForm.effective_date}
                    onChange={(e) => setNewFormatForm({ ...newFormatForm, effective_date: e.target.value })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Formulario Relacionado */}
              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Formulario Relacionado en PCM CLOUD (Opcional)
                </label>
                <select
                  value={newFormatForm.form_slug}
                  onChange={(e) => setNewFormatForm({ ...newFormatForm, form_slug: e.target.value })}
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                >
                  {COMMON_SYSTEM_FORMS.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-text-muted mt-1">
                  Permite que el formulario web opere bajo esta versión automáticamente.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-text-primary font-semibold">
                    Roles con Acceso Autorizado
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-text-muted">
                    <input
                      type="checkbox"
                      checked={newFormatForm.is_universal}
                      onChange={(e) =>
                        setNewFormatForm({
                          ...newFormatForm,
                          is_universal: e.target.checked,
                          roles_access_raw: e.target.checked ? 'Todos los Roles' : 'HSEQ, Admin',
                        })
                      }
                      className="rounded text-accent focus:ring-accent"
                    />
                    <span>Aplica a Todos (Universal)</span>
                  </label>
                </div>
                {!newFormatForm.is_universal && (
                  <input
                    type="text"
                    value={newFormatForm.roles_access_raw}
                    onChange={(e) => setNewFormatForm({ ...newFormatForm, roles_access_raw: e.target.value })}
                    placeholder="Ej: HSEQ, Localizador, Admin (separados por coma)"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                  />
                )}
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Descripción y Alcance del Documento
                </label>
                <textarea
                  rows={2}
                  value={newFormatForm.description}
                  onChange={(e) => setNewFormatForm({ ...newFormatForm, description: e.target.value })}
                  placeholder="Explica brevemente para qué sirve y en qué frente se aplica..."
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Adjuntar Formato Editable Oficial */}
              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Plantilla / Formato Editable Oficial (Excel, Word, PowerPoint)
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-3 bg-surface/40 hover:bg-surface/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-accent shrink-0" strokeWidth={1.75} />
                      <div className="text-[11px]">
                        <span className="font-semibold text-text-primary">
                          {newFormatFile ? newFormatFile.name : 'Seleccionar archivo editable con campos llenables'}
                        </span>
                        <p className="text-text-muted text-[10px]">
                          Formatos aceptados: .xlsx, .xlsm, .docx, .pptx (Máx. 50MB)
                        </p>
                      </div>
                    </div>
                    <label className="btn btn-secondary text-xs py-1 px-3 cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      <span>{newFormatFile ? 'Cambiar Archivo' : 'Examinar'}</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,.docx,.doc,.pptx,.ppt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNewFormatFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {newFormatFile && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Tamaño: {(newFormatFile.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => setNewFormatFile(null)}
                        className="text-red-600 hover:underline"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewFormatModalOpen(false)}
                  className="btn btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createFormatMutation.isPending || isUploadingFile}
                  className="btn btn-accent py-1.5 px-4 text-xs font-bold text-primary-900"
                >
                  {isUploadingFile ? 'Subiendo plantilla...' : createFormatMutation.isPending ? 'Registrando...' : 'Registrar Formato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 8. MODAL PARA EDITAR FORMATO EXISTENTE ─── */}
      {isEditModalOpen && selectedFormatToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card bg-white border border-border w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Modificar Formato ({editForm.code})
                  </h3>
                  <p className="text-xs text-text-muted">
                    Actualizar metadatos, versión vigente o formulario enlazado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsUploadingFile(true);
                  let fileUrl = selectedFormatToEdit?.download_template_url || null;
                  let fileFormat: string = selectedFormatToEdit?.editable_type || 'xlsx';

                  if (editFile) {
                    const upData = await uploadFileTemplate(
                      editFile,
                      editForm.code,
                      editForm.current_version,
                      editForm.id
                    );
                    fileUrl = upData.url;
                    fileFormat = upData.file_format;
                  }

                  await editFormatMutation.mutateAsync({
                    ...editForm,
                    file_url: fileUrl,
                    file_format: fileFormat,
                  });
                } catch (err: unknown) {
                  setActionFeedback({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Error al modificar formato',
                  });
                } finally {
                  setIsUploadingFile(false);
                }
              }}
              className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Código Oficial del Formato *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: FOR-HSEQ-024"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent uppercase"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Versión Vigente *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.current_version}
                    onChange={(e) => setEditForm({ ...editForm, current_version: e.target.value })}
                    placeholder="Ej: 2"
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Nombre Completo del Formato *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nombre técnico del formato"
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Proceso / Área del SIG *
                  </label>
                  <select
                    value={editForm.process}
                    onChange={(e) => setEditForm({ ...editForm, process: e.target.value })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                  >
                    <option value="HSEQ & SIG">HSEQ & SIG</option>
                    <option value="Operaciones GPR / Geofísica">Operaciones GPR / Geofísica</option>
                    <option value="Ingeniería y Dibujo CAD/BIM">Ingeniería y Dibujo CAD/BIM</option>
                    <option value="Almacén y Logística">Almacén y Logística</option>
                    <option value="Compras y Adquisiciones">Compras y Adquisiciones</option>
                    <option value="Gestión Comercial">Gestión Comercial</option>
                    <option value="Finanzas y Tesorería">Finanzas y Tesorería</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Gestión del Talento Humano">Gestión del Talento Humano</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Fecha de Entrada en Vigencia *
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.effective_date}
                    onChange={(e) => setEditForm({ ...editForm, effective_date: e.target.value })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary font-mono focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Formulario Relacionado en PCM CLOUD */}
              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Formulario Relacionado en la Plataforma
                </label>
                <select
                  value={editForm.form_slug}
                  onChange={(e) => setEditForm({ ...editForm, form_slug: e.target.value })}
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                >
                  {COMMON_SYSTEM_FORMS.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-text-muted mt-1">
                  Vincula este formato con su vista web para que opere bajo esta versión automáticamente.
                </p>
              </div>

              {/* Estado y Roles */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-primary font-semibold mb-1">
                    Estado del Documento
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'obsolete' | 'draft' })}
                    className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                  >
                    <option value="active">Activo / Vigente</option>
                    <option value="draft">Borrador</option>
                    <option value="obsolete">Obsoleto</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-text-primary font-semibold">
                      Roles con Acceso
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-text-muted">
                      <input
                        type="checkbox"
                        checked={editForm.is_universal}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            is_universal: e.target.checked,
                            roles_access_raw: e.target.checked ? 'Todos los Roles' : 'HSEQ, Admin',
                          })
                        }
                        className="rounded text-accent focus:ring-accent"
                      />
                      <span>Universal</span>
                    </label>
                  </div>
                  {!editForm.is_universal && (
                    <input
                      type="text"
                      value={editForm.roles_access_raw}
                      onChange={(e) => setEditForm({ ...editForm, roles_access_raw: e.target.value })}
                      placeholder="HSEQ, Localizador, Admin"
                      className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Descripción y Alcance
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Propósito del formato..."
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Justificación Técnica / Control de Cambios
                </label>
                <textarea
                  rows={2}
                  value={editForm.change_reason}
                  onChange={(e) => setEditForm({ ...editForm, change_reason: e.target.value })}
                  placeholder="Si modificaste la versión o campos, indica qué cambió para el historial..."
                  className="w-full p-2 bg-white border border-border rounded text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Actualizar Plantilla / Formato Editable */}
              <div>
                <label className="block text-text-primary font-semibold mb-1">
                  Plantilla / Formato Editable Oficial (Excel, Word, PowerPoint)
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-3 bg-surface/40 hover:bg-surface/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-accent shrink-0" strokeWidth={1.75} />
                      <div className="text-[11px]">
                        <span className="font-semibold text-text-primary">
                          {editFile
                            ? editFile.name
                            : selectedFormatToEdit?.download_template_url
                            ? 'Plantilla personalizada actual registrada'
                            : 'Seleccionar archivo editable con campos llenables'}
                        </span>
                        <p className="text-text-muted text-[10px]">
                          Formatos aceptados: .xlsx, .xlsm, .docx, .pptx (Máx. 50MB)
                        </p>
                      </div>
                    </div>
                    <label className="btn btn-secondary text-xs py-1 px-3 cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      <span>{editFile ? 'Cambiar Archivo' : 'Examinar'}</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,.docx,.doc,.pptx,.ppt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setEditFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {editFile && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Tamaño: {(editFile.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => setEditFile(null)}
                        className="text-red-600 hover:underline"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editFormatMutation.isPending || isUploadingFile}
                  className="btn btn-accent py-1.5 px-4 text-xs font-bold text-primary-900"
                >
                  {isUploadingFile ? 'Subiendo plantilla...' : editFormatMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
