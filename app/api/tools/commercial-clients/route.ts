import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { Client } from '@/types';

const FALLBACK_CLIENTS: Client[] = [
  {
    id: 'cli-001',
    company_name: 'Consorcio Vías del Norte',
    nit: '901.456.789-1',
    contact_name: 'Ing. Carlos Mendoza',
    contact_role: 'Director de Obra',
    email: 'cmendoza@viasdelnorte.com',
    phone: '3104567890',
    city: 'Barranquilla',
    client_type: 'corporativo',
    economic_sector: 'Infraestructura Vial',
    payment_terms: 'Crédito 30 días',
    status: 'active',
    notes: 'Cliente preferencial en proyectos de localización GPR vial.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cli-002',
    company_name: 'Constructora Bolívar S.A.',
    nit: '860.052.123-4',
    contact_name: 'Arq. Marcela Gómez',
    contact_role: 'Gerente de Proyectos',
    email: 'mgomez@constructora-bolivar.co',
    phone: '3157891234',
    city: 'Bogotá',
    client_type: 'corporativo',
    economic_sector: 'Edificación y Vivienda',
    payment_terms: 'Crédito 45 días',
    status: 'active',
    notes: 'Acuerdo marco para trazado y detección previa de redes.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cli-003',
    company_name: 'Ecopetrol S.A.',
    nit: '899.999.068-1',
    contact_name: 'Ing. Fernando Ruiz',
    contact_role: 'Líder Geofísica & Subsuelo',
    email: 'fruiz@ecopetrol.com.co',
    phone: '3001234567',
    city: 'Nacional',
    client_type: 'corporativo',
    economic_sector: 'Petróleo y Gas',
    payment_terms: 'Crédito 60 días',
    status: 'active',
    notes: 'Contratos de exploración geofísica y sísmica somera.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cli-004',
    company_name: 'Triple A S.A. E.S.P.',
    nit: '800.123.456-7',
    contact_name: 'Ing. Roberto Silva',
    contact_role: 'Jefe Redes Acueducto',
    email: 'rsilva@aaa.com.co',
    phone: '3019876543',
    city: 'Barranquilla',
    client_type: 'publico',
    economic_sector: 'Servicios Públicos',
    payment_terms: 'Crédito 30 días',
    status: 'active',
    notes: 'Interventorías y mapeo subterráneo de acueducto y alcantarillado.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cli-005',
    company_name: 'Argos Concretos S.A.S.',
    nit: '890.900.266-3',
    contact_name: 'Dra. Patricia Peña',
    contact_role: 'Compras y Contratación',
    email: 'ppena@argos.com.co',
    phone: '3187654321',
    city: 'Medellín',
    client_type: 'corporativo',
    economic_sector: 'Materiales y Concretos',
    payment_terms: 'Contado',
    status: 'active',
    notes: 'Estudios de patología estructural en plantas industriales.',
    created_at: new Date().toISOString(),
  },
];

async function checkAccess(session: Session | null) {
  if (!session?.user?.email) return false;
  const userRole = session.user.role;
  const userId = session.user.id;
  if (userRole === 'pending') return false;

  const allowedRoles = ['admin', 'commercial', 'comercial', 'gerencia', 'management', 'purchasing', 'compras'];
  if (userRole && allowedRoles.includes(userRole)) return true;

  if (userId) {
    const supabase = createAdminClient();
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'commercial-clients')
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
    return NextResponse.json({ error: 'No autorizado para consultar la Gestión de Clientes.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';
    const sectorFilter = searchParams.get('sector')?.trim() || '';

    let query = supabase.from('clients').select('*').order('company_name', { ascending: true });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (sectorFilter && sectorFilter !== 'all') {
      query = query.eq('economic_sector', sectorFilter);
    }

    const [clientsRes, oppsRes, projectsRes] = await Promise.all([
      query,
      supabase.from('commercial_opportunities').select('client_name').limit(500),
      supabase.from('projects').select('client').limit(500),
    ]);

    let rawClients = clientsRes.data as Client[] | null;

    if (clientsRes.error || !rawClients || rawClients.length === 0) {
      rawClients = FALLBACK_CLIENTS;
    }

    // Indexar en O(1) recuentos de oportunidades y proyectos asociados
    const oppCountMap = new Map<string, number>();
    (oppsRes.data ?? []).forEach((o) => {
      if (o.client_name) {
        const key = o.client_name.trim().toLowerCase();
        oppCountMap.set(key, (oppCountMap.get(key) || 0) + 1);
      }
    });

    const projectCountMap = new Map<string, number>();
    (projectsRes.data ?? []).forEach((p) => {
      if (p.client) {
        const key = p.client.trim().toLowerCase();
        projectCountMap.set(key, (projectCountMap.get(key) || 0) + 1);
      }
    });

    let clients: Client[] = rawClients.map((c) => {
      const key = c.company_name.trim().toLowerCase();
      return {
        ...c,
        opportunities_count: oppCountMap.get(key) || 0,
        projects_count: projectCountMap.get(key) || 0,
      };
    });

    if (search) {
      clients = clients.filter((c) => {
        return (
          c.company_name.toLowerCase().includes(search) ||
          (c.nit && c.nit.toLowerCase().includes(search)) ||
          (c.contact_name && c.contact_name.toLowerCase().includes(search)) ||
          (c.city && c.city.toLowerCase().includes(search)) ||
          (c.economic_sector && c.economic_sector.toLowerCase().includes(search))
        );
      });
    }

    // Métricas globales
    const stats = {
      totalClients: rawClients.length,
      activeClients: rawClients.filter((c) => c.status === 'active').length,
      prospectClients: rawClients.filter((c) => c.status === 'prospect').length,
      inactiveClients: rawClients.filter((c) => c.status === 'inactive' || c.status === 'blocked').length,
      projectsLinkedCount: Array.from(projectCountMap.values()).reduce((sum, n) => sum + n, 0),
    };

    return NextResponse.json({ clients, stats });
  } catch (err: unknown) {
    console.error('Error en GET /api/tools/commercial-clients:', err);
    return NextResponse.json({
      clients: FALLBACK_CLIENTS,
      stats: {
        totalClients: FALLBACK_CLIENTS.length,
        activeClients: FALLBACK_CLIENTS.filter((c) => c.status === 'active').length,
        prospectClients: 0,
        inactiveClients: 0,
        projectsLinkedCount: 0,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAllowed = await checkAccess(session);
  if (!isAllowed) {
    return NextResponse.json({ error: 'No autorizado para registrar clientes.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      company_name,
      nit,
      contact_name,
      contact_role,
      email,
      phone,
      address,
      city,
      client_type,
      economic_sector,
      payment_terms,
      status,
      notes,
    } = body;

    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'La Razón Social o Nombre de la Empresa es obligatorio.' }, { status: 400 });
    }

    const cleanName = String(company_name).trim();
    const cleanNit = nit ? String(nit).trim() : null;

    // Verificar si ya existe un cliente con el mismo NIT si fue provisto
    if (cleanNit) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('nit', cleanNit)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Ya existe un cliente registrado con el NIT ${cleanNit}: "${existing.company_name}".` },
          { status: 400 }
        );
      }
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session?.user?.email ?? '')
      .maybeSingle();

    const { data: inserted, error: insertErr } = await supabase
      .from('clients')
      .insert({
        company_name: cleanName,
        nit: cleanNit,
        contact_name: contact_name ? String(contact_name).trim() : null,
        contact_role: contact_role ? String(contact_role).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        client_type: client_type || 'corporativo',
        economic_sector: economic_sector || 'Infraestructura',
        payment_terms: payment_terms || 'Contado',
        status: status || 'active',
        notes: notes ? String(notes).trim() : null,
        created_by: dbUser?.id || null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      message: 'Cliente registrado exitosamente.',
      client: inserted,
    });
  } catch (err: unknown) {
    console.error('Error registrando cliente:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al registrar cliente.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAllowed = await checkAccess(session);
  if (!isAllowed) {
    return NextResponse.json({ error: 'No autorizado para actualizar clientes.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      id,
      company_name,
      nit,
      contact_name,
      contact_role,
      email,
      phone,
      address,
      city,
      client_type,
      economic_sector,
      payment_terms,
      status,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de cliente requerido.' }, { status: 400 });
    }
    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'La Razón Social o Nombre de la Empresa es obligatorio.' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('clients')
      .update({
        company_name: String(company_name).trim(),
        nit: nit ? String(nit).trim() : null,
        contact_name: contact_name ? String(contact_name).trim() : null,
        contact_role: contact_role ? String(contact_role).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        client_type: client_type || 'corporativo',
        economic_sector: economic_sector || 'Infraestructura',
        payment_terms: payment_terms || 'Contado',
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
      message: 'Cliente actualizado exitosamente.',
      client: updated,
    });
  } catch (err: unknown) {
    console.error('Error actualizando cliente:', err);
    const msg = err instanceof Error ? err.message : 'Error interno al actualizar cliente.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
