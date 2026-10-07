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
} from 'lucide-react';
import { BudgetItem, CommercialOpportunity, CommercialBudget } from '@/types';
import { generateBudgetPdf } from '@/lib/commercial/commercialPdfGenerator';

const SERVICE_CATEGORIES = [
  { value: 'mapping_geofisica', label: 'Georradar GPR y Geofísica Aplicada' },
  { value: 'civil_planta', label: 'Obras Civiles y Adecuaciones en Planta In-House' },
  { value: 'montaje_mecanico', label: 'Montajes Mecánicos, Piping y Estructuras' },
  { value: 'topografia_industrial', label: 'Topografía Industrial y Modelado BIM' },
  { value: 'interventoria_obra', label: 'Interventoría Técnica y Supervisión de Obra' },
  { value: 'consultoria_diseno', label: 'Consultoría, Memorias de Cálculo e Ingeniería' },
];

const ITEM_CATEGORIES: Array<{ key: BudgetItem['category']; label: string; icon: typeof Layers }> = [
  { key: 'materials', label: 'Materiales e Insumos Civiles / Industriales', icon: Layers },
  { key: 'equipment', label: 'Equipos, Maquinaria y Herramientas', icon: Wrench },
  { key: 'labor', label: 'Personal, Cuadrillas y Mano de Obra Técnica', icon: Users },
  { key: 'logistics', label: 'Logística, Viáticos y Transporte de Planta', icon: Truck },
];

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
      unit: 'M3',
      quantity: 12,
      unit_cost: 450000,
      total_cost: 5400000,
    },
    {
      id: 'item-2',
      category: 'equipment',
      description: 'Andamios multidireccionales certificados (Días)',
      unit: 'Dia',
      quantity: 5,
      unit_cost: 180000,
      total_cost: 900000,
    },
    {
      id: 'item-3',
      category: 'labor',
      description: 'Cuadrilla civil: Oficial de obra + 2 Ayudantes de planta',
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

  // Manejador de cambio de oportunidad vinculada
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

  // Cálculos reactivos por rubro
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

  // Manipulación de ítems
  const handleAddItem = (category: BudgetItem['category']) => {
    const newItem: BudgetItem = {
      id: `item-${Date.now()}`,
      category,
      description: '',
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

  // Envío del presupuesto
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !projectTitle.trim()) {
      alert('Por favor ingrese el nombre del cliente y el título del proyecto.');
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el presupuesto');
      }

      const resJson = await res.json();
      setSavedBudget(resJson.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      alert(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (savedBudget) {
    return (
      <div className="min-h-screen bg-[#15181D] text-slate-100 pb-16">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 pt-6">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />

          <div className="mt-6 bg-[#1E2229] border border-[#2A303C] rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <CheckCircle2 className="w-9 h-9" strokeWidth={1.75} />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Presupuesto Registrado Exitosamente</h1>
            <p className="text-slate-400 text-sm mb-6">
              El presupuesto APU se ha guardado formalmente bajo el código institucional:
            </p>

            <div className="inline-block px-5 py-2.5 bg-[#15181D] border border-amber-500/40 rounded-xl mb-6 font-mono text-amber-400 text-xl font-bold">
              {savedBudget.budget_code}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-8 text-left bg-[#15181D]/60 p-4 rounded-xl border border-[#2A303C]">
              <div>
                <span className="text-xs text-slate-400 block">Costos Directos</span>
                <span className="font-mono text-sm font-semibold text-slate-200">
                  {formatCOP(savedBudget.total_direct_cost)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">AIU ({savedBudget.aiu_percentage}%)</span>
                <span className="font-mono text-sm font-semibold text-amber-300">
                  {formatCOP(Math.round((savedBudget.total_direct_cost * savedBudget.aiu_percentage) / 100))}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Venta Sugerida</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {formatCOP(savedBudget.suggested_sale_price)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => generateBudgetPdf(savedBudget)}
                className="px-5 py-3 rounded-xl bg-[#2A303C] hover:bg-[#323946] text-white font-semibold flex items-center gap-2 border border-slate-600 transition-all text-sm"
              >
                <Download className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                Descargar PDF Oficial (FOR-CMR-004)
              </button>

              <Link
                href={`/forms/cotizacion-comercial?budget_id=${savedBudget.id}&client_name=${encodeURIComponent(savedBudget.client_name)}&scope=${encodeURIComponent(savedBudget.project_title)}&subtotal=${savedBudget.suggested_sale_price}`}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 text-sm"
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
    <div className="min-h-screen bg-[#15181D] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 pt-6">
        <BackButton href="/dashboard" label="Volver a Mi Panel" />

        {/* Encabezado Principal */}
        <div className="mt-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A303C] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Calculator className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Presupuesto Operativo y APU de Ingeniería
              </h1>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              FOR-CMR-004 — Estructura de costos directos (materiales, equipos, mano de obra, logística) y cálculo de AIU.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#1E2229] border border-amber-500/40 rounded-xl px-3.5 py-2 text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Consecutivo Previsto</span>
              <span className="font-mono text-sm font-bold text-amber-400">{nextBudgetCode}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bloque 1: Vinculación Opcional y Datos del Proyecto */}
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4" strokeWidth={1.75} />
              1. Identificación del Proyecto & Vínculo Opcional
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selector Opcional de Oportunidad */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ¿Vincular a una Oportunidad / Licitación Existente? (Opcional)
                </label>
                <select
                  value={selectedOpportunityId}
                  onChange={(e) => handleOpportunityChange(e.target.value)}
                  className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Presupuesto Independiente / Sin Oportunidad Previa</option>
                  {opportunities.map((opp) => (
                    <option key={opp.id} value={opp.id}>
                      {opp.opportunity_code || 'OPP'} — {opp.client_name}: {opp.opportunity_title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Si se selecciona una oportunidad, se precargarán cliente, título y tipo de servicio automáticamente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cliente o Destinatario *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Ecopetrol / Consorcio Vial / Planta Bavaria"
                  className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Especialidad de Ingeniería *
                </label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Título del Proyecto / Alcance Presupuestado *
                </label>
                <input
                  type="text"
                  required
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Ej: Adecuación losa industrial y nivelación de pisos nave 3"
                  className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Bloque 2: Desglose de Costos Directos (APU) */}
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 md:p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A303C] pb-3">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" strokeWidth={1.75} />
                2. Rubros de Costos Directos (APU)
              </h2>
              <span className="text-xs text-slate-400">
                Materiales, Equipos, Mano de Obra y Logística de Planta
              </span>
            </div>

            {ITEM_CATEGORIES.map((catGroup) => {
              const catItems = items.filter((it) => it.category === catGroup.key);
              const subtotalCat = totalsByCategory[catGroup.key];
              const IconComp = catGroup.icon;

              return (
                <div key={catGroup.key} className="bg-[#15181D]/80 border border-[#2A303C] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <IconComp className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                      <h3 className="text-xs md:text-sm font-bold text-slate-200">{catGroup.label}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-amber-400">
                        Subtotal: {formatCOP(subtotalCat)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(catGroup.key)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                        Agregar Ítem
                      </button>
                    </div>
                  </div>

                  {catItems.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No hay ítems registrados en este rubro. Presione &quot;Agregar Ítem&quot; si aplica.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {catItems.map((it) => (
                        <div
                          key={it.id}
                          className="grid grid-cols-12 gap-2 items-center bg-[#1E2229] p-2.5 rounded-lg border border-[#2A303C]"
                        >
                          <div className="col-span-12 sm:col-span-5">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                              placeholder="Descripción del material, cuadrilla o equipo..."
                              className="w-full bg-[#15181D] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-2">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleUpdateItem(it.id, 'unit', e.target.value)}
                              placeholder="Und / M3 / Dia"
                              className="w-full bg-[#15181D] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItem(it.id, 'quantity', e.target.value)}
                              placeholder="Cant"
                              className="w-full bg-[#15181D] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={it.unit_cost}
                              onChange={(e) => handleUpdateItem(it.id, 'unit_cost', e.target.value)}
                              placeholder="Vr. Unit"
                              className="w-full bg-[#15181D] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="text-slate-500 hover:text-red-400 p-1 transition-colors"
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

          {/* Bloque 3: AIU, Margen Comercial y Consolidado Económico */}
          <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4" strokeWidth={1.75} />
              3. AIU y Determinación del Precio de Venta Sugerido
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                    className="w-28 bg-[#15181D] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-right text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-slate-400 text-sm font-semibold">%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Típico en ingeniería civil / contratos en planta: 20% a 30%.
                </p>
              </div>

              <div className="md:col-span-2 bg-[#15181D] border border-[#2A303C] rounded-xl p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Costo Directo (CD)</span>
                    <span className="font-mono text-sm md:text-base font-bold text-slate-200">
                      {formatCOP(totalDirectCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 uppercase tracking-wider block">AIU ({aiuPercentage}%)</span>
                    <span className="font-mono text-sm md:text-base font-bold text-amber-300">
                      +{formatCOP(aiuAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Precio Venta Sugerido</span>
                    <span className="font-mono text-base md:text-lg font-bold text-emerald-400">
                      {formatCOP(suggestedSalePrice)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observaciones, Condiciones de Planta y Restricciones Operativas
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Permisos en caliente, certificaciones de soldadura requeridas, ingreso a refinería..."
                className="w-full bg-[#15181D] border border-slate-700 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Botón de Envío */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
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
