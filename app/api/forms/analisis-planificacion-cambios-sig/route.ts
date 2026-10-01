import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión para continuar.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      project_id,
      identifier_name,
      identifier_position,
      identifier_process,
      identification_date,
      change_description,
      justification,
      affected_processes,
      origins,
      origins_other,
      work_team,
      risks,
      activities,
      approval_name,
      approval_position,
      approval_process,
      approval_signature,
      tracking_name,
      tracking_position,
      tracking_process,
      tracking_signature,
      control_risks_controlled,
      change_effective,
      effectiveness_notes_no,
    } = body;

    // Validaciones mínimas obligatorias
    if (!identifier_name || !identifier_position || !identifier_process) {
      return NextResponse.json(
        { error: 'Debe ingresar el nombre, cargo y proceso de la persona que identifica el cambio.' },
        { status: 400 }
      );
    }

    if (!change_description || !justification || !affected_processes) {
      return NextResponse.json(
        { error: 'Debe especificar la descripción del cambio, justificación y procesos afectados.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const insertPayload = {
      user_id: session.user.id,
      project_id: project_id || null,
      official_code: 'FOR-SIG-001',
      version: '1',
      cloud_drive_file_id: '1wTRLk90fdyMPoDywI0hLYC3O4-ekDlyq',
      status: 'submitted',
      identifier_name: String(identifier_name).trim(),
      identifier_position: String(identifier_position).trim(),
      identifier_process: String(identifier_process).trim(),
      identification_date: identification_date || new Date().toISOString().split('T')[0],
      change_description: String(change_description).trim(),
      justification: String(justification).trim(),
      affected_processes: String(affected_processes).trim(),
      origins: Array.isArray(origins) ? origins : [],
      origins_other: origins_other ? String(origins_other).trim() : null,
      work_team: Array.isArray(work_team) ? work_team : [],
      risks: Array.isArray(risks) ? risks : [],
      activities: Array.isArray(activities) ? activities : [],
      approval_name: approval_name ? String(approval_name).trim() : null,
      approval_position: approval_position ? String(approval_position).trim() : null,
      approval_process: approval_process ? String(approval_process).trim() : null,
      approval_signature: approval_signature ? String(approval_signature).trim() : null,
      tracking_name: tracking_name ? String(tracking_name).trim() : null,
      tracking_position: tracking_position ? String(tracking_position).trim() : null,
      tracking_process: tracking_process ? String(tracking_process).trim() : null,
      tracking_signature: tracking_signature ? String(tracking_signature).trim() : null,
      control_risks_controlled: typeof control_risks_controlled === 'boolean' ? control_risks_controlled : null,
      change_effective: typeof change_effective === 'boolean' ? change_effective : null,
      effectiveness_notes_no: effectiveness_notes_no ? String(effectiveness_notes_no).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sig_management_changes')
      .insert(insertPayload)
      .select('id, created_at, status')
      .single();

    if (error) {
      console.error('Error insertando cambio SIG en Supabase:', error);
      return NextResponse.json({ error: `Error en base de datos: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: 'Registro de Análisis y Planificación del Cambio guardado exitosamente.',
    });
  } catch (err: unknown) {
    console.error('Error procesando formulario SIG:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const supabase = createAdminClient();

    if (id) {
      const { data, error } = await supabase
        .from('sig_management_changes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ data });
    }

    // Listado de los últimos registros
    const { data, error } = await supabase
      .from('sig_management_changes')
      .select('id, official_code, identifier_name, change_description, identification_date, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
