'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Division {
  id: string;
  name: string;
  description?: string;
  role_count: number;
  created_at: string;
}

async function fetchDivisions(): Promise<Division[]> {
  const res = await fetch('/api/admin/divisions');
  const json = await res.json();
  return json.data ?? [];
}

export default function AdminDivisionsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['admin-divisions'],
    queryFn: fetchDivisions,
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear división');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-divisions'] });
      setShowModal(false);
      setForm({ name: '', description: '' });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    createMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <BackButton href="/admin/dashboard" label="Dashboard" />
          <div className="flex items-center justify-between mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Divisiones</h1>
              <p className="text-white/70 text-sm mt-1">Unidades organizativas de la empresa</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nueva División
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20">
        <div className="card shadow-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-text-muted animate-pulse">Cargando divisiones...</div>
          ) : divisions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-text-muted text-sm">No hay divisiones creadas.</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-primary text-sm font-medium hover:underline">
                Crear la primera división
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-text-secondary">División</th>
                    <th className="text-left px-5 py-3 font-semibold text-text-secondary hidden sm:table-cell">Descripción</th>
                    <th className="text-center px-5 py-3 font-semibold text-text-secondary">Roles</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {divisions.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-text-primary">{d.name}</td>
                      <td className="px-5 py-4 text-text-muted hidden sm:table-cell">
                        {d.description || <span className="italic text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="badge badge-primary text-xs">{d.role_count}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/divisions/${d.id}`}
                          className="text-primary text-xs font-semibold hover:underline"
                        >
                          Gestionar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva División */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">Nueva División</h2>
              <button onClick={() => { setShowModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="label label-required">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Área GPR"
                  className="input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="label">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción opcional..."
                  rows={3}
                  className="textarea"
                />
              </div>
              {error && <p className="error-msg">⚠️ {error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setError(''); }} className="btn-ghost flex-1 py-2 text-sm rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 py-2 text-sm rounded-xl font-semibold">
                  {createMutation.isPending ? 'Guardando...' : 'Crear División'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
