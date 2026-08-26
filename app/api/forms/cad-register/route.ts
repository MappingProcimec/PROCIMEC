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

  const supabase = createAdminClient();

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
