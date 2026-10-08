import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createPurchaseOrderPdf } from '@/lib/purchasing/purchaseOrderPdfGenerator';
import { sendPurchaseOrderEmail } from '@/lib/purchasing/purchaseOrderMailer';

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

export interface PurchaseOrderItemPayload {
  item_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  delivery_date?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      request_id,
      supplier_name,
      supplier_nit,
      supplier_contact,
      supplier_email,
      supplier_id,
      items,
      total_amount,
      delivery_deadline,
      delivery_site,
      payment_terms,
      notes,
      send_email_to_supplier,
    } = body as {
      request_id: string;
      supplier_name: string;
      supplier_nit?: string;
      supplier_contact?: string;
      supplier_email?: string;
      supplier_id?: string;
      items: PurchaseOrderItemPayload[];
      total_amount: number;
      delivery_deadline?: string;
      delivery_site?: string;
      payment_terms?: string;
      notes?: string;
      send_email_to_supplier?: boolean;
    };

    if (!request_id?.trim()) {
      return NextResponse.json({ error: 'El ID de la solicitud es obligatorio.' }, { status: 400 });
    }
    if (!supplier_name?.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio.' }, { status: 400 });
    }

    // Obtener usuario autenticado
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
    }

    // Obtener solicitud y proyecto
    const { data: request, error: reqErr } = await supabase
      .from('purchase_requests')
      .select('id, request_code, project_id, delivery_site, cost_center, projects(id, name, cost_center, client)')
      .eq('id', request_id)
      .single();

    if (reqErr || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
    }

    // Calcular consecutivo de orden de compra (ej: OC-2026-001)
    const currentYear = new Date().getFullYear();
    const { data: existingOrders } = await supabase
      .from('purchase_orders')
      .select('order_code')
      .ilike('order_code', `OC-${currentYear}-%`);

    let maxNum = 0;
    if (existingOrders && existingOrders.length > 0) {
      for (const ord of existingOrders) {
        const parts = String(ord.order_code).split('-');
        if (parts.length >= 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    const nextCode = `OC-${currentYear}-${String(maxNum + 1).padStart(3, '0')}`;

    const timestampStr = formatDateTimeCO();
    let trackingNote = `Orden de compra formalizada y emitida por ${dbUser.full_name || dbUser.email} para ${supplier_name}.`;

    // Envío por correo electrónico si se seleccionó la casilla
    let emailResult: { ok: boolean; message?: string } | null = null;
    if (send_email_to_supplier && supplier_email && supplier_email.includes('@')) {
      try {
        const projData = request.projects as { id?: string; name?: string; cost_center?: string; client?: string } | null;
        const pdfDoc = createPurchaseOrderPdf({
          orderCode: nextCode,
          requestCode: request.request_code,
          code: 'FOR-COM-002',
          version: '01',
          effectiveDate: '08/10/2026',
          createdDate: timestampStr,
          supplierName: String(supplier_name).trim(),
          supplierNit: supplier_nit,
          supplierContact: supplier_contact,
          supplierEmail: supplier_email,
          projectName: projData?.name || request.cost_center || 'Operación General',
          costCenter: projData?.cost_center || request.cost_center,
          clientName: projData?.client,
          buyerName: dbUser.full_name || dbUser.email,
          deliveryDeadline: delivery_deadline,
          deliverySite: delivery_site || request.delivery_site,
          paymentTerms: payment_terms || 'Contado',
          notes: notes,
          items: (items || []).map((it) => ({
            item_no: it.item_no,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            total: it.total,
            delivery_date: it.delivery_date,
          })),
          totalAmount: Number(total_amount) || 0,
        });

        const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

        emailResult = await sendPurchaseOrderEmail({
          supplierEmail: supplier_email.trim(),
          supplierName: String(supplier_name).trim(),
          orderCode: nextCode,
          projectName: projData?.name || request.cost_center || 'Operación General',
          costCenter: projData?.cost_center || request.cost_center,
          totalAmount: Number(total_amount) || 0,
          deliveryDeadline: delivery_deadline,
          deliverySite: delivery_site || request.delivery_site,
          paymentTerms: payment_terms || 'Contado',
          items: items || [],
          notes: notes,
          buyerName: dbUser.full_name || dbUser.email,
          buyerEmail: dbUser.email,
          pdfBuffer,
        });

        if (emailResult.ok) {
          trackingNote += ` Enviada por correo al proveedor: ${supplier_email.trim()}.`;
        }
      } catch (mailErr) {
        console.error('Error generando PDF o enviando correo de orden de compra:', mailErr);
      }
    }

    const initialTracking = [
      {
        status: 'issued',
        timestamp: new Date().toISOString(),
        formatted_date: timestampStr,
        user_name: dbUser.full_name || dbUser.email,
        note: trackingNote,
      },
    ];

    // Intentar inserción completa con columnas extendidas
    const payloadToInsert: Record<string, unknown> = {
      purchase_request_id: request.id,
      project_id: request.project_id || null,
      user_id: dbUser.id,
      order_code: nextCode,
      supplier_name: String(supplier_name).trim(),
      supplier_nit: supplier_nit ? String(supplier_nit).trim() : null,
      supplier_contact: supplier_contact ? String(supplier_contact).trim() : null,
      total_amount: Number(total_amount) || 0,
      currency: 'COP',
      delivery_deadline: delivery_deadline || null,
      payment_terms: payment_terms ? String(payment_terms).trim() : 'Contado',
      notes: notes ? String(notes).trim() : null,
      status: 'issued',
    };

    if (supplier_id) payloadToInsert.supplier_id = supplier_id;
    if (delivery_site) payloadToInsert.delivery_site = delivery_site;
    if (items) payloadToInsert.items_detail = items;
    payloadToInsert.tracking_history = initialTracking;

    let insertedOrder;
    const { data: insData, error: insErr } = await supabase
      .from('purchase_orders')
      .insert(payloadToInsert)
      .select(`
        *,
        projects(id, name, cost_center, client),
        users(id, full_name, email)
      `)
      .single();

    if (insErr) {
      // Fallback si la migración de columnas extendidas aún no ha sido corrida por el usuario
      console.warn('Fallo inserción extendida en purchase_orders, reintentando con columnas estándar:', insErr.message);
      delete payloadToInsert.supplier_id;
      delete payloadToInsert.items_detail;
      delete payloadToInsert.delivery_site;
      delete payloadToInsert.tracking_history;

      const { data: fbData, error: fbErr } = await supabase
        .from('purchase_orders')
        .insert(payloadToInsert)
        .select(`
          *,
          projects(id, name, cost_center, client),
          users(id, full_name, email)
        `)
        .single();

      if (fbErr) throw fbErr;
      insertedOrder = fbData;
    } else {
      insertedOrder = insData;
    }

    const emailNotice = emailResult?.ok
      ? ` y enviada formalmente al correo del proveedor (${supplier_email?.trim()})`
      : emailResult?.message
      ? ` (${emailResult.message})`
      : '';

    return NextResponse.json({
      success: true,
      message: `Orden de compra ${nextCode} emitida exitosamente${emailNotice}.`,
      order: insertedOrder,
      email_sent: Boolean(emailResult?.ok),
    });
  } catch (err: unknown) {
    console.error('Error al emitir orden de compra:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al emitir orden de compra.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { order_id, new_status, note } = body as {
      order_id: string;
      new_status: 'issued' | 'confirmed' | 'in_transit' | 'partially_received' | 'completed' | 'cancelled';
      note?: string;
    };

    if (!order_id?.trim() || !new_status) {
      return NextResponse.json({ error: 'ID de la orden y nuevo estado son obligatorios.' }, { status: 400 });
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const { data: order, error: ordErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (ordErr || !order) {
      return NextResponse.json({ error: 'Orden de compra no encontrada.' }, { status: 404 });
    }

    const currentTracking = Array.isArray(order.tracking_history) ? order.tracking_history : [];
    const timestampStr = formatDateTimeCO();

    const statusLabels: Record<string, string> = {
      issued: 'Emitida formalmente',
      confirmed: 'Confirmada por proveedor',
      in_transit: 'En tránsito / despacho',
      partially_received: 'Entrega parcial recibida',
      completed: 'Entregada y recibida a satisfacción',
      cancelled: 'Orden anulada',
    };

    const newEvent = {
      status: new_status,
      timestamp: new Date().toISOString(),
      formatted_date: timestampStr,
      user_name: dbUser.full_name || dbUser.email,
      note: note?.trim() || `Estado actualizado a "${statusLabels[new_status] || new_status}"`,
    };

    const updatedTracking = [...currentTracking, newEvent];

    // Intentar actualizar con tracking_history
    const { data: updated, error: updErr } = await supabase
      .from('purchase_orders')
      .update({
        status: new_status,
        tracking_history: updatedTracking,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)
      .select(`
        *,
        projects(id, name, cost_center, client),
        users(id, full_name, email)
      `)
      .single();

    if (updErr) {
      console.warn('Error al actualizar tracking_history, actualizando solo status:', updErr.message);
      const { data: fbUpdated, error: fbUpdErr } = await supabase
        .from('purchase_orders')
        .update({
          status: new_status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select(`
          *,
          projects(id, name, cost_center, client),
          users(id, full_name, email)
        `)
        .single();

      if (fbUpdErr) throw fbUpdErr;
      return NextResponse.json({
        success: true,
        message: 'Estado de la orden actualizado.',
        order: fbUpdated,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Seguimiento de orden actualizado correctamente.',
      order: updated,
    });
  } catch (err: unknown) {
    console.error('Error al actualizar seguimiento de orden:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al actualizar seguimiento.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
