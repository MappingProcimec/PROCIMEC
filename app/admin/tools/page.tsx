'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import {
  Wrench,
  Search,
  ArrowRight,
  ShieldCheck,
  Filter,
  Radio,
  BarChart2,
  PenTool,
  FileText,
  Database,
  Map,
  MessageSquare,
  Mic,
  Building2,
  Layers,
  Clock,
  ClipboardList,
  FileCheck,
  FileSignature,
  Boxes,
  ShoppingBag,
  Briefcase,
  Wallet,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  Cpu,
  X,
  Activity,
  Users,
  Grid3X3,
  List,
  ChevronRight,
} from 'lucide-react';

import {
  CANONICAL_TOOL_CATEGORY_STYLES,
  ORDERED_TOOL_CANONICAL_KEYS,
  type CanonicalToolCategory,
  type FormCategoryMeta,
} from '@/lib/forms-categories';

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  is_universal: boolean;
}

interface ToolGroup {
  categoryKey: CanonicalToolCategory;
  categoryMeta: FormCategoryMeta;
  items: Tool[];
}

async function fetchToolsData(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  const json = await res.json();
  return (json.data ?? []) as Tool[];
}

const TOOL_META: Record<string, { description: string; tag: string; path?: string }> = {
  'gpr-cad-studio': {
    description: 'Estudio y orquestador inteligente de 5 pasos para procesamiento de datos crudos GPR, planos 2D DWG, modelos 3D RVT e informes con APU.',
    tag: 'GPR / Geofísica',
    path: '/tools/gpr-cad-studio',
  },
  'dev-tickets': {
    description: 'Gestión de tickets, especificación técnica por IA, aprobación exclusiva del admin y ciclo DevOps.',
    tag: 'DevOps / Admin',
    path: '/tools/dev-tickets',
  },
  'radargrama': {
    description: 'Visualizador y procesador interactivo de radargramas GPR, filtros DSP y análisis geofísico.',
    tag: 'GPR / Geofísica',
    path: '/tools/radargrama',
  },
  'gsf-processor': {
    description: 'Procesamiento de radargramas GPR (.gsf), filtros DSP, dewow, corrección time-zero, análisis hiperbólico y exportación a JPG, PDF y PPTX.',
    tag: 'GPR / Geofísica',
    path: '/tools/gsf-processor',
  },
  'cad-productivity-board': {
    description: 'Métricas de productividad de modeladores CAD/BIM, control de horas hombre, entregables y distribución por software.',
    tag: 'CAD / BIM',
    path: '/tools/cad-productivity-board',
  },
  'txt-dwg-viewer': {
    description: 'Visualizador de archivos de coordenadas topográficas TXT y exportador para dibujo y plataformas CAD.',
    tag: 'Topografía / CAD',
    path: '/tools/txt-dwg-viewer',
  },
  'docx-generator': {
    description: 'Generador de reportes técnicos formales en formato Word (.docx) con soporte fotográfico y tablas operacionales.',
    tag: 'Informes Técnicos',
    path: '/tools/docx-generator',
  },
  'backup-script-gen': {
    description: 'Generador automatizado de scripts para sincronización y respaldo local seguro de datos de campo.',
    tag: 'Seguridad / Datos',
    path: '/tools/backup-script-gen',
  },
  'gis-viewer': {
    description: 'Base de datos geográfica integrada (2D y 3D) para consulta y modelado de servicios públicos e infraestructura.',
    tag: 'Sistemas GIS',
    path: '/tools/gis-viewer',
  },
  'internal-chat': {
    description: 'Canal de mensajería interna corporativa y conversión directa de notas de trabajo en tareas de proyecto.',
    tag: 'Comunicación',
    path: '/tools/internal-chat',
  },
  'meeting-transcriber': {
    description: 'Módulo de grabación, transcripción asistida y resumen de acuerdos para reuniones técnicas de ingeniería.',
    tag: 'Productividad',
    path: '/tools/meeting-transcriber',
  },
  'org-chart-ai': {
    description: 'Organigrama empresarial interactivo para navegación de roles, responsabilidades y estructura de equipo.',
    tag: 'Organización',
    path: '/tools/org-chart-ai',
  },
  'dynamic-dashboard': {
    description: 'Panel dinámico para acceso rápido a herramientas, formularios y actividades recientes según el rol del usuario.',
    tag: 'Universal',
    path: '/dashboard',
  },
  'attendance-tracker': {
    description: 'Control de asistencia diaria con geolocalización, verificación de oficina/campo, registro de salidas intermedias y exportación de reportes PDF.',
    tag: 'Universal',
    path: '/tools/attendance-tracker',
  },
  'evidence-board': {
    description: 'Tablero centralizado de evidencias HSEQ en PDF almacenadas en Google Drive, con filtros por localizador, proyecto y fecha.',
    tag: 'HSEQ / Evidencias',
    path: '/tools/evidence-board',
  },
  'cartas-audit': {
    description: 'Panel de auditoría y fiscalización de cartas RRHH y certificaciones emitidas, con previsualización del texto, visor PDF y descarga Word.',
    tag: 'Recursos Humanos',
    path: '/tools/cartas-audit',
  },
  'elaboracion-cartas': {
    description: 'Generador oficial de cartas laborales, permisos, vinculaciones a proyecto y paz y salvo con descarga DOCX/PDF y envío por correo.',
    tag: 'Recursos Humanos',
    path: '/forms/elaboracion-cartas',
  },
  'warehouse-inventory': {
    description: 'Gestión en tiempo real del stock de instrumental, trazabilidad de equipos en campo, control de calibraciones y kárdex histórico de movimientos.',
    tag: 'Almacén',
    path: '/tools/warehouse-inventory',
  },
  'purchasing-dashboard': {
    description: 'Monitoreo de solicitudes de compra, órdenes de compra emitidas, control de entregas de insumos y calificación de proveedores.',
    tag: 'Compras',
    path: '/tools/purchasing-dashboard',
  },
  'purchasing-suppliers': {
    description: 'Directorio maestro, homologación técnica, condiciones comerciales, cuentas bancarias e historial de órdenes de proveedores.',
    tag: 'Compras',
    path: '/tools/purchasing-suppliers',
  },
  'commercial-pipeline': {
    description: 'Seguimiento integral del embudo comercial, licitaciones activas, cotizaciones emitidas a clientes y control de cierres de negocio.',
    tag: 'Comercial',
    path: '/tools/commercial-pipeline',
  },
  'commercial-clients': {
    description: 'Directorio corporativo, seguimiento de cuentas, sectores económicos, condiciones comerciales y ficha técnica de clientes.',
    tag: 'Comercial',
    path: '/tools/commercial-clients',
  },
  'finance-expenses-board': {
    description: 'Administración y fiscalización de anticipos de viáticos, liquidación de gastos de campo y comprobantes de egreso.',
    tag: 'Finanzas',
    path: '/tools/finance-expenses-board',
  },
  'accounting-invoices-board': {
    description: 'Gestión de facturas de proveedores radicadas para pago y actas de corte de obra aprobadas para facturación al cliente.',
    tag: 'Contabilidad',
    path: '/tools/accounting-invoices-board',
  },
  'forms-audit': {
    description: 'Consola unificada para la fiscalización, trazabilidad universal y auditoría de archivos de todos los formatos operativos.',
    tag: 'Auditoría y Control',
    path: '/tools/forms-audit',
  },
  'version-control': {
    description: 'Listado maestro oficial de formatos, control de cambios, versiones vigentes y descarga de plantillas del SIG.',
    tag: 'HSEQ / Calidad',
    path: '/tools/version-control',
  },
};

function renderCategoryIcon(categoryKey: string, className = 'w-7 h-7 sm:w-8 sm:h-8') {
  const props = { className, strokeWidth: 1.75 };
  switch (categoryKey) {
    case 'gpr':
      return <Radio {...props} />;
    case 'cad':
      return <PenTool {...props} />;
    case 'hseq':
      return <ShieldCheck {...props} />;
    case 'warehouse':
      return <Boxes {...props} />;
    case 'purchasing':
      return <ShoppingBag {...props} />;
    case 'commercial':
      return <Briefcase {...props} />;
    case 'finance':
      return <Wallet {...props} />;
    case 'accounting':
      return <Calculator {...props} />;
    case 'rrhh':
      return <FileSignature {...props} />;
    case 'admin':
      return <Building2 {...props} />;
    case 'universal':
      return <Layers {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

function renderToolIcon(slug: string, className = 'w-6 h-6 sm:w-7 sm:h-7 text-accent') {
  const props = { className, strokeWidth: 1.75 };
  switch (slug) {
    case 'gpr-cad-studio':
      return <Cpu {...props} />;
    case 'radargrama':
      return <Radio {...props} />;
    case 'gsf-processor':
      return <Activity {...props} />;
    case 'cad-productivity-board':
      return <BarChart2 {...props} />;
    case 'txt-dwg-viewer':
      return <PenTool {...props} />;
    case 'docx-generator':
      return <FileText {...props} />;
    case 'backup-script-gen':
      return <Database {...props} />;
    case 'gis-viewer':
      return <Map {...props} />;
    case 'internal-chat':
      return <MessageSquare {...props} />;
    case 'meeting-transcriber':
      return <Mic {...props} />;
    case 'org-chart-ai':
      return <Building2 {...props} />;
    case 'dynamic-dashboard':
      return <Layers {...props} />;
    case 'attendance-tracker':
      return <Clock {...props} />;
    case 'evidence-board':
      return <ClipboardList {...props} />;
    case 'cartas-audit':
      return <FileCheck {...props} />;
    case 'elaboracion-cartas':
      return <FileSignature {...props} />;
    case 'warehouse-inventory':
      return <Boxes {...props} />;
    case 'purchasing-dashboard':
    case 'purchasing-suppliers':
      return <ShoppingBag {...props} />;
    case 'commercial-pipeline':
      return <Briefcase {...props} />;
    case 'commercial-clients':
      return <Users {...props} />;
    case 'finance-expenses-board':
      return <Wallet {...props} />;
    case 'accounting-invoices-board':
      return <Calculator {...props} />;
    case 'forms-audit':
      return <ClipboardCheck {...props} />;
    case 'version-control':
      return <ShieldCheck {...props} />;
    case 'dev-tickets':
      return <Cpu {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

export default function AdminToolsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'expanded'>('grouped');
  const [activeToolGroup, setActiveToolGroup] = useState<ToolGroup | null>(null);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['admin-tools'],
    queryFn: fetchToolsData,
  });

  // Manejo de tecla Escape para cerrar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveToolGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Bloqueo de scroll cuando el modal está abierto
  useEffect(() => {
    if (activeToolGroup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeToolGroup]);

  // Contadores para chips y selector
  const categories = useMemo(() => {
    return ORDERED_TOOL_CANONICAL_KEYS.map((key) => {
      if (key === 'all') {
        return { key, label: 'Todas las áreas', count: tools.length };
      }
      const catMeta = CANONICAL_TOOL_CATEGORY_STYLES[key];
      const count = tools.filter((t) => t.category === key).length;
      return {
        key,
        label: catMeta?.label || key,
        count,
      };
    }).filter((c) => c.key === 'all' || c.count > 0);
  }, [tools]);

  // Filtrado reactivo de herramientas
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const meta = TOOL_META[t.slug];
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const s = search.toLowerCase().trim();
      const matchesSearch =
        !s ||
        t.name.toLowerCase().includes(s) ||
        t.slug.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s) ||
        (meta?.description ?? '').toLowerCase().includes(s) ||
        (meta?.tag ?? '').toLowerCase().includes(s);
      return matchesCategory && matchesSearch;
    });
  }, [tools, categoryFilter, search]);

  // Agrupación canónica por Grupos (igual que en el Dashboard Inicial)
  const toolGroups = useMemo<ToolGroup[]>(() => {
    const grouped: Record<string, Tool[]> = {};
    filteredTools.forEach((t) => {
      const cat = t.category || 'universal';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    return ORDERED_TOOL_CANONICAL_KEYS
      .filter((k): k is CanonicalToolCategory => k !== 'all' && Boolean(grouped[k]?.length))
      .map((k) => ({
        categoryKey: k,
        categoryMeta: CANONICAL_TOOL_CATEGORY_STYLES[k] || {
          key: k,
          label: k.toUpperCase(),
          badgeLabel: k.toUpperCase(),
          description: 'Módulos especializados',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          accentColor: 'text-gray-600',
          containerBg: 'bg-gray-50 border-gray-200',
        },
        items: grouped[k] || [],
      }));
  }, [filteredTools]);

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Wrench className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Catálogo de Herramientas Técnicas
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Utilidades de procesamiento geofísico, productividad, análisis SIG y módulos especializados
              </p>
            </div>

            {/* Selector de Modo de Vista */}
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-accent text-primary-950 font-bold shadow-xs'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
                title="Vista agrupada por categorías (estilo Mi Panel)"
              >
                <Grid3X3 className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Por Grupos</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('expanded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'expanded'
                    ? 'bg-accent text-primary-950 font-bold shadow-xs'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
                title="Vista con todas las herramientas desplegadas"
              >
                <List className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Desplegadas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Barra de Control Unificada: Búsqueda Rápida + Selector de Área Integrado */}
        <div className="card border border-border shadow-md p-4 sm:p-5 space-y-3.5 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Título de sección y contador dinámico */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                <Wrench className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Módulos Especializados</h2>
                <p className="text-xs text-text-muted font-mono">
                  {filteredTools.length} de {tools.length} herramienta{tools.length !== 1 ? 's' : ''} en {toolGroups.length} grupo{toolGroups.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Input de Búsqueda y Dropdown de Área en un solo bloque integrado */}
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              {/* Dropdown de Área técnica */}
              <div className="relative flex-shrink-0">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs font-semibold py-2 pl-3 pr-7 rounded-xl border border-border bg-gray-50 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} ({c.count})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Buscador */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" strokeWidth={1.75} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar herramienta por nombre, categoría o función..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface placeholder:text-text-muted"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chips horizontales de acceso rápido */}
          <div className="pt-3 border-t border-border flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} /> Área:
            </span>
            {categories.map((cat) => {
              const isActive = categoryFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-xs ring-1 ring-accent'
                      : 'bg-gray-50 text-text-secondary hover:text-text-primary hover:bg-gray-100 border border-border'
                  }`}
                >
                  {cat.label}
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200/70 text-text-muted'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: VISTA POR GRUPOS O VISTA DESPLEGADA */}
        {isLoading ? (
          <div className="card border border-border p-12 text-center text-text-muted text-sm bg-white animate-pulse">
            Cargando catálogo de herramientas técnicas...
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="card border border-border p-12 text-center space-y-2 bg-white">
            <Wrench className="w-10 h-10 text-text-muted mx-auto stroke-1" />
            <p className="font-semibold text-text-primary text-sm">
              No se encontraron herramientas con los filtros actuales
            </p>
            <p className="text-xs text-text-muted">
              Prueba cambiando el término de búsqueda o seleccionando otra área técnica.
            </p>
            {(search || categoryFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCategoryFilter('all'); }}
                className="mt-2 text-xs font-semibold text-primary underline cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            )}
          </div>
        ) : viewMode === 'grouped' && !search ? (
          /* ─────────────────────────────────────────────────────────── */
          /* 1. VISTA POR GRUPOS (EXACTA AL DASHBOARD INICIAL + ICONOS GRANDES) */
          /* ─────────────────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Grupos Técnicos</h3>
                <p className="text-xs text-text-muted">
                  Selecciona una categoría técnica para abrir los tableros, visores y módulos operativos
                </p>
              </div>
              <span className="text-xs text-text-muted font-mono">
                {toolGroups.length} grupo{toolGroups.length !== 1 ? 's' : ''} activos
              </span>
            </div>

            {/* Rejilla de Tarjetas de Grupo con Íconos Grandes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {toolGroups.map((group) => {
                const { categoryKey, categoryMeta, items } = group;
                return (
                  <button
                    key={categoryKey}
                    type="button"
                    onClick={() => setActiveToolGroup(group)}
                    className="card border border-border p-5 hover:border-accent hover:shadow-lg transition-all text-left flex items-center justify-between gap-4 group cursor-pointer bg-white relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Ícono de Categoría Más Grande */}
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${categoryMeta.containerBg}`}
                      >
                        <div className={categoryMeta.accentColor}>
                          {renderCategoryIcon(categoryKey, 'w-7 h-7 sm:w-8 sm:h-8')}
                        </div>
                      </div>

                      {/* Información del Grupo */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm sm:text-base font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                            {categoryMeta.label}
                          </p>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-1 mb-1.5">
                          {categoryMeta.description}
                        </p>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-text-muted border border-gray-200">
                          {items.length} {items.length === 1 ? 'herramienta' : 'herramientas'}
                        </span>
                      </div>
                    </div>

                    {/* Flecha indicadora */}
                    <ChevronRight
                      className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0"
                      strokeWidth={2}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────── */
          /* 2. VISTA DESPLEGADA (O RESULTADOS DE BÚSQUEDA)              */
          /* ─────────────────────────────────────────────────────────── */
          <div className="space-y-6">
            {toolGroups.map((group) => {
              const { categoryKey, categoryMeta, items } = group;
              return (
                <div key={categoryKey} className="card border border-border shadow-sm overflow-hidden bg-white">
                  {/* Encabezado del Grupo */}
                  <div className="px-5 py-3.5 bg-surface/60 border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${categoryMeta.containerBg}`}>
                        <div className={categoryMeta.accentColor}>
                          {renderCategoryIcon(categoryKey, 'w-5 h-5')}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-text-primary">
                          {categoryMeta.label}
                        </h3>
                        <p className="text-xs text-text-muted">
                          {categoryMeta.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-white border border-border text-text-primary">
                      {items.length} {items.length === 1 ? 'módulo' : 'módulos'}
                    </span>
                  </div>

                  {/* Listado con Íconos Grandes */}
                  <div className="divide-y divide-border">
                    {items.map((tool) => {
                      const meta = TOOL_META[tool.slug] || {
                        description: 'Módulo funcional del ecosistema PROCIMEC.',
                        tag: categoryMeta.label,
                        path: `/tools/${tool.slug}`,
                      };
                      const href = meta.path || `/tools/${tool.slug}`;

                      return (
                        <div
                          key={tool.id}
                          className="px-5 py-4 hover:bg-gray-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Contenedor de Ícono Grande para la Herramienta */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform group-hover:border-accent/40">
                              {renderToolIcon(tool.slug, 'w-6 h-6 sm:w-7 sm:h-7 text-accent')}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-sm sm:text-base text-text-primary group-hover:text-primary transition-colors">
                                  {tool.name}
                                </h4>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryMeta.bg} ${categoryMeta.border} ${categoryMeta.text}`}
                                >
                                  {categoryMeta.badgeLabel}
                                </span>
                                {tool.is_universal && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                                    <Layers className="w-3 h-3" strokeWidth={1.75} /> Universal
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-text-muted bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                  {href}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                                {meta.description}
                              </p>
                            </div>
                          </div>

                          {/* Botón de Acción */}
                          <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 transition-all shadow-xs group-hover:scale-[1.02] cursor-pointer"
                            >
                              <span>Abrir Herramienta</span>
                              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Banner Informativo de Ecosistema */}
        <div className="card border border-border p-5 bg-gradient-to-r from-blue-50/60 to-primary-50/40 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-primary">
                Capa 3 de Consolidación Operativa (Tools & Dashboards)
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Todas las herramientas consolidan los datos capturados en los formularios operacionales para generar analítica, modelos BIM, radargramas GPR y trazabilidad en tiempo real. Para gestionar el acceso por roles, utiliza el{' '}
                <Link href="/admin/roles" className="text-primary font-bold underline hover:text-accent transition-colors">
                  Panel de Administración de Roles
                </Link>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* VENTANA FLOTANTE (MODAL): HERRAMIENTAS DE UN GRUPO          */}
      {/* (Idéntico estándar visual del Dashboard Inicial con Íconos Grandes) */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeToolGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveToolGroup(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 shadow-xs ${activeToolGroup.categoryMeta.containerBg}`}
                >
                  <div className={activeToolGroup.categoryMeta.accentColor}>
                    {renderCategoryIcon(activeToolGroup.categoryKey, 'w-6 h-6')}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-base sm:text-lg truncate">
                    {activeToolGroup.categoryMeta.label}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {activeToolGroup.items.length} {activeToolGroup.items.length === 1 ? 'herramienta disponible' : 'herramientas disponibles'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveToolGroup(null)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Lista de Herramientas con Íconos Grandes */}
            <div className="p-3 sm:p-4 overflow-y-auto divide-y divide-border/60">
              {activeToolGroup.items.map((tool) => {
                const meta = TOOL_META[tool.slug] || {
                  description: 'Módulo funcional del ecosistema PROCIMEC.',
                  tag: activeToolGroup.categoryMeta.label,
                  path: `/tools/${tool.slug}`,
                };
                const href = meta.path || `/tools/${tool.slug}`;

                return (
                  <div
                    key={tool.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <Link
                      href={href}
                      onClick={() => setActiveToolGroup(null)}
                      className="flex items-start gap-3.5 min-w-0 flex-1 pr-1 cursor-pointer"
                    >
                      {/* Ícono Más Grande para la Herramienta */}
                      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-accent group-hover:border-accent/50 group-hover:scale-105 transition-all flex-shrink-0 shadow-xs">
                        {renderToolIcon(tool.slug, 'w-6 h-6 text-accent')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                            {tool.name}
                          </p>
                          {tool.is_universal && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5" /> Universal
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-text-muted mb-1">
                          {href}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {meta.description}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center justify-end sm:justify-start flex-shrink-0">
                      <Link
                        href={href}
                        onClick={() => setActiveToolGroup(null)}
                        className="btn-accent text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-transform active:scale-[0.98] cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer del Modal */}
            <div className="p-3 bg-surface border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted font-mono">PROCIMEC · PCM CLOUD</span>
              <button
                type="button"
                onClick={() => setActiveToolGroup(null)}
                className="btn-secondary text-xs px-3.5 py-1.5 font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
