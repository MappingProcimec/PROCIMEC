'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Building2,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Eye,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';

interface EvidenceItem {
  id: string;
  code: string;
  formatName: string;
  projectName: string;
  projectCode: string;
  costCenter: string;
  location: string;
  equipment: string;
  equipmentName?: string;
  equipmentBrandModel?: string;
  serial: string;
  locatorName: string;
  operatorRole?: string;
  sstaName: string;
  date: string;
  time: string;
  fileName: string;
  excelFileName: string;
  fileSize: string;
  status: 'conforme' | 'alerta';
  hasAnomalies: boolean;
  hasCritical: boolean;
  criticalPoint: string;
  hasObservations?: boolean;
  generalObservations: string;
  divisionName: string;
  pdfUrl: string;
  excelUrl: string;
  driveLink: string;
  itemsResponses: Record<string, string>;
  optimalMap?: Record<string, string>;
  nonCompliantCodes: string[];
  nonCompliantCount: number;
  operatorSignatureData?: string | null;
  sstaSignatureData?: string | null;
}

function EvidenceActionsDropdown({
  evidence,
  onAudit,
}: {
  evidence: EvidenceItem;
  onAudit: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-border bg-white text-text-primary hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        <span>Acciones</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-44 origin-top-right rounded-xl border border-border bg-white p-1 shadow-lg ring-1 ring-black/5 focus:outline-none animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onAudit();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-teal-50 hover:text-teal-900 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
            <span>Auditar</span>
          </button>

          {evidence.pdfUrl && (
            <a
              href={evidence.pdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-rose-50 hover:text-rose-900 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span>Ver PDF</span>
            </a>
          )}

          {evidence.excelUrl && (
            <a
              href={evidence.excelUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Descargar Excel</span>
            </a>
          )}

          {evidence.driveLink && (
            <a
              href={evidence.driveLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-blue-50 hover:text-blue-900 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span>Google Drive</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvidenceBoardToolPage() {
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global & General Filters
  const [search, setSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'conforme' | 'alerta' | 'observaciones'>('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedLocator, setSelectedLocator] = useState('all');

  // Column Specific Filters
  const [colFilterProjectText, setColFilterProjectText] = useState('');
  const [colFilterEquipmentText, setColFilterEquipmentText] = useState('');
  const [colFilterDate, setColFilterDate] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<
    'division' | 'format' | 'project' | 'equipment' | 'locator' | 'date' | 'status' | null
  >('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal selection
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    async function fetchEvidences() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/evidence-board', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Error del servidor (${res.status}) al obtener evidencias.`);
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.evidences)) {
          setEvidences(data.evidences);
        } else {
          throw new Error(data.error || 'Respuesta inválida del servidor.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchEvidences();
  }, []);

  // Unique values for dropdown filters
  const uniqueDivisions = Array.from(new Set(evidences.map((e) => e.divisionName).filter(Boolean)));
  const uniqueFormats = Array.from(
    new Map(
      evidences.map((e) => {
        const title = (e.formatName || e.code || '').toUpperCase().trim();
        return [title, { code: e.code, title }];
      })
    ).values()
  );
  const uniqueLocators = Array.from(
    new Map(
      evidences.map((e) => [e.locatorName, { name: e.locatorName, role: e.operatorRole }])
    ).values()
  );

  // Sorting handler
  const handleSort = (field: 'division' | 'format' | 'project' | 'equipment' | 'locator' | 'date' | 'status') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'division' | 'format' | 'project' | 'equipment' | 'locator' | 'date' | 'status') => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1 inline-block" strokeWidth={1.75} />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-primary ml-1 inline-block" strokeWidth={2} />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-primary ml-1 inline-block" strokeWidth={2} />
    );
  };

  // Clear all filters
  const resetAllFilters = () => {
    setSearch('');
    setSelectedDivision('all');
    setSelectedFormat('all');
    setSelectedLocator('all');
    setSelectedStatus('all');
    setColFilterProjectText('');
    setColFilterEquipmentText('');
    setColFilterDate('');
    setSortField('date');
    setSortDirection('desc');
  };

  const hasActiveFilters =
    Boolean(search) ||
    selectedDivision !== 'all' ||
    selectedFormat !== 'all' ||
    selectedLocator !== 'all' ||
    selectedStatus !== 'all' ||
    Boolean(colFilterProjectText) ||
    Boolean(colFilterEquipmentText) ||
    Boolean(colFilterDate);

  // Filter and Sorting logic combined
  const filteredEvidences = useMemo(() => {
    const list = evidences.filter((ev) => {
      const s = search.toLowerCase();
      const matchesSearch =
        !search ||
        ev.fileName.toLowerCase().includes(s) ||
        ev.locatorName.toLowerCase().includes(s) ||
        (ev.operatorRole && ev.operatorRole.toLowerCase().includes(s)) ||
        ev.formatName.toLowerCase().includes(s) ||
        ev.projectName.toLowerCase().includes(s) ||
        ev.equipment.toLowerCase().includes(s) ||
        ev.serial.toLowerCase().includes(s) ||
        ev.divisionName.toLowerCase().includes(s) ||
        (ev.criticalPoint && ev.criticalPoint.toLowerCase().includes(s));

      const matchesDivision = selectedDivision === 'all' || ev.divisionName === selectedDivision;
      const matchesFormat =
        selectedFormat === 'all' ||
        (ev.formatName || '').toUpperCase().trim() === selectedFormat.toUpperCase().trim() ||
        (ev.code || '').toUpperCase().trim() === selectedFormat.toUpperCase().trim();
      const matchesLocator = selectedLocator === 'all' || ev.locatorName === selectedLocator;

      // Column filters
      const projQ = colFilterProjectText.toLowerCase();
      const matchesColProject =
        !projQ ||
        ev.projectName.toLowerCase().includes(projQ) ||
        (ev.costCenter && ev.costCenter.toLowerCase().includes(projQ));

      const eqQ = colFilterEquipmentText.toLowerCase();
      const matchesColEquipment =
        !eqQ ||
        ev.equipment.toLowerCase().includes(eqQ) ||
        (ev.serial && ev.serial.toLowerCase().includes(eqQ));

      const matchesColDate = !colFilterDate || ev.date.includes(colFilterDate);

      let matchesStatus = true;
      if (selectedStatus === 'conforme') {
        matchesStatus = ev.status === 'conforme';
      } else if (selectedStatus === 'alerta') {
        matchesStatus = ev.status === 'alerta';
      } else if (selectedStatus === 'observaciones') {
        matchesStatus = Boolean(ev.hasObservations);
      }

      return (
        matchesSearch &&
        matchesDivision &&
        matchesFormat &&
        matchesLocator &&
        matchesColProject &&
        matchesColEquipment &&
        matchesColDate &&
        matchesStatus
      );
    });

    if (!sortField) return list;

    return [...list].sort((a, b) => {
      let valA = '';
      let valB = '';

      switch (sortField) {
        case 'division':
          valA = a.divisionName || '';
          valB = b.divisionName || '';
          break;
        case 'format':
          valA = a.code || '';
          valB = b.code || '';
          break;
        case 'project':
          valA = a.projectName || '';
          valB = b.projectName || '';
          break;
        case 'equipment':
          valA = a.equipment || '';
          valB = b.equipment || '';
          break;
        case 'locator':
          valA = a.locatorName || '';
          valB = b.locatorName || '';
          break;
        case 'date':
          valA = `${a.date} ${a.time}`;
          valB = `${b.date} ${b.time}`;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
      }

      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    evidences,
    search,
    selectedDivision,
    selectedFormat,
    selectedLocator,
    selectedStatus,
    colFilterProjectText,
    colFilterEquipmentText,
    colFilterDate,
    sortField,
    sortDirection,
  ]);

  // Metrics counters
  const totalEvidences = evidences.length;
  const conformesCount = evidences.filter((e) => e.status === 'conforme').length;
  const alertasCount = evidences.filter((e) => e.status === 'alerta').length;

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero Header */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Panel" />
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <FileText className="w-7 h-7 text-amber-400" strokeWidth={1.75} /> Tablero de Evidencias y Control HSEQ
              </h1>
              <p className="text-white/80 text-sm mt-1 max-w-2xl">
                Consolidado centralizado de evidencias oficiales generadas en campo por los <strong className="text-amber-300 font-semibold">Responsables y Operadores</strong>. Monitoreo en tiempo real de respuestas, anomalías, observaciones y puntos críticos por división.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/forms/hseq-report"
                className="btn bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" strokeWidth={1.75} /> Nueva Inspección HSEQ
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {/* Status Notification if Alert Exists */}
        {alertasCount > 0 && (
          <div className="card border-2 border-red-300 bg-red-50/90 shadow-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-800 bg-red-200/80 px-2 py-0.5 rounded">
                    Atención de Seguridad Requerida
                  </span>
                  <span className="text-xs font-semibold text-red-700">
                    {alertasCount} {alertasCount === 1 ? 'inspección presenta' : 'inspecciones presentan'} variaciones o puntos críticos
                  </span>
                </div>
                <p className="text-xs text-red-800/90 mt-1">
                  Se han registrado inspecciones con variaciones respecto al estándar óptimo. Puedes filtrar por <strong>Estado: Alertas / Puntos Críticos</strong> para revisar qué equipos requieren mantenimiento o inhabilitación antes de operar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards (Filtros Rápidos Interactivos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            className={`card border text-left p-4 bg-white shadow-sm transition-all select-none active:scale-[0.98] ${
              selectedStatus === 'all'
                ? 'border-teal-500 ring-2 ring-teal-500/20'
                : 'border-border hover:border-gray-300'
            }`}
            title="Clic para mostrar todas las evidencias"
          >
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Evidencias Totales</span>
            <p className="text-2xl font-bold text-text-primary mt-1">{loading ? '...' : totalEvidences}</p>
            <span className="text-[11px] text-teal-600 font-medium mt-0.5 block">PDF + Excel Respaldados</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'conforme' ? 'all' : 'conforme')}
            className={`card border text-left p-4 bg-white shadow-sm transition-all select-none active:scale-[0.98] ${
              selectedStatus === 'conforme'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                : 'border-border hover:border-gray-300'
            }`}
            title="Clic para filtrar únicamente evidencias conformes"
          >
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" strokeWidth={1.75} /> Conformes
            </span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{loading ? '...' : conformesCount}</p>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">100% Aptos para operar</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'alerta' ? 'all' : 'alerta')}
            className={`card border text-left p-4 bg-white shadow-sm transition-all select-none active:scale-[0.98] ${
              selectedStatus === 'alerta'
                ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/30'
                : 'border-border hover:border-gray-300'
            }`}
            title="Clic para filtrar inspecciones con alertas o puntos críticos"
          >
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 inline" strokeWidth={1.75} /> Con Alertas / Fallas
            </span>
            <p className={`text-2xl font-bold mt-1 ${alertasCount > 0 ? 'text-red-600' : 'text-text-muted'}`}>
              {loading ? '...' : alertasCount}
            </p>
            <span className="text-[11px] text-red-600 font-medium mt-0.5 block">Variaciones o Puntos Críticos</span>
          </button>
        </div>

        {/* Global Search and Filter Summary Bar */}
        <div className="card border border-border p-4 bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                placeholder="Buscar por proyecto, localizador, equipo, serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-3" strokeWidth={1.75} />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold hover:bg-red-100 transition-colors inline-flex items-center gap-1.5 text-xs shadow-xs"
                  title="Restablecer todos los filtros y búsquedas"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Limpiar Filtros
                </button>
              )}

              <div className="text-text-muted text-[11px] font-medium">
                {hasActiveFilters ? (
                  <span className="text-teal-700 font-semibold">
                    Mostrando {filteredEvidences.length} de {evidences.length} resultados filtrados
                  </span>
                ) : (
                  <span>Total: {evidences.length} registros</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Table Card */}
        <div className="card border border-border p-4 bg-white shadow-sm space-y-3">
          <div className="border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-border text-text-muted font-bold uppercase tracking-wider text-[11px]">
                  {/* Fila 1: Encabezados con Ordenamiento (Sort) */}
                  <tr>
                    <th
                      onClick={() => handleSort('division')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por División"
                    >
                      <div className="flex items-center gap-1">
                        <span>División</span>
                        {getSortIcon('division')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('format')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Formato"
                    >
                      <div className="flex items-center gap-1">
                        <span>Formato HSEQ</span>
                        {getSortIcon('format')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('project')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Proyecto"
                    >
                      <div className="flex items-center gap-1">
                        <span>Proyecto</span>
                        {getSortIcon('project')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('equipment')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Equipo"
                    >
                      <div className="flex items-center gap-1">
                        <span>Equipo</span>
                        {getSortIcon('equipment')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('locator')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Responsable"
                    >
                      <div className="flex items-center gap-1">
                        <span>Responsable y Rol</span>
                        {getSortIcon('locator')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('date')}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Fecha"
                    >
                      <div className="flex items-center gap-1">
                        <span>Fecha y Hora</span>
                        {getSortIcon('date')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100/80 transition-colors select-none group"
                      title="Ordenar por Estado"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Estado de Operación</span>
                        {getSortIcon('status')}
                      </div>
                    </th>

                    <th className="px-4 py-3 text-right">
                      <span>Evidencias</span>
                    </th>
                  </tr>

                  {/* Fila 2: Filtros directos e interactivos en cada columna (Siempre Visible) */}
                  <tr className="bg-slate-100/90 border-t border-border lowercase tracking-normal">
                    {/* Filtro Columna: División */}
                    <th className="p-2 font-normal">
                      <select
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-white text-text-primary focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="all">Todas ({uniqueDivisions.length})</option>
                        {uniqueDivisions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* Filtro Columna: Formato */}
                    <th className="p-2 font-normal">
                      <select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-white text-text-primary focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="all">Todos ({uniqueFormats.length})</option>
                        {uniqueFormats.map((f) => (
                          <option key={f.title} value={f.title} title={`${f.code} - ${f.title}`}>
                            {f.title}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* Filtro Columna: Proyecto */}
                    <th className="p-2 font-normal">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar proyecto o CC..."
                          value={colFilterProjectText}
                          onChange={(e) => setColFilterProjectText(e.target.value)}
                          className="w-full text-[11px] px-2 py-1 pr-5 rounded-md border border-border bg-white text-text-primary placeholder:text-gray-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                        {colFilterProjectText && (
                          <button
                            type="button"
                            onClick={() => setColFilterProjectText('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Limpiar"
                          >
                            <X className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Filtro Columna: Equipo */}
                    <th className="p-2 font-normal">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar equipo o serial..."
                          value={colFilterEquipmentText}
                          onChange={(e) => setColFilterEquipmentText(e.target.value)}
                          className="w-full text-[11px] px-2 py-1 pr-5 rounded-md border border-border bg-white text-text-primary placeholder:text-gray-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                        {colFilterEquipmentText && (
                          <button
                            type="button"
                            onClick={() => setColFilterEquipmentText('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Limpiar"
                          >
                            <X className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Filtro Columna: Responsable */}
                    <th className="p-2 font-normal">
                      <select
                        value={selectedLocator}
                        onChange={(e) => setSelectedLocator(e.target.value)}
                        className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-white text-text-primary focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="all">Todos ({uniqueLocators.length})</option>
                        {uniqueLocators.map((loc) => (
                          <option key={loc.name} value={loc.name}>
                            {loc.name} {loc.role ? `(${loc.role})` : ''}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* Filtro Columna: Fecha */}
                    <th className="p-2 font-normal">
                      <div className="relative">
                        <input
                          type="date"
                          value={colFilterDate}
                          onChange={(e) => setColFilterDate(e.target.value)}
                          className="w-full text-[11px] px-1.5 py-1 rounded-md border border-border bg-white text-text-primary focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                        {colFilterDate && (
                          <button
                            type="button"
                            onClick={() => setColFilterDate('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Limpiar"
                          >
                            <X className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Filtro Columna: Estado */}
                    <th className="p-2 font-normal text-center">
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'conforme' | 'alerta' | 'observaciones')}
                        className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-white text-text-primary focus:ring-1 focus:ring-teal-500 focus:outline-none font-medium"
                      >
                        <option value="all">Todos</option>
                        <option value="conforme">Conformes</option>
                        <option value="alerta">Alertas / Variaciones</option>
                        <option value="observaciones">Con Observaciones</option>
                      </select>
                    </th>

                    {/* Acción en Columna */}
                    <th className="p-2 text-right font-normal">
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="w-full text-[11px] font-bold text-teal-800 bg-teal-100/90 hover:bg-teal-200 border border-teal-300 py-1 px-2 rounded-md transition-colors inline-flex items-center justify-center gap-1"
                          title="Limpiar todos los filtros activos"
                        >
                          <X className="w-3 h-3" strokeWidth={1.75} /> Limpiar
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-muted block text-center py-1">Sin filtro</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-text-muted">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mb-2"></div>
                        <p>Cargando evidencias y auditoría desde la base de datos...</p>
                      </td>
                    </tr>
                  )}

                  {!loading && error && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-red-600">
                        <p className="font-semibold">Error cargando evidencias:</p>
                        <p className="text-xs mt-1">{error}</p>
                      </td>
                    </tr>
                  )}

                  {!loading && !error && filteredEvidences.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* División */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[11px] px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                          <Building2 className="w-3.5 h-3.5 text-teal-700" />
                          <span>{ev.divisionName}</span>
                        </span>
                      </td>

                      {/* Formato */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-text-primary text-[12px]">{ev.code}</span>
                        <p className="text-[11px] text-text-secondary truncate max-w-[170px]" title={ev.formatName}>
                          {ev.formatName}
                        </p>
                      </td>

                      {/* Proyecto */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary block">{ev.projectName}</span>
                        {ev.costCenter && (
                          <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                            CC: {ev.costCenter}
                          </span>
                        )}
                      </td>

                      {/* Equipo */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary block">{ev.equipment}</span>
                        <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                          {ev.serial ? `S/N: ${ev.serial}` : 'Sin serial'}
                        </span>
                      </td>

                      {/* Responsable y Rol */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-text-primary text-[11px]">
                            <UserCheck className="w-3.5 h-3.5 text-primary" />
                            <span>{ev.locatorName}</span>
                          </span>
                          {ev.operatorRole && (
                            <span className="badge bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              {ev.operatorRole}
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted">SSTA: {ev.sstaName}</span>
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                        <span className="font-medium text-text-primary block">{ev.date}</span>
                        <span className="text-[10px] text-text-muted">{ev.time || 'Registro diario'}</span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {ev.status === 'conforme' ? (
                          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Conforme
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="badge bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-rose-600" /> Alerta de Seguridad
                            </span>
                            {ev.nonCompliantCount > 0 && (
                              <span className="text-[9px] text-red-600 font-semibold mt-0.5">
                                {ev.nonCompliantCount} {ev.nonCompliantCount === 1 ? 'ítem con variación' : 'ítems con variación'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Acciones Agrupadas en Menú Desplegable */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <EvidenceActionsDropdown
                          evidence={ev}
                          onAudit={() => setSelectedEvidence(ev)}
                        />
                      </td>
                    </tr>
                  ))}

                  {!loading && !error && filteredEvidences.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-text-muted">
                        No se encontraron evidencias que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted pt-2">
            <span>
              Mostrando {filteredEvidences.length} de {evidences.length} evidencias en base de datos
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary inline" strokeWidth={1.75} />
              Respaldo en la nube: <strong>Supabase Storage (Bucket &apos;evidencias&apos;)</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Audit & Details Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-teal-800 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-white" strokeWidth={1.75} />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Auditoría de Inspección: {selectedEvidence.code}
                  </h3>
                  <p className="text-xs text-teal-200">
                    División: <strong>{selectedEvidence.divisionName}</strong> • {selectedEvidence.formatName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition-colors"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* Alert or Conformance Banner */}
              {selectedEvidence.hasAnomalies ? (
                <div className="card border-2 border-red-300 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">
                        Inspección No Conforme / Alerta de Seguridad
                      </h4>
                      <p className="text-xs text-red-800 mt-0.5">
                        Esta inspección contiene respuestas negativas (&apos;NO&apos;) o puntos críticos que alertan sobre el estado operativo del equipo.
                      </p>
                      {selectedEvidence.nonCompliantCodes.length > 0 && (
                        <div className="mt-2 text-xs text-red-900">
                          <strong>Ítems que no cumplen:</strong>{' '}
                          <span className="font-mono font-bold bg-red-200/80 px-1.5 py-0.5 rounded">
                            {selectedEvidence.nonCompliantCodes.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card border-2 border-emerald-300 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                        Inspección 100% Conforme
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Todos los parámetros de seguridad fueron evaluados positivamente. Equipo apto para operaciones.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* General Information Grid */}
              <div className="border border-border rounded-xl p-4 bg-surface grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">División</span>
                  <span className="font-bold text-teal-800">{selectedEvidence.divisionName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Proyecto</span>
                  <span className="font-bold text-text-primary">{selectedEvidence.projectName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Centro de Costo</span>
                  <span className="font-medium text-text-primary">{selectedEvidence.costCenter || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Fecha</span>
                  <span className="font-medium text-text-primary">{selectedEvidence.date} {selectedEvidence.time}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Equipo</span>
                  <span className="font-medium text-text-primary">{selectedEvidence.equipment}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Serial</span>
                  <span className="font-medium text-text-primary">{selectedEvidence.serial || 'S/N'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Responsable / Rol</span>
                  <span className="font-bold text-amber-900 block">{selectedEvidence.locatorName}</span>
                  {selectedEvidence.operatorRole && (
                    <span className="badge bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      {selectedEvidence.operatorRole}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Responsable SSTA</span>
                  <span className="font-medium text-text-primary">{selectedEvidence.sstaName}</span>
                </div>
              </div>

              {/* Critical Point & Observations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Puntos Críticos */}
                <div className={`rounded-xl border p-3.5 text-xs ${
                  selectedEvidence.hasCritical
                    ? 'border-red-300 bg-red-50 text-red-950'
                    : 'border-border bg-white text-text-primary'
                }`}>
                  <span className="font-bold block uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                    <span>⚠️</span> Punto Crítico Reportado:
                  </span>
                  <p className="leading-relaxed">
                    {selectedEvidence.criticalPoint || 'Ninguno'}
                  </p>
                </div>

                {/* Observaciones Generales */}
                <div
                  className={`rounded-xl border p-3.5 text-xs ${
                    selectedEvidence.hasObservations
                      ? 'border-blue-300 bg-blue-50/70 text-blue-950 font-medium'
                      : 'border-border bg-white text-text-secondary'
                  }`}
                >
                  <span className="font-bold block uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5 text-text-primary">
                    <span>📝</span> Observaciones Generales:
                    {selectedEvidence.hasObservations && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold border border-blue-200">
                        Novedad Notificada a HSEQ
                      </span>
                    )}
                  </span>
                  <p className="leading-relaxed">
                    {selectedEvidence.generalObservations || 'Ninguna'}
                  </p>
                </div>
              </div>

              {/* Items Evaluations Matrix (Respuestas con X) */}
              <div className="border border-border rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-bold text-xs text-text-primary uppercase tracking-wider">
                    Respuestas Registradas en la Plantilla ({Object.keys(selectedEvidence.itemsResponses).length} ítems evaluados)
                  </span>
                  <span className="text-[11px] text-text-muted font-medium">
                    Marcación con &apos;X&apos;
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(selectedEvidence.itemsResponses).map(([code, val]) => {
                    const expected = selectedEvidence.optimalMap?.[code] || 'SI';
                    const isVariation = expected !== 'NA' && String(val).toUpperCase() !== expected;

                    return (
                      <div
                        key={code}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${
                          isVariation
                            ? 'bg-red-50 border-red-300 text-red-800 font-bold'
                            : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px]">Ítem {code}</span>
                          {isVariation && (
                            <span className="text-[9px] text-red-600 font-normal">
                              Esperado: {expected}
                            </span>
                          )}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isVariation ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Digital Signatures Confirmation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-border rounded-xl p-3.5 bg-surface text-xs space-y-1.5">
                  <span className="font-bold text-text-secondary block text-[11px]">
                    Firma Responsable del Equipo / Localizador:
                  </span>
                  <span className="font-semibold text-text-primary block">{selectedEvidence.locatorName}</span>
                  {selectedEvidence.operatorSignatureData && (
                    <div className="bg-white border border-border rounded-lg p-1.5 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedEvidence.operatorSignatureData}
                        alt="Firma Operador"
                        className="h-10 object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="border border-border rounded-xl p-3.5 bg-surface text-xs space-y-1.5">
                  <span className="font-bold text-text-secondary block text-[11px]">
                    Firma Responsable/SSTA:
                  </span>
                  <span className="font-semibold text-text-primary block">{selectedEvidence.sstaName}</span>
                  {selectedEvidence.sstaSignatureData && (
                    <div className="bg-white border border-border rounded-lg p-1.5 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedEvidence.sstaSignatureData}
                        alt="Firma Responsable/SSTA"
                        className="h-10 object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer with Direct Downloads */}
            <div className="px-6 py-4 bg-gray-50 border-t border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <span className="text-xs text-text-muted">
                Evidencias inalterables almacenadas en la nube.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvidence(null)}
                  className="btn bg-gray-200 hover:bg-gray-300 text-text-secondary text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cerrar
                </button>
                {selectedEvidence.pdfUrl && (
                  <a
                    href={selectedEvidence.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" /> Ver / Descargar PDF Oficial
                  </a>
                )}
                {selectedEvidence.excelUrl && (
                  <a
                    href={selectedEvidence.excelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Descargar Plantilla Excel (.xlsx)
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
