import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('forms')
    .select('id, slug, name, description, steps_count, has_attachments, created_at')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const normalized = (data ?? []).map((f) => {
    if (f.slug === 'gpr-field-form') {
      return { ...f, steps_count: 3, has_attachments: true };
    }
    return f;
  });

  const formSlugs = new Set(normalized.map((f) => f.slug));
  if (!formSlugs.has('hseq-report')) {
    normalized.push({
      id: 'hseq-report-synthetic',
      slug: 'hseq-report',
      name: 'Formulario de Inspección HSEQ',
      description: 'Formulario de campo HSEQ para Localizadores con soporte de dictado por voz y generación directa de PDF en Google Drive.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }

  if (!formSlugs.has('elaboracion-cartas')) {
    normalized.push({
      id: 'elaboracion-cartas-synthetic',
      slug: 'elaboracion-cartas',
      name: 'Formulario de Elaboración de Cartas',
      description: 'Generación estandarizada de cartas de RRHH y certificaciones corporativas con descarga inmediata en Word/PDF y notificación por correo.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  if (!formSlugs.has('registro-equipo')) {
    normalized.push({
      id: 'registro-equipo-synthetic',
      slug: 'registro-equipo',
      name: 'Movimientos y Registro de Almacén',
      description: 'Control operativo de bodega: alta de instrumental, ingreso de consumibles, despachos y retornos de obra.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  // Compras
  if (!formSlugs.has('requerimiento-compra')) {
    normalized.push({
      id: 'requerimiento-compra-synthetic',
      slug: 'requerimiento-compra',
      name: 'Requerimiento de Compra',
      description: 'Solicitud interna de insumos, herramientas o servicios requeridos por proyectos o áreas.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('orden-compra')) {
    normalized.push({
      id: 'orden-compra-synthetic',
      slug: 'orden-compra',
      name: 'Orden de Compra y Adjudicación',
      description: 'Registro formal de orden de compra, proveedor seleccionado, condiciones de pago y montos.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('evaluacion-proveedor')) {
    normalized.push({
      id: 'evaluacion-proveedor-synthetic',
      slug: 'evaluacion-proveedor',
      name: 'Evaluación y Recepción de Proveedor',
      description: 'Calificación de calidad, tiempos de entrega y nivel de servicio de compras recibidas.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  // Comercial
  if (!formSlugs.has('registro-oportunidad')) {
    normalized.push({
      id: 'registro-oportunidad-synthetic',
      slug: 'registro-oportunidad',
      name: 'Registro de Oportunidad / Licitación',
      description: 'Captura de requerimientos de clientes, pliegos licitatorios y solicitudes comerciales.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('cotizacion-comercial')) {
    normalized.push({
      id: 'cotizacion-comercial-synthetic',
      slug: 'cotizacion-comercial',
      name: 'Cotización Comercial Emitida',
      description: 'Registro formal de propuesta económica y técnica presentada al cliente.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('cierre-comercial')) {
    normalized.push({
      id: 'cierre-comercial-synthetic',
      slug: 'cierre-comercial',
      name: 'Cierre de Negociación',
      description: 'Registro del desenlace comercial de la oferta: adjudicada, perdida o desierta.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  // Finanzas
  if (!formSlugs.has('solicitud-viaticos')) {
    normalized.push({
      id: 'solicitud-viaticos-synthetic',
      slug: 'solicitud-viaticos',
      name: 'Solicitud de Viáticos y Anticipos',
      description: 'Petición formal de fondos para comisiones de campo, combustible, peajes y hospedajes.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('legalizacion-gastos')) {
    normalized.push({
      id: 'legalizacion-gastos-synthetic',
      slug: 'legalizacion-gastos',
      name: 'Legalización y Rendición de Gastos',
      description: 'Rendición pormenorizada de comprobantes de gastos ejecutados contra anticipos recibidos.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('registro-pago')) {
    normalized.push({
      id: 'registro-pago-synthetic',
      slug: 'registro-pago',
      name: 'Comprobante de Egreso y Pago',
      description: 'Captura de comprobante bancario, transferencias realizadas y soportes contables.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }

  // Contabilidad
  if (!formSlugs.has('radicacion-factura')) {
    normalized.push({
      id: 'radicacion-factura-synthetic',
      slug: 'radicacion-factura',
      name: 'Radicación de Factura Proveedor',
      description: 'Entrada y registro de facturas de proveedores para trámite de causación y pago.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }
  if (!formSlugs.has('soporte-cobro')) {
    normalized.push({
      id: 'soporte-cobro-synthetic',
      slug: 'soporte-cobro',
      name: 'Soporte de Cobro y Facturación',
      description: 'Registro de corte de obra y actas de interventoría aprobadas para facturar al cliente.',
      steps_count: 2,
      has_attachments: true,
      created_at: new Date().toISOString(),
    });
  }

  // Filtrar formularios obsoletos/unificados (solo un formulario unificado para Almacén)
  const filtered = normalized
    .filter((f) => f.slug !== 'despacho-equipo' && f.slug !== 'retorno-equipo')
    .map((f) => {
      if (f.slug === 'registro-equipo') {
        return {
          ...f,
          name: 'Movimientos y Registro de Almacén',
          description: 'Control operativo de bodega: alta de instrumental, ingreso de consumibles, despachos y retornos de obra.',
        };
      }
      return f;
    });

  return NextResponse.json({ data: filtered });
}
