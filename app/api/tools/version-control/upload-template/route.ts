import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'No autorizado. Debe iniciar sesión.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const code = (formData.get('code') as string | null) || 'DOC';
    const version = (formData.get('version') as string | null) || '1';
    const formatId = formData.get('format_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se adjuntó ningún archivo para la plantilla.' }, { status: 400 });
    }

    // Tamaño máximo: 50 MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo permitido de 50MB.' },
        { status: 400 }
      );
    }

    const rawExt = path.extname(file.name).toLowerCase();
    const allowedExts = ['.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt', '.xlsm', '.pdf'];
    if (!allowedExts.includes(rawExt)) {
      return NextResponse.json(
        { error: `Formato de archivo no permitido (${rawExt}). Sube archivos editables de Excel (.xlsx), Word (.docx) o PowerPoint (.pptx).` },
        { status: 400 }
      );
    }

    const cleanExt = rawExt.replace('.', '');
    const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanVer = version.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cleanOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `version-control/templates/${cleanCode}_v${cleanVer}_${Date.now()}_${cleanOriginalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createAdminClient();
    let fileUrl: string | null = null;

    // 1. Intento de subida al bucket 'evidencias' de Supabase Storage
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('evidencias')
          .getPublicUrl(storagePath);
        fileUrl = publicUrlData?.publicUrl || null;
      } else if (uploadError) {
        console.warn('Advertencia al subir a Supabase Storage bucket evidencias:', uploadError.message);
      }
    } catch (storageErr) {
      console.warn('Excepción al conectar con Supabase Storage:', storageErr);
    }

    // 2. Si Storage no está configurado o falló, guardar en public/templates/uploads/
    if (!fileUrl) {
      const localUploadDir = path.join(process.cwd(), 'public', 'templates', 'uploads');
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true });
      }
      const localFileName = `${cleanCode}_v${cleanVer}_${Date.now()}_${cleanOriginalName}`;
      const localFilePath = path.join(localUploadDir, localFileName);
      fs.writeFileSync(localFilePath, buffer);
      fileUrl = `/templates/uploads/${localFileName}`;
    }

    // 3. Normalizar tipo editable principal
    let editableType: 'xlsx' | 'docx' | 'pptx' = 'xlsx';
    if (cleanExt.startsWith('doc')) editableType = 'docx';
    else if (cleanExt.startsWith('ppt')) editableType = 'pptx';
    else editableType = 'xlsx';

    // 4. Si se proporcionó format_id, actualizar directamente en document_format_versions
    if (formatId) {
      await supabase
        .from('document_format_versions')
        .update({
          download_template_url: fileUrl,
          editable_type: editableType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formatId);
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      file_format: cleanExt,
      editable_type: editableType,
      file_name: file.name,
      file_size: file.size,
      message: 'Formato editable importado y almacenado correctamente.',
    });
  } catch (error: unknown) {
    console.error('Error al subir plantilla de formato:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al procesar archivo de formato' },
      { status: 500 }
    );
  }
}
