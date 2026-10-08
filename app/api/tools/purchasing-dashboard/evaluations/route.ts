import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Obtener usuario autenticado en la base de datos
    let dbUser: { id: string; full_name?: string | null; email: string; role: string } | null = null;
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .ilike('email', session.user.email.trim())
      .maybeSingle();

    if (userByEmail) {
      dbUser = userByEmail;
    } else if (session.user.id) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (userById) dbUser = userById;
    }

    if (!dbUser) {
      dbUser = {
        id: session.user.id || '',
        full_name: session.user.name || '',
        email: session.user.email,
        role: session.user.role || 'operator',
      };
    }

    const body = await req.json();
    const {
      purchase_order_id,
      supplier_name,
      quality_score,
      delivery_time_score,
      service_score,
      recommend_supplier,
      comments,
    } = body;

    if (!supplier_name?.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 });
    }

    const q = Math.max(1, Math.min(5, Math.round(Number(quality_score) || 5)));
    const d = Math.max(1, Math.min(5, Math.round(Number(delivery_time_score) || 5)));
    const s = Math.max(1, Math.min(5, Math.round(Number(service_score) || 5)));
    const rating = Number(((q + d + s) / 3).toFixed(2));

    const { data: newEval, error: insertError } = await supabase
      .from('supplier_evaluations')
      .insert({
        purchase_order_id: purchase_order_id || null,
        user_id: dbUser.id,
        supplier_name: String(supplier_name).trim(),
        quality_score: q,
        delivery_time_score: d,
        service_score: s,
        overall_rating: rating,
        recommend_supplier: recommend_supplier !== false,
        comments: comments ? String(comments).trim() : null,
      })
      .select(`
        id,
        purchase_order_id,
        user_id,
        supplier_name,
        quality_score,
        delivery_time_score,
        service_score,
        overall_rating,
        comments,
        recommend_supplier,
        created_at,
        users(id, full_name, email)
      `)
      .single();

    if (insertError) {
      console.error('Error insertando evaluación de proveedor:', insertError);
      return NextResponse.json({ error: insertError.message || 'Error al guardar la evaluación' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      evaluation: newEval,
      message: 'Evaluación de desempeño registrada exitosamente.',
    });
  } catch (err: unknown) {
    console.error('Error procesando evaluación de proveedor:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al procesar evaluación';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
