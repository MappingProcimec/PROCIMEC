'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
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
  Building2,
  DollarSign,
  Star,
  FileText,
  ExternalLink,
  Download,
  ChevronDown,
  Eye,
  PenTool,
  ShieldCheck,
  Check,
  X,
  Layers,
  ArrowRight,
  Plus,
  RotateCw,
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
  budget_rubro?: string;
  budget_item_id?: string;
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
  purchase_order_id?: string | null;
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

type PurchasingTab =
  | 'timeline'
  | 'requests'
  | 'approvals'
  | 'quotations'
  | 'management_approval'
  | 'orders'
  | 'evaluations';

export default function PurchasingDashboardPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PurchasingTab>('timeline');
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

  const { data, isLoading, isFetching, error, refetch } = useQuery<{ data: PurchasingDashboardData }>({
    queryKey: ['purchasing-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/tools/purchasing-dashboard');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al cargar datos de compras');
      }
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dashboard = data?.data;

  // Gobernanza de Roles y Permisos RBAC
  const currentUser = dashboard?.currentUser;
  const userRole = (currentUser?.role || session?.user?.role || 'pending').toLowerCase();
  const currentUserId = currentUser?.id || session?.user?.id || '';
  const currentUserName = (currentUser?.name || session?.user?.name || '').toLowerCase().trim();

  const isAdmin = userRole === 'admin';
  const isManagement = isAdmin || ['management', 'gerencia'].includes(userRole);
  const isPurchasing = isAdmin || isManagement || ['purchasing', 'compras'].includes(userRole);
  const isWarehouse = isAdmin || isManagement || isPurchasing || ['warehouse', 'almacen'].includes(userRole);
  const isQualityOrHseq = isAdmin || isManagement || isPurchasing || ['hseq'].includes(userRole);

  // Verificación de si el usuario tiene requerimientos pendientes por aprobar como director
  const hasAssignedApprovals = useMemo(() => {
    if (!dashboard?.requests) return false;
    return dashboard.requests.some((r) => {
      const matchName = r.approver_name && r.approver_name.toLowerCase().trim() === currentUserName;
      const matchId = r.approver_user_id && r.approver_user_id === currentUserId;
      return matchName || matchId;
    });
  }, [dashboard?.requests, currentUserName, currentUserId]);

  const canViewApprovals = isManagement || hasAssignedApprovals || userRole.includes('director');
  const canViewQuotations = isPurchasing;
  const canViewManagementApproval = isManagement;
  const canViewOrders = isWarehouse;
  const canViewEvaluations = isQualityOrHseq;

  // Fallback seguro si la pestaña actual deja de estar autorizada
  useEffect(() => {
    if (activeTab === 'approvals' && !canViewApprovals) setActiveTab('timeline');
    if (activeTab === 'quotations' && !canViewQuotations) setActiveTab('timeline');
    if (activeTab === 'management_approval' && !canViewManagementApproval) setActiveTab('timeline');
    if (activeTab === 'orders' && !canViewOrders) setActiveTab('timeline');
    if (activeTab === 'evaluations' && !canViewEvaluations) setActiveTab('timeline');
  }, [activeTab, canViewApprovals, canViewQuotations, canViewManagementApproval, canViewOrders, canViewEvaluations]);

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

  // Verificar si el usuario conectado puede firmar como Director en la solicitud seleccionada
  const isDesignatedApprover = selectedRequest
    ? (Boolean(selectedRequest.approver_name) &&
        Boolean(currentUserName) &&
        (selectedRequest.approver_name || '').toLowerCase().trim() === currentUserName) ||
      (Boolean(selectedRequest.approver_user_id) && selectedRequest.approver_user_id === currentUserId)
    : false;

  const canSignDirector = isAdmin || isManagement || isDesignatedApprover || userRole.includes('director');

  // Filtrado general de requerimientos
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

  // Bandeja 3: Pendientes VB Técnico (Directores de Proyecto)
  const pendingApprovals = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const isPendingVB = !r.signatures?.director && r.status === 'pending';
      const matchSearch =
        search === '' ||
        (r.request_code || '').toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.applicant_name || '').toLowerCase().includes(search.toLowerCase());
      const matchProject =
        filterProject === 'all' ||
        r.project_id === filterProject ||
        r.projects?.id === filterProject;

      return isPendingVB && matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  // Bandeja 4: En Cotización (Área de Compras)
  const inQuotationRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const isInQuote =
        Boolean(r.signatures?.director) &&
        !r.signatures?.purchasing &&
        r.status !== 'rejected';
      const matchSearch =
        search === '' ||
        (r.request_code || '').toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.applicant_name || '').toLowerCase().includes(search.toLowerCase());
      const matchProject =
        filterProject === 'all' ||
        r.project_id === filterProject ||
        r.projects?.id === filterProject;

      return isInQuote && matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  // Bandeja 5: Aprobación GG (Gerencia General)
  const managementPendingRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const isPendingGG =
        Boolean(r.signatures?.purchasing) &&
        !r.signatures?.management &&
        r.status !== 'rejected';
      const matchSearch =
        search === '' ||
        (r.request_code || '').toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.applicant_name || '').toLowerCase().includes(search.toLowerCase());
      const matchProject =
        filterProject === 'all' ||
        r.project_id === filterProject ||
        r.projects?.id === filterProject;

      return isPendingGG && matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  // Filtrado de órdenes de compra
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

  // Filtrado de proveedores evaluados
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

  // Abrir detalle con registro silencioso de auditoría ("Visto por")
  const handleOpenDetail = (r: PurchaseRequest) => {
    setSelectedRequest(r);
    setSigningStep(null);
    setSigningSuccessMsg(null);
    setSignerCedula('');
    setSignerNotes('');
    setOpenDropdownId(null);

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
      .catch((err) => console.warn('Advertencia registrando vista silenciosa:', err));
  };

  // Acceso directo a firma desde bandejas operativas
  const handleOpenDirectSign = (
    r: PurchaseRequest,
    step: 'director' | 'purchasing' | 'management',
    action: 'approve' | 'reject'
  ) => {
    handleOpenDetail(r);
    setSigningStep(step);
    setSigningAction(action);
  };

  // Procesar firma electrónica y cambio de estado
  const handleSignSubmit = async () => {
    if (!selectedRequest || !signingStep) return;
    if (signingAction === 'approve' && !signerCedula.trim()) {
      alert('Debes ingresar tu número de cédula para estampar la firma electrónica legal.');
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
      queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la firma');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Descargar PDF de requerimiento FOR-COM-001
  const handleDownloadPdf = (r: PurchaseRequest) => {
    try {
      setDownloadingReqId(r.id);
      setOpenDropdownId(null);
      const itemsMapped: PurchaseRequestPdfItem[] = (r.items || []).map((it, idx) => ({
        item_no: it.item_no || idx + 1,
        quantity: it.quantity || 1,
        unit: it.unit || 'Und',
        description: it.description || it.item || 'Ítem sin descripción',
        budget_rubro: it.budget_rubro || it.client_quote_no || '',
        client_quote_no: it.budget_rubro || it.client_quote_no || '',
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
        <section className="page-hero">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
              <ShoppingBag className="w-7 h-7 text-accent" strokeWidth={1.75} />
              Gestión y Control de Compras
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Monitoreo centralizado de requerimientos, órdenes emitidas y evaluación de proveedores
            </p>
          </div>
        </section>

        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center w-full">
          <div className="bg-white border border-border rounded-xl p-8 shadow-card">
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
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Institucional Oscuro Carbón (Estándar PCM CLOUD) */}
      <section className="page-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-3">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-accent/20 text-accent font-mono">
                  PCM CLOUD &bull; HERRAMIENTA TÉCNICA
                </span>
                <span className="text-white/60 text-xs">Gestión & Control de Compras</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-accent shrink-0" strokeWidth={1.75} />
                Gestión y Control de Compras
              </h1>
              <p className="text-white/70 text-xs sm:text-sm mt-1 max-w-2xl">
                Trazabilidad articulada de Requerimientos, Aprobaciones Técnicas, Cotizaciones, Aprobación GG, Órdenes de Compra y Evaluación de Proveedores.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
                  refetch();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/15 transition-all shadow-xs"
                title="Recargar datos del servidor"
              >
                <RotateCw className={`w-3.5 h-3.5 text-accent ${isFetching ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>

              <Link
                href="/forms/requerimiento-compra"
                className="px-4 py-2.5 rounded-xl bg-accent text-primary-900 font-extrabold text-xs flex items-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all shadow-md"
              >
                <Plus className="w-4 h-4 text-primary-900" strokeWidth={2.5} />
                Nuevo Requerimiento
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contenedor Principal en Superficie Clara */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Resumen Ejecutivo KPI (5 Tarjetas Adaptadas) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Inversión Comprometida</span>
              <DollarSign className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono truncate">
              {formatCOP(dashboard?.stats.totalCommittedCOP ?? 0)}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Acumulado en órdenes de compra</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Requerimientos</span>
              <FileText className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {dashboard?.requests?.length ?? 0}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Solicitudes registradas</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pendientes VB</span>
              <ShieldCheck className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {pendingApprovals.length}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">En revisión de directores</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cotización / GG</span>
              <ShoppingBag className="w-4 h-4 text-purple-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {inQuotationRequests.length + managementPendingRequests.length}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">En compras o gerencia</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Órdenes / Calidad</span>
              <Star className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono truncate">
              {dashboard?.orders?.length ?? 0} OC / {dashboard?.evaluations?.length ?? 0} Prov.
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">Calificaciones registradas</p>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-3.5 bg-white border border-border shadow-card rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'orders'
                  ? 'Buscar por código OC, proveedor, NIT...'
                  : activeTab === 'evaluations'
                  ? 'Buscar por proveedor o comentarios...'
                  : 'Buscar por código REQ, título, solicitante o proyecto...'
              }
              className="input w-full pl-9 py-2 text-xs bg-white text-text-primary border-border focus:ring-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filtro por Proyecto Asignado */}
            {dashboard?.projects && dashboard.projects.length > 0 && activeTab !== 'evaluations' && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="input py-1.5 text-xs bg-white text-text-primary border-border focus:ring-accent max-w-[210px] truncate"
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

            {/* Filtro por Estado (en pestañas de Requerimientos y Órdenes) */}
            {(activeTab === 'requests' || activeTab === 'orders') && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input py-1.5 text-xs bg-white text-text-primary border-border focus:ring-accent"
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

        {/* Navegador de Pestañas con Estándar PCM CLOUD y RBAC Estricto */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-accent text-primary-900 shadow-sm'
                : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" strokeWidth={1.75} />
            1. Cadena de Trazabilidad
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('requests'); setFilterStatus('all'); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-accent text-primary-900 shadow-sm'
                : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            2. Requerimientos ({dashboard?.requests?.length ?? 0})
          </button>

          {canViewApprovals && (
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'approvals'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
              3. VB Técnico ({pendingApprovals.length})
            </button>
          )}

          {canViewQuotations && (
            <button
              type="button"
              onClick={() => setActiveTab('quotations')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'quotations'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
              4. En Cotización ({inQuotationRequests.length})
            </button>
          )}

          {canViewManagementApproval && (
            <button
              type="button"
              onClick={() => setActiveTab('management_approval')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'management_approval'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
              5. Aprobación GG ({managementPendingRequests.length})
            </button>
          )}

          {canViewOrders && (
            <button
              type="button"
              onClick={() => { setActiveTab('orders'); setFilterStatus('all'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <Package className="w-4 h-4" strokeWidth={1.75} />
              6. Órdenes de Compra ({dashboard?.orders?.length ?? 0})
            </button>
          )}

          {canViewEvaluations && (
            <button
              type="button"
              onClick={() => setActiveTab('evaluations')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'evaluations'
                  ? 'bg-accent text-primary-900 shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:text-text-primary hover:bg-slate-50'
              }`}
            >
              <Star className="w-4 h-4" strokeWidth={1.75} />
              7. Evaluación Proveedores ({dashboard?.evaluations?.length ?? 0})
            </button>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 1: CADENA DE TRAZABILIDAD ARTICULADA (TIMELINE VISUAL)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl">
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">
                Mapa de Flujo de Compras y Articulación Integral
              </h2>
              <p className="text-xs text-text-secondary">
                Visualización de expedientes conectados: Requerimiento &rarr; VB Técnico &rarr; Cotización Compras &rarr; Aprobación GG &rarr; Orden de Compra &rarr; Evaluación de Proveedor.
              </p>
            </div>

            {isLoading ? (
              <div className="card p-8 bg-white border border-border text-center text-text-muted text-sm">
                Cargando mapa de trazabilidad...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="card p-8 bg-white border border-border text-center text-text-muted text-sm">
                No se encontraron expedientes de compras registrados para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((r) => {
                  const linkedOrder = dashboard?.orders?.find((o) => o.purchase_request_id === r.id);
                  const linkedEval = linkedOrder
                    ? dashboard?.evaluations?.find(
                        (e) =>
                          e.purchase_order_id === linkedOrder.id ||
                          e.supplier_name.toLowerCase().trim() === linkedOrder.supplier_name.toLowerCase().trim()
                      )
                    : undefined;

                  const sigDirector = r.signatures?.director;
                  const sigPurchasing = r.signatures?.purchasing;
                  const sigManagement = r.signatures?.management;

                  return (
                    <div
                      key={r.id}
                      className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl hover:border-accent/50 transition-all"
                    >
                      {/* Cabecera del Expediente */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-amber-700">
                            {r.request_code || 'REQ-0001'}
                          </span>
                          <span className="text-text-muted text-xs">&bull;</span>
                          <strong className="text-text-primary text-sm font-semibold truncate max-w-md">
                            {r.projects?.name || r.cost_center || 'Operación'} — {r.title}
                          </strong>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-primary text-sm">
                            {formatCOP(r.total_amount || 0)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r)}
                            disabled={downloadingReqId === r.id}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary"
                            title="Descargar PDF Oficial FOR-COM-001"
                          >
                            <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDetail(r)}
                            className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-primary-900 font-bold text-xs flex items-center gap-1 border border-accent/30 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Expediente</span>
                          </button>
                        </div>
                      </div>

                      {/* Cadena de Nodos Visual de 6 Pasos Conectados */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* 1. Nodo Requerimiento */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
                          <FileText className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.75} />
                          <span className="text-[11px] font-mono">{r.request_code || 'REQ'}</span>
                          <span className="text-[10px] text-blue-700 bg-blue-100 px-1 rounded">Firmado</span>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />

                        {/* 2. Nodo VB Técnico */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                            sigDirector
                              ? sigDirector.rejected
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-300 text-amber-900'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                          <span className="text-[11px]">
                            {sigDirector
                              ? sigDirector.rejected
                                ? 'VB Rechazado'
                                : 'VB Aprobado'
                              : 'Pendiente VB'}
                          </span>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />

                        {/* 3. Nodo Cotización (Compras) */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                            sigPurchasing
                              ? sigPurchasing.rejected
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : sigDirector
                              ? 'bg-blue-50 border-blue-300 text-blue-900'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                          <span className="text-[11px]">
                            {sigPurchasing
                              ? sigPurchasing.rejected
                                ? 'Cotiz. Rechazada'
                                : 'Cotizado'
                              : sigDirector
                              ? 'En Cotización'
                              : 'En espera'}
                          </span>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />

                        {/* 4. Nodo Aprobación GG */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                            sigManagement || r.status === 'approved'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : r.status === 'rejected'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : sigPurchasing
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                          <span className="text-[11px]">
                            {sigManagement || r.status === 'approved'
                              ? 'Aprobada GG'
                              : r.status === 'rejected'
                              ? 'Rechazada GG'
                              : sigPurchasing
                              ? 'Pendiente GG'
                              : 'En espera'}
                          </span>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />

                        {/* 5. Nodo Orden de Compra (OC) */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                            linkedOrder
                              ? linkedOrder.status === 'completed'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-blue-50 border-blue-200 text-blue-800'
                              : r.status === 'approved'
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <Package className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                          <span className="text-[11px] font-mono">
                            {linkedOrder
                              ? linkedOrder.order_code
                              : r.status === 'approved'
                              ? 'Pendiente OC'
                              : 'Sin Emitir'}
                          </span>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />

                        {/* 6. Nodo Evaluación de Proveedor */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                            linkedEval
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : linkedOrder
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 shrink-0 text-amber-500 fill-amber-500" strokeWidth={1.75} />
                          <span className="text-[11px]">
                            {linkedEval
                              ? `${Number(linkedEval.overall_rating).toFixed(1)} ★ (${linkedEval.supplier_name.slice(0, 10)})`
                              : linkedOrder
                              ? 'Pendiente Eval.'
                              : 'Sin Evaluación'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 2: CATÁLOGO Y HISTÓRICO DE REQUERIMIENTOS
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="card border border-border bg-white rounded-xl shadow-card overflow-hidden">
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

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 3: BANDEJA DE VB TÉCNICO (DIRECTORES DE PROYECTO)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'approvals' && canViewApprovals && (
          <div className="space-y-4">
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  Bandeja de Visto Bueno Técnico de Directores
                </h2>
                <p className="text-xs text-text-secondary">
                  Solicitudes radicadas pendientes de revisión técnica inicial para autorización hacia el área de compras.
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold rounded-lg self-start sm:self-auto font-mono">
                {pendingApprovals.length} Pendientes
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="card p-12 bg-white border border-border text-center rounded-2xl shadow-card">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-text-primary">¡Bandeja al día!</h3>
                <p className="text-xs text-text-secondary mt-1">
                  No hay requerimientos pendientes de visto bueno técnico en tus proyectos asignados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingApprovals.map((r) => (
                  <div
                    key={r.id}
                    className="card p-5 bg-white border border-border shadow-card rounded-xl hover:border-accent/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                          {r.request_code || 'REQ'}
                        </span>
                        <span className="text-xs font-bold font-mono text-text-primary">
                          {formatCOP(r.total_amount || 0)}
                        </span>
                      </div>

                      <h3 className="font-bold text-text-primary text-sm mb-1">{r.title}</h3>
                      <p className="text-xs text-text-secondary mb-3">
                        <strong className="text-text-primary">Proyecto:</strong> {r.projects?.name || r.cost_center || 'General'} &bull;{' '}
                        <strong className="text-text-primary">Solicita:</strong> {r.applicant_name || 'Ingeniero de Campo'}
                      </p>

                      {r.justification && (
                        <div className="p-3 bg-slate-50 border border-border rounded-lg text-xs text-text-secondary line-clamp-3 mb-4">
                          {r.justification}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary hover:bg-slate-50 font-semibold"
                      >
                        Ver Ítems ({r.items?.length || 0})
                      </button>

                      {canSignDirector && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDirectSign(r, 'director', 'reject')}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-xs"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDirectSign(r, 'director', 'approve')}
                            className="px-3.5 py-1.5 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs flex items-center gap-1.5 shadow-sm"
                          >
                            <PenTool className="w-3.5 h-3.5 text-primary-900" />
                            Aprobar y Firmar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 4: BANDEJA DE COTIZACIÓN (ÁREA DE COMPRAS)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'quotations' && canViewQuotations && (
          <div className="space-y-4">
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-accent" />
                  Bandeja de Gestión de Cotizaciones (Área de Compras)
                </h2>
                <p className="text-xs text-text-secondary">
                  Requerimientos con visto bueno técnico aprobados, listos para cotización con proveedores e ingreso de valores finales.
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold rounded-lg self-start sm:self-auto font-mono">
                {inQuotationRequests.length} en Cotización
              </span>
            </div>

            {inQuotationRequests.length === 0 ? (
              <div className="card p-12 bg-white border border-border text-center rounded-2xl shadow-card">
                <CheckCircle2 className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-text-primary">Sin cotizaciones pendientes</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Todas las solicitudes cuentan con cotización registrada o están a la espera de aprobación técnica.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inQuotationRequests.map((r) => (
                  <div
                    key={r.id}
                    className="card p-5 bg-white border border-border shadow-card rounded-xl hover:border-accent/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                          {r.request_code || 'REQ'}
                        </span>
                        <span className="text-xs font-bold font-mono text-text-primary">
                          {formatCOP(r.total_amount || 0)}
                        </span>
                      </div>

                      <h3 className="font-bold text-text-primary text-sm mb-1">{r.title}</h3>
                      <p className="text-xs text-text-secondary mb-2">
                        <strong className="text-text-primary">Proyecto:</strong> {r.projects?.name || r.cost_center || 'General'} &bull;{' '}
                        <strong className="text-text-primary">Aprobó VB:</strong> {r.signatures?.director?.name || r.approver_name || 'Director'}
                      </p>

                      <div className="p-3 bg-slate-50 border border-border rounded-lg text-xs space-y-1 mb-4">
                        <p className="font-semibold text-text-primary">Insumos y Proveedores sugeridos:</p>
                        <p className="text-text-secondary truncate">
                          {(r.items || []).map((it) => `${it.description || it.item} (${it.quantity} ${it.unit})`).join(' · ') || 'Sin ítems'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary hover:bg-slate-50 font-semibold"
                      >
                        Ver Detalle & Ítems
                      </button>

                      {isPurchasing && (
                        <button
                          type="button"
                          onClick={() => handleOpenDirectSign(r, 'purchasing', 'approve')}
                          className="px-3.5 py-1.5 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <PenTool className="w-3.5 h-3.5 text-primary-900" />
                          Firmar Cotización de Compras
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 5: BANDEJA DE APROBACIÓN GG (GERENCIA GENERAL)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'management_approval' && canViewManagementApproval && (
          <div className="space-y-4">
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Bandeja de Aprobación Final y Desembolso (Gerencia General)
                </h2>
                <p className="text-xs text-text-secondary">
                  Requerimientos cotizados formalmente por compras en espera de autorización legal y financiera de la alta gerencia.
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold rounded-lg self-start sm:self-auto font-mono">
                {managementPendingRequests.length} Por Autorizar
              </span>
            </div>

            {managementPendingRequests.length === 0 ? (
              <div className="card p-12 bg-white border border-border text-center rounded-2xl shadow-card">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-text-primary">Sin compras pendientes de gerencia</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Todas las compras cotizadas han sido aprobadas formalmente o se encuentran en etapas previas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {managementPendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="card p-5 bg-white border border-border shadow-card rounded-xl hover:border-accent/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200">
                          {r.request_code || 'REQ'}
                        </span>
                        <span className="text-sm font-extrabold font-mono text-emerald-700">
                          {formatCOP(r.total_amount || 0)}
                        </span>
                      </div>

                      <h3 className="font-bold text-text-primary text-sm mb-1">{r.title}</h3>
                      <p className="text-xs text-text-secondary mb-2">
                        <strong className="text-text-primary">Proyecto:</strong> {r.projects?.name || r.cost_center || 'General'} &bull;{' '}
                        <strong className="text-text-primary">Cotizó:</strong> {r.signatures?.purchasing?.name || 'Compras'}
                      </p>

                      <div className="p-3 bg-slate-50 border border-border rounded-lg text-xs space-y-1 mb-4">
                        <p className="font-semibold text-text-primary">Desglose de Cotización:</p>
                        <p className="text-text-secondary text-[11px] truncate">
                          {(r.items || []).length} ítems &bull; Sitio de Entrega: {r.delivery_site || 'Obra'} &bull; Tel: {r.contact_phone || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary hover:bg-slate-50 font-semibold"
                      >
                        Ver Expediente
                      </button>

                      {isManagement && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDirectSign(r, 'management', 'reject')}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-xs"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDirectSign(r, 'management', 'approve')}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all text-xs flex items-center gap-1.5 shadow-sm"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Aprobar Compra Final (GG)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 6: ÓRDENES DE COMPRA (OC)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && canViewOrders && (
          <div className="card border border-border bg-white rounded-xl shadow-card overflow-hidden">
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
                              className="btn bg-white hover:bg-gray-50 border border-border text-xs px-2.5 py-1.5 rounded-lg text-text-primary shadow-xs font-semibold"
                            >
                              Ver Orden
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

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 7: EVALUACIÓN DE PROVEEDORES (ISO 9001 / SIG)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'evaluations' && canViewEvaluations && (
          <div className="space-y-4">
            <div className="card p-5 bg-white border border-border shadow-card rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Gobernanza de Calidad y Evaluación de Proveedores
                </h2>
                <p className="text-xs text-text-secondary">
                  Histórico de desempeño técnico, cumplimiento de tiempos y nivel de servicio de aliados estratégicos según norma ISO 9001.
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold rounded-lg self-start sm:self-auto font-mono">
                {filteredSuppliers.length} Evaluados
              </span>
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="card p-12 bg-white border border-border text-center rounded-2xl shadow-card">
                <Star className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-text-primary">Sin evaluaciones registradas</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Aún no se han completado encuestas de desempeño de proveedores en el sistema.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((ev) => (
                  <div key={ev.id} className="card p-5 bg-white border border-border shadow-card rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-text-primary text-sm">{ev.supplier_name}</h4>
                        <p className="text-[11px] text-text-muted">
                          Evaluado el {new Date(ev.created_at).toLocaleDateString('es-CO')}
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
      </main>

      {/* ────────────────────────────────────────────────────────────────────
          MODAL DETALLE DE REQUERIMIENTO (FLUJO COMPLETO DE FIRMAS & AUDITORÍA)
         ──────────────────────────────────────────────────────────────────── */}
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
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" strokeWidth={2} />
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
                              {(it.budget_rubro || it.client_quote_no) && (
                                <span className="block text-[10px] text-amber-700 font-mono font-semibold">
                                  APU: {it.budget_rubro || it.client_quote_no}
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

              const formatViewTime = (viewedAt?: string) => {
                if (!viewedAt) return '';
                const parts = viewedAt.split(',');
                if (parts.length > 1) {
                  const timeWithSec = parts[1].trim();
                  return timeWithSec.replace(/:\d{2}\s/, ' ');
                }
                return viewedAt;
              };

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
                      <div
                        className="flex items-center justify-between text-[10px] text-text-muted mt-0.5 cursor-help"
                        title={dirView ? `Visualizado por ${dirView.user_name} el ${dirView.viewed_at}` : 'Pendiente de visualización'}
                      >
                        <span className="truncate flex items-center gap-1 font-mono text-[9px]">
                          {dirView ? (
                            <>
                              <span className="text-emerald-700 font-semibold font-sans flex items-center gap-0.5"><Check className="w-3 h-3 text-emerald-600 inline" strokeWidth={2.5} /> Visto</span>
                              <span className="text-text-secondary">{formatViewTime(dirView.viewed_at)}</span>
                            </>
                          ) : (
                            <span className="italic text-text-muted/60">Sin ver</span>
                          )}
                        </span>
                        {dirView ? (
                          <Eye className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Eye className="w-3 h-3 text-text-muted/40 flex-shrink-0" />
                        )}
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
                      <div
                        className="flex items-center justify-between text-[10px] text-text-muted mt-0.5 cursor-help"
                        title={purView ? `Visualizado por ${purView.user_name} el ${purView.viewed_at}` : 'Pendiente de visualización'}
                      >
                        <span className="truncate flex items-center gap-1 font-mono text-[9px]">
                          {purView ? (
                            <>
                              <span className="text-blue-700 font-semibold font-sans flex items-center gap-0.5"><Check className="w-3 h-3 text-blue-600 inline" strokeWidth={2.5} /> Visto</span>
                              <span className="text-text-secondary">{formatViewTime(purView.viewed_at)}</span>
                            </>
                          ) : (
                            <span className="italic text-text-muted/60">Sin ver</span>
                          )}
                        </span>
                        {purView ? (
                          <Eye className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Eye className="w-3 h-3 text-text-muted/40 flex-shrink-0" />
                        )}
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
                      <div
                        className="flex items-center justify-between text-[10px] text-text-muted mt-0.5 cursor-help"
                        title={manView ? `Visualizado por ${manView.user_name} el ${manView.viewed_at}` : 'Pendiente de visualización'}
                      >
                        <span className="truncate flex items-center gap-1 font-mono text-[9px]">
                          {manView ? (
                            <>
                              <span className="text-purple-700 font-semibold font-sans flex items-center gap-0.5"><Check className="w-3 h-3 text-purple-600 inline" strokeWidth={2.5} /> Visto</span>
                              <span className="text-text-secondary">{formatViewTime(manView.viewed_at)}</span>
                            </>
                          ) : (
                            <span className="italic text-text-muted/60">Sin ver</span>
                          )}
                        </span>
                        {manView ? (
                          <Eye className="w-3 h-3 text-purple-600 flex-shrink-0" />
                        ) : (
                          <Eye className="w-3 h-3 text-text-muted/40 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acordeón de detalles de auditoría técnica */}
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
                            <span className="font-mono text-[10px]">Firma: C.C. {sigApplicant.cedula || '—'} &bull; {sigApplicant.date_time || 'Registrado'}</span>
                          </div>
                        )}
                        <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <span className="font-semibold text-text-primary">2. VB Técnico: {sigDirector?.name || selectedRequest.approver_name || 'Pendiente'}</span>
                            {dirView && (
                              <span className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                                <Eye className="w-3 h-3 text-emerald-600 shrink-0" strokeWidth={1.75} />
                                <span>Visto por: {dirView.user_name} (<span className="font-mono">{dirView.viewed_at}</span>)</span>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px]">
                            {sigDirector ? `Firma: C.C. ${sigDirector.cedula || '—'} &bull; ${sigDirector.date_time || '—'}` : 'Sin firma'}
                          </span>
                        </div>
                        <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <span className="font-semibold text-text-primary">3. Cotización: {sigPurchasing?.name || 'Área de Compras'}</span>
                            {purView && (
                              <span className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                                <Eye className="w-3 h-3 text-blue-600 shrink-0" strokeWidth={1.75} />
                                <span>Visto por: {purView.user_name} (<span className="font-mono">{purView.viewed_at}</span>)</span>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px]">
                            {sigPurchasing ? `Firma: C.C. ${sigPurchasing.cedula || '—'} &bull; ${sigPurchasing.date_time || '—'}` : 'Sin firma'}
                          </span>
                        </div>
                        <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <span className="font-semibold text-text-primary">4. Gerencia General: {sigManagement?.name || 'Gerencia General'}</span>
                            {manView && (
                              <span className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                                <Eye className="w-3 h-3 text-purple-600 shrink-0" strokeWidth={1.75} />
                                <span>Visto por: {manView.user_name} (<span className="font-mono">{manView.viewed_at}</span>)</span>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px]">
                            {sigManagement ? `Firma: C.C. ${sigManagement.cedula || '—'} &bull; ${sigManagement.date_time || '—'}` : 'Sin firma'}
                          </span>
                        </div>
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
                      ? 'Área de Compras (Validación de Precios)'
                      : 'Gerencia General (Aprobación Final)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSigningStep(null)}
                    className="text-text-muted hover:text-text-primary text-xs flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancelar</span>
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
                    placeholder={signingAction === 'reject' ? 'Explica detalladamente por qué se rechaza la solicitud...' : 'Notas para compras o gerencia...'}
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
                  {/* Opción 1: VB Técnico del Proyecto */}
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

                  {/* Opción 2: Cotización de Compras */}
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

                  {/* Opción 3: Aprobación Final de Gerencia */}
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

      {/* ────────────────────────────────────────────────────────────────────
          MODAL DETALLE DE ORDEN DE COMPRA
         ──────────────────────────────────────────────────────────────────── */}
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
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" strokeWidth={2} />
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
