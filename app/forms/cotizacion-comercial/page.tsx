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
  Scale,
  CheckSquare,
  Square,
  ChevronDown,
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

function cleanProjectDescription(desc?: string | null): string {
  if (!desc) return '';
  return desc
    .replace(/\n?<!--PROJECT_TARGETS:[\s\S]*?-->/gi, '')
    .replace(/\n?<!--PROJECT_FINANCIALS:[\s\S]*?-->/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .trim();
}

const STANDARD_PAYMENT_CONDITIONS = [
  {
    id: 'anticipo_50_50',
    label: '50% Anticipo / 50% Contra Entrega',
    text: '50% de anticipo a la firma de contrato u orden de servicio (OS), y 50% contra entrega de informe técnico a satisfacción.',
  },
  {
    id: 'anticipo_30_70',
    label: '30% Anticipo / 70% Final',
    text: '30% de anticipo a la orden de inicio y 70% contra entrega final de memorias de cálculo, planos y entregables.',
  },
  {
    id: 'credito_30',
    label: 'Crédito a 30 Días',
    text: 'Pago a 30 días calendario tras radicación y aprobación formal de factura electrónica.',
  },
  {
    id: 'contra_entrega_100',
    label: '100% Contra Entrega',
    text: '100% del valor total contra entrega y radicación de informe técnico final a satisfacción.',
  },
  {
    id: 'exclusiones_ley',
    label: 'Exclusiones de Permisos',
    text: 'Los precios ofertados no incluyen permisos de intervención en vía pública, licencias ambientales ni tasas de entidades externas.',
  },
  {
    id: 'personal_hseq',
    label: 'Seguridad Social y HSEQ',
    text: 'Personal técnico operativo con seguridad social integral vigente (ARL Nivel V, EPS, Pensión) y certificación de trabajo seguro en alturas.',
  },
  {
    id: 'entregables_dwg_pdf',
    label: 'Entregables (PDF + DWG)',
    text: 'Entrega de informe técnico digital en formato PDF con memorias y planos georreferenciados en formato DWG (AutoCAD / BIM).',
  },
  {
    id: 'vigencia_30_dias',
    label: 'Vigencia de Precios',
    text: 'Precios firmes durante los días de validez estipulados en la presente oferta comercial.',
  },
];

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

  // Condiciones comerciales y forma de pago con checklist interactivo
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  // Deducciones contractuales y tributarias opcionales
  const [showDeductionsPanel, setShowDeductionsPanel] = useState(false);
  const [applyRetefuente, setApplyRetefuente] = useState(false); // 2%
  const [applyReteica, setApplyReteica] = useState(false); // 0.966%
  const [applyAI, setApplyAI] = useState(false); // 5%

  // Vínculos opcionales (Autonomía total)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Cálculos automáticos de IVA y Total
  const subtotalNumber = Number(subtotal) || 0;
  const taxAmount = applyTax ? Math.round(subtotalNumber * 0.19) : 0;
  const totalAmount = subtotalNumber + taxAmount;

  const retefuenteAmount = applyRetefuente ? Math.round(subtotalNumber * 0.02) : 0;
  const reteicaAmount = applyReteica ? Math.round(subtotalNumber * 0.00966) : 0;
  const aiAmount = applyAI ? Math.round(subtotalNumber * 0.05) : 0;
  const totalDeductionsAmount = retefuenteAmount + reteicaAmount + aiAmount;
  const netEstimatedExecution = Math.max(0, subtotalNumber - totalDeductionsAmount);

  // Manejador del checklist para concatenar/desconcatenar notas
  const handleToggleCondition = (condId: string) => {
    setSelectedConditions((prev) => {
      const next = prev.includes(condId) ? prev.filter((id) => id !== condId) : [...prev, condId];
      const selectedTexts = STANDARD_PAYMENT_CONDITIONS.filter((c) => next.includes(c.id)).map(
        (c) => `• ${c.text}`
      );
      setNotes(selectedTexts.join('\n\n'));
      return next;
    });
  };

  // Objetos seleccionados para Deliberación Económica
  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const hasEconomicConflict = Boolean(
    selectedBudget &&
      selectedProject &&
      selectedProject.contract_value &&
      Number(selectedProject.contract_value) > 0 &&
      selectedBudget.suggested_sale_price &&
      Math.abs(Number(selectedBudget.suggested_sale_price) - Number(selectedProject.contract_value)) > 1000
  );

  const apuSubtotal = Number(selectedBudget?.suggested_sale_price || selectedBudget?.total_direct_cost || 0);
  const apuTotalWithTax = Math.round(apuSubtotal * 1.19);
  const apuDirectCost = Number(selectedBudget?.total_direct_cost || 0);

  const projectContractVal = Number(selectedProject?.contract_value || 0);
  const projectBaseSubtotal = Math.round(projectContractVal / 1.19);
  const projectExecVal = Number(selectedProject?.execution_value || Math.round(projectContractVal * 0.76));

  const applyApuPricing = () => {
    setSubtotal(apuSubtotal);
    setApplyTax(true);
  };

  const applyProjectCeilingPricing = () => {
    setSubtotal(projectBaseSubtotal);
    setApplyTax(true);
  };

  const applyProjectGrossPricing = () => {
    setSubtotal(projectContractVal);
    setApplyTax(false);
  };

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

          // Generar código consecutivo sugerido sin colisiones
          let maxNum = 0;
          for (const p of pList) {
            if (p.consecutive_number && Number(p.consecutive_number) > maxNum) {
              maxNum = Number(p.consecutive_number);
            }
            const match = (p.quote_code || '').match(/COT-\d{4}-(\d+)/);
            if (match) {
              const parsed = parseInt(match[1], 10);
              if (parsed > maxNum) maxNum = parsed;
            }
          }
          const year = new Date().getFullYear();
          const nextNum = maxNum + 1;
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
            const matchingP = prjList.find((p: Project) => p.id === qPrjId);
            if (matchingP && !qBudgetId && !qOppId) {
              if (matchingP.client) setClientName(matchingP.client);
              const rawDesc = cleanProjectDescription(matchingP.description);
              const cCenter = matchingP.cost_center || matchingP.code || '';
              setScopeDescription(
                rawDesc
                  ? `${rawDesc} (Proyecto ${cCenter ? `${cCenter} - ` : ''}${matchingP.name})`
                  : `Servicios de ingeniería y soporte para proyecto ${matchingP.name}`
              );
              if (matchingP.contract_value && Number(matchingP.contract_value) > 0) {
                setSubtotal(Number(matchingP.contract_value));
              } else if (matchingP.execution_value && Number(matchingP.execution_value) > 0) {
                setSubtotal(Number(matchingP.execution_value));
              }
            }
          }

          if (qClient && !qBudgetId && !qOppId && !qPrjId) setClientName(decodeURIComponent(qClient));
          if (qScope && !qBudgetId && !qOppId && !qPrjId) setScopeDescription(decodeURIComponent(qScope));
          if (qSubtotal && !qBudgetId && !qPrjId) setSubtotal(Number(qSubtotal) || '');
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

  // Manejar importación y auto-completado desde selector de proyecto oficial
  const handleProjectChange = (prjId: string) => {
    setSelectedProjectId(prjId);
    if (!prjId) return;

    const prj = projects.find((item) => item.id === prjId);
    if (prj) {
      if (prj.client) {
        setClientName(prj.client);
      }
      const rawDesc = cleanProjectDescription(prj.description);
      const cCenter = prj.cost_center || prj.code || '';
      setScopeDescription(
        rawDesc
          ? `${rawDesc} (Proyecto ${cCenter ? `${cCenter} - ` : ''}${prj.name})`
          : `Servicios de ingeniería y soporte para proyecto ${prj.name}`
      );

      // Cargar valor financiero del proyecto (contract_value o execution_value)
      if (prj.contract_value && Number(prj.contract_value) > 0) {
        setSubtotal(Number(prj.contract_value));
      } else if (prj.execution_value && Number(prj.execution_value) > 0) {
        setSubtotal(Number(prj.execution_value));
      }
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
                    onChange={(e) => handleProjectChange(e.target.value)}
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

              {/* Panel de Deliberación Económica si hay conflicto APU vs Proyecto */}
              {hasEconomicConflict && (
                <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border-2 border-accent/40 animate-in fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-amber-900" strokeWidth={2} />
                    <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Deliberación de Base Económica (APU vs. Proyecto Oficial)
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900 mb-3">
                    Se detectaron dos montos financieros: el Presupuesto APU (<strong className="font-mono">{formatCOP(apuTotalWithTax)}</strong> con IVA) y el Contrato del Proyecto (<strong className="font-mono">{formatCOP(projectContractVal)}</strong>). Selecciona qué camino económico deseas aplicar a esta cotización:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción APU */}
                    <button
                      type="button"
                      onClick={applyApuPricing}
                      className="text-left p-3.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 transition-all shadow-xs group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-text-primary group-hover:text-amber-900">
                          1. Aplicar Base del Presupuesto APU
                        </span>
                        <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          {selectedBudget?.budget_code}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary space-y-0.5 font-mono">
                        <div>Subtotal con AIU: <strong className="text-text-primary">{formatCOP(apuSubtotal)}</strong></div>
                        <div>Total Ofertado (con IVA): <strong className="text-amber-800 font-bold">{formatCOP(apuTotalWithTax)}</strong></div>
                        <div className="text-[11px] text-text-muted">Costo Directo Puro: {formatCOP(apuDirectCost)}</div>
                      </div>
                      <span className="inline-block mt-2 text-[10px] font-bold text-amber-700">
                        &bull; Clic para cargar estos valores en la cotización
                      </span>
                    </button>

                    {/* Opción Proyecto Oficial */}
                    <button
                      type="button"
                      onClick={applyProjectCeilingPricing}
                      className="text-left p-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-xs group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-text-primary group-hover:text-slate-900">
                          2. Aplicar Techo del Proyecto Oficial
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                          {selectedProject?.cost_center || selectedProject?.code}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary space-y-0.5 font-mono">
                        <div>Techo Contrato Bruto: <strong className="text-amber-800 font-bold">{formatCOP(projectContractVal)}</strong></div>
                        <div>Base antes de IVA: <strong className="text-text-primary">{formatCOP(projectBaseSubtotal)}</strong></div>
                        <div className="text-[11px] text-text-muted">Presupuesto Ejecución: {formatCOP(projectExecVal)}</div>
                      </div>
                      <span className="inline-block mt-2 text-[10px] font-bold text-slate-700">
                        &bull; Clic para ajustar la oferta a los {formatCOP(projectContractVal)}
                      </span>
                    </button>
                  </div>
                </div>
              )}

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

              {/* Desglose Opcional de Deducciones de Ley (Colombia) */}
              <div className="mt-4 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDeductionsPanel(!showDeductionsPanel)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-text-secondary hover:text-text-primary py-1"
                >
                  <span className="flex items-center gap-2">
                    <Percent className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                    Desglose de Deducciones y Presupuesto Neto de Ejecución (Opcional)
                  </span>
                  <span className="text-[11px] text-text-muted flex items-center gap-1 font-mono">
                    {totalDeductionsAmount > 0 ? `Deducciones: -${formatCOP(totalDeductionsAmount)}` : 'Configurar'}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDeductionsPanel ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {showDeductionsPanel && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-border animate-in fade-in space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-white border border-border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyRetefuente}
                          onChange={(e) => setApplyRetefuente(e.target.checked)}
                          className="mt-0.5 rounded text-accent focus:ring-accent"
                        />
                        <div>
                          <span className="font-bold text-text-primary block">ReteFuente (2.0%)</span>
                          <span className="font-mono text-[11px] text-text-muted">
                            -{formatCOP(retefuenteAmount)}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-white border border-border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyReteica}
                          onChange={(e) => setApplyReteica(e.target.checked)}
                          className="mt-0.5 rounded text-accent focus:ring-accent"
                        />
                        <div>
                          <span className="font-bold text-text-primary block">ReteICA (0.966%)</span>
                          <span className="font-mono text-[11px] text-text-muted">
                            -{formatCOP(reteicaAmount)}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-white border border-border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyAI}
                          onChange={(e) => setApplyAI(e.target.checked)}
                          className="mt-0.5 rounded text-accent focus:ring-accent"
                        />
                        <div>
                          <span className="font-bold text-text-primary block">A.I. / Utilidad (5.0%)</span>
                          <span className="font-mono text-[11px] text-text-muted">
                            -{formatCOP(aiAmount)}
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                      <span className="text-text-muted">Presupuesto Neto Estimado de Ejecución (para Costos Directos):</span>
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {formatCOP(netEstimatedExecution)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Condiciones Comerciales y Forma de Pago con Galería Checklist */}
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-text-secondary">
                    Condiciones Comerciales y Forma de Pago
                  </label>
                  <span className="text-[11px] text-text-muted">
                    Selecciona cláusulas del checklist para agregarlas automáticamente
                  </span>
                </div>

                {/* Galería Checklist de Cláusulas Estándar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {STANDARD_PAYMENT_CONDITIONS.map((cond) => {
                    const isChecked = selectedConditions.includes(cond.id);
                    return (
                      <button
                        key={cond.id}
                        type="button"
                        onClick={() => handleToggleCondition(cond.id)}
                        className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                          isChecked
                            ? 'bg-amber-50/80 border-accent text-amber-950 font-medium'
                            : 'bg-slate-50 hover:bg-slate-100 border-border text-text-secondary'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                        )}
                        <span className="text-[11px] leading-tight">{cond.label}</span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full py-2 bg-white text-text-primary border-border focus:ring-accent font-sans text-xs leading-relaxed"
                  placeholder="Detalle de condiciones comerciales, forma de pago y garantías aplicables..."
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
