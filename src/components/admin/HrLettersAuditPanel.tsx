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
  Mail,
  CheckCircle2,
  X,
  Copy,
  Check,
  Calendar,
  User,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  Send,
} from 'lucide-react';

interface FilterState {
  search: string;
  letterType: string;
  userId: string;
  emailStatus: 'all' | 'sent' | 'pending';
  fromDate: string;
}

export function HrLettersAuditPanel() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    letterType: 'all',
    userId: 'all',
    emailStatus: 'all',
    fromDate: '',
  });

  const [selectedLetter, setSelectedLetter] = useState<HrLetter | null>(null);
  const [modalTab, setModalTab] = useState<'text' | 'pdf' | 'data'>('text');
  const [copiedText, setCopiedText] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Consulta de auditoría en backend
  const { data: auditResponse, isLoading, refetch } = useQuery({
    queryKey: ['hr-letters-audit', filters.letterType, filters.userId, filters.fromDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.letterType !== 'all') params.set('letterType', filters.letterType);
      if (filters.userId !== 'all') params.set('userId', filters.userId);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);

      const res = await fetch(`/api/letters/audit?${params.toString()}`);
      const json = await res.json();
      return json as { data?: HrLetter[]; migrationNeeded?: boolean; message?: string };
    },
  });

  // Consulta de usuarios para filtro
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

  // Métricas reactivas avanzadas con utilidad de filtro
  const metrics = useMemo(() => {
    const total = letters.length;
    const emails = letters.filter((l) => l.email_sent).length;
    const pendingEmails = total - emails;
    const emailRate = total > 0 ? Math.round((emails / total) * 100) : 100;
    const uniqueEmployees = new Set(
      letters.map((l) => l.employee_name || l.recipient_name).filter(Boolean)
    ).size;
    const certsCount = letters.filter(
      (l) => l.letter_type === '01_certificacion_laboral'
    ).length;

    return { total, emails, pendingEmails, emailRate, uniqueEmployees, certsCount };
  }, [letters]);

  // Filtros aplicados localmente (búsqueda y estado de correo)
  const filteredLetters = useMemo(() => {
    let list = letters;

    // Filtro por estado de correo
    if (filters.emailStatus === 'sent') {
      list = list.filter((l) => l.email_sent);
    } else if (filters.emailStatus === 'pending') {
      list = list.filter((l) => !l.email_sent);
    }

    // Filtro reactivo por búsqueda de texto libre
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter((item) => {
        const rad = (item.radicado || '').toLowerCase();
        const emp = (item.employee_name || '').toLowerCase();
        const doc = (item.employee_document || '').toLowerCase();
        const rec = (item.recipient_name || '').toLowerCase();
        const ent = (item.recipient_entity || '').toLowerCase();
        const user = (item.users?.full_name || item.users?.email || '').toLowerCase();
        const email = (item.email_recipient || '').toLowerCase();
        const type = (item.letter_title || '').toLowerCase();
        return (
          rad.includes(q) ||
          emp.includes(q) ||
          doc.includes(q) ||
          rec.includes(q) ||
          ent.includes(q) ||
          user.includes(q) ||
          email.includes(q) ||
          type.includes(q)
        );
      });
    }

    return list;
  }, [letters, filters.emailStatus, filters.search]);

  // Verificar si hay filtros activos diferentes a los predeterminados
  const hasActiveFilters =
    filters.search !== '' ||
    filters.letterType !== 'all' ||
    filters.userId !== 'all' ||
    filters.emailStatus !== 'all' ||
    filters.fromDate !== '';

  const handleResetFilters = () => {
    setFilters({
      search: '',
      letterType: 'all',
      userId: 'all',
      emailStatus: 'all',
      fromDate: '',
    });
  };

  return (
    <div className="space-y-5">
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

      {/* ─── TARJETAS DE MÉTRICAS INTERACTIVAS (FILTROS RÁPIDOS) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Métrica 1: Cartas Emitidas */}
        <button
          type="button"
          onClick={() => setFilters((prev) => ({ ...prev, emailStatus: 'all', letterType: 'all' }))}
          className={`text-left p-4 rounded-2xl border transition-all duration-160 flex items-center gap-3.5 shadow-sm group ${
            filters.emailStatus === 'all' && filters.letterType === 'all'
              ? 'bg-white border-[#EAA023] ring-1 ring-[#EAA023]'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-[#1E2229] text-[#EAA023] flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cartas Emitidas
            </p>
            <p className="text-xl font-bold font-mono text-[#0F172A] mt-0.5">
              {metrics.total}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Clic para ver todo el archivo
            </p>
          </div>
        </button>

        {/* Métrica 2: Envíos por Correo */}
        <button
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              emailStatus: prev.emailStatus === 'sent' ? 'all' : 'sent',
            }))
          }
          className={`text-left p-4 rounded-2xl border transition-all duration-160 flex items-center gap-3.5 shadow-sm group ${
            filters.emailStatus === 'sent'
              ? 'bg-emerald-50/50 border-emerald-400 ring-1 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
            <Mail className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Envíos por Correo
            </p>
            <p className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
              {metrics.emails}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {metrics.emailRate}% efectividad de entrega
            </p>
          </div>
        </button>

        {/* Métrica 3: Certificaciones Laborales */}
        <button
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              letterType:
                prev.letterType === '01_certificacion_laboral' ? 'all' : '01_certificacion_laboral',
            }))
          }
          className={`text-left p-4 rounded-2xl border transition-all duration-160 flex items-center gap-3.5 shadow-sm group ${
            filters.letterType === '01_certificacion_laboral'
              ? 'bg-amber-50/50 border-[#EAA023] ring-1 ring-[#EAA023]'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Certificaciones
            </p>
            <p className="text-xl font-bold font-mono text-[#0F172A] mt-0.5">
              {metrics.certsCount}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Plantilla laboral principal
            </p>
          </div>
        </button>

        {/* Métrica 4: Beneficiarios Únicos */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
            <UserCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Beneficiarios Únicos
            </p>
            <p className="text-xl font-bold font-mono text-blue-700 mt-0.5">
              {metrics.uniqueEmployees}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Colaboradores atendidos
            </p>
          </div>
        </div>
      </div>

      {/* ─── TABLA DE AUDITORÍA CON FILTROS INTEGRADOS ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cabecera integrada de la tabla con Buscador y Acción Principal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E2229] text-[#EAA023] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#0F172A]">
                  Registro Histórico de Auditoría
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                  {filteredLetters.length} {filteredLetters.length === 1 ? 'carta' : 'cartas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Fiscalización oficial de radicados, destinatarios y trazabilidad de entrega digital
              </p>
            </div>
          </div>

          {/* Buscador reactivo y botón de acción */}
          <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar por radicado, empleado, cédula o entidad..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#EAA023] shadow-xs"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors shadow-xs"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>

            <Link
              href="/forms/elaboracion-cartas"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
              <span className="hidden sm:inline">Elaborar Carta</span>
            </Link>
          </div>
        </div>

        {/* Fila de Filtros Integrados directamente sobre la tabla */}
        <div className="px-4 py-2.5 bg-slate-50/30 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#EAA023]" strokeWidth={2} />
              Filtros:
            </span>

            {/* Filtro: Tipo de Documento */}
            <select
              value={filters.letterType}
              onChange={(e) => setFilters((prev) => ({ ...prev, letterType: e.target.value }))}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#EAA023]"
            >
              <option value="all">Todos los tipos de carta</option>
              {(Object.keys(HR_LETTER_TYPES) as HrLetterType[]).map((k) => (
                <option key={k} value={k}>
                  {HR_LETTER_TYPES[k].title}
                </option>
              ))}
            </select>

            {/* Filtro: Diligenciada por */}
            <select
              value={filters.userId}
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#EAA023]"
            >
              <option value="all">Diligenciada por: Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>

            {/* Filtro: Estado de Entrega por Correo */}
            <select
              value={filters.emailStatus}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  emailStatus: e.target.value as 'all' | 'sent' | 'pending',
                }))
              }
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#EAA023]"
            >
              <option value="all">Estado Correo: Todos</option>
              <option value="sent">✓ Enviados con Éxito</option>
              <option value="pending">⚠ Solo Descarga / Sin Envío</option>
            </select>

            {/* Filtro: Fecha Desde */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Desde:</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                className="text-xs bg-transparent border-0 focus:outline-none font-mono text-slate-700"
              />
            </div>
          </div>

          {/* Botón de Limpiar Filtros si hay alguno activo */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Listado / Tabla */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse font-mono">
            Cargando registros de auditoría de cartas...
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.75} />
            <p className="text-xs font-semibold text-slate-600">
              No se encontraron cartas que coincidan con los filtros aplicados.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Pruebe cambiando los términos de búsqueda o genere una nueva carta.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer todos los filtros</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  <th className="py-3 px-4">Radicado</th>
                  <th className="py-3 px-4">Tipo de Documento</th>
                  <th className="py-3 px-4">Beneficiario / Destinatario</th>
                  <th className="py-3 px-4">Diligenciada por</th>
                  <th className="py-3 px-4">Fecha de Emisión</th>
                  <th className="py-3 px-4">Entrega por Correo</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLetters.map((letter) => {
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
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1E2229]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {letter.radicado}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {meta.title}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          {meta.badge}
                        </span>
                      </td>

                      {/* Colaborador / Beneficiario */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0F172A]">
                          {letter.employee_name || letter.recipient_name || 'N/A'}
                        </div>
                        {letter.employee_document && (
                          <div className="text-[10px] font-mono text-slate-500">
                            C.C. {letter.employee_document}
                          </div>
                        )}
                        {letter.recipient_entity && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={letter.recipient_entity}>
                            {letter.recipient_entity}
                          </div>
                        )}
                      </td>

                      {/* Quién la llenó */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#0F172A]">
                          {letter.users?.full_name || 'Usuario PROCIMEC'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]" title={letter.users?.email || ''}>
                          {letter.users?.email || 'N/A'}
                        </div>
                      </td>

                      {/* Cuándo la llenó */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Estado de Entrega por Correo */}
                      <td className="py-3.5 px-4">
                        {letter.email_sent ? (
                          <div className="space-y-0.5">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700"
                              title={`Entregado exitosamente a ${letter.email_recipient || 'correo'}`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" strokeWidth={2} />
                              <span>Enviado con éxito</span>
                            </span>
                            {letter.email_recipient && (
                              <p
                                className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]"
                                title={letter.email_recipient}
                              >
                                {letter.email_recipient}
                              </p>
                            )}
                            {letter.email_sent_at && (
                              <p className="text-[9px] font-mono text-slate-400">
                                {new Date(letter.email_sent_at).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700"
                              title="El documento fue registrado en base de datos pero no se despachó automáticamente por correo"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" strokeWidth={2} />
                              <span>No enviado</span>
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Solo descarga local
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Botón Auditar */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenAuditModal(letter)}
                          disabled={loadingDetailId === letter.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-xs"
                        >
                          {loadingDetailId === letter.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#EAA023]" strokeWidth={1.75} />
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

      {/* ─── MODAL DETALLADO DE AUDITORÍA Y FISCALIZACIÓN ─── */}
      {selectedLetter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1E2229] text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAA023]/20 border border-[#EAA023]/30 flex items-center justify-center text-[#EAA023]">
                  <FileText className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <span>{selectedLetter.letter_title}</span>
                    <span className="font-mono text-xs text-[#EAA023] bg-[#EAA023]/10 px-2 py-0.5 rounded border border-[#EAA023]/20">
                      {selectedLetter.radicado}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Expediente oficial archivado para control y trazabilidad legal de RRHH
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
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
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Entrega por Correo</span>
                <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                  {selectedLetter.email_sent ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Enviado a {selectedLetter.email_recipient}
                    </>
                  ) : (
                    'Solo descarga local'
                  )}
                </span>
              </div>
            </div>

            {/* Tabs del Modal */}
            <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-2">
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
