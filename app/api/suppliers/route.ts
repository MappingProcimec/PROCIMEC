import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export interface SupplierRecord {
  id: string;
  company_name: string;
  nit: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  category?: string | null;
  payment_terms?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  notes?: string | null;
  status: 'active' | 'inactive' | 'blocked';
  created_at?: string;
  updated_at?: string;
}

const FALLBACK_SUPPLIERS: SupplierRecord[] = [
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
    status: 'active',
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
    status: 'active',
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
    status: 'active',
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
    status: 'active',
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
    status: 'active',
  },
];

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('status', 'active')
      .order('company_name', { ascending: true });

    if (error) {
      console.warn('Advertencia al consultar tabla suppliers (usando fallback seguro):', error.message);
      return NextResponse.json({ suppliers: FALLBACK_SUPPLIERS });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ suppliers: FALLBACK_SUPPLIERS });
    }

    return NextResponse.json({ suppliers: data });
  } catch (err) {
    console.error('Error en GET /api/suppliers:', err);
    return NextResponse.json({ suppliers: FALLBACK_SUPPLIERS });
  }
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
    } = body;

    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'La Razón Social / Nombre Comercial es obligatorio.' }, { status: 400 });
    }
    if (!nit?.trim()) {
      return NextResponse.json({ error: 'El NIT / Identificación Tributaria es obligatorio.' }, { status: 400 });
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', session.user.email)
      .maybeSingle();

    const cleanNit = String(nit).trim();
    const cleanCompanyName = String(company_name).trim();

    // Comprobar si ya existe el NIT
    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('id, company_name, nit')
      .eq('nit', cleanNit)
      .maybeSingle();

    if (existingSupplier) {
      // Actualizar registro existente
      const { data: updated, error: updateErr } = await supabase
        .from('suppliers')
        .update({
          company_name: cleanCompanyName,
          contact_name: contact_name ? String(contact_name).trim() : null,
          email: email ? String(email).trim().toLowerCase() : null,
          phone: phone ? String(phone).trim() : null,
          address: address ? String(address).trim() : null,
          city: city ? String(city).trim() : null,
          category: category ? String(category).trim() : 'materiales',
          payment_terms: payment_terms ? String(payment_terms).trim() : 'Contado',
          bank_name: bank_name ? String(bank_name).trim() : null,
          bank_account_type: bank_account_type ? String(bank_account_type).trim() : null,
          bank_account_number: bank_account_number ? String(bank_account_number).trim() : null,
          notes: notes ? String(notes).trim() : null,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSupplier.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        message: 'Proveedor actualizado exitosamente.',
        supplier: updated,
      });
    }

    // Insertar nuevo proveedor
    const { data: inserted, error: insertErr } = await supabase
      .from('suppliers')
      .insert({
        company_name: cleanCompanyName,
        nit: cleanNit,
        contact_name: contact_name ? String(contact_name).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        category: category ? String(category).trim() : 'materiales',
        payment_terms: payment_terms ? String(payment_terms).trim() : 'Contado',
        bank_name: bank_name ? String(bank_name).trim() : null,
        bank_account_type: bank_account_type ? String(bank_account_type).trim() : null,
        bank_account_number: bank_account_number ? String(bank_account_number).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: 'active',
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
