'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  FileCheck2,
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
  XCircle,
  Clock,
  Send,
  HelpCircle,
  Rocket,
  FolderKanban,
  Scale,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { CommercialClosing, CommercialProposal, Project } from '@/types';
import { generateClosingPdf } from '@/lib/commercial/commercialPdfGenerator';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function CierreComercialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedClosing, setSavedClosing] = useState<CommercialClosing | null>(null);

  // Listado de cotizaciones y proyectos activos para selección
  const [proposals, setProposals] = useState<CommercialProposal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Campos de Formulario (Paso Único)
  const [quoteCode, setQuoteCode] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [syncMode, setSyncMode] = useState<'sync_to_quote' | 'keep_project_ceiling'>('sync_to_quote');
  const [clientName, setClientName] = useState('');
  const [result, setResult] = useState<'won' | 'lost' | 'cancelled'>('won');
  const [finalContractValue, setFinalContractValue] = useState<number | ''>('');
  const [contractNumber, setContractNumber] = useState('');
  const [lossReason, setLossReason] = useState('precio');
  const [closingNotes, setClosingNotes] = useState('');

  // Cargar cotizaciones y proyectos emitidos
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingProposals(true);
        let pList: CommercialProposal[] = [];
        let prjList: Project[] = [];

        const [pipeRes, prjRes] = await Promise.all([
          fetch('/api/tools/commercial-pipeline'),
          fetch('/api/projects').catch(() => null),
        ]);

        if (pipeRes.ok) {
          const json = await pipeRes.json();
          pList = json.data?.proposals || [];
          if (json.data?.projects && json.data.projects.length > 0) {
            prjList = json.data.projects;
          }
        }

        if (prjRes && prjRes.ok) {
          const pJson = await prjRes.json();
          const fetchedPrjs = pJson.data || [];
          if (fetchedPrjs.length > 0) {
            prjList = fetchedPrjs;
          }
        }

        // Respaldo resiliente directo al endpoint de cotizaciones
        if (pList.length === 0) {
          const resProps = await fetch('/api/forms/cotizacion-comercial');
          if (resProps.ok) {
            const jsonProps = await resProps.json();
            pList = (jsonProps.data?.proposals || []) as CommercialProposal[];
          }
        }

        setProposals(pList);
        setProjects(prjList);

        // Si vienen parámetros en URL
        const qQuoteCode = searchParams.get('quote_code');
        const qPropId = searchParams.get('proposal_id');
        const qProjectId = searchParams.get('project_id');
        const qClient = searchParams.get('client_name');
        const qAmount = searchParams.get('amount');

        if (qQuoteCode) setQuoteCode(qQuoteCode);
        if (qPropId) setSelectedProposalId(qPropId);
        if (qProjectId) setSelectedProjectId(qProjectId);
        if (qClient) setClientName(decodeURIComponent(qClient));
        if (qAmount) setFinalContractValue(Number(qAmount) || '');

        if (qPropId) {
          const match = pList.find((p: CommercialProposal) => p.id === qPropId);
          if (match) {
            setQuoteCode(match.quote_code);
            if (!qClient) setClientName(match.client_name);
            if (!qAmount) setFinalContractValue(match.total_amount);
            if (!qProjectId && match.project_id) {
              setSelectedProjectId(match.project_id);
            }
          }
        }
      } catch (err) {
        console.error('Error cargando cotizaciones y proyectos para cierre:', err);
      } finally {
        setLoadingProposals(false);
      }
    }

    loadData();
  }, [searchParams]);

  // Manejar selección de cotización desde dropdown
  const handleProposalSelect = (propId: string) => {
    setSelectedProposalId(propId);
    if (!propId) return;

    const match = proposals.find((p) => p.id === propId);
    if (match) {
      setQuoteCode(match.quote_code);
      setClientName(match.client_name);
      setFinalContractValue(match.total_amount);
      if (match.project_id) {
        setSelectedProjectId(match.project_id);
      }
    }
  };

  // Manejar selección de proyecto desde dropdown
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    if (!projId) return;
    const prj = projects.find((p) => p.id === projId);
    if (prj && !clientName) {
      setClientName(prj.client);
    }
  };

  // Valores derivados para deliberación
  const selectedProposal = proposals.find((p) => p.id === selectedProposalId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const apuDirectCost = selectedProposal?.commercial_budgets?.total_direct_cost || 0;
  const projectContractVal = Number(selectedProject?.contract_value || 0);
  const projectExecVal = Number(selectedProject?.execution_value || 0);
  const currentFinalValue = Number(finalContractValue) || 0;

  const hasFinancialDiscrepancy =
    selectedProject &&
    currentFinalValue > 0 &&
    projectContractVal > 0 &&
    Math.abs(currentFinalValue - projectContractVal) > 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!quoteCode.trim()) {
      setErrorMessage('Debe indicar o seleccionar el código de cotización negociada.');
      return;
    }

    if (result === 'won' && (!finalContractValue || Number(finalContractValue) <= 0)) {
      setErrorMessage('Para adjudicaciones ganadas, debe especificar el valor contractual final.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        quote_code: quoteCode.trim().toUpperCase(),
        proposal_id: selectedProposalId || null,
        project_id: selectedProjectId || null,
        sync_mode: syncMode,
        direct_cost: apuDirectCost > 0 ? apuDirectCost : null,
        result,
        final_contract_value: result === 'won' ? Number(finalContractValue) : null,
        contract_number: result === 'won' ? contractNumber.trim() || null : null,
        loss_reason: result !== 'won' ? lossReason : null,
        closing_notes: closingNotes.trim() || null,
      };

      const res = await fetch('/api/forms/cierre-comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al registrar el cierre de negociación');
      }

      const resJson = await res.json();
      setSavedClosing(resJson.data || resJson.submission || { ...payload, id: 'temp-id', created_at: new Date().toISOString() });
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="mb-3">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-accent/20 text-accent font-mono">
                  FOR-CMR-003
                </span>
                <span className="text-white/60 text-xs">Versión 1 &bull; Proceso Comercial</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <FileCheck2 className="w-8 h-8 text-accent shrink-0" strokeWidth={1.75} />
                Cierre de Negociación y Adjudicación
              </h1>
              <p className="text-white/70 text-sm mt-1 max-w-2xl">
                Registro del desenlace comercial de la oferta: adjudicada, perdida ante la competencia o desierta. Diligenciamiento en un solo paso.
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
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        {savedClosing ? (
          /* Vista de Éxito y Descarga Inmediata */
          <div className="card p-6 sm:p-8 bg-white border border-border shadow-card rounded-2xl animate-in fade-in">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                savedClosing.result === 'won'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
              }`}>
                {savedClosing.result === 'won' ? (
                  <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} />
                ) : (
                  <XCircle className="w-7 h-7" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex-1">
                <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold font-mono mb-1 ${
                  savedClosing.result === 'won'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {savedClosing.result === 'won' ? 'OFERTA GANADA / ADJUDICADA' : 'OFERTA NO ADJUDICADA'}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                  Cierre de Negociación Registrado
                </h2>
                <p className="text-text-secondary text-sm mt-1">
                  Se ha generado el radicado formal de cierre para la propuesta <strong className="font-mono text-text-primary">{savedClosing.closing_code || 'CIE-2026'}</strong>.
                </p>

                {/* Si fue ganada, mostrar valor y CTA a Apertura de Proyecto */}
                {savedClosing.result === 'won' && (
                  <div className="my-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <span className="text-xs text-emerald-800 font-bold block uppercase tracking-wider">
                        Monto Final Contratado
                      </span>
                      <span className="font-mono text-2xl font-extrabold text-emerald-950">
                        {formatCOP(savedClosing.final_contract_value || savedClosing.final_value || 0)}
                      </span>
                      {savedClosing.contract_number && (
                        <p className="text-xs text-emerald-800 font-medium mt-0.5">
                          Contrato / Orden: <span className="font-mono font-bold">{savedClosing.contract_number}</span>
                        </p>
                      )}
                      {(savedClosing.project_id || selectedProjectId) && (
                        <p className="text-xs text-emerald-800 font-medium mt-1 flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.75} />
                          Proyecto Oficial Sincronizado: <strong className="text-emerald-950">{projects.find((p) => p.id === (savedClosing.project_id || selectedProjectId))?.name || 'Vinculado'}</strong>
                        </p>
                      )}
                    </div>
                    <Link
                      href={
                        (savedClosing.project_id || selectedProjectId)
                          ? `/admin/projects?project_id=${savedClosing.project_id || selectedProjectId}`
                          : `/admin/projects?create=true&commercial_proposal_id=${savedClosing.proposal_id || ''}&client_name=${encodeURIComponent(clientName)}`
                      }
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-primary-900 font-extrabold text-sm hover:brightness-105 shadow-md shrink-0"
                    >
                      <Rocket className="w-5 h-5" strokeWidth={2} />
                      {(savedClosing.project_id || selectedProjectId) ? 'Ver Proyecto Oficial Sincronizado' : 'Aperturar Proyecto Oficial en PROCIMEC'}
                    </Link>
                  </div>
                )}

                {/* Botones de Acción */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => generateClosingPdf(savedClosing)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-800 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4 text-accent" strokeWidth={1.75} />
                    Descargar Acta de Cierre en PDF (FOR-CMR-003)
                  </button>

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
                      setSavedClosing(null);
                      setQuoteCode('');
                      setSelectedProposalId('');
                      setSelectedProjectId('');
                      setClientName('');
                      setFinalContractValue('');
                      setContractNumber('');
                      setClosingNotes('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-muted hover:text-text-primary ml-auto"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                    Registrar Otro Cierre
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

            {/* Tarjeta 1: Selección de Cotización Negociada */}
            <div className="card p-5 sm:p-6 bg-white border border-border shadow-card rounded-xl">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
                <FileCheck2 className="w-4 h-4 text-accent" strokeWidth={1.75} />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  1. Oferta Negociada y Destinatario (Paso Único)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Selector de Cotización Existente */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Seleccionar Cotización Emitida:
                  </label>
                  <select
                    value={selectedProposalId}
                    onChange={(e) => handleProposalSelect(e.target.value)}
                    disabled={loadingProposals}
                    className="input w-full text-xs font-medium bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">— Seleccionar del listado o ingresar código manual —</option>
                    {proposals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.quote_code} &bull; {p.client_name} ({formatCOP(p.total_amount)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    Carga automáticamente el cliente y valor total ofertado.
                  </p>
                </div>

                {/* Código de Cotización (Manual o Autocompletado) */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Código de Cotización Comercial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteCode}
                    onChange={(e) => setQuoteCode(e.target.value.toUpperCase())}
                    className="input w-full font-mono font-bold uppercase bg-white text-text-primary border-border focus:ring-accent"
                    placeholder="Ej: COT-2026-001"
                  />
                </div>

                {/* Cliente */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Cliente / Razón Social
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="input w-full pl-9 bg-white text-text-primary border-border focus:ring-accent"
                      placeholder="Nombre del cliente o entidad contratante"
                    />
                  </div>
                </div>

                {/* Selector de Proyecto Oficial */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                      Vincular a Proyecto Oficial en PROCIMEC (Opcional):
                    </span>
                    {selectedProject && (
                      <span className="text-[11px] font-mono text-accent font-semibold">
                        CC: {selectedProject.cost_center || 'S/N'}
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="input w-full text-xs font-medium bg-white text-text-primary border-border focus:ring-accent"
                  >
                    <option value="">— Ninguno (O asociar / crear proyecto posteriormente) —</option>
                    {projects.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.cost_center ? `[${pr.cost_center}] ` : ''}{pr.name} &bull; {pr.client} {pr.contract_value ? `(${formatCOP(pr.contract_value)})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    {selectedProject
                      ? `Proyecto enlazado: ${selectedProject.name}. Techo contractual registrado: ${formatCOP(selectedProject.contract_value || 0)}. Presupuesto ejecución: ${formatCOP(selectedProject.execution_value || 0)}.`
                      : 'Al vincular un proyecto oficial, podrás deliberar si actualizas su techo contractual y presupuesto de ejecución con los valores de este cierre.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Resultado de la Negociación */}
            <div className="card p-5 sm:p-6 bg-white border border-border shadow-card rounded-xl">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
                <CheckCircle2 className="w-4 h-4 text-accent" strokeWidth={1.75} />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  2. Desenlace Contractual y Parámetros Finales
                </h2>
              </div>

              {/* Selector Visual de Resultado (3 Opciones Claras) */}
              <label className="block text-xs font-bold text-text-secondary mb-2">
                Resultado de la Negociación:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setResult('won')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    result === 'won'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                      : 'border-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-emerald-800 uppercase tracking-wide">
                      Adjudicada / Ganada
                    </span>
                    <CheckCircle2 className={`w-5 h-5 ${result === 'won' ? 'text-emerald-600' : 'text-slate-300'}`} strokeWidth={1.75} />
                  </div>
                  <p className="text-xs text-text-secondary">
                    Firma de contrato u orden de servicio (OS) confirmada.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('lost')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    result === 'lost'
                      ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/30'
                      : 'border-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-rose-800 uppercase tracking-wide">
                      No Adjudicada / Perdida
                    </span>
                    <XCircle className={`w-5 h-5 ${result === 'lost' ? 'text-rose-600' : 'text-slate-300'}`} strokeWidth={1.75} />
                  </div>
                  <p className="text-xs text-text-secondary">
                    Perdida ante competencia o descarte técnico/económico.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('cancelled')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    result === 'cancelled'
                      ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-500/30'
                      : 'border-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                      Cancelada / Desierta
                    </span>
                    <Clock className={`w-5 h-5 ${result === 'cancelled' ? 'text-slate-600' : 'text-slate-300'}`} strokeWidth={1.75} />
                  </div>
                  <p className="text-xs text-text-secondary">
                    El cliente canceló, suspendió o declaró desierto el proceso.
                  </p>
                </button>
              </div>

              {/* Campos condicionales si es GANADA */}
              {result === 'won' ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-border space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-text-secondary">
                          Valor Final Contratado (COP, con IVA) <span className="text-rose-500">*</span>
                        </label>
                        {selectedProject && projectContractVal > 0 && selectedProposal?.total_amount && (
                          <span className="text-[10px] text-text-muted">Ajuste rápido</span>
                        )}
                      </div>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" strokeWidth={1.75} />
                        <input
                          type="number"
                          min={0}
                          step="any"
                          required
                          value={finalContractValue}
                          onChange={(e) => setFinalContractValue(e.target.value === '' ? '' : Number(e.target.value))}
                          className="input w-full pl-9 font-mono font-bold bg-white text-text-primary border-border focus:ring-accent"
                          placeholder="Monto final pactado"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
                        {Number(finalContractValue) > 0 ? (
                          <p className="text-[11px] text-emerald-800 font-mono font-semibold">
                            {formatCOP(Number(finalContractValue))}
                          </p>
                        ) : <div />}

                        {/* Presets rápidos para alternar entre Cotización y Techo de Proyecto */}
                        <div className="flex items-center gap-1.5">
                          {selectedProposal?.total_amount && (
                            <button
                              type="button"
                              onClick={() => {
                                setFinalContractValue(selectedProposal.total_amount);
                                setSyncMode('sync_to_quote');
                              }}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                Number(finalContractValue) === Number(selectedProposal.total_amount)
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                                  : 'bg-white border-border text-text-muted hover:text-text-primary'
                              }`}
                            >
                              Cotización: {formatCOP(selectedProposal.total_amount)}
                            </button>
                          )}
                          {selectedProject && projectContractVal > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setFinalContractValue(projectContractVal);
                                setSyncMode('keep_project_ceiling');
                              }}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                Number(finalContractValue) === projectContractVal
                                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                                  : 'bg-white border-border text-text-muted hover:text-text-primary'
                              }`}
                            >
                              Techo Proyecto: {formatCOP(projectContractVal)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-secondary mb-1">
                        Número de Contrato u Orden de Servicio (OS)
                      </label>
                      <input
                        type="text"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        className="input w-full font-mono bg-white text-text-primary border-border focus:ring-accent"
                        placeholder="Ej: OS-2026-9812 / CTR-PROC-44"
                      />
                    </div>
                  </div>

                  {/* Panel de Deliberación Financiera cuando hay un proyecto vinculado */}
                  {selectedProject && (
                    <div className="p-4 sm:p-5 rounded-xl border border-accent/40 bg-accent/5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-accent/20">
                        <div className="flex items-center gap-2">
                          <Scale className="w-5 h-5 text-accent shrink-0" strokeWidth={1.75} />
                          <div>
                            <h3 className="text-sm font-extrabold text-text-primary">
                              Deliberación Financiera: Proyecto Oficial &bull; {selectedProject.name}
                            </h3>
                            <p className="text-xs text-text-muted">
                              Define cómo conciliar el techo contractual y el presupuesto de ejecución en la base de datos oficial.
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-accent/20 text-accent font-mono self-start sm:self-auto">
                          CC: {selectedProject.cost_center || 'S/N'}
                        </span>
                      </div>

                      {/* Resumen comparativo de cifras */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-white border border-border">
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Cierre Adjudicado (Techo)</span>
                          <span className="font-mono font-extrabold text-emerald-800 text-sm">
                            {formatCOP(currentFinalValue)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-border">
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Costo Directo APU Puro</span>
                          <span className="font-mono font-extrabold text-primary-900 text-sm">
                            {apuDirectCost > 0 ? formatCOP(apuDirectCost) : 'Sin APU vinculado'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-border">
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Techo Actual Proyecto</span>
                          <span className="font-mono font-extrabold text-text-primary text-sm">
                            {formatCOP(projectContractVal)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-border">
                          <span className="text-[10px] uppercase font-bold text-text-muted block">Presupuesto Ejecución Proyecto</span>
                          <span className="font-mono font-extrabold text-text-secondary text-sm">
                            {formatCOP(projectExecVal)}
                          </span>
                        </div>
                      </div>

                      {/* Alerta de discrepancia si los valores difieren */}
                      {hasFinancialDiscrepancy && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <div>
                            <strong className="font-bold">Discrepancia detectada:</strong> El valor final de este cierre (<span className="font-mono font-bold">{formatCOP(currentFinalValue)}</span>) difiere del techo contractual registrado en el proyecto (<span className="font-mono font-bold">{formatCOP(projectContractVal)}</span>). Selecciona el camino que debe asumir el sistema.
                          </div>
                        </div>
                      )}

                      {/* Opciones de Deliberación (Camino 1 vs Camino 2) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Camino 1 */}
                        <button
                          type="button"
                          onClick={() => {
                            setSyncMode('sync_to_quote');
                            if (selectedProposal?.total_amount) {
                              setFinalContractValue(selectedProposal.total_amount);
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            syncMode === 'sync_to_quote'
                              ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/30 shadow-sm'
                              : 'border-border bg-white/70 hover:bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-xs text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                Camino 1: Sincronizar Proyecto
                              </span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                syncMode === 'sync_to_quote' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                              }`}>
                                {syncMode === 'sync_to_quote' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <p className="text-xs text-text-secondary mb-2">
                              Fija el valor del contrato en {selectedProposal?.total_amount ? formatCOP(selectedProposal.total_amount) : 'la cotización'} y sincroniza el techo y ejecución del proyecto.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Nuevo Techo Proyecto:</span>
                              <span className="font-mono font-bold text-emerald-900">{formatCOP(selectedProposal?.total_amount || currentFinalValue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Nuevo Presupuesto Ejecución:</span>
                              <span className="font-mono font-bold text-emerald-900">
                                {apuDirectCost > 0 ? formatCOP(apuDirectCost) : formatCOP(Math.round((selectedProposal?.total_amount || currentFinalValue) * 0.76))}
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Camino 2 */}
                        <button
                          type="button"
                          onClick={() => {
                            setSyncMode('keep_project_ceiling');
                            if (projectContractVal > 0) {
                              setFinalContractValue(projectContractVal);
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            syncMode === 'keep_project_ceiling'
                              ? 'border-accent bg-white ring-2 ring-accent/30 shadow-sm'
                              : 'border-border bg-white/70 hover:bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-extrabold text-xs text-primary-900 uppercase tracking-wide flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                Camino 2: Conservar Techo Global
                              </span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                syncMode === 'keep_project_ceiling' ? 'border-accent bg-accent text-primary-900' : 'border-slate-300'
                              }`}>
                                {syncMode === 'keep_project_ceiling' && <span className="w-1.5 h-1.5 rounded-full bg-primary-900" />}
                              </div>
                            </div>
                            <p className="text-xs text-text-secondary mb-2">
                              Fija el valor del contrato en el techo actual ({formatCOP(projectContractVal)}) y mantiene intacto el presupuesto del proyecto.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Techo Conservado:</span>
                              <span className="font-mono font-bold text-text-primary">{formatCOP(projectContractVal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Presupuesto Conservado:</span>
                              <span className="font-mono font-bold text-text-primary">{formatCOP(projectExecVal)}</span>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Resumen dinámico de acción */}
                      <div className="p-3 rounded-lg bg-surface text-xs text-white/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-white/70">
                          Acción al confirmar cierre:
                        </span>
                        <span className="font-medium text-accent">
                          {syncMode === 'sync_to_quote'
                            ? `Actualizará el proyecto a ${formatCOP(currentFinalValue)} (Techo) y ${apuDirectCost > 0 ? formatCOP(apuDirectCost) : 'neto estimado'} (Ejecución)`
                            : `Conservará el techo de ${formatCOP(projectContractVal)} y asociará este radicado`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Campos condicionales si es PERDIDA o CANCELADA */
                <div className="p-4 rounded-xl bg-slate-50 border border-border space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Motivo Principal de Deserción o Pérdida:
                    </label>
                    <select
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      className="input w-full bg-white text-text-primary border-border focus:ring-accent"
                    >
                      <option value="precio">Precio más alto que la propuesta competidora</option>
                      <option value="plazo">Tiempos de entrega exigidos por el cliente</option>
                      <option value="tecnico">Especificaciones técnicas o equipo no disponible</option>
                      <option value="cliente_cancelo">El cliente canceló o suspendió el presupuesto</option>
                      <option value="otro">Otro factor comercial / Decisión interna del cliente</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Conclusiones y Retroalimentación Comercial */}
              <div className="mt-4 pt-4 border-t border-border">
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Conclusiones, Lecciones Aprendidas y Retroalimentación Comercial:
                </label>
                <textarea
                  rows={3}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="input w-full py-2 bg-white text-text-primary border-border focus:ring-accent"
                  placeholder="Detalles de la decisión del cliente, factores clave de negociación y recomendaciones para futuras ofertas de ingeniería..."
                />
              </div>
            </div>

            {/* Botón de Cierre Paso Único */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-text-muted">
                Registro con radicado formal en acta oficial <span className="font-mono font-bold text-text-primary">FOR-CMR-003</span>.
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-accent text-primary-900 font-extrabold text-sm hover:brightness-105 active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>Procesando Cierre...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={2} />
                    Finalizar y Registrar Cierre de Negociación
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

export default function CierreComercialPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold text-text-muted">Cargando Cierre Comercial...</p>
          </div>
        </div>
      }
    >
      <CierreComercialContent />
    </Suspense>
  );
}
