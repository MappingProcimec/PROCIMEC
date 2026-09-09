# 🏛️ CONSTITUCIÓN TÉCNICA Y REGLAS DE ARQUITECTURA PROCIMEC

Este documento es de **lectura obligatoria** para cualquier agente de Inteligencia Artificial o desarrollador que trabaje en el repositorio de **PROCIMEC**. Define los estándares operativos y las leyes arquitectónicas del sistema.

---

## 🛑 1. REGLAS OPERATIVAS DE EJECUCIÓN DEL AGENTE

1. **NO LEVANTAR SERVIDORES LOCALES NI ABRIR NAVEGADORES:**
   - **Prohibido** ejecutar comandos de servidor de desarrollo en segundo plano como `npm run dev`, `npm start`, o `python -m http.server`, a menos que el usuario lo solicite **explícita y textualmente**.
   - **Prohibido** abrir navegadores (Chrome, Edge, etc.) o subagentes de navegación a menos que el usuario lo pida expresamente.
   - Las validaciones de código deben realizarse mediante análisis estático (`node -c`, `npm run build` o inspección de sintaxis), sin levantar servicios de escucha.

2. **CONTROL DE VERSIONES Y PUSH OBLIGATORIO A GITHUB:**
   - Tras realizar cualquier modificación funcional o estructural en el código:
     1. Ejecutar `git add .` (o archivos modificados).
     2. Ejecutar `git commit -m "feat/fix/chore: descripción clara"`.
     3. **Ejecutar siempre `git push origin main`** sin esperar autorización del usuario, a menos que el usuario haya indicado explícitamente no subir cambios.
   - **PROTECCIÓN PERMANENTE DEL BOT:** La carpeta `bot-whatsapp/` (tokens de sesión de WhatsApp, claves `.env`, configuraciones locales) **DEBE permanecer siempre ignorada en `.gitignore`** y NUNCA debe subirse a GitHub.

---

## 🏛️ 2. LAS 3 LEYES UNIVERSALES DE ARQUITECTURA (SCHEMA-DRIVEN)

Toda nueva funcionalidad, formulario o herramienta operativa en PROCIMEC (tanto en la plataforma Web como en el Bot de WhatsApp) debe someterse a esta arquitectura guiada por esquemas:

### 📜 LEY 1: LA ESTRUCTURA SAGRADA DE TABLAS OPERACIONALES
Cualquier tabla creada en Supabase para registrar operaciones, reportes o actividades de campo/oficina debe contar **obligatoriamente** con las siguientes columnas de integridad:

```sql
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
project_id  UUID NOT NULL REFERENCES projects(id),  -- Integridad referencial: NUNCA texto libre para proyectos
user_id     UUID NOT NULL REFERENCES users(id),     -- Vínculo estricto al colaborador autenticado
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Marca de tiempo inmutable de auditoría
status      TEXT NOT NULL DEFAULT 'submitted'       -- Flujo de estados ('draft', 'submitted', 'reviewed')
```
* **Integridad de Datos:** Si se requieren opciones fijas (enums), usar siempre `CHECK (columna IN ('OPCION1', 'OPCION2'))`.
* **Valores Predeterminados:** Las columnas con métricas estándar deben tener `DEFAULT` en PostgreSQL (ej. `hours_worked DEFAULT 8.5`, `activity_date DEFAULT CURRENT_DATE`).

---

### 📜 LEY 2: FUENTE ÚNICA DE VERDAD (CATÁLOGO DE FORMULARIOS)
Los formularios y herramientas NO deben tener reglas de validación cableadas de forma dispersa en archivos sueltos.
* La tabla `forms` en Supabase (y/o su catálogo TypeScript central) almacena la definición en formato **`schema JSONB`**.
* Cada esquema define:
  1. `target_table`: Tabla de la base de datos donde se realiza el `INSERT`.
  2. `rules`: Reglas de negocio (si requiere proyecto activo, tipo de responsable, valores por defecto).
  3. `fields`: Lista de campos con sus tipos (`project_select`, `date`, `number`, `select`, `boolean`, `text`), opciones permitidas y valores predeterminados.

Tanto la interfaz web (Next.js) como el agente conversacional de WhatsApp (Gemini) deben leer esta misma especificación para saber qué campos solicitar, qué opciones desplegar y qué valores asumir.

---

### 📜 LEY 3: EL GUARDIÁN CANÓNICO Y RESOLUCIÓN DE PROYECTOS
Antes de persistir cualquier registro en Supabase, el backend debe aplicar el siguiente filtro canónico:

1. **Resolución Estricta de Proyecto:**
   - La entrada del usuario (número de opción, siglas o nombre informal) se compara mediante normalización contra los **proyectos activos asignados al usuario en `user_projects`**.
   - **Regla de oro:** Se almacena el **nombre oficial en mayúsculas de la base de datos** (en tablas con `project_name`) o su `project_id` oficial (en tablas relacionales). NUNCA se almacena la cadena informal que escribe el usuario.
   - Si la entrada no coincide con ningún proyecto activo del usuario, la operación se rechaza inmediatamente.

2. **Identidad del Responsable:**
   - En formularios de dibujo/CAD (`drawing_activities`), `responsible` se asigna obligatoriamente al correo electrónico del usuario (`user.email`).
   - En reportes de campo (`field_reports`), `created_by` se asigna al `user.id` y `operator_name` a `user.full_name`.

3. **Valores Predeterminados del Negocio:**
   - Actividades CAD/BIM: `hours_worked = 8.5` por defecto (no preguntar al colaborador a menos que él indique otra cifra).
   - Reportes de Campo GPR: `cad_priority = 'Media'`, `capture_method = 'Rueda odómetro'`, `weather_conditions = 'Despejado'`.
   - Fecha de reporte: si no se especifica, se asigna automáticamente la fecha actual local (`CURRENT_DATE`).
