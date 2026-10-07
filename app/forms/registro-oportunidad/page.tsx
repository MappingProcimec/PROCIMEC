'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  MapPin,
  Mail,
  Phone,
  User,
  DollarSign,
  FileText,
  Download,
  ArrowRight,
  Plus,
  Calculator,
} from 'lucide-react';
import { CommercialOpportunity } from '@/types';
import { generateOpportunityPdf } from '@/lib/commercial/commercialPdfGenerator';

const SERVICE_OPTIONS = [
  { value: 'gpr_localizacion', label: 'Georradar GPR y Localización de Redes Subterráneas' },
  { value: 'civil_planta', label: 'Obras Civiles y Adecuaciones en Planta In-House' },
  { value: 'montaje_mecanico', label: 'Montajes Mecánicos, Piping y Estructuras Metálicas' },
  { value: 'topografia_cad', label: 'Topografía Industrial y Modelado CAD/BIM' },
  { value: 'inspeccion_dron', label: 'Inspección Aérea y Fotogrametría con Dron' },
  { value: 'geofisica_integral', label: 'Geofísica Aplicada (Tomografía, MASW, SEV)' },
  { value: 'interventoria_obra', label: 'Interventoría Técnica y Supervisión de Obra' },
  { value: 'consultoria', label: 'Consultoría Especializada y Memorias de Cálculo' },
];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RegistroOportunidadPage() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedOpportunity, setSavedOpportunity] = useState<CommercialOpportunity | null>(null);
  const [nextCode, setNextCode] = useState<string>('OPP-2026-001');

  // Campos de Formulario (Paso Único)
  const [opportunityTitle, setOpportunityTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [serviceType, setServiceType] = useState('gpr_localizacion');
  const [estimatedValue, setEstimatedValue] = useState<number | ''>('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Cargar consecutivo inicial sugerido
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/tools/commercial-pipeline');
        if (res.ok) {
          const json = await res.json();
          const opps = json.data?.opportunities || [];
          const nextNum = opps.length + 1;
          const year = new Date().getFullYear();
          setNextCode(`OPP-${year}-${String(nextNum).padStart(3, '0')}`);
        }
      } catch {}
    }
    loadStats();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!opportunityTitle.trim() || !clientName.trim()) {
      setErrorMessage('El título de la oportunidad y el cliente son obligatorios.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        opportunity_title: opportunityTitle.trim(),
        client_name: clientName.trim(),
        client_contact: clientContact.trim() || null,
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        service_type: serviceType,
        estimated_value: estimatedValue !== '' ? Number(estimatedValue) : null,
        deadline_date: deadlineDate || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      };

      const res = await fetch('/api/forms/registro-oportunidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al registrar la oportunidad');

      setSavedOpportunity(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pantalla de Éxito
  if (savedOpportunity) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <Navbar />

        <div className="page-hero">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
              <Target className="w-7 h-7 text-accent" strokeWidth={1.75} />
              Oportunidad Comercial Registrada
            </h1>
            <p className="text-white/70 text-sm mt-1">
              FOR-CMR-001 — Entrada formal al Pipeline comercial de PROCIMEC INGENIERÍA S.A.S.
            </p>
          </div>
        </div>

        <main className="flex-1 max-w-4xl mx-auto px-4 -mt-6 pb-20 w-full space-y-6">
          <div className="card p-6 sm:p-8 text-center bg-white border border-border shadow-card">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="font-mono text-sm font-bold px-3 py-1 rounded-full bg-accent/20 text-primary-900 border border-accent/40 inline-block mb-3">
              {savedOpportunity.opportunity_code || nextCode}
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              Oportunidad Radicada con Éxito
            </h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
              El prospecto <strong className="text-text-primary">{savedOpportunity.opportunity_title}</strong> ha sido integrado al pipeline comercial bajo auditoría inmutable.
            </p>

            <div className="bg-surface border border-border rounded-xl p-4 text-left max-w-lg mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-muted block">Cliente:</span>
                <span className="font-semibold text-text-primary">{savedOpportunity.client_name}</span>
              </div>
              <div>
                <span className="text-text-muted block">Línea de Servicio:</span>
                <span className="font-semibold text-text-primary">{savedOpportunity.service_type}</span>
              </div>
              <div>
                <span className="text-text-muted block">Presupuesto Estimado:</span>
                <span className="font-mono font-bold text-accent-800">
                  {savedOpportunity.estimated_value ? formatCOP(savedOpportunity.estimated_value) : 'Por definir'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">Fecha Límite:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {savedOpportunity.deadline_date || 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => generateOpportunityPdf(savedOpportunity)}
                className="btn btn-secondary text-xs flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Descargar Ficha PDF (FOR-CMR-001)
              </button>

              <Link
                href={`/forms/presupuesto-proyecto?opportunity_id=${savedOpportunity.id}`}
                className="btn btn-accent text-xs flex items-center gap-2 shadow-sm"
              >
                <Calculator className="w-4 h-4" strokeWidth={2} />
                Elaborar Presupuesto APU
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Header Corporativo Oscuro Oficial */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Target className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Registro de Oportunidad / Licitación
              </h1>
              <p className="text-white/70 text-sm mt-1">
                FOR-CMR-001 — Entrada de prospectos, pliegos licitatorios y requerimientos de ingeniería
              </p>
            </div>
            <div className="bg-primary-900/60 border border-accent/40 rounded-xl px-3.5 py-1.5 text-right w-fit">
              <span className="text-[10px] text-white/70 uppercase tracking-wider block">Consecutivo Previsto</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-accent">{nextCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal (Superficie Clara PCM CLOUD) */}
      <main className="flex-1 max-w-4xl mx-auto px-4 -mt-6 pb-20 w-full space-y-6">
        {errorMessage && (
          <div className="card p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tarjeta 1: Información General del Prospecto */}
          <div className="card p-5 sm:p-6 bg-white border border-border shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="w-4 h-4 text-accent" strokeWidth={1.75} />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                1. Información del Cliente & Oportunidad
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Nombre de la Oportunidad / Licitación *
                </label>
                <input
                  type="text"
                  required
                  value={opportunityTitle}
                  onChange={(e) => setOpportunityTitle(e.target.value)}
                  placeholder="Ej: Exploración GPR y Topografía Troncal 4G Consorcio Vial"
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Empresa o Cliente Potencial *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Consorcio Vías del Norte / Ecopetrol"
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="Ing. Carlos Mendoza"
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="carlos.mendoza@empresa.com"
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Teléfono / Móvil
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+57 300 123 4567"
                  className="input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Ubicación Geográfica del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Municipio, Departamento (Ej: Barrancabermeja, Santander)"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Parámetros Técnicos y Económicos */}
          <div className="card p-5 sm:p-6 bg-white border border-border shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                2. Parámetros Técnicos & Alcance
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Línea de Servicio Principal *
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="select"
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Presupuesto Estimado del Cliente (COP, Opcional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Monto aproximado en pesos colombianos"
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Fecha Límite de Entrega de Propuesta *
                </label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Alcance Solicitado, Requerimientos Clave y Pliegos
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Metros lineales estimados, especificaciones de planta, pólizas requeridas..."
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción de Paso Único */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/dashboard" className="btn btn-ghost text-xs">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-accent text-xs shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? 'Guardando Oportunidad...' : 'Guardar Oportunidad Comercial'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
