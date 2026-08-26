'use client';

import { use } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery } from '@tanstack/react-query';

interface Role { id: string; name: string; is_system_role: boolean }
interface Project { id: string; code: string; name: string; client: string }
interface DivisionDetail {
  id: string;
  name: string;
  description?: string;
  roles: Role[];
  projects: Project[];
}

async function fetchDivision(id: string): Promise<DivisionDetail> {
  const res = await fetch(`/api/admin/divisions/${id}`);
  const json = await res.json();
  return json.data;
}

export default function DivisionDetailPage({ params }: { params: Promise<{ divisionId: string }> }) {
  const { divisionId } = use(params);

  const { data: division, isLoading } = useQuery({
    queryKey: ['admin-division', divisionId],
    queryFn: () => fetchDivision(divisionId),
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-5xl mx-auto">
          <BackButton href="/admin/divisions" label="Volver a Divisiones" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">
            {isLoading ? '...' : division?.name}
          </h1>
          {division?.description && (
            <p className="text-white/70 text-sm mt-1">{division.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {isLoading ? (
          <div className="card p-10 text-center text-text-muted animate-pulse">Cargando...</div>
        ) : !division ? (
          <div className="card p-10 text-center text-text-muted">División no encontrada.</div>
        ) : (
          <>
            {/* Roles */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Roles en esta División</h2>
                <span className="badge badge-primary text-xs">{division.roles.length}</span>
              </div>
              {division.roles.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay roles asignados a esta división.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {division.roles.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <span className="text-sm font-medium text-text-primary">{r.name}</span>
                      {r.is_system_role && (
                        <span className="badge badge-accent text-xs">Sistema</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Proyectos vinculados */}
            <div className="card shadow-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Proyectos Vinculados</h2>
                <span className="badge badge-primary text-xs">{division.projects.length}</span>
              </div>
              {division.projects.length === 0 ? (
                <p className="px-5 py-6 text-text-muted text-sm">No hay proyectos vinculados via role_projects.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {division.projects.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      <span className="text-xs font-bold text-text-muted w-16 flex-shrink-0">{p.code}</span>
                      <span className="text-sm font-medium text-text-primary flex-1">{p.name}</span>
                      <span className="text-xs text-text-muted hidden sm:block">{p.client}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
