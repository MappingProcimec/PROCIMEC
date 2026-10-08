'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Briefcase,
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Edit3,
  Eye,
  X,
  Save,
  RotateCw,
  FolderGit2,
  TrendingUp,
} from 'lucide-react';
import type { Client } from '@/types';

const STATUS_CLIENT_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: 'Activo', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  prospect: { label: 'Prospecto', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  inactive: { label: 'Inactivo', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  blocked: { label: 'Bloqueado', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
};

const SECTOR_OPTIONS = [
  'Infraestructura Vial',
  'Edificación y Vivienda',
  'Petróleo y Gas',
  'Minería y Energía',
  'Servicios Públicos',
  'Materiales y Concretos',
  'Telecomunicaciones',
  'Consultoría & Diseño',
  'Sector Público / Entidades',
  'Otro',
];

const PAYMENT_TERMS_OPTIONS = [
  'Contado',
  'Anticipo 50% y Saldo contra Entrega',
  'Crédito 15 días',
  'Crédito 30 días',
  'Crédito 45 días',
  'Crédito 60 días',
  'Actas de Corte Mensual',
];

const CLIENT_TYPE_LABELS: Record<string, string> = {
  corporativo: 'Corporativo / Privado',
  publico: 'Entidad Pública',
  contratista: 'Contratista de Obra',
  particular: 'Particular / Consultor',
};

export default function CommercialClientsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');

  // Modales
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    clients: Client[];
    stats: {
      totalClients: number;
      activeClients: number;
      prospectClients: number;
      inactiveClients: number;
      projectsLinkedCount: number;
    };
  }>({
    queryKey: ['commercial-clients', statusFilter, sectorFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sectorFilter !== 'all') params.set('sector', sectorFilter);

      const res = await fetch(`/api/tools/commercial-clients?${params.toString()}`);
      if (!res.ok) throw new Error('Error al consultar clientes');
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const clients = data?.clients ?? [];
  const stats = data?.stats ?? {
    totalClients: 0,
    activeClients: 0,
    prospectClients: 0,
    inactiveClients: 0,
    projectsLinkedCount: 0,
  };

  // Filtrado local ágil por texto
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      return (
        c.company_name.toLowerCase().includes(q) ||
        (c.nit && c.nit.toLowerCase().includes(q)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.economic_sector && c.economic_sector.toLowerCase().includes(q))
      );
    });
  }, [clients, search]);

  // Mutación para Guardar / Actualizar
  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Client>) => {
      const isUpdating = Boolean(payload.id);
      const url = '/api/tools/commercial-clients';
      const method = isUpdating ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al guardar cliente');
      return resJson;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['commercial-clients'] });
      setIsEditModalOpen(false);
      setEditingClient(null);
      if (selectedClient && resData.client) {
        setSelectedClient(resData.client);
      }
      setFeedbackMsg({ text: resData.message || 'Cliente guardado con éxito.', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setFeedbackMsg({ text: msg, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  const handleOpenCreate = () => {
    setEditingClient({
      company_name: '',
      nit: '',
      contact_name: '',
      contact_role: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      client_type: 'corporativo',
      economic_sector: 'Infraestructura Vial',
      payment_terms: 'Crédito 30 días',
      status: 'active',
      notes: '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient({ ...client });
    setIsEditModalOpen(true);
  };

  const handleExportCSV = () => {
    if (filteredClients.length === 0) return;

    const headers = [
      'Razón Social',
      'NIT',
      'Contacto Principal',
      'Cargo Contacto',
      'Correo Electrónico',
      'Teléfono',
      'Ciudad',
      'Tipo de Cliente',
      'Sector Económico',
      'Condiciones de Pago',
      'Estado',
      'Oportunidades',
      'Proyectos',
    ];

    const rows = filteredClients.map((c) => [
      `"${c.company_name.replace(/"/g, '""')}"`,
      `"${(c.nit || '').replace(/"/g, '""')}"`,
      `"${(c.contact_name || '').replace(/"/g, '""')}"`,
      `"${(c.contact_role || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${c.client_type ? CLIENT_TYPE_LABELS[c.client_type] || c.client_type : ''}"`,
      `"${(c.economic_sector || '').replace(/"/g, '""')}"`,
      `"${(c.payment_terms || '').replace(/"/g, '""')}"`,
      `"${STATUS_CLIENT_CONFIG[c.status]?.label || c.status}"`,
      c.opportunities_count || 0,
      c.projects_count || 0,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Directorio_Clientes_PROCIMEC_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Cabecera Institucional Anti-Slop (Ley 5) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div className="space-y-1">
            <BackButton href="/dashboard" label="Volver a Mi Panel" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2.5 mt-2">
              <Briefcase className="w-6 h-6 text-accent flex-shrink-0" strokeWidth={1.75} />
              Directorio y Gestión de Clientes
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Directorio corporativo, seguimiento de cuentas, sectores económicos y ficha comercial de clientes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredClients.length === 0}
              className="btn-secondary text-xs px-3.5 py-2 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Descargar directorio en formato CSV"
            >
              <Download className="w-4 h-4 text-text-secondary" strokeWidth={1.75} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-accent text-xs px-4 py-2 font-bold flex items-center gap-2 text-primary-900 shadow-sm cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4 text-primary-900" strokeWidth={2.2} />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        </div>

        {/* Mensaje de Feedback */}
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" strokeWidth={2} />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Bloque de KPIs Sobrios */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Clientes</p>
              <p className="text-2xl font-bold font-mono text-text-primary mt-1">{stats.totalClients}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-accent">
              <Building2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Clientes Activos</p>
              <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">{stats.activeClients}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Prospectos</p>
              <p className="text-2xl font-bold font-mono text-amber-700 mt-1">{stats.prospectClients}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Clock className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="card p-4 border border-border flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Proyectos Vinculados</p>
              <p className="text-2xl font-bold font-mono text-primary-700 mt-1">{stats.projectsLinkedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700">
              <FolderGit2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-3 sm:p-4 border border-border space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Razón Social, NIT, Contacto, Ciudad o Sector..."
                className="input pl-10 text-xs sm:text-sm w-full font-sans"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="w-full sm:w-44">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input text-xs w-full cursor-pointer"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="active">Activos</option>
                  <option value="prospect">Prospectos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="blocked">Bloqueados</option>
                </select>
              </div>

              <div className="w-full sm:w-56">
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="input text-xs w-full cursor-pointer"
                >
                  <option value="all">Todos los Sectores</option>
                  {SECTOR_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="p-2 border border-border rounded-xl text-text-muted hover:text-accent hover:border-accent/40 bg-surface transition-colors cursor-pointer flex-shrink-0"
                title="Refrescar listado"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabla Técnica de Clientes */}
        <div className="card border border-border overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted space-y-3">
              <RotateCw className="w-7 h-7 text-accent animate-spin mx-auto" strokeWidth={1.75} />
              <p className="text-xs font-mono">Cargando directorio de clientes...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Building2 className="w-8 h-8 text-text-muted mx-auto" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-primary">No se encontraron clientes</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn-accent text-xs px-3.5 py-1.5 font-bold text-primary-900 mt-2 cursor-pointer"
              >
                Registrar Primer Cliente
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-border">
                <thead className="bg-surface/70 text-text-secondary uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Razón Social / Empresa</th>
                    <th className="px-4 py-3">NIT / Identificación</th>
                    <th className="px-4 py-3">Contacto Principal</th>
                    <th className="px-4 py-3">Sector & Ubicación</th>
                    <th className="px-4 py-3">Condiciones de Pago</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Vinculación</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredClients.map((client) => {
                    const statusCfg = STATUS_CLIENT_CONFIG[client.status] || {
                      label: client.status,
                      badge: 'bg-gray-100 text-gray-800',
                    };

                    return (
                      <tr key={client.id} className="hover:bg-surface/50 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-text-primary text-sm group-hover:text-primary transition-colors">
                            {client.company_name}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {client.client_type ? CLIENT_TYPE_LABELS[client.client_type] || client.client_type : 'Corporativo'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-text-secondary font-medium">
                          {client.nit || <span className="text-text-muted italic">Sin NIT</span>}
                        </td>

                        <td className="px-4 py-3.5">
                          {client.contact_name ? (
                            <div>
                              <div className="font-semibold text-text-primary">{client.contact_name}</div>
                              {client.contact_role && (
                                <div className="text-[11px] text-text-muted">{client.contact_role}</div>
                              )}
                              {client.phone && (
                                <div className="text-[11px] font-mono text-text-secondary mt-0.5 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                                  <span>{client.phone}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Sin contacto registrado</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="badge badge-primary text-[11px] font-medium">
                            {client.economic_sector || 'General'}
                          </span>
                          {client.city && (
                            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1 font-sans">
                              <MapPin className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                              <span>{client.city}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-text-secondary">
                          <span className="font-medium">{client.payment_terms || 'Contado'}</span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.badge}`}>
                            {statusCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2 font-mono text-[11px]">
                            <span
                              className="px-2 py-0.5 rounded bg-surface border border-border text-text-secondary"
                              title={`${client.opportunities_count || 0} oportunidades comerciales`}
                            >
                              O: <strong>{client.opportunities_count || 0}</strong>
                            </span>
                            <span
                              className="px-2 py-0.5 rounded bg-surface border border-border text-text-secondary"
                              title={`${client.projects_count || 0} proyectos ejecutados`}
                            >
                              P: <strong>{client.projects_count || 0}</strong>
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedClient(client)}
                              className="p-1.5 text-text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
                              title="Ver Ficha 360° del Cliente"
                            >
                              <Eye className="w-4 h-4" strokeWidth={1.75} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(client)}
                              className="p-1.5 text-text-muted hover:text-accent hover:bg-surface rounded-lg transition-colors cursor-pointer"
                              title="Editar Información"
                            >
                              <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 1: FICHA 360° DETALLADA DEL CLIENTE                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedClient(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-border flex items-start justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg sm:text-xl leading-tight">
                    {selectedClient.company_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-text-muted font-semibold">
                      NIT: {selectedClient.nit || 'Sin Registrar'}
                    </span>
                    <span className="text-text-muted text-xs">·</span>
                    <span className="text-xs text-text-secondary">
                      {selectedClient.client_type ? CLIENT_TYPE_LABELS[selectedClient.client_type] || selectedClient.client_type : 'Corporativo'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Contenido de la Ficha */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Bloque 1: Contacto y Ubicación */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Información de Contacto y Representación
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface/40 p-4 rounded-xl border border-border/60">
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Contacto Principal:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedClient.contact_name || 'No especificado'}</p>
                    {selectedClient.contact_role && (
                      <p className="text-xs text-text-secondary">{selectedClient.contact_role}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Correo Electrónico:</p>
                    <p className="font-mono text-text-primary mt-0.5 break-all">
                      {selectedClient.email ? (
                        <a href={`mailto:${selectedClient.email}`} className="text-primary hover:underline">
                          {selectedClient.email}
                        </a>
                      ) : (
                        'No registrado'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Teléfono / WhatsApp:</p>
                    <p className="font-mono text-text-primary mt-0.5">
                      {selectedClient.phone ? (
                        <a href={`tel:${selectedClient.phone}`} className="text-primary hover:underline">
                          {selectedClient.phone}
                        </a>
                      ) : (
                        'No registrado'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Ciudad / Sede:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedClient.city || 'No registrada'}</p>
                    {selectedClient.address && (
                      <p className="text-xs text-text-secondary truncate">{selectedClient.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Datos Comerciales */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Condiciones Comerciales y Sector
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface/40 p-4 rounded-xl border border-border/60">
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Sector Económico:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedClient.economic_sector || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Condiciones de Pago:</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedClient.payment_terms || 'Contado'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted font-medium">Estado Comercial:</p>
                    <p className="mt-0.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_CLIENT_CONFIG[selectedClient.status]?.badge || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_CLIENT_CONFIG[selectedClient.status]?.label || selectedClient.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Observaciones y Trazabilidad */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  Notas y Trazabilidad Operativa
                </h4>
                <div className="bg-surface/40 p-4 rounded-xl border border-border/60 space-y-3">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {selectedClient.notes || 'Sin observaciones registradas para este cliente.'}
                  </p>
                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted font-mono">
                    <span>Oportunidades en Pipeline: <strong>{selectedClient.opportunities_count || 0}</strong></span>
                    <span>Proyectos Vinculados: <strong>{selectedClient.projects_count || 0}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-4 bg-surface border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="btn-secondary text-xs px-3.5 py-1.5 font-semibold cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => {
                  const toEdit = selectedClient;
                  setSelectedClient(null);
                  handleOpenEdit(toEdit);
                }}
                className="btn-accent text-xs px-4 py-1.5 font-bold text-primary-900 flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary-900" strokeWidth={2} />
                <span>Editar Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CREACIÓN / EDICIÓN DE CLIENTE                      */}
      {/* ─────────────────────────────────────────────────────────── */}
      {isEditModalOpen && editingClient && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-border flex items-center justify-between gap-3 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-accent" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-base sm:text-lg">
                    {editingClient.id ? 'Editar Información de Cliente' : 'Registrar Nuevo Cliente'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Completa la información tributaria, comercial y de contacto institucional.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Formulario en Rejilla 2 Columnas (Ergonomía Industrial Ley 5) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(editingClient);
              }}
              className="p-6 overflow-y-auto space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Razón Social */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Razón Social / Empresa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingClient.company_name || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, company_name: e.target.value })}
                    placeholder="Ej. Consorcio Vías del Norte"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* NIT */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    NIT / Identificación Tributaria
                  </label>
                  <input
                    type="text"
                    value={editingClient.nit || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, nit: e.target.value })}
                    placeholder="Ej. 901.456.789-1"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Tipo de Cliente */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Tipo de Cliente
                  </label>
                  <select
                    value={editingClient.client_type || 'corporativo'}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        client_type: e.target.value as 'corporativo' | 'publico' | 'contratista' | 'particular',
                      })
                    }
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    <option value="corporativo">Corporativo / Privado</option>
                    <option value="publico">Entidad Pública</option>
                    <option value="contratista">Contratista de Obra</option>
                    <option value="particular">Particular / Consultor</option>
                  </select>
                </div>

                {/* Nombre de Contacto */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={editingClient.contact_name || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, contact_name: e.target.value })}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Cargo */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Cargo / Rol del Contacto
                  </label>
                  <input
                    type="text"
                    value={editingClient.contact_role || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, contact_role: e.target.value })}
                    placeholder="Ej. Director de Obra"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Correo Electrónico */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    placeholder="contacto@cliente.com"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="tel"
                    value={editingClient.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    placeholder="Ej. 3104567890"
                    className="input text-xs sm:text-sm w-full font-mono"
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Ciudad / Municipio
                  </label>
                  <input
                    type="text"
                    value={editingClient.city || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    placeholder="Ej. Barranquilla, Atlántico"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Sector Económico */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Sector Económico
                  </label>
                  <select
                    value={editingClient.economic_sector || 'Infraestructura Vial'}
                    onChange={(e) => setEditingClient({ ...editingClient, economic_sector: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    {SECTOR_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dirección */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Dirección Física
                  </label>
                  <input
                    type="text"
                    value={editingClient.address || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    placeholder="Ej. Calle 77 # 57-141 Oficina 402"
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Condiciones de Pago */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Condiciones de Pago
                  </label>
                  <select
                    value={editingClient.payment_terms || 'Crédito 30 días'}
                    onChange={(e) => setEditingClient({ ...editingClient, payment_terms: e.target.value })}
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Estado Comercial
                  </label>
                  <select
                    value={editingClient.status || 'active'}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        status: e.target.value as 'active' | 'prospect' | 'inactive' | 'blocked',
                      })
                    }
                    className="input text-xs sm:text-sm w-full cursor-pointer"
                  >
                    <option value="active">Activo</option>
                    <option value="prospect">Prospecto</option>
                    <option value="inactive">Inactivo</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>

                {/* Notas / Observaciones */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Notas u Observaciones Comerciales
                  </label>
                  <textarea
                    rows={3}
                    value={editingClient.notes || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                    placeholder="Acuerdos especiales, requerimientos específicos de facturación o pólizas..."
                    className="input text-xs sm:text-sm w-full"
                  />
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary text-xs px-3.5 py-2 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-accent text-xs px-5 py-2 font-bold text-primary-900 flex items-center gap-2 cursor-pointer shadow-sm hover:brightness-105 disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <RotateCw className="w-4 h-4 animate-spin text-primary-900" strokeWidth={2} />
                  ) : (
                    <Save className="w-4 h-4 text-primary-900" strokeWidth={2} />
                  )}
                  <span>{editingClient.id ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
