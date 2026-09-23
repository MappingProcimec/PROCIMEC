'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { HrLetter, HrLetterType } from '@/types';
import { HR_LETTER_TYPES } from '@/lib/letters/docxTemplateEngine';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Mail,
  CheckCircle2,
  X,
  Copy,
  Check,
  Calendar,
  User,
  Building2,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

interface FilterState {
  search: string;
  letterType: string;
  userId: string;
  projectId: string;
  fromDate: string;
  toDate: string;
}

export function HrLettersAuditPanel() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    letterType: 'all',
    userId: 'all',
    projectId: 'all',
    fromDate: '',
    toDate: '',
  });

  const [selectedLetter, setSelectedLetter] = useState<HrLetter | null>(null);
  const [modalTab, setModalTab] = useState<'text' | 'pdf' | 'data'>('text');
  const [copiedText, setCopiedText] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Consulta de auditoría
  const { data: auditResponse, isLoading, refetch } = useQuery({
    queryKey: ['hr-letters-audit', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.letterType !== 'all') params.set('letterType', filters.letterType);
      if (filters.userId !== 'all') params.set('userId', filters.userId);
      if (filters.projectId !== 'all') params.set('projectId', filters.projectId);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);

      const res = await fetch(`/api/letters/audit?${params.toString()}`);
      const json = await res.json();
      return json as { data?: HrLetter[]; migrationNeeded?: boolean; message?: string };
    },
  });

  // Consulta de proyectos y usuarios para filtros
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      const json = await res.json();
      return (json.data ?? []) as { id: string; name: string; code?: string }[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      return (json.data ?? []) as { id: string; full_name: string; email: string }[];
    },
  });

  const letters = auditResponse?.data ?? [];
  const migrationNeeded = auditResponse?.migrationNeeded ?? false;

  // Cargar detalle completo (con base64) para auditar
  const handleOpenAuditModal = async (letter: HrLetter) => {
    setLoadingDetailId(letter.id);
    try {
      const res = await fetch(`/api/letters/audit?id=${letter.id}`);
      const json = await res.json();
      if (json.data) {
        setSelectedLetter(json.data);
      } else {
        setSelectedLetter(letter);
      }
      setModalTab('text');
    } catch {
      setSelectedLetter(letter);
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Descarga de archivo desde base64
  const downloadFile = (base64Data: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copiar texto renderizado al portapapeles
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Métricas rápidas
  const metrics = useMemo(() => {
    const total = letters.length;
    const emails = letters.filter((l) => l.email_sent).length;
    const uniqueEmployees = new Set(letters.map((l) => l.employee_name || l.recipient_name).filter(Boolean)).size;
    return { total, emails, uniqueEmployees };
  }, [letters]);

  return (
    <div className="space-y-6">
      {/* Aviso si la migración de la tabla está pendiente en Supabase */}
      {migrationNeeded && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="flex-1">
            <strong className="font-bold">Migración de Base de Datos Pendiente:</strong>
            <p className="mt-0.5 leading-relaxed">
              La tabla <code className="bg-amber-200/60 px-1.5 py-0.5 rounded font-mono">public.hr_letters</code> aún no ha sido creada en Supabase.
              Por favor ejecute el script <code className="bg-amber-200/60 px-1.5 py-0.5 rounded font-mono">supabase/migrations/023_create_hr_letters.sql</code> en el editor SQL de Supabase para activar la persistencia completa.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas de Auditoría */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#1E2229] text-[#EAA023] flex items-center justify-center font-bold text-sm">
            <FileText className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cartas Emitidas
            </p>
            <p className="text-xl font-bold font-mono text-[#0F172A] mt-0.5">
              {metrics.total}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm">
            <Mail className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Envíos por Correo
            </p>
            <p className="text-xl font-bold font-mono text-blue-700 mt-0.5">
              {metrics.emails}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm">
            <User className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Beneficiarios Únicos
            </p>
            <p className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
              {metrics.uniqueEmployees}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador reactivo */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar por radicado, empleado, cédula o entidad..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#EAA023]"
            />
          </div>

          {/* Acciones principales */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>

            <Link
              href="/forms/elaboracion-cartas"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
              <span>Elaborar Nueva Carta</span>
            </Link>
          </div>
        </div>

        {/* Filtros específicos desplegables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Tipo de Documento
            </label>
            <select
              value={filters.letterType}
              onChange={(e) => setFilters((prev) => ({ ...prev, letterType: e.target.value }))}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="all">Todos los tipos de carta</option>
              {(Object.keys(HR_LETTER_TYPES) as HrLetterType[]).map((k) => (
                <option key={k} value={k}>
                  {HR_LETTER_TYPES[k].title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Diligenciada por
            </label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="all">Todos los colaboradores</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Proyecto
            </label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="all">Todos los proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filtro de Fecha (Desde)
            </label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Listado / Tabla de Auditoría */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
            <h3 className="font-bold text-sm text-[#0F172A]">
              Registro Histórico de Auditoría
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {letters.length} {letters.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse font-mono">
            Cargando registros de auditoría de cartas...
          </div>
        ) : letters.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.75} />
            <p className="text-xs font-semibold text-slate-600">
              No se encontraron cartas que coincidan con los filtros aplicados.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Pruebe cambiando los términos de búsqueda o genere una nueva carta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  <th className="py-3 px-4">Radicado</th>
                  <th className="py-3 px-4">Tipo de Carta</th>
                  <th className="py-3 px-4">Quién la Llenó</th>
                  <th className="py-3 px-4">Cuándo la Llenó</th>
                  <th className="py-3 px-4">Colaborador / Destinatario</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4 text-center">Correo</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {letters.map((letter) => {
                  const meta = HR_LETTER_TYPES[letter.letter_type] || {
                    title: letter.letter_title || letter.letter_type,
                    badge: 'RRHH',
                  };

                  const formattedDate = new Date(letter.created_at).toLocaleString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={letter.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Radicado */}
                      <td className="py-3 px-4 font-mono font-bold text-[#1E2229]">
                        {letter.radicado}
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {meta.title}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {meta.badge}
                        </span>
                      </td>

                      {/* Quién la llenó */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F172A]">
                          {letter.users?.full_name || 'Usuario PROCIMEC'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {letter.users?.email || 'N/A'}
                        </div>
                      </td>

                      {/* Cuándo la llenó */}
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Colaborador / Destinatario */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F172A]">
                          {letter.employee_name || letter.recipient_name || 'N/A'}
                        </div>
                        {letter.employee_document && (
                          <div className="text-[10px] font-mono text-slate-400">
                            C.C. {letter.employee_document}
                          </div>
                        )}
                        {letter.recipient_entity && (
                          <div className="text-[10px] text-slate-500">
                            {letter.recipient_entity}
                          </div>
                        )}
                      </td>

                      {/* Proyecto */}
                      <td className="py-3 px-4 text-slate-600 max-w-[140px] truncate" title={letter.projects?.name || ''}>
                        {letter.projects?.name || letter.letter_data?.proy_nombre || '—'}
                      </td>

                      {/* Correo */}
                      <td className="py-3 px-4 text-center">
                        {letter.email_sent ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700"
                            title={`Enviado a ${letter.email_recipient || 'correo'}`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Registrado
                          </span>
                        )}
                      </td>

                      {/* Botón Auditar */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenAuditModal(letter)}
                          disabled={loadingDetailId === letter.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-xs"
                        >
                          {loadingDetailId === letter.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-[#EAA023]" />
                          ) : (
                            <Eye className="w-3 h-3 text-[#EAA023]" strokeWidth={1.75} />
                          )}
                          <span>Auditar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL / DRAWER DE AUDITORÍA Y DETALLE DE CARTA ─── */}
      {selectedLetter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-160">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1E2229] text-white flex items-center justify-between border-b-2 border-[#EAA023]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#EAA023]">
                  <FileCheck className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#EAA023]">
                      {selectedLetter.radicado}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                      {selectedLetter.status}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                    {selectedLetter.letter_title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha técnica rápida de auditoría */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Diligenciado por</span>
                <span className="font-semibold text-slate-800">
                  {selectedLetter.users?.full_name || 'Usuario PROCIMEC'}
                </span>
                <span className="block font-mono text-[10px] text-slate-500 truncate">
                  {selectedLetter.users?.email}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha / Hora Emisión</span>
                <span className="font-mono font-medium text-slate-700">
                  {new Date(selectedLetter.created_at).toLocaleString('es-CO')}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Empleado / Beneficiario</span>
                <span className="font-semibold text-slate-800">
                  {selectedLetter.employee_name || selectedLetter.recipient_name || 'N/A'}
                </span>
                {selectedLetter.employee_document && (
                  <span className="block font-mono text-[10px] text-slate-500">
                    C.C. {selectedLetter.employee_document}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Despacho por Correo</span>
                <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                  {selectedLetter.email_sent ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Enviado a {selectedLetter.email_recipient}
                    </>
                  ) : (
                    'Registro en plataforma'
                  )}
                </span>
              </div>
            </div>

            {/* Tabs del Modal */}
            <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalTab('text')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    modalTab === 'text'
                      ? 'border-[#EAA023] text-[#1E2229]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Texto Completo de la Carta
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('pdf')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    modalTab === 'pdf'
                      ? 'border-[#EAA023] text-[#1E2229]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Visor de PDF
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('data')}
                  className={`px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    modalTab === 'data'
                      ? 'border-[#EAA023] text-[#1E2229]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Datos del Formulario (JSON)
                </button>
              </div>

              {/* Botones de Descarga directa en el modal */}
              <div className="flex items-center gap-2 pb-2">
                {selectedLetter.docx_base64 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        selectedLetter.docx_base64!,
                        `${selectedLetter.radicado}.docx`,
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word (.docx)</span>
                  </button>
                )}

                {selectedLetter.pdf_base64 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        selectedLetter.pdf_base64!,
                        `${selectedLetter.radicado}.pdf`,
                        'application/pdf'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E2229] text-[#EAA023] text-xs font-bold hover:bg-[#15181D] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF (.pdf)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {modalTab === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Contenido textual íntegro registrado para auditoría y validez legal:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedLetter.rendered_text)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Texto Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {selectedLetter.rendered_text}
                  </div>
                </div>
              )}

              {modalTab === 'pdf' && (
                <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col">
                  {selectedLetter.pdf_base64 ? (
                    <iframe
                      src={`data:application/pdf;base64,${selectedLetter.pdf_base64}`}
                      className="w-full h-full border-0"
                      title="Visor PDF Carta"
                    />
                  ) : (
                    <div className="m-auto text-center p-6">
                      <p className="text-xs text-slate-500 mb-2">
                        El archivo PDF oficial se encuentra disponible para descarga.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          selectedLetter.pdf_url && window.open(selectedLetter.pdf_url, '_blank')
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2229] text-[#EAA023] text-xs font-bold"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir PDF en pestaña nueva
                      </button>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'data' && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(selectedLetter.letter_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">
                ID: {selectedLetter.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
