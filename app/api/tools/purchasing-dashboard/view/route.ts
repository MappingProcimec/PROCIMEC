import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

function formatDateTimeCO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota',
  }).format(d);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'ID de solicitud requerido' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener usuario de sesión
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('email', session.user.email)
      .maybeSingle();

    const dbUser = userByEmail || {
      id: session.user.id || '',
      full_name: session.user.name || '',
      email: session.user.email,
      role: session.user.role || 'operator',
    };

    const userRole = (dbUser.role || '').toLowerCase();

    // 2. Obtener requerimiento actual con datos de aprobador, solicitante y firmas
    const { data: requestRow, error: reqErr } = await supabase
      .from('purchase_requests')
      .select('id, items, viewed_by, user_id, applicant_name, approver_name, approver_user_id, signatures, status')
      .eq('id', request_id)
      .maybeSingle();

    if (reqErr || !requestRow) {
      return NextResponse.json({ error: 'Requerimiento no encontrado' }, { status: 404 });
    }

    // 3. Excluir al autor / solicitante: No debe registrarse como revisor en "Visto por"
    const isAuthor =
      requestRow.user_id === dbUser.id ||
      (requestRow.applicant_name &&
        dbUser.full_name &&
        requestRow.applicant_name.trim().toLowerCase() === dbUser.full_name.trim().toLowerCase());

    const currentRawViews = Array.isArray(requestRow.viewed_by)
      ? [...requestRow.viewed_by]
      : requestRow.items && typeof requestRow.items === 'object' && !Array.isArray(requestRow.items) && Array.isArray((requestRow.items as Record<string, any>)._metadata?.viewed_by)
      ? [...(requestRow.items as Record<string, any>)._metadata.viewed_by]
      : [];

    const isDesignatedApprover =
      (requestRow.approver_name && dbUser.full_name && requestRow.approver_name.trim().toLowerCase() === dbUser.full_name.trim().toLowerCase()) ||
      (requestRow.approver_user_id && requestRow.approver_user_id === dbUser.id);

    const hasDirectorView = currentRawViews.some((v) => v.instance === 'director');

    // Si es el autor, solo registrar vista si fue expresamente asignado como Aprobador del proyecto y aún no está registrada
    if (isAuthor && (!isDesignatedApprover || hasDirectorView)) {
      return NextResponse.json({ success: true, isAuthor: true, viewed_by: currentRawViews });
    }

    // 4. Determinar instancia revisora según rol y etapa secuencial del requerimiento
    const sigs = (requestRow.signatures || {}) as Record<string, any>;
    const hasDirectorSig = Boolean(sigs.director?.name);
    const hasPurchasingSig = Boolean(sigs.purchasing?.name);

    let instance: 'director' | 'purchasing' | 'management' = 'director';
    let roleLabel = requestRow.approver_name
      ? `Aprobador: ${requestRow.approver_name}`
      : 'Aprobación de Proyecto';

    if (userRole === 'purchasing' || userRole === 'compras') {
      instance = 'purchasing';
      roleLabel = 'Área de Compras';
    } else if (userRole === 'management' || userRole === 'gerencia') {
      instance = 'management';
      roleLabel = 'Gerencia General (Punto 4)';
    } else if (userRole === 'admin') {
      // Para administradores: respetar el orden del flujo
      if (!hasDirectorSig || isDesignatedApprover) {
        instance = 'director';
        roleLabel = requestRow.approver_name ? `Aprobador: ${requestRow.approver_name}` : 'Aprobación de Proyecto';
      } else if (!hasPurchasingSig) {
        instance = 'purchasing';
        roleLabel = 'Área de Compras (Admin)';
      } else {
        instance = 'management';
        roleLabel = 'Gerencia General (Punto 4)';
      }
    } else {
      // Usuario de campo / proyecto
      instance = 'director';
      roleLabel = requestRow.approver_name ? `Aprobador: ${requestRow.approver_name}` : 'Aprobación de Proyecto';
    }

    // 4. Procesar lista de visualizaciones (resiliente a JSONB y metadatos)
    let currentViews: Array<{
      user_id: string;
      user_name: string;
      user_email: string;
      instance: string;
      role_label: string;
      viewed_at: string;
      view_count?: number;
    }> = [];

    if (Array.isArray(requestRow.viewed_by)) {
      currentViews = [...requestRow.viewed_by];
    } else if (
      requestRow.items &&
      typeof requestRow.items === 'object' &&
      !Array.isArray(requestRow.items)
    ) {
      const metaObj = (requestRow.items as Record<string, any>)._metadata;
      if (metaObj && Array.isArray(metaObj.viewed_by)) {
        currentViews = [...metaObj.viewed_by];
      }
    }

    const nowFormatted = formatDateTimeCO(new Date());

    const existingIndex = currentViews.findIndex(
      (v) => v.user_id === dbUser.id || (v.instance === instance && v.user_name === dbUser.full_name)
    );

    if (existingIndex >= 0) {
      currentViews[existingIndex] = {
        ...currentViews[existingIndex],
        user_name: dbUser.full_name || currentViews[existingIndex].user_name,
        viewed_at: nowFormatted,
        view_count: (currentViews[existingIndex].view_count || 1) + 1,
      };
    } else {
      currentViews.push({
        user_id: dbUser.id,
        user_name: dbUser.full_name || session.user.name || 'Usuario',
        user_email: dbUser.email || '',
        instance,
        role_label: roleLabel,
        viewed_at: nowFormatted,
        view_count: 1,
      });
    }

    // 5. Guardar en Base de Datos (con tolerancia de esquema)
    try {
      const { error: updateColErr } = await supabase
        .from('purchase_requests')
        .update({ viewed_by: currentViews })
        .eq('id', request_id);

      if (updateColErr) {
        // Fallback a items._metadata
        let updatedItemsObj: Record<string, unknown> = {};
        if (Array.isArray(requestRow.items)) {
          updatedItemsObj = {
            items: requestRow.items,
            _metadata: { viewed_by: currentViews },
          };
        } else if (requestRow.items && typeof requestRow.items === 'object') {
          const raw = requestRow.items as Record<string, unknown>;
          const meta = (raw._metadata as Record<string, unknown>) || {};
          updatedItemsObj = {
            ...raw,
            _metadata: { ...meta, viewed_by: currentViews },
          };
        }

        await supabase
          .from('purchase_requests')
          .update({ items: updatedItemsObj })
          .eq('id', request_id);
      }
    } catch (saveErr) {
      console.warn('Error guardando viewed_by:', saveErr);
    }

    return NextResponse.json({
      success: true,
      viewed_by: currentViews,
      recordedInstance: instance,
      user_name: dbUser.full_name,
      viewed_at: nowFormatted,
    });
  } catch (error) {
    console.error('Error en POST /api/tools/purchasing-dashboard/view:', error);
    return NextResponse.json({ error: 'Error registrando visualización' }, { status: 500 });
  }
}
