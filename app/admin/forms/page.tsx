'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  ArrowRight,
  Paperclip,
  ShieldCheck,
  Filter,
  Radio,
  PenTool,
  FileSignature,
  Boxes,
  Truck,
  RotateCcw,
  ShoppingCart,
  FileText,
  Star,
  Target,
  BarChart2,
  CheckCircle2,
  Plane,
  Receipt,
  CreditCard,
  FileSpreadsheet,
  DollarSign,
  ChevronDown,
  X,
  Calculator,
} from 'lucide-react';

interface Form {
  id: string;
  slug: string;
  name: string;
  description?: string;
  steps_count: number;
  has_attachments: boolean;
  created_at?: string;
}

async function fetchFormsData(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return (json.data ?? []) as Form[];
}

const FORM_CATEGORY: Record<string, string> = {
  'gpr-field-form': 'gpr',
  'cad-register-form': 'cad',
  'hseq-report': 'hseq',
  'elaboracion-cartas': 'rrhh',
  'registro-equipo': 'warehouse',
  'despacho-equipo': 'warehouse',
  'retorno-equipo': 'warehouse',
  'requerimiento-compra': 'purchasing',
  'orden-compra': 'purchasing',
  'evaluacion-proveedor': 'purchasing',
  'registro-oportunidad': 'commercial',
  'presupuesto-proyecto': 'commercial',
  'cotizacion-comercial': 'commercial',
  'cierre-comercial': 'commercial',
  'solicitud-viaticos': 'finance',
  'legalizacion-gastos': 'finance',
  'registro-pago': 'finance',
  'radicacion-factura': 'accounting',
  'soporte-cobro': 'accounting',
};

const CATEGORY_STYLE: Record<string, { label: string; bg: string; border: string; text: string }> = {
  gpr: { label: 'GPR / Geofísica', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  cad: { label: 'CAD / BIM', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  hseq: { label: 'HSEQ', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800' },
  rrhh: { label: 'Recursos Humanos', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  warehouse: { label: 'Almacén', bg: 'bg-amber-100/70', border: 'border-amber-300', text: 'text-amber-900' },
  purchasing: { label: 'Compras', bg: 'bg-blue-100/70', border: 'border-blue-300', text: 'text-blue-900' },
  commercial: { label: 'Comercial', bg: 'bg-emerald-100/70', border: 'border-emerald-300', text: 'text-emerald-900' },
  finance: { label: 'Finanzas', bg: 'bg-violet-100/70', border: 'border-violet-300', text: 'text-violet-900' },
  accounting: { label: 'Contabilidad', bg: 'bg-cyan-100/70', border: 'border-cyan-300', text: 'text-cyan-900' },
  general: { label: 'General', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
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
] as const;

function renderFormIcon(slug: string) {
  const props = { className: 'w-5 h-5 text-accent', strokeWidth: 1.75 };
  switch (slug) {
    case 'gpr-field-form':
      return <Radio {...props} />;
    case 'cad-register-form':
      return <PenTool {...props} />;
    case 'hseq-report':
      return <ShieldCheck {...props} />;
    case 'elaboracion-cartas':
      return <FileSignature {...props} />;
    case 'registro-equipo':
      return <Boxes {...props} />;
    case 'despacho-equipo':
      return <Truck {...props} />;
    case 'retorno-equipo':
      return <RotateCcw {...props} />;
    case 'requerimiento-compra':
      return <ShoppingCart {...props} />;
    case 'orden-compra':
      return <FileText {...props} />;
    case 'evaluacion-proveedor':
      return <Star {...props} />;
    case 'registro-oportunidad':
      return <Target {...props} />;
    case 'presupuesto-proyecto':
      return <Calculator {...props} />;
    case 'cotizacion-comercial':
      return <BarChart2 {...props} />;
    case 'cierre-comercial':
      return <CheckCircle2 {...props} />;
    case 'solicitud-viaticos':
      return <Plane {...props} />;
    case 'legalizacion-gastos':
      return <Receipt {...props} />;
    case 'registro-pago':
      return <CreditCard {...props} />;
    case 'radicacion-factura':
      return <FileSpreadsheet {...props} />;
    case 'soporte-cobro':
      return <DollarSign {...props} />;
    default:
      return <ClipboardList {...props} />;
  }
}

export default function AdminFormsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['admin-forms'],
    queryFn: fetchFormsData,
  });

  const categories = useMemo(() => {
    return ORDERED_CATEGORY_KEYS.map((key) => {
      if (key === 'all') {
        return { key, label: 'Todas las áreas', count: forms.length };
      }
      const catMeta = CATEGORY_STYLE[key] || { label: key };
      const count = forms.filter((f) => (FORM_CATEGORY[f.slug] || 'general') === key).length;
      return {
        key,
        label: catMeta.label,
        count,
      };
    }).filter((c) => c.key === 'all' || c.count > 0);
  }, [forms]);

  const filteredForms = useMemo(() => {
    return forms.filter((f) => {
      const cat = FORM_CATEGORY[f.slug] || 'general';
      const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
      const s = search.toLowerCase().trim();
      const matchesSearch =
        !s ||
        f.name.toLowerCase().includes(s) ||
        f.slug.toLowerCase().includes(s) ||
        (f.description ?? '').toLowerCase().includes(s);
      return matchesCategory && matchesSearch;
    });
  }, [forms, categoryFilter, search]);

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <ClipboardList className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Catálogo de Formularios Operativos
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Formatos oficiales de captura de datos de PROCIMEC para campo, almacén, dibujo y operaciones
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-5">
        {/* Barra de Control Unificada: Contador + Búsqueda Rápida + Selector de Rol Integrado */}
        <div className="card border border-border shadow-md p-4 sm:p-5 space-y-3.5 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Título y conteo de formatos */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                <ClipboardList className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Formatos de Entrada</h2>
                <p className="text-xs text-text-muted font-mono">
                  {filteredForms.length} de {forms.length} formulario{forms.length !== 1 ? 's' : ''} disponible{forms.length !== 1 ? 's' : ''}
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
                  placeholder="Buscar formulario por nombre o slug..."
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

        {/* Listado de Formularios */}
        <div className="card border border-border shadow-md overflow-hidden bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted text-sm animate-pulse">
              Cargando catálogo de formularios operativos...
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <ClipboardList className="w-10 h-10 text-text-muted mx-auto stroke-1" />
              <p className="font-semibold text-text-primary text-sm">
                No se encontraron formularios con los filtros actuales
              </p>
              <p className="text-xs text-text-muted">
                Prueba ajustando el término de búsqueda o seleccionando otra área operativa.
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
              {filteredForms.map((form) => {
                const catKey = FORM_CATEGORY[form.slug] || 'general';
                const catStyle = CATEGORY_STYLE[catKey] || CATEGORY_STYLE.general;

                return (
                  <div
                    key={form.id}
                    className="px-5 py-4 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Ícono Lucide vectorial y datos del formulario */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-primary/5 border border-border flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        {renderFormIcon(form.slug)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                            {form.name}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}
                          >
                            {catStyle.label}
                          </span>
                          <span className="text-[10px] font-mono text-text-muted bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {form.slug}
                          </span>
                          {form.has_attachments && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" strokeWidth={2} /> Adjuntos
                            </span>
                          )}
                        </div>
                        {form.description && (
                          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                            {form.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botón de acción */}
                    <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                      <Link
                        href={`/forms/${form.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 transition-all shadow-xs group-hover:scale-[1.02]"
                      >
                        <span>Diligenciar Formulario</span>
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
                Asignación de Formularios a Roles
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Los formularios se asignan dinámicamente según el rol del colaborador. Para configurar qué formatos aparecen en &quot;Mis Formularios&quot; en el panel de cada usuario, dirígete a{' '}
                <Link href="/admin/roles" className="text-primary font-bold hover:underline">
                  Gestión de Roles →
                </Link>{' '}
                o visita el{' '}
                <Link href="/admin/tools" className="text-primary font-bold hover:underline">
                  Catálogo de Herramientas →
                </Link>{' '}
                para utilidades técnicas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
