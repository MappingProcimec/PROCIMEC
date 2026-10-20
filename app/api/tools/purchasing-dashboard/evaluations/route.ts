import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  const { ctx, errorResponse } = await requireAuth({
    roles: ['admin', 'purchasing', 'compras', 'management', 'gerencia'],
    tool: 'purchasing-dashboard',
    req,
  });
  if (errorResponse) return errorResponse;

  const supabase = ctx!.supabase;
  const dbUser = ctx!.dbUser;

  try {
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
