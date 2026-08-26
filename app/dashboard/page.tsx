'use client';

import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicDashboard, type DashboardData } from '@/components/dashboard/DynamicDashboard';

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al cargar el panel');
  return json.data as DashboardData;
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="h-8 w-40 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {data?.user?.full_name ? `Panel de ${data.user.full_name.split(' ')[0]}` : 'Mi Panel'}
            </h1>
          )}
          <p className="text-white/70 text-sm mt-1">
            Acceso rápido a tus proyectos, herramientas y formularios
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-20">
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card border border-border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="card border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-700 font-medium">
              Error al cargar el panel. Por favor recarga la página.
            </p>
          </div>
        )}

        {data && <DynamicDashboard data={data} />}
      </div>
    </div>
  );
}
