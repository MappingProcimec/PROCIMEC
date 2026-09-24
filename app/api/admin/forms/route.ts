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
      name: 'Movimientos y Control de Almacén',
      description: 'Captura operativa de bodega: despachos a obra, retornos de instrumental con checklist, alta de activos e ingreso de consumibles.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  if (!formSlugs.has('despacho-equipo')) {
    normalized.push({
      id: 'despacho-equipo-synthetic',
      slug: 'despacho-equipo',
      name: 'Despacho y Salida a Campo',
      description: 'Registro de salida de instrumental geofísico hacia frentes de obra con checklist de accesorios y responsable.',
      steps_count: 2,
      has_attachments: false,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ data: normalized });
}
