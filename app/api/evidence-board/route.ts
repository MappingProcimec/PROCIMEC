import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
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

    const evidences = (rows || []).map((row: any) => {
      const meta = row.items_responses?._meta || {};
      const responses: Record<string, string> = { ...(row.items_responses || {}) };
      delete responses._meta;

      // Evaluar condición de seguridad y anomalías ("cuando algo no marcha bien")
      const criticalText = (row.critical_point || '').trim();
      const hasCritical =
        Boolean(criticalText) &&
        criticalText.toLowerCase() !== 'ninguno' &&
        criticalText.toLowerCase() !== 'ninguna' &&
        criticalText !== '';

      const nonCompliantList = Object.entries(responses)
        .filter(([_, val]) => String(val).toUpperCase() === 'NO')
        .map(([code]) => code);

      const hasAnomalies = Boolean(meta.has_anomalies) || nonCompliantList.length > 0 || hasCritical;

      const divisionName = meta.division || row.users?.divisions?.name || 'Mapping / Drones';
      const isEstacion = /025|estaci[oó]n/i.test(`${row.pdf_filename || ''} ${meta.format_code || ''}`);
      const formatCode = meta.format_code || (isEstacion ? 'FOR-HSEQ-025' : 'FOR-HSEQ-030');
      const formatTitle = meta.format_title || (isEstacion ? 'Inspección Pre-operacional Estación Total' : 'Inspección Pre-operacional Drone');

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

      return {
        id: row.id,
        code: formatCode,
        formatName: formatTitle,
        projectName: row.projects?.name || 'Proyecto General',
        projectCode: row.projects?.cost_center || row.cost_center || 'CC-PROY',
        costCenter: row.cost_center || row.projects?.cost_center || '',
        location: row.location || '',
        equipment: row.drone_brand_model || meta.equipment_brand_model || 'Equipo General',
        serial: row.drone_serial || meta.equipment_serial || 'S/N',
        locatorName: row.operator_name || row.users?.full_name || 'Localizador / Operador',
        sstaName: row.ssta_name || 'Responsable SSTA',
        date: dateStr,
        time: timeStr,
        fileName: row.pdf_filename || `Inspeccion_${formatCode}.pdf`,
        excelFileName: meta.excel_filename || row.pdf_filename?.replace(/\.pdf$/i, '.xlsx') || `Inspeccion_${formatCode}.xlsx`,
        fileSize: '320 KB',
        status: hasAnomalies ? 'alerta' : 'conforme',
        hasAnomalies,
        hasCritical,
        criticalPoint: criticalText || 'Ninguno',
        generalObservations: row.general_observations || '',
        divisionName,
        pdfUrl: meta.pdf_url || row.drive_web_view_link || '',
        excelUrl: meta.excel_url || '',
        driveLink: row.drive_web_view_link || meta.pdf_url || '',
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
