import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_EMAILS = [
  'mapping.procimec2024@gmail.com',
  'marcelobarrazasantiago@gmail.com',
];

function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  const envAdmin = process.env.GOOGLE_DRIVE_ADMIN_EMAIL;
  if (envAdmin && email.toLowerCase() === envAdmin.toLowerCase()) return true;
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());
}

async function getUserInfo(token: { userId?: string; email?: string | null; role?: string }) {
  let role = token.role;
  let userId = token.userId;

  if (token.email) {
    if (isKnownAdmin(token.email)) {
      role = 'admin';
    }

    const { data } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', token.email)
      .maybeSingle();

    if (data) {
      if (!isKnownAdmin(token.email)) {
        role = data.role;
      }
      if (data.id && UUID_REGEX.test(data.id)) {
        userId = data.id;
      }
    }
  }

  return { role, userId };
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { role, userId } = await getUserInfo(token);

  if (role !== 'dibujo' && role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 400 });
  }

  const body = await req.json();

  const payload = {
    project_name: body.project_name,
    activity_date: body.activity_date,
    responsible: body.responsible || token.email || token.name || '',
    software: body.software,
    hours_worked: body.hours_worked ?? 9,
    is_rework: body.is_rework ?? false,
    elaboration_stage: body.elaboration_stage || null,
    other_software_name: body.other_software_name || null,
    rework_observations: body.rework_observations || null,
    user_id: userId,
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

  const { role, userId } = await getUserInfo(token);

  if (role !== 'dibujo' && role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const email = token.email as string | undefined;

  let query = supabase
    .from('drawing_activities')
    .select('*')
    .order('activity_date', { ascending: false })
    .range(0, 49999);

  if (role === 'dibujo') {
    if (userId && email) {
      query = query.or(`user_id.eq.${userId},responsible.ilike.${email}`);
      // Vincular en segundo plano los registros importados sin user_id que le pertenecen a este correo
      supabase
        .from('drawing_activities')
        .update({ user_id: userId })
        .is('user_id', null)
        .ilike('responsible', email)
        .then(({ error: syncErr }) => {
          if (syncErr) console.error('Error auto-syncing drawing user_id:', syncErr);
        });
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (email) {
      query = query.ilike('responsible', email);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
