'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Briefcase,
  Layers,
  Wrench,
  Users,
  Truck,
  ArrowRight,
  Download,
  ChevronDown,
  Check,
} from 'lucide-react';
import { BudgetItem, CommercialOpportunity, CommercialBudget } from '@/types';
import { generateBudgetPdf } from '@/lib/commercial/commercialPdfGenerator';

const SERVICE_CATEGORIES = [
  { value: 'civil_planta', label: 'Obras Civiles y Adecuaciones en Planta In-House' },
  { value: 'montaje_mecanico', label: 'Montajes Mecánicos, Piping y Estructuras Metálicas' },
  { value: 'mapping_geofisica', label: 'Georradar GPR y Geofísica Aplicada' },
  { value: 'topografia_industrial', label: 'Topografía Industrial y Modelado CAD/BIM' },
  { value: 'interventoria_obra', label: 'Interventoría Técnica y Supervisión de Obra' },
  { value: 'consultoria_diseno', label: 'Consultoría, Memorias de Cálculo e Ingeniería' },
];

const ITEM_CATEGORIES: Array<{ key: BudgetItem['category']; label: string; icon: typeof Layers }> = [
  { key: 'materials', label: '1. Materiales e Insumos Civiles / Industriales', icon: Layers },
  { key: 'equipment', label: '2. Equipos, Maquinaria y Herramientas', icon: Wrench },
  { key: 'labor', label: '3. Personal, Cuadrillas y Mano de Obra Técnica', icon: Users },
  { key: 'logistics', label: '4. Logística, Viáticos y Transporte de Planta', icon: Truck },
];

const COMMON_UNITS = [
  'UND',
  'DIA',
  'MES',
  'HR',
  'ML',
  'M2',
  'M3',
  'KM',
  'HA',
  'KG',
  'TON',
  'GL',
  'LT',
  'PTO',
  'VIAJE',
  'GLOBAL',
  'CUADRILLA-DIA',
  'JORNAL',
  'TRAMO',
  'BOLSA',
  'CAJA',
  'JUEGO',
];

function UnitCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="UND"
          className="input text-xs py-1.5 pr-6 text-center font-mono uppercase w-full bg-white text-text-primary border-border focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
          title="Seleccionar unidad de la lista o escribir"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 w-40 max-h-48 overflow-y-auto bg-white border border-border shadow-xl rounded-lg py-1 z-50 text-xs animate-in fade-in zoom-in-95">
            <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border bg-slate-50">
              Seleccionar o escribir
            </div>
            {COMMON_UNITS.map((u) => {
              const isSelected = value.toUpperCase() === u.toUpperCase();
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    onChange(u);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between font-mono ${
                    isSelected ? 'bg-amber-50 text-amber-900 font-bold' : 'text-text-primary'
                  }`}
                >
                  <span>{u}</span>
                  {isSelected && <Check className="w-3 h-3 text-accent" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PresupuestoProyectoPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [nextBudgetCode, setNextBudgetCode] = useState<string>('PRE-2026-001');

  // Form Header States
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [serviceCategory, setServiceCategory] = useState<string>('civil_planta');
  const [notes, setNotes] = useState<string>('');

  // Items Detail
  const [items, setItems] = useState<BudgetItem[]>([
    {
      id: 'item-1',
      category: 'materials',
      description: 'Concreto MR 4.2 / 3000 PSI para losa de planta',
      brand: 'Argos',
      suggested_supplier: 'Concretos del Norte',
      unit: 'M3',
      quantity: 12,
      unit_cost: 450000,
      total_cost: 5400000,
    },
    {
      id: 'item-2',
      category: 'equipment',
      description: 'Andamios multidireccionales certificados (Días)',
      brand: 'Layher',
      suggested_supplier: 'Alquileres Andinos',
      unit: 'Dia',
      quantity: 5,
      unit_cost: 180000,
      total_cost: 900000,
    },
    {
      id: 'item-3',
      category: 'labor',
      description: 'Cuadrilla civil: Oficial de obra + 2 Ayudantes de planta',
      brand: 'In-House',
      suggested_supplier: 'PROCIMEC Operaciones',
      unit: 'Dia',
      quantity: 5,
      unit_cost: 380000,
      total_cost: 1900000,
    },
  ]);

  // AIU
  const [aiuPercentage, setAiuPercentage] = useState<number>(25.0);
  const [savedBudget, setSavedBudget] = useState<CommercialBudget | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/forms/presupuesto-proyecto');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setOpportunities(json.data.opportunities || []);
            if (json.data.nextCode) setNextBudgetCode(json.data.nextCode);
          }
        }
      } catch (err) {
        console.error('Error cargando datos de presupuesto:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Prellenar si viene query param opportunity_id
  useEffect(() => {
    if (typeof window !== 'undefined' && opportunities.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const oppId = params.get('opportunity_id');
      if (oppId) {
        handleOpportunityChange(oppId);
      }
    }
  }, [opportunities]);

  const handleOpportunityChange = (oppId: string) => {
    setSelectedOpportunityId(oppId);
    if (!oppId) return;

    const selectedOpp = opportunities.find((o) => o.id === oppId);
    if (selectedOpp) {
      setClientName(selectedOpp.client_name || '');
      setProjectTitle(selectedOpp.opportunity_title || '');
      if (selectedOpp.service_type === 'gpr_localizacion') {
        setServiceCategory('mapping_geofisica');
      } else if (selectedOpp.service_type === 'topografia_cad') {
        setServiceCategory('topografia_industrial');
      } else {
        setServiceCategory('civil_planta');
      }
    }
  };

  const totalsByCategory = useMemo(() => {
    const cats: Record<BudgetItem['category'], number> = {
      materials: 0,
      equipment: 0,
      labor: 0,
      logistics: 0,
      subcontracts: 0,
    };
    items.forEach((it) => {
      cats[it.category] = (cats[it.category] || 0) + (Number(it.total_cost) || 0);
    });
    return cats;
  }, [items]);

  const totalDirectCost = useMemo(() => {
    return (
      totalsByCategory.materials +
      totalsByCategory.equipment +
      totalsByCategory.labor +
      totalsByCategory.logistics +
      totalsByCategory.subcontracts
    );
  }, [totalsByCategory]);

  const aiuAmount = useMemo(() => {
    return Math.round((totalDirectCost * (aiuPercentage || 0)) / 100);
  }, [totalDirectCost, aiuPercentage]);

  const suggestedSalePrice = useMemo(() => {
    return totalDirectCost + aiuAmount;
  }, [totalDirectCost, aiuAmount]);

  const handleAddItem = (category: BudgetItem['category']) => {
    const newItem: BudgetItem = {
      id: `item-${Date.now()}`,
      category,
      description: '',
      brand: '',
      suggested_supplier: '',
      unit: 'Und',
      quantity: 1,
      unit_cost: 0,
      total_cost: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (
    id: string,
    field: keyof BudgetItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unit_cost') {
          const q = field === 'quantity' ? Number(value) || 0 : it.quantity;
          const u = field === 'unit_cost' ? Number(value) || 0 : it.unit_cost;
          updated.total_cost = q * u;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!clientName.trim() || !projectTitle.trim()) {
      setErrorMessage('Por favor ingrese el nombre del cliente y el título del proyecto.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        opportunity_id: selectedOpportunityId || null,
        client_name: clientName,
        project_title: projectTitle,
        service_category: serviceCategory,
        direct_cost_materials: totalsByCategory.materials,
        direct_cost_equipment: totalsByCategory.equipment,
        direct_cost_labor: totalsByCategory.labor,
        direct_cost_logistics: totalsByCategory.logistics,
        aiu_percentage: aiuPercentage,
        items_detail: items,
        notes,
        status: 'draft',
      };

      const res = await fetch('/api/forms/presupuesto-proyecto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al guardar el presupuesto');

      setSavedBudget(resJson.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (savedBudget) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <Navbar />
        <div className="page-hero">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
              <Calculator className="w-7 h-7 text-accent" strokeWidth={1.75} />
              Presupuesto APU Registrado con Éxito
            </h1>
            <p className="text-white/70 text-sm mt-1">
              FOR-CMR-004 — Estructura técnica de costos directos y AIU formalizada en PCM CLOUD.
            </p>
          </div>
        </div>

        <main className="flex-1 max-w-4xl mx-auto px-4 -mt-6 pb-20 w-full space-y-6">
          <div className="card p-6 sm:p-8 text-center bg-white border border-border shadow-card">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="font-mono text-sm font-bold px-3 py-1 rounded-full bg-accent/20 text-primary-900 border border-accent/40 inline-block mb-3">
              {savedBudget.budget_code}
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              Presupuesto Guardado Exitosamente
            </h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
              El análisis de precios unitarios y costeo para <strong className="text-text-primary">{savedBudget.project_title}</strong> ha sido registrado.
            </p>

            <div className="bg-surface border border-border rounded-xl p-4 text-left max-w-lg mx-auto mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-text-muted block">Costos Directos (CD):</span>
                <span className="font-mono font-bold text-text-primary text-sm">
                  {formatCOP(savedBudget.total_direct_cost)}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">AIU ({savedBudget.aiu_percentage}%):</span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  +{formatCOP(Math.round((savedBudget.total_direct_cost * savedBudget.aiu_percentage) / 100))}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">Venta Sugerida:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatCOP(savedBudget.suggested_sale_price)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => generateBudgetPdf(savedBudget)}
                className="btn btn-secondary text-xs flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-accent" strokeWidth={1.75} />
                Descargar PDF APU (FOR-CMR-004)
              </button>

              <Link
                href={`/forms/cotizacion-comercial?budget_id=${savedBudget.id}&client_name=${encodeURIComponent(savedBudget.client_name)}&scope=${encodeURIComponent(savedBudget.project_title)}&subtotal=${savedBudget.suggested_sale_price}`}
                className="btn btn-accent text-xs flex items-center gap-2 shadow-sm"
              >
                Generar Cotización desde este Presupuesto
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
        <div className="max-w-5xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Calculator className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Presupuesto Operativo y APU de Ingeniería
              </h1>
              <p className="text-white/70 text-sm mt-1">
                FOR-CMR-004 — Estructura técnica de costos directos (materiales, equipos, mano de obra, logística) y cálculo de AIU
              </p>
            </div>
            <div className="bg-primary-900/60 border border-accent/40 rounded-xl px-3.5 py-1.5 text-right w-fit">
              <span className="text-[10px] text-white/70 uppercase tracking-wider block">Consecutivo Previsto</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-accent">{nextBudgetCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal (Superficie Clara PCM CLOUD) */}
      <main className="flex-1 max-w-5xl mx-auto px-4 -mt-6 pb-20 w-full space-y-6">
        {errorMessage && (
          <div className="card p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tarjeta 1: Identificación y Vínculo Inteligente */}
          <div className="card p-5 sm:p-6 bg-white border border-border shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Briefcase className="w-4 h-4 text-accent" strokeWidth={1.75} />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                1. Identificación del Proyecto & Vínculo Opcional
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  ¿Vincular a una Oportunidad / Licitación Existente? (Opcional)
                </label>
                <select
                  value={selectedOpportunityId}
                  onChange={(e) => handleOpportunityChange(e.target.value)}
                  className="select"
                >
                  <option value="">Presupuesto Independiente / Sin Oportunidad Previa</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.opportunity_code || 'OPP'} — {opp.client_name}: {opp.opportunity_title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  Si seleccionas una oportunidad, se precargarán automáticamente el cliente, el título y la especialidad.
                </p>
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Cliente o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Ecopetrol / Consorcio Vial / Planta Bavaria"
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Especialidad de Ingeniería *
                </label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="select"
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold text-text-secondary mb-1">
                  Título del Proyecto / Objeto Presupuestado *
                </label>
                <input
                  type="text"
                  required
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Ej: Adecuación losa industrial y nivelación de pisos nave 3"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Desglose de Costos Directos (APU) */}
          <div className="card p-5 sm:p-6 bg-white border border-border shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" strokeWidth={1.75} />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  2. Rubros de Costos Directos (APU)
                </h2>
              </div>
              <span className="text-xs text-text-muted">
                Materiales, Equipos, Cuadrillas de Obra y Logística de Planta
              </span>
            </div>

            {ITEM_CATEGORIES.map((catGroup) => {
              const catItems = items.filter((it) => it.category === catGroup.key);
              const subtotalCat = totalsByCategory[catGroup.key];
              const IconComp = catGroup.icon;

              return (
                <div key={catGroup.key} className="bg-surface rounded-xl p-4 border border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <IconComp className="w-4 h-4 text-accent" strokeWidth={1.75} />
                      <h3 className="text-xs sm:text-sm font-bold text-text-primary">{catGroup.label}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-text-primary">
                        Subtotal: {formatCOP(subtotalCat)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(catGroup.key)}
                        className="btn btn-sm btn-secondary text-xs flex items-center gap-1 border-dashed"
                      >
                        <Plus className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                        Agregar Ítem
                      </button>
                    </div>
                  </div>

                  {catItems.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-2">
                      No hay ítems registrados en este rubro. Presiona &quot;Agregar Ítem&quot; si aplica.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="hidden sm:grid grid-cols-12 gap-2 px-2.5 pb-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        <div className="col-span-4">Descripción del Ítem</div>
                        <div className="col-span-2">Marca</div>
                        <div className="col-span-2">Proveedor Sugerido</div>
                        <div className="col-span-1 text-center">Und</div>
                        <div className="col-span-1 text-right">Cant</div>
                        <div className="col-span-1 text-right">Vr. Unit</div>
                        <div className="col-span-1 text-center">Quitar</div>
                      </div>
                      {catItems.map((it) => (
                        <div
                          key={it.id}
                          className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-border shadow-xs"
                        >
                          <div className="col-span-12 sm:col-span-4">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                              placeholder="Descripción detallada del material o servicio..."
                              className="input text-xs py-1.5"
                            />
                          </div>

                          <div className="col-span-6 sm:col-span-2">
                            <input
                              type="text"
                              value={it.brand || ''}
                              onChange={(e) => handleUpdateItem(it.id, 'brand', e.target.value)}
                              placeholder="Marca (ej: Argos)"
                              className="input text-xs py-1.5"
                            />
                          </div>

                          <div className="col-span-6 sm:col-span-2">
                            <input
                              type="text"
                              value={it.suggested_supplier || ''}
                              onChange={(e) => handleUpdateItem(it.id, 'suggested_supplier', e.target.value)}
                              placeholder="Proveedor sugerido..."
                              className="input text-xs py-1.5"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-1">
                            <UnitCombobox
                              value={it.unit}
                              onChange={(val) => handleUpdateItem(it.id, 'unit', val)}
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItem(it.id, 'quantity', e.target.value)}
                              placeholder="Cant"
                              className="input text-xs py-1.5 text-right font-mono"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-1">
                            <input
                              type="number"
                              min="0"
                              value={it.unit_cost}
                              onChange={(e) => handleUpdateItem(it.id, 'unit_cost', e.target.value)}
                              placeholder="Vr. Unit"
                              className="input text-xs py-1.5 text-right font-mono"
                            />
                          </div>

                          <div className="col-span-12 sm:col-span-1 flex justify-end sm:justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-text-muted hover:text-red-600 p-1 transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tarjeta 3: AIU y Consolidado Económico */}
          <div className="card p-5 sm:p-6 bg-white border border-border shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <DollarSign className="w-4 h-4 text-accent" strokeWidth={1.75} />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                3. AIU y Determinación del Precio de Venta Sugerido
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <label className="label text-xs font-semibold text-text-secondary mb-1.5">
                  Porcentaje de AIU (Administración, Imprevistos, Utilidad)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={aiuPercentage}
                    onChange={(e) => setAiuPercentage(Number(e.target.value) || 0)}
                    className="input w-28 text-right font-mono font-bold"
                  />
                  <span className="text-text-muted text-sm font-semibold">%</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  Estándar en ingeniería civil / contratos de planta: 20% a 30%.
                </p>
              </div>

              <div className="md:col-span-2 bg-surface border border-border rounded-xl p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Costo Directo (CD)</span>
                    <span className="font-mono text-sm md:text-base font-bold text-text-primary">
                      {formatCOP(totalDirectCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase tracking-wider block">AIU ({aiuPercentage}%)</span>
                    <span className="font-mono text-sm md:text-base font-bold text-amber-700">
                      +{formatCOP(aiuAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 uppercase tracking-wider block">Precio Venta Sugerido</span>
                    <span className="font-mono text-base md:text-lg font-extrabold text-emerald-700">
                      {formatCOP(suggestedSalePrice)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold text-text-secondary mb-1">
                Condiciones Operativas de Planta, Turnos y Observaciones
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Permisos de trabajo en caliente, pólizas de planta, cursos de alturas requeridos..."
                className="input"
              />
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
              {isSubmitting ? 'Guardando Presupuesto...' : 'Guardar Presupuesto APU'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
