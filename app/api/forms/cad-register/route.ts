import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

type SoftwareEntry = { selected: boolean; hours: string; customName?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json() as {
    project_id?: string;
    date?: string;
    software?: Record<string, SoftwareEntry>;
    phase?: string;
    had_rework?: boolean;
    rework_notes?: string;
    notes?: string;
  };

  const { project_id, date, software, phase, had_rework, rework_notes, notes } = body;

  if (!project_id || !date || !phase) {
    return NextResponse.json({ error: 'Faltan campos obligatorios (proyecto, fecha, fase)' }, { status: 400 });
  }

  if (!software || !Object.values(software).some((e) => e.selected)) {
    return NextResponse.json({ error: 'Debes seleccionar al menos un software' }, { status: 400 });
  }

  const missingHours = Object.values(software).find((e) => e.selected && !e.hours);
  if (missingHours) {
    return NextResponse.json({ error: 'Ingresa las horas para cada software seleccionado' }, { status: 400 });
  }

  if (had_rework && !rework_notes?.trim()) {
    return NextResponse.json({ error: 'Las observaciones de reproceso son obligatorias' }, { status: 400 });
  }

  const userRole = session.user.role;
  const sessionUserId = session.user.id;

  if (userRole === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Validar rol de dibujo / admin o asignación del formulario en user_forms
  let hasAccess = userRole === 'admin' || userRole === 'dibujo' || userRole === 'drawing';
  if (!hasAccess && sessionUserId) {
    try {
      const { data: uf } = await supabase
        .from('user_forms')
        .select('forms!inner(slug)')
        .eq('user_id', sessionUserId)
        .eq('forms.slug', 'cad-register-form')
        .maybeSingle();

      if (uf) hasAccess = true;
    } catch {
      // Ignorar si falla
    }
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'No tienes permisos para registrar actividades CAD/BIM.' }, { status: 403 });
  }

  // Verificación anti-IDOR: verificar que el usuario esté asignado al proyecto si no es admin
  if (userRole !== 'admin') {
    const { data: assignment } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('user_id', sessionUserId)
      .eq('project_id', project_id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json(
        { error: 'No tienes permisos para registrar actividades en este proyecto no asignado.' },
        { status: 403 }
      );
    }
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('cad_activities')
    .insert({
      project_id,
      user_id: user.id,
      date,
      software,
      phase,
      had_rework: had_rework ?? false,
      rework_notes: had_rework ? (rework_notes ?? null) : null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
