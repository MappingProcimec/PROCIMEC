'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

interface EvidenceItem {
  id: string;
  code: string;
  formatName: string;
  projectName: string;
  projectCode: string;
  locatorName: string;
  date: string;
  time: string;
  fileName: string;
  fileSize: string;
  status: 'conforme' | 'con_observaciones';
  driveLink: string;
}

const SAMPLE_EVIDENCES: EvidenceItem[] = [
  {
    id: 'ev-001',
    code: 'FOR-HSEQ-012',
    formatName: 'Inspección Preoperacional de Alturas',
    projectName: 'Gasoducto Central - Tramo Norte',
    projectCode: 'P-2026-01',
    locatorName: 'Carlos Mendoza',
    date: '2026-09-09',
    time: '07:45 AM',
    fileName: 'EVIDENCIA_FOR-HSEQ-012_P-2026-01_2026-09-09_CarlosM.pdf',
    fileSize: '342 KB',
    status: 'conforme',
    driveLink: 'https://drive.google.com/file/d/sample1/view',
  },
  {
    id: 'ev-002',
    code: 'FOR-HSEQ-005',
    formatName: 'Lista de Chequeo y Dotación de EPP',
    projectName: 'Acueducto Metropolitano Fase II',
    projectCode: 'P-2026-04',
    locatorName: 'Andrés Felipe Gómez',
    date: '2026-09-09',
    time: '08:15 AM',
    fileName: 'EVIDENCIA_FOR-HSEQ-005_P-2026-04_2026-09-09_AndresG.pdf',
    fileSize: '298 KB',
    status: 'conforme',
    driveLink: 'https://drive.google.com/file/d/sample2/view',
  },
  {
    id: 'ev-003',
    code: 'FOR-HSEQ-021',
    formatName: 'Permiso de Trabajo Seguro en Vía / Campo',
    projectName: 'Interconexión Vial Calle 80',
    projectCode: 'P-2026-02',
    locatorName: 'Julián Ramos',
    date: '2026-09-08',
    time: '06:30 AM',
    fileName: 'EVIDENCIA_FOR-HSEQ-021_P-2026-02_2026-09-08_JulianR.pdf',
    fileSize: '415 KB',
    status: 'con_observaciones',
    driveLink: 'https://drive.google.com/file/d/sample3/view',
  },
  {
    id: 'ev-004',
    code: 'FOR-HSEQ-008',
    formatName: 'Inspección Preoperacional de Vehículo y Equipo',
    projectName: 'Gasoducto Central - Tramo Norte',
    projectCode: 'P-2026-01',
    locatorName: 'Carlos Mendoza',
    date: '2026-09-08',
    time: '07:10 AM',
    fileName: 'EVIDENCIA_FOR-HSEQ-008_P-2026-01_2026-09-08_CarlosM.pdf',
    fileSize: '312 KB',
    status: 'conforme',
    driveLink: 'https://drive.google.com/file/d/sample4/view',
  },
  {
    id: 'ev-005',
    code: 'FOR-HSEQ-012',
    formatName: 'Inspección Preoperacional de Alturas',
    projectName: 'Subestación Eléctrica Sur',
    projectCode: 'P-2026-07',
    locatorName: 'Mauricio Silva',
    date: '2026-09-07',
    time: '08:00 AM',
    fileName: 'EVIDENCIA_FOR-HSEQ-012_P-2026-07_2026-09-07_MauricioS.pdf',
    fileSize: '350 KB',
    status: 'conforme',
    driveLink: 'https://drive.google.com/file/d/sample5/view',
  },
];

export default function EvidenceBoardToolPage() {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedLocator, setSelectedLocator] = useState('all');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  // Filtering
  const filteredEvidences = SAMPLE_EVIDENCES.filter((ev) => {
    const matchesSearch =
      ev.fileName.toLowerCase().includes(search.toLowerCase()) ||
      ev.locatorName.toLowerCase().includes(search.toLowerCase()) ||
      ev.formatName.toLowerCase().includes(search.toLowerCase()) ||
      ev.projectName.toLowerCase().includes(search.toLowerCase());

    const matchesProject = selectedProject === 'all' || ev.projectCode === selectedProject;
    const matchesFormat = selectedFormat === 'all' || ev.code === selectedFormat;
    const matchesLocator = selectedLocator === 'all' || ev.locatorName === selectedLocator;

    return matchesSearch && matchesProject && matchesFormat && matchesLocator;
  });

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
                  HSEQ / Evidencias
                </span>
                <span className="badge bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Google Drive Sincronizado
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <span>📋</span> Tablero de Evidencias HSEQ
              </h1>
              <p className="text-white/80 text-sm mt-1 max-w-2xl">
                Consolidado centralizado de evidencias en formato PDF generadas por los <strong className="text-amber-300 font-semibold">Localizadores</strong> en campo y almacenadas en la Carpeta General de Google Drive.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {/* In Construction Notice Banner */}
        <div className="card border-2 border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-2xl flex-shrink-0">
              🚧
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                  En Construcción
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  Sincronización en vivo con Carpeta General de Google Drive
                </span>
              </div>
              <h2 className="text-base font-bold text-text-primary">
                Tablero operativo con visor de evidencias PDF en despliegue
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
                Este tablero proyecta los archivos PDF generados desde las plantillas. Los datos mostrados corresponden a la estructura estandarizada de auditoría que se conectará a la cuenta de servicio de Google Drive.
              </p>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Evidencias PDF</span>
            <p className="text-2xl font-bold text-text-primary mt-1">248</p>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">100% Inalterables</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Localizadores en Campo</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">12</p>
            <span className="text-[11px] text-text-muted font-medium mt-0.5 block">Reportes activos</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Proyectos con Registro</span>
            <p className="text-2xl font-bold text-teal-600 mt-1">8</p>
            <span className="text-[11px] text-text-muted font-medium mt-0.5 block">Obras inspeccionadas</span>
          </div>
          <div className="card border border-border p-4 bg-white shadow-sm">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Cumplimiento HSEQ</span>
            <p className="text-2xl font-bold text-primary mt-1">98.4%</p>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Auditoría al día</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="card border border-border p-4 sm:p-5 bg-white shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Buscar por archivo, Localizador, proyecto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-border focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="absolute left-2.5 top-2.5 text-xs text-text-muted">🔍</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Project Filter */}
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="all">Todos los proyectos</option>
                <option value="P-2026-01">P-2026-01 Gasoducto Central</option>
                <option value="P-2026-02">P-2026-02 Interconexión Vial</option>
                <option value="P-2026-04">P-2026-04 Acueducto Fase II</option>
                <option value="P-2026-07">P-2026-07 Subestación Sur</option>
              </select>

              {/* Format Filter */}
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="all">Todos los formatos HSEQ</option>
                <option value="FOR-HSEQ-012">FOR-HSEQ-012 (Alturas)</option>
                <option value="FOR-HSEQ-005">FOR-HSEQ-005 (EPP)</option>
                <option value="FOR-HSEQ-021">FOR-HSEQ-021 (Permiso Vía)</option>
                <option value="FOR-HSEQ-008">FOR-HSEQ-008 (Vehículo)</option>
              </select>

              {/* Locator Filter */}
              <select
                value={selectedLocator}
                onChange={(e) => setSelectedLocator(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-border bg-white text-text-primary focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="all">Todos los Localizadores</option>
                <option value="Carlos Mendoza">Localizador: Carlos Mendoza</option>
                <option value="Andrés Felipe Gómez">Localizador: Andrés Felipe Gómez</option>
                <option value="Julián Ramos">Localizador: Julián Ramos</option>
                <option value="Mauricio Silva">Localizador: Mauricio Silva</option>
              </select>
            </div>
          </div>

          {/* Evidence Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-border text-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Archivo PDF</th>
                    <th className="px-4 py-3">Formato HSEQ</th>
                    <th className="px-4 py-3">Proyecto</th>
                    <th className="px-4 py-3">Localizador Responsable</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEvidences.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 text-sm">📄</span>
                          <span className="truncate max-w-[200px]" title={ev.fileName}>
                            {ev.fileName}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted pl-5">{ev.fileSize}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-teal-800">{ev.code}</span>
                        <p className="text-[11px] text-text-secondary truncate max-w-[160px]">
                          {ev.formatName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary">{ev.projectCode}</span>
                        <p className="text-[11px] text-text-muted truncate max-w-[140px]">
                          {ev.projectName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                          📍 {ev.locatorName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                        <span className="font-medium text-text-primary">{ev.date}</span>
                        <p className="text-[10px]">{ev.time}</p>
                      </td>
                      <td className="px-4 py-3">
                        {ev.status === 'conforme' ? (
                          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            Conforme
                          </span>
                        ) : (
                          <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            Observación
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(ev)}
                          className="btn bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors mr-1"
                        >
                          👁️ Ver PDF
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredEvidences.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-text-muted">
                        No se encontraron evidencias que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted pt-2">
            <span>Mostrando {filteredEvidences.length} de {SAMPLE_EVIDENCES.length} evidencias registradas</span>
            <span>Ubicación: 📁 Google Drive / Carpeta General de Evidencias</span>
          </div>
        </div>

      </div>

      {/* PDF Preview Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-teal-700 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="font-bold text-sm">{selectedEvidence.fileName}</h3>
                  <p className="text-[11px] text-teal-200">
                    Formato: {selectedEvidence.formatName} • {selectedEvidence.code}
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

            {/* Modal Body: Document Preview */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="border border-border rounded-xl p-5 bg-surface space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">PROCIMEC INGENIERÍA</span>
                    <h4 className="font-bold text-text-primary text-sm">{selectedEvidence.formatName}</h4>
                  </div>
                  <span className="badge bg-teal-100 text-teal-800 text-[11px] font-bold px-2 py-0.5 rounded">
                    {selectedEvidence.code}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-muted block text-[10px]">Proyecto:</span>
                    <span className="font-semibold text-text-primary">{selectedEvidence.projectName}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Localizador Responsable:</span>
                    <span className="font-semibold text-amber-800">📍 {selectedEvidence.locatorName}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Fecha de Elaboración:</span>
                    <span className="font-semibold text-text-primary">{selectedEvidence.date} a las {selectedEvidence.time}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px]">Almacenamiento:</span>
                    <span className="font-semibold text-teal-700">Google Drive General (PDF)</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-border p-3 mt-3 text-xs space-y-1">
                  <span className="font-bold text-text-secondary block text-[11px]">Resumen de Inspección:</span>
                  <p className="text-text-secondary leading-relaxed text-[11px]">
                    Evidencia consolidada e inyectada con éxito mediante Gemini AI. Parámetros de seguridad verificados en sitio
                    por el Localizador. Firma digital y sello de tiempo de auditoría estampados.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-text-muted">
                  🔒 Documento protegido contra edición (PDF Oficial de Calidad).
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEvidence(null)}
                    className="btn bg-gray-100 hover:bg-gray-200 text-text-secondary text-xs font-semibold px-4 py-2 rounded-xl"
                  >
                    Cerrar
                  </button>
                  <a
                    href={selectedEvidence.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <span>↗</span> Abrir en Google Drive
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
