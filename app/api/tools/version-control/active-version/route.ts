import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || searchParams.get('code') || searchParams.get('slug') || '').trim();

    if (!query) {
      return NextResponse.json({ error: 'Falta parámetro de consulta (query, code o slug)' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Buscar en la tabla document_format_versions
    // Buscar primero por código exacto, o por form_slug
    let { data: format, error } = await supabase
      .from('document_format_versions')
      .select('id, code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description, download_template_url')
      .eq('status', 'active')
      .or(`code.ilike.${query},form_slug.eq.${query}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error consultando versión activa en document_format_versions:', error.message);
    }

    // 2. Si no se encontró por coincidencia directa, intentar búsqueda parcial
    if (!format) {
      const { data: fallbackMatch } = await supabase
        .from('document_format_versions')
        .select('id, code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description, download_template_url')
        .eq('status', 'active')
        .ilike('code', `%${query}%`)
        .limit(1)
        .maybeSingle();

      format = fallbackMatch;
    }

    if (format) {
      return NextResponse.json({
        ok: true,
        data: format,
        source: 'database',
      });
    }

    // 3. Fallback controlado si aún no se ha creado o no existe en BD
    return NextResponse.json({
      ok: true,
      data: {
        code: query.startsWith('FOR-') ? query : `FOR-${query.toUpperCase()}`,
        current_version: '1',
        effective_date: new Date().toISOString().split('T')[0],
        status: 'active',
        name: query,
        form_slug: query.startsWith('FOR-') ? null : query,
      },
      source: 'fallback',
    });
  } catch (err: unknown) {
    console.error('Error en GET /api/tools/version-control/active-version:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno al consultar versión activa' },
      { status: 500 }
    );
  }
}
