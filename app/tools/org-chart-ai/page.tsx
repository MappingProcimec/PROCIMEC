'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { OrgChartCanvas } from '@/components/tools/org-chart/OrgChartCanvas';
import { AiAnalysisModal } from '@/components/tools/org-chart/AiAnalysisModal';
import { DiagramPayload, ViewMode } from '@/components/tools/org-chart/types';
import { getCanonicalOrgData, getCanonicalPipelineData } from '@/components/tools/org-chart/initialData';
import { supabase } from '@/lib/supabase';
import {
  Brain,
  RefreshCw,
  Search,
  Filter,
  Users,
  Layers,
  Briefcase,
  Activity,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

async function fetchDiagramData(mode: ViewMode): Promise<DiagramPayload> {
  try {
    const res = await fetch(`/api/tools/org-chart?mode=${mode}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al consultar datos');
    const json = await res.json();
    return json.data || (mode === 'org' ? getCanonicalOrgData() : getCanonicalPipelineData());
  } catch (err) {
    console.warn('Fallback to canonical diagram data:', err);
    return mode === 'org' ? getCanonicalOrgData() : getCanonicalPipelineData();
  }
}

export default function OrgChartAiPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('org');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Auto-fetch data with React Query (automatic background sync every 15s)
  const { data: diagramData, isLoading, isFetching, refetch } = useQuery<DiagramPayload>({
    queryKey: ['org-chart-data', viewMode],
    queryFn: () => fetchDiagramData(viewMode),
    refetchInterval: 15000, // Automatic live update every 15 seconds
    staleTime: 5000,
  });

  // Supabase Realtime live sync
  useEffect(() => {
    const channel = supabase
      .channel('org-chart-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'divisions' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_projects' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const activePayload = diagramData || (viewMode === 'org' ? getCanonicalOrgData() : getCanonicalPipelineData());

  return (
    <div className="min-h-[100dvh] bg-[#14171C] text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2A303C]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#EAA023]/10 text-[#EAA023] border border-[#EAA023]/30">
                <GitBranch className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
                Organigrama & Arquitectura Inteligente
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#EAA023]/15 text-[#EAA023] border border-[#EAA023]/30">
                  Archify Engine
                </span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400">
              Visualización interactiva de estructura de cargos, asignación de cuadrillas y pipeline técnico de datos en vivo.
            </p>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Auto-sync status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E2229] border border-[#2A303C] text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-neutral-300">
                {isFetching ? 'Sincronizando...' : 'En vivo (Auto-sync)'}
              </span>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-neutral-400 hover:text-white p-0.5 rounded transition-transform active:scale-90"
                title="Forzar actualización inmediata"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#EAA023]' : ''}`} strokeWidth={1.75} />
              </button>
            </div>

            {/* AI Diagnosis Button */}
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#EAA023] text-black font-semibold text-xs hover:bg-[#d8921e] active:scale-[0.98] transition-all shadow-md shadow-[#EAA023]/10"
            >
              <Brain className="w-4 h-4" strokeWidth={1.75} />
              <span>Diagnóstico IA</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs and Stats Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[#1E2229] border border-[#2A303C]">
            <button
              onClick={() => setViewMode('org')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors active:scale-[0.98] ${
                viewMode === 'org'
                  ? 'bg-[#EAA023] text-black font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Organigrama & Cuadrillas</span>
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors active:scale-[0.98] ${
                viewMode === 'pipeline'
                  ? 'bg-[#EAA023] text-black font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Pipeline & Procesos Técnicos</span>
            </button>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="text-white font-semibold">{activePayload.nodes.length}</span>
              <span>Nodos</span>
            </span>
            <span className="text-[#2A303C]">•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#EAA023] font-semibold">{activePayload.edges.length}</span>
              <span>Conexiones activas</span>
            </span>
            <span className="text-[#2A303C]">•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-semibold">
                {activePayload.nodes.filter((n) => n.status === 'active').length}
              </span>
              <span>Operativos</span>
            </span>
          </div>
        </div>

        {/* Search and Filter Strip */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar personas, roles, herramientas o frentes de obra..."
              className="w-full pl-9 pr-4 py-2 bg-[#1E2229] border border-[#2A303C] rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#EAA023] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Division Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400 hidden sm:block" strokeWidth={1.75} />
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="px-3 py-2 bg-[#1E2229] border border-[#2A303C] rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-[#EAA023] transition-colors cursor-pointer"
            >
              <option value="all">Todas las divisiones / áreas</option>
              <option value="gpr">Geofísica & GPR</option>
              <option value="cad">Oficina Técnica CAD / BIM</option>
              <option value="hseq">Seguridad HSEQ & SST</option>
              <option value="admin">Administración & TI</option>
              <option value="direction">Dirección General</option>
            </select>
          </div>
        </div>

        {/* Interactive Diagram Canvas */}
        <div className="flex-1">
          <OrgChartCanvas
            payload={activePayload}
            selectedDivision={selectedDivision}
            searchQuery={searchQuery}
          />
        </div>
      </main>

      {/* AI Diagnosis Modal */}
      <AiAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        payload={activePayload}
      />
    </div>
  );
}
