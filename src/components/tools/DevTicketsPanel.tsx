'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lightbulb,
  Clock,
  Play,
  RotateCcw,
  XCircle,
  FileCode,
  Terminal,
  AlertTriangle,
  RefreshCw,
  Search,
  ShieldAlert,
  Send,
  GitCommit
} from 'lucide-react';
import { DevTicket, DevTicketLog, DevTicketStatus } from '@/lib/dev-tickets/types';

const STATUS_LABELS: Record<DevTicketStatus, { label: string; color: string }> = {
  pending_spec: { label: 'Planificando IA', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  awaiting_approval: { label: 'Esperando Aprobación', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  approved: { label: 'Aprobado (Listo para Runner)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'En Ejecución Local', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  verifying: { label: 'Verificando Compilación', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  completed: { label: 'Completado y Desplegado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
  failed: { label: 'Fallido / Revertido', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'Cancelado', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
};

export function DevTicketsPanel() {
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reformulateFeedback, setReformulateFeedback] = useState('');
  const [showReformulateModal, setShowReformulateModal] = useState(false);

  // Consulta de tickets
  const { data: tickets = [], isLoading, refetch } = useQuery<DevTicket[]>({
    queryKey: ['dev-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/dev-tickets');
      if (!res.ok) throw new Error('Error al cargar tickets');
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Consulta del ticket seleccionado con sus logs
  const { data: selectedTicketData, isLoading: isLoadingDetail } = useQuery<{
    data: DevTicket & { logs: DevTicketLog[] };
  }>({
    queryKey: ['dev-ticket', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      const res = await fetch(`/api/dev-tickets/${selectedTicketId}`);
      if (!res.ok) throw new Error('Error al cargar detalle');
      return res.json();
    },
    enabled: !!selectedTicketId,
    refetchInterval: 5000, // refresco cada 5s cuando está viendo un ticket para ver logs
  });

  // Mutación para aprobar o cancelar
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: DevTicketStatus }) => {
      const res = await fetch(`/api/dev-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fallo al actualizar estado');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dev-ticket', selectedTicketId] });
    },
  });

  // Mutación para reformular
  const reformulateMutation = useMutation({
    mutationFn: async ({ ticketId, feedback }: { ticketId: string; feedback: string }) => {
      const res = await fetch(`/api/dev-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reformulate', feedback }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fallo al reformular');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowReformulateModal(false);
      setReformulateFeedback('');
      queryClient.invalidateQueries({ queryKey: ['dev-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dev-ticket', selectedTicketId] });
    },
  });

  // Filtrado
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Si no hay seleccionado, auto-seleccionar el primero
  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [tickets, selectedTicketId]);

  const activeDetail = selectedTicketData?.data;

  return (
    <div className="space-y-6">
      {/* Barra de Estadísticas y Controles */}
      <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en tickets..."
              className="pl-9 pr-3 py-2 bg-[#15181D] border border-[#2A303C] focus:border-[#EAA023] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none w-56 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#15181D] border border-[#2A303C] focus:border-[#EAA023] rounded-xl text-xs text-white focus:outline-none transition-colors"
          >
            <option value="all">Todos los estados</option>
            <option value="awaiting_approval">Esperando Aprobación</option>
            <option value="approved">Aprobados para Runner</option>
            <option value="in_progress">En Ejecución Local</option>
            <option value="completed">Completados</option>
            <option value="failed">Fallidos</option>
          </select>
        </div>

        <button
          onClick={() => refetch()}
          type="button"
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-[#15181D] border border-[#2A303C] hover:border-[#EAA023] text-white/80 hover:text-white transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#EAA023]" />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Grid de 2 Columnas: Lista de Tickets + Detalle Técnico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Lista de Tickets */}
        <div className="lg:col-span-5 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center bg-[#1E2229] border border-[#2A303C] rounded-2xl text-xs text-white/50">
              Cargando tickets de desarrollo...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center bg-[#1E2229] border border-[#2A303C] rounded-2xl text-xs text-white/50 space-y-2">
              <Lightbulb className="w-8 h-8 text-[#EAA023]/40 mx-auto" strokeWidth={1.5} />
              <p>No se encontraron tickets registrados.</p>
              <p className="text-[11px] text-white/40">Usa el botón de bombilla flotante para proponer uno.</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isSelected = ticket.id === selectedTicketId;
              const statusInfo = STATUS_LABELS[ticket.status] || { label: ticket.status, color: 'bg-zinc-500/10 text-zinc-400' };

              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#2A303C] border-[#EAA023] shadow-md'
                      : 'bg-[#1E2229] border-[#2A303C] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-[11px] font-mono text-white/40">
                      {new Date(ticket.created_at).toLocaleDateString('es-CO')}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 mb-1">
                    {ticket.title}
                  </h3>
                  <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                    {ticket.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                    <span>{ticket.user?.email || 'Usuario'}</span>
                    {ticket.context_url && (
                      <span className="truncate max-w-[120px]">{ticket.context_url}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Columna Derecha: Detalle Técnico, Plan y Logs */}
        <div className="lg:col-span-7">
          {isLoadingDetail || !activeDetail ? (
            <div className="p-12 text-center bg-[#1E2229] border border-[#2A303C] rounded-2xl text-xs text-white/50">
              Selecciona un ticket para inspeccionar el plan técnico y logs de ejecución.
            </div>
          ) : (
            <div className="bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
              {/* Header del Ticket */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_LABELS[activeDetail.status]?.color}`}>
                    {STATUS_LABELS[activeDetail.status]?.label}
                  </span>
                  <span className="text-xs font-mono text-white/50">
                    ID: {activeDetail.id.slice(0, 8)}...
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white tracking-tight">
                  {activeDetail.title}
                </h2>
                <p className="text-xs text-white/70 mt-1 leading-relaxed whitespace-pre-wrap">
                  {activeDetail.description}
                </p>

                {activeDetail.commit_hash && (
                  <div className="mt-3 flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono">
                    <GitCommit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Commit desplegado en main: <strong>{activeDetail.commit_hash}</strong></span>
                  </div>
                )}
              </div>

              {/* Botones de Gobernanza y Acción */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#2A303C]">
                {activeDetail.status === 'awaiting_approval' && (
                  <>
                    <button
                      onClick={() => updateStatusMutation.mutate({ ticketId: activeDetail.id, status: 'approved' })}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EAA023] hover:bg-[#d68f1c] text-[#1E2229] font-bold text-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Aprobar para Runner</span>
                    </button>

                    <button
                      onClick={() => setShowReformulateModal(true)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#15181D] border border-[#2A303C] hover:border-[#EAA023] text-white text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#EAA023]" />
                      <span>Reformular Plan</span>
                    </button>
                  </>
                )}

                {activeDetail.status === 'approved' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Listo: el Runner en tu PC lo tomará al encender</span>
                  </div>
                )}

                {['awaiting_approval', 'approved', 'failed'].includes(activeDetail.status) && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ ticketId: activeDetail.id, status: 'cancelled' })}
                    disabled={updateStatusMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors ml-auto"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}
              </div>

              {/* Especificación Técnica Generada por IA */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#EAA023] flex items-center gap-1.5">
                  <FileCode className="w-4 h-4" />
                  <span>Plan de Ingeniería Propuesto</span>
                </h3>

                {activeDetail.technical_spec?.summary ? (
                  <div className="bg-[#15181D] border border-[#2A303C] rounded-xl p-4 space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-white/90">Resumen del Enfoque:</span>
                      <p className="text-white/70 mt-0.5 leading-relaxed">
                        {activeDetail.technical_spec.summary}
                      </p>
                    </div>

                    {/* Archivos Afectados */}
                    {activeDetail.technical_spec.affectedFiles?.length > 0 && (
                      <div>
                        <span className="font-semibold text-white/90">Archivos Afectados:</span>
                        <div className="mt-1 space-y-1">
                          {activeDetail.technical_spec.affectedFiles.map((f, i) => (
                            <div key={i} className="flex items-center justify-between font-mono text-[11px] bg-black/30 px-2.5 py-1.5 rounded border border-[#2A303C]">
                              <span className="text-white/90 truncate">{f.path}</span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                f.action === 'create' ? 'bg-emerald-500/20 text-emerald-300' :
                                f.action === 'delete' ? 'bg-rose-500/20 text-rose-300' :
                                'bg-sky-500/20 text-sky-300'
                              }`}>
                                {f.action}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Riesgos */}
                    {activeDetail.technical_spec.risks?.length > 0 && (
                      <div>
                        <span className="font-semibold text-white/90 flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Riesgos Identificados:</span>
                        </span>
                        <ul className="mt-1 list-disc list-inside text-white/70 space-y-0.5">
                          {activeDetail.technical_spec.risks.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Acciones Externas (Supabase / Permisos / SQL) */}
                    {activeDetail.technical_spec.externalActions && activeDetail.technical_spec.externalActions.length > 0 && (
                      <div className="pt-2 border-t border-[#2A303C] space-y-2">
                        <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Acción Externa Requerida (Solo Admin):</span>
                        </span>
                        {activeDetail.technical_spec.externalActions.map((act, i) => (
                          <div key={i} className="p-3 bg-black/40 border border-amber-500/30 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-[11px]">{act.title}</span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                                {act.type}
                              </span>
                            </div>
                            <p className="text-white/70 text-[11px] leading-relaxed">{act.instructions}</p>
                            {act.payload && (
                              <div className="relative">
                                <pre className="p-2.5 bg-[#0D1015] border border-[#2A303C] rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap select-all">
                                  {act.payload}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[#15181D] rounded-xl text-xs text-white/50">
                    Aún no se ha redactado la especificación para este ticket.
                  </div>
                )}
              </div>

              {/* Consola de Terminal y Logs en Vivo */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Consola de Auditoría del Runner</span>
                </h3>

                <div className="bg-[#0D1015] border border-[#2A303C] rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-white/70 space-y-1">
                  {activeDetail.logs?.length === 0 ? (
                    <div className="text-white/40 italic">Sin actividad registrada aún.</div>
                  ) : (
                    activeDetail.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2">
                        <span className="text-white/40 shrink-0">
                          {new Date(log.created_at).toLocaleTimeString('es-CO')}
                        </span>
                        <span className="text-[#EAA023] shrink-0 font-bold">[{log.stage}]</span>
                        <span className="text-white/80 break-words">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reformulación */}
      {showReformulateModal && activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#1E2229] border border-[#2A303C] rounded-2xl p-5 text-white space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#EAA023]" />
              <span>Ajustar y Reformular Plan Técnico</span>
            </h3>
            <p className="text-xs text-white/70">
              Indica qué correcciones debe hacer la IA sobre la propuesta actual (archivos a no tocar, estilo, enfoque).
            </p>

            <textarea
              rows={4}
              value={reformulateFeedback}
              onChange={(e) => setReformulateFeedback(e.target.value)}
              placeholder="Ej: No toques la tabla principal, agrégalo como un modal flotante con selector ámbar..."
              className="w-full px-3 py-2 bg-[#15181D] border border-[#2A303C] focus:border-[#EAA023] rounded-xl text-xs text-white placeholder-white/30 focus:outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReformulateModal(false)}
                className="px-3 py-1.5 text-xs text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reformulateMutation.isPending || !reformulateFeedback.trim()}
                onClick={() => reformulateMutation.mutate({ ticketId: activeDetail.id, feedback: reformulateFeedback })}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#EAA023] hover:bg-[#d68f1c] text-[#1E2229] font-bold text-xs rounded-xl disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{reformulateMutation.isPending ? 'Regenerando...' : 'Re-analizar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
