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

  const contentType = request.headers.get('content-type') || '';

  // ─────────────────────────────────────────────────────────────────────────────
  // FLUJO MODERNO: Direct-to-Supabase Storage mediante URL firmada (JSON)
  // Bypasea el límite rígido de 4.5 MB de Vercel Serverless para archivos GPR y fotos
  // ─────────────────────────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      const { action } = body;
      const supabase = createAdminClient();

      // ACCIÓN 1: Obtener URL firmada para subida directa cliente -> Supabase Storage
      if (action === 'get-upload-url') {
        const { fieldReportId, fileName, fileType = 'photo', fileSize = 0 } = body;

        if (!fieldReportId || !fileName) {
          return NextResponse.json({ error: 'fieldReportId y fileName son requeridos' }, { status: 400 });
        }

        // Límite de seguridad ampliado: 100 MB por archivo de georadar o imagen
        const MAX_FILE_SIZE = 100 * 1024 * 1024;
        if (fileSize > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 100MB' }, { status: 400 });
        }

        // Verificación IDOR
        const { data: report, error: reportErr } = await supabase
          .from('field_reports')
          .select('id, created_by, project_id')
          .eq('id', fieldReportId)
          .single();

        if (reportErr || !report) {
          return NextResponse.json({ error: 'Reporte de campo no encontrado' }, { status: 404 });
        }

        if (session.user.role !== 'admin' && report.created_by !== session.user.id) {
          const { data: assignment } = await supabase
            .from('user_projects')
            .select('project_id')
            .eq('user_id', session.user.id)
            .eq('project_id', report.project_id)
            .maybeSingle();

          if (!assignment) {
            return NextResponse.json({ error: 'No tienes autorización para adjuntar archivos a este reporte' }, { status: 403 });
          }
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const cleanFileName = String(fileName).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const storagePath = `field-reports/${fieldReportId}/${fileType}/${timestamp}_${randomSuffix}_${cleanFileName}`;

        const { data: signedData, error: signError } = await supabase.storage
          .from('evidencias')
          .createSignedUploadUrl(storagePath, { upsert: true });

        if (signError || !signedData) {
          console.error('Error al generar URL firmada de Supabase Storage:', signError);
          return NextResponse.json({ error: `Error al autorizar almacenamiento en la nube: ${signError?.message || 'Error desconocido'}` }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage
          .from('evidencias')
          .getPublicUrl(storagePath);

        return NextResponse.json({
          success: true,
          data: {
            signedUrl: signedData.signedUrl,
            token: signedData.token,
            storagePath,
            publicUrl: publicUrlData.publicUrl,
          },
        });
      }

      // ACCIÓN 2: Confirmar carga exitosa y persistir en la tabla report_files
      if (action === 'confirm-upload') {
        const {
          fieldReportId,
          fileType = 'photo',
          originalName,
          storagePath,
          storageUrl,
          caption = '',
          sizeBytes = 0,
          mimeType = 'application/octet-stream',
        } = body;

        if (!fieldReportId || !originalName || !storagePath || !storageUrl) {
          return NextResponse.json({ error: 'Faltan parámetros requeridos para confirmar el archivo' }, { status: 400 });
        }

        // Verificación IDOR
        const { data: report, error: reportErr } = await supabase
          .from('field_reports')
          .select('id, created_by, project_id')
          .eq('id', fieldReportId)
          .single();

        if (reportErr || !report) {
          return NextResponse.json({ error: 'Reporte de campo no encontrado' }, { status: 404 });
        }

        if (session.user.role !== 'admin' && report.created_by !== session.user.id) {
          const { data: assignment } = await supabase
            .from('user_projects')
            .select('project_id')
            .eq('user_id', session.user.id)
            .eq('project_id', report.project_id)
            .maybeSingle();

          if (!assignment) {
            return NextResponse.json({ error: 'No tienes autorización para registrar archivos en este reporte' }, { status: 403 });
          }
        }

        const extendedPayload = {
          field_report_id: fieldReportId,
          file_type: fileType,
          original_name: originalName,
          drive_file_id: storagePath,
          drive_webview_url: storageUrl,
          drive_download_url: storageUrl,
          storage_path: storagePath,
          storage_url: storageUrl,
          caption: caption || null,
          size_bytes: sizeBytes,
          mime_type: mimeType,
        };

        const basePayload = {
          field_report_id: fieldReportId,
          file_type: fileType,
          original_name: originalName,
          drive_file_id: storagePath,
          drive_webview_url: storageUrl,
          drive_download_url: storageUrl,
          caption: caption || null,
          size_bytes: sizeBytes,
          mime_type: mimeType,
        };

        let savedFile: { id: string } | null = null;
        const { data: res1, error: err1 } = await supabase
          .from('report_files')
          .insert(extendedPayload)
          .select()
          .single();

        if (err1) {
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
            originalName,
            storagePath,
            storageUrl,
            publicUrl: storageUrl,
          },
        }, { status: 201 });
      }

      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
    } catch (jsonErr) {
      console.error('Error procesando solicitud JSON en /api/reports/upload:', jsonErr);
      return NextResponse.json({ error: jsonErr instanceof Error ? jsonErr.message : 'Error en carga' }, { status: 500 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLUJO LEGACY: Multipart/form-data a través de servidor (para archivos < 4MB)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fieldReportId = formData.get('fieldReportId') as string | null;
    const fileType = (formData.get('fileType') as string | null) || 'photo';
    const caption = (formData.get('caption') as string | null) || '';

    if (!file || !fieldReportId) {
      return NextResponse.json({ error: 'Archivo y fieldReportId son obligatorios' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 50MB' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: report, error: reportErr } = await supabase
      .from('field_reports')
      .select('id, created_by')
      .eq('id', fieldReportId)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Reporte de campo no encontrado' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && report.created_by !== session.user.id) {
      return NextResponse.json({ error: 'No tienes autorización para adjuntar archivos a este reporte' }, { status: 403 });
    }

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `field-reports/${fieldReportId}/${fileType}/${timestamp}_${cleanFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    const { data: publicUrlData } = supabase.storage
      .from('evidencias')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl || '';

    let savedFile: { id: string } | null = null;
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
