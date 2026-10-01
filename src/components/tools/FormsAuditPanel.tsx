'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
  Calendar,
  FolderGit2,
  User,
  ShieldCheck,
  X,
  FileCode,
  PenTool,
  Check,
  Radio,
  FileSignature,
  FileBadge,
} from 'lucide-react';
import type { FormAuditRecord, FormAuditFile, FormAuditSignature } from '@/app/api/tools/forms-audit/route';

interface FilterState {
  form_slug: string;
  project_id: string;
  user_id: string;
  status: string;
  date_from: string;
  date_to: string;
  has_files: string;
  search: string;
}

export function FormsAuditPanel() {
  const [filters, setFilters] = useState<FilterState>({
    form_slug: 'all',
    project_id: 'all',
    user_id: 'all',
    status: 'all',
    date_from: '',
    date_to: '',
    has_files: 'all',
    search: '',
  });

  const [selectedRecord, setSelectedRecord] = useState<FormAuditRecord | null>(null);
  const [modalTab, setModalTab] = useState<'files' | 'signatures' | 'metadata' | 'data'>('files');

  // Consulta al backend unificado de auditoría
  const { data: auditResponse, isLoading, refetch } = useQuery({
    queryKey: [
      'forms-audit-data',
      filters.form_slug,
      filters.project_id,
      filters.user_id,
      filters.status,
      filters.date_from,
      filters.date_to,
      filters.has_files,
      filters.search,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.form_slug !== 'all') params.set('form_slug', filters.form_slug);
      if (filters.project_id !== 'all') params.set('project_id', filters.project_id);
      if (filters.user_id !== 'all') params.set('user_id', filters.user_id);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.has_files !== 'all') params.set('has_files', filters.has_files);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/tools/forms-audit?${params.toString()}`);
      if (!res.ok) throw new Error('Error al consultar auditoría');
      return res.json() as Promise<{
        data: FormAuditRecord[];
        stats: {
          total_submissions: number;
          with_official_files: number;
          with_signatures: number;
          approved_or_issued: number;
          pending_review: number;
        };
        forms_catalog: { slug: string; name: string; category: string }[];
        projects_catalog: { id: string; code: string; name: string }[];
        users_catalog: { id: string; email: string; name: string }[];
      }>;
    },
  });

  const records = auditResponse?.data ?? [];
  const stats = auditResponse?.stats ?? {
    total_submissions: 0,
    with_official_files: 0,
    with_signatures: 0,
    approved_or_issued: 0,
    pending_review: 0,
  };
  const formsCatalog = auditResponse?.forms_catalog ?? [];
  const projectsCatalog = auditResponse?.projects_catalog ?? [];
  const usersCatalog = auditResponse?.users_catalog ?? [];

  const handleResetFilters = () => {
    setFilters({
      form_slug: 'all',
      project_id: 'all',
      user_id: 'all',
      status: 'all',
      date_from: '',
      date_to: '',
      has_files: 'all',
      search: '',
    });
  };

  const hasActiveFilters =
    filters.form_slug !== 'all' ||
    filters.project_id !== 'all' ||
    filters.user_id !== 'all' ||
    filters.status !== 'all' ||
    Boolean(filters.date_from) ||
    Boolean(filters.date_to) ||
    filters.has_files !== 'all' ||
    Boolean(filters.search);

  return (
    <div className="space-y-6">
      {/* ─── 1. KPIs CONSOLIDADOS DE FISCALIZACIÓN ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Formatos Registrados</span>
            <ClipboardCheck className="w-4 h-4 text-primary-700" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.total_submissions}
          </p>
          <p className="text-xs text-text-muted mt-1">Total de registros auditables</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Con Archivos Oficiales</span>
            <FileText className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.with_official_files}
          </p>
          <p className="text-xs text-text-muted mt-1">Con PDF o Excel generado</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Con Firmas Capturadas</span>
            <FileSignature className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.with_signatures}
          </p>
          <p className="text-xs text-text-muted mt-1">Firmados digitalmente en campo/oficina</p>
        </div>

        <div className="card p-4 sm:p-5 border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendientes de Aprobación</span>
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
            {stats.pending_review}
          </p>
          <p className="text-xs text-text-muted mt-1">Enviados o bajo revisión</p>
        </div>
      </div>

      {/* ─── 2. BARRA DE CONTROL Y FILTROS UNIVERSALES ─── */}
      <div className="card p-5 border border-border bg-white shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Filter className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Filtros de Trazabilidad Universal</h2>
              <p className="text-xs text-text-muted">
                Filtre por los campos que todos los formatos comparten en el sistema
              </p>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="btn-secondary text-xs py-1.5 px-3 self-start md:self-auto flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Fila 1: Búsqueda rápida de texto */}
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar por código (FOR-SIG-001, GPR...), responsable, proyecto o descripción..."
            className="input pl-10 text-xs sm:text-sm font-sans"
          />
        </div>

        {/* Fila 2: Selectores de Filtro Universal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Selector de Formulario */}
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Tipo de Formulario / Formato
            </label>
            <select
              value={filters.form_slug}
              onChange={(e) => setFilters({ ...filters, form_slug: e.target.value })}
              className="select text-xs py-2"
            >
              <option value="all">Todos los Formularios ({formsCatalog.length})</option>
              {formsCatalog.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Proyecto */}
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Proyecto Imputable
            </label>
            <select
              value={filters.project_id}
              onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
              className="select text-xs py-2"
            >
              <option value="all">Todos los Proyectos</option>
              {projectsCatalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Responsable */}
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Responsable / Diligenciador
            </label>
            <select
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              className="select text-xs py-2"
            >
              <option value="all">Todos los Colaboradores</option>
              {usersCatalog.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Estado */}
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Estado Operativo
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="select text-xs py-2"
            >
              <option value="all">Todos los Estados</option>
              <option value="submitted">Enviado (Submitted)</option>
              <option value="approved">Aprobado (Approved)</option>
              <option value="under_review">En Revisión (Under Review)</option>
              <option value="issued">Emitido (Issued)</option>
              <option value="pending">Pendiente (Pending)</option>
              <option value="closed">Cerrado (Closed)</option>
            </select>
          </div>
        </div>

        {/* Fila 3: Rango de Fechas y Filtro de Archivos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="input text-xs py-1.5 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="input text-xs py-1.5 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Archivos y Evidencias
            </label>
            <select
              value={filters.has_files}
              onChange={(e) => setFilters({ ...filters, has_files: e.target.value })}
              className="select text-xs py-2"
            >
              <option value="all">Todos los registros</option>
              <option value="yes">Con Archivos Oficiales (PDF/Excel)</option>
              <option value="signatures">Con Firmas Digitales</option>
              <option value="no">Sin Archivos Generados</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── 3. TABLA DE REGISTROS DE FORMULARIOS AUDITADOS ─── */}
      <div className="card overflow-hidden border border-border bg-white shadow-xs">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gray-50/70">
          <div>
            <h3 className="font-bold text-sm text-text-primary">Registros de Formularios Auditables</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Mostrando {records.length} registro{records.length !== 1 ? 's' : ''} ordenados cronológicamente
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-sm animate-pulse">
            Consultando registros en base de datos...
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ClipboardCheck className="w-12 h-12 text-text-muted mx-auto stroke-1" />
            <h4 className="font-bold text-text-primary text-base">No se encontraron registros de formularios</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              No hay formatos diligenciados que coincidan con los filtros seleccionados. Pruebe ampliando el rango de fechas o limpiando los filtros.
            </p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 mt-2">
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                Restablecer Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-border text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="py-3.5 px-4">Formulario y Código</th>
                  <th className="py-3.5 px-4">Proyecto</th>
                  <th className="py-3.5 px-4">Responsable</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Archivos y Firmas</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-primary-50/50 transition-colors">
                    {/* Formulario y Código */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-primary-100 text-primary-900 px-1.5 py-0.5 rounded font-bold">
                          {r.official_code}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary font-medium mt-0.5 max-w-[200px] truncate" title={r.form_name}>
                        {r.form_name}
                      </p>
                    </td>

                    {/* Proyecto */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold text-text-primary block">
                        {r.project_code}
                      </span>
                      <span className="text-[11px] text-text-muted truncate block max-w-[170px]" title={r.project_name}>
                        {r.project_name}
                      </span>
                    </td>

                    {/* Responsable */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-text-primary text-xs block">
                        {r.user_name}
                      </span>
                      <span className="text-[11px] text-text-muted font-mono truncate block max-w-[150px]">
                        {r.user_email}
                      </span>
                    </td>

                    {/* Fecha */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs text-text-primary font-medium">
                        {r.submission_date}
                      </span>
                    </td>

                    {/* Archivos y Firmas */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.files.length === 0 && r.signatures.length === 0 ? (
                          <span className="text-[11px] text-text-muted italic">Sin archivos</span>
                        ) : (
                          <>
                            {r.files.map((file) => (
                              <a
                                key={file.id}
                                href={file.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-accent/20 border border-border text-[11px] font-semibold text-text-primary transition-colors"
                                title={`Descargar ${file.name}`}
                              >
                                {file.type === 'pdf' ? (
                                  <FileText className="w-3 h-3 text-red-600" strokeWidth={1.75} />
                                ) : file.type === 'xlsx' ? (
                                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" strokeWidth={1.75} />
                                ) : (
                                  <ExternalLink className="w-3 h-3 text-accent" strokeWidth={1.75} />
                                )}
                                <span className="uppercase text-[10px]">{file.type}</span>
                              </a>
                            ))}

                            {r.signatures.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold"
                                title={`${r.signatures.length} firma(s) registrada(s)`}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" strokeWidth={1.75} />
                                {r.signatures.length} Firma{r.signatures.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          ['approved', 'issued', 'closed'].includes(r.status)
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ['rejected', 'lost'].includes(r.status)
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-amber-100 text-primary-950 border border-amber-200 font-bold'
                        }`}
                      >
                        {r.status_label}
                      </span>
                    </td>

                    {/* Acción Auditar */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedRecord(r);
                          setModalTab('files');
                        }}
                        className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                        Auditar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 4. MODAL DETALLADO DE AUDITORÍA Y ARCHIVOS ─── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-primary-900 font-bold">
                  <ClipboardCheck className="w-4 h-4 text-accent-700" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                    <span>{selectedRecord.form_name}</span>
                    <span className="font-mono text-xs bg-primary-100 text-primary-900 px-2 py-0.5 rounded font-bold">
                      {selectedRecord.official_code}
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">
                    ID Registro: {selectedRecord.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-gray-200 transition-colors"
                title="Cerrar auditoría"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Navegación del Modal */}
            <div className="flex items-center gap-1 px-6 border-b border-border bg-white text-xs font-semibold">
              <button
                onClick={() => setModalTab('files')}
                className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  modalTab === 'files'
                    ? 'border-accent text-primary-900'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <FileText className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Archivos Oficiales ({selectedRecord.files.length})
              </button>

              <button
                onClick={() => setModalTab('signatures')}
                className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  modalTab === 'signatures'
                    ? 'border-accent text-primary-900'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <FileSignature className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                Firmas Digitales ({selectedRecord.signatures.length})
              </button>

              <button
                onClick={() => setModalTab('metadata')}
                className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  modalTab === 'metadata'
                    ? 'border-accent text-primary-900'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-primary-700" strokeWidth={1.75} />
                Metadatos Universales
              </button>

              <button
                onClick={() => setModalTab('data')}
                className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
                  modalTab === 'data'
                    ? 'border-accent text-primary-900'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <FileCode className="w-4 h-4 text-slate-600" strokeWidth={1.75} />
                Datos Completos del Formato
              </button>
            </div>

            {/* Contenido Dinámico de la Pestaña */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* PESTAÑA 1: ARCHIVOS OFICIALES */}
              {modalTab === 'files' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-gray-50 border border-border rounded-xl">
                    <h4 className="text-xs font-bold text-text-primary mb-1">
                      Archivos Generados para Fiscalización
                    </h4>
                    <p className="text-xs text-text-muted">
                      Descargue o inspeccione los documentos oficiales creados automáticamente a partir de este formulario.
                    </p>
                  </div>

                  {selectedRecord.files.length === 0 ? (
                    <div className="text-center py-8 text-text-muted text-xs">
                      Este registro no posee archivos oficiales adjuntos o generados.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedRecord.files.map((file) => (
                        <div
                          key={file.id}
                          className="p-4 rounded-xl border border-border bg-white hover:border-accent transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                              {file.type === 'pdf' ? (
                                <FileText className="w-5 h-5 text-red-600" strokeWidth={1.75} />
                              ) : file.type === 'xlsx' ? (
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                              ) : (
                                <ExternalLink className="w-5 h-5 text-accent" strokeWidth={1.75} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-primary truncate" title={file.name}>
                                {file.name}
                              </p>
                              <span className="text-[10px] uppercase font-mono font-bold text-text-muted">
                                Formato: {file.type}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-border">
                            <a
                              href={file.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className={
                                file.is_official_generation
                                  ? 'btn-accent text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5'
                                  : 'btn-secondary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5'
                              }
                            >
                              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                              Descargar Documento
                            </a>
                            {file.view_url && (
                              <a
                                href={file.view_url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary text-xs py-1.5 px-2.5 flex items-center justify-center"
                                title="Ver en Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 2: FIRMAS DIGITALES */}
              {modalTab === 'signatures' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-gray-50 border border-border rounded-xl">
                    <h4 className="text-xs font-bold text-text-primary mb-1">
                      Registro de Firmas y Cadena de Custodia
                    </h4>
                    <p className="text-xs text-text-muted">
                      Evidencias biométricas capturadas en pantalla para validación y firma del documento.
                    </p>
                  </div>

                  {selectedRecord.signatures.length === 0 ? (
                    <div className="text-center py-8 text-text-muted text-xs">
                      Este registro no posee firmas digitales capturadas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedRecord.signatures.map((sig, idx) => (
                        <div key={idx} className="card p-4 border border-border bg-white rounded-xl space-y-3">
                          <div className="border-b border-border pb-2">
                            <span className="text-[10px] font-bold uppercase text-accent-700 tracking-wider">
                              {sig.role_title}
                            </span>
                            <p className="text-xs font-bold text-text-primary mt-0.5">{sig.signee_name}</p>
                            {sig.signee_position && (
                              <p className="text-[11px] text-text-muted">{sig.signee_position}</p>
                            )}
                            {sig.signee_process && (
                              <p className="text-[10px] text-text-muted">Proceso: {sig.signee_process}</p>
                            )}
                          </div>

                          {/* Canvas de firma */}
                          <div className="bg-gray-50 border border-border rounded-lg p-2 flex items-center justify-center min-h-[100px]">
                            {sig.signature_data.startsWith('data:image') || sig.signature_data.startsWith('http') ? (
                              <img
                                src={sig.signature_data}
                                alt={`Firma de ${sig.signee_name}`}
                                className="max-h-24 max-w-full object-contain"
                              />
                            ) : (
                              <span className="text-xs text-text-muted italic">Firma en formato texto / token</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 3: METADATOS UNIVERSALES */}
              {modalTab === 'metadata' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-border">
                      <span className="text-[10px] font-semibold uppercase text-text-muted block">
                        Proyecto Asociado
                      </span>
                      <p className="font-mono text-xs font-bold text-text-primary mt-0.5">
                        {selectedRecord.project_code}
                      </p>
                      <p className="text-xs text-text-secondary">{selectedRecord.project_name}</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-border">
                      <span className="text-[10px] font-semibold uppercase text-text-muted block">
                        Responsable / Registrado por
                      </span>
                      <p className="text-xs font-bold text-text-primary mt-0.5">{selectedRecord.user_name}</p>
                      <p className="font-mono text-xs text-text-muted">{selectedRecord.user_email}</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-border">
                      <span className="text-[10px] font-semibold uppercase text-text-muted block">
                        Fecha de Diligenciamiento
                      </span>
                      <p className="font-mono text-xs font-bold text-text-primary mt-0.5">
                        {selectedRecord.submission_date}
                      </p>
                      <span className="text-[10px] text-text-muted font-mono block">
                        Creación: {selectedRecord.created_at}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-border">
                      <span className="text-[10px] font-semibold uppercase text-text-muted block">
                        Estado Canónico
                      </span>
                      <p className="text-xs font-bold text-text-primary mt-0.5 font-mono">
                        {selectedRecord.status} ({selectedRecord.status_label})
                      </p>
                      <span className="text-[10px] text-text-muted block">
                        Código Formato: {selectedRecord.official_code}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-border">
                    <span className="text-[10px] font-semibold uppercase text-text-muted block">
                      Resumen Oficial
                    </span>
                    <p className="text-xs text-text-primary mt-1 leading-relaxed">
                      {selectedRecord.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* PESTAÑA 4: DATOS BRUTOS DEL FORMATO */}
              {modalTab === 'data' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">
                      Estructura JSON Completa del Registro
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">
                      Campos: {Object.keys(selectedRecord.raw_data).length}
                    </span>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl text-xs font-mono overflow-x-auto max-h-[350px]">
                    {JSON.stringify(selectedRecord.raw_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-3.5 border-t border-border bg-gray-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn-secondary text-xs py-1.5 px-4"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
