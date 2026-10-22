'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Building2,
  ChevronRight,
  Grid3X3,
  List,
} from 'lucide-react';

import {
  CANONICAL_CATEGORY_STYLES,
  ORDERED_CANONICAL_KEYS,
  resolveCanonicalFormCategory,
  type CanonicalFormCategory,
  type FormCategoryMeta,
} from '@/lib/forms-categories';

interface Form {
  id: string;
  slug: string;
  name: string;
  category?: string;
  description?: string;
  steps_count: number;
  has_attachments: boolean;
  created_at?: string;
}

interface FormGroup {
  categoryKey: CanonicalFormCategory;
  categoryMeta: FormCategoryMeta;
  items: Form[];
}

async function fetchFormsData(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return (json.data ?? []) as Form[];
}

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
      return <ShoppingCart {...props} />;
    case 'commercial':
      return <Target {...props} />;
    case 'finance':
      return <DollarSign {...props} />;
    case 'accounting':
      return <FileSpreadsheet {...props} />;
    case 'rrhh':
      return <FileSignature {...props} />;
    default:
      return <ClipboardList {...props} />;
  }
}

function renderFormIcon(slug: string, className = 'w-6 h-6 sm:w-7 sm:h-7 text-accent') {
  const props = { className, strokeWidth: 1.75 };
  switch (slug) {
    case 'gpr-field-form':
      return <Radio {...props} />;
    case 'cad-register-form':
      return <PenTool {...props} />;
    case 'hseq-report':
    case 'analisis-planificacion-cambios-sig':
    case 'cambios-sig':
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
    case 'registro-proveedor':
      return <Building2 {...props} />;
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
  const [viewMode, setViewMode] = useState<'grouped' | 'expanded'>('grouped');
  const [activeFormGroup, setActiveFormGroup] = useState<FormGroup | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['admin-forms'],
    queryFn: fetchFormsData,
  });

  // Manejo de tecla Escape para cerrar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFormGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Bloqueo de scroll cuando el modal está abierto
  useEffect(() => {
    if (activeFormGroup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeFormGroup]);

  // Contadores para chips y selector
  const categories = useMemo(() => {
    return ORDERED_CANONICAL_KEYS.map((key) => {
      if (key === 'all') {
        return { key, label: 'Todas las áreas', count: forms.length };
      }
      const catMeta = CANONICAL_CATEGORY_STYLES[key];
      const count = forms.filter((f) => resolveCanonicalFormCategory(f.slug, f.name) === key).length;
      return {
        key,
        label: catMeta.label,
        count,
      };
    }).filter((c) => c.key === 'all' || c.count > 0);
  }, [forms]);

  // Filtrado reactivo de formularios
  const filteredForms = useMemo(() => {
    return forms.filter((f) => {
      const cat = resolveCanonicalFormCategory(f.slug, f.name);
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

  // Agrupación canónica por Grupos (igual que en el Dashboard Inicial)
  const formGroups = useMemo<FormGroup[]>(() => {
    const grouped: Record<string, Form[]> = {};
    filteredForms.forEach((f) => {
      const cat = resolveCanonicalFormCategory(f.slug, f.name);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(f);
    });

    return ORDERED_CANONICAL_KEYS
      .filter((k): k is CanonicalFormCategory => k !== 'all' && Boolean(grouped[k]?.length))
      .map((k) => ({
        categoryKey: k,
        categoryMeta: CANONICAL_CATEGORY_STYLES[k],
        items: grouped[k] || [],
      }));
  }, [filteredForms]);

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
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
                title="Vista con todos los formatos desplegados"
              >
                <List className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Desplegados</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Barra de Control Unificada: Contador + Búsqueda Rápida + Selector de Área Integrado */}
        <div className="card border border-border shadow-md p-4 sm:p-5 space-y-3.5 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Título y conteo de formatos */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
                <ClipboardList className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Formatos de Entrada</h2>
                <p className="text-xs text-text-muted font-mono">
                  {filteredForms.length} de {forms.length} formulario{forms.length !== 1 ? 's' : ''} en {formGroups.length} grupo{formGroups.length !== 1 ? 's' : ''}
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
                  placeholder="Buscar formulario por nombre, código o slug..."
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
            Cargando catálogo de formularios operativos...
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="card border border-border p-12 text-center space-y-2 bg-white">
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
                <h3 className="text-sm font-bold text-text-primary">Grupos Operacionales</h3>
                <p className="text-xs text-text-muted">
                  Selecciona una categoría técnica para desplegar y diligenciar los formatos disponibles
                </p>
              </div>
              <span className="text-xs text-text-muted font-mono">
                {formGroups.length} grupo{formGroups.length !== 1 ? 's' : ''} activos
              </span>
            </div>

            {/* Rejilla de Tarjetas de Grupo con Íconos Grandes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {formGroups.map((group) => {
                const { categoryKey, categoryMeta, items } = group;
                return (
                  <button
                    key={categoryKey}
                    type="button"
                    onClick={() => setActiveFormGroup(group)}
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
                          {items.length} {items.length === 1 ? 'formulario' : 'formularios'}
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
            {formGroups.map((group) => {
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
                      {items.length} {items.length === 1 ? 'formato' : 'formatos'}
                    </span>
                  </div>

                  {/* Listado con Íconos Grandes */}
                  <div className="divide-y divide-border">
                    {items.map((form) => (
                      <div
                        key={form.id}
                        className="px-5 py-4 hover:bg-gray-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Contenedor de Ícono Grande para el Formulario */}
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface border border-border flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform group-hover:border-accent/40">
                            {renderFormIcon(form.slug, 'w-6 h-6 sm:w-7 sm:h-7 text-accent')}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-bold text-sm sm:text-base text-text-primary group-hover:text-primary transition-colors">
                                {form.name}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryMeta.bg} ${categoryMeta.border} ${categoryMeta.text}`}
                              >
                                {categoryMeta.badgeLabel}
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

                        {/* Botón de Acción */}
                        <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                          <Link
                            href={`/forms/${form.slug}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-800 transition-all shadow-xs group-hover:scale-[1.02] cursor-pointer"
                          >
                            <span>Diligenciar Formulario</span>
                            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Banner Informativo HSEQ & Auditoría */}
        <div className="card border border-border p-5 bg-gradient-to-r from-blue-50/60 to-primary-50/40 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-primary">
                Gobernanza Canónica y Listado Maestro HSEQ (ISO 9001 & 45001)
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Todos los formularios se encuentran codificados y agrupados rigurosamente bajo las 9 áreas técnicas de PROCIMEC. Para consultar versiones vigentes y plantillas oficiales (.xlsx / .docx), dirígete al módulo de{' '}
                <Link href="/tools/version-control" className="text-primary font-bold underline hover:text-accent transition-colors">
                  Control de Versiones y Gestión Documental
                </Link>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* VENTANA FLOTANTE (MODAL): FORMULARIOS DE UN GRUPO           */}
      {/* (Idéntico estándar visual del Dashboard Inicial con Íconos Grandes) */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeFormGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveFormGroup(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 shadow-xs ${activeFormGroup.categoryMeta.containerBg}`}
                >
                  <div className={activeFormGroup.categoryMeta.accentColor}>
                    {renderCategoryIcon(activeFormGroup.categoryKey, 'w-6 h-6')}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-base sm:text-lg truncate">
                    {activeFormGroup.categoryMeta.label}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {activeFormGroup.items.length} {activeFormGroup.items.length === 1 ? 'formulario disponible' : 'formularios disponibles'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveFormGroup(null)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Lista de Formularios con Íconos Grandes */}
            <div className="p-3 sm:p-4 overflow-y-auto divide-y divide-border/60">
              {activeFormGroup.items.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <Link
                    href={`/forms/${form.slug}`}
                    onClick={() => setActiveFormGroup(null)}
                    className="flex items-start gap-3.5 min-w-0 flex-1 pr-1 cursor-pointer"
                  >
                    {/* Ícono Más Grande para el Formulario */}
                    <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-accent group-hover:border-accent/50 group-hover:scale-105 transition-all flex-shrink-0 shadow-xs">
                      {renderFormIcon(form.slug, 'w-6 h-6 text-accent')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                          {form.name}
                        </p>
                        {form.has_attachments && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1">
                            <Paperclip className="w-2.5 h-2.5" /> Adjuntos
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-text-muted mb-1">
                        /forms/{form.slug}
                      </p>
                      {form.description && (
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center justify-end sm:justify-start flex-shrink-0">
                    <Link
                      href={`/forms/${form.slug}`}
                      onClick={() => setActiveFormGroup(null)}
                      className="btn-accent text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-transform active:scale-[0.98] cursor-pointer"
                    >
                      <span>Diligenciar</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer del Modal */}
            <div className="p-3 bg-surface border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted font-mono">PROCIMEC · PCM CLOUD</span>
              <button
                type="button"
                onClick={() => setActiveFormGroup(null)}
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
