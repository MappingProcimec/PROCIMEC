'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';

interface Form {
  id: string;
  slug: string;
  name: string;
  description?: string;
  steps_count: number;
  has_attachments: boolean;
  created_at?: string;
}

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: 'gpr' | 'cad' | 'admin' | 'universal';
  is_universal: boolean;
}

async function fetchCatalogData() {
  const [formsRes, toolsRes] = await Promise.all([
    fetch('/api/admin/forms'),
    fetch('/api/admin/tools'),
  ]);
  return {
    forms: ((await formsRes.json()).data ?? []) as Form[],
    tools: ((await toolsRes.json()).data ?? []) as Tool[],
  };
}

const TOOL_META: Record<string, { icon: string; description: string; tag: string; path?: string }> = {
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
    tag: 'Control / Asistencia',
    path: '/tools/attendance-tracker',
  },
};

const CATEGORY_STYLE: Record<string, { label: string; bg: string; border: string; text: string }> = {
  gpr: { label: 'GPR / Geofísica', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  cad: { label: 'CAD / BIM', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  admin: { label: 'Administración', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  universal: { label: 'Universal', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

const FORM_SLUG_STYLE: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  'gpr-field-form': { icon: '📍', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'cad-register-form': { icon: '✏️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
};

export default function AdminToolsAndFormsPage() {
  const [activeTab, setActiveTab] = useState<'tools' | 'forms' | 'all'>('tools');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tools-and-forms'],
    queryFn: fetchCatalogData,
  });

  const tools = data?.tools ?? [];
  const forms = data?.forms ?? [];

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

  const filteredForms = forms.filter((f) => {
    return (
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.slug.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const categories = [
    { key: 'all', label: 'Todas las áreas', count: tools.length },
    { key: 'gpr', label: 'GPR / Geofísica', count: tools.filter((t) => t.category === 'gpr').length },
    { key: 'cad', label: 'CAD / BIM', count: tools.filter((t) => t.category === 'cad').length },
    { key: 'admin', label: 'Administración', count: tools.filter((t) => t.category === 'admin').length },
    { key: 'universal', label: 'Universal', count: tools.filter((t) => t.category === 'universal').length },
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
                <span>🛠️</span> Herramientas y Formularios
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Catálogo centralizado de herramientas especializadas y formularios operacionales disponibles en la plataforma
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs text-white flex items-center gap-1.5 font-medium">
                <span>🔧</span> {tools.length} Herramientas
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs text-white flex items-center gap-1.5 font-medium">
                <span>📋</span> {forms.length} Formularios
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Barra superior de navegación por pestañas y búsqueda */}
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
              <span>🛠️</span> Catálogo de Herramientas
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'tools' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-text-muted'
              }`}>
                {tools.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'forms'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>📋</span> Catálogo de Formularios
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'forms' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-text-muted'
              }`}>
                {forms.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>🔍</span> Ver Todo
            </button>
          </div>

          {/* Buscador global */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar herramienta o formulario por nombre, área o función..."
              className="input pl-9 text-xs py-2 w-full"
            />
          </div>
        </div>

        {/* ─── 1. SECCIÓN DE HERRAMIENTAS ─── */}
        {(activeTab === 'tools' || activeTab === 'all') && (
          <div className="card border border-border shadow-xl overflow-hidden">
            {/* Header del Catálogo de Herramientas */}
            <div className="px-5 py-4 border-b border-border bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-text-primary flex items-center gap-2">
                  <span>🛠️</span> Catálogo de Herramientas Técnicas
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Módulos de procesamiento, análisis de datos, visualización y productividad
                </p>
              </div>

              {/* Filtro por Categoría */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategoryFilter(cat.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      categoryFilter === cat.key
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white border border-border text-text-muted hover:bg-gray-100 hover:text-text-primary'
                    }`}
                  >
                    {cat.label} ({cat.count})
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
                <p className="text-text-muted text-sm">No se encontraron herramientas que coincidan con los filtros.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTools.map((tool) => {
                  const meta = TOOL_META[tool.slug] || {
                    icon: '🔧',
                    description: 'Módulo técnico integrado a la plataforma PROCIMEC.',
                    tag: tool.category.toUpperCase(),
                    path: `/tools/${tool.slug}`,
                  };
                  const style = CATEGORY_STYLE[tool.category] || CATEGORY_STYLE.gpr;
                  const targetUrl = meta.path || `/tools/${tool.slug}`;

                  return (
                    <div
                      key={tool.id}
                      className="px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      {/* Información principal de la herramienta */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0 shadow-xs ${style.bg} ${style.border}`}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                              {tool.name}
                            </h3>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${style.bg} ${style.border} ${style.text}`}
                            >
                              {style.label}
                            </span>
                            {tool.is_universal && tool.category !== 'universal' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                                Acceso Universal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted font-mono mt-0.5">{tool.slug}</p>
                          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      {/* Botón de acción */}
                      <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                        <Link
                          href={targetUrl}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-600 transition-all shadow-xs group-hover:scale-102"
                        >
                          <span>Abrir Herramienta</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── 2. SECCIÓN DE FORMULARIOS ─── */}
        {(activeTab === 'forms' || activeTab === 'all') && (
          <div className="card border border-border shadow-xl overflow-hidden">
            {/* Header del Catálogo de Formularios */}
            <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-text-primary flex items-center gap-2">
                  <span>📋</span> Catálogo de Formularios Operativos
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Formatos de captura de datos para operadores de campo y modeladores de oficina
                </p>
              </div>
              <span className="badge badge-primary text-xs flex-shrink-0">
                {filteredForms.length} {filteredForms.length === 1 ? 'formulario' : 'formularios'}
              </span>
            </div>

            {/* Listado de Formularios */}
            {isLoading ? (
              <div className="p-10 text-center text-text-muted animate-pulse">Cargando formularios...</div>
            ) : filteredForms.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-text-muted text-sm">No se encontraron formularios con &quot;{search}&quot;.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredForms.map((form) => {
                  const style = FORM_SLUG_STYLE[form.slug] || {
                    icon: '📋',
                    bg: 'bg-gray-50',
                    border: 'border-gray-200',
                    text: 'text-gray-700',
                  };

                  return (
                    <div
                      key={form.id}
                      className="px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      {/* Ícono y datos */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0 shadow-xs ${style.bg} ${style.border}`}
                        >
                          {style.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                            {form.name}
                          </h3>
                          <p className="text-xs text-text-muted font-mono mt-0.5">{form.slug}</p>
                          {form.description && (
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                              {form.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Metadatos y Botón de acción */}
                      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          🪜 {form.steps_count} {form.steps_count === 1 ? 'paso' : 'pasos'}
                        </span>
                        {form.has_attachments && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                            📎 Archivos Adjuntos
                          </span>
                        )}
                        <Link
                          href={`/forms/${form.slug}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-600 transition-all shadow-xs group-hover:scale-102"
                        >
                          <span>Diligenciar Formulario</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Banner Informativo sobre Asignación a Roles */}
        <div className="card border border-border p-5 bg-gradient-to-r from-blue-50/60 to-primary-50/40 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
              💡
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text-primary text-sm">
                ¿Cómo asignar herramientas y formularios a los usuarios?
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Tanto las herramientas especializadas como los formularios se asignan por rol. Para habilitar o restringir el acceso a cualquier perfil técnico o división, ve a{' '}
                <Link href="/admin/roles" className="text-primary font-bold hover:underline">
                  Gestión de Roles →
                </Link>{' '}
                selecciona el rol correspondiente y podrás marcar con casillas exactamente qué módulos tendrá activos cada colaborador en su panel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
