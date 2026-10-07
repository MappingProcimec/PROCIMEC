'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Download,
  ArrowRight,
  Plus,
  Layers,
  Briefcase,
  Check,
  Percent,
  Clock,
  Send,
  Link as LinkIcon,
} from 'lucide-react';
import { CommercialProposal, CommercialBudget, CommercialOpportunity, Project } from '@/types';
import { generateProposalPdf } from '@/lib/commercial/commercialPdfGenerator';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function CotizacionComercialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedProposal, setSavedProposal] = useState<CommercialProposal | null>(null);

  // Listados para importación y articulación
  const [budgets, setBudgets] = useState<CommercialBudget[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingAntecedents, setLoadingAntecedents] = useState(true);

  // Campos de Formulario (Paso Único)
  const [quoteCode, setQuoteCode] = useState('COT-2026-001');
  const [clientName, setClientName] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [subtotal, setSubtotal] = useState<number | ''>('');
  const [applyTax, setApplyTax] = useState(true);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [deliveryWeeks, setDeliveryWeeks] = useState<number>(2);
  const [notes, setNotes] = useState('');

  // Vínculos opcionales (Autonomía total)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Cálculos automáticos de IVA y Total
  const subtotalNumber = Number(subtotal) || 0;
  const taxAmount = applyTax ? Math.round(subtotalNumber * 0.19) : 0;
  const totalAmount = subtotalNumber + taxAmount;

  // Cargar datos previos y parámetros de URL
  useEffect(() => {
    async function loadPipelineData() {
      try {
        setLoadingAntecedents(true);
        const res = await fetch('/api/tools/commercial-pipeline');
        if (res.ok) {
          const json = await res.json();
          const { budgets: bList = [], opportunities: oList = [], proposals: pList = [], projects: prjList = [] } = json.data || {};
          setBudgets(bList);
          setOpportunities(oList);
          setProjects(prjList);

          // Generar código consecutivo sugerido
          const year = new Date().getFullYear();
          const nextNum = (pList.length || 0) + 1;
          setQuoteCode(`COT-${year}-${String(nextNum).padStart(3, '0')}`);

          // Si vienen parámetros en URL
          const qBudgetId = searchParams.get('budget_id');
          const qOppId = searchParams.get('opportunity_id');
          const qPrjId = searchParams.get('project_id');
          const qClient = searchParams.get('client_name');
          const qScope = searchParams.get('scope');
          const qSubtotal = searchParams.get('subtotal');

          if (qBudgetId) {
            setSelectedBudgetId(qBudgetId);
            const matchingB = bList.find((b: CommercialBudget) => b.id === qBudgetId);
            if (matchingB) {
              setClientName(matchingB.client_name || '');
              setScopeDescription(`Servicio de ${matchingB.service_category}: ${matchingB.project_title}`);
              setSubtotal(matchingB.suggested_sale_price || matchingB.total_direct_cost || '');
            }
          }

          if (qOppId) {
            setSelectedOpportunityId(qOppId);
            const matchingO = oList.find((o: CommercialOpportunity) => o.id === qOppId);
            if (matchingO) {
              if (!qBudgetId) {
                setClientName(matchingO.client_name || '');
                setScopeDescription(matchingO.opportunity_title || '');
                if (matchingO.estimated_value) setSubtotal(matchingO.estimated_value);
              }
            }
          }

          if (qPrjId) {
            setSelectedProjectId(qPrjId);
          }

          if (qClient && !qBudgetId && !qOppId) setClientName(decodeURIComponent(qClient));
          if (qScope && !qBudgetId && !qOppId) setScopeDescription(decodeURIComponent(qScope));
          if (qSubtotal && !qBudgetId) setSubtotal(Number(qSubtotal) || '');
        }
      } catch (err) {
        console.error('Error cargando antecedentes de cotización:', err);
      } finally {
        setLoadingAntecedents(false);
      }
    }

    loadPipelineData();
  }, [searchParams]);

  // Manejar importación desde selector de presupuesto APU
  const handleBudgetChange = (bId: string) => {
    setSelectedBudgetId(bId);
    if (!bId) return;

    const b = budgets.find((item) => item.id === bId);
    if (b) {
      setClientName(b.client_name);
      setScopeDescription(`Ejecución técnica según APU (${b.budget_code}): ${b.project_title}. Especialidad: ${b.service_category}.`);
      setSubtotal(b.suggested_sale_price || b.total_direct_cost);
      if (b.opportunity_id) {
        setSelectedOpportunityId(b.opportunity_id);
      }
    }
  };

  // Manejar importación desde selector de oportunidad
  const handleOpportunityChange = (oppId: string) => {
    setSelectedOpportunityId(oppId);
    if (!oppId) return;

    const opp = opportunities.find((item) => item.id === oppId);
    if (opp) {
      if (!clientName) setClientName(opp.client_name);
      if (!scopeDescription) setScopeDescription(opp.opportunity_title);
      if (!subtotal && opp.estimated_value) setSubtotal(opp.estimated_value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!quoteCode.trim() || !clientName.trim()) {
      setErrorMessage('El código de cotización y el cliente son campos obligatorios.');
      return;
    }

    if (!subtotalNumber || subtotalNumber <= 0) {
      setErrorMessage('Ingrese un valor de subtotal válido mayor a $ 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        quote_code: quoteCode.trim().toUpperCase(),
        client_name: clientName.trim(),
        scope_description: scopeDescription.trim() || 'Alcance técnico de ingeniería y geofísica PROCIMEC.',
        subtotal: subtotalNumber,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        validity_days: Number(validityDays) || 30,
        delivery_weeks: Number(deliveryWeeks) || 2,
        notes: notes.trim() || null,
        opportunity_id: selectedOpportunityId || null,
        budget_id: selectedBudgetId || null,
        project_id: selectedProjectId || null,
      };

      const res = await fetch('/api/forms/cotizacion-comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al emitir la cotización comercial');
      }

      const resJson = await res.json();
      setSavedProposal(resJson.data || resJson.submission || { ...payload, id: 'temp-id', created_at: new Date().toISOString() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Header Institucional Hero */}
      <section className="page-hero">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-3">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-accent/20 text-accent font-mono">
                  FOR-CMR-002
                </span>
                <span className="text-white/60 text-xs">Versión 1 &bull; Proceso Comercial</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-accent shrink-0" strokeWidth={1.75} />
                Cotización Comercial Emitida
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-2xl">
                Registro y expedición formal de oferta técnico-económica para clientes industriales, plantas y proyectos de ingeniería. Diligenciamiento en un solo paso.
              </p>
            </div>
            <div className="sm:self-end">
              <Link
                href="/tools/commercial-pipeline"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
              >
                <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Ver Pipeline Comercial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
        {savedProposal ? (
          /* Vista de Éxito y Descarga Inmediata */
          <div className="card p-6 sm:p-8 bg-white border border-border shadow-card rounded-2xl animate-in fade-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 font-mono mb-1">
                  OFERTA EMITIDA Y PERSISTIDA
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                  Cotización {savedProposal.quote_code} Registrada Exitosamente
                </h2>
                <p className="text-text-secondary text-sm mt-1">
                  La propuesta técnico-económica para <strong className="text-text-primary">{savedProposal.client_name}</strong> ha sido radicada con trazabilidad completa.
                </p>

                {/* Resumen de Montos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6 p-4 rounded-xl bg-slate-50 border border-border">
                  <div>
                    <span className="text-xs text-text-muted block">Subtotal (Antes de IVA)</span>
                    <span className="font-mono font-bold text-text-primary text-base">
                      {formatCOP(savedProposal.subtotal || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted block">IVA (19%)</span>
                    <span className="font-mono font-bold text-text-primary text-base">
                      {formatCOP(savedProposal.tax_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-amber-700 block font-semibold">Valor Total Ofertado</span>
                    <span className="font-mono font-extrabold text-amber-800 text-lg">
                      {formatCOP(savedProposal.total_amount || 0)}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción Inmediata */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => generateProposalPdf(savedProposal)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-800 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4 text-accent" strokeWidth={1.75} />
                    Descargar Oferta Oficial en PDF (FOR-CMR-002)
                  </button>

                  <Link
                    href={`/forms/cierre-comercial?quote_code=${encodeURIComponent(savedProposal.quote_code)}&proposal_id=${savedProposal.id}&client_name=${encodeURIComponent(savedProposal.client_name)}&amount=${savedProposal.total_amount}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-primary-900 font-bold text-sm hover:brightness-105 transition-colors shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                    Registrar Cierre de Negociación
                  </Link>

                  <Link
                    href="/tools/commercial-pipeline"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-text-primary text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <Briefcase className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                    Tablero Pipeline
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSavedProposal(null);
                      setClientName('');
                      setScopeDescription('');
                      setSubtotal('');
                      setNotes('');
                      setSelectedBudgetId('');
                      setSelectedOpportunityId('');
                      setSelectedProjectId('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-muted hover:text-text-primary ml-auto"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                    Emitir Otra Cotización
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Formulario Paso Único */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" strokeWidth={1.75} />
                <p className="text-sm font-medium">{errorMessage}</p>
              </div>
            )}

            {/* Tarjeta 1: Articulación y Trazabilidad Opcional */}
            <div className="card p-5 sm:p-6 bg-white border border-border shadow-card rounded-xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    1. Vinculación y Antecedentes (Opcional - Total Autonomía)
                  </h2>
                </div>
                <span className="text-xs text-text-muted">
                  Puedes dejar en blanco e iniciar desde cero
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Selector de Presupuesto APU */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Importar desde Presupuesto APU:
                  </label>
                  <select
                    value={selectedBudgetId}
                    onChange={(e) => handleBudgetChange(e.target.value)}
                    disabled={loadingAntecedents}
                    className="input w-full text-xs font-medium bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">— Ninguno (Crear sin Presupuesto) —</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.budget_code} &bull; {b.project_title.slice(0, 28)} ({formatCOP(b.suggested_sale_price || 0)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    Auto-completa cliente, alcance y valor de venta del APU.
                  </p>
                </div>

                {/* Selector de Oportunidad */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Vincular a Oportunidad / Licitación:
                  </label>
                  <select
                    value={selectedOpportunityId}
                    onChange={(e) => handleOpportunityChange(e.target.value)}
                    disabled={loadingAntecedents}
                    className="input w-full text-xs font-medium bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">— Ninguna (Sin Oportunidad) —</option>
                    {opportunities.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.opportunity_code || 'OPP'} &bull; {opp.client_name.slice(0, 20)} ({opp.opportunity_title.slice(0, 25)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    Asocia esta cotización al embudo comercial.
                  </p>
                </div>

                {/* Selector de Proyecto Existente */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Vincular a Proyecto Oficial:
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={loadingAntecedents}
                    className="input w-full text-xs font-medium bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">— Sin Proyecto Asociado —</option>
                    {projects.map((prj) => (
                      <option key={prj.id} value={prj.id}>
                        {prj.code} &bull; {prj.name.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    Vincula retroactivamente si el proyecto ya fue aperturado.
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Datos de la Cotización */}
            <div className="card p-5 sm:p-6 bg-white border border-border shadow-card rounded-xl">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
                <FileSpreadsheet className="w-4 h-4 text-accent" strokeWidth={1.75} />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  2. Parámetros de la Oferta Comercial (Paso Único)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Código de Cotización */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Código de Cotización Oficial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteCode}
                    onChange={(e) => setQuoteCode(e.target.value.toUpperCase())}
                    className="input w-full font-mono font-semibold uppercase bg-white text-text-primary border-border focus:ring-accent"
                    placeholder="Ej: COT-2026-001"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    Identificador unívoco para trazabilidad y formato FOR-CMR-002.
                  </p>
                </div>

                {/* Cliente / Destinatario */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Cliente / Razón Social <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="input w-full pl-9 bg-white text-text-primary border-border focus:ring-accent"
                      placeholder="Ej: ECOPETROL S.A., CENIT, DRUMMOND..."
                    />
                  </div>
                </div>

                {/* Alcance Técnico Ofertado */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Alcance Técnico Ofertado <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={scopeDescription}
                    onChange={(e) => setScopeDescription(e.target.value)}
                    className="input w-full py-2 bg-white text-text-primary border-border focus:ring-accent"
                    placeholder="Detalle de actividades: inspección GPR con antenas multifrecuencia, frentes topográficos, obras civiles in-house, entregables CAD/BIM e informes..."
                  />
                </div>

                {/* Validez de Oferta */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Validez de la Oferta (Días Calendario)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="number"
                      min={1}
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
                      className="input w-full pl-9 bg-white text-text-primary border-border focus:ring-accent font-mono"
                      placeholder="30"
                    />
                  </div>
                </div>

                {/* Plazo de Entrega */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Plazo Estimado de Ejecución (Semanas)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="number"
                      min={1}
                      value={deliveryWeeks}
                      onChange={(e) => setDeliveryWeeks(Number(e.target.value) || 2)}
                      className="input w-full pl-9 bg-white text-text-primary border-border focus:ring-accent font-mono"
                      placeholder="2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta 3: Estructura Económica y Totales */}
            <div className="card p-5 sm:p-6 bg-white border border-border shadow-card rounded-xl">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
                <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  3. Estructura Económica y Liquidación
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                {/* Subtotal */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Valor Subtotal (Antes de IVA) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value === '' ? '' : Number(e.target.value))}
                      className="input w-full pl-9 font-mono font-bold bg-white text-text-primary border-border focus:ring-accent text-base"
                      placeholder="0"
                    />
                  </div>
                  {subtotalNumber > 0 && (
                    <p className="text-[11px] text-text-muted font-mono mt-1">
                      {formatCOP(subtotalNumber)}
                    </p>
                  )}
                </div>

                {/* Checkbox IVA 19% */}
                <div className="p-3.5 rounded-lg border border-border bg-slate-50">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyTax}
                      onChange={(e) => setApplyTax(e.target.checked)}
                      className="w-4 h-4 rounded text-accent focus:ring-accent accent-accent"
                    />
                    <span className="text-xs font-bold text-text-primary">
                      Aplicar IVA General (19%)
                    </span>
                  </label>
                  <div className="mt-2 text-xs">
                    <span className="text-text-muted">Valor Liquidado IVA:</span>
                    <span className="font-mono font-bold text-text-primary ml-1 block">
                      {formatCOP(taxAmount)}
                    </span>
                  </div>
                </div>

                {/* Valor Total Ofertado (Destacado) */}
                <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-accent/40 flex flex-col justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Valor Total Ofertado (con IVA)
                  </span>
                  <div className="font-mono text-2xl font-extrabold text-amber-950 mt-1">
                    {formatCOP(totalAmount)}
                  </div>
                  <span className="text-[11px] text-amber-800 mt-1">
                    Monto final oficial estipulado en la propuesta
                  </span>
                </div>
              </div>

              {/* Condiciones Comerciales y Forma de Pago */}
              <div className="mt-4 pt-4 border-t border-border">
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Condiciones Comerciales y Forma de Pago
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full py-2 bg-white text-text-primary border-border focus:ring-accent"
                  placeholder="Ej: 50% de anticipo a la firma del contrato y 50% contra entrega de informe a satisfacción. Precios no incluyen permisos especiales de terceros..."
                />
              </div>
            </div>

            {/* Botón de Emisión Paso Único */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-text-muted">
                Al emitir, quedará registrado con el código <span className="font-mono font-bold text-text-primary">{quoteCode}</span> y disponible para exportar en PDF.
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-accent text-primary-900 font-extrabold text-sm hover:brightness-105 active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>Guardando y Generando Oferta...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={2} />
                    Emitir Cotización Comercial Oficial
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function CotizacionComercialPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-text-muted">Cargando Cotización Comercial...</p>
          </div>
        </div>
      }
    >
      <CotizacionComercialContent />
    </Suspense>
  );
}
