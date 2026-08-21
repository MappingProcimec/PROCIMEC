import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || (token.role !== 'dibujo' && token.role !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();

  // Limpieza de campos opcionales que no aplican
  const payload = {
    project_name: body.project_name,
    activity_date: body.activity_date,
    responsible: body.responsible,
    software: body.software,
    hours_worked: body.hours_worked ?? 9,
    is_rework: body.is_rework ?? false,
    elaboration_stage: body.elaboration_stage || null,
    other_software_name: body.other_software_name || null,
    rework_observations: body.rework_observations || null,
    user_id: token.sub,
  };

  const { error } = await supabase.from('drawing_activities').insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (token.role !== 'dibujo' && token.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  let query = supabase
    .from('drawing_activities')
    .select('*')
    .order('activity_date', { ascending: false });

  if (token.role === 'dibujo') {
    query = query.eq('user_id', token.sub);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
