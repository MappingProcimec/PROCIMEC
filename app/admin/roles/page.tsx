'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { CreateRoleModal } from '@/components/admin/CreateRoleModal';

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
  gpr: 'bg-amber-50 text-amber-900 border border-amber-200',
  cad: 'bg-slate-100 text-slate-800 border border-slate-200',
  admin: 'bg-purple-50 text-purple-900 border border-purple-200',
  universal: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  hseq: 'bg-teal-50 text-teal-900 border border-teal-200',
  rrhh: 'bg-indigo-50 text-indigo-900 border border-indigo-200',
};

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch('/api/admin/roles');
  const json = await res.json();
  return json.data ?? [];
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const [toastNotice, setToastNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastNotice({ message, type });
    setTimeout(() => {
      setToastNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: fetchRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al eliminar el rol');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setRoleToDelete(null);
      showToast('Rol eliminado exitosamente', 'success');
    },
    onError: (e: Error) => {
      showToast(e.message, 'error');
    },
  });

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico según AGENTS.md */}
      <div className="page-hero">
        <div className="max-w-5xl mx-auto space-y-2">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Shield className="w-7 h-7 text-accent" strokeWidth={1.75} /> Roles del Sistema
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Definición de perfiles operativos, asignación a divisiones y matrices de permisos.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-accent px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 shadow-md active:scale-[0.98] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Nuevo Rol
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-8 pb-20 w-full flex-1">
        {isLoading ? (
          <div className="card p-12 text-center text-text-muted space-y-2">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Cargando roles...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="card p-12 text-center border border-border space-y-3">
            <Shield className="w-10 h-10 text-slate-300 mx-auto" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-primary">No hay roles creados.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-sm btn-accent text-xs px-4 py-2 font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Crear el primer rol
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map((role) => (
              <div
                key={role.id}
                className="card border border-border shadow-sm hover:shadow-card transition-all p-5 space-y-3 bg-white"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-text-primary text-base">{role.name}</h3>
                    {role.divisions ? (
                      <p className="text-xs text-text-muted mt-0.5">{role.divisions.name}</p>
                    ) : (
                      <p className="text-xs text-accent-800 font-bold mt-0.5">Global (Todas las divisiones)</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {role.is_system_role ? (
                      <span className="badge bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold">
                        Sistema
                      </span>
                    ) : (
                      <span className="badge bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-semibold">
                        Personalizado
                      </span>
                    )}
                  </div>
                </div>

                {/* Tools chips */}
                {role.role_tools.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                      Herramientas ({role.role_tools.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {role.role_tools.map(({ tools: t }) => (
                        <span
                          key={t.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            CATEGORY_COLOR[t.category] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forms chips (Cero Emojis) */}
                {role.role_forms.filter((rf) => rf.forms != null).length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                      Formularios ({role.role_forms.filter((rf) => rf.forms != null).length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {role.role_forms
                        .filter((rf) => rf.forms != null)
                        .map(({ forms: f }) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            <FileText className="w-3 h-3 text-slate-500" strokeWidth={1.75} />
                            <span>{f.name}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <Link
                    href={`/admin/roles/${role.id}`}
                    className="text-xs font-bold text-primary hover:text-accent transition-colors"
                  >
                    Editar permisos
                  </Link>
                  {!role.is_system_role && (
                    <button
                      onClick={() => setRoleToDelete(role)}
                      className="text-xs font-bold text-amber-700 hover:text-red-700 transition-colors"
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

      {/* Modal Confirmación de Eliminación */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl space-y-4 border border-border animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-600" strokeWidth={1.75} />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-text-primary">¿Eliminar este rol?</h3>
              <p className="text-xs text-text-secondary">
                Estás a punto de eliminar el rol{' '}
                <span className="font-bold text-text-primary">{roleToDelete.name}</span>.
              </p>
              <div className="text-xs text-amber-900 bg-amber-50/80 p-3 rounded-xl border border-amber-200 mt-2 text-left leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>
                  Los colaboradores que tengan este rol asignado perderán los accesos y herramientas
                  heredadas de este perfil.
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                disabled={deleteMutation.isPending}
                className="btn-ghost flex-1 text-xs py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(roleToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 text-xs py-2.5 bg-primary-900 hover:bg-black text-amber-400 border border-primary-800 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificación */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border bg-primary-950 text-white border-primary-800">
          {toastNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" strokeWidth={2} />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={2} />
          )}
          <span className="text-xs font-medium text-white/95 max-w-sm">{toastNotice.message}</span>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-white/60 hover:text-white ml-2 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

