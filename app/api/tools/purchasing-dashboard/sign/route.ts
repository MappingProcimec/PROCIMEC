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
    const { request_id, step, action, cedula, notes, items: updatedItemsInput } = body;

    if (!request_id || !step || !action) {
      return NextResponse.json({ error: 'Datos incompletos para firmar la solicitud' }, { status: 400 });
    }

    if (action === 'approve' && !cedula) {
      return NextResponse.json({ error: 'La cédula es obligatoria para estampar la firma electrónica' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener usuario de sesión y validar rol
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
    const isAdmin = userRole === 'admin' || session.user.role === 'admin';

    // 2. Validar permiso según el paso
    if (step === 'purchasing' && !isAdmin && userRole !== 'purchasing' && userRole !== 'compras') {
      return NextResponse.json({ error: 'Solo el personal de Compras puede firmar esta fase' }, { status: 403 });
    }

    if (step === 'management' && !isAdmin && userRole !== 'management' && userRole !== 'gerencia') {
      return NextResponse.json({ error: 'Solo Gerencia puede emitir la aprobación final' }, { status: 403 });
    }

    // 3. Obtener el requerimiento actual
    const { data: requestRow, error: fetchErr } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (fetchErr || !requestRow) {
      return NextResponse.json({ error: 'Requerimiento no encontrado' }, { status: 404 });
    }

    // Extraer firmas previas (con tolerancia a metadatos)
    let signatures: Record<string, unknown> = {};
    if (requestRow.signatures && typeof requestRow.signatures === 'object') {
      signatures = { ...requestRow.signatures };
    } else if (
      requestRow.items &&
      typeof requestRow.items === 'object' &&
      !Array.isArray(requestRow.items)
    ) {
      const metaObj = (requestRow.items as Record<string, any>)._metadata;
      if (metaObj && metaObj.signatures) {
        signatures = { ...metaObj.signatures };
      }
    }

    // Extraer lista de ítems
    let currentItems: Array<Record<string, unknown>> = [];
    let metadata: Record<string, unknown> = {};

    if (Array.isArray(requestRow.items)) {
      currentItems = [...requestRow.items];
    } else if (requestRow.items && typeof requestRow.items === 'object') {
      const obj = requestRow.items as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        currentItems = [...obj.items];
        metadata = (obj._metadata as Record<string, unknown>) || {};
      }
    }

    const nowFormatted = formatDateTimeCO(new Date());

    let newStatus = requestRow.status;

    // Manejo de Rechazo
    if (action === 'reject') {
      newStatus = 'rejected';
      const rejectionEntry = {
        name: dbUser.full_name || session.user.name || 'Revisor',
        cedula: String(cedula || '').trim(),
        date_time: nowFormatted,
        role_label: step === 'director' ? 'Director de Proyecto' : step === 'management' ? 'Gerencia' : 'Compras',
        user_id: dbUser.id,
        notes: notes ? String(notes).trim() : 'Rechazado en revisión',
        rejected: true,
      };

      signatures[step] = rejectionEntry;
    } else {
      // Manejo de Aprobación / Firma
      let roleLabel = 'Revisor';
      if (step === 'director') {
        roleLabel = 'Director de Proyecto / VB Técnico';
        newStatus = 'in_quotation'; // Pasa formalmente a cotización
      } else if (step === 'purchasing') {
        roleLabel = 'Área de Compras y Suministros';
        // Si compras actualizó precios de ítems
        if (Array.isArray(updatedItemsInput) && updatedItemsInput.length > 0) {
          const priceMap = new Map(updatedItemsInput.map((it: any) => [it.item_no, it]));
          currentItems = currentItems.map((it) => {
            const update: any = priceMap.get(Number(it.item_no));
            if (update) {
              const qty = Number(it.quantity) || 1;
              const unitPrice = update.unit_price !== undefined ? Number(update.unit_price) : Number(it.unit_price) || 0;
              return {
                ...it,
                unit_price: unitPrice,
                total: qty * unitPrice,
                suggested_supplier: update.suggested_supplier || it.suggested_supplier,
                brand: update.brand || it.brand,
                client_quote_no: update.client_quote_no || it.client_quote_no,
              };
            }
            return it;
          });
        }
        newStatus = 'in_quotation';
      } else if (step === 'management') {
        roleLabel = 'Gerencia General / Aprobación Final';
        newStatus = 'approved'; // Aprobada para emisión de orden
      }

      signatures[step] = {
        name: dbUser.full_name || session.user.name || 'Aprobador',
        cedula: String(cedula).trim(),
        date_time: nowFormatted,
        role_label: roleLabel,
        user_id: dbUser.id,
        notes: notes ? String(notes).trim() : undefined,
      };
    }

    // Asegurar que viewed_by registre la vista de esta instancia que acaba de firmar
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

    const signerName = dbUser.full_name || session.user.name || 'Aprobador';
    const signerEmail = dbUser.email || '';
    const instanceViewIdx = currentViews.findIndex((v) => v.instance === step);

    if (instanceViewIdx >= 0) {
      currentViews[instanceViewIdx] = {
        ...currentViews[instanceViewIdx],
        user_name: signerName,
        viewed_at: nowFormatted,
      };
    } else {
      currentViews.push({
        user_id: dbUser.id,
        user_name: signerName,
        user_email: signerEmail,
        instance: step,
        role_label: step === 'director' ? (requestRow.approver_name ? `Aprobador: ${requestRow.approver_name}` : 'Aprobación de Proyecto') : step === 'purchasing' ? 'Área de Compras' : 'Gerencia General (Punto 4)',
        viewed_at: nowFormatted,
        view_count: 1,
      });
    }

    // Recalcular monto total
    const totalAmount = currentItems.reduce((acc: number, it: Record<string, unknown>) => {
      const q = Number(it.quantity) || 1;
      const p = Number(it.unit_price) || 0;
      const t = it.total !== undefined ? Number(it.total) : q * p;
      return acc + t;
    }, 0);

    // 4. Guardar en Base de Datos
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      viewed_by: currentViews,
    };

    // Intentar actualización completa
    try {
      const { error: updateErr } = await supabase
        .from('purchase_requests')
        .update({
          ...updatePayload,
          signatures,
          items: currentItems,
          total_amount: totalAmount,
        })
        .eq('id', request_id);

      if (updateErr) {
        console.warn('Error en update de purchase_requests con columnas, intentando fallback de metadatos:', updateErr);
        // Fallback a items._metadata
        const fallbackItems = {
          items: currentItems,
          _metadata: {
            ...metadata,
            signatures,
            total_amount: totalAmount,
          },
        };

        await supabase
          .from('purchase_requests')
          .update({
            status: newStatus,
            items: fallbackItems,
          })
          .eq('id', request_id);
      }
    } catch (e) {
      console.error('Error actualizando firmas de purchase_request:', e);
      return NextResponse.json({ error: 'Error guardando firma en base de datos' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      signatures,
      total_amount: totalAmount,
      items: currentItems,
      message: action === 'approve' ? 'Firma electrónica registrada exitosamente' : 'Solicitud rechazada',
    });
  } catch (error) {
    console.error('Error en POST /api/tools/purchasing-dashboard/sign:', error);
    return NextResponse.json({ error: 'Error procesando firma' }, { status: 500 });
  }
}
