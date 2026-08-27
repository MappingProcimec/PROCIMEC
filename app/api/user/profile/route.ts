import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.trim();
    const userId = session?.user?.id;

    if (!userEmail && !userId) {
      return NextResponse.json({ error: 'No autorizado - Sesión no encontrada' }, { status: 401 });
    }

    const body = await req.json();
    const full_name = (body.full_name ?? '').trim();
    if (!full_name) {
      return NextResponse.json({ error: 'El nombre completo es requerido' }, { status: 400 });
    }

    const supabase = createAdminClient();
    let updated = false;

    // 1. Intentar actualizar por ID de usuario si existe
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .update({ full_name })
        .eq('id', userId)
        .select('id');

      if (!error && data && data.length > 0) {
        updated = true;
      }
    }

    // 2. Intentar actualizar por Email (búsqueda insensible a mayúsculas/minúsculas)
    if (!updated && userEmail) {
      const { data, error } = await supabase
        .from('users')
        .update({ full_name })
        .ilike('email', userEmail)
        .select('id');

      if (!error && data && data.length > 0) {
        updated = true;
      }
    }

    // 3. Fallback: buscar por email en minúsculas exactas
    if (!updated && userEmail) {
      const { data, error } = await supabase
        .from('users')
        .update({ full_name })
        .eq('email', userEmail.toLowerCase())
        .select('id');

      if (!error && data && data.length > 0) {
        updated = true;
      }
    }

    if (!updated) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
    }

    return NextResponse.json({ success: true, full_name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al actualizar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
