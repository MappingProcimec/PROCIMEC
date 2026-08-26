'use client';

import Link from 'next/link';

interface Tool { id: string; slug: string; name: string; category: string }
interface Form { id: string; slug: string; name: string }
interface Project { id: string; code: string; name: string; client: string }
interface ActivityRecord {
  id: string;
  date: string;
  type: string;
  formSlug: string;
  projectName: string;
  projectCode: string;
  detail: string;
}

export interface DashboardData {
  user: { id: string; email: string; full_name: string };
  legacyRole?: string | null;
  division: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
  projects: Project[];
  tools: Tool[];
  forms: Form[];
  recentActivity: ActivityRecord[];
}

const CATEGORY_LABEL: Record<string, string> = {
  gpr: 'GPR / Campo',
  cad: 'CAD / BIM',
  admin: 'Administración',
  universal: 'Universal',
};

const CATEGORY_CHIP: Record<string, string> = {
  gpr: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
  cad: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
  admin: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
  universal: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
};

export function DynamicDashboard({ data }: { data: DashboardData }) {
  const { user, division, role, projects, tools, forms, recentActivity, legacyRole } = data;
  const isLegacyDibujo = legacyRole === 'dibujo' && !role;

  const toolsByCategory = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const firstName = user.full_name?.split(' ')[0] || 'Usuario';

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card border border-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary">
              Hola, {firstName} 👋
            </h2>
            <p className="text-sm text-text-muted truncate">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {role ? (
                <span className="badge badge-primary text-xs">{role.name}</span>
              ) : legacyRole ? (
                <span className="badge badge-accent text-xs capitalize">{legacyRole}</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                  Sin rol asignado
                </span>
              )}
              {division && (
                <span className="badge badge-accent text-xs">{division.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-text-primary">Mis Proyectos</h2>
            {projects.length > 4 && (
              <Link href="/projects" className="text-xs text-primary font-semibold hover:underline">
                Ver todos ({projects.length}) →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="card border border-border p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">{p.code}</p>
                    <p className="text-sm font-semibold text-text-primary truncate mt-0.5 group-hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs text-text-muted mt-1 truncate">{p.client}</p>
                  </div>
                  <span className="text-text-muted text-sm mt-0.5 flex-shrink-0">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-3">Mis Herramientas</h2>
          <div className="space-y-3">
            {Object.entries(toolsByCategory).map(([cat, catTools]) => (
              <div key={cat} className="card border border-border p-4">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">
                  {CATEGORY_LABEL[cat] ?? cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {catTools.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tools/${t.slug}`}
                      className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${CATEGORY_CHIP[cat] ?? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Forms */}
      {forms.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-3">Mis Formularios</h2>
          <div className="card border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {forms.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/forms/${f.slug}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-lg flex-shrink-0">📋</span>
                    <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors flex-1">
                      {f.name}
                    </span>
                    <span className="text-text-muted text-sm flex-shrink-0">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <section>
          <h2 className="font-bold text-text-primary mb-3">Actividad Reciente</h2>
          <div className="card border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[10px] text-amber-700 font-bold flex-shrink-0 leading-tight text-center">
                    CAD
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{a.projectName}</p>
                    <p className="text-xs text-text-muted">
                      {a.type} · {a.detail} ·{' '}
                      {new Date(a.date + 'T00:00:00').toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <Link
                    href={`/forms/${a.formSlug}`}
                    className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                  >
                    Nuevo →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Módulo legacy Dibujante (usuarios con role='dibujo' sin role_id asignado) */}
      {isLegacyDibujo && (
        <section>
          <h2 className="font-bold text-text-primary mb-3">Módulo Dibujante</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dibujo/nueva-actividad"
              className="card border border-amber-200 bg-amber-50 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✏️</span>
                <div>
                  <p className="text-sm font-bold text-amber-900 group-hover:text-amber-700 transition-colors">
                    Nueva Actividad CAD
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Registrar horas y software utilizado</p>
                </div>
              </div>
            </Link>
            <Link
              href="/dibujo/tablero"
              className="card border border-blue-200 bg-blue-50 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition-colors">
                    Tablero de Actividades
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">Métricas e historial de registros</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Empty state: no legacy role ni role_id */}
      {projects.length === 0 && tools.length === 0 && forms.length === 0 && !isLegacyDibujo && (
        <div className="card border border-border p-10 text-center space-y-2">
          <p className="text-2xl">⚙️</p>
          <p className="text-sm font-medium text-text-primary">Panel sin configurar</p>
          <p className="text-xs text-text-muted max-w-xs mx-auto">
            Tu cuenta aún no tiene proyectos, herramientas o formularios asignados. Contacta a un administrador.
          </p>
        </div>
      )}
    </div>
  );
}
