'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface EvidenceItem {
  id: string;
  code: string;
  formatName: string;
  projectName: string;
  projectCode: string;
  costCenter: string;
  location: string;
  equipment: string;
  serial: string;
  locatorName: string;
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
  generalObservations: string;
  divisionName: string;
  pdfUrl: string;
  excelUrl: string;
  driveLink: string;
  itemsResponses: Record<string, string>;
  nonCompliantCodes: string[];
  nonCompliantCount: number;
  operatorSignatureData?: string | null;
  sstaSignatureData?: string | null;
}

export default function EvidenceBoardToolPage() {
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'conforme' | 'alerta'>('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedLocator, setSelectedLocator] = useState('all');

  // Modal selection
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    async function fetchEvidences() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/evidence-board');
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
  const uniqueProjects = Array.from(
    new Map(evidences.map((e) => [e.projectName, { name: e.projectName, code: e.projectCode }])).values()
  );
  const uniqueFormats = Array.from(
    new Map(evidences.map((e) => [e.code, { code: e.code, name: e.formatName }])).values()
  );
  const uniqueLocators = Array.from(new Set(evidences.map((e) => e.locatorName).filter(Boolean)));

  // Filter logic
  const filteredEvidences = evidences.filter((ev) => {
    const s = search.toLowerCase();
    const matchesSearch =
      !search ||
      ev.fileName.toLowerCase().includes(s) ||
      ev.locatorName.toLowerCase().includes(s) ||
      ev.formatName.toLowerCase().includes(s) ||
      ev.projectName.toLowerCase().includes(s) ||
      ev.equipment.toLowerCase().includes(s) ||
      ev.serial.toLowerCase().includes(s) ||
      ev.divisionName.toLowerCase().includes(s) ||
      (ev.criticalPoint && ev.criticalPoint.toLowerCase().includes(s));

    const matchesDivision = selectedDivision === 'all' || ev.divisionName === selectedDivision;
    const matchesProject = selectedProject === 'all' || ev.projectName === selectedProject;
    const matchesStatus = selectedStatus === 'all' || ev.status === selectedStatus;
    const matchesFormat = selectedFormat === 'all' || ev.code === selectedFormat;
    const matchesLocator = selectedLocator === 'all' || ev.locatorName === selectedLocator;

    return matchesSearch && matchesDivision && matchesProject && matchesStatus && matchesFormat && matchesLocator;
  });

  // Metrics counters
  const totalEvidences = evidences.length;
  const conformesCount = evidences.filter((e) => e.status === 'conforme').length;
  const alertasCount = evidences.filter((e) => e.status === 'alerta').length;
  const divisionsCount = uniqueDivisions.length || 1;

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero Header */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Panel" />
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-teal-500/20 text-teal-200 border border-teal-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  HSEQ / Auditoría
                </span>
                <span className="badge bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Evidencias PDF &amp; Excel Sincronizadas
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <span>📋</span> Tablero de Evidencias y Control HSEQ
              </h1>
              <p className="text-white/80 text-sm mt-1 max-w-2xl">
                Consolidado centralizado de evidencias oficiales generadas en campo por los <strong className="text-amber-300 font-semibold">Localizadores</strong>. Monitoreo en tiempo real de respuestas, anomalías, observaciones y puntos críticos por división.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/forms/hseq-report"
                className="btn bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>📝</span> Nueva Inspección HSEQ
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
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center text-xl flex-shrink-0">
                🚨
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-800 bg-red-200/80 px-2 py-0.5 rounded">
                    Atención de Seguridad Requerida
                  </span>
                  <span className="text-xs font-semibold text-red-700">
                    {alertasCount} {alertasCount === 1 ? 'inspección presenta' : 'inspecciones presentan'} puntos críticos o respuestas &apos;NO&apos;
                  </span>
                </div>
                <p className="text-xs text-red-800/90 mt-1">
                  Se han registrado inspecciones donde &quot;algo no marcha bien&quot;. Puedes filtrar por <strong>Estado: Alertas / Puntos Críticos</strong> para revisar qué equipos requieren mantenimiento o inhabilitación antes de operar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Evidencias Totales</span>
            <p className="text-2xl font-bold text-text-primary mt-1">{loading ? '...' : totalEvidences}</p>
            <span className="text-[11px] text-teal-600 font-medium mt-0.5 block">PDF + Excel Respaldados</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">🟢 Conformes</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{loading ? '...' : conformesCount}</p>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">100% Aptos para operar</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">🔴 Con Alertas / Fallas</span>
            <p className={`text-2xl font-bold mt-1 ${alertasCount > 0 ? 'text-red-600' : 'text-text-muted'}`}>
              {loading ? '...' : alertasCount}
            </p>
            <span className="text-[11px] text-red-600 font-medium mt-0.5 block">Puntos críticos o &apos;NO&apos;</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">🏢 Divisiones Activas</span>
            <p className="text-2xl font-bold text-primary mt-1">{loading ? '...' : divisionsCount}</p>
            <span className="text-[11px] text-text-muted font-medium mt-0.5 block">
              {uniqueDivisions.slice(0, 2).join(', ') || 'Mapping, Ingeniería'}
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="card border border-border p-4 sm:p-5 bg-white shadow-sm space-y-3.5">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <input
                type="text"
                placeholder="Buscar por proyecto, localizador, equipo, serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="absolute left-2.5 top-3 text-xs text-text-muted">🔍</span>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Division Filter */}
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              >
                <option value="all">🏢 Todas las Divisiones</option>
                {uniqueDivisions.map((div) => (
                  <option key={div} value={div}>
                    División: {div}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              >
                <option value="all">🔘 Todos los Estados</option>
                <option value="conforme">🟢 Conforme (Sin fallas)</option>
                <option value="alerta">🔴 Alertas / Puntos Críticos</option>
              </select>

              {/* Project Filter */}
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="all">📁 Todos los Proyectos</option>
                {uniqueProjects.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.code ? `(${p.code})` : ''}
                  </option>
                ))}
              </select>

              {/* Format Filter */}
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="all">📋 Todos los Formatos</option>
                {uniqueFormats.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Evidence Table */}
          <div className="border border-border rounded-xl overflow-hidden mt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-border text-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">División</th>
                    <th className="px-4 py-3">Formato HSEQ</th>
                    <th className="px-4 py-3">Proyecto / Equipo</th>
                    <th className="px-4 py-3">Localizador Responsable</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3 text-center">Estado de Operación</th>
                    <th className="px-4 py-3 text-right">Evidencias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-muted">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mb-2"></div>
                        <p>Cargando evidencias y auditoría desde la base de datos...</p>
                      </td>
                    </tr>
                  )}

                  {!loading && error && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-red-600">
                        <p className="font-semibold">Error cargando evidencias:</p>
                        <p className="text-xs mt-1">{error}</p>
                      </td>
                    </tr>
                  )}

                  {!loading && !error && filteredEvidences.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* División */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                          🏢 {ev.divisionName}
                        </span>
                      </td>

                      {/* Formato */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-text-primary text-[12px]">{ev.code}</span>
                        <p className="text-[11px] text-text-secondary truncate max-w-[170px]" title={ev.formatName}>
                          {ev.formatName}
                        </p>
                      </td>

                      {/* Proyecto y Equipo */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary block">{ev.projectName}</span>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {ev.costCenter && <span className="mr-2">CC: {ev.costCenter}</span>}
                          <span>⚙️ {ev.equipment} {ev.serial ? `(${ev.serial})` : ''}</span>
                        </p>
                      </td>

                      {/* Localizador */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-medium text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                          📍 {ev.locatorName}
                        </span>
                        <span className="text-[10px] text-text-muted block mt-0.5">SSTA: {ev.sstaName}</span>
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
                            <span>🟢</span> Conforme
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="badge bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 animate-pulse">
                              <span>🚨</span> Alerta de Seguridad
                            </span>
                            {ev.nonCompliantCount > 0 && (
                              <span className="text-[9px] text-red-600 font-semibold mt-0.5">
                                {ev.nonCompliantCount} {ev.nonCompliantCount === 1 ? 'ítem en NO' : 'ítems en NO'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(ev)}
                          className="btn bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                          title="Ver auditoría de respuestas X, observaciones y puntos críticos"
                        >
                          👁️ Auditar
                        </button>
                        {ev.pdfUrl && (
                          <a
                            href={ev.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                            title="Descargar PDF Oficial"
                          >
                            📄 PDF
                          </a>
                        )}
                        {ev.excelUrl && (
                          <a
                            href={ev.excelUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                            title="Descargar Plantilla Excel (.xlsx)"
                          >
                            📊 Excel
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!loading && !error && filteredEvidences.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-text-muted">
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
            <span>
              Respaldo en la nube: 📁 <strong>Supabase Storage (Bucket &apos;evidencias&apos;)</strong>
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
                <span className="text-2xl">📋</span>
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
              >
                ✕
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
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Localizador</span>
                  <span className="font-bold text-amber-900">📍 {selectedEvidence.locatorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block font-semibold uppercase">Responsable SSTA</span>
                  <span className="font-medium text-text-primary">🛡️ {selectedEvidence.sstaName}</span>
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
                <div className="rounded-xl border border-border bg-white p-3.5 text-xs">
                  <span className="font-bold block uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5 text-text-primary">
                    <span>📝</span> Observaciones Generales:
                  </span>
                  <p className="text-text-secondary leading-relaxed">
                    {selectedEvidence.generalObservations || 'Sin observaciones registradas.'}
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
                    const isNo = String(val).toUpperCase() === 'NO';
                    const isSi = String(val).toUpperCase() === 'SI';
                    return (
                      <div
                        key={code}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${
                          isNo
                            ? 'bg-red-50 border-red-300 text-red-800 font-bold'
                            : isSi
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                            : 'bg-gray-50 border-gray-200 text-text-muted'
                        }`}
                      >
                        <span className="font-mono text-[11px]">Ítem {code}:</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isNo ? 'bg-red-600 text-white' : isSi ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-800'
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
                    Firma Responsable SSTA o Proyecto:
                  </span>
                  <span className="font-semibold text-text-primary block">{selectedEvidence.sstaName}</span>
                  {selectedEvidence.sstaSignatureData && (
                    <div className="bg-white border border-border rounded-lg p-1.5 flex items-center justify-center">
                      <img
                        src={selectedEvidence.sstaSignatureData}
                        alt="Firma SSTA"
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
                    <span>📄</span> Ver / Descargar PDF Oficial
                  </a>
                )}
                {selectedEvidence.excelUrl && (
                  <a
                    href={selectedEvidence.excelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <span>📊</span> Descargar Plantilla Excel (.xlsx)
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
