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
    const full_name = body.full_name !== undefined ? (body.full_name ?? '').trim() : undefined;
    const nick_name = body.nick_name !== undefined ? (body.nick_name ?? '').trim() : undefined;

    if (full_name === undefined && nick_name === undefined) {
      return NextResponse.json({ error: 'Debes proporcionar un nombre o apodo válido' }, { status: 400 });
    }

    if (full_name !== undefined && !full_name) {
      return NextResponse.json({ error: 'El nombre completo no puede estar vacío' }, { status: 400 });
    }

    if (nick_name !== undefined && !nick_name) {
      return NextResponse.json({ error: 'El apodo no puede estar vacío' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const updates: Record<string, string> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (nick_name !== undefined) updates.nick_name = nick_name;

    const performUpdate = async (fields: Record<string, string>) => {
      // 1. Intentar actualizar por ID de usuario si existe
      if (userId) {
        const { data, error } = await supabase
          .from('users')
          .update(fields)
          .eq('id', userId)
          .select('id');

        if (!error && data && data.length > 0) return { ok: true };
        if (error && (error.code === '42703' || error.message?.includes('nick_name'))) {
          return { missingColumn: true, error: error.message };
        }
      }

      // 2. Intentar actualizar por Email (búsqueda insensible a mayúsculas/minúsculas)
      if (userEmail) {
        const { data, error } = await supabase
          .from('users')
          .update(fields)
          .ilike('email', userEmail)
          .select('id');

        if (!error && data && data.length > 0) return { ok: true };
        if (error && (error.code === '42703' || error.message?.includes('nick_name'))) {
          return { missingColumn: true, error: error.message };
        }
      }

      // 3. Fallback: buscar por email en minúsculas exactas
      if (userEmail) {
        const { data, error } = await supabase
          .from('users')
          .update(fields)
          .eq('email', userEmail.toLowerCase())
          .select('id');

        if (!error && data && data.length > 0) return { ok: true };
        if (error && (error.code === '42703' || error.message?.includes('nick_name'))) {
          return { missingColumn: true, error: error.message };
        }
      }

      return { ok: false };
    };

    let result = await performUpdate(updates);
    let warning: string | undefined = undefined;

    // Si la columna nick_name aún no se ha creado en la base de datos de Supabase
    if (result.missingColumn) {
      const fallbackFields: Record<string, string> = {};
      if (full_name !== undefined) {
        fallbackFields.full_name = full_name;
      } else if (nick_name !== undefined) {
        fallbackFields.full_name = nick_name;
      }
      result = await performUpdate(fallbackFields);
      warning = 'Para guardar el apodo en su columna independiente ejecuta en Supabase SQL Editor: ALTER TABLE users ADD COLUMN IF NOT EXISTS nick_name TEXT;';
    }

    if (!result.ok) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      full_name,
      nick_name,
      warning,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al actualizar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
