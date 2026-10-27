import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno de .env.local o .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...vals] = trimmed.split('=');
        if (key && vals.length > 0) {
          const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      });
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontradas en el entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_NAME = 'templates';

async function syncTemplates() {
  console.log('🔄 Iniciando sincronización de formatos locales hacia Supabase Storage...');
  console.log(`📡 Conectando a Supabase: ${supabaseUrl}`);

  // 1. Asegurar existencia del bucket 'templates'
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('❌ Error listando buckets en Supabase:', bucketError);
    process.exit(1);
  }

  const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);
  if (!bucketExists) {
    console.log(`📦 Creando bucket público "${BUCKET_NAME}" en Supabase Storage...`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });
    if (createError) {
      console.error(`❌ Error creando bucket "${BUCKET_NAME}":`, createError);
      process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET_NAME}" creado exitosamente.`);
  } else {
    console.log(`✅ Bucket "${BUCKET_NAME}" verificado y activo.`);
  }

  // 2. Localizar archivos en carpetas locales oficiales
  const sourceDirs = [
    path.join(process.cwd(), 'public', 'templates'),
    path.join(process.cwd(), 'formatos'),
  ];

  const filesToUpload = new Map<string, string>(); // fileName -> filePath

  for (const dir of sourceDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;

      const ext = path.extname(entry).toLowerCase();
      if (['.xlsx', '.xls', '.docx', '.pptx', '.pdf'].includes(ext)) {
        if (!filesToUpload.has(entry)) {
          filesToUpload.set(entry, fullPath);
        }
      }
    }
  }

  if (filesToUpload.size === 0) {
    console.log('⚠️ No se encontraron archivos de formato en public/templates/ ni formatos/.');
    return;
  }

  console.log(`📋 Se encontraron ${filesToUpload.size} formatos locales para sincronizar:`);

  let successCount = 0;
  let failCount = 0;

  for (const [fileName, filePath] of Array.from(filesToUpload.entries())) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();

      let contentType = 'application/octet-stream';
      if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === '.pptx') contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      else if (ext === '.pdf') contentType = 'application/pdf';

      console.log(`⬆️  Subiendo "${fileName}" (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`❌ Error al subir "${fileName}":`, uploadError.message);
        failCount++;
      } else {
        const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        console.log(`   ✅ Sincronizado: ${publicUrlData.publicUrl}`);
        successCount++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Excepción procesando "${fileName}":`, msg);
      failCount++;
    }
  }

  console.log('\n──────────────────────────────────────────────────');
  console.log(`🎉 Sincronización completada: ${successCount} exitosos, ${failCount} fallidos.`);
  console.log(`📍 Bucket: ${BUCKET_NAME}`);
  console.log('──────────────────────────────────────────────────');
}

syncTemplates().catch((e) => {
  console.error('Fatal error en script de sincronización:', e);
  process.exit(1);
});
