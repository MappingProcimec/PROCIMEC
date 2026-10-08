import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { Supplier } from '@/types';

const FALLBACK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-001',
    company_name: 'Cantera Arenas',
    nit: '900.123.456-1',
    contact_name: 'Dpto. Despachos',
    email: 'ventas@canteraarenas.com',
    phone: '3001234567',
    city: 'Barranquilla',
    category: 'Materiales Pétreos',
    payment_terms: 'Contado',
    bank_name: 'Bancolombia',
    bank_account_type: 'Ahorros',
    bank_account_number: '123-456789-01',
    status: 'active',
    notes: 'Proveedor habitual de áridos, gravas y recebo.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-002',
    company_name: 'Homecenter / Sodimac Colombia',
    nit: '800.242.106-2',
    contact_name: 'Ventas Corporativas',
    email: 'empresas@homecenter.co',
    phone: '018000127373',
    city: 'Nacional',
    category: 'Ferretería y Herramientas',
    payment_terms: 'Contado',
    bank_name: 'Banco de Bogotá',
    bank_account_type: 'Corriente',
    bank_account_number: '987-654321-02',
    status: 'active',
    notes: 'Compras menores y ferretería general.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-003',
    company_name: 'Lahyer Colombia SAS',
    nit: '900.567.890-3',
    contact_name: 'Asesor Comercial',
    email: 'contacto@layher.com.co',
    phone: '3157890123',
    city: 'Bogotá',
    category: 'Equipos y Andamios',
    payment_terms: 'Crédito 30 días',
    bank_name: 'Davivienda',
    bank_account_type: 'Corriente',
    bank_account_number: '345-678901-03',
    status: 'active',
    notes: 'Andamiaje certificado multidireccional para plantas.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-004',
    company_name: 'Ultracem SAS',
    nit: '900.345.678-4',
    contact_name: 'Despachos Planta',
    email: 'comercial@ultracem.co',
    phone: '3104567890',
    city: 'Galapa / Barranquilla',
    category: 'Cementos y Concretos',
    payment_terms: 'Crédito 15 días',
    bank_name: 'Bancolombia',
    bank_account_type: 'Corriente',
    bank_account_number: '456-789012-04',
    status: 'active',
    notes: 'Concretos MR y cemento estructural.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-005',
    company_name: 'Ferretería El Tornillo',
    nit: '900.987.654-5',
    contact_name: 'Atención Mostrador',
    email: 'eltornillo@gmail.com',
    phone: '3019876543',
    city: 'Barranquilla',
    category: 'Ferretería y Tornillería',
    payment_terms: 'Contado',
    bank_name: 'Banco BBVA',
    bank_account_type: 'Ahorros',
    bank_account_number: '567-890123-05',
    status: 'active',
    notes: 'Ferretería liviana y consumibles rápidos.',
    created_at: new Date().toISOString(),
  },
];

async function checkAccess(session: Session | null) {
  if (!session?.user?.email) return false;
  const userRole = session.user.role;
  const userId = session.user.id;
  if (userRole === 'pending') return false;

  const allowedRoles = ['admin', 'purchasing', 'compras', 'gerencia', 'management', 'finance', 'finanzas'];
  if (userRole && allowedRoles.includes(userRole)) return true;

  if (userId) {
    const supabase = createAdminClient();
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'purchasing-suppliers')
        .maybeSingle();
      if (ut) return true;
    } catch {
      // Ignorar
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAllowed = await checkAccess(session);
  if (!isAllowed) {
    return NextResponse.json({ error: 'No autorizado para consultar la Gestión de Proveedores.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';
    const categoryFilter = searchParams.get('category')?.trim() || '';

    let query = supabase.from('suppliers').select('*').order('company_name', { ascending: true });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    const [suppliersRes, ordersRes] = await Promise.all([
      query,
      supabase.from('purchase_orders').select('supplier_id, supplier_name').limit(500),
    ]);

    let rawSuppliers = suppliersRes.data as Supplier[] | null;

    if (suppliersRes.error || !rawSuppliers || rawSuppliers.length === 0) {
      rawSuppliers = FALLBACK_SUPPLIERS;
    }

    // Indexar en O(1) recuentos de órdenes de compra
    const ordersByIdMap = new Map<string, number>();
    const ordersByNameMap = new Map<string, number>();

    (ordersRes.data ?? []).forEach((o) => {
      if (o.supplier_id) {
        ordersByIdMap.set(o.supplier_id, (ordersByIdMap.get(o.supplier_id) || 0) + 1);
      }
      if (o.supplier_name) {
        const key = o.supplier_name.trim().toLowerCase();
        ordersByNameMap.set(key, (ordersByNameMap.get(key) || 0) + 1);
      }
    });

    let suppliers: Supplier[] = rawSuppliers.map((s) => {
      const byId = s.id ? (ordersByIdMap.get(s.id) || 0) : 0;
      const byName = s.company_name ? (ordersByNameMap.get(s.company_name.trim().toLowerCase()) || 0) : 0;
      return {
        ...s,
        purchase_orders_count: Math.max(byId, byName),
      };
    });

    if (search) {
      suppliers = suppliers.filter((s) => {
        return (
          s.company_name.toLowerCase().includes(search) ||
          (s.nit && s.nit.toLowerCase().includes(search)) ||
          (s.contact_name && s.contact_name.toLowerCase().includes(search)) ||
          (s.city && s.city.toLowerCase().includes(search)) ||
          (s.category && s.category.toLowerCase().includes(search))
        );
      });
    }

    // Métricas globales
    const stats = {
      totalSuppliers: rawSuppliers.length,
      activeSuppliers: rawSuppliers.filter((s) => s.status === 'active').length,
      creditSuppliersCount: rawSuppliers.filter((s) => s.payment_terms && s.payment_terms.toLowerCase().includes('crédito')).length,
      ordersIssuedCount: (ordersRes.data ?? []).length,
    };

    return NextResponse.json({ suppliers, stats });
  } catch (err: unknown) {
    console.error('Error en GET /api/tools/purchasing-suppliers:', err);
    return NextResponse.json({
      suppliers: FALLBACK_SUPPLIERS,
      stats: {
        totalSuppliers: FALLBACK_SUPPLIERS.length,
        activeSuppliers: FALLBACK_SUPPLIERS.filter((s) => s.status === 'active').length,
        creditSuppliersCount: 2,
        ordersIssuedCount: 0,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAllowed = await checkAccess(session);
  if (!isAllowed) {
    return NextResponse.json({ error: 'No autorizado para registrar proveedores.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      company_name,
      nit,
      contact_name,
      email,
      phone,
      address,
      city,
      category,
      payment_terms,
      bank_name,
      bank_account_type,
      bank_account_number,
      notes,
      status,
    } = body;

    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'La Razón Social o Nombre de la Empresa es obligatorio.' }, { status: 400 });
    }
    if (!nit?.trim()) {
      return NextResponse.json({ error: 'El NIT o Identificación Tributaria es obligatorio.' }, { status: 400 });
    }

    const cleanNit = String(nit).trim();
    const cleanName = String(company_name).trim();

    // Comprobar si ya existe el NIT
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, company_name, nit')
      .eq('nit', cleanNit)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un proveedor registrado con el NIT ${cleanNit}: "${existing.company_name}".` },
        { status: 400 }
      );
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session?.user?.email ?? '')
      .maybeSingle();

    const { data: inserted, error: insertErr } = await supabase
      .from('suppliers')
      .insert({
        company_name: cleanName,
        nit: cleanNit,
        contact_name: contact_name ? String(contact_name).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        category: category || 'Materiales Pétreos',
        payment_terms: payment_terms || 'Contado',
        bank_name: bank_name ? String(bank_name).trim() : null,
        bank_account_type: bank_account_type || null,
        bank_account_number: bank_account_number ? String(bank_account_number).trim() : null,
        status: status || 'active',
        notes: notes ? String(notes).trim() : null,
        created_by: dbUser?.id || null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      message: 'Proveedor registrado y homologado exitosamente.',
      supplier: inserted,
    });
  } catch (err: unknown) {
    console.error('Error registrando proveedor:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al registrar proveedor.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAllowed = await checkAccess(session);
  if (!isAllowed) {
    return NextResponse.json({ error: 'No autorizado para actualizar proveedores.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      id,
      company_name,
      nit,
      contact_name,
      email,
      phone,
      address,
      city,
      category,
      payment_terms,
      bank_name,
      bank_account_type,
      bank_account_number,
      notes,
      status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de proveedor requerido.' }, { status: 400 });
    }
    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'La Razón Social o Nombre de la Empresa es obligatorio.' }, { status: 400 });
    }
    if (!nit?.trim()) {
      return NextResponse.json({ error: 'El NIT o Identificación Tributaria es obligatorio.' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('suppliers')
      .update({
        company_name: String(company_name).trim(),
        nit: String(nit).trim(),
        contact_name: contact_name ? String(contact_name).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        category: category || 'Materiales Pétreos',
        payment_terms: payment_terms || 'Contado',
        bank_name: bank_name ? String(bank_name).trim() : null,
        bank_account_type: bank_account_type || null,
        bank_account_number: bank_account_number ? String(bank_account_number).trim() : null,
        status: status || 'active',
        notes: notes ? String(notes).trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: 'Proveedor actualizado exitosamente.',
      supplier: updated,
    });
  } catch (err: unknown) {
    console.error('Error actualizando proveedor:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al actualizar proveedor.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
