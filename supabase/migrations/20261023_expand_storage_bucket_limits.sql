-- ==============================================================================
-- Migration 20261023: Expansión de cuota de archivos en Supabase Storage (evidencias)
-- Soporta levantamientos de Georadar (GPR) con archivos crudos de hasta 100 MB
-- ==============================================================================

UPDATE storage.buckets
SET 
  file_size_limit = 104857600, -- 100 MB
  allowed_mime_types = NULL     -- Permite cualquier extensión o formato binario (DZT, DT1, HD, SGY, DWG, TXT, etc.)
WHERE id = 'evidencias';
