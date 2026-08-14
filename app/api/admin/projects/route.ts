import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createProjectFolder } from '@/lib/drive';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';

// GET /api/admin/projects
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, field_reports(id, operational_summary)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute stats
  const projects = (data || []).map((p: { field_reports?: { id: string; operational_summary: { ml?: number }[] }[]; [key: string]: unknown }) => {
    const reports = p.field_reports || [];
    const totalML = reports.reduce((sum: number, r: { operational_summary?: { ml?: number }[] }) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
    }, 0);
    return {
      ...p,
      report_count: reports.length,
      total_ml: totalML,
      field_reports: undefined,
    };
  });

  return NextResponse.json({ data: projects });
}

// POST /api/admin/projects
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, name, client, location, contract_number, description } = parsed.data;

  // Create Drive folder
  let driveFolderId: string | undefined;
  let driveFolderUrl: string | undefined;
  try {
    const folder = await createProjectFolder(code, name);
    driveFolderId = folder.id;
    driveFolderUrl = folder.webViewLink;
  } catch (e) {
    console.error('Drive folder creation failed:', e);
    // Continue without Drive folder if Drive not configured
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      code,
      name,
      client,
      location,
      contract_number,
      description,
      drive_folder_id: driveFolderId,
      drive_folder_url: driveFolderUrl,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/admin/projects  (update/toggle active)
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
