'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from 'recharts';
import type { DrawingActivity } from '@/types';


// ─── Paleta de colores para proyectos ─────────────────────────────────────────
const COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6',
  '#6366F1', '#A855F7', '#D946EF', '#FB923C', '#4ADE80',
];

function getColor(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Tipos de agregaciones ─────────────────────────────────────────────────────
interface ProjectHours {
  name: string;
  horas: number;
  fill: string;
}

interface SoftwareSlice {
  name: string;
  value: number;
}

interface ReworkSlice {
  name: string;
  value: number;
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function TableroDibujoPage() {
  const [activities, setActivities] = useState<DrawingActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dibujo/actividades')
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar datos');
        return r.json();
      })
      .then((data) => setActivities(data))
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        ⚠️ {error}
      </div>
    );
  }

  // ─── Métricas ────────────────────────────────────────────────────────────────
  const totalRegistros = activities.length;
  const totalHoras = activities.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);

  // Horas por proyecto
  const proyectoMap = new Map<string, number>();
  activities.forEach((a) => {
    proyectoMap.set(a.project_name, (proyectoMap.get(a.project_name) || 0) + Number(a.hours_worked));
  });
  const proyectoData: ProjectHours[] = Array.from(proyectoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, horas], i) => ({ name, horas, fill: getColor(i) }));

  // Distribución por software
  const softwareMap = new Map<string, number>();
  activities.forEach((a) => {
    softwareMap.set(a.software, (softwareMap.get(a.software) || 0) + Number(a.hours_worked));
  });
  const softwareData: SoftwareSlice[] = Array.from(softwareMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  // Reproceso
  let horasReproceso = 0;
  let horasNormal = 0;
  activities.forEach((a) => {
    if (a.is_rework) horasReproceso += Number(a.hours_worked);
    else horasNormal += Number(a.hours_worked);
  });
  const reworkData: ReworkSlice[] = [
    { name: 'Normal', value: horasNormal },
    { name: 'Reproceso', value: horasReproceso },
  ].filter((d) => d.value > 0);

  // Últimas 50 actividades
  const recent = activities.slice(0, 50);

  const renderCustomLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;
    if (Number(percent) < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
    const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
    const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(Number(percent) * 100).toFixed(0)}%`}
      </text>
    );
  };


  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Hero */}
      <div className="page-hero">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="badge badge-accent">Área de Dibujo</span>
            <span className="text-white/60 text-xs">Mapping Ingeniería</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Tablero de Actividades</h1>
          <p className="text-white/70 text-sm">Resumen y métricas de rendimiento en actividades de dibujo</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary text-2xl flex-shrink-0">
              📋
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{totalRegistros}</div>
              <div className="text-sm font-medium text-text-secondary">Total de Registros</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center text-accent-700 text-2xl flex-shrink-0">
              ⏱️
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{totalHoras.toFixed(1)} h</div>
              <div className="text-sm font-medium text-text-secondary">Total Horas Trabajadas</div>
            </div>
          </div>
        </div>

      {/* Gráfico de barras: Proyectos vs Horas */}
      {proyectoData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">Proyectos vs Horas trabajadas</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={proyectoData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#6B7280' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value: unknown) => [`${Number(value).toFixed(1)} h`, 'Horas']}
              />
              <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                {proyectoData.map((entry, index) => (
                  <Cell key={entry.name} fill={getColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráficos de dona */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Distribución por proyecto */}
        {proyectoData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm">Distribución por proyecto</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={proyectoData}
                  dataKey="horas"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {proyectoData.map((entry, index) => (
                    <Cell key={entry.name} fill={getColor(index)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value: unknown) => [`${Number(value).toFixed(1)} h`, 'Horas']}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  formatter={(value) => (value.length > 18 ? value.slice(0, 16) + '…' : value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Uso de software */}
        {softwareData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm">Uso de software</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={softwareData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {softwareData.map((_, index) => (
                    <Cell key={index} fill={getColor(index + 5)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value: unknown) => [`${Number(value).toFixed(1)} h`, 'Horas']}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reproceso */}
        {reworkData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm">Tiempos de reproceso</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={reworkData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value: unknown) => [`${Number(value).toFixed(1)} h`, 'Horas']}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabla de registros recientes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Registros recientes</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {recent.length} registros
          </span>
        </div>

        {recent.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Sin registros aún</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['PROYECTO', 'SOFTWARE', 'HORAS', 'REPROCESO', 'RESPONSABLE', 'FECHA'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate" title={a.project_name}>
                      {a.project_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {a.software}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{Number(a.hours_worked).toFixed(1)}</td>
                    <td className="px-4 py-3">
                      {a.is_rework ? (
                        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          Sí
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[140px]" title={a.responsible}>
                      {a.responsible}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {a.activity_date
                        ? new Date(a.activity_date + 'T12:00:00').toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
