import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

interface InspectionRow {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
  status: string;
  cost_center?: string | null;
  location?: string | null;
  inspection_date?: string | null;
  drone_brand_model?: string | null;
  drone_serial?: string | null;
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
  users?: { id?: string; full_name?: string; email?: string; division_id?: string | null; divisions?: { name?: string } | null } | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: rows, error } = await supabase
      .from('hseq_drone_inspections')
      .select('*, projects(id, name, cost_center, client), users(id, full_name, email, division_id, divisions!users_division_id_fkey(name))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error consultando hseq_drone_inspections para tablero:', error);
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

      // Evaluar condición de seguridad y anomalías ("cuando algo no marcha bien")
      const criticalText = (row.critical_point || '').trim();
      const hasCritical =
        Boolean(criticalText) &&
        criticalText.toLowerCase() !== 'ninguno' &&
        criticalText.toLowerCase() !== 'ninguna' &&
        criticalText !== '';

      const nonCompliantList = Object.entries(responses)
        .filter(([, val]) => val.toUpperCase() === 'NO')
        .map(([code]) => code);

      const hasAnomalies = Boolean(meta.has_anomalies) || nonCompliantList.length > 0 || hasCritical;

      const divisionName = (typeof meta.division === 'string' && meta.division) || row.users?.divisions?.name || 'Mapping / Drones';
      const isEstacion = /025|estaci[oó]n/i.test(`${row.pdf_filename || ''} ${String(meta.format_code || '')}`);
      const formatCode = (typeof meta.format_code === 'string' && meta.format_code) || (isEstacion ? 'FOR-HSEQ-025' : 'FOR-HSEQ-030');
      const formatTitle = (typeof meta.format_title === 'string' && meta.format_title) || (isEstacion ? 'Inspección Pre-operacional Estación Total' : 'Inspección Pre-operacional Drone');

      const dateStr = row.inspection_date || row.created_at?.split('T')[0] || '';
      let timeStr = '';
      if (row.created_at) {
        try {
          timeStr = new Date(row.created_at).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          timeStr = '';
        }
      }

      const equipmentStr = row.drone_brand_model || (typeof meta.equipment_brand_model === 'string' && meta.equipment_brand_model) || 'Equipo General';
      const serialStr = row.drone_serial || (typeof meta.equipment_serial === 'string' && meta.equipment_serial) || 'S/N';
      const pdfUrlStr = (typeof meta.pdf_url === 'string' && meta.pdf_url) || row.drive_web_view_link || '';
      const excelUrlStr = (typeof meta.excel_url === 'string' && meta.excel_url) || '';
      const excelFileStr = (typeof meta.excel_filename === 'string' && meta.excel_filename) || row.pdf_filename?.replace(/\.pdf$/i, '.xlsx') || `Inspeccion_${formatCode}.xlsx`;

      return {
        id: row.id,
        code: formatCode,
        formatName: formatTitle,
        projectName: row.projects?.name || 'Proyecto General',
        projectCode: row.projects?.cost_center || row.cost_center || 'CC-PROY',
        costCenter: row.cost_center || row.projects?.cost_center || '',
        location: row.location || '',
        equipment: equipmentStr,
        serial: serialStr,
        locatorName: row.operator_name || row.users?.full_name || 'Localizador / Operador',
        sstaName: row.ssta_name || 'Responsable SSTA',
        date: dateStr,
        time: timeStr,
        fileName: row.pdf_filename || `Inspeccion_${formatCode}.pdf`,
        excelFileName: excelFileStr,
        fileSize: '320 KB',
        status: hasAnomalies ? 'alerta' : 'conforme',
        hasAnomalies,
        hasCritical,
        criticalPoint: criticalText || 'Ninguno',
        generalObservations: row.general_observations || '',
        divisionName,
        pdfUrl: pdfUrlStr,
        excelUrl: excelUrlStr,
        driveLink: row.drive_web_view_link || pdfUrlStr,
        itemsResponses: responses,
        nonCompliantCodes: nonCompliantList,
        nonCompliantCount: nonCompliantList.length,
        operatorSignatureData: row.operator_signature_data || null,
        sstaSignatureData: row.ssta_signature_data || null,
      };
    });

    return NextResponse.json({
      ok: true,
      evidences,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error en API evidence-board:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
