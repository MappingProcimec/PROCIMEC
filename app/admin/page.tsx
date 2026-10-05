'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Cpu,
  Database,
  Activity,
  Server,
  Shield,
  FileText,
  Wrench,
  Users,
  Building2,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Mail,
  HardDrive,
  Lock,
  ChevronRight,
  Terminal,
  Download,
  SlidersHorizontal,
  Check,
  Zap,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';

type TabKey = 'services' | 'metrics' | 'security' | 'diagnostics' | 'catalogs';

interface ServiceItem {
  name: string;
  type: string;
  status: 'healthy' | 'degraded' | 'warning' | 'down';
  latencyMs: number | null;
  details: string;
  meta: string;
}

interface EnvVarItem {
  key: string;
  configured: boolean;
  category: string;
}

interface SystemData {
  ok: boolean;
  platform: {
    name: string;
    version: string;
    environment: string;
    timezone: string;
    currency: string;
    nodeVersion: string;
    serverTime: string;
    uptimeSeconds: number;
  };
  services: ServiceItem[];
  envAudit: Record<string, EnvVarItem>;
  metrics: {
    dbLatencyMs: number;
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    totalProjects: number;
    activeProjects: number;
    totalRoles: number;
    totalForms: number;
    totalTools: number;
    totalDivisions: number;
    totalReports: number;
    reportsLast24h: number;
    totalMl: number;
    totalCadHours: number;
  };
  recentReports: Array<{
    id: string;
    created_at: string;
    report_date: string;
    localizador_name: string;
    projects?: { name?: string; code?: string } | null;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    full_name?: string;
    role: string;
    created_at: string;
  }>;
}

async function fetchSystemData(): Promise<SystemData> {
  const res = await fetch('/api/admin/system', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Error al consultar telemetría del sistema');
  }
  return res.json();
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('services');
  const [diagnosticResult, setDiagnosticResult] = useState<{
    action: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-system-telemetry'],
    queryFn: fetchSystemData,
    refetchInterval: 30000, // Refresco automático cada 30s
  });

  // Mutación para pruebas de diagnóstico interactivo
  const diagnosticMutation = useMutation({
    mutationFn: async (action: 'test-gemini' | 'test-smtp' | 'check-integrity') => {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      return res.json();
    },
    onSuccess: (result, action) => {
      setDiagnosticResult({
        action,
        ok: result.ok,
        message: result.message || (result.ok ? 'Prueba ejecutada con éxito' : result.error),
      });
    },
    onError: (err: unknown, action) => {
      setDiagnosticResult({
        action,
        ok: false,
        message: err instanceof Error ? err.message : 'Error en la prueba de diagnóstico',
      });
    },
  });

  // Exportar respaldo de catálogos en JSON
  const handleExportBackup = () => {
    if (!data) return;
    const backupData = {
      exportDate: new Date().toISOString(),
      platform: data.platform,
      metrics: data.metrics,
      services: data.services,
      exportedBy: 'Administrador PCM CLOUD',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-pcm-cloud-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metrics = data?.metrics;
  const platform = data?.platform;
  const services = data?.services || [];
  const envAudit = data?.envAudit || {};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
            Operativo
          </span>
        );
      case 'degraded':
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
            Alerta / Revisión
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-400" strokeWidth={2} />
            Interrumpido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-gray-500/15 text-gray-300 border border-gray-500/30">
            Desconocido
          </span>
        );
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Canónico según AGENTS.md */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto space-y-2">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                <Cpu className="w-7 h-7 text-accent" strokeWidth={1.75} />
                Ingeniería de Sistemas & Administración
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Telemetría en tiempo real, monitoreo de infraestructura, métricas operativas y parametrización de PCM CLOUD.
              </p>
            </div>

            {/* Barra de Acciones de Cabecera */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-900 border border-primary-800 text-xs font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-white/90">
                  {isFetching ? 'Consultando...' : 'Telemetría en Vivo'}
                </span>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="text-white/60 hover:text-white p-0.5 rounded transition-transform active:scale-90"
                  title="Refrescar telemetría inmediata"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-accent' : ''}`}
                    strokeWidth={1.75}
                  />
                </button>
              </div>

              <button
                onClick={handleExportBackup}
                disabled={isLoading}
                className="btn-accent text-xs px-3.5 py-1.5 flex items-center gap-1.5 rounded-lg cursor-pointer"
                title="Descargar volcado de estado y catálogos en JSON"
              >
                <Download className="w-3.5 h-3.5 text-primary-950" strokeWidth={2} />
                <span>Exportar Estado</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 -mt-8 pb-20 space-y-6 w-full flex-1">
        {/* 1. Fila de KPIs Técnicos en Tiempo Real */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Latencia Supabase */}
          <div className="rounded-2xl p-4 sm:p-5 bg-primary-900 text-white border border-primary-800 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-black/20 text-accent">
                <Database className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {metrics ? `${metrics.dbLatencyMs} ms` : '—'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-0.5">
              {metrics ? (metrics.dbLatencyMs < 200 ? 'Óptima' : 'Normal') : '—'}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Latencia PostgreSQL
            </div>
          </div>

          {/* KPI 2: Disponibilidad de Servicios */}
          <div className="rounded-2xl p-4 sm:p-5 bg-primary-900 text-white border border-primary-800 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-black/20 text-accent">
                <Server className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                99.9% Uptime
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-0.5">
              {services.filter((s) => s.status === 'healthy').length} / {services.length}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Servicios Activos
            </div>
          </div>

          {/* KPI 3: Actividad en 24 Horas */}
          <div className="rounded-2xl p-4 sm:p-5 bg-accent text-primary-950 border border-amber-500 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-black/10 text-primary-950">
                <Activity className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span className="text-[11px] font-mono font-bold text-primary-950 bg-black/10 px-2 py-0.5 rounded-md border border-black/10">
                24 Horas
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-0.5">
              {metrics ? metrics.reportsLast24h : '—'}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary-950/90">
              Reportes Radicados
            </div>
          </div>

          {/* KPI 4: Usuarios & Accesos */}
          <div
            className={`rounded-2xl p-4 sm:p-5 shadow-card transition-all ${
              (metrics?.pendingUsers ?? 0) > 0
                ? 'bg-amber-400 text-primary-950 border border-amber-500 font-bold animate-pulse-soft'
                : 'bg-primary-900 text-white border border-primary-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={`p-2 rounded-xl ${
                  (metrics?.pendingUsers ?? 0) > 0
                    ? 'bg-black/10 text-primary-950'
                    : 'bg-black/20 text-accent'
                }`}
              >
                <Users className="w-5 h-5" strokeWidth={1.75} />
              </div>
              {(metrics?.pendingUsers ?? 0) > 0 ? (
                <span className="text-[11px] font-mono font-bold text-primary-950 bg-black/15 px-2 py-0.5 rounded-md">
                  Por Aprobar
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Al Día
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-0.5">
              {(metrics?.pendingUsers ?? 0) > 0 ? metrics?.pendingUsers : metrics?.totalUsers ?? '—'}
            </div>
            <div
              className={`text-xs font-bold uppercase tracking-wider ${
                (metrics?.pendingUsers ?? 0) > 0 ? 'text-primary-950/90' : 'text-white/70'
              }`}
            >
              {(metrics?.pendingUsers ?? 0) > 0 ? 'Aprobaciones Pendientes' : 'Usuarios Totales'}
            </div>
          </div>
        </div>

        {/* 2. Pestañas de Navegación del Panel de Control */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-primary-900 border border-primary-800 overflow-x-auto text-xs font-medium">
          {[
            { key: 'services', label: 'Infraestructura & Servicios', icon: Server },
            { key: 'metrics', label: 'Métricas & Rendimiento', icon: Activity },
            { key: 'security', label: 'Seguridad & Variables', icon: Shield },
            { key: 'diagnostics', label: 'Diagnóstico & Pruebas', icon: Terminal },
            { key: 'catalogs', label: 'Catálogos Operativos', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? 'bg-accent text-primary-950 font-bold shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mensaje de Resultado de Diagnóstico (si existe) */}
        {diagnosticResult && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200 ${
              diagnosticResult.ok
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {diagnosticResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
              )}
              <div>
                <span className="font-bold block uppercase tracking-wider font-mono text-[10px] mb-0.5">
                  Resultado de prueba [{diagnosticResult.action}]:
                </span>
                <p className="leading-relaxed">{diagnosticResult.message}</p>
              </div>
            </div>
            <button
              onClick={() => setDiagnosticResult(null)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ────────── PESTAÑA 1: INFRAESTRUCTURA & SERVICIOS ────────── */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Estado de Salud de Servicios Críticos
              </h2>
              <span className="text-xs font-mono text-text-muted">
                {services.length} servicios monitoreados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="rounded-2xl p-5 border border-border bg-white shadow-card flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">
                          {service.type}
                        </span>
                        <h3 className="font-bold text-base text-text-primary mt-0.5">
                          {service.name}
                        </h3>
                      </div>
                      {getStatusBadge(service.status)}
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed mb-3">
                      {service.details}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-text-muted">
                    <span>{service.meta}</span>
                    {service.latencyMs !== null && (
                      <span className="text-accent-800 font-bold">{service.latencyMs} ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ────────── PESTAÑA 2: MÉTRICAS & RENDIMIENTO ────────── */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Resumen de Volumetría */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl p-5 border border-border bg-white shadow-card">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted block mb-1">
                  Metros Lineales GPR
                </span>
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {metrics?.totalMl.toLocaleString()} ml
                </div>
                <span className="text-xs text-text-muted mt-1 block">Ejecutados en campo</span>
              </div>

              <div className="rounded-2xl p-5 border border-border bg-white shadow-card">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted block mb-1">
                  Horas Gabinete CAD
                </span>
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {metrics?.totalCadHours} h
                </div>
                <span className="text-xs text-text-muted mt-1 block">Delineación y planos</span>
              </div>

              <div className="rounded-2xl p-5 border border-border bg-white shadow-card">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted block mb-1">
                  Proyectos Activos
                </span>
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {metrics?.activeProjects} / {metrics?.totalProjects}
                </div>
                <span className="text-xs text-text-muted mt-1 block">Frentes contractuales</span>
              </div>

              <div className="rounded-2xl p-5 border border-border bg-white shadow-card">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted block mb-1">
                  Formularios Activos
                </span>
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {metrics?.totalForms} formatos
                </div>
                <span className="text-xs text-text-muted mt-1 block">Habilitados en catálogo</span>
              </div>
            </div>

            {/* Últimos Reportes de Campo */}
            <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-text-primary">
                    Últimas Transacciones de Campo & Gabinete
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Registro de reportes sincronizados en tiempo real
                  </p>
                </div>
                <span className="text-xs font-mono text-text-secondary bg-white px-2.5 py-1 rounded-lg border border-border">
                  {data?.recentReports?.length || 0} registros recientes
                </span>
              </div>

              <div className="divide-y divide-border">
                {(data?.recentReports || []).map((rep) => (
                  <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors">
                    <div>
                      <div className="font-semibold text-sm text-text-primary flex items-center gap-2">
                        <span>{rep.projects?.name || 'Proyecto no especificado'}</span>
                        {rep.projects?.code && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-text-secondary border border-slate-200">
                            {rep.projects.code}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-muted mt-0.5 block">
                        Responsable: {rep.localizador_name} · Fecha reporte: {rep.report_date}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-text-muted self-start sm:self-auto">
                      {format(new Date(rep.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────────── PESTAÑA 3: SEGURIDAD & VARIABLES ────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Parámetros de Plataforma */}
            <div className="rounded-2xl p-5 bg-primary-900 border border-primary-800 text-white shadow-card space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent">
                  <Lock className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Parámetros Globales de Entorno</h3>
                  <p className="text-xs text-white/70">
                    Configuración de ejecución en producción e infraestructura Vercel
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] font-mono text-white/60 uppercase block">Versión</span>
                  <span className="text-xs font-mono font-bold text-accent">{platform?.version}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] font-mono text-white/60 uppercase block">Zona Horaria</span>
                  <span className="text-xs font-mono font-bold text-white">{platform?.timezone}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] font-mono text-white/60 uppercase block">Moneda Base</span>
                  <span className="text-xs font-mono font-bold text-white">{platform?.currency}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] font-mono text-white/60 uppercase block">Motor Node.js</span>
                  <span className="text-xs font-mono font-bold text-white">{platform?.nodeVersion}</span>
                </div>
              </div>
            </div>

            {/* Matriz de Auditoría de Variables */}
            <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-text-primary">
                    Auditoría de Claves de Entorno (Sin Exposición de Secretos)
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Verificación de inyección de parámetros requeridos en Vercel
                  </p>
                </div>
                <span className="text-xs font-mono text-text-secondary bg-white px-2.5 py-1 rounded-lg border border-border">
                  {Object.keys(envAudit).length} claves auditadas
                </span>
              </div>

              <div className="divide-y divide-border">
                {Object.entries(envAudit).map(([key, item]) => (
                  <div key={key} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                    <div>
                      <span className="font-mono font-bold text-xs text-text-primary block">
                        {item.key}
                      </span>
                      <span className="text-[11px] text-text-muted">{item.category}</span>
                    </div>

                    {item.configured ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.5} />
                        Configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" strokeWidth={2} />
                        Pendiente
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────────── PESTAÑA 4: DIAGNÓSTICO & PRUEBAS ────────── */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Pruebas de Diagnóstico y Telemetría en Vivo
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Prueba 1: Google Gemini AI */}
              <div className="rounded-2xl p-5 border border-border bg-white shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-xl bg-primary-50 text-accent">
                      <Sparkles className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-bold text-sm text-text-primary">Test Google Gemini AI</h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    Envía un prompt de baja latencia a la API REST de Gemini para verificar validez de cuota y tiempos de inferencia.
                  </p>
                </div>
                <button
                  onClick={() => diagnosticMutation.mutate('test-gemini')}
                  disabled={diagnosticMutation.isPending}
                  className="btn-secondary text-xs px-3.5 py-2 w-full flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  <span>
                    {diagnosticMutation.isPending && diagnosticMutation.variables === 'test-gemini'
                      ? 'Probando...'
                      : 'Probar Conectividad IA'}
                  </span>
                </button>
              </div>

              {/* Prueba 2: Servidor SMTP Nodemailer */}
              <div className="rounded-2xl p-5 border border-border bg-white shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-xl bg-primary-50 text-accent">
                      <Mail className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-bold text-sm text-text-primary">Test Servidor SMTP</h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    Despacha un correo de prueba autenticado al buzón del administrador para validar el puerto y credenciales.
                  </p>
                </div>
                <button
                  onClick={() => diagnosticMutation.mutate('test-smtp')}
                  disabled={diagnosticMutation.isPending}
                  className="btn-secondary text-xs px-3.5 py-2 w-full flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  <span>
                    {diagnosticMutation.isPending && diagnosticMutation.variables === 'test-smtp'
                      ? 'Despachando...'
                      : 'Enviar Correo de Prueba'}
                  </span>
                </button>
              </div>

              {/* Prueba 3: Integridad de Base de Datos */}
              <div className="rounded-2xl p-5 border border-border bg-white shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-xl bg-primary-50 text-accent">
                      <Database className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-bold text-sm text-text-primary">Integridad Relacional</h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    Inspecciona usuarios sin rol asignado, reportes huérfanos sin proyecto e integridad referencial en Supabase.
                  </p>
                </div>
                <button
                  onClick={() => diagnosticMutation.mutate('check-integrity')}
                  disabled={diagnosticMutation.isPending}
                  className="btn-secondary text-xs px-3.5 py-2 w-full flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  <span>
                    {diagnosticMutation.isPending && diagnosticMutation.variables === 'check-integrity'
                      ? 'Analizando...'
                      : 'Escanear Integridad BD'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────── PESTAÑA 5: CATÁLOGOS OPERATIVOS ────────── */}
        {activeTab === 'catalogs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Módulos de Parametrización y Catálogos Operativos
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: 'Usuarios & Accesos',
                  href: '/admin/users',
                  icon: <Users className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Aprobación de cuentas, asignación de cargos, firmas digitalizadas y estados activos/inactivos.',
                  stat: metrics ? `${metrics.totalUsers} usuarios` : '—',
                  badge: (metrics?.pendingUsers ?? 0) > 0 ? `${metrics?.pendingUsers} por aprobar` : null,
                  action: 'Administrar usuarios',
                },
                {
                  title: 'Proyectos & Centros de Costos',
                  href: '/admin/projects',
                  icon: <Building2 className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Parametrización de frentes de obra, centros de costos, códigos oficiales, vigencias y cuadrillas.',
                  stat: metrics ? `${metrics.activeProjects} activos` : '—',
                  action: 'Administrar proyectos',
                },
                {
                  title: 'Roles & Perfiles Operativos',
                  href: '/admin/roles',
                  icon: <Shield className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Matriz de roles canónicos (Almacén, Compras, Finanzas, HSEQ, Operador, etc.) y jerarquías.',
                  stat: metrics ? `${metrics.totalRoles} roles` : '—',
                  action: 'Configurar roles',
                },
                {
                  title: 'Catálogo de Formularios',
                  href: '/admin/forms',
                  icon: <FileText className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Habilitación y asignación de formularios operativos de entrada (inspecciones HSEQ, kárdex, checklists).',
                  stat: metrics ? `${metrics.totalForms} formatos` : '—',
                  action: 'Configurar formularios',
                },
                {
                  title: 'Catálogo de Herramientas',
                  href: '/admin/tools',
                  icon: <Wrench className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Habilitación de visores técnicos, tableros de gestión, organigrama IA y herramientas analíticas.',
                  stat: metrics ? `${metrics.totalTools} herramientas` : '—',
                  action: 'Configurar herramientas',
                },
                {
                  title: 'Divisiones Corporativas',
                  href: '/admin/divisions',
                  icon: <Layers className="w-6 h-6 text-accent" strokeWidth={1.75} />,
                  desc: 'Estructura departamental de la organización (Geofísica, Gabinete CAD/BIM, Soporte y Operaciones).',
                  stat: metrics ? `${metrics.totalDivisions} divisiones` : '—',
                  action: 'Configurar divisiones',
                },
              ].map((mod) => (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-border bg-white hover:border-accent/60 hover:shadow-card transition-all active:scale-[0.98] group relative overflow-hidden"
                >
                  {mod.badge && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-primary-950 font-bold text-[11px] font-mono border border-amber-500 shadow-xs animate-pulse-soft">
                      <Clock className="w-3 h-3 text-primary-950" strokeWidth={2} />
                      <span>{mod.badge}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-primary-50 text-accent group-hover:bg-primary-900 transition-colors">
                        {mod.icon}
                      </div>
                      {!mod.badge && (
                        <span className="text-xs font-mono font-semibold text-text-secondary bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {mod.stat}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary group-hover:text-accent transition-colors">
                    <span>{mod.action}</span>
                    <ChevronRight
                      className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                      strokeWidth={2}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Retorno rápido a Mi Panel */}
        <div className="p-4 rounded-xl border border-border bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            ¿Deseas volver a la vista de usuario operativo y captura de formularios?
          </div>
          <Link
            href="/dashboard"
            className="btn-secondary text-xs px-3.5 py-1.5 self-start sm:self-auto flex items-center gap-1.5"
          >
            <span>Ir a Mi Panel</span>
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </main>
    </div>
  );
}
