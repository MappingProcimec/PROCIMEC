'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { generateAttendancePDF } from '@/lib/attendancePdfGenerator';
import type { AttendanceRecord, FieldTrip } from '@/types';

// Coordenadas de referencia Oficina Mapping Ingeniería / PROCIMEC (Barranquilla, Colombia)
const OFFICE_COORDS = {
  lat: 11.016140,
  lng: -74.828108,
  name: 'Oficina Principal (Mapping / PROCIMEC)',
  radiusMeters: 500, // Radio de tolerancia de geocerca (500 metros)
};

interface ActiveUser {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatTimeOnly(isoString?: string | null): string {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return isoString;
  }
}

function formatDateSpanish(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getFortnightRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (day <= 15) {
    const fromStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const toStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    return { from: fromStr, to: toStr, label: '1ª Quincena del Mes' };
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const fromStr = `${year}-${String(month + 1).padStart(2, '0')}-16`;
    const toStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from: fromStr, to: toStr, label: '2ª Quincena del Mes' };
  }
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    to: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function AttendanceTrackerContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const paramUserId = searchParams.get('userId');

  const isAdmin = session?.user?.role === 'admin';

  // Modo de vista: 'personal' o 'team' (solo para administradores)
  const [adminViewMode, setAdminViewMode] = useState<'personal' | 'team'>(
    paramUserId || isAdmin ? 'team' : 'personal'
  );

  // Filtro de colaborador para vista admin
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(paramUserId || 'all');

  // Estados de tiempo
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateTitle, setCurrentDateTitle] = useState<string>('');

  // Estados de Geolocalización
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [isOfficeDetected, setIsOfficeDetected] = useState<boolean>(false);
  const [geoLocating, setGeoLocating] = useState<boolean>(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Registros
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [teamTodayRecords, setTeamTodayRecords] = useState<AttendanceRecord[]>([]);
  const [activeUsersList, setActiveUsersList] = useState<ActiveUser[]>([]);

  const [loadingToday, setLoadingToday] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Notas y modals
  const [checkInNote, setCheckInNote] = useState<string>('');
  const [fieldModalOpen, setFieldModalOpen] = useState<boolean>(false);
  const [fieldDestination, setFieldDestination] = useState<string>('');
  const [fieldNotes, setFieldNotes] = useState<string>('');

  // Filtros de historial
  const [filterMode, setFilterMode] = useState<'quincena' | 'mes' | 'custom'>('quincena');
  const [filterFrom, setFilterFrom] = useState<string>(getFortnightRange().from);
  const [filterTo, setFilterTo] = useState<string>(getFortnightRange().to);
  // Notificaciones
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);

  // Reloj en tiempo real
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateTitle(
        now.toLocaleDateString('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Obtener geolocalización
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalización no soportada por el navegador');
      setGeoLocating(false);
      return;
    }

    setGeoLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        setCoords({ lat: userLat, lng: userLng, accuracy: acc });

        const dist = calculateDistanceMeters(userLat, userLng, OFFICE_COORDS.lat, OFFICE_COORDS.lng);
        setDistanceToOffice(dist);
        setIsOfficeDetected(dist <= OFFICE_COORDS.radiusMeters);
        setGeoLocating(false);
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
        setGeoError('GPS no concedido o no disponible (se registrará sin coordenadas exactas)');
        setGeoLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  // Cargar registro de hoy y datos de equipo
  const fetchTodayRecord = useCallback(async () => {
    try {
      setLoadingToday(true);
      const res = await fetch('/api/attendance');
      if (res.status === 403) {
        setUnauthorized(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setTodayRecord(json.today ?? null);
        if (json.teamToday) setTeamTodayRecords(json.teamToday);
        if (json.activeUsers) setActiveUsersList(json.activeUsers);
      }
    } catch (e) {
      console.error('Error fetching today record:', e);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  // Cargar historial por rango y usuario seleccionado
  const fetchHistory = useCallback(async (from: string, to: string, employeeId: string) => {
    try {
      setLoadingHistory(true);
      const targetQuery = employeeId !== 'all' ? `&userId=${encodeURIComponent(employeeId)}` : '&userId=all';
      const res = await fetch(`/api/attendance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${targetQuery}`);
      if (res.status === 403) {
        setUnauthorized(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setHistoryRecords(json.history ?? json.records ?? []);
        if (json.teamToday) setTeamTodayRecords(json.teamToday);
        if (json.activeUsers) setActiveUsersList(json.activeUsers);
      }
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayRecord();
  }, [fetchTodayRecord]);

  useEffect(() => {
    const target = adminViewMode === 'team' ? selectedEmployeeId : '';
    fetchHistory(filterFrom, filterTo, target);
  }, [filterFrom, filterTo, selectedEmployeeId, adminViewMode, fetchHistory]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Registrar Entrada
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const payload = {
        action: 'check_in',
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        location_name: isOfficeDetected ? OFFICE_COORDS.name : coords ? `En Campo (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Ubicación sin GPS',
        is_office: isOfficeDetected,
        notes: checkInNote.trim() || undefined,
      };

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar entrada');
      }

      showNotification('success', '¡Entrada registrada exitosamente! Jornada iniciada.');
      setTodayRecord(json.record);
      fetchTodayRecord();
      fetchHistory(filterFrom, filterTo, selectedEmployeeId);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar Salida
  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const payload = {
        action: 'check_out',
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        location_name: isOfficeDetected ? OFFICE_COORDS.name : coords ? `En Campo (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Ubicación sin GPS',
        is_office: isOfficeDetected,
      };

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar salida');
      }

      const totalH = json.record?.total_hours ? `${json.record.total_hours} horas` : '';
      showNotification('success', `¡Salida registrada con éxito! Total laborado: ${totalH}`);
      setTodayRecord(json.record);
      fetchTodayRecord();
      fetchHistory(filterFrom, filterTo, selectedEmployeeId);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar Salida a Campo / Obra intermedia
  const handleFieldTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldDestination.trim()) {
      showNotification('error', 'Por favor ingresa el destino u obra');
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        action: 'field_trip',
        destination: fieldDestination.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        notes: fieldNotes.trim() || undefined,
      };

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar salida a campo');
      }

      showNotification('success', `Salida a obra "${fieldDestination}" registrada en el historial`);
      setTodayRecord(json.record);
      setFieldDestination('');
      setFieldNotes('');
      setFieldModalOpen(false);
      fetchTodayRecord();
      fetchHistory(filterFrom, filterTo, selectedEmployeeId);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActionLoading(false);
    }
  };

  // Cambios de filtro de fechas
  const handleFilterChange = (mode: 'quincena' | 'mes' | 'custom') => {
    setFilterMode(mode);
    if (mode === 'quincena') {
      const q = getFortnightRange();
      setFilterFrom(q.from);
      setFilterTo(q.to);
    } else if (mode === 'mes') {
      const m = getMonthRange();
      setFilterFrom(m.from);
      setFilterTo(m.to);
    }
  };

  // Descarga de PDF (Personal o de Colaborador seleccionado)
  const handleDownloadPDF = () => {
    let targetName = session?.user?.name || 'Colaborador PROCIMEC';
    let targetRole = (session?.user as { role?: string })?.role || 'Personal Operativo';
    let targetEmail = session?.user?.email || '';

    if (adminViewMode === 'team') {
      if (selectedEmployeeId !== 'all') {
        const emp = activeUsersList.find((u) => u.id === selectedEmployeeId);
        if (emp) {
          targetName = emp.full_name;
          targetRole = emp.role || 'Localizador';
          targetEmail = emp.email;
        }
      } else {
        targetName = 'Reporte Consolidado del Equipo';
        targetRole = 'Equipo PROCIMEC';
        targetEmail = 'Todos los Colaboradores';
      }
    }

    const periodLabel =
      filterMode === 'quincena'
        ? getFortnightRange().label
        : filterMode === 'mes'
        ? 'Mes en Curso'
        : 'Periodo Personalizado';

    generateAttendancePDF(
      historyRecords,
      {
        full_name: targetName,
        email: targetEmail,
        role: targetRole,
      },
      periodLabel,
      filterFrom,
      filterTo
    );
  };

  // Métricas del equipo hoy (para vista Admin)
  const teamTodayMetrics = useMemo(() => {
    const presentInOffice = teamTodayRecords.filter((r) => r.check_in_time && r.check_in_is_office);
    const presentInField = teamTodayRecords.filter((r) => r.check_in_time && !r.check_in_is_office);
    const inFieldTrips = teamTodayRecords.filter((r) => r.field_trips && r.field_trips.length > 0);

    const checkedInUserIds = new Set(teamTodayRecords.map((r) => r.user_id));
    const pendingUsers = activeUsersList.filter((u) => !checkedInUserIds.has(u.id));

    return {
      presentInOffice,
      presentInField,
      inFieldTrips,
      pendingUsers,
      totalActive: activeUsersList.length,
      totalCheckedIn: checkedInUserIds.size,
    };
  }, [teamTodayRecords, activeUsersList]);

  // Cálculos estadísticos del historial filtrado
  const historyStats = useMemo(() => {
    const totalDays = historyRecords.length;
    const totalHours = historyRecords.reduce((acc, r) => acc + (r.total_hours || 0), 0);
    const officeDays = historyRecords.filter((r) => r.check_in_is_office).length;
    const fieldDays = totalDays - officeDays;
    const totalFieldTrips = historyRecords.reduce((acc, r) => acc + (r.field_trips?.length || 0), 0);
    return {
      totalDays,
      totalHours: totalHours.toFixed(1),
      officeDays,
      fieldDays,
      totalFieldTrips,
    };
  }, [historyRecords]);

  // Duración en vivo durante la jornada activa
  const elapsedWorkTime = useMemo(() => {
    if (!todayRecord?.check_in_time || todayRecord.check_out_time || !currentTime) return null;
    try {
      const inTime = new Date(todayRecord.check_in_time).getTime();
      const now = new Date().getTime();
      const diffMinutes = Math.max(0, Math.floor((now - inTime) / (1000 * 60)));
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      return `${h}h ${m}m`;
    } catch {
      return null;
    }
  }, [todayRecord, currentTime]);

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="bg-white border border-border rounded-2xl p-8 shadow-card">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ⏱️
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Herramienta no asignada</h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              No tienes acceso asignado al <strong>Control de Asistencia y Jornada</strong>. Para poder utilizarlo, un administrador debe marcar y habilitar esta herramienta en tu usuario desde la Gestión de Usuarios.
            </p>
            <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm font-semibold rounded-xl inline-flex items-center gap-2">
              ← Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white pt-8 pb-12 shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/admin/forms"
                  className="text-xs font-semibold text-blue-300 hover:text-white transition-colors"
                >
                  ← Herramientas y Formularios
                </Link>
                <span className="text-slate-500">•</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Control de Jornada Laboral
                </span>
                {isAdmin && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">
                    Vista Administrador
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>⏱️</span> Registro y Auditoría de Asistencia
              </h1>
              <p className="text-slate-300 text-sm mt-1 capitalize">{currentDateTitle}</p>
            </div>

            {/* Reloj Digital y Switch de Vista si es Admin */}
            <div className="flex flex-col sm:items-end gap-3">
              {/* Reloj */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-2xl font-bold tracking-wider text-white drop-shadow">
                  {currentTime || '--:--:--'}
                </span>
              </div>

              {/* Selector de modo para Administrador */}
              {isAdmin && (
                <div className="flex bg-white/15 p-1 rounded-2xl border border-white/20 backdrop-blur-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => setAdminViewMode('personal')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      adminViewMode === 'personal'
                        ? 'bg-white text-slate-900 shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>👤</span> Mi Asistencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminViewMode('team')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      adminViewMode === 'team'
                        ? 'bg-white text-slate-900 shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>👥</span> Panel de Equipo (Admin)
                  </button>
                </div>
              )}

              {/* Pill de Estado GPS */}
              <div className="flex items-center gap-1.5 text-xs">
                {geoLocating ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                    <span className="animate-spin text-xs">⚙️</span> Obteniendo GPS...
                  </span>
                ) : isOfficeDetected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 font-semibold">
                    <span>🏢</span> Oficina Principal ({distanceToOffice}m)
                  </span>
                ) : coords ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                    <span>📍</span> En Campo / Exterior (±{Math.round(coords.accuracy)}m)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-200 border border-red-400/30">
                    <span>⚠️</span> GPS no disponible
                  </span>
                )}
                <button
                  onClick={refreshLocation}
                  title="Actualizar posición GPS"
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 transition-colors"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 pb-20 space-y-8">
        {/* Banner de Notificación */}
        {notification && (
          <div
            className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-bold px-2 py-1 rounded-lg hover:bg-black/5"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ─── VISTA 1: TABLERO DE EQUIPO EN VIVO (MODO ADMINISTRADOR) ─── */}
        {isAdmin && adminViewMode === 'team' && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>👥</span> Monitoreo en Vivo de Asistencia de Hoy
                </h2>
                <p className="text-xs text-slate-500">
                  Estado en tiempo real de todo el personal: colaboradores en sede principal, en campo, en salidas a obra y pendientes.
                </p>
              </div>

              {/* Botón para registrar mi propia asistencia si soy admin */}
              <button
                type="button"
                onClick={() => setAdminViewMode('personal')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5"
              >
                <span>☀️</span> Marcar mi entrada / salida
              </button>
            </div>

            {/* Tarjetas de Estado del Día en Vivo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* En Oficina */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">🏢 En Oficina</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-950 mt-1">
                  {teamTodayMetrics.presentInOffice.length}
                </p>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {teamTodayMetrics.presentInOffice.length === 0 ? (
                    <span className="text-[11px] text-emerald-600/70 italic">Ninguno en sede</span>
                  ) : (
                    teamTodayMetrics.presentInOffice.map((rec) => (
                      <p key={rec.id} className="text-[11px] font-medium text-emerald-900 truncate">
                        • {rec.users?.full_name || 'Colaborador'} ({formatTimeOnly(rec.check_in_time)})
                      </p>
                    ))
                  )}
                </div>
              </div>

              {/* En Campo */}
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">📍 En Campo</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                </div>
                <p className="text-2xl font-extrabold text-sky-950 mt-1">
                  {teamTodayMetrics.presentInField.length}
                </p>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {teamTodayMetrics.presentInField.length === 0 ? (
                    <span className="text-[11px] text-sky-600/70 italic">Ninguno en campo</span>
                  ) : (
                    teamTodayMetrics.presentInField.map((rec) => (
                      <p key={rec.id} className="text-[11px] font-medium text-sky-900 truncate">
                        • {rec.users?.full_name || 'Colaborador'} ({formatTimeOnly(rec.check_in_time)})
                      </p>
                    ))
                  )}
                </div>
              </div>

              {/* En Obra / Comisión */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">🚧 En Obra / Visita</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <p className="text-2xl font-extrabold text-amber-950 mt-1">
                  {teamTodayMetrics.inFieldTrips.length}
                </p>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {teamTodayMetrics.inFieldTrips.length === 0 ? (
                    <span className="text-[11px] text-amber-600/70 italic">Sin salidas a obra hoy</span>
                  ) : (
                    teamTodayMetrics.inFieldTrips.map((rec) => {
                      const lastTrip = rec.field_trips[rec.field_trips.length - 1];
                      return (
                        <p key={rec.id} className="text-[11px] font-medium text-amber-900 truncate">
                          • {rec.users?.full_name || 'Colaborador'}: {lastTrip?.destination || 'Obra'}
                        </p>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sin Registrar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">⏳ Sin Registrar</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <p className="text-2xl font-extrabold text-slate-700 mt-1">
                  {teamTodayMetrics.pendingUsers.length}
                </p>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {teamTodayMetrics.pendingUsers.length === 0 ? (
                    <span className="text-[11px] text-emerald-600 font-semibold">¡Todos registraron entrada!</span>
                  ) : (
                    teamTodayMetrics.pendingUsers.map((u) => (
                      <p key={u.id} className="text-[11px] font-medium text-slate-500 truncate">
                        • {u.full_name}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── VISTA PERSONAL: 1-CLIC ENTRADA / SALIDA / SALIDA A CAMPO ─── */}
        {(!isAdmin || adminViewMode === 'personal') && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Mi Jornada de Hoy</h2>
                  <p className="text-xs text-slate-500">
                    Registra tu entrada en la mañana, tus desplazamientos a obra y la salida al finalizar el día.
                  </p>
                </div>

                {/* Badge de estado del día */}
                {loadingToday ? (
                  <div className="h-7 w-28 bg-slate-100 animate-pulse rounded-full" />
                ) : !todayRecord ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    Sin registro hoy
                  </span>
                ) : todayRecord.check_out_time ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <span>✅</span> Jornada Completa
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Jornada en Curso
                  </span>
                )}
              </div>

              {loadingToday ? (
                <div className="h-40 flex items-center justify-center text-slate-400">
                  <span className="animate-spin mr-2">⚙️</span> Verificando estado de asistencia...
                </div>
              ) : (
                <div>
                  {/* CASO A: Aún no ha marcado entrada */}
                  {!todayRecord && (
                    <div className="space-y-6">
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-600/30 mb-4">
                          ☀️
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">¡Buen día! Comienza tu turno laboral</h3>
                        <p className="text-sm text-slate-600 max-w-md mt-1 mb-6">
                          Al presionar el botón se registrará automáticamente la hora oficial y tu posición GPS actual.
                        </p>

                        <div className="w-full max-w-md mb-4 text-left">
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Observación inicial (opcional):
                          </label>
                          <input
                            type="text"
                            value={checkInNote}
                            onChange={(e) => setCheckInNote(e.target.value)}
                            placeholder="Ej: Inicio de actividades, revisión de planos en sede..."
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>

                        <button
                          onClick={handleCheckIn}
                          disabled={actionLoading}
                          className="w-full max-w-md py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-lg shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <>
                              <span className="animate-spin">⚙️</span> Guardando registro...
                            </>
                          ) : (
                            <>
                              <span>🟢</span> REGISTRAR ENTRADA
                            </>
                          )}
                        </button>

                        {/* Info de detección */}
                        <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
                          {isOfficeDetected ? (
                            <>
                              <span className="text-emerald-600 font-semibold">🏢 Detectado en Oficina Principal</span>
                              <span>(a {distanceToOffice}m de la sede)</span>
                            </>
                          ) : coords ? (
                            <>
                              <span className="text-sky-600 font-semibold">📍 Detectado en Campo / Fuera de Oficina</span>
                            </>
                          ) : (
                            <span className="text-amber-600">{geoError || 'Buscando GPS...'}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* CASO B: Entrada registrada, jornada activa */}
                  {todayRecord && !todayRecord.check_out_time && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
                            Hora de Entrada
                          </span>
                          <p className="text-xl font-bold text-slate-900 mt-1">
                            {formatTimeOnly(todayRecord.check_in_time)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {todayRecord.check_in_is_office ? '🏢 Oficina Principal' : '📍 En Campo / Fuera'}
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">
                            Tiempo Transcurrido
                          </span>
                          <p className="text-xl font-bold text-indigo-950 mt-1">
                            {elapsedWorkTime || 'Calculando...'}
                          </p>
                          <p className="text-xs text-indigo-600 mt-0.5">Jornada en desarrollo continuo</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
                            Salidas a Campo Hoy
                          </span>
                          <p className="text-xl font-bold text-amber-950 mt-1">
                            {todayRecord.field_trips?.length || 0} registrada(s)
                          </p>
                          <p className="text-xs text-amber-600 mt-0.5">Desplazamientos u obras</p>
                        </div>
                      </div>

                      {/* Botonera de Acciones de Jornada Activa */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Botón Salida a Campo / Obra */}
                        <button
                          onClick={() => setFieldModalOpen(true)}
                          disabled={actionLoading}
                          className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold text-base shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2.5"
                        >
                          <span className="text-xl">🚧</span>
                          <span>SALIDA A CAMPO / OBRA</span>
                        </button>

                        {/* Botón Salida Definitiva */}
                        <button
                          onClick={handleCheckOut}
                          disabled={actionLoading}
                          className="py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-base shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <>
                              <span className="animate-spin">⚙️</span> Cerrando jornada...
                            </>
                          ) : (
                            <>
                              <span className="text-xl">🔴</span>
                              <span>REGISTRAR SALIDA</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Lista de Salidas a Campo Registradas hoy */}
                      {todayRecord.field_trips && todayRecord.field_trips.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span>📍</span> Historial de desplazamientos de hoy:
                          </h4>
                          <div className="space-y-2">
                            {todayRecord.field_trips.map((trip: FieldTrip) => (
                              <div
                                key={trip.id}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900">{trip.destination}</span>
                                  {trip.notes && <span className="text-slate-500 ml-2">({trip.notes})</span>}
                                </div>
                                <span className="text-slate-500 font-mono flex-shrink-0">
                                  {formatTimeOnly(trip.time)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CASO C: Jornada finalizada con éxito */}
                  {todayRecord && todayRecord.check_out_time && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-2xl mx-auto flex items-center justify-center mb-3">
                        ✓
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">¡Jornada de hoy completada!</h3>
                      <p className="text-xs text-slate-500 mt-0.5 mb-4">
                        Has registrado tanto tu entrada como tu salida correctamente.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-semibold text-slate-400 block">Entrada</span>
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {formatTimeOnly(todayRecord.check_in_time)}
                          </span>
                          <p className="text-[11px] text-slate-500 truncate">
                            {todayRecord.check_in_is_office ? '🏢 Oficina' : '📍 Campo'}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-semibold text-slate-400 block">Salida</span>
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {formatTimeOnly(todayRecord.check_out_time)}
                          </span>
                          <p className="text-[11px] text-slate-500 truncate">
                            {todayRecord.check_out_is_office ? '🏢 Oficina' : '📍 Campo'}
                          </p>
                        </div>

                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                          <span className="text-[11px] font-semibold text-emerald-700 block">Total Horas</span>
                          <span className="text-sm font-bold text-emerald-900 font-mono">
                            {todayRecord.total_hours?.toFixed(1) ?? '--'} hrs
                          </span>
                          <p className="text-[11px] text-emerald-600">Registrado</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* MODAL PARA REGISTRO DE SALIDA A CAMPO / OBRA */}
        {fieldModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
                    🚧
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Salida a Campo / Obra</h3>
                </div>
                <button
                  onClick={() => setFieldModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Registra la salida intermedia hacia una obra, inspección o punto de levantamiento. Quedará guardado en tu historial con la hora y coordenadas actuales.
              </p>

              <form onSubmit={handleFieldTripSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destino, Proyecto u Obra <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldDestination}
                    onChange={(e) => setFieldDestination(e.target.value)}
                    placeholder="Ej: Obra Calle 100, Proyecto GPR Autopista, Inspección..."
                    className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notas o Motivo de la Comisión
                  </label>
                  <textarea
                    rows={2}
                    value={fieldNotes}
                    onChange={(e) => setFieldNotes(e.target.value)}
                    placeholder="Ej: Toma de radargramas de tuberías, verificación topográfica..."
                    className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>GPS de salida:</span>
                  <span className="font-mono text-slate-800">
                    {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Sin GPS'}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFieldModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {actionLoading ? 'Guardando...' : 'Confirmar Salida'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── HISTORIAL Y AUDITORÍA DE NOVEDADES (FILTROS Y PDF) ─── */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isAdmin && adminViewMode === 'team'
                  ? 'Historial y Auditoría de Novedades del Equipo'
                  : 'Mi Historial de Asistencia y Novedades'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAdmin && adminViewMode === 'team'
                  ? 'Consulta y audita las asistencias de cualquier colaborador y descarga los reportes para nómina.'
                  : 'Consulta tus días laborados, ubicaciones verificadas y exporta tu reporte para nómina.'}
              </p>
            </div>

            {/* Botón de Exportación PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={loadingHistory || historyRecords.length === 0}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>📄</span>
              <span>
                {isAdmin && adminViewMode === 'team' && selectedEmployeeId === 'all'
                  ? 'Descargar Reporte Consolidado (PDF)'
                  : 'Descargar Reporte en PDF'}
              </span>
            </button>
          </div>

          {/* Barra de Filtros: Selector de Colaborador (si es admin) + Periodo */}
          <div className="flex flex-col gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Selector de colaborador (solo modo admin) */}
              {isAdmin && adminViewMode === 'team' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    👤 Colaborador:
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="select text-xs py-1.5 px-3 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="all">👥 Todo el Equipo (Consolidado)</option>
                    {activeUsersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role || 'Usuario'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botones de Periodo */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleFilterChange('quincena')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterMode === 'quincena'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  📅 Última Quincena
                </button>
                <button
                  onClick={() => handleFilterChange('mes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterMode === 'mes'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  📆 Mes en Curso
                </button>
                <button
                  onClick={() => handleFilterChange('custom')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filterMode === 'custom'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  ⚙️ Personalizado
                </button>
              </div>

              {/* Inputs de fecha si es personalizado */}
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-500 font-medium">Desde:</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                />
                <label className="text-slate-500 font-medium">Hasta:</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Métricas KPI del periodo filtrado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase">Días / Registros</span>
              <span className="text-xl font-bold text-slate-900">{historyStats.totalDays}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
              <span className="text-[11px] font-semibold text-indigo-600 block uppercase">Horas Laboradas</span>
              <span className="text-xl font-bold text-indigo-900">{historyStats.totalHours} h</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-600 block uppercase">En Oficina</span>
              <span className="text-xl font-bold text-emerald-900">{historyStats.officeDays} días</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-semibold text-amber-700 block uppercase">En Campo / Obras</span>
              <span className="text-xl font-bold text-amber-900">{historyStats.fieldDays} días</span>
            </div>
          </div>

          {/* Tabla de Registros */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  {isAdmin && adminViewMode === 'team' && (
                    <th className="py-3 px-4">Colaborador</th>
                  )}
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Salida</th>
                  <th className="py-3 px-4">Desplazamientos a Campo</th>
                  <th className="py-3 px-4 text-right">Horas</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={isAdmin && adminViewMode === 'team' ? 7 : 6} className="py-8 text-center text-slate-400">
                      <span className="animate-spin mr-2">⚙️</span> Cargando historial...
                    </td>
                  </tr>
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin && adminViewMode === 'team' ? 7 : 6} className="py-8 text-center text-slate-400">
                      No hay registros de asistencia para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((rec) => {
                    const hasFieldTrips = rec.field_trips && rec.field_trips.length > 0;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Colaborador si es vista admin de equipo */}
                        {isAdmin && adminViewMode === 'team' && (
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary flex items-center justify-center text-[11px] font-bold">
                                {(rec.users?.full_name || 'U').charAt(0)}
                              </span>
                              <span>{rec.users?.full_name || 'Usuario'}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 pl-8">{rec.users?.email || ''}</p>
                          </td>
                        )}

                        <td className="py-3 px-4 font-medium text-slate-900">
                          {formatDateSpanish(rec.date)}
                        </td>

                        {/* Entrada */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-800">
                            {formatTimeOnly(rec.check_in_time)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {rec.check_in_is_office ? (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                                🏢 Oficina
                              </span>
                            ) : (
                              <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                📍 Campo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Salida */}
                        <td className="py-3 px-4">
                          {rec.check_out_time ? (
                            <>
                              <div className="font-mono font-semibold text-slate-800">
                                {formatTimeOnly(rec.check_out_time)}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {rec.check_out_is_office ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                                    🏢 Oficina
                                  </span>
                                ) : (
                                  <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                    📍 Campo
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">En curso...</span>
                          )}
                        </td>

                        {/* Desplazamientos a Campo */}
                        <td className="py-3 px-4">
                          {hasFieldTrips ? (
                            <div className="space-y-1">
                              {rec.field_trips.map((ft: FieldTrip) => (
                                <div key={ft.id} className="text-[11px] text-slate-600 flex items-center gap-1">
                                  <span className="font-semibold text-amber-700">🚧 {ft.destination}</span>
                                  <span className="text-slate-400 font-mono">({formatTimeOnly(ft.time)})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Horas */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {rec.total_hours !== null ? `${rec.total_hours.toFixed(1)} h` : '—'}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4 text-center">
                          {rec.status === 'completed' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completo
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              En Curso
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AttendanceTrackerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Cargando control de asistencia...</div>}>
      <AttendanceTrackerContent />
    </Suspense>
  );
}
