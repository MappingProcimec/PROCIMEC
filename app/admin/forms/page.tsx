'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, ArrowRight, Layers, Paperclip, ShieldCheck } from 'lucide-react';

interface Form {
  id: string;
  slug: string;
  name: string;
  description?: string;
  steps_count: number;
  has_attachments: boolean;
  created_at?: string;
}

async function fetchFormsData(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return (json.data ?? []) as Form[];
}

const FORM_SLUG_STYLE: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  'gpr-field-form': { icon: '📍', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'cad-register-form': { icon: '✏️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  'hseq-report': { icon: '🦺', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  'elaboracion-cartas': { icon: '📄', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'registro-equipo': { icon: '📦', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  // Compras
  'requerimiento-compra': { icon: '🛒', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  'orden-compra': { icon: '📝', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  'evaluacion-proveedor': { icon: '⭐', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  // Comercial
  'registro-oportunidad': { icon: '🎯', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'cotizacion-comercial': { icon: '📊', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'cierre-comercial': { icon: '🤝', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  // Finanzas
  'solicitud-viaticos': { icon: '✈️', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'legalizacion-gastos': { icon: '🧾', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'registro-pago': { icon: '💳', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  // Contabilidad
  'radicacion-factura': { icon: '📑', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  'soporte-cobro': { icon: '💰', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
};

export default function AdminFormsPage() {
  const [search, setSearch] = useState('');

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['admin-forms'],
    queryFn: fetchFormsData,
  });

  const filteredForms = forms.filter((f) => {
    return (
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.slug.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Page Hero */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <ClipboardList className="w-7 h-7 text-accent" strokeWidth={1.75} /> Catálogo de Formularios Operativos
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Formatos oficiales de captura de datos de PROCIMEC para campo, almacén, dibujo y operaciones
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Buscador */}
        <div className="card border border-border shadow-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-text-primary">Formatos de Entrada</h2>
            <span className="badge badge-primary text-xs">
              {filteredForms.length} {filteredForms.length === 1 ? 'formulario' : 'formularios'}
            </span>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar formulario por nombre o slug..."
              className="input pl-9 text-xs py-2 w-full"
            />
          </div>
        </div>

        {/* Listado de Formularios */}
        <div className="card border border-border shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-text-muted animate-pulse">Cargando formularios...</div>
          ) : filteredForms.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-text-muted text-sm">No se encontraron formularios con &quot;{search}&quot;.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredForms.map((form) => {
                const style = FORM_SLUG_STYLE[form.slug] || {
                  icon: '📋',
                  bg: 'bg-gray-50',
                  border: 'border-gray-200',
                  text: 'text-gray-700',
                };

                return (
                  <div
                    key={form.id}
                    className="px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Ícono y datos */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0 shadow-xs ${style.bg} ${style.border}`}
                      >
                        {style.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                            {form.name}
                          </h3>
                          <span className="text-[10px] font-mono text-text-muted bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {form.slug}
                          </span>
                          {form.has_attachments && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" strokeWidth={2} /> Adjuntos
                            </span>
                          )}
                        </div>
                        {form.description && (
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {form.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botón de acción */}
                    <div className="flex items-center gap-3 flex-shrink-0 justify-end">
                      <Link
                        href={`/forms/${form.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-600 transition-all shadow-xs group-hover:scale-102"
                      >
                        <span>Diligenciar Formulario</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Banner Informativo */}
        <div className="card border border-border p-5 bg-gradient-to-r from-blue-50/60 to-primary-50/40 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text-primary text-sm">
                Asignación de Formularios a Roles
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Los formularios se asignan dinámicamente según el rol del colaborador. Para configurar qué formularios aparecen en "Mis Formularios" en el panel de cada usuario, dirígete a{' '}
                <Link href="/admin/roles" className="text-primary font-bold hover:underline">
                  Gestión de Roles →
                </Link>{' '}
                o visita el{' '}
                <Link href="/admin/tools" className="text-primary font-bold hover:underline">
                  Catálogo de Herramientas →
                </Link>{' '}
                para utilidades técnicas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
