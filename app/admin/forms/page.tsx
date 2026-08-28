'use client';

import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';

interface Form {
  id: string;
  slug: string;
  name: string;
  description?: string;
  steps_count: number;
  has_attachments: boolean;
  created_at: string;
}

async function fetchForms(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return json.data ?? [];
}

const SLUG_COLOR: Record<string, string> = {
  'gpr-field-form': 'bg-blue-50 border-blue-200 text-blue-700',
  'cad-register-form': 'bg-amber-50 border-amber-200 text-amber-700',
};

const SLUG_ICON: Record<string, string> = {
  'gpr-field-form': '📍',
  'cad-register-form': '✏️',
};

export default function AdminFormsPage() {
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['admin-forms'],
    queryFn: fetchForms,
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">📋 Formularios</h1>
            <p className="text-white/70 text-sm mt-1">
              Catálogo de formularios disponibles en la plataforma (haz clic en cualquier formulario para abrirlo)
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-20 space-y-6">

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📋</div>
            <div>
              <div className="text-xl font-bold text-text-primary">{forms.length}</div>
              <div className="text-xs text-text-muted">Formularios totales</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📍</div>
            <div>
              <div className="text-xl font-bold text-text-primary">
                {forms.filter((f) => f.slug.startsWith('gpr')).length}
              </div>
              <div className="text-xs text-text-muted">Formularios GPR</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">✏️</div>
            <div>
              <div className="text-xl font-bold text-text-primary">
                {forms.filter((f) => f.slug.startsWith('cad')).length}
              </div>
              <div className="text-xs text-text-muted">Formularios CAD</div>
            </div>
          </div>
        </div>

        {/* Lista de formularios */}
        <div className="card border border-border shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-text-primary">Catálogo de Formularios</h2>
            <span className="badge badge-primary text-xs">{forms.length}</span>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-text-muted animate-pulse">Cargando...</div>
          ) : forms.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-text-muted text-sm">No hay formularios registrados en el catálogo.</p>
              <p className="text-text-muted text-xs mt-1">
                Los formularios se crean ejecutando el script SQL del schema.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {forms.map((f) => (
                <Link
                  key={f.id}
                  href={`/forms/${f.slug}`}
                  className="px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-3 group cursor-pointer"
                >
                  {/* Ícono y nombre */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl flex-shrink-0 ${SLUG_COLOR[f.slug] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {SLUG_ICON[f.slug] ?? '📋'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">{f.name}</p>
                      <p className="text-xs text-text-muted font-mono mt-0.5">{f.slug}</p>
                      {f.description && (
                        <p className="text-xs text-text-secondary mt-1">{f.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Metadatos y Botón de acción */}
                  <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      🪜 {f.steps_count} {f.steps_count === 1 ? 'paso' : 'pasos'}
                    </span>
                    {f.has_attachments && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        📎 Adjuntos
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold group-hover:bg-primary-600 transition-colors shadow-xs">
                      👁️ Abrir →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="card border border-border p-5 bg-blue-50/50">
          <h3 className="font-semibold text-text-primary mb-2 text-sm">ℹ️ ¿Cómo asignar formularios a roles?</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Los formularios del catálogo se asignan a los roles desde{' '}
            <Link href="/admin/roles" className="text-primary font-semibold hover:underline">
              Gestión de Roles →
            </Link>{' '}
            Edita cualquier rol y en el Paso 2 podrás marcar los formularios que tendrá disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}
