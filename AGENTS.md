# REGLAS DEL PROYECTO PROCIMEC (AGENTS.md)

Este repositorio contiene la plataforma empresarial **PROCIMEC** (Next.js 14, Supabase PostgreSQL, WhatsApp Bot con Baileys y Google Gemini AI).

Todo agente de Inteligencia Artificial que opere en este workspace debe acatar estrictamente las siguientes directrices:

## 1. Reglas de Ejecución y Entorno
- **NO LEVANTAR SERVIDORES LOCALES:** No ejecutar `npm run dev`, `npm start` ni servidores en segundo plano a menos que el usuario lo solicite expresamente.
- **NO ABRIR NAVEGADORES:** No iniciar subagentes de navegador ni abrir ventanas de Chrome/Edge sin instrucción explícita del usuario.
- **PUSH AUTOMÁTICO A GITHUB:** Tras realizar cambios funcionales en el código, realizar commit descriptivo y ejecutar `git push origin main` inmediatamente (salvo instrucción en contra).
- **EXCLUSIÓN PERMANENTE DE BOT-WHATSAPP:** La carpeta `bot-whatsapp/` (tokens criptográficos de sesión, claves de API, archivos `.env`) debe permanecer siempre fuera del repositorio en `.gitignore`.

## 2. Arquitectura de Datos y Tablas en Supabase
- **Estructura Estándar de Tablas de Operación:** Toda tabla de reportes debe poseer:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `project_id UUID NOT NULL REFERENCES projects(id)` (integridad referencial, no texto libre)
  - `user_id UUID NOT NULL REFERENCES users(id)`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `status TEXT DEFAULT 'submitted'`
- **Restricciones Duras:** Los campos de selección fija deben poseer `CHECK (...)` en PostgreSQL.

## 3. Llenado y Normalización Canónica (Web y WhatsApp)
- **Resolución de Proyectos:** Las entradas de proyecto del usuario (número o nombre informal) deben cruzarse contra `user_projects` y asignarse con el nombre canónico oficial de la base de datos (o su UUID oficial). Jamás almacenar el texto no estandarizado del usuario.
- **Valores Predeterminados:**
  - Actividades CAD/BIM: `hours_worked = 8.5` por defecto, `responsible = user.email`.
  - Reportes de Campo GPR: `cad_priority = 'Media'`, `weather_conditions = 'Despejado'`, `report_date = CURRENT_DATE`.

Para más detalles, consultar `.agents/rules/procimec_architecture.md`.
