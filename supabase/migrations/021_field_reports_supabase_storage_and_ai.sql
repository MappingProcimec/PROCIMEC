-- ==============================================================================
-- Migration 021: Soporte de Almacenamiento en Supabase y Reportes PDF con IA
-- Desacopla la dependencia estricta de Google Drive para field_reports y report_files
-- ==============================================================================

-- 1. Ampliar tabla field_reports con soporte para PDF generado y síntesis de IA
ALTER TABLE IF EXISTS public.field_reports
ADD COLUMN IF NOT EXISTS pdf_report_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 2. Modificar report_files para permitir almacenamiento directo en Supabase Storage
--    Eliminar la restricción NOT NULL de drive_file_id si existe
ALTER TABLE IF EXISTS public.report_files
ALTER COLUMN drive_file_id DROP NOT NULL;

-- 3. Añadir columnas de storage directo a report_files
ALTER TABLE IF EXISTS public.report_files
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS storage_url TEXT;

-- 4. Asegurar índices de búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_field_reports_pdf_url ON public.field_reports(pdf_report_url) WHERE pdf_report_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_files_storage_path ON public.report_files(storage_path) WHERE storage_path IS NOT NULL;

-- 5. Asegurar bucket 'evidencias' en Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias',
  'evidencias',
  true,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'text/plain',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de acceso para el bucket 'evidencias' (lectura pública e inserción autenticada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Evidencias Public Read'
  ) THEN
    CREATE POLICY "Evidencias Public Read" ON storage.objects
      FOR SELECT USING (bucket_id = 'evidencias');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Evidencias Auth Insert'
  ) THEN
    CREATE POLICY "Evidencias Auth Insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'evidencias');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Evidencias Auth Update'
  ) THEN
    CREATE POLICY "Evidencias Auth Update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'evidencias');
  END IF;
END $$;
