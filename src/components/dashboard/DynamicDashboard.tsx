'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Eye,
  ClipboardList,
  PenTool,
  BarChart2,
  Settings,
  Quote,
  ChevronDown,
  ChevronRight,
  User,
  Activity,
  ShieldCheck,
  ShoppingCart,
  Briefcase,
  DollarSign,
  FileText,
  Package,
  Users,
  Building2,
  Layers,
  RefreshCw,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityRecord } from '@/lib/dashboard-activities';

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
}

interface Form {
  id: string;
  slug: string;
  name: string;
}

interface Project {
  id: string;
  cost_center?: string;
  code?: string;
  name: string;
  client: string;
}

export interface DashboardData {
  user: { id: string; email: string; full_name: string; nick_name?: string };
  legacyRole?: string | null;
  isRolePreview?: boolean;
  division: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
  projects: Project[];
  tools: Tool[];
  forms: Form[];
  recentActivity: ActivityRecord[];
}

interface CategoryMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;
  badgeClass: string;
}

const CANONICAL_CATEGORY_ORDER = [
  'gpr',
  'cad',
  'hseq',
  'warehouse',
  'purchasing',
  'commercial',
  'finance',
  'accounting',
  'rrhh',
  'admin',
  'universal',
];

const CATEGORY_META: Record<string, CategoryMeta> = {
  gpr: {
    label: 'GPR / Georradar',
    description: 'Procesamiento de radargramas, campo e inspección de subsuelo',
    icon: Activity,
    accentColor: 'text-blue-700',
    badgeClass: 'bg-blue-50 border-blue-200 text-blue-900 group-hover:bg-blue-100',
  },
  cad: {
    label: 'CAD / BIM',
    description: 'Modelado, planimetría, Civil 3D y dibujo técnico',
    icon: PenTool,
    accentColor: 'text-amber-700',
    badgeClass: 'bg-amber-50 border-amber-200 text-amber-900 group-hover:bg-amber-100',
  },
  hseq: {
    label: 'HSEQ & SIG',
    description: 'Seguridad, salud en el trabajo, inspecciones y gestión del cambio',
    icon: ShieldCheck,
    accentColor: 'text-teal-700',
    badgeClass: 'bg-teal-50 border-teal-200 text-teal-900 group-hover:bg-teal-100',
  },
  warehouse: {
    label: 'Almacén',
    description: 'Kárdex de instrumental, despachos, retornos y consumibles',
    icon: Package,
    accentColor: 'text-amber-800',
    badgeClass: 'bg-amber-100/70 border-amber-300 text-amber-900 group-hover:bg-amber-100',
  },
  purchasing: {
    label: 'Compras',
    description: 'Requerimientos, órdenes de compra y evaluación de proveedores',
    icon: ShoppingCart,
    accentColor: 'text-cyan-700',
    badgeClass: 'bg-cyan-50 border-cyan-200 text-cyan-900 group-hover:bg-cyan-100',
  },
  commercial: {
    label: 'Comercial',
    description: 'Oportunidades, licitaciones, cotizaciones y cierres',
    icon: Briefcase,
    accentColor: 'text-emerald-700',
    badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-900 group-hover:bg-emerald-100',
  },
  finance: {
    label: 'Finanzas',
    description: 'Viáticos, anticipos, legalización de gastos y pagos',
    icon: DollarSign,
    accentColor: 'text-violet-700',
    badgeClass: 'bg-violet-50 border-violet-200 text-violet-900 group-hover:bg-violet-100',
  },
  accounting: {
    label: 'Contabilidad',
    description: 'Radicación de facturas, actas y soporte de cobro',
    icon: FileText,
    accentColor: 'text-indigo-700',
    badgeClass: 'bg-indigo-50 border-indigo-200 text-indigo-900 group-hover:bg-indigo-100',
  },
  rrhh: {
    label: 'Recursos Humanos',
    description: 'Cartas laborales, certificaciones y talento humano',
    icon: Users,
    accentColor: 'text-rose-700',
    badgeClass: 'bg-rose-50 border-rose-200 text-rose-900 group-hover:bg-rose-100',
  },
  admin: {
    label: 'Administración',
    description: 'Módulos ejecutivos, gestión y sistemas integrados GIS',
    icon: Building2,
    accentColor: 'text-purple-700',
    badgeClass: 'bg-purple-50 border-purple-200 text-purple-900 group-hover:bg-purple-100',
  },
  universal: {
    label: 'Universal',
    description: 'Herramientas transversales, asistencia, chat y auditoría',
    icon: Layers,
    accentColor: 'text-slate-700',
    badgeClass: 'bg-slate-50 border-slate-200 text-slate-900 group-hover:bg-slate-100',
  },
};

const FORM_CATEGORY_MAP: Record<string, string> = {
  // GPR
  'gpr-field-form': 'gpr',
  // CAD / BIM
  'cad-register-form': 'cad',
  'nueva-actividad': 'cad',
  // HSEQ & SIG
  'hseq-report': 'hseq',
  'analisis-planificacion-cambios-sig': 'hseq',
  // Almacén
  'registro-equipo': 'warehouse',
  'despacho-equipo': 'warehouse',
  'retorno-equipo': 'warehouse',
  // Compras
  'requerimiento-compra': 'purchasing',
  'orden-compra': 'purchasing',
  'evaluacion-proveedor': 'purchasing',
  // Comercial
  'registro-oportunidad': 'commercial',
  'cotizacion-comercial': 'commercial',
  'cierre-comercial': 'commercial',
  // Finanzas
  'solicitud-viaticos': 'finance',
  'legalizacion-gastos': 'finance',
  'registro-pago': 'finance',
  // Contabilidad
  'radicacion-factura': 'accounting',
  'soporte-cobro': 'accounting',
  // RRHH
  'elaboracion-cartas': 'rrhh',
};

const GREETINGS = [
  'bienvenido de nuevo',
  'excelente jornada',
  'qué gusto tenerte aquí',
  'con toda la energía para hoy',
  'precisión y rigor técnico',
  'listos para transformar proyectos',
  'un gran día para construir e innovar',
  'bienvenido a PCM CLOUD',
  'impulsando ingeniería de alto nivel',
  'liderazgo y calidad en cada entrega',
];

interface QuoteItem {
  text: string;
  author: string;
}

const INSPIRATIONAL_QUOTES: QuoteItem[] = [
  { text: 'La simplicidad es la máxima sofisticación.', author: 'Leonardo da Vinci' },
  { text: 'La mejor manera de predecir el futuro es crearlo.', author: 'Peter Drucker' },
  { text: 'No busques los errores, busca un remedio.', author: 'Henry Ford' },
  { text: 'El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el valor para continuar.', author: 'Winston Churchill' },
  { text: 'Las grandes obras no son hechas por la fuerza, sino por la perseverancia.', author: 'Samuel Johnson' },
  { text: 'El genio es 1% de inspiración y 99% de transpiración.', author: 'Thomas Edison' },
  { text: 'La excelencia no es un acto, es un hábito.', author: 'Aristóteles' },
  { text: 'Siempre parece imposible hasta que se hace.', author: 'Nelson Mandela' },
  { text: 'El trabajo en equipo divide el esfuerzo y multiplica el resultado.', author: 'John C. Maxwell' },
  { text: 'La precisión no es un accidente, es el resultado del esfuerzo concentrado.', author: 'Anónimo' },
  { text: 'El único modo de hacer un gran trabajo es amar lo que haces.', author: 'Steve Jobs' },
  { text: 'El presente es de ellos; el futuro, para el que realmente trabajé, es mío.', author: 'Nikola Tesla' },
  { text: 'Los científicos estudian el mundo tal como es; los ingenieros crean el mundo que nunca ha existido.', author: 'Theodore von Kármán' },
  { text: 'La calidad no es un accidente; es siempre el resultado de una intención inteligente.', author: 'John Ruskin' },
  { text: 'La energía y la persistencia conquistan todas las cosas.', author: 'Benjamin Franklin' },
  { text: 'Lo que con esfuerzo se adquiere, más se ama.', author: 'Aristóteles' },
  { text: 'No cuentes los días, haz que los días cuenten.', author: 'Muhammad Ali' },
  { text: 'El secreto del cambio es enfocar toda tu energía no en luchar contra lo viejo, sino en construir lo nuevo.', author: 'Sócrates' },
  { text: 'La disciplina es el puente entre las metas y los logros.', author: 'Jim Rohn' },
  { text: 'Donde hay una empresa de éxito, alguien tomó alguna vez una decisión valiente.', author: 'Peter Drucker' },
];

function getActivityIcon(category: string) {
  switch (category) {
    case 'cad':
      return <PenTool className="w-4 h-4 text-amber-700" strokeWidth={1.75} />;
    case 'gpr':
      return <Activity className="w-4 h-4 text-blue-700" strokeWidth={1.75} />;
    case 'hseq':
      return <ShieldCheck className="w-4 h-4 text-teal-700" strokeWidth={1.75} />;
    case 'purchasing':
      return <ShoppingCart className="w-4 h-4 text-cyan-700" strokeWidth={1.75} />;
    case 'commercial':
      return <Briefcase className="w-4 h-4 text-emerald-700" strokeWidth={1.75} />;
    case 'finance':
      return <DollarSign className="w-4 h-4 text-violet-700" strokeWidth={1.75} />;
    case 'accounting':
      return <FileText className="w-4 h-4 text-indigo-700" strokeWidth={1.75} />;
    case 'warehouse':
      return <Package className="w-4 h-4 text-amber-800" strokeWidth={1.75} />;
    case 'rrhh':
      return <Users className="w-4 h-4 text-rose-700" strokeWidth={1.75} />;
    default:
      return <ClipboardList className="w-4 h-4 text-gray-700" strokeWidth={1.75} />;
  }
}

function getActivityBadgeClass(category: string) {
  switch (category) {
    case 'cad':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'gpr':
      return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'hseq':
      return 'bg-teal-50 border-teal-200 text-teal-800';
    case 'purchasing':
      return 'bg-cyan-50 border-cyan-200 text-cyan-800';
    case 'commercial':
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'finance':
      return 'bg-violet-50 border-violet-200 text-violet-800';
    case 'accounting':
      return 'bg-indigo-50 border-indigo-200 text-indigo-800';
    case 'warehouse':
      return 'bg-amber-100/70 border-amber-300 text-amber-900';
    case 'rrhh':
      return 'bg-rose-50 border-rose-200 text-rose-800';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800';
  }
}

function getActivityStatusBadgeClass(status?: string, statusLabel?: string): string {
  const norm = (statusLabel || status || '').toLowerCase();
  if (
    norm.includes('aprobado') ||
    norm.includes('aprobada') ||
    norm.includes('ganada') ||
    norm.includes('pagado') ||
    norm.includes('pagada')
  ) {
    return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  }
  if (
    norm.includes('cotizado') ||
    norm.includes('cotización') ||
    norm.includes('cotizacion')
  ) {
    return 'bg-sky-50 text-sky-900 border-sky-200';
  }
  if (
    norm.includes('rechazad') ||
    norm.includes('cancelad') ||
    norm.includes('perdid')
  ) {
    return 'bg-rose-50 text-rose-900 border-rose-200';
  }
  if (norm.includes('pendiente')) {
    return 'bg-amber-50 text-amber-900 border-amber-200';
  }
  if (norm.includes('campo') || norm.includes('retornado') || norm.includes('revisado')) {
    return 'bg-blue-50 text-blue-900 border-blue-200';
  }
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

function formatDate(dateStr: string, createdAtStr?: string): string {
  try {
    const target = createdAtStr ? new Date(createdAtStr) : new Date(dateStr + 'T12:00:00Z');
    if (isNaN(target.getTime())) return dateStr;

    return target.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface FormGroup {
  categoryKey: string;
  categoryLabel: string;
  items: Form[];
}

interface ToolGroup {
  categoryKey: string;
  categoryLabel: string;
  items: Tool[];
}

export function DynamicDashboard({
  data,
  onRefresh,
  isRefreshing,
}: {
  data: DashboardData;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { user, division, role, projects, tools, forms, recentActivity = [], legacyRole, isRolePreview } = data;
  const isLegacyDibujo = legacyRole === 'dibujo' && !role;

  // Estado para mensaje aleatorio y frase inspiradora
  const [greeting, setGreeting] = useState('¡Bienvenido!');
  const [quote, setQuote] = useState<QuoteItem>(INSPIRATIONAL_QUOTES[0]);

  // Estado de paginación para actividades (10 inicial, +10 hasta 100)
  const [displayCount, setDisplayCount] = useState(10);

  // Estados para ventanas flotantes (Modales) de Grupos de Formularios y Herramientas
  const [activeFormGroup, setActiveFormGroup] = useState<FormGroup | null>(null);
  const [activeToolGroup, setActiveToolGroup] = useState<ToolGroup | null>(null);

  useEffect(() => {
    const randomGreeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const randomQuote = INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)];
    setGreeting(randomGreeting);
    setQuote(randomQuote);
  }, []);

  // Manejo de tecla Escape para cerrar modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFormGroup(null);
        setActiveToolGroup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Bloqueo de scroll cuando una ventana flotante está abierta
  useEffect(() => {
    if (activeFormGroup || activeToolGroup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeFormGroup, activeToolGroup]);

  // 1. Agrupar Formularios por Categoría Canónica
  const formsByCategory = forms.reduce<Record<string, Form[]>>((acc, f) => {
    const cat = FORM_CATEGORY_MAP[f.slug] || 'universal';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const formGroups: FormGroup[] = CANONICAL_CATEGORY_ORDER
    .filter((catKey) => formsByCategory[catKey] && formsByCategory[catKey].length > 0)
    .map((catKey) => ({
      categoryKey: catKey,
      categoryLabel: CATEGORY_META[catKey]?.label || catKey.toUpperCase(),
      items: formsByCategory[catKey],
    }));

  // Agregar cualquier categoría remanente no canónica
  Object.keys(formsByCategory).forEach((catKey) => {
    if (!CANONICAL_CATEGORY_ORDER.includes(catKey) && formsByCategory[catKey].length > 0) {
      formGroups.push({
        categoryKey: catKey,
        categoryLabel: CATEGORY_META[catKey]?.label || catKey.toUpperCase(),
        items: formsByCategory[catKey],
      });
    }
  });

  // 2. Agrupar Herramientas por Categoría Canónica
  const toolsByCategory = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    const cat = t.category || 'universal';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const toolGroups: ToolGroup[] = CANONICAL_CATEGORY_ORDER
    .filter((catKey) => toolsByCategory[catKey] && toolsByCategory[catKey].length > 0)
    .map((catKey) => ({
      categoryKey: catKey,
      categoryLabel: CATEGORY_META[catKey]?.label || catKey.toUpperCase(),
      items: toolsByCategory[catKey],
    }));

  // Agregar cualquier categoría remanente no canónica
  Object.keys(toolsByCategory).forEach((catKey) => {
    if (!CANONICAL_CATEGORY_ORDER.includes(catKey) && toolsByCategory[catKey].length > 0) {
      toolGroups.push({
        categoryKey: catKey,
        categoryLabel: CATEGORY_META[catKey]?.label || catKey.toUpperCase(),
        items: toolsByCategory[catKey],
      });
    }
  });

  const displayGreeting = user.nick_name || user.full_name || 'Usuario';
  const visibleActivities = recentActivity.slice(0, displayCount);
  const totalAvailable = Math.min(recentActivity.length, 100);
  const hasMore = displayCount < totalAvailable;
  const isLimitReached = displayCount >= 100 && recentActivity.length >= 100;

  return (
    <div className="space-y-6">
      {/* Role Preview Banner — ONLY shown when an Admin is explicitly previewing a role interface via ?roleId=... */}
      {isRolePreview && role && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center justify-between text-xs text-primary-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-bold text-sm">Vista de Interfaz de Rol: {role.name}</p>
              <p className="text-primary-700">Visualizando herramientas, formularios y proyectos asignados a este rol.</p>
            </div>
          </div>
          <Link href={`/admin/roles/${role.id}`} className="font-semibold underline text-primary hover:text-primary-800 ml-3 flex-shrink-0">
            Editar Rol →
          </Link>
        </div>
      )}

      {/* Header Card: Saludo aleatorio, Nombre abajo, Correo, Roles y Frase Inspiradora */}
      <div className="card border border-border shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-inner">
              {(user.nick_name || user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-text-primary capitalize-first">
                Hola {greeting}, {displayGreeting}
              </h2>
              <p className="text-xs text-text-muted truncate font-mono mt-1">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {role ? (
                  <span className="badge badge-primary text-xs">{role.name}</span>
                ) : legacyRole ? (
                  <span className="badge badge-accent text-xs capitalize">{legacyRole}</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                    Sin rol asignado
                  </span>
                )}
                {division && (
                  <span className="badge badge-accent text-xs">{division.name}</span>
                )}
              </div>
            </div>
          </div>

          {/* Frase Inspiradora de Autores */}
          <div className="w-full md:max-w-xs lg:max-w-sm border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
            <div className="flex items-start gap-2.5 bg-surface/40 p-3 rounded-xl border border-border/50">
              <Quote className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-xs italic text-text-secondary leading-relaxed">
                  &ldquo;{quote.text}&rdquo;
                </p>
                <p className="text-[11px] font-semibold text-text-muted mt-1.5 text-right font-mono">
                  — {quote.author}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 1. MIS FORMULARIOS (PRIMERO - AGRUPADOS CON MODAL)          */}
      {/* ─────────────────────────────────────────────────────────── */}
      {forms.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-text-primary">Mis Formularios</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Selecciona una categoría para desplegar los formatos operativos disponibles
              </p>
            </div>
            <span className="text-xs text-text-muted font-medium font-mono">
              {forms.length} formato{forms.length !== 1 ? 's' : ''} en {formGroups.length} grupo{formGroups.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Rejilla de Grupos de Formularios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {formGroups.map((g) => {
              const meta = CATEGORY_META[g.categoryKey] || CATEGORY_META.universal;
              const Icon = meta.icon;
              return (
                <button
                  key={g.categoryKey}
                  type="button"
                  onClick={() => setActiveFormGroup(g)}
                  className="card border border-border p-4 hover:border-accent hover:shadow-md transition-all text-left flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${meta.badgeClass}`}>
                      <Icon className={`w-5 h-5 ${meta.accentColor}`} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                        {meta.label}
                      </p>
                      <p className="text-xs text-text-muted font-mono mt-0.5">
                        {g.items.length} {g.items.length === 1 ? 'formulario' : 'formularios'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" strokeWidth={2} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 2. MIS HERRAMIENTAS (SEGUNDO - AGRUPADAS CON MODAL)         */}
      {/* ─────────────────────────────────────────────────────────── */}
      {tools.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-text-primary">Mis Herramientas</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Selecciona una categoría técnica para abrir los tableros y visores de trabajo
              </p>
            </div>
            <span className="text-xs text-text-muted font-medium font-mono">
              {tools.length} herramienta{tools.length !== 1 ? 's' : ''} en {toolGroups.length} grupo{toolGroups.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Rejilla de Grupos de Herramientas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {toolGroups.map((g) => {
              const meta = CATEGORY_META[g.categoryKey] || CATEGORY_META.universal;
              const Icon = meta.icon;
              return (
                <button
                  key={g.categoryKey}
                  type="button"
                  onClick={() => setActiveToolGroup(g)}
                  className="card border border-border p-4 hover:border-accent hover:shadow-md transition-all text-left flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${meta.badgeClass}`}>
                      <Icon className={`w-5 h-5 ${meta.accentColor}`} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                        {meta.label}
                      </p>
                      <p className="text-xs text-text-muted font-mono mt-0.5">
                        {g.items.length} {g.items.length === 1 ? 'herramienta' : 'herramientas'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" strokeWidth={2} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 3. MIS PROYECTOS (TERCERO)                                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      {projects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-text-primary">Mis Proyectos</h2>
            <span className="text-xs text-text-muted font-medium font-mono">
              {projects.length} asignado{projects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/reports`}
                className="card border border-border p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide font-mono">{p.cost_center || p.code}</p>
                    <p className="text-sm font-semibold text-text-primary truncate mt-0.5 group-hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs text-text-muted mt-1 truncate">{p.client}</p>
                  </div>
                  <span className="text-text-muted text-sm mt-0.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 4. ACTIVIDADES RECIENTES (ÚLTIMO)                           */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-text-primary">Actividades Recientes</h2>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Actualizar actividades recientes"
                className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                aria-label="Actualizar actividades"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent' : ''}`} strokeWidth={2} />
              </button>
            )}
          </div>
          {recentActivity.length > 0 && (
            <span className="text-xs text-text-muted font-medium font-mono">
              {visibleActivities.length} de {totalAvailable}
            </span>
          )}
        </div>

        {recentActivity.length === 0 ? (
          <div className="card border border-border p-8 text-center shadow-sm">
            <ClipboardList className="w-8 h-8 text-text-muted mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-medium text-text-primary">No hay actividades registradas</p>
            <p className="text-xs text-text-muted mt-1">
              Las actividades y formatos que diligencies aparecerán cronológicamente aquí.
            </p>
          </div>
        ) : (
          <div className="card border border-border overflow-hidden shadow-sm">
            <ul className="divide-y divide-border">
              {visibleActivities.map((a) => (
                <li key={a.id} className="flex items-start sm:items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
                  {/* Icono de Categoría */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 ${getActivityBadgeClass(a.category)}`}>
                    {getActivityIcon(a.category)}
                  </div>

                  {/* Cuerpo Principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-text-primary">
                        {a.type}
                      </span>
                      <span className="text-text-muted text-xs">·</span>
                      <span className="text-xs font-semibold text-primary truncate max-w-[200px] sm:max-w-xs">
                        {a.projectName}
                      </span>
                      {a.projectCode && a.projectCode !== 'PCM' && (
                        <span className="text-[11px] font-mono text-text-muted">
                          ({a.projectCode})
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed truncate">
                      {a.detail}
                    </p>

                    {/* Autor / Colaborador */}
                    {a.userName && (
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-secondary">
                        <User className="w-3 h-3 text-text-muted flex-shrink-0" strokeWidth={1.75} />
                        <span className="font-medium truncate">{a.userName}</span>
                        {a.userEmail && (
                          <span className="text-text-muted font-mono text-[10px] hidden sm:inline truncate">
                            ({a.userEmail})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fecha y Estado */}
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs font-mono text-text-muted">
                      {formatDate(a.date, a.created_at)}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getActivityStatusBadgeClass(a.status, a.statusLabel)}`}>
                      {a.statusLabel || a.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginación con botón Ver más (máximo 100) */}
            {hasMore && (
              <div className="p-3 bg-surface/50 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-text-muted font-mono">
                  Mostrando {visibleActivities.length} de {totalAvailable} actividades
                </span>
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => Math.min(prev + 10, 100))}
                  className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold hover:border-accent hover:text-accent transition-all cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                  <span>Ver más actividades (+10)</span>
                </button>
              </div>
            )}

            {/* Aviso cuando se alcanza el límite duro de 100 */}
            {isLimitReached && (
              <div className="p-3 bg-surface/50 border-t border-border text-center">
                <p className="text-xs text-text-muted font-medium">
                  Has alcanzado el límite de visualización (100 actividades más recientes).
                </p>
              </div>
            )}

            {/* Aviso cuando se cargaron todos los disponibles si son menos de 100 */}
            {!hasMore && !isLimitReached && recentActivity.length > 10 && (
              <div className="p-3 bg-surface/50 border-t border-border text-center">
                <p className="text-xs text-text-muted font-medium">
                  Todos los registros han sido cargados ({visibleActivities.length} actividades).
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Módulo legacy Dibujante (usuarios con role='dibujo' sin role_id asignado) */}
      {isLegacyDibujo && (
        <section>
          <h2 className="font-bold text-text-primary mb-3">Módulo Dibujante</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/forms/cad-register-form"
              className="card border border-amber-200 bg-amber-50 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <PenTool className="w-5 h-5 text-amber-800" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 group-hover:text-amber-700 transition-colors">
                    Nueva Actividad CAD
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Registrar horas y software utilizado</p>
                </div>
              </div>
            </Link>
            <Link
              href="/tools/cad-productivity-board"
              className="card border border-blue-200 bg-blue-50 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-5 h-5 text-blue-800" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition-colors">
                    Tablero de Actividades
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">Métricas e historial de registros</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Empty state: no legacy role ni role_id */}
      {projects.length === 0 && tools.length === 0 && forms.length === 0 && !isLegacyDibujo && (
        <div className="card border border-border p-10 text-center space-y-2 shadow-sm">
          <Settings className="w-8 h-8 text-text-muted mx-auto mb-1" strokeWidth={1.75} />
          <p className="text-sm font-medium text-text-primary">Panel sin configurar</p>
          <p className="text-xs text-text-muted max-w-xs mx-auto">
            Tu cuenta aún no tiene proyectos, herramientas o formularios asignados. Contacta a un administrador.
          </p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* VENTANA FLOTANTE (MODAL): FORMULARIOS DE UN GRUPO           */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeFormGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveFormGroup(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${CATEGORY_META[activeFormGroup.categoryKey]?.badgeClass || 'bg-gray-100'}`}>
                  {(() => {
                    const Icon = CATEGORY_META[activeFormGroup.categoryKey]?.icon || ClipboardList;
                    return <Icon className={`w-5 h-5 ${CATEGORY_META[activeFormGroup.categoryKey]?.accentColor || 'text-primary'}`} strokeWidth={1.75} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-base sm:text-lg truncate">
                    {CATEGORY_META[activeFormGroup.categoryKey]?.label || activeFormGroup.categoryLabel}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">
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

            {/* Lista de Formularios */}
            <div className="p-3 sm:p-4 overflow-y-auto divide-y divide-border/60">
              {activeFormGroup.items.map((f) => (
                <Link
                  key={f.id}
                  href={`/forms/${f.slug}`}
                  onClick={() => setActiveFormGroup(null)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted group-hover:text-primary group-hover:border-primary/40 transition-colors flex-shrink-0">
                    <ClipboardList className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                      {f.name}
                    </p>
                    <p className="text-[11px] font-mono text-text-muted">
                      /forms/{f.slug}
                    </p>
                  </div>
                  <span className="text-text-muted text-sm flex-shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all">→</span>
                </Link>
              ))}
            </div>

            {/* Footer del Modal */}
            <div className="p-3 bg-surface border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">PROCIMEC · PCM CLOUD</span>
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

      {/* ─────────────────────────────────────────────────────────── */}
      {/* VENTANA FLOTANTE (MODAL): HERRAMIENTAS DE UN GRUPO         */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeToolGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveToolGroup(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${CATEGORY_META[activeToolGroup.categoryKey]?.badgeClass || 'bg-gray-100'}`}>
                  {(() => {
                    const Icon = CATEGORY_META[activeToolGroup.categoryKey]?.icon || Settings;
                    return <Icon className={`w-5 h-5 ${CATEGORY_META[activeToolGroup.categoryKey]?.accentColor || 'text-primary'}`} strokeWidth={1.75} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-base sm:text-lg truncate">
                    {CATEGORY_META[activeToolGroup.categoryKey]?.label || activeToolGroup.categoryLabel}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">
                    {activeToolGroup.items.length} {activeToolGroup.items.length === 1 ? 'herramienta técnica' : 'herramientas técnicas'}
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

            {/* Lista de Herramientas */}
            <div className="p-3 sm:p-4 overflow-y-auto divide-y divide-border/60">
              {activeToolGroup.items.map((t) => (
                <Link
                  key={t.id}
                  href={`/tools/${t.slug}`}
                  onClick={() => setActiveToolGroup(null)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted group-hover:text-primary group-hover:border-primary/40 transition-colors flex-shrink-0">
                    {(() => {
                      const Icon = CATEGORY_META[activeToolGroup.categoryKey]?.icon || Settings;
                      return <Icon className="w-4 h-4" strokeWidth={1.75} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                      {t.name}
                    </p>
                    <p className="text-[11px] font-mono text-text-muted">
                      /tools/{t.slug}
                    </p>
                  </div>
                  <span className="text-text-muted text-sm flex-shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all">→</span>
                </Link>
              ))}
            </div>

            {/* Footer del Modal */}
            <div className="p-3 bg-surface border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">PROCIMEC · PCM CLOUD</span>
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
