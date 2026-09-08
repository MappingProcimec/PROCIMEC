-- Migración 009: Columna phone en tabla users para contacto y WhatsApp
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
