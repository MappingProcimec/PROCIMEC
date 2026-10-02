'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  MapPin,
  Phone,
  FileText,
  RotateCcw,
  Download,
} from 'lucide-react';
import { downloadPurchaseRequestPdf } from '@/lib/purchasing/purchaseRequestPdfGenerator';

interface ProjectOption {
  id: string;
  name: string;
  cost_center: string;
  client: string;
}

interface ItemRow {
  id: string;
  item_no: number;
  quantity: number | '';
  unit: string;
  description: string;
  client_quote_no: string;
  brand: string;
  suggested_supplier: string;
  unit_price: number | '';
}

const UNIT_OPTIONS = [
  { value: 'Und', label: 'Und (Unidad)' },
  { value: 'Glb', label: 'Glb (Global)' },
  { value: 'M', label: 'M (Metro lineal)' },
  { value: 'M2', label: 'M² (Metro cuadrado)' },
  { value: 'M3', label: 'M³ (Metro cúbico)' },
  { value: 'Kg', label: 'Kg (Kilogramo)' },
  { value: 'Ton', label: 'Ton (Tonelada)' },
  { value: 'Gal', label: 'Gal (Galón)' },
  { value: 'Lt', label: 'Lt (Litro)' },
  { value: 'Pza', label: 'Pza (Pieza)' },
  { value: 'Rollo', label: 'Rollo' },
  { value: 'Caja', label: 'Caja' },
  { value: 'Paquete', label: 'Paquete' },
  { value: 'Par', label: 'Par' },
  { value: 'Kit', label: 'Kit' },
  { value: 'Dia', label: 'Día' },
  { value: 'Mes', label: 'Mes' },
  { value: 'Serv', label: 'Servicio' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RequerimientoCompraPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Estados de carga e inicialización
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    requestCode: string;
    consecutive: number;
    totalAmount: number;
    projectName: string;
    clientName: string;
    costCenter: string;
    applicantName: string;
    approverName: string;
    deliveryDate: string;
    deliverySite: string;
    contactPhone: string;
    items: ItemRow[];
  } | null>(null);

  // Datos base del formulario
  const [consecutive, setConsecutive] = useState<number>(1);
  const [requestCode, setRequestCode] = useState<string>('REQ-0001');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [todayDate, setTodayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Campos de cabecera
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [applicantName, setApplicantName] = useState<string>('');
  const [approverName, setApproverName] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliverySite, setDeliverySite] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');

  // Filas de la tabla de ítems
  const [items, setItems] = useState<ItemRow[]>([
    {
      id: 'row-1',
      item_no: 1,
      quantity: 1,
      unit: 'Und',
      description: '',
      client_quote_no: '',
      brand: '',
      suggested_supplier: '',
      unit_price: '',
    },
  ]);

  // Cargar datos iniciales desde el endpoint (esperar a que status no sea 'loading')
  useEffect(() => {
    if (status === 'loading') return;

    async function loadFormData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        // Consultar endpoint del formulario y endpoint oficial de proyectos en paralelo
        const [formRes, projectsRes] = await Promise.allSettled([
          fetch('/api/forms/requerimiento-compra').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/projects').then((r) => (r.ok ? r.json() : null)),
        ]);

        const formData = formRes.status === 'fulfilled' ? formRes.value : null;
        const projectsData = projectsRes.status === 'fulfilled' ? projectsRes.value : null;

        if (formData?.success) {
          setConsecutive(formData.nextConsecutive || 1);
          setRequestCode(formData.requestCode || `REQ-${String(formData.nextConsecutive || 1).padStart(4, '0')}`);
          if (formData.today) setTodayDate(formData.today);
          if (formData.user?.full_name) {
            setApplicantName(formData.user.full_name);
          } else if (session?.user?.name) {
            setApplicantName(session.user.name);
          }
        } else if (session?.user?.name) {
          setApplicantName(session.user.name);
        }

        // Obtener proyectos: preferir los asignados devueltos por /api/projects o por el form endpoint
        let resolvedProjects: ProjectOption[] = [];
        if (Array.isArray(projectsData?.data) && projectsData.data.length > 0) {
          resolvedProjects = projectsData.data.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: (p.name as string) || '',
            cost_center: String(p.cost_center || '').trim(),
            client: String(p.client || '').trim(),
          }));
        } else if (Array.isArray(formData?.projects) && formData.projects.length > 0) {
          resolvedProjects = formData.projects;
        }

        setProjects(resolvedProjects);

        // Si solo hay un proyecto asignado, pre-seleccionarlo
        if (resolvedProjects.length === 1) {
          setSelectedProjectId(resolvedProjects[0].id);
        }
      } catch (err) {
        console.error('Error inicializando formulario:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Error al cargar los datos del requerimiento.');
      } finally {
        setIsLoading(false);
      }
    }

    loadFormData();
  }, [status, session?.user?.email]);

  // Proyecto seleccionado actualmente
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Manejo de ítems en la tabla
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length + 1}`,
        item_no: prev.length + 1,
        quantity: 1,
        unit: 'Und',
        description: '',
        client_quote_no: '',
        brand: '',
        suggested_supplier: '',
        unit_price: '',
      },
    ]);
  };

  const handleRemoveItem = (indexToRemove: number) => {
    if (items.length <= 1) return;
    setItems((prev) => {
      const filtered = prev.filter((_, idx) => idx !== indexToRemove);
      return filtered.map((row, idx) => ({
        ...row,
        item_no: idx + 1,
      }));
    });
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: unknown) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // Cálculo de totales
  const itemsWithTotal = useMemo(() => {
    return items.map((it) => {
      const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity) || 0;
      const price = typeof it.unit_price === 'number' ? it.unit_price : Number(it.unit_price) || 0;
      const lineTotal = qty * price;
      return {
        ...it,
        calculatedTotal: lineTotal,
      };
    });
  }, [items]);

  const grandTotal = useMemo(() => {
    return itemsWithTotal.reduce((acc, it) => acc + it.calculatedTotal, 0);
  }, [itemsWithTotal]);

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validaciones
    if (!selectedProjectId) {
      setErrorMessage('Debe seleccionar el proyecto destino de los insumos.');
      return;
    }

    if (!applicantName.trim()) {
      setErrorMessage('El nombre del solicitante es obligatorio.');
      return;
    }

    if (!approverName.trim()) {
      setErrorMessage('Debe indicar el nombre de la persona que aprueba el requerimiento.');
      return;
    }

    if (!deliveryDate) {
      setErrorMessage('Debe especificar la fecha requerida de entrega.');
      return;
    }

    if (!deliverySite.trim()) {
      setErrorMessage('Debe indicar el sitio físico de entrega.');
      return;
    }

    if (!contactPhone.trim()) {
      setErrorMessage('Debe ingresar un número de contacto / teléfono en sitio.');
      return;
    }

    // Validar ítems
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setErrorMessage(`Por favor completa la descripción del ítem #${i + 1}.`);
        return;
      }
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        setErrorMessage(`La cantidad del ítem #${i + 1} debe ser mayor a 0.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        project_id: selectedProjectId,
        cost_center: selectedProject?.cost_center || '',
        project_name: selectedProject?.name || '',
        client_name: selectedProject?.client || '',
        applicant_name: applicantName.trim(),
        approver_name: approverName.trim(),
        delivery_date: deliveryDate,
        delivery_site: deliverySite.trim(),
        contact_phone: contactPhone.trim(),
        items: itemsWithTotal.map((it) => ({
          item_no: it.item_no,
          quantity: Number(it.quantity) || 1,
          unit: it.unit,
          description: it.description.trim(),
          client_quote_no: it.client_quote_no.trim(),
          brand: it.brand.trim(),
          suggested_supplier: it.suggested_supplier.trim(),
          unit_price: Number(it.unit_price) || 0,
          total: it.calculatedTotal,
        })),
      };

      const res = await fetch('/api/forms/requerimiento-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar la solicitud de requerimiento.');
      }

      setSubmittedData({
        requestCode: json.request_code || requestCode,
        consecutive: json.consecutive || consecutive,
        totalAmount: grandTotal,
        projectName: selectedProject?.name || 'Proyecto Asignado',
        clientName: selectedProject?.client || 'Cliente Corporativo',
        costCenter: selectedProject?.cost_center || '',
        applicantName: applicantName.trim(),
        approverName: approverName.trim(),
        deliveryDate: deliveryDate,
        deliverySite: deliverySite.trim(),
        contactPhone: contactPhone.trim(),
        items: [...items],
      });
      setIsSuccess(true);
    } catch (err) {
      console.error('Error enviando formulario:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error de comunicación con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejo de descarga del PDF oficial tras guardar
  const handleDownloadOfficialPdf = () => {
    if (!submittedData) return;
    try {
      setIsGeneratingPdf(true);
      downloadPurchaseRequestPdf({
        requestCode: submittedData.requestCode,
        consecutive: submittedData.consecutive,
        createdDate: todayDate,
        projectName: submittedData.projectName,
        costCenter: submittedData.costCenter,
        clientName: submittedData.clientName,
        applicantName: submittedData.applicantName,
        approverName: submittedData.approverName,
        deliveryDate: submittedData.deliveryDate,
        deliverySite: submittedData.deliverySite,
        contactPhone: submittedData.contactPhone,
        items: submittedData.items.map((it) => ({
          item_no: it.item_no,
          quantity: it.quantity,
          unit: it.unit,
          description: it.description,
          client_quote_no: it.client_quote_no,
          brand: it.brand,
          suggested_supplier: it.suggested_supplier,
          unit_price: it.unit_price,
          total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        })),
        totalAmount: submittedData.totalAmount,
        status: 'pending',
      });
    } catch (err) {
      console.error('Error al generar PDF oficial:', err);
      alert('Ocurrió un error al generar la descarga del PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Manejo de descarga del PDF directamente desde el formulario activo (Borrador/Previo)
  const handleDownloadDraftPdf = () => {
    if (!selectedProjectId) {
      setErrorMessage('Selecciona primero el proyecto destino para generar el PDF.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      downloadPurchaseRequestPdf({
        requestCode: requestCode || `REQ-${String(consecutive).padStart(4, '0')}`,
        consecutive: consecutive,
        createdDate: todayDate,
        projectName: selectedProject?.name || 'Proyecto Seleccionado',
        costCenter: selectedProject?.cost_center || '',
        clientName: selectedProject?.client || '',
        applicantName: applicantName.trim() || 'Solicitante',
        approverName: approverName.trim() || 'Por definir',
        deliveryDate: deliveryDate || todayDate,
        deliverySite: deliverySite.trim() || 'Por definir',
        contactPhone: contactPhone.trim() || 'Por definir',
        items: itemsWithTotal.map((it) => ({
          item_no: it.item_no,
          quantity: it.quantity,
          unit: it.unit,
          description: it.description || 'Ítem sin descripción',
          client_quote_no: it.client_quote_no,
          brand: it.brand,
          suggested_supplier: it.suggested_supplier,
          unit_price: it.unit_price,
          total: it.calculatedTotal,
        })),
        totalAmount: grandTotal,
        status: 'draft',
      });
    } catch (err) {
      console.error('Error al generar PDF preliminar:', err);
      setErrorMessage('No se pudo generar la descarga del documento PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Pantalla de éxito
  if (isSuccess && submittedData) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <Navbar />
        <div className="page-hero">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
              <ShoppingCart className="w-7 h-7 text-accent" strokeWidth={1.75} />
              Solicitud de Requerimiento Registrada
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Tu requerimiento ha sido capturado con consecutivo oficial y enviado al área de Compras.
            </p>
          </div>
        </div>

        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-accent/15 text-accent-700 border border-accent/30 inline-block mb-3">
              {submittedData.requestCode}
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              Solicitud Guardada Exitosamente
            </h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
              El requerimiento fue registrado bajo el consecutivo secuencial{' '}
              <strong className="text-text-primary font-mono font-semibold">#{String(submittedData.consecutive).padStart(4, '0')}</strong> e integrado al flujo de adquisiciones de PCM CLOUD.
            </p>

            {/* Resumen técnico */}
            <div className="bg-surface-secondary border border-border rounded-lg p-4 text-left max-w-lg mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-muted block">Proyecto:</span>
                <span className="font-semibold text-text-primary">{submittedData.projectName}</span>
              </div>
              <div>
                <span className="text-text-muted block">Cliente:</span>
                <span className="font-semibold text-text-primary">{submittedData.clientName}</span>
              </div>
              <div>
                <span className="text-text-muted block">Fecha de Registro:</span>
                <span className="font-mono text-text-primary">{todayDate}</span>
              </div>
              <div>
                <span className="text-text-muted block">Valor Total Estimado:</span>
                <span className="font-mono font-bold text-accent-800 text-sm">
                  {formatCurrency(submittedData.totalAmount)}
                </span>
              </div>
            </div>

            {/* Acciones canónicas con descarga de PDF oficial */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadOfficialPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto btn bg-accent text-primary-900 font-bold hover:bg-accent-400 focus:ring-accent shadow-sm px-6 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-primary-900 stroke-[2.5]" />
                {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF de la Solicitud'}
              </button>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto btn bg-white text-text-primary border border-border hover:bg-gray-50 text-sm px-5 py-2.5 rounded-lg text-center"
              >
                Volver a Mi Panel
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setSubmittedData(null);
                  setDeliveryDate('');
                  setDeliverySite('');
                  setItems([
                    {
                      id: `row-${Date.now()}`,
                      item_no: 1,
                      quantity: 1,
                      unit: 'Und',
                      description: '',
                      client_quote_no: '',
                      brand: '',
                      suggested_supplier: '',
                      unit_price: '',
                    },
                  ]);
                }}
                className="w-full sm:w-auto btn bg-white text-text-primary border border-border hover:bg-gray-50 text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-text-muted" />
                Registrar Otra Solicitud
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico Sobrio PROCIMEC */}
      <div className="page-hero">
        <div className="max-w-7xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-accent" strokeWidth={1.75} />
            Solicitud de Requerimiento
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Solicitud formal de insumos, herramientas y servicios requeridos para operaciones de campo u oficina.
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {isLoading ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-card">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-muted text-sm font-medium">Cargando datos del requerimiento y proyectos autorizados...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tarjeta de Datos de Cabecera */}
            <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-5">
              {/* Errores globales */}
              {errorMessage && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm flex items-start gap-2.5 animate-fadeIn">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Bloque 1: Proyecto, Centro de Costos y Cliente */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  Imputación de Proyecto y Centro de Costos
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Selector de Proyecto Habilitado */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Proyecto Destino <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required
                      className="w-full text-sm rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">-- Selecciona el proyecto --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cost_center ? `[${p.cost_center}] ` : ''}{p.name}
                        </option>
                      ))}
                    </select>
                    {projects.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        No tienes proyectos asignados actualmente. Contacta al Administrador.
                      </p>
                    )}
                  </div>

                  {/* Centro de Costo (Auto-llenado del proyecto) */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Centro de Costo
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={selectedProject?.cost_center || 'Sin CC asignado'}
                      className="w-full text-sm rounded-lg border border-border bg-gray-50 px-3 py-2 text-text-primary font-mono font-semibold cursor-not-allowed"
                      placeholder="Auto-completado"
                    />
                  </div>

                  {/* Cliente (Auto-llenado del proyecto) */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Cliente del Proyecto
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={selectedProject?.client || 'No especificado'}
                      className="w-full text-sm rounded-lg border border-border bg-gray-50 px-3 py-2 text-text-primary font-medium cursor-not-allowed"
                      placeholder="Auto-completado"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 2: Solicitante, Aprobador, Entrega y Contacto */}
              <div className="pt-2 border-t border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" />
                  Responsables y Datos de Entrega en Sitio
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Nombre del Solicitante */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Nombre del Solicitante <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Nombre y apellido"
                      className="w-full text-sm rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  {/* Nombre de quien aprueba */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Nombre Quien Aprueba <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="Ej: Residente / Director de Obra"
                      className="w-full text-sm rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  {/* Fecha de Entrega */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Fecha de Entrega Requerida <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full text-sm rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    />
                  </div>

                  {/* Contacto / Teléfono */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Contacto / Teléfono <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Ej: 310 123 4567"
                        className="w-full text-sm rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Sitio de Entrega (Ocupa 2 columnas o ancho completo) */}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Sitio Físico de Entrega <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={deliverySite}
                        onChange={(e) => setDeliverySite(e.target.value)}
                        placeholder="Dirección exacta, campamento de obra, bodega o frente de trabajo"
                        className="w-full text-sm rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta de Tabla de Ítems */}
            <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent" strokeWidth={1.75} />
                    Detalle de Bienes e Insumos Solicitados
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Especifica cada requerimiento con su cantidad, unidad de medida y precio estimado.
                  </p>
                </div>

                {/* Botón + para agregar fila */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn bg-accent text-primary-900 font-bold hover:bg-accent-400 focus:ring-accent shadow-sm inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Agregar Ítem</span>
                </button>
              </div>

              {/* Tabla de Precisión Industrial */}
              <div className="overflow-x-auto border border-border rounded-lg shadow-2xs">
                <table className="w-full text-left border-collapse min-w-[1050px]">
                  <thead>
                    <tr className="bg-primary-900 text-white text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3 w-14 text-center border-r border-primary-800">Item</th>
                      <th className="py-2.5 px-3 w-20 text-center border-r border-primary-800">Cant</th>
                      <th className="py-2.5 px-3 w-32 border-r border-primary-800">Und</th>
                      <th className="py-2.5 px-3 min-w-[240px] border-r border-primary-800">Descripción</th>
                      <th className="py-2.5 px-3 w-36 border-r border-primary-800">No Cotiz. Cliente</th>
                      <th className="py-2.5 px-3 w-32 border-r border-primary-800">Marca</th>
                      <th className="py-2.5 px-3 w-36 border-r border-primary-800">Proveedor Sugerido</th>
                      <th className="py-2.5 px-3 w-32 text-right border-r border-primary-800">Precio Unit. (COP)</th>
                      <th className="py-2.5 px-3 w-32 text-right border-r border-primary-800">TOTAL (COP)</th>
                      <th className="py-2.5 px-2 w-12 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white text-xs">
                    {itemsWithTotal.map((item, index) => (
                      <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors">
                        {/* Item consecutivo */}
                        <td className="py-2 px-2 text-center font-mono font-bold text-text-secondary bg-gray-50 border-r border-border">
                          {item.item_no}
                        </td>

                        {/* Cantidad */}
                        <td className="py-2 px-2 border-r border-border">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'quantity',
                                e.target.value === '' ? '' : parseFloat(e.target.value)
                              )
                            }
                            placeholder="1"
                            className="w-full text-xs text-center font-mono rounded border border-border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </td>

                        {/* Unidad desplegable */}
                        <td className="py-2 px-2 border-r border-border">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            className="w-full text-xs rounded border border-border bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent font-medium text-text-primary"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Descripción */}
                        <td className="py-2 px-2 border-r border-border">
                          <input
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Descripción detallada del bien o servicio..."
                            className="w-full text-xs rounded border border-border px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                          />
                        </td>

                        {/* No Cotización Cliente */}
                        <td className="py-2 px-2 border-r border-border">
                          <input
                            type="text"
                            value={item.client_quote_no}
                            onChange={(e) => handleItemChange(index, 'client_quote_no', e.target.value)}
                            placeholder="Ej: COT-2026-9"
                            className="w-full text-xs font-mono rounded border border-border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                          />
                        </td>

                        {/* Marca */}
                        <td className="py-2 px-2 border-r border-border">
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                            placeholder="Ej: GSSI / Truper"
                            className="w-full text-xs rounded border border-border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                          />
                        </td>

                        {/* Proveedor Sugerido */}
                        <td className="py-2 px-2 border-r border-border">
                          <input
                            type="text"
                            value={item.suggested_supplier}
                            onChange={(e) => handleItemChange(index, 'suggested_supplier', e.target.value)}
                            placeholder="Proveedor sugerido..."
                            className="w-full text-xs rounded border border-border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
                          />
                        </td>

                        {/* Precio Unitario COP */}
                        <td className="py-2 px-2 border-r border-border text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'unit_price',
                                e.target.value === '' ? '' : parseFloat(e.target.value)
                              )
                            }
                            placeholder="0"
                            className="w-full text-xs text-right font-mono rounded border border-border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-text-primary font-semibold"
                          />
                        </td>

                        {/* Total por Fila (Calculado automáticamente) */}
                        <td className="py-2 px-3 border-r border-border text-right font-mono font-bold text-text-primary bg-surface-secondary/30">
                          {formatCurrency(item.calculatedTotal)}
                        </td>

                        {/* Botón Eliminar Fila */}
                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            title={items.length <= 1 ? 'Se requiere al menos un ítem' : 'Eliminar ítem'}
                            className="text-text-muted hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Fila de Totalización Inferior */}
                  <tfoot>
                    <tr className="bg-primary-900 text-white border-t-2 border-primary-700">
                      <td colSpan={7} className="py-3 px-4 text-right text-xs uppercase tracking-wider font-bold">
                        Total General del Requerimiento:
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-right font-mono font-bold text-base sm:text-lg text-accent">
                        {formatCurrency(grandTotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botón secundario para agregar fila debajo de la tabla */}
              <div className="flex justify-start pt-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-accent-800 transition-colors py-1 px-2.5 rounded border border-dashed border-border hover:border-accent"
                >
                  <Plus className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                  <span>Agregar otra fila al requerimiento</span>
                </button>
              </div>
            </div>

            {/* Barra de Acciones Final */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-text-muted">
                <span className="font-semibold text-text-primary">Nota importante:</span> Al enviar esta solicitud, se registrará formalmente con su consecutivo automático y fecha oficial para la revisión del área de Compras.
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto btn bg-white text-text-primary border border-border hover:bg-gray-50 text-xs px-4 py-2.5 rounded-lg text-center"
                >
                  Cancelar
                </Link>
                <button
                  type="button"
                  onClick={handleDownloadDraftPdf}
                  disabled={isGeneratingPdf || isSubmitting}
                  className="w-full sm:w-auto btn bg-white text-text-primary border border-border hover:bg-gray-50 text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-accent" strokeWidth={2} />
                  {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto btn bg-accent text-primary-900 font-bold hover:bg-accent-400 focus:ring-accent shadow-sm inline-flex items-center justify-center gap-2 text-xs px-6 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                      <span>Guardando Solicitud...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-primary-900 stroke-[2.5]" />
                      <span>Enviar Solicitud de Requerimiento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
