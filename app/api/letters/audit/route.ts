import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const letterType = searchParams.get('letterType') || 'all';
    const userId = searchParams.get('userId') || 'all';
    const projectId = searchParams.get('projectId') || 'all';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const supabase = createAdminClient();

    // Si se consulta una carta individual
    if (id) {
      const { data: singleLetter, error: singleErr } = await supabase
        .from('hr_letters')
        .select(`
          id, project_id, user_id, created_at, status, letter_type, letter_title,
          radicado, employee_name, employee_document, recipient_name, recipient_entity,
          rendered_text, letter_data, docx_base64, pdf_base64, docx_url, pdf_url,
          email_recipient, email_sent, email_sent_at,
          users:user_id (id, email, full_name, nick_name, avatar_url),
          projects:project_id (id, name, code)
        `)
        .eq('id', id)
        .single();

      if (singleErr) {
        return NextResponse.json({ error: singleErr.message }, { status: 404 });
      }

      return NextResponse.json({ data: singleLetter });
    }

    // Consulta general con filtros (omitiendo base64 pesado para rendimiento rápido)
    let query = supabase
      .from('hr_letters')
      .select(`
        id, project_id, user_id, created_at, status, letter_type, letter_title,
        radicado, employee_name, employee_document, recipient_name, recipient_entity,
        rendered_text, letter_data, docx_url, pdf_url,
        email_recipient, email_sent, email_sent_at,
        users:user_id (id, email, full_name, nick_name, avatar_url),
        projects:project_id (id, name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (letterType !== 'all') {
      query = query.eq('letter_type', letterType);
    }

    if (userId !== 'all') {
      query = query.eq('user_id', userId);
    }

    if (projectId !== 'all') {
      query = query.eq('project_id', projectId);
    }

    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00Z`);
    }

    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59Z`);
    }

    const { data, error } = await query;

    if (error) {
      // Si la tabla no está creada aún en la base de datos
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        return NextResponse.json({
          data: [],
          migrationNeeded: true,
          message: 'La tabla hr_letters aún no existe en Supabase. Ejecute la migración 023_create_hr_letters.sql en Supabase SQL Editor.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let results = (data ?? []).map((item) => {
      const userObj = Array.isArray(item.users) ? item.users[0] : item.users;
      const projObj = Array.isArray(item.projects) ? item.projects[0] : item.projects;
      return {
        ...item,
        users: userObj || null,
        projects: projObj || null,
      };
    });

    // Filtro de texto libre en memoria para búsqueda inmediata
    if (search) {
      results = results.filter((item) => {
        const rad = (item.radicado || '').toLowerCase();
        const emp = (item.employee_name || '').toLowerCase();
        const doc = (item.employee_document || '').toLowerCase();
        const rec = (item.recipient_name || '').toLowerCase();
        const ent = (item.recipient_entity || '').toLowerCase();
        const user = (item.users?.full_name || item.users?.email || '').toLowerCase();
        const proj = (item.projects?.name || item.projects?.code || '').toLowerCase();
        return (
          rad.includes(search) ||
          emp.includes(search) ||
          doc.includes(search) ||
          rec.includes(search) ||
          ent.includes(search) ||
          user.includes(search) ||
          proj.includes(search)
        );
      });
    }

    return NextResponse.json({ data: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
