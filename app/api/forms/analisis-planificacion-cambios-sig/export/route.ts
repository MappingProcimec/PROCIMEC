import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import {
  fetchSigTemplateBuffer,
  fillSigChangeExcel,
  generateSigChangePdf,
  SigChangeData,
} from '@/lib/sig-templates';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    if (!id) {
      return NextResponse.json({ error: 'Falta el identificador del registro (id)' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: record, error } = await supabase
      .from('sig_management_changes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !record) {
      return NextResponse.json({ error: 'Registro de cambio no encontrado en la base de datos' }, { status: 404 });
    }

    const changeData: SigChangeData = {
      id: record.id,
      official_code: record.official_code || 'FOR-SIG-001',
      version: record.version || '1',
      identifier_name: record.identifier_name || '',
      identifier_position: record.identifier_position || '',
      identifier_process: record.identifier_process || '',
      identification_date: record.identification_date || '',
      change_description: record.change_description || '',
      justification: record.justification || '',
      affected_processes: record.affected_processes || '',
      required_elements: Array.isArray(record.required_elements)
        ? record.required_elements
        : (record.required_elements ? [record.required_elements] : []),
      origins: Array.isArray(record.origins) ? record.origins : [],
      origins_other: record.origins_other || '',
      work_team: Array.isArray(record.work_team) ? record.work_team : [],
      risks: Array.isArray(record.risks) ? record.risks : [],
      activities: Array.isArray(record.activities) ? record.activities : [],
      approval_name: record.approval_name || '',
      approval_position: record.approval_position || '',
      approval_process: record.approval_process || '',
      approval_signature: record.approval_signature || '',
      tracking_name: record.tracking_name || '',
      tracking_position: record.tracking_position || '',
      tracking_process: record.tracking_process || '',
      tracking_signature: record.tracking_signature || '',
      control_risks_controlled: record.control_risks_controlled,
      change_effective: record.change_effective,
      effectiveness_notes_no: record.effectiveness_notes_no || '',
    };

    const cleanDate = (record.identification_date || '2026-10-01').replace(/[^0-9\-]/g, '');
    const cleanPerson = (record.identifier_name || 'SIG').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);

    if (format === 'pdf') {
      const pdfBuffer = await generateSigChangePdf(changeData);
      const filename = `FOR-SIG-001_Analisis_Cambio_${cleanPerson}_${cleanDate}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Por defecto exporta en Excel (.xlsx) utilizando la plantilla viva descargada desde Google Drive
    const templateBuffer = await fetchSigTemplateBuffer(record.cloud_drive_file_id || undefined);
    const filledExcel = await fillSigChangeExcel(templateBuffer, changeData);
    const filename = `FOR-SIG-001_Analisis_Cambio_${cleanPerson}_${cleanDate}.xlsx`;

    return new NextResponse(new Uint8Array(filledExcel), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('Error generando archivo de exportación SIG:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno al generar archivo de exportación' },
      { status: 500 }
    );
  }
}
