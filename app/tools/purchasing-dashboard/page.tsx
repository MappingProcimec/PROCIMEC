'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Package,
  Layers,
  Calendar,
  Building2,
  DollarSign,
  Star,
  FileText,
  User,
  ExternalLink,
  Info,
  Download,
  Phone,
  MapPin,
  ChevronDown,
  Eye,
  PenTool,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import {
  downloadPurchaseRequestPdf,
  PurchaseRequestPdfItem,
  PurchaseRequestPdfSignatures,
} from '@/lib/purchasing/purchaseRequestPdfGenerator';

interface PurchaseRequestItemData {
  item?: string;
  item_no?: number;
  description?: string;
  quantity?: number | '';
  unit?: string;
  client_quote_no?: string;
  brand?: string;
  suggested_supplier?: string;
  unit_price?: number | '';
  total?: number;
}

export interface RequestSignatureData {
  name: string;
  cedula: string;
  date_time: string;
  role_label: string;
  user_id?: string;
  notes?: string;
  rejected?: boolean;
}

export interface RequestViewLogData {
  user_id: string;
  user_name: string;
  user_email?: string;
  instance: 'director' | 'purchasing' | 'management' | string;
  role_label: string;
  viewed_at: string;
  view_count?: number;
}

interface PurchaseRequest {
  id: string;
  project_id?: string;
  user_id?: string;
  title: string;
  category: string;
  priority: string;
  required_date: string | null;
  items: PurchaseRequestItemData[];
  justification: string;
  status: string;
  created_at: string;
  consecutive?: number | null;
  request_code?: string;
  applicant_name?: string;
  applicant_cedula?: string;
  approver_name?: string;
  approver_user_id?: string | null;
  delivery_date?: string;
  delivery_site?: string;
  contact_phone?: string;
  cost_center?: string;
  client_name?: string;
  total_amount?: number;
  projects?: { id: string; name: string; cost_center?: string; client?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
  signatures?: {
    applicant?: RequestSignatureData;
    director?: RequestSignatureData;
    purchasing?: RequestSignatureData;
    management?: RequestSignatureData;
    [key: string]: RequestSignatureData | undefined;
  };
  viewed_by?: RequestViewLogData[];
}

interface PurchaseOrder {
  id: string;
  purchase_request_id?: string | null;
  project_id?: string | null;
  user_id?: string;
  order_code: string;
  supplier_name: string;
  supplier_nit: string | null;
  supplier_contact: string | null;
  total_amount: number;
  currency: string;
  delivery_deadline: string | null;
  payment_terms: string | null;
  attachment_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; name: string; cost_center?: string; client?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

interface SupplierEvaluation {
  id: string;
  supplier_name: string;
  quality_score: number;
  delivery_time_score: number;
  service_score: number;
  overall_rating: number;
  comments: string | null;
  recommend_supplier: boolean;
  created_at: string;
  users?: { id: string; full_name: string; email: string } | null;
}

interface ProjectOption {
  id: string;
  name: string;
  cost_center: string;
  client: string;
}

interface PurchasingDashboardData {
  stats: {
    pendingRequests: number;
    activeOrders: number;
    totalCommittedCOP: number;
    evaluatedSuppliers: number;
  };
  requests: PurchaseRequest[];
  orders: PurchaseOrder[];
  evaluations: SupplierEvaluation[];
  projects?: ProjectOption[];
  currentUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const STATUS_REQ_LABELS: Record<string, { label: string; badge: string }> = {
  pending: { label: 'Pendiente VB Técnico', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  in_quotation: { label: 'En Cotización', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  quoted: { label: 'Cotizada (Pendiente Gerencia)', badge: 'bg-purple-100/80 text-purple-900 border border-purple-300' },
  approved: { label: 'Aprobada (Gerencia)', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  purchased: { label: 'Comprada', badge: 'bg-slate-100 text-slate-800 border border-slate-300' },
  rejected: { label: 'Rechazada', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const STATUS_ORDER_LABELS: Record<string, { label: string; badge: string }> = {
  issued: { label: 'Emitida', badge: 'bg-blue-100/80 text-blue-900 border border-blue-300' },
  partially_received: { label: 'Recibida Parcial', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  completed: { label: 'Completada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
  cancelled: { label: 'Cancelada', badge: 'bg-red-100/80 text-red-900 border border-red-300' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: 'text-red-700 bg-red-50 border-red-200' },
  alta: { label: 'Alta', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  media: { label: 'Media', color: 'text-blue-800 bg-blue-50 border-blue-200' },
  baja: { label: 'Baja', color: 'text-slate-700 bg-slate-50 border-slate-200' },
};

export default function PurchasingDashboardPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'suppliers'>('requests');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [downloadingReqId, setDownloadingReqId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Estados para control de firmas electrónicas
  const [signingStep, setSigningStep] = useState<'director' | 'purchasing' | 'management' | null>(null);
  const [signingAction, setSigningAction] = useState<'approve' | 'reject'>('approve');
  const [signerCedula, setSignerCedula] = useState('');
  const [signerNotes, setSignerNotes] = useState('');
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [signingSuccessMsg, setSigningSuccessMsg] = useState<string | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ data: PurchasingDashboardData }>({
    queryKey: ['purchasing-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/tools/purchasing-dashboard');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al cargar datos de compras');
      }
      return res.json();
    },
  });

  // Cerrar desplegables al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-action-container')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const dashboard = data?.data;

  const currentUser = dashboard?.currentUser;
  const currentRole = (currentUser?.role || '').toLowerCase();
  const currentUserId = currentUser?.id || '';
  const currentUserName = (currentUser?.name || '').toLowerCase().trim();

  const isAdmin = currentRole === 'admin';
  const isManagement = isAdmin || currentRole === 'management' || currentRole === 'gerencia';
  const isPurchasing = isAdmin || currentRole === 'purchasing' || currentRole === 'compras';

  // Verificar si el usuario conectado es el aprobador asignado en la solicitud seleccionada
  const isDesignatedApprover = selectedRequest
    ? (Boolean(selectedRequest.approver_name) &&
        Boolean(currentUserName) &&
        (selectedRequest.approver_name || '').toLowerCase().trim() === currentUserName) ||
      (Boolean(selectedRequest.approver_user_id) && selectedRequest.approver_user_id === currentUserId)
    : false;

  const canSignDirector = isAdmin || isManagement || isDesignatedApprover;

  // Filtrado de requerimientos
  const filteredRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const matchSearch =
        search === '' ||
        (r.request_code || '').toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.applicant_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.justification || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchProject =
        filterProject === 'all' ||
        r.project_id === filterProject ||
        r.projects?.id === filterProject;

      return matchSearch && matchStatus && matchProject;
    });
  }, [dashboard?.requests, search, filterStatus, filterProject]);

  // Filtrado de órdenes
  const filteredOrders = useMemo(() => {
    if (!dashboard?.orders) return [];
    return dashboard.orders.filter((o) => {
      const matchSearch =
        search === '' ||
        o.order_code.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.supplier_nit || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.projects?.name || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      const matchProject =
        filterProject === 'all' ||
        o.project_id === filterProject ||
        o.projects?.id === filterProject;

      return matchSearch && matchStatus && matchProject;
    });
  }, [dashboard?.orders, search, filterStatus, filterProject]);

  // Filtrado de proveedores
  const filteredSuppliers = useMemo(() => {
    if (!dashboard?.evaluations) return [];
    return dashboard.evaluations.filter((ev) => {
      return (
        search === '' ||
        ev.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (ev.comments || '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [dashboard?.evaluations, search]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateTimeCO = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'America/Bogota',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Abrir detalle con registro silencioso de visualización ("Visto por")
  const handleOpenDetail = (r: PurchaseRequest) => {
    setSelectedRequest(r);
    setSigningStep(null);
    setSigningSuccessMsg(null);
    setSignerCedula('');
    setSignerNotes('');
    setOpenDropdownId(null);

    // Registro silencioso de auditoría de visualización
    fetch('/api/tools/purchasing-dashboard/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: r.id }),
    })
      .then((res) => res.json())
      .then((resJson) => {
        if (resJson?.success && resJson.viewed_by) {
          setSelectedRequest((prev) => (prev && prev.id === r.id ? { ...prev, viewed_by: resJson.viewed_by } : prev));
        }
      })
      .catch((err) => console.warn('Advertencia registrando vista:', err));
  };

  // Procesar firma electrónica y cambio de estado
  const handleSignSubmit = async () => {
    if (!selectedRequest || !signingStep) return;
    if (signingAction === 'approve' && !signerCedula.trim()) {
      alert('Debes ingresar tu número de cédula para registrar la firma electrónica.');
      return;
    }

    try {
      setIsSubmittingSignature(true);
      const res = await fetch('/api/tools/purchasing-dashboard/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          step: signingStep,
          action: signingAction,
          cedula: signerCedula.trim(),
          notes: signerNotes.trim(),
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al registrar la firma electrónica');
      }

      // Actualizar request seleccionado
      setSelectedRequest((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: resJson.status || prev.status,
          signatures: resJson.signatures || prev.signatures,
          total_amount: resJson.total_amount ?? prev.total_amount,
          items: resJson.items || prev.items,
        };
      });

      setSigningSuccessMsg(resJson.message || 'Firma electrónica registrada con éxito.');
      setSigningStep(null);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la firma');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Descargar PDF de requerimiento
  const handleDownloadPdf = (r: PurchaseRequest) => {
    try {
      setDownloadingReqId(r.id);
      setOpenDropdownId(null);
      const itemsMapped: PurchaseRequestPdfItem[] = (r.items || []).map((it, idx) => ({
        item_no: it.item_no || idx + 1,
        quantity: it.quantity || 1,
        unit: it.unit || 'Und',
        description: it.description || it.item || 'Ítem sin descripción',
        client_quote_no: it.client_quote_no || '',
        brand: it.brand || '',
        suggested_supplier: it.suggested_supplier || '',
        unit_price: it.unit_price || 0,
        total: it.total !== undefined ? it.total : (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
      }));

      const totalAmt =
        r.total_amount !== undefined
          ? Number(r.total_amount)
          : itemsMapped.reduce((acc, it) => acc + (Number(it.total) || 0), 0);

      const submissionFormatted = formatDateTimeCO(r.created_at);

      const existingSigs = r.signatures || {};
      const finalSignatures: PurchaseRequestPdfSignatures = {
        ...existingSigs,
        applicant: existingSigs.applicant || {
          name: r.applicant_name || r.users?.full_name || 'Solicitante Registrado',
          cedula: r.applicant_cedula || '',
          dateTime: submissionFormatted,
          roleLabel: 'Solicitante / Ingeniero de Campo',
        },
      };

      downloadPurchaseRequestPdf({
        requestCode: r.request_code || (r.consecutive ? `REQ-${String(r.consecutive).padStart(4, '0')}` : 'REQ-0001'),
        consecutive: r.consecutive || undefined,
        createdDate: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : undefined,
        submissionDateTime: submissionFormatted,
        projectName: r.projects?.name || 'Proyecto Asignado',
        costCenter: r.cost_center || r.projects?.cost_center || '',
        clientName: r.client_name || r.projects?.client || '',
        applicantName: r.applicant_name || r.users?.full_name || 'Solicitante',
        applicantCedula: r.applicant_cedula || '',
        approverName: r.approver_name || 'Aprobador de Proyecto',
        deliveryDate: r.delivery_date || r.required_date || '',
        deliverySite: r.delivery_site || 'Dirección de obra',
        contactPhone: r.contact_phone || '—',
        items: itemsMapped,
        totalAmount: totalAmt,
        status: r.status,
        signatures: finalSignatures,
      });
    } catch (err) {
      console.error('Error generando descarga de PDF:', err);
      alert('Ocurrió un error al generar el archivo PDF.');
    } finally {
      setDownloadingReqId(null);
    }
  };

  // Manejo de error de permisos / acceso
  if (error) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <Navbar />
        <div className="page-hero">
          <div className="max-w-6xl mx-auto">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
              <ShoppingBag className="w-7 h-7 text-accent" strokeWidth={1.75} />
              Gestión y Control de Compras
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Monitoreo centralizado de requerimientos, órdenes emitidas y evaluación de proveedores
            </p>
          </div>
        </div>

        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center w-full">
          <div className="bg-card border border-border rounded-xl p-8 shadow-card">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">Herramienta No Habilitada</h2>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              {error instanceof Error ? error.message : 'No tienes asignada la herramienta de Gestión de Compras para tu usuario o rol corporativo.'}
            </p>
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Hero Canónico Sobrio PROCIMEC */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Gestión y Control de Compras
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Monitoreo centralizado de requerimientos, órdenes emitidas y evaluación de proveedores
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Requerimientos Pendientes</span>
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.pendingRequests ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">En espera o en cotización</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Órdenes en Tránsito</span>
              <Package className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.activeOrders ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Emitidas o recibidas parcial</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Inversión Comprometida</span>
              <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalCommittedCOP ?? 0)}
            </p>
            <p className="text-xs text-text-muted mt-1">Acumulado en órdenes de compra</p>
          </div>

          <div className="card p-4 sm:p-5 border border-border">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Proveedores Evaluados</span>
              <Star className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary font-mono">
              {dashboard?.stats.evaluatedSuppliers ?? 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Calificaciones registradas</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('requests'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            Requerimientos
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.requests.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('orders'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4" strokeWidth={1.75} />
            Órdenes de Compra
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.orders.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('suppliers'); setFilterStatus('all'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'suppliers'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Star className="w-4 h-4" strokeWidth={1.75} />
            Evaluación de Proveedores
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {dashboard?.evaluations.length ?? 0}
            </span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="card p-3 sm:p-4 border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type="text"
              placeholder={
                activeTab === 'requests'
                  ? 'Buscar por código REQ, título, solicitante o proyecto...'
                  : activeTab === 'orders'
                  ? 'Buscar por código, proveedor, NIT...'
                  : 'Buscar por nombre de proveedor...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-accent bg-surface"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Proyecto Asignado */}
            {dashboard?.projects && dashboard.projects.length > 0 && activeTab !== 'suppliers' && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent max-w-[210px] truncate"
                >
                  <option value="all">Todos los proyectos ({dashboard.projects.length})</option>
                  {dashboard.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cost_center ? `[${p.cost_center}] ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro por Estado */}
            {activeTab !== 'suppliers' && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs sm:text-sm py-1.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="all">Todos los estados</option>
                  {activeTab === 'requests' ? (
                    <>
                      <option value="pending">Pendientes VB</option>
                      <option value="in_quotation">En Cotización</option>
                      <option value="quoted">Cotizadas (Pendiente Gerencia)</option>
                      <option value="approved">Aprobadas</option>
                      <option value="purchased">Compradas</option>
                      <option value="rejected">Rechazadas</option>
                    </>
                  ) : (
                    <>
                      <option value="issued">Emitidas</option>
                      <option value="partially_received">Recibidas Parcial</option>
                      <option value="completed">Completadas</option>
                      <option value="cancelled">Canceladas</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Requests */}
        {activeTab === 'requests' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando requerimientos...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No se encontraron requerimientos registrados para los proyectos asignados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Proyecto / Cliente</th>
                      <th className="py-3 px-4">Solicitante</th>
                      <th className="py-3 px-4">Valor Estimado</th>
                      <th className="py-3 px-4">Prioridad</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRequests.map((r) => {
                      const st = STATUS_REQ_LABELS[r.status] ?? { label: r.status, badge: 'badge-outline' };
                      const pr = PRIORITY_LABELS[r.priority] ?? { label: r.priority, color: 'text-gray-700 bg-gray-50' };
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-accent/15 text-accent-800 border border-accent/30 inline-block">
                              {r.request_code || 'REQ-0001'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-text-primary truncate">
                              {r.projects?.name || r.cost_center || 'Operación'}
                            </p>
                            <p className="text-[11px] text-text-muted truncate">
                              {r.client_name || r.projects?.client || 'Cliente Corporativo'}
                            </p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <p className="font-medium text-text-primary text-xs">
                              {r.applicant_name || r.users?.full_name || '—'}
                            </p>
                            {r.approver_name && (
                              <p className="text-[10px] text-text-muted truncate max-w-[130px]">
                                Aprueba: {r.approver_name}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                            {formatCOP(r.total_amount || 0)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${pr.color}`}>
                              {pr.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="relative inline-block text-left dropdown-action-container">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === r.id ? null : r.id);
                                }}
                                className="btn bg-white hover:bg-gray-50 border border-border text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-text-primary shadow-xs font-semibold"
                              >
                                <span>Acciones</span>
                                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                              </button>

                              {openDropdownId === r.id && (
                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-border shadow-lg py-1 z-30 animate-fade-in text-left">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetail(r)}
                                    className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-primary" />
                                    Ver detalle
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(r)}
                                    disabled={downloadingReqId === r.id}
                                    className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium border-t border-border"
                                  >
                                    <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                                    {downloadingReqId === r.id ? 'Generando PDF...' : 'Descargar PDF Oficial'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <div className="card border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando órdenes de compra...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No se encontraron órdenes de compra registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4">Plazo Entrega</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((o) => {
                      const st = STATUS_ORDER_LABELS[o.status] ?? { label: o.status, badge: 'badge-outline' };
                      return (
                        <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                            {o.order_code}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-text-primary">{o.supplier_name}</p>
                            <p className="text-xs text-text-muted">{o.supplier_nit ? `NIT: ${o.supplier_nit}` : 'Sin NIT'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-primary">
                              {o.projects?.cost_center || 'General'}
                            </span>
                            <p className="text-xs text-text-muted truncate max-w-[140px]">
                              {o.projects?.name || 'Administración'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                            {formatCOP(Number(o.total_amount) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                            {o.delivery_deadline ? new Date(o.delivery_deadline).toLocaleDateString('es-CO') : 'Inmediata'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(o)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Ver detalle →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Suppliers */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="card p-8 border border-border text-center text-text-muted text-sm">Cargando evaluaciones...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="card p-8 border border-border text-center text-text-muted text-sm">
                No se encontraron proveedores evaluados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((ev) => (
                  <div key={ev.id} className="card p-5 border border-border space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-text-primary text-sm sm:text-base">{ev.supplier_name}</h4>
                        <p className="text-xs text-text-muted mt-0.5">
                          {ev.created_at ? new Date(ev.created_at).toLocaleDateString('es-CO') : 'Reciente'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-amber-800 text-xs font-bold font-mono">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {Number(ev.overall_rating).toFixed(1)} / 5
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-gray-50 rounded-lg border border-border">
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-semibold">Calidad</span>
                        <span className="font-bold text-text-primary font-mono">{ev.quality_score}/5</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-semibold">Tiempos</span>
                        <span className="font-bold text-text-primary font-mono">{ev.delivery_time_score}/5</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-semibold">Servicio</span>
                        <span className="font-bold text-text-primary font-mono">{ev.service_score}/5</span>
                      </div>
                    </div>

                    {ev.comments && (
                      <p className="text-xs text-text-secondary italic line-clamp-2">
                        &quot;{ev.comments}&quot;
                      </p>
                    )}

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-text-muted">Recomendado:</span>
                      {ev.recommend_supplier ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sí
                        </span>
                      ) : (
                        <span className="text-red-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> No
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle Requerimiento */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-accent/15 text-accent-800 border border-accent/30">
                    {selectedRequest.request_code || 'REQ-0001'}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Detalle de Solicitud
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary mt-1">{selectedRequest.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Metadatos técnicos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-surface-secondary p-3.5 rounded-xl border border-border">
              <div>
                <p className="text-text-muted">Proyecto Destino</p>
                <p className="font-semibold text-text-primary mt-0.5">
                  {selectedRequest.projects?.name || selectedRequest.cost_center || 'General'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Centro de Costo</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">
                  {selectedRequest.cost_center || selectedRequest.projects?.cost_center || '—'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Cliente</p>
                <p className="font-semibold text-text-primary mt-0.5">
                  {selectedRequest.client_name || selectedRequest.projects?.client || '—'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Solicitante (Firmante)</p>
                <p className="font-semibold text-text-primary mt-0.5">
                  {selectedRequest.applicant_name || selectedRequest.users?.full_name || '—'}
                </p>
                {selectedRequest.applicant_cedula && (
                  <span className="text-[10px] text-text-muted font-mono block">
                    C.C. {selectedRequest.applicant_cedula}
                  </span>
                )}
              </div>
              <div>
                <p className="text-text-muted">Quien Aprueba</p>
                <p className="font-semibold text-text-primary mt-0.5">
                  {selectedRequest.approver_name || '—'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Fecha y Hora de Firma</p>
                <p className="font-mono text-text-primary mt-0.5 text-[11px]">
                  {formatDateTimeCO(selectedRequest.created_at) || '—'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Fecha Requerida</p>
                <p className="font-mono text-text-primary mt-0.5">
                  {selectedRequest.delivery_date || selectedRequest.required_date || 'No especificada'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Sitio de Entrega</p>
                <p className="font-semibold text-text-primary mt-0.5 truncate">
                  {selectedRequest.delivery_site || 'Dirección de obra'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Teléfono Contacto</p>
                <p className="font-mono text-text-primary mt-0.5">
                  {selectedRequest.contact_phone || '—'}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Valor Total Estimado</p>
                <p className="font-mono font-bold text-accent-800 text-sm mt-0.5">
                  {formatCOP(selectedRequest.total_amount || 0)}
                </p>
              </div>
            </div>

            {/* Justificación */}
            {selectedRequest.justification && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted font-semibold">Justificación y Ubicación</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedRequest.justification}
                </div>
              </div>
            )}

            {/* Tabla de Ítems Solicitados */}
            {selectedRequest.items && selectedRequest.items.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <p className="text-text-muted font-semibold">Bienes e Insumos Solicitados ({selectedRequest.items.length})</p>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-text-secondary font-semibold border-b border-border">
                      <tr>
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2">Descripción</th>
                        <th className="p-2 text-center">Cant.</th>
                        <th className="p-2">Marca / Prov.</th>
                        <th className="p-2 text-right">Vlr. Unitario</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedRequest.items.map((it, idx) => {
                        const qty = Number(it.quantity) || 1;
                        const price = Number(it.unit_price) || 0;
                        const lineTotal = it.total !== undefined ? it.total : qty * price;
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-2 text-center font-mono text-text-muted">{it.item_no || idx + 1}</td>
                            <td className="p-2 font-medium text-text-primary">
                              {it.description || it.item || 'Ítem'}
                              {it.client_quote_no && (
                                <span className="block text-[10px] text-text-muted font-mono">
                                  Cot: {it.client_quote_no}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono text-text-muted">
                              {qty} {it.unit || 'Und'}
                            </td>
                            <td className="p-2 text-text-muted text-[11px]">
                              {it.brand || it.suggested_supplier || '—'}
                            </td>
                            <td className="p-2 text-right font-mono text-text-muted">
                              {formatCOP(price)}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-text-primary">
                              {formatCOP(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Control de Firmas y Trazabilidad (4 Pasos - UX Compacto de Alta Legibilidad) */}
            {(() => {
              const dirView =
                (selectedRequest.viewed_by || []).find((v) => v.instance === 'director') ||
                (selectedRequest.signatures?.director
                  ? {
                      user_name: selectedRequest.signatures.director.name,
                      viewed_at: selectedRequest.signatures.director.date_time,
                      instance: 'director',
                    }
                  : undefined);

              const purView =
                (selectedRequest.viewed_by || []).find((v) => v.instance === 'purchasing') ||
                (selectedRequest.signatures?.purchasing
                  ? {
                      user_name: selectedRequest.signatures.purchasing.name,
                      viewed_at: selectedRequest.signatures.purchasing.date_time,
                      instance: 'purchasing',
                    }
                  : undefined);

              const manView =
                (selectedRequest.viewed_by || []).find((v) => v.instance === 'management') ||
                (selectedRequest.signatures?.management
                  ? {
                      user_name: selectedRequest.signatures.management.name,
                      viewed_at: selectedRequest.signatures.management.date_time,
                      instance: 'management',
                    }
                  : undefined);

              const sigApplicant = selectedRequest.signatures?.applicant;
              const sigDirector = selectedRequest.signatures?.director;
              const sigPurchasing = selectedRequest.signatures?.purchasing;
              const sigManagement = selectedRequest.signatures?.management;

              return (
                <div className="bg-slate-50/80 border border-border rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-accent" />
                      Flujo de Firmas y Trazabilidad (4 Pasos)
                    </span>
                    <span className="text-[11px] text-text-muted hidden sm:inline">
                      Firmas completas y sellos en PDF oficial
                    </span>
                  </div>

                  {/* Grid de 4 Pasos compactos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* 1. Solicitante */}
                    <div className="p-2.5 rounded-lg border border-border bg-white flex flex-col justify-between min-h-[68px] shadow-2xs">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          1. Solicitud
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Firmado
                        </span>
                      </div>
                      <p className="font-semibold text-text-primary text-[11px] truncate" title={sigApplicant?.name || selectedRequest.applicant_name || 'Solicitante'}>
                        {sigApplicant?.name || selectedRequest.applicant_name || 'Solicitante'}
                      </p>
                      <span className="text-[10px] text-text-muted font-mono truncate">
                        {sigApplicant?.cedula ? `C.C. ${sigApplicant.cedula}` : (selectedRequest.applicant_cedula ? `C.C. ${selectedRequest.applicant_cedula}` : 'Firmado')}
                      </span>
                    </div>

                    {/* 2. VB Técnico (Director) */}
                    <div className="p-2.5 rounded-lg border border-border bg-white flex flex-col justify-between min-h-[68px] shadow-2xs">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          2. VB Técnico
                        </span>
                        {sigDirector ? (
                          sigDirector.rejected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <X className="w-3 h-3 text-rose-600" /> Rechazado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprobado
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> Pendiente
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-text-primary text-[11px] truncate" title={sigDirector?.name || selectedRequest.approver_name || 'Aprobador del Proyecto'}>
                        {sigDirector?.name || selectedRequest.approver_name || 'Aprobador Asignado'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                        <span className="truncate">{dirView ? '✓ Visto' : 'Sin ver'}</span>
                        {dirView && <Eye className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                      </div>
                    </div>

                    {/* 3. Cotización (Compras) */}
                    <div className="p-2.5 rounded-lg border border-border bg-white flex flex-col justify-between min-h-[68px] shadow-2xs">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          3. Cotización
                        </span>
                        {sigPurchasing ? (
                          sigPurchasing.rejected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <X className="w-3 h-3 text-rose-600" /> Rechazado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cotizado
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-500" /> En espera
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-text-primary text-[11px] truncate" title={sigPurchasing?.name || 'Área de Compras'}>
                        {sigPurchasing?.name || 'Área de Compras'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                        <span className="truncate">{purView ? '✓ Visto' : 'Sin ver'}</span>
                        {purView && <Eye className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                      </div>
                    </div>

                    {/* 4. Aprobación Final (Gerencia) */}
                    <div className="p-2.5 rounded-lg border border-border bg-white flex flex-col justify-between min-h-[68px] shadow-2xs">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          4. Aprobación
                        </span>
                        {sigManagement ? (
                          sigManagement.rejected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <X className="w-3 h-3 text-rose-600" /> Rechazado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprobada
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-500" /> En espera
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-text-primary text-[11px] truncate" title={sigManagement?.name || 'Gerencia General'}>
                        {sigManagement?.name || 'Gerencia General'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                        <span className="truncate">{manView ? '✓ Visto' : 'Sin ver'}</span>
                        {manView && <Eye className="w-3 h-3 text-purple-600 flex-shrink-0" />}
                      </div>
                    </div>
                  </div>

                  {/* Acordeón opcional de detalles de auditoría técnica */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowAuditDetails(!showAuditDetails)}
                      className="text-[10px] font-medium text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${showAuditDetails ? 'rotate-180 text-accent' : ''}`} />
                      <span>{showAuditDetails ? 'Ocultar detalles de firmas y fechas' : 'Ver detalle de firmas electrónicas y fechas'}</span>
                    </button>

                    {showAuditDetails && (
                      <div className="mt-2 p-2.5 bg-white rounded-lg border border-border divide-y divide-border text-[11px] text-text-muted space-y-1.5 animate-fade-in">
                        {sigApplicant && (
                          <div className="pt-1 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                            <span className="font-semibold text-text-primary">1. Solicitante: {sigApplicant.name}</span>
                            <span className="font-mono text-[10px]">C.C. {sigApplicant.cedula || '—'} · {sigApplicant.date_time || 'Registrado'}</span>
                          </div>
                        )}
                        {sigDirector && (
                          <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                            <span className="font-semibold text-text-primary">2. VB Técnico: {sigDirector.name} {sigDirector.notes ? `(${sigDirector.notes})` : ''}</span>
                            <span className="font-mono text-[10px]">C.C. {sigDirector.cedula || '—'} · {sigDirector.date_time || '—'}</span>
                          </div>
                        )}
                        {sigPurchasing && (
                          <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                            <span className="font-semibold text-text-primary">3. Cotización Compras: {sigPurchasing.name} {sigPurchasing.notes ? `(${sigPurchasing.notes})` : ''}</span>
                            <span className="font-mono text-[10px]">C.C. {sigPurchasing.cedula || '—'} · {sigPurchasing.date_time || '—'}</span>
                          </div>
                        )}
                        {sigManagement && (
                          <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                            <span className="font-semibold text-text-primary">4. Gerencia General: {sigManagement.name} {sigManagement.notes ? `(${sigManagement.notes})` : ''}</span>
                            <span className="font-mono text-[10px]">C.C. {sigManagement.cedula || '—'} · {sigManagement.date_time || '—'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Formulario de Firma o Mensaje de Éxito */}
            {signingSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {signingSuccessMsg}
              </div>
            )}

            {signingStep && (
              <div className="p-4 rounded-xl border-2 border-accent/40 bg-accent/5 space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text-primary">
                    {signingAction === 'reject' ? 'Rechazar Solicitud' : 'Estampar Firma Electrónica'} —{' '}
                    {signingStep === 'director'
                      ? 'Dirección de Proyecto (VB Técnico)'
                      : signingStep === 'purchasing'
                      ? 'Área de Compras (Validación Precios)'
                      : 'Gerencia General (Aprobación Final)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSigningStep(null)}
                    className="text-text-muted hover:text-text-primary text-xs"
                  >
                    ✕ Cancelar
                  </button>
                </div>

                {signingAction === 'approve' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-text-primary mb-1">
                      Cédula de Ciudadanía del Firmante <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={signerCedula}
                      onChange={(e) => setSignerCedula(e.target.value)}
                      placeholder="Ej: 1098765432"
                      className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-text-primary mb-1">
                    {signingAction === 'reject' ? 'Motivo del Rechazo *' : 'Observaciones o Justificación (Opcional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={signerNotes}
                    onChange={(e) => setSignerNotes(e.target.value)}
                    placeholder={signingAction === 'reject' ? 'Explica por qué se rechaza la solicitud...' : 'Notas para compras o gerencia...'}
                    className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSigningStep(null)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs bg-white text-text-primary hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSignSubmit}
                    disabled={isSubmittingSignature}
                    className={`btn text-xs px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                      signingAction === 'reject'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-accent text-primary-900 hover:bg-accent-400'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {isSubmittingSignature ? 'Registrando...' : signingAction === 'reject' ? 'Confirmar Rechazo' : 'Firmar y Registrar'}
                  </button>
                </div>
              </div>
            )}

            {/* Barra de botones de acción rápida según rol del usuario conectado */}
            {!signingStep && (
              <div className="p-3 bg-surface-secondary rounded-xl border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-text-muted font-medium">Gestión y Firmas de Solicitud:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Opción 1: Aprobación del Proyecto (si está pendiente de VB inicial) */}
                  {(!selectedRequest.signatures?.director && selectedRequest.status === 'pending') && (
                    canSignDirector ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSigningStep('director'); setSigningAction('reject'); }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-semibold"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSigningStep('director'); setSigningAction('approve'); }}
                          className="btn bg-accent text-primary-900 font-bold hover:bg-accent-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          Dar Aprobación y Firmar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                        Pendiente de aprobación por {selectedRequest.approver_name || 'Aprobador del Proyecto'}
                      </span>
                    )
                  )}

                  {/* Opción 2: Cotización de Compras (si ya tiene VB de proyecto y está en cotización) */}
                  {(selectedRequest.signatures?.director && !selectedRequest.signatures?.purchasing && selectedRequest.status !== 'rejected') && (
                    isPurchasing ? (
                      <button
                        type="button"
                        onClick={() => { setSigningStep('purchasing'); setSigningAction('approve'); }}
                        className="btn bg-accent text-primary-900 font-bold hover:bg-accent-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        Firmar Cotización de Compras
                      </button>
                    ) : (
                      <span className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 font-medium">
                        En gestión de cotización por el Área de Compras
                      </span>
                    )
                  )}

                  {/* Opción 3: Aprobación Final de Gerencia (si ya fue cotizada y está pendiente de firma final) */}
                  {(selectedRequest.signatures?.purchasing && !selectedRequest.signatures?.management && selectedRequest.status !== 'rejected') && (
                    isManagement ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSigningStep('management'); setSigningAction('reject'); }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-semibold"
                        >
                          Rechazar Compra
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSigningStep('management'); setSigningAction('approve'); }}
                          className="btn bg-emerald-600 text-white font-bold hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Aprobar Compra Final (Gerencia)
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 font-medium">
                        Cotización registrada. En espera de aprobación final por Gerencia General
                      </span>
                    )
                  )}

                  {/* Estado finalizado de solicitud aprobada */}
                  {Boolean(selectedRequest.signatures?.management || selectedRequest.status === 'approved') && (
                    <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Solicitud aprobada formalmente por Gerencia General
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Acciones del Modal */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDownloadPdf(selectedRequest)}
                disabled={downloadingReqId === selectedRequest.id}
                className="btn bg-accent text-primary-900 font-bold hover:bg-accent-400 focus:ring-accent px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4 text-primary-900 stroke-[2.5]" />
                {downloadingReqId === selectedRequest.id ? 'Generando PDF...' : 'Descargar PDF Oficial'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Orden de Compra */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">{selectedOrder.order_code}</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{selectedOrder.supplier_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">NIT / Identificación</p>
                <p className="font-mono font-semibold text-text-primary mt-0.5">{selectedOrder.supplier_nit || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Contacto Proveedor</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.supplier_contact || '—'}</p>
              </div>
              <div>
                <p className="text-text-muted">Monto Total</p>
                <p className="font-mono font-bold text-base text-primary mt-0.5">{formatCOP(Number(selectedOrder.total_amount) || 0)}</p>
              </div>
              <div>
                <p className="text-text-muted">Condiciones de Pago</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.payment_terms || 'Contado'}</p>
              </div>
              <div>
                <p className="text-text-muted">Fecha Límite Entrega</p>
                <p className="font-mono text-text-primary mt-0.5">{selectedOrder.delivery_deadline || 'Inmediata'}</p>
              </div>
              <div>
                <p className="text-text-muted">Proyecto Asignado</p>
                <p className="font-semibold text-text-primary mt-0.5">{selectedOrder.projects?.name || 'Administración'}</p>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="space-y-1 text-xs">
                <p className="text-text-muted">Observaciones y Términos</p>
                <div className="p-3 bg-gray-50 rounded-xl border border-border text-text-secondary leading-relaxed">
                  {selectedOrder.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              {selectedOrder.attachment_url ? (
                <a
                  href={selectedOrder.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver soporte / Cotización
                </a>
              ) : <span />}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors"
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
