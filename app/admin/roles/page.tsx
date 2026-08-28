'use client';

import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Tool { id: string; slug: string; name: string; category: string }
interface Form { id: string; slug: string; name: string }
interface Division { id: string; name: string }
interface Role {
  id: string;
  name: string;
  division_id: string | null;
  is_system_role: boolean;
  divisions: Division | null;
  role_tools: { tools: Tool }[];
  role_forms: { forms: Form }[];
}

const CATEGORY_COLOR: Record<string, string> = {
  gpr: 'bg-blue-50 text-blue-700',
  cad: 'bg-amber-50 text-amber-700',
  admin: 'bg-purple-50 text-purple-700',
  universal: 'bg-emerald-50 text-emerald-700',
};

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch('/api/admin/roles');
  const json = await res.json();
  return json.data ?? [];
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: fetchRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al eliminar');
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
    onError: (e: Error) => alert(e.message),
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Roles</h1>
              <p className="text-white/70 text-sm mt-1">Roles del sistema y personalizados</p>
            </div>
            <Link
              href="/admin/roles/new"
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo Rol
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20">
        {isLoading ? (
          <div className="card p-10 text-center text-text-muted animate-pulse">Cargando roles...</div>
        ) : roles.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-text-muted text-sm">No hay roles creados.</p>
            <Link href="/admin/roles/new" className="mt-3 text-primary text-sm font-medium hover:underline block">
              Crear el primer rol
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="card border border-border shadow-sm hover:shadow-md transition-shadow p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-text-primary">{role.name}</h3>
                    {role.divisions && (
                      <p className="text-xs text-text-muted mt-0.5">{role.divisions.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {role.is_system_role ? (
                      <span className="badge badge-accent text-xs">Sistema</span>
                    ) : (
                      <span className="badge badge-success text-xs">Personalizado</span>
                    )}
                  </div>
                </div>

                {/* Tools chips */}
                {role.role_tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {role.role_tools.map(({ tools: t }) => (
                      <span
                        key={t.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOR[t.category] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Forms chips */}
                {role.role_forms.filter((rf) => rf.forms != null).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {role.role_forms.filter((rf) => rf.forms != null).map(({ forms: f }) => (
                      <span key={f.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        📋 {f.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                  <Link
                    href={`/admin/roles/${role.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Editar
                  </Link>
                  {!role.is_system_role && (
                    <button
                      onClick={() => { if (confirm(`¿Eliminar el rol "${role.name}"?`)) deleteMutation.mutate(role.id); }}
                      className="text-xs font-semibold text-error hover:underline"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
