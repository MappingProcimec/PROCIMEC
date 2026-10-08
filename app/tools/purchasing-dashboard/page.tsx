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
  ChevronRight,
  Eye,
  PenTool,
  ShieldCheck,
  Check,
  X,
  Layers,
  ArrowRight,
  Plus,
  RotateCw,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Calculator,
  Sparkles,
  RefreshCw,
  Save,
  Mail,
} from 'lucide-react';
import {
  downloadPurchaseRequestPdf,
  PurchaseRequestPdfItem,
  PurchaseRequestPdfSignatures,
} from '@/lib/purchasing/purchaseRequestPdfGenerator';
import { createPurchaseOrderPdf } from '@/lib/purchasing/purchaseOrderPdfGenerator';

export interface ItemQuotationOption {
  option_no: number;
  source?: 'solicitud' | 'presupuesto' | 'mercado' | string;
  supplier: string;
  brand?: string;
  unit_price: number | '';
  total?: number;
  delivery_date?: string;
  delivery_days?: number | string;
  notes?: string;
  is_selected?: boolean;
}

export interface ItemPriceAudit {
  updated_at: string;
  updated_at_formatted: string;
  updated_by_id?: string;
  updated_by_name?: string;
  updated_by_email?: string;
  previous_unit_price?: number;
  new_unit_price: number;
  original_unit_price?: number;
  variation_pct?: number;
  change_reason?: string;
}

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
  original_unit_price?: number;
  original_total?: number;
  selected_quotation_index?: number;
  quotations?: ItemQuotationOption[];
  price_audit?: ItemPriceAudit;
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

export interface OrderTrackingEvent {
  status: string;
  timestamp: string;
  formatted_date?: string;
  user_name: string;
  note: string;
}

export interface PurchaseOrderItemDetail {
  item_no?: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  delivery_date?: string;
  notes?: string;
}

export interface SupplierItem {
  id: string;
  company_name: string;
  nit: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  category?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
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
  supplier_id?: string | null;
  total_amount: number;
  currency: string;
  delivery_deadline: string | null;
  delivery_site?: string | null;
  payment_terms: string | null;
  attachment_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  items_detail?: PurchaseOrderItemDetail[];
  tracking_history?: OrderTrackingEvent[];
  projects?: { id: string; name: string; cost_center?: string; client?: string } | null;
  users?: { id: string; full_name: string; email: string } | null;
}

export interface GroupedRequestOrders {
  requestId: string;
  requestCode: string;
  createdAt?: string;
  projectName: string;
  costCenter: string;
  clientName?: string;
  applicantName: string;
  totalAmount: number;
  ordersCount: number;
  deliveredCount: number;
  inTransitCount: number;
  confirmedCount: number;
  orders: PurchaseOrder[];
  request?: PurchaseRequest | null;
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

export interface BudgetAPUItem {
  id: string;
  category?: string;
  description: string;
  brand?: string;
  suggested_supplier?: string;
  unit: string;
  quantity: number;
  unit_cost: number;
}

export interface ProjectBudgetData {
  budget_id: string;
  budget_code: string;
  project_title: string;
  items: BudgetAPUItem[];
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
  suppliers?: SupplierItem[];
  projects?: ProjectOption[];
  projectBudgets?: Record<string, ProjectBudgetData>;
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
  confirmed: { label: 'Confirmada Proveedor', badge: 'bg-indigo-100/80 text-indigo-900 border border-indigo-300' },
  in_transit: { label: 'En Despacho / Tránsito', badge: 'bg-amber-100/80 text-amber-900 border border-amber-300' },
  partially_received: { label: 'Recibida Parcial', badge: 'bg-orange-100/80 text-orange-900 border border-orange-300' },
  completed: { label: 'Completada / Entregada', badge: 'bg-emerald-100/80 text-emerald-900 border border-emerald-300' },
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

  // Estados de control para secciones colapsables y modo de análisis en modal de requerimiento
  const [expandProjectDetails, setExpandProjectDetails] = useState(true);
  const [expandJustification, setExpandJustification] = useState(true);
  const [expandSignaturesFlow, setExpandSignaturesFlow] = useState(true);
  const [itemsViewMode, setItemsViewMode] = useState<'standard' | 'analysis' | 'quotation'>('standard');
  const [quotationDraftItems, setQuotationDraftItems] = useState<PurchaseRequestItemData[]>([]);
  const [quotationChangeReason, setQuotationChangeReason] = useState<string>('');
  const [isSavingQuotations, setIsSavingQuotations] = useState<boolean>(false);
  const [quotationSuccessMsg, setQuotationSuccessMsg] = useState<string | null>(null);

  // Estados para proveedores y emisión de órdenes de compra
  const [suppliersList, setSuppliersList] = useState<SupplierItem[]>([]);
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierNit, setQuickSupplierNit] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierContact, setQuickSupplierContact] = useState('');
  const [quickSupplierCategory, setQuickSupplierCategory] = useState('Materiales Pétreos y Áridos');
  const [quickSupplierPayment, setQuickSupplierPayment] = useState('Contado');
  const [isSavingQuickSupplier, setIsSavingQuickSupplier] = useState(false);

  // Estados para Emisión de Órdenes de Compra en Pestaña 6
  const [orderIssuingRequest, setOrderIssuingRequest] = useState<PurchaseRequest | null>(null);
  const [selectedRequestGroupId, setSelectedRequestGroupId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [orderForms, setOrderForms] = useState<
    Record<
      string,
      {
        order_code: string;
        payment_terms: string;
        delivery_deadline: string;
        delivery_site: string;
        notes: string;
        send_email_to_supplier?: boolean;
        supplier_email?: string;
        isSubmitting?: boolean;
        successMsg?: string | null;
      }
    >
  >({});

  // Estados para actualización de seguimiento de orden (Tracking)
  const [trackingStatusForm, setTrackingStatusForm] = useState<Record<string, { status: string; note: string; isSubmitting?: boolean }>>({});
  const [expandedTrackingOrderIds, setExpandedTrackingOrderIds] = useState<Record<string, boolean>>({});

  // Estados para evaluación de proveedores ISO 9001 (Pestaña 7)
  const [evaluatingOrder, setEvaluatingOrder] = useState<PurchaseOrder | null>(null);
  const [evalQuality, setEvalQuality] = useState(5);
  const [evalDelivery, setEvalDelivery] = useState(5);
  const [evalService, setEvalService] = useState(5);
  const [evalRecommend, setEvalRecommend] = useState(true);
  const [evalComments, setEvalComments] = useState('');
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);
  const [evalSuccessMsg, setEvalSuccessMsg] = useState<string | null>(null);

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

  // Presupuesto APU asociado al proyecto de la solicitud seleccionada
  const selectedProjectBudget = useMemo(() => {
    if (!selectedRequest || !dashboard?.projectBudgets) return null;
    const reqProjectId = selectedRequest.project_id || selectedRequest.projects?.id;
    if (reqProjectId && dashboard.projectBudgets[reqProjectId]) {
      return dashboard.projectBudgets[reqProjectId];
    }
    const reqProjectName = (selectedRequest.projects?.name || selectedRequest.cost_center || '').toLowerCase().trim();
    if (reqProjectName) {
      const match = Object.values(dashboard.projectBudgets).find(
        (b) => b.project_title?.toLowerCase().trim() === reqProjectName
      );
      if (match) return match;
    }
    if (selectedRequest.title) {
      const reqTitleLower = selectedRequest.title.toLowerCase();
      const match = Object.values(dashboard.projectBudgets).find(
        (b) => b.project_title && (reqTitleLower.includes(b.project_title.toLowerCase()) || b.project_title.toLowerCase().includes(reqTitleLower))
      );
      if (match) return match;
    }
    return null;
  }, [selectedRequest, dashboard?.projectBudgets]);

  // Análisis individual de ítem contra el presupuesto APU
  const getItemBudgetAnalysis = (it: PurchaseRequestItemData) => {
    const rubroRaw = (it.budget_rubro || it.client_quote_no || '').trim();
    const isExplicitlyUnbudgeted =
      rubroRaw.toLowerCase() === 'no presupuestado' ||
      rubroRaw.toLowerCase() === 'ítem adicional' ||
      rubroRaw.toLowerCase() === 'item adicional' ||
      rubroRaw.toLowerCase() === '__custom__';

    const reqQty = Number(it.quantity) || 1;
    const reqPrice = Number(it.unit_price) || 0;
    const reqTotal = it.total !== undefined ? Number(it.total) : reqQty * reqPrice;

    if (!selectedProjectBudget) {
      return {
        hasBudget: false,
        isUnbudgeted: true,
        rubroName: rubroRaw || null,
        budgetItem: null,
        budgetCode: null,
        reqQty,
        reqPrice,
        reqTotal,
        budgetQty: 0,
        budgetPrice: 0,
        budgetTotal: 0,
        unitDiff: 0,
        unitPct: 0,
        totalDiff: 0,
        status: 'no_budget_linked' as const,
        label: rubroRaw ? `Rubro Solicitado: ${rubroRaw} (Sin APU vinculado)` : 'Sin Presupuesto APU Vinculado',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      };
    }

    if (isExplicitlyUnbudgeted) {
      return {
        hasBudget: true,
        isUnbudgeted: true,
        rubroName: 'No presupuestado (Adicional)',
        budgetItem: null,
        budgetCode: selectedProjectBudget.budget_code,
        reqQty,
        reqPrice,
        reqTotal,
        budgetQty: 0,
        budgetPrice: 0,
        budgetTotal: 0,
        unitDiff: 0,
        unitPct: 0,
        totalDiff: 0,
        status: 'unbudgeted' as const,
        label: 'Ítem Adicional / No Presupuestado',
        badgeClass: 'bg-amber-100/90 text-amber-900 border-amber-300',
      };
    }

    // Buscar coincidencia en el APU
    const budgetItem = selectedProjectBudget.items.find((b) => {
      if (it.budget_item_id && b.id === it.budget_item_id) return true;
      if (rubroRaw && b.description.toLowerCase().trim() === rubroRaw.toLowerCase()) return true;
      if (it.description && b.description.toLowerCase().trim() === it.description.toLowerCase().trim()) return true;
      if (
        it.description &&
        b.description &&
        (it.description.toLowerCase().trim().includes(b.description.toLowerCase().trim()) ||
          b.description.toLowerCase().trim().includes(it.description.toLowerCase().trim()))
      ) {
        return true;
      }
      return false;
    });

    if (!budgetItem) {
      return {
        hasBudget: true,
        isUnbudgeted: true,
        rubroName: rubroRaw || null,
        budgetItem: null,
        budgetCode: selectedProjectBudget.budget_code,
        reqQty,
        reqPrice,
        reqTotal,
        budgetQty: 0,
        budgetPrice: 0,
        budgetTotal: 0,
        unitDiff: 0,
        unitPct: 0,
        totalDiff: 0,
        status: 'unbudgeted' as const,
        label: rubroRaw ? `Rubro Solicitado: ${rubroRaw}` : 'Ítem No Presupuestado / Adicional',
        badgeClass: 'bg-amber-100/90 text-amber-900 border-amber-300',
      };
    }

    const budgetQty = Number(budgetItem.quantity) || 0;
    const budgetPrice = Number(budgetItem.unit_cost) || 0;
    const budgetTotal = budgetQty * budgetPrice;

    const unitDiff = reqPrice - budgetPrice;
    const unitPct = budgetPrice > 0 ? (unitDiff / budgetPrice) * 100 : 0;
    const totalDiff = reqTotal - reqQty * budgetPrice;

    let status: 'within_budget' | 'exceeds_budget' | 'exact_budget' | 'zero_cost' = 'within_budget';
    let label = 'Dentro del Presupuesto APU';
    let badgeClass = 'bg-emerald-100/90 text-emerald-900 border-emerald-300';

    if (budgetPrice === 0 && reqPrice === 0) {
      status = 'zero_cost';
      label = 'Rubro APU Vinculado ($0 parametrizado)';
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
    } else if (unitDiff > 0) {
      status = 'exceeds_budget';
      label = `Excede Presupuesto por +${unitPct.toFixed(1)}%`;
      badgeClass =
        unitPct > 20
          ? 'bg-rose-100 text-rose-900 border-rose-300'
          : 'bg-amber-100 text-amber-900 border-amber-300';
    } else if (unitDiff === 0) {
      status = 'exact_budget';
      label = 'Tarifa Exacta APU (0% desviación)';
      badgeClass = 'bg-blue-100 text-blue-900 border-blue-300';
    } else {
      status = 'within_budget';
      label = `Ahorro de ${Math.abs(unitPct).toFixed(1)}% vs APU`;
      badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    }

    return {
      hasBudget: true,
      isUnbudgeted: false,
      rubroName: budgetItem.description,
      budgetItem,
      budgetCode: selectedProjectBudget.budget_code,
      reqQty,
      reqPrice,
      reqTotal,
      budgetQty,
      budgetPrice,
      budgetTotal,
      unitDiff,
      unitPct,
      totalDiff,
      status,
      label,
      badgeClass,
    };
  };

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

  // Bandeja 3: Solicitudes en etapa de VB Técnico (Directores de Proyecto)
  const approvalsRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const matchSearch =
        search === '' ||
        (r.request_code || '').toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.applicant_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.justification || '').toLowerCase().includes(search.toLowerCase());
      const matchProject =
        filterProject === 'all' ||
        r.project_id === filterProject ||
        r.projects?.id === filterProject;

      return matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  const pendingApprovalsCount = useMemo(() => {
    if (!dashboard?.requests) return 0;
    return dashboard.requests.filter((r) => !r.signatures?.director && r.status === 'pending').length;
  }, [dashboard?.requests]);

  // Bandeja 4: En Cotización (Área de Compras) - incluye todas las que han alcanzado fase de cotización
  const inQuotationRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const hasReachedQuote =
        Boolean(r.signatures?.director) ||
        r.status === 'in_quotation' ||
        r.status === 'quoted' ||
        Boolean(r.signatures?.purchasing) ||
        r.status === 'approved';

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

      return hasReachedQuote && matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  // Bandeja 5: Aprobación GG (Gerencia General) - incluye todas las que han alcanzado fase de gerencia
  const managementRequests = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const hasReachedGG =
        Boolean(r.signatures?.purchasing) ||
        r.status === 'quoted' ||
        r.status === 'approved' ||
        Boolean(r.signatures?.management);

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

      return hasReachedGG && matchSearch && matchProject;
    });
  }, [dashboard?.requests, search, filterProject]);

  // Helper para calcular cuántos ítems de una solicitud ya tienen Orden de Compra generada
  const getManagedItemsCount = (req: PurchaseRequest) => {
    const totalItems = req.items?.length || 0;
    const reqOrders = (dashboard?.orders || []).filter((o) => o.purchase_request_id === req.id);
    if (reqOrders.length === 0) return { count: 0, total: totalItems, isFullyManaged: false };

    let count = 0;
    const orderedItemKeys = new Set<string>();
    reqOrders.forEach((o) => {
      const oItems = Array.isArray(o.items_detail) ? o.items_detail : [];
      oItems.forEach((it: any) => {
        const key = `${it.item_no || ''}_${String(it.description || '').trim().toLowerCase()}`;
        orderedItemKeys.add(key);
      });
    });

    if (orderedItemKeys.size > 0 && totalItems > 0) {
      count = (req.items || []).filter((it, idx) => {
        const key = `${it.item_no || idx + 1}_${String(it.description || '').trim().toLowerCase()}`;
        return orderedItemKeys.has(key) || orderedItemKeys.has(`${it.item_no || ''}_${String(it.description || '').trim().toLowerCase()}`);
      }).length;
    } else {
      count = reqOrders.reduce((sum, o) => sum + (Array.isArray(o.items_detail) ? o.items_detail.length : 1), 0);
    }

    const finalCount = Math.min(count, totalItems || count);
    const isFullyManaged = totalItems > 0 ? (finalCount >= totalItems) : (reqOrders.length > 0);
    return { count: finalCount, total: totalItems, isFullyManaged };
  };

  // Solicitudes Aprobadas por Gerencia que aún tienen ítems pendientes de emitirles Orden de Compra
  const approvedWaitingOrders = useMemo(() => {
    if (!dashboard?.requests) return [];
    return dashboard.requests.filter((r) => {
      const isApproved = Boolean(r.signatures?.management) || r.status === 'approved';
      const { isFullyManaged } = getManagedItemsCount(r);
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

      return isApproved && !isFullyManaged && matchSearch && matchProject;
    });
  }, [dashboard?.requests, dashboard?.orders, search, filterProject]);

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

  // Agrupación de órdenes de compra formalizadas por requerimiento con conteo de emitidas vs entregadas
  const groupedOrdersByRequest = useMemo<GroupedRequestOrders[]>(() => {
    if (!dashboard?.orders || dashboard.orders.length === 0) return [];

    const requestsMap = new Map<string, PurchaseRequest>();
    (dashboard.requests || []).forEach((r) => {
      requestsMap.set(r.id, r);
    });

    const groupsMap = new Map<string, PurchaseOrder[]>();
    dashboard.orders.forEach((o) => {
      const key = o.purchase_request_id || `unlinked_${o.project_id || 'general'}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(o);
    });

    const list: GroupedRequestOrders[] = [];

    groupsMap.forEach((orders, reqKey) => {
      const req = requestsMap.get(reqKey) || null;
      const firstOrder = orders[0];

      const requestCode = req?.request_code || (reqKey.startsWith('unlinked_') ? 'SIN-REQ' : reqKey);
      const createdAt = req?.created_at || firstOrder?.created_at || '';
      const projectName = req?.projects?.name || firstOrder?.projects?.name || 'Administración / General';
      const costCenter = req?.cost_center || req?.projects?.cost_center || firstOrder?.projects?.cost_center || 'General';
      const clientName = req?.projects?.client || firstOrder?.projects?.client || '';
      const applicantName = req?.applicant_name || firstOrder?.users?.full_name || 'Personal Operativo';

      const totalAmount = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const ordersCount = orders.length;
      const deliveredCount = orders.filter((o) => o.status === 'completed').length;
      const inTransitCount = orders.filter((o) => o.status === 'in_transit').length;
      const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;

      // Filtrado por search
      const query = search.trim().toLowerCase();
      const matchSearch =
        query === '' ||
        requestCode.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query) ||
        applicantName.toLowerCase().includes(query) ||
        costCenter.toLowerCase().includes(query) ||
        orders.some(
          (o) =>
            o.order_code.toLowerCase().includes(query) ||
            o.supplier_name.toLowerCase().includes(query) ||
            (o.supplier_nit || '').toLowerCase().includes(query)
        );

      // Filtrado por proyecto
      const matchProject =
        filterProject === 'all' ||
        req?.project_id === filterProject ||
        req?.projects?.id === filterProject ||
        orders.some((o) => o.project_id === filterProject || o.projects?.id === filterProject);

      // Filtrado por estado
      const matchStatus =
        filterStatus === 'all' ||
        orders.some((o) => o.status === filterStatus) ||
        (filterStatus === 'completed' && deliveredCount === ordersCount);

      if (matchSearch && matchProject && matchStatus) {
        list.push({
          requestId: reqKey,
          requestCode,
          createdAt,
          projectName,
          costCenter,
          clientName,
          applicantName,
          totalAmount,
          ordersCount,
          deliveredCount,
          inTransitCount,
          confirmedCount,
          orders,
          request: req,
        });
      }
    });

    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [dashboard?.orders, dashboard?.requests, search, filterProject, filterStatus]);

  const activeGroupOrders = useMemo(() => {
    if (!selectedRequestGroupId) return null;
    return groupedOrdersByRequest.find((g) => g.requestId === selectedRequestGroupId) || null;
  }, [selectedRequestGroupId, groupedOrdersByRequest]);

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

  // Órdenes de compra completadas / entregadas que aún no tienen evaluación de proveedor registrada (ISO 9001)
  const pendingEvaluationOrders = useMemo(() => {
    if (!dashboard?.orders) return [];
    const evaluatedOrderIds = new Set(
      (dashboard.evaluations || [])
        .map((ev) => ev.purchase_order_id)
        .filter(Boolean)
    );
    return dashboard.orders.filter((o) => {
      const isCompleted = o.status === 'completed';
      const notEvaluated = !evaluatedOrderIds.has(o.id);
      const matchSearch =
        search === '' ||
        o.order_code.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.supplier_nit || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.projects?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchProject =
        filterProject === 'all' ||
        o.project_id === filterProject ||
        o.projects?.id === filterProject;

      return isCompleted && notEvaluated && matchSearch && matchProject;
    });
  }, [dashboard?.orders, dashboard?.evaluations, search, filterProject]);

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

    // Si viene de la pestaña 4 (En Cotización), contraer todo excepto Bienes e Insumos y activar Modo Cotización
    // Si viene de la pestaña 3 (VB Técnico), contraer metadatos y enfocar en Análisis Presupuestal APU
    // Para otras pestañas (1. Cadena de Trazabilidad, 2. Requerimientos, etc.), mostrar tal cual está
    const isApprovalsTab = activeTab === 'approvals';
    const isQuotationsTab = activeTab === 'quotations';

    if (isQuotationsTab) {
      setExpandProjectDetails(false);
      setExpandJustification(false);
      setExpandSignaturesFlow(false);
      setItemsViewMode('quotation');
    } else if (isApprovalsTab) {
      setExpandProjectDetails(false);
      setExpandJustification(false);
      setExpandSignaturesFlow(false);
      setItemsViewMode('analysis');
    } else {
      setExpandProjectDetails(true);
      setExpandJustification(true);
      setExpandSignaturesFlow(true);
      setItemsViewMode('standard');
    }

    // Inicializar borrador de cotizaciones con las 3 opciones por ítem
    const pId = r.project_id || '';
    const pBudget = pId && dashboard?.projectBudgets ? dashboard.projectBudgets[pId] : undefined;
    const defaultDeliveryDate =
      r.delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(r.delivery_date)
        ? r.delivery_date
        : r.required_date && /^\d{4}-\d{2}-\d{2}$/.test(r.required_date)
        ? r.required_date
        : new Date().toISOString().split('T')[0];

    const initialDraftItems: PurchaseRequestItemData[] = (r.items || []).map((it) => {
      if (it.quotations && it.quotations.length > 0) {
        const sanitizedOpts = it.quotations.map((q) => {
          let dDate = q.delivery_date;
          if (!dDate || !/^\d{4}-\d{2}-\d{2}$/.test(dDate)) {
            if (q.delivery_days && /^\d{4}-\d{2}-\d{2}$/.test(String(q.delivery_days))) {
              dDate = String(q.delivery_days);
            } else {
              dDate = defaultDeliveryDate;
            }
          }
          return {
            ...q,
            delivery_date: dDate,
            delivery_days: dDate,
          };
        });
        return { ...it, quotations: sanitizedOpts };
      }

      const budgetItem = pBudget?.items?.find(
        (b: BudgetAPUItem) =>
          (it.budget_item_id && b.id === it.budget_item_id) ||
          (Boolean(b.description) &&
            Boolean(String(it.description || '').trim()) &&
            b.description.toLowerCase().trim() === String(it.description || '').toLowerCase().trim())
      );

      const qty = Number(it.quantity) || 1;
      const opt1Price = Number(it.unit_price) || 0;
      const opt2Price = budgetItem?.unit_cost !== undefined ? budgetItem.unit_cost : opt1Price;

      const opts: ItemQuotationOption[] = [
        {
          option_no: 1,
          source: 'solicitud',
          supplier: it.suggested_supplier || 'Proveedor de Solicitud',
          brand: it.brand || 'Marca Solicitada',
          unit_price: opt1Price,
          total: qty * opt1Price,
          delivery_date: defaultDeliveryDate,
          delivery_days: defaultDeliveryDate,
          notes: 'Sugerido en solicitud de campo',
          is_selected: true,
        },
        {
          option_no: 2,
          source: budgetItem ? 'presupuesto' : 'mercado',
          supplier: budgetItem?.suggested_supplier || (budgetItem ? 'Tarifa Base APU' : ''),
          brand: budgetItem?.brand || (budgetItem ? 'Estándar APU' : ''),
          unit_price: opt2Price,
          total: qty * opt2Price,
          delivery_date: defaultDeliveryDate,
          delivery_days: defaultDeliveryDate,
          notes: budgetItem ? `Tarifa contractual APU (${budgetItem.description})` : 'Proveedor alternativo B',
          is_selected: false,
        },
        {
          option_no: 3,
          source: 'mercado',
          supplier: '',
          brand: '',
          unit_price: '',
          total: 0,
          delivery_date: defaultDeliveryDate,
          delivery_days: defaultDeliveryDate,
          notes: '',
          is_selected: false,
        },
      ];

      return {
        ...it,
        original_unit_price: it.original_unit_price !== undefined ? it.original_unit_price : opt1Price,
        selected_quotation_index: 0,
        quotations: opts,
      };
    });
    setQuotationDraftItems(initialDraftItems);

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

  // Manejo de edición de cotizaciones y selección de opción adjudicada
  const handleUpdateOptionField = (
    itemIdx: number,
    optIdx: number,
    field: keyof ItemQuotationOption,
    value: unknown
  ) => {
    setQuotationDraftItems((prev) => {
      const next = [...prev];
      const curIt = { ...next[itemIdx] };
      const curOpts = [...(curIt.quotations || [])];
      curOpts[optIdx] = {
        ...(curOpts[optIdx] || { option_no: optIdx + 1, supplier: '', unit_price: 0, total: 0 }),
        [field]: value,
      };

      const uPrice = Number(curOpts[optIdx].unit_price) || 0;
      curOpts[optIdx].total = (Number(curIt.quantity) || 1) * uPrice;
      curIt.quotations = curOpts;

      if (curIt.selected_quotation_index === optIdx) {
        curIt.unit_price = uPrice;
        curIt.total = (Number(curIt.quantity) || 1) * uPrice;
        if (field === 'supplier') curIt.suggested_supplier = String(value);
        if (field === 'brand') curIt.brand = String(value);
      }

      next[itemIdx] = curIt;
      return next;
    });
  };

  const handleSelectWinningOption = (itemIdx: number, optIdx: number) => {
    setQuotationDraftItems((prev) => {
      const next = [...prev];
      const curIt = { ...next[itemIdx] };
      const curOpts = (curIt.quotations || []).map((opt, idx) => ({
        ...opt,
        is_selected: idx === optIdx,
      }));

      const winningOpt = curOpts[optIdx];
      const winPrice = Number(winningOpt?.unit_price) || 0;

      curIt.selected_quotation_index = optIdx;
      curIt.quotations = curOpts;
      curIt.unit_price = winPrice;
      curIt.total = (Number(curIt.quantity) || 1) * winPrice;
      if (winningOpt?.supplier) curIt.suggested_supplier = winningOpt.supplier;
      if (winningOpt?.brand) curIt.brand = winningOpt.brand;

      next[itemIdx] = curIt;
      return next;
    });
  };

  const handleApplyApuPriceToOption = (
    itemIdx: number,
    optIdx: number,
    budgetItem: BudgetAPUItem
  ) => {
    setQuotationDraftItems((prev) => {
      const next = [...prev];
      const curIt = { ...next[itemIdx] };
      const curOpts = [...(curIt.quotations || [])];

      curOpts[optIdx] = {
        ...(curOpts[optIdx] || { option_no: optIdx + 1 }),
        source: 'presupuesto',
        supplier: budgetItem.suggested_supplier || curOpts[optIdx]?.supplier || 'Tarifa Base APU',
        brand: budgetItem.brand || curOpts[optIdx]?.brand || 'Estándar APU',
        unit_price: budgetItem.unit_cost,
        total: (Number(curIt.quantity) || 1) * budgetItem.unit_cost,
        notes: `Tarifa APU confirmada: ${budgetItem.description}`,
      };

      curIt.quotations = curOpts;
      if (curIt.selected_quotation_index === optIdx) {
        curIt.unit_price = budgetItem.unit_cost;
        curIt.total = (Number(curIt.quantity) || 1) * budgetItem.unit_cost;
        if (budgetItem.suggested_supplier) curIt.suggested_supplier = budgetItem.suggested_supplier;
        if (budgetItem.brand) curIt.brand = budgetItem.brand;
      }

      next[itemIdx] = curIt;
      return next;
    });
  };

  const handleSaveQuotationsToDb = async () => {
    if (!selectedRequest) return;
    try {
      setIsSavingQuotations(true);
      setQuotationSuccessMsg(null);

      const res = await fetch('/api/tools/purchasing-dashboard/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          items: quotationDraftItems,
          change_reason: quotationChangeReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al persistir cotizaciones en la base de datos');
      }

      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              items: json.items,
              total_amount: json.total_amount,
            }
          : prev
      );

      setQuotationSuccessMsg(`Cotizaciones y precios actualizados exitosamente en la base de datos (${json.updated_at_formatted}).`);
      queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar cotizaciones');
    } finally {
      setIsSavingQuotations(false);
    }
  };

  // Sincronización de proveedores de catálogo
  useEffect(() => {
    if (dashboard?.suppliers && dashboard.suppliers.length > 0) {
      setSuppliersList(dashboard.suppliers);
    }
  }, [dashboard?.suppliers]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        if (res.ok) {
          const json = await res.json();
          if (json.suppliers && json.suppliers.length > 0) {
            setSuppliersList(json.suppliers);
          }
        }
      } catch (e) {
        console.error('Error cargando catálogo de proveedores:', e);
      }
    };
    if (suppliersList.length === 0) {
      fetchSuppliers();
    }
  }, [suppliersList.length]);

  // Descargar PDF Oficial de la Orden de Compra (FOR-COM-002)
  const handleDownloadOrderPdf = (o: PurchaseOrder) => {
    try {
      setDownloadingOrderId(o.id);
      const items = (Array.isArray(o.items_detail) && o.items_detail.length > 0)
        ? o.items_detail
        : [{ description: 'Bienes e Insumos según Requerimiento', quantity: 1, unit: 'Glb', unit_price: Number(o.total_amount) || 0, total: Number(o.total_amount) || 0 }];

      const supInfo = suppliersList.find(
        (s) => s.company_name.toLowerCase().trim() === o.supplier_name.toLowerCase().trim()
      );

      const reqInfo = dashboard?.requests?.find((r) => r.id === o.purchase_request_id);

      const doc = createPurchaseOrderPdf({
        orderCode: o.order_code,
        requestCode: reqInfo?.request_code || undefined,
        code: 'FOR-COM-002',
        version: '01',
        effectiveDate: '08/10/2026',
        createdDate: o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO') : undefined,
        supplierName: o.supplier_name,
        supplierNit: o.supplier_nit || supInfo?.nit || undefined,
        supplierContact: o.supplier_contact || supInfo?.contact_name || undefined,
        supplierEmail: supInfo?.email || undefined,
        supplierPhone: supInfo?.phone || undefined,
        supplierCity: supInfo?.city || undefined,
        supplierAddress: supInfo?.address || undefined,
        projectName: o.projects?.name || reqInfo?.projects?.name || undefined,
        costCenter: o.projects?.cost_center || reqInfo?.cost_center || reqInfo?.projects?.cost_center || undefined,
        clientName: o.projects?.client || reqInfo?.projects?.client || undefined,
        deliveryDeadline: o.delivery_deadline ? new Date(o.delivery_deadline).toLocaleDateString('es-CO') : undefined,
        deliverySite: o.delivery_site || reqInfo?.delivery_site || undefined,
        paymentTerms: o.payment_terms || undefined,
        items: items.map((it: any, idx: number) => ({
          item_no: it.item_no || idx + 1,
          description: it.description || '',
          quantity: it.quantity || 1,
          unit: it.unit || 'Und',
          unit_price: Number(it.unit_price) || 0,
          total: Number(it.total) || 0,
          delivery_date: it.delivery_date || undefined,
        })),
        totalAmount: Number(o.total_amount) || 0,
        notes: o.notes || undefined,
      });

      const safeFilename = `${o.order_code}_${o.supplier_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(safeFilename);
    } catch (err) {
      console.error('Error generando PDF de orden de compra:', err);
      alert('No se pudo generar el PDF de la orden de compra.');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  // Apertura de ventana flotante especializada para Emisión de Órdenes de Compra (Pestaña 6)
  const handleOpenOrderIssuing = (r: PurchaseRequest) => {
    setOrderIssuingRequest(r);

    const groups: Record<
      string,
      {
        order_code: string;
        payment_terms: string;
        delivery_deadline: string;
        delivery_site: string;
        notes: string;
        send_email_to_supplier?: boolean;
        supplier_email?: string;
      }
    > = {};

    const currentYear = new Date().getFullYear();
    const existingOrdersCount = (dashboard?.orders || []).length;
    let nextNum = existingOrdersCount + 1;

    (r.items || []).forEach((it) => {
      const selectedOpt = it.quotations?.find((q) => q.is_selected) || it.quotations?.[0];
      const supName = selectedOpt?.supplier?.trim() || it.suggested_supplier?.trim() || 'Proveedor General';

      if (!groups[supName]) {
        const supInfo = suppliersList.find(
          (s) => s.company_name.toLowerCase().trim() === supName.toLowerCase().trim()
        );
        const code = `OC-${currentYear}-${String(nextNum).padStart(3, '0')}`;
        nextNum++;

        const supEmail = supInfo?.email || '';

        groups[supName] = {
          order_code: code,
          payment_terms: supInfo?.payment_terms || 'Contado',
          delivery_deadline: selectedOpt?.delivery_date || r.delivery_date || r.required_date || '',
          delivery_site: r.delivery_site || '',
          notes: selectedOpt?.notes || '',
          send_email_to_supplier: Boolean(supEmail),
          supplier_email: supEmail,
        };
      }
    });

    setOrderForms(groups);
  };

  // Emisión formal de orden de compra para un proveedor específico
  const handleIssueOrderForSupplier = async (
    req: PurchaseRequest,
    supplierName: string,
    itemsToInclude: PurchaseRequestItemData[],
    totalAmount: number
  ) => {
    const formVals = orderForms[supplierName] || {
      order_code: `OC-${new Date().getFullYear()}-001`,
      payment_terms: 'Contado',
      delivery_deadline: req.delivery_date || '',
      delivery_site: req.delivery_site || '',
      notes: '',
      send_email_to_supplier: false,
      supplier_email: '',
    };

    const supInfo = suppliersList.find(
      (s) => s.company_name.toLowerCase().trim() === supplierName.toLowerCase().trim()
    );

    setOrderForms((prev) => ({
      ...prev,
      [supplierName]: {
        ...(prev[supplierName] || formVals),
        isSubmitting: true,
      },
    }));

    try {
      const itemsPayload = itemsToInclude.map((it, idx) => {
        const selOpt = it.quotations?.find((q) => q.is_selected) || it.quotations?.[0];
        const unitPrice =
          typeof selOpt?.unit_price === 'number'
            ? selOpt.unit_price
            : Number(selOpt?.unit_price) || Number(it.unit_price) || 0;
        const qty = Number(it.quantity) || 1;
        return {
          item_no: it.item_no || idx + 1,
          description: it.description || '',
          quantity: qty,
          unit: it.unit || 'Und',
          unit_price: unitPrice,
          total: qty * unitPrice,
          delivery_date: selOpt?.delivery_date || req.delivery_date || '',
          notes: selOpt?.notes || '',
        };
      });

      const res = await fetch('/api/tools/purchasing-dashboard/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: req.id,
          supplier_name: supplierName,
          supplier_nit: supInfo?.nit || null,
          supplier_contact: supInfo?.contact_name || supInfo?.phone || null,
          supplier_email: formVals.supplier_email || supInfo?.email || null,
          supplier_id: supInfo?.id || null,
          items: itemsPayload,
          total_amount: totalAmount,
          delivery_deadline: formVals.delivery_deadline || null,
          delivery_site: formVals.delivery_site || null,
          payment_terms: formVals.payment_terms || 'Contado',
          notes: formVals.notes || null,
          order_code: formVals.order_code,
          send_email_to_supplier: formVals.send_email_to_supplier,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo emitir la orden de compra.');
      }

      setOrderForms((prev) => ({
        ...prev,
        [supplierName]: {
          ...(prev[supplierName] || formVals),
          isSubmitting: false,
          successMsg: json.email_sent
            ? `¡${json.order?.order_code || 'Orden'} emitida y enviada al correo del proveedor!`
            : `¡${json.order?.order_code || 'Orden'} emitida exitosamente!`,
        },
      }));

      await queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
      await refetch();
    } catch (err: unknown) {
      console.error('Error emitiendo orden:', err);
      const msg = err instanceof Error ? err.message : 'Error al emitir orden';
      alert(`Error: ${msg}`);
      setOrderForms((prev) => ({
        ...prev,
        [supplierName]: {
          ...(prev[supplierName] || formVals),
          isSubmitting: false,
        },
      }));
    }
  };

  // Actualización de estado de entrega de una orden (Tracking)
  const handleUpdateOrderStatus = async (orderId: string) => {
    const form = trackingStatusForm[orderId];
    if (!form || !form.status) return;

    setTrackingStatusForm((prev) => ({
      ...prev,
      [orderId]: { ...form, isSubmitting: true },
    }));

    try {
      const res = await fetch('/api/tools/purchasing-dashboard/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          new_status: form.status,
          note: form.note || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al actualizar estado.');
      }

      setTrackingStatusForm((prev) => ({
        ...prev,
        [orderId]: { status: form.status, note: '', isSubmitting: false },
      }));

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(json.order);
      }

      await queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
      await refetch();
    } catch (err: unknown) {
      console.error('Error actualizando seguimiento:', err);
      const msg = err instanceof Error ? err.message : 'Error';
      alert(`Error: ${msg}`);
      setTrackingStatusForm((prev) => ({
        ...prev,
        [orderId]: { ...form, isSubmitting: false },
      }));
    }
  };

  // Apertura de modal de evaluación de proveedor ISO 9001 (Pestaña 7)
  const handleOpenEvaluationModal = (order: PurchaseOrder) => {
    setEvaluatingOrder(order);
    setEvalQuality(5);
    setEvalDelivery(5);
    setEvalService(5);
    setEvalRecommend(true);
    setEvalComments('');
    setEvalSuccessMsg(null);
  };

  // Enviar evaluación de desempeño del proveedor
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingOrder) return;

    setIsSubmittingEval(true);
    try {
      const res = await fetch('/api/tools/purchasing-dashboard/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_id: evaluatingOrder.id,
          supplier_name: evaluatingOrder.supplier_name,
          quality_score: evalQuality,
          delivery_time_score: evalDelivery,
          service_score: evalService,
          recommend_supplier: evalRecommend,
          comments: evalComments,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar la evaluación');
      }

      setEvalSuccessMsg('Evaluación registrada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['purchasing-dashboard'] });
      await refetch();
      setTimeout(() => {
        setEvaluatingOrder(null);
        setEvalSuccessMsg(null);
      }, 1200);
    } catch (err: unknown) {
      console.error('Error guardando evaluación:', err);
      const msg = err instanceof Error ? err.message : 'Error al registrar evaluación';
      alert(msg);
    } finally {
      setIsSubmittingEval(false);
    }
  };

  // Registro rápido de proveedor desde modal emergente
  const handleSaveQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim() || !quickSupplierNit.trim()) {
      alert('Razón social y NIT son obligatorios.');
      return;
    }

    setIsSavingQuickSupplier(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: quickSupplierName.trim(),
          nit: quickSupplierNit.trim(),
          phone: quickSupplierPhone.trim() || null,
          contact_name: quickSupplierContact.trim() || null,
          category: quickSupplierCategory,
          payment_terms: quickSupplierPayment,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar proveedor.');
      }

      const newSup: SupplierItem = data.supplier;
      setSuppliersList((prev) => {
        const filtered = prev.filter((s) => s.nit !== newSup.nit);
        return [...filtered, newSup].sort((a, b) => a.company_name.localeCompare(b.company_name));
      });

      setShowQuickSupplierModal(false);
      setQuickSupplierName('');
      setQuickSupplierNit('');
      setQuickSupplierPhone('');
      setQuickSupplierContact('');
    } catch (err: unknown) {
      console.error('Error guardando proveedor rápido:', err);
      const msg = err instanceof Error ? err.message : 'Error';
      alert(`Error al registrar proveedor: ${msg}`);
    } finally {
      setIsSavingQuickSupplier(false);
    }
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
      const pId = r.project_id || '';
      const pBudget = pId && dashboard?.projectBudgets ? dashboard.projectBudgets[pId] : undefined;
      const itemsMapped: PurchaseRequestPdfItem[] = (r.items || []).map((it, idx) => {
        let rubro = (it.budget_rubro || it.client_quote_no || '').trim();
        if (!rubro || rubro === '—') {
          const matched = pBudget?.items?.find(
            (b: BudgetAPUItem) =>
              (it.budget_item_id && b.id === it.budget_item_id) ||
              (Boolean(b.description) &&
                Boolean(String(it.description || '').trim()) &&
                b.description.toLowerCase().trim() === String(it.description || '').toLowerCase().trim())
          );
          rubro = matched?.description || 'No presupuestado';
        }

        return {
          item_no: it.item_no || idx + 1,
          quantity: it.quantity || 1,
          unit: it.unit || 'Und',
          description: it.description || it.item || 'Ítem sin descripción',
          budget_rubro: rubro,
          client_quote_no: rubro,
          brand: it.brand || '',
          suggested_supplier: it.suggested_supplier || '',
          unit_price: it.unit_price || 0,
          total: it.total !== undefined ? it.total : (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        };
      });

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
              {pendingApprovalsCount}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">En revisión de directores</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cotización / GG</span>
              <ShoppingBag className="w-4 h-4 text-purple-600" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
              {inQuotationRequests.length + managementRequests.length}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">En compras o gerencia</p>
          </div>

          <div className="card p-4 sm:p-5 bg-white border border-border shadow-card rounded-xl col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Órdenes / Calidad</span>
              <Star className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono truncate">
              {(dashboard?.orders?.length || approvedWaitingOrders.length)} OC / {dashboard?.evaluations?.length ?? 0} Prov.
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

            {/* Acceso a Registro de Proveedores */}
            <Link
              href="/forms/registro-proveedor"
              className="btn bg-white hover:bg-slate-50 border border-border text-xs px-3 py-1.5 rounded-lg text-text-primary shadow-2xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              title="Registrar nuevo proveedor en catálogo institucional (FOR-COM-004)"
            >
              <Building2 className="w-3.5 h-3.5 text-accent stroke-[2.2]" />
              <span>+ Registrar Proveedor</span>
            </Link>
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
              3. VB Técnico ({approvalsRequests.length})
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
              5. Aprobación GG ({managementRequests.length})
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
              6. Órdenes de Compra ({(dashboard?.orders?.length || approvedWaitingOrders.length)})
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
              <span>7. Evaluación Proveedores ({dashboard?.evaluations?.length ?? 0})</span>
              {pendingEvaluationOrders.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300">
                  {pendingEvaluationOrders.length} pendiente{pendingEvaluationOrders.length > 1 ? 's' : ''}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 1: CADENA DE TRAZABILIDAD ARTICULADA (TABLA DE EXPEDIENTES)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando cadena de trazabilidad...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No se encontraron expedientes de compras registrados para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Código REQ</th>
                      <th className="py-3 px-4">Proyecto / Cliente</th>
                      <th className="py-3 px-4">Cadena de Trazabilidad (6 Pasos)</th>
                      <th className="py-3 px-4 text-center">Etapa Actual</th>
                      <th className="py-3 px-4 text-right">Monto Estimado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-amber-700 block">
                              {r.request_code || 'REQ-0001'}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-[200px]">
                            <span className="font-semibold text-text-primary block truncate">
                              {r.projects?.name || r.cost_center || 'Operación'}
                            </span>
                            <span className="text-[11px] text-text-secondary truncate block">
                              {r.client_name || r.projects?.client || 'Cliente Corporativo'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* 1. Requerimiento */}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                                <FileText className="w-3 h-3 text-blue-600" />
                                {r.request_code || 'REQ'}
                              </span>

                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />

                              {/* 2. VB Técnico */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  sigDirector
                                    ? sigDirector.rejected
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                {sigDirector
                                  ? sigDirector.rejected
                                    ? 'VB Rechazado'
                                    : 'VB Aprobado'
                                  : 'Pendiente VB'}
                              </span>

                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />

                              {/* 3. Cotización */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  sigPurchasing
                                    ? sigPurchasing.rejected
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : sigDirector
                                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <ShoppingBag className="w-3 h-3 text-purple-600" />
                                {sigPurchasing
                                  ? sigPurchasing.rejected
                                    ? 'Cotiz. Rechazada'
                                    : 'Cotizado'
                                  : sigDirector
                                  ? 'En Cotización'
                                  : 'En espera'}
                              </span>

                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />

                              {/* 4. Aprobación GG */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  sigManagement || r.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : r.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : sigPurchasing
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {sigManagement || r.status === 'approved'
                                  ? 'Aprobada GG'
                                  : r.status === 'rejected'
                                  ? 'Rechazada GG'
                                  : sigPurchasing
                                  ? 'Pendiente GG'
                                  : 'En espera'}
                              </span>

                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />

                              {/* 5. Orden de Compra */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                  linkedOrder
                                    ? linkedOrder.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                    : r.status === 'approved'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <Package className="w-3 h-3 text-blue-600" />
                                {linkedOrder
                                  ? linkedOrder.order_code
                                  : r.status === 'approved'
                                  ? 'Pendiente OC'
                                  : 'Sin Emitir'}
                              </span>

                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />

                              {/* 6. Evaluación Proveedor */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  linkedEval
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : linkedOrder
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                {linkedEval
                                  ? `${Number(linkedEval.overall_rating).toFixed(1)} ★`
                                  : linkedOrder
                                  ? 'Pendiente'
                                  : 'Sin Eval.'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {r.status === 'rejected' || sigDirector?.rejected || sigPurchasing?.rejected || sigManagement?.rejected ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100/80 text-rose-900 border border-rose-300 inline-block">
                                Rechazado
                              </span>
                            ) : linkedEval ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300 inline-block">
                                Ciclo Completado
                              </span>
                            ) : linkedOrder ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100/80 text-blue-900 border border-blue-300 inline-block">
                                OC en Proceso
                              </span>
                            ) : sigManagement || r.status === 'approved' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300 inline-block">
                                Aprobada (Por Emitir OC)
                              </span>
                            ) : sigPurchasing ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100/80 text-purple-900 border border-purple-300 inline-block">
                                Pendiente Firma GG
                              </span>
                            ) : sigDirector ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100/80 text-blue-900 border border-blue-300 inline-block">
                                En Cotización Compras
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100/80 text-amber-900 border border-amber-300 inline-block">
                                Pendiente VB Técnico
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-xs whitespace-nowrap text-text-primary">
                            {formatCOP(r.total_amount || 0)}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(r)}
                              disabled={downloadingReqId === r.id}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                              title="Descargar PDF Oficial (FOR-COM-001)"
                            >
                              <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(r)}
                              className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                              title="Ver Expediente Completo"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
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
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(r)}
                              disabled={downloadingReqId === r.id}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                              title="Descargar PDF Oficial (FOR-COM-001)"
                            >
                              <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(r)}
                              className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Detalle
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
            PESTAÑA 3: BANDEJA DE VB TÉCNICO (DIRECTORES DE PROYECTO) — TABLA
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'approvals' && canViewApprovals && (
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            {approvalsRequests.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-text-primary">Bandeja al día</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  No hay requerimientos en etapa de visto bueno técnico para tus proyectos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Código REQ</th>
                      <th className="py-3 px-4">Proyecto / Centro Costo</th>
                      <th className="py-3 px-4">Solicitante</th>
                      <th className="py-3 px-4">Justificación</th>
                      <th className="py-3 px-4 text-center">Ítems</th>
                      <th className="py-3 px-4 text-right">Valor Estimado</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {approvalsRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 block w-fit">
                            {r.request_code || 'REQ'}
                          </span>
                          <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <span className="font-semibold text-text-primary block truncate">
                            {r.projects?.name || r.cost_center || 'General'}
                          </span>
                          <span className="text-[11px] text-text-secondary truncate block">
                            {r.client_name || r.projects?.client || 'Cliente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-text-primary">
                          {r.applicant_name || 'Ingeniero de Campo'}
                        </td>
                        <td className="py-3 px-4 max-w-[220px]">
                          <p className="text-text-secondary truncate text-[11px]" title={r.justification}>
                            {r.justification || 'Sin justificación registrada'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {r.items?.length || 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary whitespace-nowrap">
                          {formatCOP(r.total_amount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {r.status === 'rejected' || r.signatures?.director?.rejected ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              Rechazado
                            </span>
                          ) : r.signatures?.director ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              VB Aprobado
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Pendiente VB
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r)}
                            disabled={downloadingReqId === r.id}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF Oficial"
                          >
                            <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(r)}
                            className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                            title="Ver Detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 4: BANDEJA DE COTIZACIÓN (ÁREA DE COMPRAS) — TABLA
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'quotations' && canViewQuotations && (
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            {inQuotationRequests.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-text-primary">Sin cotizaciones registradas</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  No hay requerimientos en etapa de cotización para los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Código REQ</th>
                      <th className="py-3 px-4">Proyecto Destino</th>
                      <th className="py-3 px-4">Insumos y Proveedores Sugeridos</th>
                      <th className="py-3 px-4 text-right">Valor Estimado</th>
                      <th className="py-3 px-4 text-center">Ítems Cotizados</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inQuotationRequests.map((r) => {
                      const totalItems = (r.items || []).length;
                      const quotedCount = (r.items || []).filter(
                        (it) =>
                          (it.quotations && it.quotations.length > 0 && it.selected_quotation_index !== undefined) ||
                          it.price_audit !== undefined
                      ).length;

                      return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 block w-fit">
                            {r.request_code || 'REQ'}
                          </span>
                          <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <span className="font-semibold text-text-primary block truncate">
                            {r.projects?.name || r.cost_center || 'General'}
                          </span>
                          <span className="text-[11px] text-text-secondary truncate block">
                            {r.client_name || r.projects?.client || 'Cliente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[240px]">
                          <p className="text-text-secondary truncate text-[11px]">
                            {(r.items || []).map((it) => `${it.description || it.item} (${it.quantity} ${it.unit})`).join(' · ') || 'Sin ítems'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary whitespace-nowrap">
                          {formatCOP(r.total_amount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {quotedCount === totalItems && totalItems > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> {quotedCount} / {totalItems}
                            </span>
                          ) : quotedCount > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 inline-flex items-center gap-1 font-mono">
                              {quotedCount} / {totalItems} cotizados
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 font-mono">
                              0 / {totalItems} cotizados
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {r.signatures?.purchasing || r.status === 'quoted' || r.status === 'approved' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Cotizada
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              Pendiente Cotización
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r)}
                            disabled={downloadingReqId === r.id}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF Oficial"
                          >
                            <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(r)}
                            className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                            title="Ver Detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Detalle
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
            PESTAÑA 5: BANDEJA DE APROBACIÓN GG (GERENCIA GENERAL) — TABLA
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'management_approval' && canViewManagementApproval && (
          <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
            {managementRequests.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-text-primary">Sin compras en gerencia</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  No hay requerimientos en gestión de Gerencia General para los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Código REQ</th>
                      <th className="py-3 px-4">Proyecto / Cliente</th>
                      <th className="py-3 px-4">Cotizado por Compras</th>
                      <th className="py-3 px-4">Sitio de Entrega</th>
                      <th className="py-3 px-4 text-right">Monto Final Cotizado</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {managementRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200 block w-fit">
                            {r.request_code || 'REQ'}
                          </span>
                          <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <span className="font-semibold text-text-primary block truncate">
                            {r.projects?.name || r.cost_center || 'General'}
                          </span>
                          <span className="text-[11px] text-text-secondary truncate block">
                            {r.client_name || r.projects?.client || 'Cliente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-text-primary block">
                            {r.signatures?.purchasing?.name || 'Compras'}
                          </span>
                          <span className="text-[10px] text-blue-700 font-mono">
                            {r.signatures?.purchasing?.date_time ? `Cotiz: ${r.signatures.purchasing.date_time}` : 'Cotizado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <span className="text-text-secondary truncate text-[11px] block">
                            {r.delivery_site || 'Dirección de obra'}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            Tel: {r.contact_phone || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-emerald-700 whitespace-nowrap">
                          {formatCOP(r.total_amount || 0)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {r.signatures?.management?.rejected || (r.status === 'rejected' && r.signatures?.management) ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              Rechazada por GG
                            </span>
                          ) : r.signatures?.management || r.status === 'approved' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Aprobada por GG
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                              Pendiente Aprobación GG
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r)}
                            disabled={downloadingReqId === r.id}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                            title="Descargar PDF Oficial"
                          >
                            <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(r)}
                            className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                            title="Ver Detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 6: ÓRDENES DE COMPRA (OC)
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && canViewOrders && (
          <div className="space-y-6">
            {/* Sub-tabla: Solicitudes aprobadas por gerencia listas para emitir orden */}
            {approvedWaitingOrders.length > 0 && (
              <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
                <div className="p-4 bg-amber-50/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        Solicitudes Aprobadas por Gerencia — Listas para Emitir Orden de Compra ({approvedWaitingOrders.length})
                      </h3>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Expedientes con visto bueno y aprobación de Gerencia General listos para formalizar su OC institucional.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                      <tr>
                        <th className="py-3 px-4">Código REQ</th>
                        <th className="py-3 px-4">Proyecto / Cliente</th>
                        <th className="py-3 px-4">Solicitante</th>
                        <th className="py-3 px-4 text-right">Monto Aprobado</th>
                        <th className="py-3 px-4 text-center">Ítems Gestionados</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {approvedWaitingOrders.map((r) => {
                        const { count: managedCount, total: totalItemCount } = getManagedItemsCount(r);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 block w-fit">
                                {r.request_code || 'REQ'}
                              </span>
                              <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <span className="font-semibold text-text-primary block truncate">
                                {r.projects?.name || r.cost_center || 'General'}
                              </span>
                              <span className="text-[11px] text-text-secondary truncate block">
                                {r.client_name || r.projects?.client || 'Cliente'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-text-primary">
                              {r.applicant_name || r.users?.full_name || 'Solicitante'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-emerald-700 whitespace-nowrap">
                              {formatCOP(r.total_amount || 0)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="inline-flex flex-col items-center">
                                <span
                                  className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                    managedCount === 0
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : managedCount < totalItemCount
                                      ? 'bg-blue-50 text-blue-900 border-blue-300'
                                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}
                                >
                                  {managedCount} / {totalItemCount} ítems
                                </span>
                                <span className="text-[10px] text-text-muted mt-0.5 font-medium">
                                  {managedCount === 0
                                    ? '0 con OC emitida'
                                    : managedCount < totalItemCount
                                    ? `${totalItemCount - managedCount} pendiente${totalItemCount - managedCount > 1 ? 's' : ''}`
                                    : '100% formalizado'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Aprobada (Por Emitir OC)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(r)}
                                disabled={downloadingReqId === r.id}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors"
                                title="Descargar PDF Oficial"
                              >
                                <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenOrderIssuing(r)}
                                className="px-2.5 py-1 rounded-lg bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs inline-flex items-center gap-1 shadow-xs"
                                title="Gestionar y emitir Órdenes de Compra a proveedores"
                              >
                                <Package className="w-3.5 h-3.5" />
                                Emitir / Ver OC
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla Principal: Órdenes de Compra formalizadas agrupadas por Requerimiento */}
            <div className="card border border-border bg-white rounded-xl shadow-card overflow-hidden">
              <div className="p-4 bg-slate-50/60 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary-900" />
                    Órdenes de Compra Formalizadas (Emitidas)
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Expedientes agrupados por requerimiento con control de órdenes emitidas vs órdenes entregadas.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-text-muted flex items-center gap-3">
                  <span>Requerimientos con OCs: <strong className="text-text-primary font-mono">{groupedOrdersByRequest.length}</strong></span>
                  <span>·</span>
                  <span>Total OCs: <strong className="text-text-primary font-mono">{dashboard?.orders?.length || 0}</strong></span>
                </div>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-text-muted text-sm">Cargando órdenes de compra...</div>
              ) : groupedOrdersByRequest.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">
                  No se encontraron órdenes de compra formalizadas emitidas aún.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                      <tr>
                        <th className="py-3 px-4">Código Req</th>
                        <th className="py-3 px-4">Proyecto / Cliente</th>
                        <th className="py-3 px-4">Solicitante</th>
                        <th className="py-3 px-4">Monto Total OCs</th>
                        <th className="py-3 px-4 text-center">Órdenes (Emitidas vs Entregadas)</th>
                        <th className="py-3 px-4 text-center">Estado Entregas</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupedOrdersByRequest.map((group) => {
                        const isAllDelivered = group.ordersCount > 0 && group.deliveredCount === group.ordersCount;
                        const isPartial = group.deliveredCount > 0 && group.deliveredCount < group.ordersCount;
                        const hasInTransit = group.inTransitCount > 0;

                        return (
                          <tr
                            key={group.requestId}
                            onClick={() => setSelectedRequestGroupId(group.requestId)}
                            className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-primary group-hover:text-accent transition-colors block">
                                {group.requestCode}
                              </span>
                              <span className="font-mono text-[10px] text-text-muted">
                                {group.createdAt ? new Date(group.createdAt).toLocaleDateString('es-CO') : '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs font-semibold text-primary block">
                                {group.projectName}
                              </span>
                              <span className="text-[11px] text-text-muted block truncate max-w-[200px]">
                                {group.clientName || `CC: ${group.costCenter}`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-text-primary whitespace-nowrap">
                              {group.applicantName}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                              {formatCOP(group.totalAmount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex flex-col items-center">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className={`font-mono font-bold ${isAllDelivered ? 'text-emerald-700' : 'text-primary-900'}`}>
                                    {group.ordersCount} emitidas
                                  </span>
                                  <span className="text-text-muted text-[11px]">vs</span>
                                  <span className={`font-mono font-bold ${group.deliveredCount > 0 ? 'text-emerald-700' : 'text-text-muted'}`}>
                                    {group.deliveredCount} entregadas
                                  </span>
                                </div>
                                <div className="w-28 bg-gray-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isAllDelivered
                                        ? 'bg-emerald-500'
                                        : isPartial
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'
                                    }`}
                                    style={{
                                      width: `${group.ordersCount > 0 ? (group.deliveredCount / group.ordersCount) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {isAllDelivered ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  Completado (100% Entregado)
                                </span>
                              ) : isPartial ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  Entrega Parcial ({group.deliveredCount}/{group.ordersCount})
                                </span>
                              ) : hasInTransit ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                                  En Tránsito / Despacho
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                                  Emitida (Pendiente Entrega)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedRequestGroupId(group.requestId)}
                                className="btn bg-white hover:bg-amber-50 border border-border text-xs px-3 py-1.5 rounded-lg text-primary-900 shadow-2xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:border-amber-400 transition-all"
                                title="Ver órdenes de compra formalizadas de este requerimiento"
                              >
                                <Eye className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                                Ver Órdenes ({group.ordersCount})
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
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 7: EVALUACIÓN DE PROVEEDORES (ISO 9001 / SIG) — TABLA
           ──────────────────────────────────────────────────────────────────── */}
        {/* ────────────────────────────────────────────────────────────────────
            PESTAÑA 7: EVALUACIÓN DE PROVEEDORES (ISO 9001 / SIG) — TABLA
           ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'evaluations' && canViewEvaluations && (
          <div className="space-y-6 animate-fade-in">
            {/* 1. Panel de Órdenes Entregadas Pendientes de Evaluación */}
            <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-accent" />
                      Órdenes Entregadas Pendientes por Evaluar ({pendingEvaluationOrders.length})
                    </h3>
                    {pendingEvaluationOrders.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Acción Requerida ISO 9001
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Evaluación de desempeño obligatoria tras la entrega y recepción a satisfacción de bienes y servicios.
                  </p>
                </div>
              </div>

              {pendingEvaluationOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-secondary flex items-center justify-center gap-2 bg-emerald-50/30">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">
                    Al día: Todas las órdenes de compra entregadas cuentan con evaluación de desempeño registrada.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                      <tr>
                        <th className="py-3 px-4">Código OC</th>
                        <th className="py-3 px-4">Proveedor</th>
                        <th className="py-3 px-4">Proyecto</th>
                        <th className="py-3 px-4">Monto Total</th>
                        <th className="py-3 px-4">Fecha Entrega</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendingEvaluationOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                            {o.order_code}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-text-primary">{o.supplier_name}</p>
                            <p className="text-[11px] text-text-muted">{o.supplier_nit ? `NIT: ${o.supplier_nit}` : 'Sin NIT'}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-primary block">
                              {o.projects?.cost_center || 'General'}
                            </span>
                            <span className="text-[11px] text-text-muted truncate max-w-[150px] block">
                              {o.projects?.name || 'Administración'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-text-primary whitespace-nowrap">
                            {formatCOP(Number(o.total_amount) || 0)}
                          </td>
                          <td className="py-3 px-4 font-mono text-text-muted whitespace-nowrap">
                            {o.delivery_deadline ? new Date(o.delivery_deadline).toLocaleDateString('es-CO') : 'Inmediata'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Pendiente Evaluación
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluationModal(o)}
                              className="btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs px-3 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                              title="Calificar desempeño del proveedor"
                            >
                              <Star className="w-3.5 h-3.5 fill-primary-900 text-primary-900" />
                              Evaluar Proveedor
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Registro Histórico de Evaluaciones */}
            <div className="card bg-white border border-border shadow-card rounded-2xl overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-accent" />
                    Histórico de Evaluaciones Registradas ({filteredSuppliers.length})
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Calificaciones consolidadas de calidad, tiempos de entrega y atención comercial.
                  </p>
                </div>
              </div>

              {filteredSuppliers.length === 0 ? (
                <div className="p-12 text-center">
                  <Star className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-text-primary">Sin evaluaciones registradas</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Aún no se han completado encuestas de desempeño de proveedores en el sistema.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-text-secondary uppercase tracking-wider text-[11px] font-bold border-b border-border">
                      <tr>
                        <th className="py-3 px-4">Proveedor</th>
                        <th className="py-3 px-4 text-center">Calificación General</th>
                        <th className="py-3 px-4 text-center">Calidad</th>
                        <th className="py-3 px-4 text-center">Tiempos</th>
                        <th className="py-3 px-4 text-center">Servicio</th>
                        <th className="py-3 px-4 text-center">Recomendado</th>
                        <th className="py-3 px-4">Comentarios</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSuppliers.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-text-primary whitespace-nowrap">
                            {ev.supplier_name}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-amber-800 text-xs font-bold font-mono">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              {Number(ev.overall_rating).toFixed(1)} / 5
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                            {ev.quality_score}/5
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                            {ev.delivery_time_score}/5
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                            {ev.service_score}/5
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {ev.recommend_supplier ? (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sí
                              </span>
                            ) : (
                              <span className="text-rose-700 bg-rose-50 border border-rose-200 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px]">
                                <AlertTriangle className="w-3 h-3 text-rose-600" /> No
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[240px]">
                            <p className="text-text-secondary italic truncate text-[11px]" title={ev.comments || ''}>
                              {ev.comments ? `"${ev.comments}"` : '—'}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {Number(ev.overall_rating) >= 4.0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Proveedor Conforme
                              </span>
                            ) : Number(ev.overall_rating) >= 3.0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                Desempeño Regular
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                No Conforme
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-text-muted font-mono whitespace-nowrap text-[11px]">
                            {new Date(ev.created_at).toLocaleDateString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ────────────────────────────────────────────────────────────────────
          MODAL DETALLE DE REQUERIMIENTO (FLUJO COMPLETO DE FIRMAS & AUDITORÍA)
         ──────────────────────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-accent/15 text-accent-800 border border-accent/30">
                    {selectedRequest.request_code || 'REQ-0001'}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Detalle de Solicitud
                  </span>
                  {activeTab === 'approvals' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Revisión VB Técnico
                    </span>
                  )}
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

            {/* 1. Sección: Detalles del Proyecto y Solicitud (Colapsable con flecha) */}
            <div className="bg-surface-secondary border border-border rounded-xl overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setExpandProjectDetails((v) => !v)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-100/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center border border-border shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-text-primary block truncate">
                      Detalles del Proyecto y Solicitud
                    </span>
                    <span className="text-[11px] text-text-muted truncate block">
                      {selectedRequest.projects?.name || selectedRequest.cost_center || 'General'} &bull; CC: <span className="font-mono font-semibold text-text-primary">{selectedRequest.cost_center || selectedRequest.projects?.cost_center || '—'}</span> &bull; Total: <span className="font-mono font-bold text-accent-800">{formatCOP(selectedRequest.total_amount || 0)}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[10px] text-text-muted font-medium hidden sm:inline">
                    {expandProjectDetails ? 'Contraer' : 'Expandir'}
                  </span>
                  {expandProjectDetails ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" strokeWidth={2} />
                  )}
                </div>
              </button>

              {expandProjectDetails && (
                <div className="p-3.5 pt-0 border-t border-border/60">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-border/80 mt-2">
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
                </div>
              )}
            </div>

            {/* 2. Sección: Justificación y Ubicación (Colapsable con flecha) */}
            {selectedRequest.justification && (
              <div className="border border-border rounded-xl overflow-hidden bg-white transition-all">
                <button
                  type="button"
                  onClick={() => setExpandJustification((v) => !v)}
                  className="w-full p-2.5 px-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-text-secondary shrink-0" strokeWidth={1.75} />
                    <span className="text-xs font-semibold text-text-primary">
                      Justificación y Ubicación
                    </span>
                    {!expandJustification && (
                      <span className="text-[11px] text-text-muted truncate max-w-sm hidden sm:inline">
                        — {selectedRequest.justification}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-[10px] text-text-muted font-medium hidden sm:inline">
                      {expandJustification ? 'Contraer' : 'Expandir'}
                    </span>
                    {expandJustification ? (
                      <ChevronDown className="w-4 h-4 text-text-muted" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-muted" strokeWidth={2} />
                    )}
                  </div>
                </button>
                {expandJustification && (
                  <div className="p-3 pt-0 text-xs text-text-secondary leading-relaxed border-t border-border/60">
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-border/80 mt-2">
                      {selectedRequest.justification}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Sección: Bienes e Insumos Solicitados (Enfoque Total y Análisis APU) */}
            {selectedRequest.items && selectedRequest.items.length > 0 && (
              <div
                className={`rounded-xl p-3.5 space-y-3 transition-all ${
                  activeTab === 'approvals'
                    ? 'bg-amber-500/5 border-2 border-accent/40 shadow-xs'
                    : 'border border-border bg-surface'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center border border-accent/30 text-accent-800">
                      <Package className="w-3.5 h-3.5" strokeWidth={2} />
                    </div>
                    <span className="font-bold text-text-primary text-xs sm:text-sm">
                      Bienes e Insumos Solicitados ({selectedRequest.items.length})
                    </span>
                    {activeTab === 'approvals' && (
                      <span className="px-2 py-0.5 rounded bg-accent text-primary-900 border border-accent-400 font-bold text-[10px] uppercase tracking-wider">
                        Revisión Técnica APU
                      </span>
                    )}
                  </div>

                  {/* Switch de modo de visualización: Tabla compacta vs Análisis Presupuestal APU vs Cuadro de Cotizaciones */}
                  <div className="flex flex-wrap items-center gap-1 bg-surface-secondary p-0.5 rounded-lg border border-border text-[11px] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setItemsViewMode('standard')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        itemsViewMode === 'standard'
                          ? 'bg-white shadow-2xs font-bold text-text-primary'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Vista Tabular
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemsViewMode('analysis')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        itemsViewMode === 'analysis'
                          ? 'bg-white shadow-2xs font-bold text-accent-800'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Calculator className="w-3 h-3 text-accent" strokeWidth={2} />
                      Análisis Presupuestal APU
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemsViewMode('quotation')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        itemsViewMode === 'quotation'
                          ? 'bg-white shadow-2xs font-bold text-amber-900 border border-amber-300'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-accent" strokeWidth={2} />
                      Cuadro de Cotizaciones (3 Opciones)
                    </button>
                  </div>
                </div>

                {/* Resumen de Presupuesto Vinculado en caso de existir */}
                {selectedProjectBudget && (
                  <div className="p-2 bg-white rounded-lg border border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Layers className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                      <span>Presupuesto APU de Referencia:</span>
                      <span className="font-mono font-bold text-text-primary">{selectedProjectBudget.budget_code}</span>
                      <span className="text-text-muted">({selectedProjectBudget.project_title})</span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">
                      {selectedProjectBudget.items.length} rubros parametrizados
                    </span>
                  </div>
                )}

                {/* Vista 0: Cuadro Comparativo de 3 Cotizaciones por Ítem con Selección y Actualización */}
                {itemsViewMode === 'quotation' ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent shrink-0" />
                        <span>
                          <strong>Mesa de Cotizaciones de Compras:</strong> Registra y compara hasta 3 ofertas, ajusta o confirma valores de presupuesto y selecciona la opción a adjudicar para la Orden de Compra.
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-900 shrink-0 font-semibold bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                        {quotationDraftItems.filter((it) => it.quotations && it.quotations.length > 0 && it.selected_quotation_index !== undefined).length} de {quotationDraftItems.length} ítems listos
                      </span>
                    </div>

                    {quotationDraftItems.map((draftIt, itemIdx) => {
                      const budgetAnalysis = getItemBudgetAnalysis(draftIt);
                      const selOptIdx = draftIt.selected_quotation_index ?? 0;
                      const opts = draftIt.quotations || [];

                      return (
                        <div key={itemIdx} className="bg-white rounded-xl border border-border p-4 space-y-3.5 shadow-2xs">
                          {/* Cabecera del ítem */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-border/80 pb-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-primary-900 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                #{draftIt.item_no || itemIdx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-text-primary text-sm leading-snug">
                                  {draftIt.description || draftIt.item || 'Ítem Solicitado'}
                                </h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mt-1">
                                  <span>
                                    Cantidad: <strong className="font-mono text-text-primary">{draftIt.quantity} {draftIt.unit || 'Und'}</strong>
                                  </span>
                                  {draftIt.budget_rubro && (
                                    <span className="text-accent-800 font-semibold font-mono">
                                      Rubro APU: {draftIt.budget_rubro}
                                    </span>
                                  )}
                                  {budgetAnalysis.budgetItem && (
                                    <span className="text-emerald-700 font-medium font-mono">
                                      (Tarifa APU: {formatCOP(budgetAnalysis.budgetPrice)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Estampa de auditoría horaria si ya fue modificado */}
                            {draftIt.price_audit && (
                              <div className="text-right text-[10px] text-text-muted font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-border">
                                <span className="block font-semibold text-text-primary">
                                  Modificado: {draftIt.price_audit.updated_at_formatted}
                                </span>
                                <span className="block text-text-secondary truncate max-w-[200px]" title={draftIt.price_audit.updated_by_name}>
                                  Por: {draftIt.price_audit.updated_by_name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Grid de las 3 opciones de cotización */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {[0, 1, 2].map((optIdx) => {
                              const opt = opts[optIdx] || {
                                option_no: optIdx + 1,
                                source: optIdx === 0 ? 'solicitud' : optIdx === 1 ? 'presupuesto' : 'mercado',
                                supplier: '',
                                brand: '',
                                unit_price: '',
                                total: 0,
                                delivery_date: selectedRequest?.delivery_date || '',
                                delivery_days: selectedRequest?.delivery_date || '',
                                notes: '',
                              };
                              const isSelected = selOptIdx === optIdx;
                              const optPrice = typeof opt.unit_price === 'number' ? opt.unit_price : Number(opt.unit_price) || 0;
                              const optTotal = (Number(draftIt.quantity) || 1) * optPrice;

                              return (
                                <div
                                  key={optIdx}
                                  className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                                    isSelected
                                      ? 'border-2 border-accent bg-amber-50/40 shadow-xs ring-1 ring-accent'
                                      : 'border-border bg-slate-50/50 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-border/60">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-mono ${
                                          isSelected ? 'bg-accent text-primary-900 font-bold' : 'bg-slate-200 text-slate-700'
                                        }`}>
                                          {optIdx + 1}
                                        </span>
                                        <span className="text-[11px] font-bold text-text-primary uppercase tracking-wide">
                                          {optIdx === 0
                                            ? 'Opción 1 (Solicitud)'
                                            : optIdx === 1
                                            ? 'Opción 2 (Tarifa APU / B)'
                                            : 'Opción 3 (Alternativa C)'}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <span className="text-[10px] font-bold text-primary-900 bg-accent px-1.5 py-0.5 rounded shadow-2xs">
                                          Adjudicada
                                        </span>
                                      )}
                                    </div>

                                    {/* Botón rápido para fijar tarifa APU en Opción 2 */}
                                    {optIdx === 1 && budgetAnalysis.budgetItem && (
                                      <button
                                        type="button"
                                        onClick={() => handleApplyApuPriceToOption(itemIdx, optIdx, budgetAnalysis.budgetItem!)}
                                        className="w-full text-[10px] font-semibold py-1 px-2 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <RefreshCw className="w-3 h-3 text-accent" />
                                        <span>Fijar Tarifa APU ({formatCOP(budgetAnalysis.budgetPrice)})</span>
                                      </button>
                                    )}

                                    {/* Inputs de la opción */}
                                    <div className="space-y-2 text-xs">
                                      <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                          <label className="block text-[10px] font-semibold text-text-muted">Proveedor / Razón Social</label>
                                          <button
                                            type="button"
                                            onClick={() => setShowQuickSupplierModal(true)}
                                            className="text-[9px] font-bold text-accent hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                            title="Registrar nuevo proveedor en catálogo"
                                          >
                                            <Plus className="w-2.5 h-2.5" />
                                            + Nuevo
                                          </button>
                                        </div>
                                        <select
                                          value={
                                            suppliersList.some((s) => s.company_name.toLowerCase().trim() === (opt.supplier || '').toLowerCase().trim())
                                              ? suppliersList.find((s) => s.company_name.toLowerCase().trim() === (opt.supplier || '').toLowerCase().trim())?.company_name
                                              : opt.supplier || ''
                                          }
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__NEW__') {
                                              setShowQuickSupplierModal(true);
                                              return;
                                            }
                                            handleUpdateOptionField(itemIdx, optIdx, 'supplier', val);
                                            const found = suppliersList.find((s) => s.company_name === val);
                                            if (found && !opt.notes) {
                                              handleUpdateOptionField(itemIdx, optIdx, 'notes', `${found.category || 'Proveedor'} - ${found.payment_terms || 'Contado'}`);
                                            }
                                          }}
                                          className="w-full text-xs rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent font-medium truncate"
                                        >
                                          <option value="">-- Seleccionar de BD Proveedores --</option>
                                          {suppliersList.map((sup) => (
                                            <option key={sup.id || sup.nit} value={sup.company_name}>
                                              {sup.company_name} ({sup.nit})
                                            </option>
                                          ))}
                                          {opt.supplier && !suppliersList.some((s) => s.company_name.toLowerCase().trim() === opt.supplier.toLowerCase().trim()) && (
                                            <option value={opt.supplier}>{opt.supplier} (Registrado en Solicitud)</option>
                                          )}
                                          <option value="__NEW__" className="text-amber-800 font-bold bg-amber-50">
                                            + Registrar Nuevo Proveedor...
                                          </option>
                                        </select>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[10px] font-semibold text-text-muted mb-0.5">Marca / Ref.</label>
                                          <input
                                            type="text"
                                            value={opt.brand || ''}
                                            onChange={(e) => handleUpdateOptionField(itemIdx, optIdx, 'brand', e.target.value)}
                                            placeholder="Marca"
                                            className="w-full text-xs rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-semibold text-text-muted mb-0.5">Fecha Entrega</label>
                                          <input
                                            type="date"
                                            value={
                                              opt.delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(opt.delivery_date)
                                                ? opt.delivery_date
                                                : opt.delivery_days && /^\d{4}-\d{2}-\d{2}$/.test(String(opt.delivery_days))
                                                ? String(opt.delivery_days)
                                                : selectedRequest?.delivery_date || ''
                                            }
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              handleUpdateOptionField(itemIdx, optIdx, 'delivery_date', val);
                                              handleUpdateOptionField(itemIdx, optIdx, 'delivery_days', val);
                                            }}
                                            className="w-full text-xs font-mono rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-semibold text-text-muted mb-0.5">Valor Unitario (COP)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={opt.unit_price === '' ? '' : opt.unit_price}
                                          onChange={(e) => handleUpdateOptionField(itemIdx, optIdx, 'unit_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                          placeholder="0"
                                          className="w-full text-xs font-mono font-semibold rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                        />
                                      </div>

                                      <div className="p-2 rounded bg-white border border-border/80 flex items-center justify-between text-xs">
                                        <span className="text-[10px] text-text-muted font-medium">Subtotal ({draftIt.quantity} {draftIt.unit}):</span>
                                        <span className="font-mono font-bold text-text-primary">{formatCOP(optTotal)}</span>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-semibold text-text-muted mb-0.5">Notas / Condiciones</label>
                                        <input
                                          type="text"
                                          value={opt.notes || ''}
                                          onChange={(e) => handleUpdateOptionField(itemIdx, optIdx, 'notes', e.target.value)}
                                          placeholder="Forma de pago, validez..."
                                          className="w-full text-[11px] rounded border border-border bg-white px-2 py-1 text-text-secondary focus:ring-1 focus:ring-accent"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Botón de selección de la opción */}
                                  <div className="pt-3 border-t border-border/60 mt-3">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectWinningOption(itemIdx, optIdx)}
                                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        isSelected
                                          ? 'bg-accent text-primary-900 shadow-sm ring-1 ring-accent'
                                          : 'bg-white border border-border text-text-secondary hover:bg-slate-100 hover:text-text-primary'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-primary-900" />
                                          <span>Seleccionada para OC</span>
                                        </>
                                      ) : (
                                        <span>Seleccionar esta Opción</span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Barra de consolidado y botón de guardado en BD */}
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-card space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Resumen Económico de Cotizaciones</span>
                          <p className="text-xs text-slate-300">Valores consolidados según las opciones seleccionadas para la Orden de Compra.</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Total Solicitud:</span>
                            <span className="text-slate-300 font-bold">{formatCOP(selectedRequest.total_amount || 0)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-amber-400 block">Total Cotizado Confirmado:</span>
                            <span className="text-amber-400 text-base font-bold">
                              {formatCOP(
                                quotationDraftItems.reduce((acc, it) => {
                                  const selIdx = it.selected_quotation_index ?? 0;
                                  const chosenOpt = (it.quotations || [])[selIdx];
                                  const pr = chosenOpt ? Number(chosenOpt.unit_price) || 0 : Number(it.unit_price) || 0;
                                  return acc + (Number(it.quantity) || 1) * pr;
                                }, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                        <div className="flex-1 max-w-lg">
                          <input
                            type="text"
                            value={quotationChangeReason}
                            onChange={(e) => setQuotationChangeReason(e.target.value)}
                            placeholder="Justificación / Motivo del cambio de precios o negociación (opcional)..."
                            className="w-full text-xs rounded-lg border border-slate-700 bg-slate-800/90 text-white px-3 py-1.5 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveQuotationsToDb}
                          disabled={isSavingQuotations}
                          className="btn bg-accent text-primary-900 font-bold hover:bg-accent-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm text-xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingQuotations ? (
                            <span>Guardando en Base de Datos...</span>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-primary-900" />
                              <span>Guardar Cotizaciones y Actualizar Precios</span>
                            </>
                          )}
                        </button>
                      </div>

                      {quotationSuccessMsg && (
                        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500 rounded-lg text-emerald-200 text-xs font-medium flex items-center gap-2 animate-fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{quotationSuccessMsg}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : itemsViewMode === 'analysis' ? (
                  <div className="space-y-3">
                    {selectedRequest.items.map((it, idx) => {
                      const analysis = getItemBudgetAnalysis(it);
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-xl border border-border p-3.5 space-y-3 shadow-2xs hover:border-accent/40 transition-colors"
                        >
                          {/* Encabezado del ítem */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-border/70 pb-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-md bg-surface-secondary text-text-muted font-mono font-bold text-xs flex items-center justify-center border border-border shrink-0 mt-0.5">
                                {it.item_no || idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-text-primary text-xs sm:text-sm leading-snug">
                                  {it.description || it.item || 'Ítem Solicitado'}
                                </h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted mt-1">
                                  <span>
                                    Unidad: <span className="font-mono font-semibold text-text-primary">{it.unit || 'Und'}</span>
                                  </span>
                                  {(it.brand || it.suggested_supplier) && (
                                    <span>
                                      Marca / Prov.: <span className="text-text-primary font-medium">{it.brand || it.suggested_supplier}</span>
                                    </span>
                                  )}
                                  {analysis.budgetCode && (
                                    <span className="font-mono text-accent-800 font-semibold">
                                      APU: {analysis.budgetCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${analysis.badgeClass}`}>
                                {analysis.status === 'within_budget' || analysis.status === 'exact_budget' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2} />
                                ) : analysis.status === 'exceeds_budget' ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" strokeWidth={2} />
                                ) : (
                                  <HelpCircle className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={2} />
                                )}
                                {analysis.label}
                              </span>
                            </div>
                          </div>

                          {/* Contenido del análisis individual */}
                          {analysis.budgetItem ? (
                            <div className="space-y-2.5">
                              {/* Grid de 3 cajas comparativas */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                {/* Caja 1: Solicitud Actual */}
                                <div className="bg-slate-50/90 rounded-lg p-2.5 border border-border space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                    <span>En Solicitud</span>
                                    <span className="font-mono">{analysis.reqQty} {it.unit || 'Und'}</span>
                                  </div>
                                  <div className="pt-0.5">
                                    <span className="text-[10px] text-text-muted block">Vlr. Unitario:</span>
                                    <span className="font-mono font-semibold text-text-primary text-xs">{formatCOP(analysis.reqPrice)}</span>
                                  </div>
                                  <div className="pt-0.5 border-t border-border/60 flex items-center justify-between">
                                    <span className="text-[11px] text-text-muted">Total Solicitud:</span>
                                    <span className="font-mono font-bold text-text-primary">{formatCOP(analysis.reqTotal)}</span>
                                  </div>
                                </div>

                                {/* Caja 2: Presupuesto APU Contractual */}
                                <div className="bg-amber-50/40 rounded-lg p-2.5 border border-amber-200/80 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                                    <span>En Presupuesto APU</span>
                                    <span className="font-mono">{analysis.budgetQty} {analysis.budgetItem.unit}</span>
                                  </div>
                                  <div className="pt-0.5">
                                    <span className="text-[10px] text-amber-900/80 block">Tarifa Unitaria APU:</span>
                                    <span className="font-mono font-semibold text-amber-950 text-xs">{formatCOP(analysis.budgetPrice)}</span>
                                  </div>
                                  <div className="pt-0.5 border-t border-amber-200/60 flex items-center justify-between">
                                    <span className="text-[11px] text-amber-900">Total Proyectado:</span>
                                    <span className="font-mono font-bold text-amber-950">{formatCOP(analysis.budgetTotal)}</span>
                                  </div>
                                </div>

                                {/* Caja 3: Variación y Margen */}
                                <div
                                  className={`rounded-lg p-2.5 border space-y-1 ${
                                    analysis.unitDiff > 0
                                      ? 'bg-rose-50/60 border-rose-200'
                                      : analysis.unitDiff < 0
                                      ? 'bg-emerald-50/60 border-emerald-200'
                                      : 'bg-blue-50/60 border-blue-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                    <span
                                      className={
                                        analysis.unitDiff > 0
                                          ? 'text-rose-900'
                                          : analysis.unitDiff < 0
                                          ? 'text-emerald-900'
                                          : 'text-blue-900'
                                      }
                                    >
                                      Variación Unitaria
                                    </span>
                                    <span className="font-mono font-bold">
                                      {analysis.unitDiff > 0
                                        ? `+${analysis.unitPct.toFixed(1)}%`
                                        : analysis.unitDiff < 0
                                        ? `${analysis.unitPct.toFixed(1)}%`
                                        : '0%'}
                                    </span>
                                  </div>
                                  <div className="pt-0.5">
                                    <span className="text-[10px] text-text-muted block">Diferencia x Unidad:</span>
                                    <span
                                      className={`font-mono font-bold text-xs ${
                                        analysis.unitDiff > 0
                                          ? 'text-rose-700'
                                          : analysis.unitDiff < 0
                                          ? 'text-emerald-700'
                                          : 'text-blue-700'
                                      }`}
                                    >
                                      {analysis.unitDiff > 0
                                        ? `+${formatCOP(analysis.unitDiff)}`
                                        : analysis.unitDiff < 0
                                        ? `-${formatCOP(Math.abs(analysis.unitDiff))}`
                                        : '$ 0 (Exacto)'}
                                    </span>
                                  </div>
                                  <div className="pt-0.5 border-t border-border/60 flex items-center justify-between">
                                    <span className="text-[11px] text-text-muted">Impacto Total:</span>
                                    <span
                                      className={`font-mono font-bold ${
                                        analysis.totalDiff > 0
                                          ? 'text-rose-700'
                                          : analysis.totalDiff < 0
                                          ? 'text-emerald-700'
                                          : 'text-text-primary'
                                      }`}
                                    >
                                      {analysis.totalDiff > 0
                                        ? `+${formatCOP(analysis.totalDiff)}`
                                        : analysis.totalDiff < 0
                                        ? `-${formatCOP(Math.abs(analysis.totalDiff))}`
                                        : '$ 0'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Detalle del rubro contractual vinculado */}
                              <div className="text-[11px] text-text-muted bg-gray-50/90 rounded-lg p-2 border border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <div>
                                  <span className="font-semibold text-text-primary">Rubro APU Contractual: </span>
                                  <span>{analysis.budgetItem.description}</span>
                                </div>
                                {analysis.budgetItem.category && (
                                  <span className="font-medium text-text-secondary capitalize">
                                    Categoría: {analysis.budgetItem.category}
                                  </span>
                                )}
                              </div>

                              {/* Alerta de cantidad si la solicitud pide más unidades de las proyectadas en el APU */}
                              {analysis.budgetQty > 0 && analysis.reqQty > analysis.budgetQty && (
                                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={2} />
                                  <span>
                                    <strong>Atención Técnica:</strong> La cantidad solicitada (
                                    <span className="font-mono font-bold">{analysis.reqQty}</span>) excede la proyectada en el presupuesto APU (
                                    <span className="font-mono font-bold">{analysis.budgetQty}</span>) en{' '}
                                    <span className="font-mono font-bold">+{analysis.reqQty - analysis.budgetQty}</span> unidades.
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Ítem no presupuestado o adicional */
                            <div className="bg-amber-50/40 rounded-lg p-3 border border-amber-200/80 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                                <div>
                                  <span className="font-semibold text-amber-950">Insumo Adicional Directo: </span>
                                  <span className="text-amber-900">No vinculado a un rubro del presupuesto contractual base.</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono text-xs">
                                  <span>
                                    Cant: <strong>{analysis.reqQty} {it.unit || 'Und'}</strong>
                                  </span>
                                  <span>
                                    Vlr. Unit: <strong>{formatCOP(analysis.reqPrice)}</strong>
                                  </span>
                                  <span>
                                    Total: <strong className="text-accent-800">{formatCOP(analysis.reqTotal)}</strong>
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-amber-900/80 leading-normal">
                                Este ítem fue formulado como insumo imprevisto o adicional de obra fuera de los rubros APU contractuales. Requiere validación y visto bueno técnico para autorizar compra fuera de presupuesto contractual.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Vista 2: Tabla Estándar (Compacta) */
                  <div className="border border-border rounded-xl overflow-hidden bg-white">
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
                )}
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
                <div className="bg-slate-50/80 border border-border rounded-xl overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setExpandSignaturesFlow((v) => !v)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PenTool className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.75} />
                      <span className="text-xs font-bold text-text-primary">
                        Flujo de Firmas y Trazabilidad (4 Pasos)
                      </span>
                      {!expandSignaturesFlow && (
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium hidden sm:inline">
                          {sigManagement
                            ? 'Aprobada por Gerencia'
                            : sigPurchasing
                            ? 'Paso 3: Cotización Registrada'
                            : sigDirector
                            ? (sigDirector.rejected ? 'Paso 2: VB Técnico Rechazado' : 'Paso 2: VB Técnico Aprobado')
                            : 'Paso 2: Pendiente VB Técnico'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] text-text-muted font-medium hidden sm:inline">
                        {expandSignaturesFlow ? 'Contraer' : 'Expandir'}
                      </span>
                      {expandSignaturesFlow ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" strokeWidth={2} />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" strokeWidth={2} />
                      )}
                    </div>
                  </button>

                  {expandSignaturesFlow && (
                    <div className="p-3.5 pt-0 border-t border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-text-muted">
                          Firmas electrónicas con validez probatoria y auditoría de visualización:
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
              )}
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
      {/* ────────────────────────────────────────────────────────────────────
          MODAL DETALLE Y SEGUIMIENTO DE ORDEN DE COMPRA FORMALIZADA
         ──────────────────────────────────────────────────────────────────── */}
      {selectedOrder && (() => {
        const trackingForm = trackingStatusForm[selectedOrder.id] || {
          status: selectedOrder.status || 'issued',
          note: '',
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in overflow-y-auto">
            <div className="bg-surface rounded-2xl border border-border max-w-2xl w-full p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono bg-slate-100 px-2 py-0.5 rounded border border-border">
                      {selectedOrder.order_code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      STATUS_ORDER_LABELS[selectedOrder.status]?.badge || 'bg-blue-100 text-blue-900'
                    }`}>
                      {STATUS_ORDER_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mt-1">{selectedOrder.supplier_name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-border">
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
                  <p className="font-mono font-bold text-base text-emerald-700 mt-0.5">{formatCOP(Number(selectedOrder.total_amount) || 0)}</p>
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

              {/* Ítems incluidos en la orden si están disponibles */}
              {Array.isArray(selectedOrder.items_detail) && selectedOrder.items_detail.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-text-primary flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-accent" />
                    Ítems de la Orden de Compra ({selectedOrder.items_detail.length})
                  </p>
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-text-muted border-b border-border">
                        <tr>
                          <th className="py-1.5 px-3">#</th>
                          <th className="py-1.5 px-3">Descripción</th>
                          <th className="py-1.5 px-3 text-center">Cant.</th>
                          <th className="py-1.5 px-3 text-right">Vlr. Unitario</th>
                          <th className="py-1.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selectedOrder.items_detail.map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-mono text-[10px] text-text-muted">{it.item_no || idx + 1}</td>
                            <td className="py-1.5 px-3 font-medium text-text-primary">{it.description}</td>
                            <td className="py-1.5 px-3 text-center font-mono">{it.quantity} {it.unit || 'Und'}</td>
                            <td className="py-1.5 px-3 text-right font-mono text-text-muted">{formatCOP(it.unit_price)}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-text-primary">{formatCOP(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Módulo de seguimiento de entrega */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h6 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    Control y Actualización de Seguimiento
                  </h6>
                  <span className="text-[10px] text-text-muted">
                    Rastreo del estado del pedido hasta la entrega en campo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                      Estado Actual del Pedido
                    </label>
                    <select
                      value={trackingForm.status}
                      onChange={(e) =>
                        setTrackingStatusForm((prev) => ({
                          ...prev,
                          [selectedOrder.id]: {
                            ...trackingForm,
                            status: e.target.value,
                          },
                        }))
                      }
                      className="w-full text-xs rounded border border-border bg-white px-2 py-1.5 text-text-primary font-semibold focus:ring-1 focus:ring-accent"
                    >
                      <option value="issued">Emitida (Enviada a proveedor)</option>
                      <option value="confirmed">Confirmada por proveedor</option>
                      <option value="in_transit">En despacho / Tránsito a obra</option>
                      <option value="partially_received">Entrega parcial recibida</option>
                      <option value="completed">Entregada y recibida a satisfacción</option>
                      <option value="cancelled">Anulada / Cancelada</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                      Nota / Guía de despacho
                    </label>
                    <input
                      type="text"
                      value={trackingForm.note}
                      onChange={(e) =>
                        setTrackingStatusForm((prev) => ({
                          ...prev,
                          [selectedOrder.id]: {
                            ...trackingForm,
                            note: e.target.value,
                          },
                        }))
                      }
                      placeholder="Ej: Guía Servientrega 109283"
                      className="w-full text-xs rounded border border-border bg-white px-2 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id)}
                      disabled={trackingForm.isSubmitting}
                      className="w-full btn bg-primary-900 text-white hover:bg-black font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      {trackingForm.isSubmitting ? (
                        <span>Guardando...</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-accent" />
                          <span>Actualizar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Historial de eventos */}
                {Array.isArray(selectedOrder.tracking_history) && selectedOrder.tracking_history.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      Bitácora de Trazabilidad ({selectedOrder.tracking_history.length})
                    </p>
                    <div className="space-y-1 text-xs max-h-32 overflow-y-auto pl-2 border-l-2 border-accent">
                      {selectedOrder.tracking_history.map((ev, evIdx) => (
                        <div key={evIdx} className="bg-white p-2 rounded border border-border/60 text-[11px]">
                          <div className="flex items-center justify-between text-[10px] text-text-muted">
                            <span className="font-bold text-text-primary">{ev.user_name}</span>
                            <span className="font-mono">{ev.formatted_date || ev.timestamp}</span>
                          </div>
                          <p className="text-text-secondary mt-0.5">{ev.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Acceso a Evaluación de Proveedor si la orden ya está completada */}
              {selectedOrder.status === 'completed' && (() => {
                const isAlreadyEvaluated = (dashboard?.evaluations || []).some(
                  (ev) => ev.purchase_order_id === selectedOrder.id
                );
                return (
                  <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isAlreadyEvaluated
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-amber-50 border-amber-300'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        isAlreadyEvaluated ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'
                      }`}>
                        <Star className={`w-4 h-4 ${isAlreadyEvaluated ? 'fill-emerald-600 text-emerald-600' : 'fill-amber-500 text-amber-600'}`} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isAlreadyEvaluated ? 'text-emerald-950' : 'text-amber-950'}`}>
                          {isAlreadyEvaluated ? 'Evaluación de Desempeño Registrada' : 'Orden Entregada — Calificación Pendiente'}
                        </p>
                        <p className={`text-[11px] ${isAlreadyEvaluated ? 'text-emerald-800' : 'text-amber-800'}`}>
                          {isAlreadyEvaluated
                            ? 'Este proveedor cuenta con encuesta de cumplimiento y calidad bajo ISO 9001.'
                            : `Registra la evaluación de calidad, tiempos y servicio de ${selectedOrder.supplier_name}.`}
                        </p>
                      </div>
                    </div>
                    {!isAlreadyEvaluated && (
                      <button
                        type="button"
                        onClick={() => handleOpenEvaluationModal(selectedOrder)}
                        className="btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs px-3.5 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-end sm:self-center"
                      >
                        <Star className="w-3.5 h-3.5 fill-primary-900 text-primary-900" />
                        Evaluar Proveedor
                      </button>
                    )}
                  </div>
                );
              })()}

              <div className="pt-2 flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadOrderPdf(selectedOrder)}
                    disabled={downloadingOrderId === selectedOrder.id}
                    className="btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs py-2 px-3.5 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-primary-900 stroke-[2.5]" />
                    Descargar Orden de Compra (PDF)
                  </button>
                  {selectedOrder.attachment_url && (
                    <a
                      href={selectedOrder.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline ml-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver soporte / Cotización
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ────────────────────────────────────────────────────────────────────
          MODAL ESPECIALIZADO: EMISIÓN Y SEGUIMIENTO DE ÓRDENES DE COMPRA (TAB 6)
         ──────────────────────────────────────────────────────────────────── */}
      {orderIssuingRequest && (() => {
        // Agrupar ítems adjudicados por proveedor
        const supplierGroups: Record<
          string,
          {
            supplierName: string;
            items: PurchaseRequestItemData[];
            totalAmount: number;
          }
        > = {};

        (orderIssuingRequest.items || []).forEach((it) => {
          const selOpt = it.quotations?.find((q) => q.is_selected) || it.quotations?.[0];
          const supName = selOpt?.supplier?.trim() || it.suggested_supplier?.trim() || 'Proveedor Sin Asignar';
          const unitPrice =
            typeof selOpt?.unit_price === 'number'
              ? selOpt.unit_price
              : Number(selOpt?.unit_price) || Number(it.unit_price) || 0;
          const qty = Number(it.quantity) || 1;
          const subtotal = qty * unitPrice;

          if (!supplierGroups[supName]) {
            supplierGroups[supName] = {
              supplierName: supName,
              items: [],
              totalAmount: 0,
            };
          }
          supplierGroups[supName].items.push(it);
          supplierGroups[supName].totalAmount += subtotal;
        });

        const groupsList = Object.values(supplierGroups);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="bg-surface rounded-2xl border border-border max-w-4xl w-full p-4 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                      {orderIssuingRequest.request_code}
                    </span>
                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">
                      Emisión y Seguimiento de Órdenes de Compra
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-text-primary mt-1">
                    Formalización de OC — {orderIssuingRequest.projects?.name || orderIssuingRequest.cost_center || 'Proyecto Asignado'}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Generación de órdenes de compra agrupadas por proveedor adjudicado con control de entregas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderIssuingRequest(null)}
                  className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              {/* Resumen del expediente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-border rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-text-muted block">Centro de Costo:</span>
                  <span className="font-mono font-bold text-text-primary">
                    {orderIssuingRequest.cost_center || orderIssuingRequest.projects?.cost_center || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Solicitante:</span>
                  <span className="font-semibold text-text-primary truncate block">
                    {orderIssuingRequest.applicant_name || 'Personal Operativo'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Aprobado Por:</span>
                  <span className="font-semibold text-emerald-800 truncate block">
                    {orderIssuingRequest.approver_name || 'Gerencia General'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Monto Aprobado:</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm">
                    {formatCOP(orderIssuingRequest.total_amount || 0)}
                  </span>
                </div>
              </div>

              {/* Lista de Grupos por Proveedor Adjudicado */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-accent" />
                    Proveedores Adjudicados ({groupsList.length})
                  </h4>
                  <span className="text-[11px] text-text-muted">
                    Los insumos se agrupan por el proveedor seleccionado en la cotización.
                  </span>
                </div>

                {groupsList.map((group) => {
                  const sName = group.supplierName;
                  const supDbInfo = suppliersList.find(
                    (s) => s.company_name.toLowerCase().trim() === sName.toLowerCase().trim()
                  );

                  // Verificar si ya existe orden emitida para este requerimiento y proveedor
                  const existingOrder = (dashboard?.orders || []).find(
                    (o) =>
                      o.purchase_request_id === orderIssuingRequest.id &&
                      o.supplier_name.toLowerCase().trim() === sName.toLowerCase().trim()
                  );

                  const formVals = orderForms[sName] || {
                    order_code: `OC-${new Date().getFullYear()}-001`,
                    payment_terms: supDbInfo?.payment_terms || 'Contado',
                    delivery_deadline: orderIssuingRequest.delivery_date || '',
                    delivery_site: orderIssuingRequest.delivery_site || '',
                    notes: '',
                  };

                  const trackingForm = trackingStatusForm[existingOrder?.id || ''] || {
                    status: existingOrder?.status || 'issued',
                    note: '',
                  };

                  return (
                    <div
                      key={sName}
                      className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden transition-all"
                    >
                      {/* Cabecera del proveedor */}
                      <div className="p-4 bg-slate-50/70 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-sm font-bold text-text-primary">{sName}</h5>
                            {supDbInfo?.nit && (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-200/80 text-text-secondary font-semibold">
                                NIT: {supDbInfo.nit}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {supDbInfo?.contact_name ? `Contacto: ${supDbInfo.contact_name} · ` : ''}
                            {supDbInfo?.phone ? `Tel: ${supDbInfo.phone} · ` : ''}
                            Categoría: {supDbInfo?.category || 'General'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {existingOrder ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300">
                                {existingOrder.order_code}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                STATUS_ORDER_LABELS[existingOrder.status]?.badge || 'bg-blue-100 text-blue-900'
                              }`}>
                                {STATUS_ORDER_LABELS[existingOrder.status]?.label || existingOrder.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDownloadOrderPdf(existingOrder)}
                                disabled={downloadingOrderId === existingOrder.id}
                                className="btn bg-white hover:bg-gray-100 border border-border text-[11px] px-2.5 py-1 rounded-lg text-text-primary shadow-xs font-semibold inline-flex items-center gap-1 cursor-pointer ml-1"
                                title="Descargar PDF Oficial de esta Orden"
                              >
                                <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                                PDF
                              </button>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              Pendiente por Emitir OC
                            </span>
                          )}
                          <span className="font-mono font-extrabold text-sm text-text-primary">
                            {formatCOP(existingOrder ? Number(existingOrder.total_amount) : group.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Tabla de ítems de este proveedor */}
                      <div className="p-4 space-y-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-[10px] uppercase font-bold text-text-muted border-b border-border bg-slate-50/50">
                              <tr>
                                <th className="py-2 px-3">#</th>
                                <th className="py-2 px-3">Descripción</th>
                                <th className="py-2 px-3 text-center">Cant.</th>
                                <th className="py-2 px-3 text-right">Vlr. Unitario</th>
                                <th className="py-2 px-3 text-right">Subtotal</th>
                                <th className="py-2 px-3 text-center">Fecha Entrega</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {group.items.map((it, idx) => {
                                const selOpt = it.quotations?.find((q) => q.is_selected) || it.quotations?.[0];
                                const uPrice =
                                  typeof selOpt?.unit_price === 'number'
                                    ? selOpt.unit_price
                                    : Number(selOpt?.unit_price) || Number(it.unit_price) || 0;
                                const qty = Number(it.quantity) || 1;
                                const sub = qty * uPrice;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-2 px-3 font-mono text-[11px] text-text-muted">{it.item_no || idx + 1}</td>
                                    <td className="py-2 px-3 font-medium text-text-primary">{it.description}</td>
                                    <td className="py-2 px-3 text-center font-mono whitespace-nowrap">
                                      {qty} {it.unit || 'Und'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-text-secondary whitespace-nowrap">
                                      {formatCOP(uPrice)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-text-primary whitespace-nowrap">
                                      {formatCOP(sub)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono text-[11px] text-text-muted whitespace-nowrap">
                                      {selOpt?.delivery_date || orderIssuingRequest.delivery_date || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* CASO 1: ORDEN YA FORMALIZADA — GESTIÓN DE SEGUIMIENTO HASTA LA ENTREGA */}
                        {existingOrder ? (
                          <div className="mt-3 pt-3 border-t border-border bg-slate-50/60 rounded-xl p-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <h6 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-accent" />
                                  Seguimiento de Entrega ({existingOrder.order_code})
                                </h6>
                                <p className="text-[11px] text-text-muted mt-0.5">
                                  Plazo de Entrega: <strong className="font-mono text-text-primary">{existingOrder.delivery_deadline || 'No fijado'}</strong> ·
                                  Condiciones: <span className="font-medium">{existingOrder.payment_terms || 'Contado'}</span>
                                </p>
                              </div>

                              {/* Barra de progreso de etapas */}
                              <div className="flex items-center gap-1 text-[10px] font-bold">
                                {['issued', 'confirmed', 'in_transit', 'completed'].map((stKey, sIdx) => {
                                  const stageNames: Record<string, string> = {
                                    issued: '1. Emitida',
                                    confirmed: '2. Confirmada',
                                    in_transit: '3. En Despacho',
                                    completed: '4. Recibida',
                                  };
                                  const isCurrent = existingOrder.status === stKey;
                                  const isPast =
                                    ['issued', 'confirmed', 'in_transit', 'completed'].indexOf(existingOrder.status) >= sIdx;
                                  return (
                                    <span
                                      key={stKey}
                                      className={`px-2 py-0.5 rounded-full border ${
                                        isCurrent
                                          ? 'bg-accent text-primary-900 border-accent font-extrabold shadow-2xs'
                                          : isPast
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                          : 'bg-gray-100 text-gray-400 border-gray-200'
                                      }`}
                                    >
                                      {stageNames[stKey]}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Controles interactivos para cambiar estado de entrega */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 items-end">
                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Cambiar Estado de Entrega
                                </label>
                                <select
                                  value={trackingForm.status}
                                  onChange={(e) =>
                                    setTrackingStatusForm((prev) => ({
                                      ...prev,
                                      [existingOrder.id]: {
                                        ...trackingForm,
                                        status: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full text-xs rounded border border-border bg-white px-2.5 py-1.5 text-text-primary font-semibold focus:ring-1 focus:ring-accent"
                                >
                                  <option value="issued">Emitida (Esperando confirmación)</option>
                                  <option value="confirmed">Confirmada por Proveedor / En Preparación</option>
                                  <option value="in_transit">En Tránsito / Despachada a Obra</option>
                                  <option value="partially_received">Entrega Parcial Recibida</option>
                                  <option value="completed">Entregada y Recibida a Satisfacción</option>
                                  <option value="cancelled">Orden Anulada / Cancelada</option>
                                </select>
                              </div>

                              <div className="sm:col-span-5">
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Nota de Entrega / Guía de Transporte
                                </label>
                                <input
                                  type="text"
                                  value={trackingForm.note}
                                  onChange={(e) =>
                                    setTrackingStatusForm((prev) => ({
                                      ...prev,
                                      [existingOrder.id]: {
                                        ...trackingForm,
                                        note: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Ej: Guía Servientrega 109283 - Camión NPR"
                                  className="w-full text-xs rounded border border-border bg-white px-2.5 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(existingOrder.id)}
                                  disabled={trackingForm.isSubmitting}
                                  className="w-full btn bg-primary-900 text-white hover:bg-black font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                                >
                                  {trackingForm.isSubmitting ? (
                                    <span>Actualizando...</span>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-accent" />
                                      <span>Actualizar Estado</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Historial de Trazabilidad */}
                            {Array.isArray(existingOrder.tracking_history) && existingOrder.tracking_history.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/60">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTrackingOrderIds((prev) => ({
                                      ...prev,
                                      [existingOrder.id]: !prev[existingOrder.id],
                                    }))
                                  }
                                  className="text-[11px] font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer"
                                >
                                  {expandedTrackingOrderIds[existingOrder.id] ? (
                                    <ChevronDown className="w-3 h-3 text-accent" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-accent" />
                                  )}
                                  <span>Historial de Seguimiento ({existingOrder.tracking_history.length} eventos)</span>
                                </button>

                                {expandedTrackingOrderIds[existingOrder.id] && (
                                  <div className="mt-2 space-y-1.5 text-[11px] pl-3 border-l-2 border-accent">
                                    {existingOrder.tracking_history.map((ev, evIdx) => (
                                      <div key={evIdx} className="bg-white p-2 rounded border border-border/60">
                                        <div className="flex items-center justify-between text-[10px] text-text-muted">
                                          <span className="font-bold text-text-primary">{ev.user_name}</span>
                                          <span className="font-mono">{ev.formatted_date || ev.timestamp}</span>
                                        </div>
                                        <p className="text-text-secondary mt-0.5">{ev.note}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* CASO 2: FORMULARIO PARA EMITIR LA ORDEN DE COMPRA */
                          <div className="mt-3 pt-3 border-t border-border bg-amber-50/30 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                              <h6 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-accent" />
                                Parámetros Comerciales para Emitir OC
                              </h6>
                              <span className="text-[10px] text-text-muted">
                                Consecutivo Sugerido: <strong className="font-mono text-primary">{formVals.order_code}</strong>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                              <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Código de OC
                                </label>
                                <input
                                  type="text"
                                  value={formVals.order_code}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: { ...formVals, order_code: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs font-mono font-bold rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Condiciones de Pago
                                </label>
                                <select
                                  value={formVals.payment_terms}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: { ...formVals, payment_terms: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                >
                                  <option value="Contado">Contado contra Entrega</option>
                                  <option value="Crédito 15 días">Crédito a 15 días</option>
                                  <option value="Crédito 30 días">Crédito a 30 días</option>
                                  <option value="Anticipo 50% - Saldo contra Entrega">50% Anticipo - 50% Saldo</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Fecha Pactada de Entrega
                                </label>
                                <input
                                  type="date"
                                  value={formVals.delivery_deadline}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: { ...formVals, delivery_deadline: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs font-mono rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Lugar de Entrega
                                </label>
                                <input
                                  type="text"
                                  value={formVals.delivery_site}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: { ...formVals, delivery_site: e.target.value },
                                    }))
                                  }
                                  placeholder="Bodega / Frente de obra"
                                  className="w-full text-xs rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                                  Observaciones y Términos de Garantía
                                </label>
                                <input
                                  type="text"
                                  value={formVals.notes}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: { ...formVals, notes: e.target.value },
                                    }))
                                  }
                                  placeholder="Garantía, persona que recibe en obra, especificaciones de descargue..."
                                  className="w-full text-xs rounded border border-border bg-white px-2 py-1 text-text-primary focus:ring-1 focus:ring-accent"
                                />
                              </div>
                            </div>

                            {/* Casilla de Enviar por Correo al Proveedor */}
                            <div className="bg-white/90 p-3 rounded-xl border border-border space-y-2 shadow-2xs">
                              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={formVals.send_email_to_supplier ?? Boolean(supDbInfo?.email)}
                                  onChange={(e) =>
                                    setOrderForms((prev) => ({
                                      ...prev,
                                      [sName]: {
                                        ...(prev[sName] || formVals),
                                        send_email_to_supplier: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="w-4 h-4 rounded text-accent focus:ring-accent border-gray-300 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                  <Mail className="w-4 h-4 text-accent" />
                                  Enviar Orden de Compra oficial por correo al proveedor una vez emitida
                                </span>
                              </label>

                              {(formVals.send_email_to_supplier ?? Boolean(supDbInfo?.email)) && (
                                <div className="pl-6.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs pt-1">
                                  <span className="text-[11px] font-semibold text-text-muted whitespace-nowrap">
                                    Correo destinatario:
                                  </span>
                                  <input
                                    type="email"
                                    value={formVals.supplier_email ?? supDbInfo?.email ?? ''}
                                    onChange={(e) =>
                                      setOrderForms((prev) => ({
                                        ...prev,
                                        [sName]: {
                                          ...(prev[sName] || formVals),
                                          supplier_email: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="ejemplo@proveedor.com"
                                    className="w-full sm:w-80 text-xs font-mono py-1 px-2.5 rounded-lg border border-border bg-white text-text-primary focus:ring-1 focus:ring-accent"
                                  />
                                  {supDbInfo?.email ? (
                                    <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Registrado en directorio
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-800 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Ingresa el correo para notificación
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {formVals.successMsg && (
                              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 p-2 rounded-lg">
                                {formVals.successMsg}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs font-semibold text-text-muted">
                                Monto total de esta OC:{' '}
                                <strong className="font-mono text-sm text-primary-900 font-extrabold">
                                  {formatCOP(group.totalAmount)}
                                </strong>
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  handleIssueOrderForSupplier(
                                    orderIssuingRequest,
                                    sName,
                                    group.items,
                                    group.totalAmount
                                  )
                                }
                                disabled={formVals.isSubmitting}
                                className="btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                {formVals.isSubmitting ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                                    <span>Emitiendo Orden...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Emitir Orden de Compra para {sName}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botón de cierre */}
              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setOrderIssuingRequest(null)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ────────────────────────────────────────────────────────────────────
          MODAL FLOTANTE: ÓRDENES DE COMPRA FORMALIZADAS DEL REQUERIMIENTO
         ──────────────────────────────────────────────────────────────────── */}
      {activeGroupOrders && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border max-w-5xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300">
                    {activeGroupOrders.requestCode}
                  </span>
                  <span className="text-xs text-text-muted uppercase font-bold tracking-wider">
                    Órdenes de Compra Formalizadas (Emitidas)
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary mt-1">
                  {activeGroupOrders.projectName}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {activeGroupOrders.clientName ? `Cliente: ${activeGroupOrders.clientName} · ` : ''}
                  Centro de Costo: <span className="font-mono">{activeGroupOrders.costCenter}</span> · Solicitante: {activeGroupOrders.applicantName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestGroupId(null)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Resumen y métricas del requerimiento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-border rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-text-muted block text-[11px]">Órdenes Emitidas:</span>
                <span className="font-mono font-bold text-sm text-text-primary mt-0.5 block">
                  {activeGroupOrders.ordersCount} emitidas
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Órdenes Entregadas:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`font-mono font-bold text-sm ${activeGroupOrders.deliveredCount === activeGroupOrders.ordersCount ? 'text-emerald-700' : 'text-primary-900'}`}>
                    {activeGroupOrders.deliveredCount} de {activeGroupOrders.ordersCount}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    activeGroupOrders.deliveredCount === activeGroupOrders.ordersCount
                      ? 'bg-emerald-100 text-emerald-900'
                      : activeGroupOrders.deliveredCount > 0
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-200 text-slate-800'
                  }`}>
                    {activeGroupOrders.ordersCount > 0 ? Math.round((activeGroupOrders.deliveredCount / activeGroupOrders.ordersCount) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Monto Total OCs:</span>
                <span className="font-mono font-extrabold text-sm text-primary-900 mt-0.5 block">
                  {formatCOP(activeGroupOrders.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px]">Estado General:</span>
                <span className="mt-1 inline-block">
                  {activeGroupOrders.ordersCount > 0 && activeGroupOrders.deliveredCount === activeGroupOrders.ordersCount ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      100% Entregado
                    </span>
                  ) : activeGroupOrders.deliveredCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Entrega Parcial ({activeGroupOrders.deliveredCount}/{activeGroupOrders.ordersCount})
                    </span>
                  ) : activeGroupOrders.inTransitCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                      En Tránsito / Despacho
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      Emitida (Pendiente Entrega)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Tabla Detallada de Órdenes de Compra Formalizadas */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Proyecto</th>
                    <th className="py-3 px-4">Monto Total</th>
                    <th className="py-3 px-4">Plazo Entrega</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeGroupOrders.orders.map((o) => {
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
                            {o.projects?.cost_center || activeGroupOrders.costCenter || 'General'}
                          </span>
                          <p className="text-xs text-text-muted truncate max-w-[140px]">
                            {o.projects?.name || activeGroupOrders.projectName || 'Administración'}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                          {formatCOP(Number(o.total_amount) || 0)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {o.delivery_deadline ? new Date(o.delivery_deadline).toLocaleDateString('es-CO') : 'Inmediata'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadOrderPdf(o)}
                            disabled={downloadingOrderId === o.id}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-text-secondary transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Descargar Orden de Compra Oficial (PDF) para enviar al proveedor"
                          >
                            <Download className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                            <span className="font-semibold text-[11px] text-text-primary">PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="btn bg-white hover:bg-gray-50 border border-border text-xs px-2.5 py-1.5 rounded-lg text-text-primary shadow-xs font-semibold cursor-pointer"
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

            {/* Footer */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                {activeGroupOrders.request && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeGroupOrders.request) {
                        handleOpenDetail(activeGroupOrders.request);
                      }
                    }}
                    className="text-primary-900 font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    Ver Expediente Completo de Solicitud ({activeGroupOrders.requestCode})
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestGroupId(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors cursor-pointer self-end"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          MODAL RÁPIDO: REGISTRO DE PROVEEDOR EN CATÁLOGO
         ──────────────────────────────────────────────────────────────────── */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent text-primary-900 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Registrar Nuevo Proveedor</h3>
                  <p className="text-[11px] text-text-muted">Inscripción rápida para cotización y compras</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSupplierModal(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                  Razón Social / Nombre Comercial <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  placeholder="Ej: Cantera del Norte SAS"
                  className="w-full text-xs rounded border border-border bg-white px-2.5 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                    NIT / RUT <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSupplierNit}
                    onChange={(e) => setQuickSupplierNit(e.target.value)}
                    placeholder="900.123.456-1"
                    className="w-full text-xs font-mono rounded border border-border bg-white px-2.5 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={quickSupplierPhone}
                    onChange={(e) => setQuickSupplierPhone(e.target.value)}
                    placeholder="300 123 4567"
                    className="w-full text-xs font-mono rounded border border-border bg-white px-2.5 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={quickSupplierContact}
                  onChange={(e) => setQuickSupplierContact(e.target.value)}
                  placeholder="Ej: Ing. Pedro Gómez"
                  className="w-full text-xs rounded border border-border bg-white px-2.5 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                    Categoría
                  </label>
                  <select
                    value={quickSupplierCategory}
                    onChange={(e) => setQuickSupplierCategory(e.target.value)}
                    className="w-full text-xs rounded border border-border bg-white px-2 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                  >
                    <option value="Materiales Pétreos y Áridos">Materiales Pétreos</option>
                    <option value="Cementos y Concretos">Cementos y Concretos</option>
                    <option value="Ferretería y Tornillería">Ferretería</option>
                    <option value="Equipos y Andamiaje">Equipos y Andamiaje</option>
                    <option value="Transporte y Logística">Transporte</option>
                    <option value="Servicios Especializados">Servicios Especializados</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                    Condiciones de Pago
                  </label>
                  <select
                    value={quickSupplierPayment}
                    onChange={(e) => setQuickSupplierPayment(e.target.value)}
                    className="w-full text-xs rounded border border-border bg-white px-2 py-1.5 text-text-primary focus:ring-1 focus:ring-accent"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Crédito 15 días">Crédito 15 días</option>
                    <option value="Crédito 30 días">Crédito 30 días</option>
                    <option value="Anticipo 50% - Saldo">50% Anticipo - 50% Saldo</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/forms/registro-proveedor"
                  className="text-[11px] text-accent font-semibold hover:underline"
                  target="_blank"
                >
                  Formulario Completo (FOR-COM-004) →
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplierModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-gray-50 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuickSupplier}
                    className="btn bg-accent text-primary-900 font-bold hover:brightness-105 text-xs px-4 py-1.5 rounded-lg shadow-xs cursor-pointer"
                  >
                    {isSavingQuickSupplier ? 'Guardando...' : 'Guardar Proveedor'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ────────────────────────────────────────────────────────────────────
          MODAL: EVALUACIÓN DE DESEMPEÑO DE PROVEEDOR (ISO 9001 / SIG)
         ──────────────────────────────────────────────────────────────────── */}
      {evaluatingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] animate-fade-in overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-border max-w-xl w-full p-6 space-y-4 shadow-2xl my-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent/20 text-primary-900 border border-accent/40">
                    {evaluatingOrder.order_code}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Evaluación ISO 9001 / FOR-COM-005
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary mt-1">
                  Calificación de Desempeño: {evaluatingOrder.supplier_name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Proyecto: {evaluatingOrder.projects?.name || 'Operación General'} · Monto OC: {formatCOP(Number(evaluatingOrder.total_amount) || 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingOrder(null)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-4 text-xs">
              {/* Criterio 1: Calidad */}
              <div className="bg-slate-50 p-3 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-text-primary text-xs block">
                      1. Calidad de los Bienes e Insumos
                    </label>
                    <span className="text-[11px] text-text-muted">
                      Conformidad técnica, empaque y estado físico recibido.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-accent">
                    {evalQuality} / 5
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEvalQuality(val)}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        evalQuality === val
                          ? 'bg-accent text-primary-900 ring-2 ring-accent shadow-xs'
                          : 'bg-white border border-border text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Criterio 2: Tiempos de Entrega */}
              <div className="bg-slate-50 p-3 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-text-primary text-xs block">
                      2. Puntualidad en Tiempos de Entrega
                    </label>
                    <span className="text-[11px] text-text-muted">
                      Cumplimiento de la fecha y hora pactada en la orden.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-accent">
                    {evalDelivery} / 5
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEvalDelivery(val)}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        evalDelivery === val
                          ? 'bg-accent text-primary-900 ring-2 ring-accent shadow-xs'
                          : 'bg-white border border-border text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Criterio 3: Servicio y Atención */}
              <div className="bg-slate-50 p-3 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-text-primary text-xs block">
                      3. Servicio, Garantía y Soporte Comercial
                    </label>
                    <span className="text-[11px] text-text-muted">
                      Disposición del asesor, resolución de dudas y respuesta.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-accent">
                    {evalService} / 5
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEvalService(val)}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        evalService === val
                          ? 'bg-accent text-primary-900 ring-2 ring-accent shadow-xs'
                          : 'bg-white border border-border text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Promedio General */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-amber-900 block">
                    Calificación General Ponderada
                  </span>
                  <span className="text-xs text-amber-800">
                    {((evalQuality + evalDelivery + evalService) / 3) >= 4.0
                      ? 'Proveedor Conforme (Recomendado)'
                      : ((evalQuality + evalDelivery + evalService) / 3) >= 3.0
                      ? 'Desempeño Aceptable con Observaciones'
                      : 'No Conforme (Requiere Plan de Acción)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span className="font-mono font-extrabold text-lg text-amber-950">
                    {(((evalQuality + evalDelivery + evalService) / 3)).toFixed(1)} / 5
                  </span>
                </div>
              </div>

              {/* Recomendación */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-border">
                <span className="font-semibold text-text-primary text-xs">
                  ¿Recomienda a este proveedor para futuras adquisiciones?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEvalRecommend(true)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      evalRecommend
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvalRecommend(false)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      !evalRecommend
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Comentarios */}
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-0.5">
                  Observaciones y Comentarios de Auditoría HSEQ / Almacén
                </label>
                <textarea
                  rows={2}
                  value={evalComments}
                  onChange={(e) => setEvalComments(e.target.value)}
                  placeholder="Detalles de la entrega, novedades o recomendaciones..."
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              {evalSuccessMsg && (
                <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg text-center">
                  {evalSuccessMsg}
                </p>
              )}

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEvaluatingOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-primary transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs px-5 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEval ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Registrar Evaluación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
