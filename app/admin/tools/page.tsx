'use client';

import { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  is_universal: boolean;
}

async function fetchToolsData(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  const json = await res.json();
  return (json.data ?? []) as Tool[];
}

const TOOL_META: Record<string, { description: string; tag: string; path?: string }> = {
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

function renderToolIcon(slug: string) {
  const props = { className: 'w-5 h-5 text-accent', strokeWidth: 1.75 };
  switch (slug) {
    case 'radargrama':
    case 'gsf-processor':
      return <Radio {...props} />;
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
    case 'commercial-clients':
      return <Briefcase {...props} />;
    case 'finance-expenses-board':
      return <Wallet {...props} />;
    case 'accounting-invoices-board':
      return <Calculator {...props} />;
    case 'forms-audit':
      return <ClipboardCheck {...props} />;
    case 'version-control':
      return <ShieldCheck {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

const CATEGORY_STYLE: Record<string, { label: string; bg: string; border: string; text: string }> = {
  gpr: { label: 'GPR / Geofísica', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  cad: { label: 'CAD / BIM', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  admin: { label: 'Administración', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  universal: { label: 'Universal', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  hseq: { label: 'HSEQ', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800' },
  rrhh: { label: 'Recursos Humanos', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  warehouse: { label: 'Almacén', bg: 'bg-amber-100/70', border: 'border-amber-300', text: 'text-amber-900' },
  purchasing: { label: 'Compras', bg: 'bg-blue-100/70', border: 'border-blue-300', text: 'text-blue-900' },
  commercial: { label: 'Comercial', bg: 'bg-emerald-100/70', border: 'border-emerald-300', text: 'text-emerald-900' },
  finance: { label: 'Finanzas', bg: 'bg-violet-100/70', border: 'border-violet-300', text: 'text-violet-900' },
  accounting: { label: 'Contabilidad', bg: 'bg-cyan-100/70', border: 'border-cyan-300', text: 'text-cyan-900' },
  management: { label: 'Gerencia', bg: 'bg-purple-100/70', border: 'border-purple-300', text: 'text-purple-900' },
};

const ORDERED_CATEGORY_KEYS = [
  'all',
  'gpr',
  'cad',
  'warehouse',
  'purchasing',
  'commercial',
  'finance',
  'accounting',
  'hseq',
  'rrhh',
  'admin',
  'universal',
] as const;

export default function AdminToolsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['admin-tools'],
    queryFn: fetchToolsData,
  });

  const categories = useMemo(() => {
    return ORDERED_CATEGORY_KEYS.map((key) => {
      if (key === 'all') {
        return { key, label: 'Todas las áreas', count: tools.length };
      }
      const catMeta = CATEGORY_STYLE[key] || { label: key };
      const count = tools.filter((t) => t.category === key).length;
      return {
        key,
        label: catMeta.label,
        count,
      };
    }).filter((c) => c.key === 'all' || c.count > 0);
  }, [tools]);

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

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
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
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-5">
        {/* Barra de Control Unificada: Búsqueda Rápida + Selector de Rol/Área Integrado */}
        <div className="card border border-border shadow-md p-4 sm:p-5 space-y-3.5 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Título de sección y contador dinámico */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                <Wrench className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Módulos Especializados</h2>
                <p className="text-xs text-text-muted font-mono">
                  {filteredTools.length} de {tools.length} herramienta{tools.length !== 1 ? 's' : ''} activa{tools.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Input de Búsqueda y Dropdown de Rol en un solo bloque integrado */}
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              {/* Dropdown de Rol / Área técnica */}
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chips horizontales de acceso rápido en el mismo contenedor */}
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
                  className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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

        {/* Listado de Herramientas */}
        <div className="card border border-border shadow-md overflow-hidden bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted text-sm animate-pulse">
              Cargando catálogo de herramientas técnicas...
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="p-12 text-center space-y-2">
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
                  className="mt-2 text-xs font-semibold text-primary underline"
                >
                  Restablecer todos los filtros
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTools.map((tool) => {
                const meta = TOOL_META[tool.slug] || {
                  description: 'Módulo funcional del ecosistema PROCIMEC.',
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
                    className="px-5 py-4 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Ícono Lucide vectorial y datos de la herramienta */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-primary/5 border border-border flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        {renderToolIcon(tool.slug)}
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
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    {/* Botón de acción */}
                    <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 transition-all shadow-xs group-hover:scale-[1.02]"
                      >
                        <span>Abrir Herramienta</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                Las herramientas técnicas se habilitan según el perfil y asignación del colaborador. Para configurar qué herramientas están disponibles para cada cargo, dirígete a{' '}
                <Link href="/admin/roles" className="text-primary font-bold hover:underline">
                  Gestión de Roles →
                </Link>{' '}
                o en{' '}
                <Link href="/admin/users" className="text-primary font-bold hover:underline">
                  Gestión de Usuarios →
                </Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
