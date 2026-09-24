'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { HrLettersAuditPanel } from '@/components/admin/HrLettersAuditPanel';
import { Wrench, Search, ArrowRight, ExternalLink, ShieldCheck, Sparkles, Filter } from 'lucide-react';

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: 'gpr' | 'cad' | 'admin' | 'universal' | 'hseq' | 'rrhh';
  is_universal: boolean;
}

async function fetchToolsData(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  const json = await res.json();
  return (json.data ?? []) as Tool[];
}

const TOOL_META: Record<string, { icon: string; description: string; tag: string; path?: string }> = {
  'radargrama': {
    icon: '🎯',
    description: 'Visualizador y procesador interactivo de radargramas GPR, filtros DSP y análisis geofísico.',
    tag: 'GPR / Geofísica',
    path: '/tools/radargrama',
  },
  'gsf-processor': {
    icon: '📡',
    description: 'Procesamiento de radargramas GPR (.gsf), filtros DSP, dewow, corrección time-zero, análisis hiperbólico y exportación a JPG, PDF y PPTX.',
    tag: 'GPR / Geofísica',
    path: '/tools/gsf-processor',
  },
  'cad-productivity-board': {
    icon: '📊',
    description: 'Métricas de productividad de modeladores CAD/BIM, control de horas hombre, entregables y distribución por software.',
    tag: 'CAD / BIM',
    path: '/tools/cad-productivity-board',
  },
  'txt-dwg-viewer': {
    icon: '📐',
    description: 'Visualizador de archivos de coordenadas topográficas TXT y exportador para dibujo y plataformas CAD.',
    tag: 'Topografía / CAD',
    path: '/tools/txt-dwg-viewer',
  },
  'docx-generator': {
    icon: '📄',
    description: 'Generador de reportes técnicos formales en formato Word (.docx) con soporte fotográfico y tablas operacionales.',
    tag: 'Informes Técnicos',
    path: '/tools/docx-generator',
  },
  'backup-script-gen': {
    icon: '💾',
    description: 'Generador automatizado de scripts para sincronización y respaldo local seguro de datos de campo.',
    tag: 'Seguridad / Datos',
    path: '/tools/backup-script-gen',
  },
  'gis-viewer': {
    icon: '🗺️',
    description: 'Base de datos geográfica integrada (2D y 3D) para consulta y modelado de servicios públicos e infraestructura.',
    tag: 'Sistemas GIS',
    path: '/tools/gis-viewer',
  },
  'internal-chat': {
    icon: '💬',
    description: 'Canal de mensajería interna corporativa y conversión directa de notas de trabajo en tareas de proyecto.',
    tag: 'Comunicación',
    path: '/tools/internal-chat',
  },
  'meeting-transcriber': {
    icon: '🎙️',
    description: 'Módulo de grabación, transcripción asistida y resumen de acuerdos para reuniones técnicas de ingeniería.',
    tag: 'Productividad',
    path: '/tools/meeting-transcriber',
  },
  'org-chart-ai': {
    icon: '🏢',
    description: 'Organigrama empresarial interactivo para navegación de roles, responsabilidades y estructura de equipo.',
    tag: 'Organización',
    path: '/tools/org-chart-ai',
  },
  'dynamic-dashboard': {
    icon: '🌐',
    description: 'Panel dinámico para acceso rápido a herramientas, formularios y actividades recientes según el rol del usuario.',
    tag: 'Universal',
    path: '/dashboard',
  },
  'attendance-tracker': {
    icon: '⏱️',
    description: 'Control de asistencia diaria con geolocalización, verificación de oficina/campo, registro de salidas intermedias y exportación de reportes PDF.',
    tag: 'Universal',
    path: '/tools/attendance-tracker',
  },
  'evidence-board': {
    icon: '📋',
    description: 'Tablero centralizado de evidencias HSEQ en PDF almacenadas en Google Drive, con filtros por localizador, proyecto y fecha.',
    tag: 'HSEQ / Evidencias',
    path: '/tools/evidence-board',
  },
  'cartas-audit': {
    icon: '📑',
    description: 'Panel de auditoría y fiscalización de cartas RRHH y certificaciones emitidas, con previsualización del texto, visor PDF y descarga Word.',
    tag: 'Recursos Humanos',
    path: '/tools/cartas-audit',
  },
  'elaboracion-cartas': {
    icon: '📄',
    description: 'Generador oficial de cartas laborales, permisos, vinculaciones a proyecto y paz y salvo con descarga DOCX/PDF y envío por correo.',
    tag: 'Recursos Humanos',
    path: '/forms/elaboracion-cartas',
  },
};

const CATEGORY_STYLE: Record<string, { label: string; bg: string; border: string; text: string }> = {
  gpr: { label: 'GPR', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  cad: { label: 'CAD / BIM', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  admin: { label: 'Administración', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  universal: { label: 'Universal', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  hseq: { label: 'HSEQ', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  rrhh: { label: 'Recursos Humanos', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
};

export default function AdminToolsPage() {
  const [activeTab, setActiveTab] = useState<'tools' | 'audit'>('tools');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'audit') {
        setActiveTab('audit');
      }
    }
  }, []);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['admin-tools'],
    queryFn: fetchToolsData,
  });

  const filteredTools = tools.filter((t) => {
    const meta = TOOL_META[t.slug];
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (meta?.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (meta?.tag ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { key: 'all', label: 'Todas las áreas', count: tools.length },
    { key: 'gpr', label: 'GPR / Geofísica', count: tools.filter((t) => t.category === 'gpr').length },
    { key: 'cad', label: 'CAD / BIM', count: tools.filter((t) => t.category === 'cad').length },
    { key: 'admin', label: 'Administración', count: tools.filter((t) => t.category === 'admin').length },
    { key: 'rrhh', label: 'Recursos Humanos', count: tools.filter((t) => t.category === 'rrhh').length },
    { key: 'universal', label: 'Universal', count: tools.filter((t) => t.category === 'universal').length },
    { key: 'hseq', label: 'HSEQ', count: tools.filter((t) => t.category === 'hseq').length },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Wrench className="w-7 h-7 text-accent" strokeWidth={1.75} /> Catálogo de Herramientas Técnicas
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Utilidades de procesamiento geofísico, productividad, análisis SIG y módulos especializados
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs text-white flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                <span>{tools.length} Herramientas activas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Barra superior de pestañas y búsqueda */}
        <div className="card border border-border shadow-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs principales */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'tools'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>🛠️</span> Herramientas
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'tools' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-text-muted'
              }`}>
                {tools.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'audit'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>📑</span> Auditoría Cartas RRHH
            </button>
          </div>

          {/* Buscador */}
          {activeTab === 'tools' && (
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" strokeWidth={2} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar herramienta por nombre, categoría o función..."
                className="input pl-9 text-xs py-2 w-full"
              />
            </div>
          )}
        </div>

        {activeTab === 'tools' ? (
          <div className="card border border-border shadow-xl overflow-hidden">
            {/* Header con filtro de categorías */}
            <div className="px-5 py-4 border-b border-border bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-text-primary text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} /> Filtrar por Área Técnica
                </h2>
              </div>

              {/* Filtro por Categoría */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategoryFilter(cat.key)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                      categoryFilter === cat.key
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-text-muted hover:text-text-primary border border-border hover:border-gray-300'
                    }`}
                  >
                    {cat.label}
                    <span className="ml-1 text-[10px] opacity-75">({cat.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Listado de Herramientas */}
            {isLoading ? (
              <div className="p-10 text-center text-text-muted animate-pulse">Cargando herramientas...</div>
            ) : filteredTools.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-text-muted text-sm">No se encontraron herramientas con los filtros actuales.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTools.map((tool) => {
                  const meta = TOOL_META[tool.slug] || {
                    icon: '🔧',
                    description: 'Módulo funcional de la plataforma PROCIMEC.',
                    tag: 'Técnica',
                    path: `/tools/${tool.slug}`,
                  };
                  const catStyle = CATEGORY_STYLE[tool.category] || {
                    label: tool.category,
                    bg: 'bg-gray-50',
                    border: 'border-gray-200',
                    text: 'text-gray-700',
                  };

                  const href = meta.path || `/tools/${tool.slug}`;

                  return (
                    <div
                      key={tool.id}
                      className="px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      {/* Ícono y datos */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white border border-border flex items-center justify-center text-2xl flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                              {tool.name}
                            </h3>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}
                            >
                              {catStyle.label}
                            </span>
                            {tool.is_universal && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                                Universal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      {/* Botón de acción */}
                      <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-600 transition-all shadow-xs group-hover:scale-102"
                        >
                          <span>Abrir Herramienta</span>
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <HrLettersAuditPanel />
        )}

        {/* Banner Informativo */}
        <div className="card border border-border p-5 bg-gradient-to-r from-blue-50/60 to-primary-50/40 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text-primary text-sm">
                Asignación de Herramientas Técnicas
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Las herramientas técnicas se habilitan según el perfil del colaborador. Para configurar qué herramientas están disponibles para cada cargo, dirígete a{' '}
                <Link href="/admin/roles" className="text-primary font-bold hover:underline">
                  Gestión de Roles →
                </Link>{' '}
                y edita los permisos correspondientes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
