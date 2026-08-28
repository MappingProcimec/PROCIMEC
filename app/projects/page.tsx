'use client';

import { Navbar } from '@/components/layout/Navbar';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Project } from '@/types';
import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Error al cargar proyectos');
  const data = await res.json();
  return data.data || [];
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase()) ||
    (p.cost_center || p.code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-accent/20 text-accent border border-accent/30 text-xs">
              {session?.user?.role === 'admin' ? '⭐ Administrador' : '🔧 Operador'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Hola, {session?.user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-white/70 text-sm">
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} asignado{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Content pulled up */}
      <div className="max-w-4xl mx-auto px-4 -mt-12 pb-20">
        {/* Search card */}
        <div className="card p-4 mb-6 shadow-soft">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input
              className="input pl-9"
              placeholder="Buscar por nombre, cliente o código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-5 border-error/20 bg-red-50 text-center">
            <p className="text-error font-medium">Error al cargar proyectos</p>
            <p className="text-sm text-text-muted mt-1">Verifica tu conexión y recarga la página</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <h3 className="font-semibold text-text-primary mb-1">
              {search ? 'No se encontraron proyectos' : 'Sin proyectos asignados'}
            </h3>
            <p className="text-sm text-text-muted">
              {search ? 'Intenta con otro término de búsqueda' : 'Contacta al administrador para que te asigne proyectos'}
            </p>
          </div>
        )}

        {/* Projects grid */}
        <div className="space-y-4">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="card-hover p-5 animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-primary-50 text-primary rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="badge badge-primary text-xs">{project.code}</span>
              {project.is_active ? (
                <span className="badge badge-success text-xs">Activo</span>
              ) : (
                <span className="badge badge-gray text-xs">Inactivo</span>
              )}
            </div>
            <h3 className="font-bold text-text-primary text-base truncate">{project.name}</h3>
            <p className="text-xs text-text-secondary">{project.client}</p>
          </div>
        </div>

        {/* Drive link */}
        {project.drive_folder_url && (
          <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer"
            className="btn-icon btn-ghost text-text-muted flex-shrink-0" title="Abrir carpeta en Drive">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        <span className="truncate">{project.location}</span>
        {project.created_at && (
          <>
            <span className="mx-1">·</span>
            <span className="flex-shrink-0">Creado {format(new Date(project.created_at), 'MMM yyyy', { locale: es })}</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link href={`/projects/${project.id}/new-report`}
          className="btn-primary flex-1 justify-center text-sm py-2.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo Registro
        </Link>
        <Link href={`/projects/${project.id}/reports`}
          className="btn-outline flex-1 justify-center text-sm py-2.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          Ver registros
        </Link>
      </div>
    </div>
  );
}
