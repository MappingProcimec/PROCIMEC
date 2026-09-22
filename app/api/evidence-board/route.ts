/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getOptimalResponses } from '@/lib/hseq-definitions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Expresiones regulares y diccionarios constantes (pre-compilados O(1))
const DRONE_REGEX = /024|drone/i;
const ESTACION_REGEX = /025|estaci[oó]n/i;
const NON_OBS_SET = new Set(['ninguna', 'ninguno', 'ningun', 'sin observaciones', 'n/a', 'na', '']);

function normalizeDivision(rawName?: string | null): 'Mapping' | 'Ingeniería' {
  if (!rawName) return 'Mapping';
  const norm = rawName.trim().toLowerCase();
  if (norm.includes('mapping')) {
    return 'Mapping';
  }
  if (
    norm.startsWith('ing') ||
    norm.includes('ingenier') ||
    norm.includes('topo') ||
    norm.includes('geof') ||
    norm.includes('cad') ||
    norm.includes('bim')
  ) {
    return 'Ingeniería';
  }
  return 'Mapping';
}

interface InspectionRow {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
  status: string;
  cost_center?: string | null;
  location?: string | null;
  inspection_date?: string | null;
  equipment_name?: string | null;
  equipment_brand_model?: string | null;
  equipment_serial?: string | null;
  items_responses?: Record<string, unknown> | null;
  critical_point?: string | null;
  general_observations?: string | null;
  operator_name?: string | null;
  operator_signature_data?: string | null;
  ssta_name?: string | null;
  ssta_signature_data?: string | null;
  drive_file_id?: string | null;
  drive_web_view_link?: string | null;
  pdf_filename?: string | null;
  projects?: { id?: string; name?: string; cost_center?: string; client?: string } | null;
  users?: {
    id?: string;
    full_name?: string;
    email?: string;
    role?: string;
    division_id?: string | null;
    divisions?: { name?: string } | null;
    user_division_roles?: { division_id: string; divisions?: { name?: string } | null }[] | null;
  } | null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const fetchAllParam = searchParams.get('all') === 'true';

  // Límite predeterminado seguro para evitar transferencias no acotadas
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 500) : 200;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('hseq_inspections')
      .select('*, projects(id, name, cost_center, client), users(id, full_name, email, role, division_id, divisions!users_division_id_fkey(name), user_division_roles(division_id, divisions(name)))')
      .order('created_at', { ascending: false });

    if (!fetchAllParam) {
      query = query.range(offset, offset + limit - 1);
    }

    let { data: rows, error } = await query;

    // Fallback retrocompatible a hseq_drone_inspections si aún no se ha ejecutado la migración 017
    if (error && (error.code === 'PGRST205' || error.message?.includes('not find the table'))) {
      let fallbackQuery = supabase
        .from('hseq_drone_inspections')
        .select('*, projects(id, name, cost_center, client), users(id, full_name, email, division_id, divisions!users_division_id_fkey(name), user_division_roles(division_id, divisions(name)))')
        .order('created_at', { ascending: false });

      if (!fetchAllParam) {
        fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);
      }

      const fbRes = await fallbackQuery;
      rows = fbRes.data;
      error = fbRes.error;
    }

    if (error) {
      console.error('Error consultando hseq_inspections para tablero:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedRows = (rows || []) as unknown as InspectionRow[];

    const evidences = typedRows.map((row) => {
      const rawResponses = (row.items_responses || {}) as Record<string, unknown>;
      const meta = (rawResponses._meta || {}) as Record<string, unknown>;
      const responses: Record<string, string> = {};

      for (const [key, value] of Object.entries(rawResponses)) {
        if (key !== '_meta' && typeof value === 'string') {
          responses[key] = value;
        }
      }

      const candidateString = [
        row.pdf_filename,
        (row as any).format_code,
        (row as any).format_title,
        (row as any).equipment_name,
        meta.format_code,
        meta.format_title,
        meta.equipment_name,
        row.equipment_brand_model,
        (row as any).drone_brand_model,
      ].filter(Boolean).join(' ');

      const isDrone = DRONE_REGEX.test(candidateString);
      const isEstacion = ESTACION_REGEX.test(candidateString);

      const formatCode =
        (typeof (row as any).format_code === 'string' && (row as any).format_code) ||
        (typeof meta.format_code === 'string' && meta.format_code) ||
        (isEstacion ? 'FOR-HSEQ-025' : isDrone ? 'FOR-HSEQ-024' : 'FOR-HSEQ');

      const formatTitle = (
        (typeof (row as any).format_title === 'string' && (row as any).format_title) ||
        (typeof meta.format_title === 'string' && meta.format_title) ||
        (isEstacion ? 'INSPECCIÓN PRE-OPERACIONAL DE ESTACIÓN TOTAL' : isDrone ? 'INSPECCIÓN PRE-OPERACIONAL DE DRONE' : 'INSPECCIÓN PRE-OPERACIONAL')
      ).toUpperCase().trim();

      // Evaluar condición de seguridad y variaciones
      const criticalText = (row.critical_point || '').trim();
      const hasCritical =
        Boolean(criticalText) &&
        criticalText.toLowerCase() !== 'ninguno' &&
        criticalText.toLowerCase() !== 'ninguna' &&
        criticalText !== '';

      const obsText = (row.general_observations || '').trim().toLowerCase();
      const hasCustomObservations =
        Boolean(row.general_observations) && !NON_OBS_SET.has(obsText);

      // Usar ítems no conformes pre-calculados del formato o evaluar con mapa óptimo
      const storedNonCompliant =
        Array.isArray((row as any).non_compliant_items)
          ? (row as any).non_compliant_items
          : Array.isArray(meta.non_compliant_items)
          ? meta.non_compliant_items
          : null;

      const optimalMap = getOptimalResponses(formatCode);

      let nonCompliantCodes: string[] = [];

      if (storedNonCompliant) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nonCompliantCodes = storedNonCompliant.map((it: any) => (typeof it === 'string' ? it : it.code || ''));
      } else {
        nonCompliantCodes = Object.entries(responses)
          .filter(([code, val]) => {
            const expected = optimalMap[code];
            if (!expected || expected === 'NA') return false;
            return val.toUpperCase() !== expected;
          })
          .map(([code]) => code);
      }

      const hasAnomalies =
        (row as any).has_anomalies !== undefined && (row as any).has_anomalies !== null
          ? Boolean((row as any).has_anomalies)
          : meta.has_anomalies !== undefined
          ? Boolean(meta.has_anomalies)
          : nonCompliantCodes.length > 0 || hasCritical || hasCustomObservations;

      // La división DEBE reflejar la división oficial a la que pertenece la persona que diligenció el formulario
      const userUdrDivision = row.users?.user_division_roles?.[0]?.divisions?.name;
      const userDirectDivision = row.users?.divisions?.name;
      const rowSavedDivision = (typeof (row as any).division_name === 'string' && (row as any).division_name) || null;
      const metaDivision = (typeof meta.division === 'string' && meta.division) || null;

      const rawDivision = userUdrDivision || userDirectDivision || rowSavedDivision || metaDivision || 'Mapping';
      const divisionName = normalizeDivision(rawDivision);

      const rawRole =
        (typeof (row as any).operator_role === 'string' && (row as any).operator_role) ||
        (typeof meta.operator_role === 'string' && meta.operator_role) ||
        (typeof meta.user_role === 'string' && meta.user_role) ||
        row.users?.role ||
        'Operador';

      const operatorRole =
        rawRole === 'admin'
          ? 'Administrador'
          : rawRole === 'localizador'
          ? 'Localizador'
          : rawRole === 'operator'
          ? 'Operador'
          : rawRole === 'dibujo'
          ? 'Dibujo'
          : String(rawRole);

      let dateStr = row.inspection_date || '';
      let timeStr = '';
      if (row.created_at) {
        try {
          const d = new Date(row.created_at);
          if (!dateStr) {
            dateStr = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Bogota',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(d);
          }
          timeStr = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(d);
        } catch {
          timeStr = '';
        }
      }

      const equipmentNameStr =
        (typeof (row as any).equipment_name === 'string' && (row as any).equipment_name) ||
        (typeof meta.equipment_name === 'string' && meta.equipment_name) ||
        (isDrone ? 'Drone' : isEstacion ? 'Estación Total' : 'Equipo');

      const brandModelStr =
        row.equipment_brand_model ||
        (typeof meta.equipment_brand_model === 'string' && meta.equipment_brand_model) ||
        (typeof (row as any).drone_brand_model === 'string' && (row as any).drone_brand_model) ||
        'Estándar';

      const serialStr =
        row.equipment_serial ||
        (typeof meta.equipment_serial === 'string' && meta.equipment_serial) ||
        (typeof (row as any).drone_serial === 'string' && (row as any).drone_serial) ||
        '';

      const pdfUrlStr = (typeof meta.pdf_url === 'string' && meta.pdf_url) || row.drive_web_view_link || '';
      const excelUrlStr = (typeof meta.excel_url === 'string' && meta.excel_url) || '';
      const excelFileStr = (typeof meta.excel_filename === 'string' && meta.excel_filename) || row.pdf_filename?.replace(/\.pdf$/i, '.xlsx') || `Inspeccion_${formatCode}.xlsx`;

      return {
        id: row.id,
        formatCode,
        formatTitle,
        code: formatCode,
        formatName: formatTitle,
        projectId: row.project_id,
        projectName: row.projects?.name || 'Proyecto General',
        projectCode: row.projects?.cost_center || row.cost_center || 'CC-PROY',
        costCenter: row.cost_center || row.projects?.cost_center || '',
        location: row.location || '',
        equipmentName: equipmentNameStr,
        equipmentBrandModel: brandModelStr,
        equipment: `${equipmentNameStr} - ${brandModelStr}`,
        serial: serialStr,
        locatorName: row.operator_name || row.users?.full_name || 'Responsable',
        operatorRole,
        sstaName: row.ssta_name || 'Responsable/SSTA',
        date: dateStr,
        time: timeStr,
        fileName: row.pdf_filename || `Inspeccion_${formatCode}.pdf`,
        excelFileName: excelFileStr,
        fileSize: '320 KB',
        status: hasAnomalies ? 'alerta' : 'conforme',
        hasAnomalies,
        hasCritical,
        criticalPoint: criticalText || 'Ninguno',
        hasObservations: hasCustomObservations,
        generalObservations: row.general_observations || 'Ninguna',
        divisionName,
        pdfUrl: pdfUrlStr,
        excelUrl: excelUrlStr,
        driveLink: row.drive_web_view_link || pdfUrlStr,
        itemsResponses: responses,
        optimalMap,
        nonCompliantCodes,
        nonCompliantCount: nonCompliantCodes.length,
        operatorSignatureData: row.operator_signature_data || null,
        sstaSignatureData: row.ssta_signature_data || null,
        vehicleData: meta.vehicle_data || (row as any).vehicle_data || null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        evidences,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error en API evidence-board:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
