'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Division { id: string; name: string }
interface Tool { id: string; slug: string; name: string; category: string }
interface Form { id: string; slug: string; name: string }
interface User { id: string; email: string; full_name: string; role: string }
interface RoleDetail {
  id: string;
  name: string;
  division_id: string | null;
  is_system_role: boolean;
  divisions: { id: string; name: string } | null;
  role_tools: { tools: Tool }[];
  role_forms: { forms: Form }[];
  users: User[];
}

const CATEGORY_LABEL: Record<string, string> = {
  gpr: 'GPR / Campo',
  cad: 'CAD / BIM',
  admin: 'Administración',
  universal: 'Universal',
};

const CATEGORY_COLOR: Record<string, string> = {
  gpr: 'border-blue-200 bg-blue-50',
  cad: 'border-amber-200 bg-amber-50',
  admin: 'border-purple-200 bg-purple-50',
  universal: 'border-emerald-200 bg-emerald-50',
};

async function fetchRole(id: string): Promise<RoleDetail> {
  const res = await fetch(`/api/admin/roles/${id}`);
  const json = await res.json();
  return json.data;
}

async function fetchDivisions(): Promise<Division[]> {
  const res = await fetch('/api/admin/divisions');
  const json = await res.json();
  return json.data ?? [];
}

async function fetchTools(): Promise<Tool[]> {
  const res = await fetch('/api/admin/tools');
  const json = await res.json();
  return json.data ?? [];
}

async function fetchForms(): Promise<Form[]> {
  const res = await fetch('/api/admin/forms');
  const json = await res.json();
  return json.data ?? [];
}

export default function EditRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['admin-role', roleId],
    queryFn: () => fetchRole(roleId),
  });

  const { data: divisions = [] } = useQuery({ queryKey: ['admin-divisions'], queryFn: fetchDivisions });
  const { data: tools = [] } = useQuery({ queryKey: ['admin-tools'], queryFn: fetchTools });
  const { data: forms = [] } = useQuery({ queryKey: ['admin-forms'], queryFn: fetchForms });

  useEffect(() => {
    if (role && !initialized) {
      setName(role.name);
      setDivisionId(role.division_id ?? '');
      setSelectedTools(new Set(role.role_tools.map((rt) => rt.tools.id)));
      setSelectedForms(new Set(role.role_forms.map((rf) => rf.forms.id)));
      setInitialized(true);
    }
  }, [role, initialized]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          division_id: divisionId || null,
          tool_ids: Array.from(selectedTools),
          form_ids: Array.from(selectedForms),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al actualizar rol');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      router.push('/admin/roles');
    },
    onError: (e: Error) => setError(e.message),
  });

  const toolsByCategory = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleForm = (id: string) => {
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre del rol es obligatorio'); return; }
    setError('');
    setStep(2);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <div className="page-hero"><div className="max-w-3xl mx-auto"><BackButton href="/admin/roles" label="Roles" /></div></div>
        <div className="max-w-3xl mx-auto px-4 -mt-6">
          <div className="card p-10 text-center text-text-muted animate-pulse">Cargando rol...</div>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <div className="page-hero"><div className="max-w-3xl mx-auto"><BackButton href="/admin/roles" label="Roles" /></div></div>
        <div className="max-w-3xl mx-auto px-4 -mt-6">
          <div className="card p-10 text-center text-text-muted">Rol no encontrado.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-3xl mx-auto">
          <BackButton href="/admin/roles" label="Roles" />
          <div className="flex items-center gap-3 mt-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{role.name}</h1>
            {role.is_system_role && (
              <span className="badge badge-accent text-xs">Sistema</span>
            )}
          </div>
          <p className="text-white/70 text-sm mt-1">Paso {step} de 2</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-primary text-white' : s < step ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className={`text-sm font-medium ${step === s ? 'text-text-primary' : 'text-text-muted'}`}>
                {s === 1 ? 'Información' : 'Herramientas y Formularios'}
              </span>
              {s < 2 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>

        <div className="card border border-border shadow-sm p-6">
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-5">
              <div className="form-group">
                <label className="label label-required">Nombre del Rol</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  disabled={role.is_system_role}
                />
                {role.is_system_role && (
                  <p className="text-xs text-text-muted mt-1">El nombre de los roles del sistema no puede modificarse.</p>
                )}
              </div>

              <div className="form-group">
                <label className="label">División</label>
                <select
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="input"
                >
                  <option value="">Sin división (global)</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {error && <p className="error-msg">⚠️ {error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/admin/roles')}
                  className="btn-ghost flex-1 py-2 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold">
                  Siguiente →
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-bold text-text-primary mb-1">Herramientas Asignadas</h2>
                <p className="text-xs text-text-muted mb-4">Marca las herramientas que tendrá acceso este rol.</p>
                <div className="space-y-4">
                  {Object.entries(toolsByCategory).map(([cat, catTools]) => (
                    <div key={cat} className={`rounded-xl border p-4 ${CATEGORY_COLOR[cat] ?? 'border-gray-200 bg-gray-50'}`}>
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">
                        {CATEGORY_LABEL[cat] ?? cat}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catTools.map((t) => (
                          <label key={t.id} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedTools.has(t.id)}
                              onChange={() => toggleTool(t.id)}
                              className="w-4 h-4 rounded accent-primary"
                            />
                            <span className="text-sm text-text-primary group-hover:text-primary transition-colors">
                              {t.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {tools.length === 0 && (
                    <p className="text-text-muted text-sm italic">No hay herramientas en el catálogo.</p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-bold text-text-primary mb-1">Formularios Asignados</h2>
                <p className="text-xs text-text-muted mb-4">Marca los formularios disponibles para este rol.</p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  {forms.length === 0 ? (
                    <p className="text-text-muted text-sm italic">No hay formularios disponibles.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {forms.map((f) => (
                        <label key={f.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedForms.has(f.id)}
                            onChange={() => toggleForm(f.id)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="text-sm text-text-primary group-hover:text-primary transition-colors">
                            📋 {f.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="error-msg">⚠️ {error}</p>}

              <div className="flex gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="btn-ghost flex-1 py-2 text-sm rounded-xl"
                >
                  ← Atrás
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                  className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold"
                >
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Users section */}
        {role.users.length > 0 && (
          <div className="card border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-text-primary">Usuarios con este Rol</h2>
              <span className="badge badge-primary text-xs">{role.users.length}</span>
            </div>
            <ul className="divide-y divide-border">
              {role.users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{u.full_name || '—'}</p>
                    <p className="text-xs text-text-muted truncate">{u.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
