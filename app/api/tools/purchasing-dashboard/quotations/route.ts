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

export interface QuotationOptionInput {
  option_no: number;
  source?: 'solicitud' | 'presupuesto' | 'mercado' | string;
  supplier: string;
  brand?: string;
  unit_price: number;
  total?: number;
  delivery_days?: number | string;
  notes?: string;
  is_selected?: boolean;
}

export interface ItemQuotationPayload {
  item_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  total?: number;
  selected_quotation_index?: number;
  quotations?: QuotationOptionInput[];
  change_reason?: string;
  budget_rubro?: string;
  budget_item_id?: string;
  client_quote_no?: string;
  brand?: string;
  suggested_supplier?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { request_id, items: updatedItemsInput, change_reason } = body as {
      request_id: string;
      items: ItemQuotationPayload[];
      change_reason?: string;
    };

    if (!request_id || !Array.isArray(updatedItemsInput) || updatedItemsInput.length === 0) {
      return NextResponse.json(
        { error: 'Datos incompletos: se requiere el identificador de la solicitud e ítems.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Obtener usuario autenticado
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
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'management' ||
      userRole === 'gerencia' ||
      session.user.role === 'admin' ||
      session.user.role === 'management';

    const isPurchasingOrAuthorized =
      isAdmin ||
      userRole === 'purchasing' ||
      userRole === 'compras' ||
      userRole === 'director';

    if (!isPurchasingOrAuthorized) {
      return NextResponse.json(
        { error: 'No tienes permisos habilitados para registrar o actualizar cotizaciones en compras.' },
        { status: 403 }
      );
    }

    // 2. Consultar la solicitud actual
    const { data: currentReq, error: reqErr } = await supabase
      .from('purchase_requests')
      .select('id, items, total_amount, status, request_code')
      .eq('id', request_id)
      .maybeSingle();

    if (reqErr || !currentReq) {
      return NextResponse.json({ error: 'Solicitud de requerimiento no encontrada.' }, { status: 404 });
    }

    const currentItemsRaw = Array.isArray(currentReq.items) ? currentReq.items : [];
    const now = new Date();
    const nowIso = now.toISOString();
    const nowFormatted = formatDateTimeCO(now);

    // 3. Procesar y sanitizar cada ítem con auditoría horaria
    let recalculatedGrandTotal = 0;

    const sanitizedItems = updatedItemsInput.map((inputIt, index) => {
      const existingIt = (currentItemsRaw[index] || {}) as Record<string, unknown>;
      const qty = Number(inputIt.quantity) > 0 ? Number(inputIt.quantity) : Number(existingIt.quantity) || 1;

      // Preservar precio original histórico
      const originalUnitPrice =
        typeof existingIt.original_unit_price === 'number'
          ? existingIt.original_unit_price
          : typeof existingIt.unit_price === 'number'
          ? existingIt.unit_price
          : Number(inputIt.unit_price) || 0;

      const originalTotal =
        typeof existingIt.original_total === 'number'
          ? existingIt.original_total
          : qty * originalUnitPrice;

      // Determinar cuál cotización fue seleccionada
      const quotationsList = Array.isArray(inputIt.quotations) ? inputIt.quotations : [];
      const selectedIndex =
        typeof inputIt.selected_quotation_index === 'number' && inputIt.selected_quotation_index >= 0
          ? inputIt.selected_quotation_index
          : 0;

      const selectedOption = quotationsList[selectedIndex] || quotationsList[0] || null;

      // Precio y proveedor final según la opción adjudicada o entrada directa
      const finalUnitPrice = selectedOption
        ? Number(selectedOption.unit_price) || 0
        : typeof inputIt.unit_price === 'number'
        ? Number(inputIt.unit_price) || 0
        : Number(existingIt.unit_price) || 0;

      const finalTotal = qty * finalUnitPrice;
      recalculatedGrandTotal += finalTotal;

      const finalSupplier =
        selectedOption?.supplier?.trim() ||
        String(inputIt.suggested_supplier || existingIt.suggested_supplier || '').trim();

      const finalBrand =
        selectedOption?.brand?.trim() ||
        String(inputIt.brand || existingIt.brand || '').trim();

      // Comparación y auditoría de cambio
      const previousPrice = Number(existingIt.unit_price) || originalUnitPrice;
      const priceHasChanged = finalUnitPrice !== previousPrice;

      const existingAudit = existingIt.price_audit as Record<string, unknown> | undefined;

      const priceAudit = {
        updated_at: nowIso,
        updated_at_formatted: nowFormatted,
        updated_by_id: dbUser.id,
        updated_by_name: dbUser.full_name || 'Personal de Compras',
        updated_by_email: dbUser.email || session.user.email,
        previous_unit_price: previousPrice,
        new_unit_price: finalUnitPrice,
        original_unit_price: originalUnitPrice,
        variation_pct: previousPrice > 0 ? Number((((finalUnitPrice - previousPrice) / previousPrice) * 100).toFixed(2)) : 0,
        change_reason:
          String(inputIt.change_reason || change_reason || '').trim() ||
          (priceHasChanged
            ? `Precio actualizado a $ ${finalUnitPrice.toLocaleString('es-CO')} vía cotización adjudicada`
            : String(existingAudit?.change_reason || 'Tarifa confirmada en mesa de compras')),
      };

      return {
        ...existingIt,
        item_no: inputIt.item_no || index + 1,
        description: inputIt.description || String(existingIt.description || ''),
        quantity: qty,
        unit: inputIt.unit || String(existingIt.unit || 'Und'),
        original_unit_price: originalUnitPrice,
        original_total: originalTotal,
        unit_price: finalUnitPrice,
        total: finalTotal,
        brand: finalBrand,
        suggested_supplier: finalSupplier,
        budget_rubro: inputIt.budget_rubro || String(existingIt.budget_rubro || existingIt.client_quote_no || 'No presupuestado'),
        budget_item_id: inputIt.budget_item_id || (existingIt.budget_item_id as string | undefined),
        client_quote_no: inputIt.budget_rubro || String(existingIt.client_quote_no || existingIt.budget_rubro || 'No presupuestado'),
        selected_quotation_index: selectedIndex,
        quotations: quotationsList.map((opt, optIdx) => ({
          option_no: opt.option_no || optIdx + 1,
          source: opt.source || (optIdx === 0 ? 'solicitud' : optIdx === 1 ? 'presupuesto' : 'mercado'),
          supplier: String(opt.supplier || '').trim(),
          brand: String(opt.brand || '').trim(),
          unit_price: Number(opt.unit_price) || 0,
          total: qty * (Number(opt.unit_price) || 0),
          delivery_days: opt.delivery_days || 'Inmediata',
          notes: String(opt.notes || '').trim(),
          is_selected: optIdx === selectedIndex,
        })),
        price_audit: priceAudit,
      };
    });

    // 4. Actualizar estado si corresponde
    let nextStatus = currentReq.status;
    if (nextStatus === 'pending') {
      nextStatus = 'in_quotation';
    }

    // 5. Persistir en Supabase
    const { error: updateErr } = await supabase
      .from('purchase_requests')
      .update({
        items: sanitizedItems,
        total_amount: recalculatedGrandTotal,
        status: nextStatus,
      })
      .eq('id', request_id);

    if (updateErr) {
      console.error('Error actualizando cotizaciones en purchase_requests:', updateErr);
      return NextResponse.json({ error: 'Error al persistir cotizaciones en la base de datos.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cotizaciones y precios actualizados exitosamente en la base de datos.',
      request_code: currentReq.request_code,
      total_amount: recalculatedGrandTotal,
      items: sanitizedItems,
      updated_at_formatted: nowFormatted,
    });
  } catch (err) {
    console.error('Error inesperado en endpoint de cotizaciones:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno al procesar cotizaciones.' },
      { status: 500 }
    );
  }
}
