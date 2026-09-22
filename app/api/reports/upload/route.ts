import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'localizador', 'operator', 'dibujo'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fieldReportId = formData.get('fieldReportId') as string | null;
    const fileType = (formData.get('fileType') as string | null) || 'photo';
    const caption = (formData.get('caption') as string | null) || '';

    if (!file || !fieldReportId) {
      return NextResponse.json({ error: 'Archivo y fieldReportId son obligatorios' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Limpiar nombre de archivo y armar ruta en Supabase Storage
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `field-reports/${fieldReportId}/${fileType}/${timestamp}_${cleanFileName}`;

    // Convertir archivo a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Subir a Supabase Storage (Bucket 'evidencias')
    const { error: uploadError } = await supabase.storage
      .from('evidencias')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error al subir a Supabase Storage:', uploadError);
      return NextResponse.json({ error: `Error en almacenamiento: ${uploadError.message}` }, { status: 500 });
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from('evidencias')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl || '';

    // 2. Registrar en la tabla report_files de Supabase (tolerante al esquema actual)
    let savedFile: { id: string } | null = null;

    // Intento 1: con columnas extendidas (si la migración 021 fue ejecutada)
    const extendedPayload = {
      field_report_id: fieldReportId,
      file_type: fileType,
      original_name: file.name,
      drive_file_id: storagePath,
      drive_webview_url: publicUrl,
      drive_download_url: publicUrl,
      storage_path: storagePath,
      storage_url: publicUrl,
      caption: caption || null,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    };

    const basePayload = {
      field_report_id: fieldReportId,
      file_type: fileType,
      original_name: file.name,
      drive_file_id: storagePath,
      drive_webview_url: publicUrl,
      drive_download_url: publicUrl,
      caption: caption || null,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    };

    const { data: res1, error: err1 } = await supabase
      .from('report_files')
      .insert(extendedPayload)
      .select()
      .single();

    if (err1) {
      // Fallback inmediato con las columnas nativas del schema existente
      const { data: res2, error: err2 } = await supabase
        .from('report_files')
        .insert(basePayload)
        .select()
        .single();

      if (err2) {
        console.error('Error al registrar archivo en base de datos:', err2);
        return NextResponse.json({ error: `Error en base de datos: ${err2.message}` }, { status: 500 });
      }
      savedFile = res2;
    } else {
      savedFile = res1;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: savedFile?.id || '',
        originalName: file.name,
        storagePath,
        storageUrl: publicUrl,
        publicUrl,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('Error en POST /api/reports/upload:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al procesar subida' }, { status: 500 });
  }
}
