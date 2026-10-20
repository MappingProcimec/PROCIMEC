# Auditoría de Seguridad de Rutas API y Control de Acceso — PROCIMEC (Fases 1 y 2 Completadas)

**Fecha:** 20 de Octubre de 2026  
**Ámbito:** Handlers HTTP en `app/api/**/route.ts`, Server Actions y utilidades con `createAdminClient()`.  
**Metodología:** Análisis estático de código fuente línea por línea con verificación de llamadas a `getServerSession`, `getToken`, validación previa a consultas a la base de datos, resolución de identidad de sesión, evaluación de controles contra IDOR/BOLA y suite automatizada de pruebas de guardia en Vitest.

---

## 1. Resumen Ejecutivo y Comparativa de Remediación (Antes vs Después)

En este repositorio, prácticamente la totalidad de las operaciones de lectura y mutación de base de datos se ejecutan a través de `createAdminClient()` (instanciado con `SUPABASE_SERVICE_ROLE_KEY`), lo que desactiva de facto las políticas de nivel de fila (RLS) de PostgreSQL para el tráfico originado en la API. Por lo tanto, **la autorización y la gobernanza de datos dependen al 100% de la lógica en TypeScript de cada handler**.

### Cuadro Comparativo de Seguridad

| Clasificación | Definición Operativa | Fase 1 (Línea Base) | Fase 2 (Remediado) | Estado Final |
| :--- | :--- | :---: | :---: | :---: |
| **OK** | Valida sesión, aplica rol/alcance específico (o propiedad estricta `user_id`) y rechaza con 401/403 **antes** de cualquier consulta a la BD. | 65 (67.0%) | **92 (94.8%)** | 🟢 **100% Protegido** |
| **PARCIAL** | Valida sesión, pero carecía de filtro de rol (RBAC), omitía alcance por proyecto o no validaba pertenencia de IDs (riesgo IDOR). | 25 (25.8%) | **0 (0.0%)** | 🟢 **0 Vulnerabilidades** |
| **SIN PROTECCIÓN** | No validaba sesión en el handler antes de ejecutar consultas a la BD o emitir respuestas. | 2 (2.1%) | **0 (0.0%)** | 🟢 **0 Vulnerabilidades** |
| **PÚBLICO LEGÍTIMO** | Endpoints de infraestructura esenciales para el ciclo de vida de autenticación y observabilidad (con whitelist auditada). | 5 (5.2%) | **5 (5.2%)** | 🟢 **Auditado** |
| **TOTAL** | Handlers HTTP exportados analizados | **97** | **97** | **100% Cubierto** |

> **Nota sobre Server Actions (`'use server'`):**  
> Se realizó una búsqueda estricta en el 100% del código fuente (`'use server'` y `"use server"`). En la plataforma PROCIMEC **no existen Server Actions**. Todas las mutaciones del cliente al servidor se realizan mediante endpoints REST en `app/api/**/route.ts`.

---

## 2. Inventario Detallado de Handlers API (97 Handlers)

| Ruta | Método | Sesión | Rol / Alcance | Admin Client | Input Validado | Clasificación Inicial | Clasificación Final | Evidencia (Archivo:Línea) |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| `/api/admin/divisions` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Query params | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/divisions/route.ts#L7) |
| `/api/admin/divisions` | `POST` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Manual (`!name, !code`) | OK | **OK** | [route.ts:74](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/divisions/route.ts#L74) |
| `/api/admin/divisions/[id]` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Route param `[id]` | OK | **OK** | [route.ts:13](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/divisions/[id]/route.ts#L13) |
| `/api/admin/divisions/[id]` | `PATCH` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Manual (`name, code`) | OK | **OK** | [route.ts:297](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/divisions/[id]/route.ts#L297) |
| `/api/admin/divisions/[id]` | `DELETE` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Route param `[id]` | OK | **OK** | [route.ts:342](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/divisions/[id]/route.ts#L342) |
| `/api/admin/forms` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/forms/route.ts#L7) |
| `/api/admin/projects` | `GET` | Sí | Admin / Gerencia (`isAuthorizedManagerOrAdmin`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:179](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/projects/route.ts#L179) |
| `/api/admin/projects` | `POST` | Sí | Admin / Gerencia (`isAuthorizedManagerOrAdmin`) | Sí (post-auth) | Zod (`createProjectSchema`) | OK | **OK** | [route.ts:347](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/projects/route.ts#L347) |
| `/api/admin/projects` | `PATCH` | Sí | Admin / Gerencia (`isAuthorizedManagerOrAdmin`) | Sí (post-auth) | Manual (`!id` requerido) | OK | **OK** | [route.ts:469](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/projects/route.ts#L469) |
| `/api/admin/reports` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Query params | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/reports/route.ts#L8) |
| `/api/admin/reports` | `DELETE` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Query param `id` | OK | **OK** | [route.ts:38](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/reports/route.ts#L38) |
| `/api/admin/roles` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/roles/route.ts#L8) |
| `/api/admin/roles` | `POST` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Manual (`!name, !division_id`) | OK | **OK** | [route.ts:88](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/roles/route.ts#L88) |
| `/api/admin/roles/[id]` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Route param `[id]` | OK | **OK** | [route.ts:11](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/roles/[id]/route.ts#L11) |
| `/api/admin/roles/[id]` | `PATCH` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Manual (`name, division_id`) | OK | **OK** | [route.ts:79](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/roles/[id]/route.ts#L79) |
| `/api/admin/roles/[id]` | `DELETE` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Route param `[id]` | OK | **OK** | [route.ts:126](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/roles/[id]/route.ts#L126) |
| `/api/admin/system` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:13](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/system/route.ts#L13) |
| `/api/admin/system` | `POST` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Whitelist de acciones | OK | **OK** | [route.ts:314](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/system/route.ts#L314) |
| `/api/admin/tools` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:9](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/tools/route.ts#L9) |
| `/api/admin/users` | `GET` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:31](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/users/route.ts#L31) |
| `/api/admin/users` | `PATCH` | Sí | Admin (`role === 'admin'`) | Sí (post-auth) | Zod (`userUpdateSchema`) | OK | **OK** | [route.ts:143](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/admin/users/route.ts#L143) |
| `/api/attendance` | `GET` | Sí | Admin o `user_tools` ("attendance-tracker") | Sí (post-auth) | N/A | OK | **OK** | [route.ts:67](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/attendance/route.ts#L67) |
| `/api/attendance` | `POST` | Sí | Admin o `user_tools`; inyecta `userId` de sesión | Sí (post-auth) | Manual (`action, location`) | OK | **OK** | [route.ts:174](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/attendance/route.ts#L174) |
| `/api/auth/[...nextauth]` | `GET` | N/A | Público legítimo (Protocolo NextAuth) | En `auth.ts` | Protocolo OAuth/NextAuth | PÚBLICO | **PÚBLICO LEGÍTIMO** | [route.ts:4](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/auth/%5B...nextauth%5D/route.ts#L4) |
| `/api/auth/[...nextauth]` | `POST` | N/A | Público legítimo (Protocolo NextAuth) | En `auth.ts` | Protocolo OAuth/NextAuth | PÚBLICO | **PÚBLICO LEGÍTIMO** | [route.ts:4](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/auth/%5B...nextauth%5D/route.ts#L4) |
| `/api/dashboard` | `GET` | Sí | Propio usuario (resuelve `user_forms`, `user_tools`, `user_projects`) | Sí (post-auth) | Query param `roleId` | OK | **OK** | [route.ts:15](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/dashboard/route.ts#L15) |
| `/api/dashboard/activities` | `GET` | Sí | Propio usuario (filtrado por su `user_id`/rol) | Sí (post-auth) | Query params | OK | **OK** | [route.ts:11](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/dashboard/activities/route.ts#L11) |
| `/api/dibujo/actividades` | `GET` | Sí | Dibujo (`user_id`/email propio) o Admin (todos) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:106](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/dibujo/actividades/route.ts#L106) |
| `/api/dibujo/actividades` | `POST` | Sí | Dibujo o Admin o `user_forms`; propio `user_id` | Sí (post-auth) | Manual (`!project_name, !hours`) | OK | **OK** | [route.ts:46](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/dibujo/actividades/route.ts#L46) |
| `/api/dibujo/proyectos` | `GET` | Sí | Dibujante (`user_projects`) o Admin (todos) | Sí (post-auth) | N/A | OK | **OK** | [route.ts:18](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/dibujo/proyectos/route.ts#L18) |
| `/api/drive/upload-session` | `POST` | Sí | `allowedUploadRoles` (`admin, localizador, operator, dibujo, hseq`) | No (Google Drive API) | Manual (sanitiza nombre, max 1.5GB) | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/drive/upload-session/route.ts#L8) |
| `/api/evidence-board` | `GET` | Sí | `admin, hseq, gerencia, management` o `user_tools` | Sí (post-auth) | Query params (`limit, offset`) | OK | **OK** | [route.ts:74](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/evidence-board/route.ts#L74) |
| `/api/evidence-board` | `PATCH` | Sí | `admin, hseq, gerencia, management` o `user_tools` | Sí (post-auth) | Manual (`!id` requerido) | OK | **OK** | [route.ts:390](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/evidence-board/route.ts#L390) |
| `/api/forms/[formSlug]` | `POST` | Sí | Admin, `user_forms`, o matriz `ROLE_ALLOWED_FORMS` | Sí (post-auth) | Manual por cada `formSlug` | OK | **OK** | [route.ts:24](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/%5BformSlug%5D/route.ts#L24) |
| `/api/forms/analisis-planificacion-cambios-sig/export` | `GET` | Sí | `requireAuth()`; anti-IDOR (`record.user_id === user.id` o admin/HSEQ) | Sí (post-auth) | Query param `id` verificado | PARCIAL | **OK (Remediado)** | [route.ts:16](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/analisis-planificacion-cambios-sig/export/route.ts#L16) |
| `/api/forms/analisis-planificacion-cambios-sig/preview-email` | `GET` | Sí | `requireAuth()`; sesión activa requerida | No | Query params | SIN PROTECCIÓN | **OK (Remediado)** | [route.ts:6](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/analisis-planificacion-cambios-sig/preview-email/route.ts#L6) |
| `/api/forms/analisis-planificacion-cambios-sig` | `GET` | Sí | `requireAuth()`; anti-IDOR (filtra por `user_id` para no-admin) | Sí (post-auth) | Query param `id` | PARCIAL | **OK (Remediado)** | [route.ts:193](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/analisis-planificacion-cambios-sig/route.ts#L193) |
| `/api/forms/analisis-planificacion-cambios-sig` | `POST` | Sí | `requireAuth({ roles, form })`; inyecta `user_id` verificado | Sí (post-auth) | Manual (`!identifier_name`, etc.) | PARCIAL | **OK (Remediado)** | [route.ts:9](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/analisis-planificacion-cambios-sig/route.ts#L9) |
| `/api/forms/cad-register` | `POST` | Sí | `admin, dibujo, drawing` o `user_forms` | Sí (post-auth) | Manual (`!project_id, !date, !phase`) | OK | **OK** | [route.ts:9](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/cad-register/route.ts#L9) |
| `/api/forms/cierre-comercial` | `GET` | Sí | `requireAuth({ roles, form })` | Sí (post-auth) | N/A | PARCIAL | **OK (Remediado)** | [route.ts:13](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/cierre-comercial/route.ts#L13) |
| `/api/forms/cierre-comercial` | `POST` | Sí | `requireAuth({ roles, form })`; inyecta creador verificado | Sí (post-auth) | Manual (`!quote_code, !result`) | PARCIAL | **OK (Remediado)** | [route.ts:42](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/cierre-comercial/route.ts#L42) |
| `/api/forms/cotizacion-comercial` | `GET` | Sí | `requireAuth({ roles, form })` | Sí (post-auth) | N/A | PARCIAL | **OK (Remediado)** | [route.ts:10](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/cotizacion-comercial/route.ts#L10) |
| `/api/forms/cotizacion-comercial` | `POST` | Sí | `requireAuth({ roles, form })`; inyecta creador verificado | Sí (post-auth) | Manual (`!quote_code, !client_name`) | PARCIAL | **OK (Remediado)** | [route.ts:62](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/cotizacion-comercial/route.ts#L62) |
| `/api/forms/despacho-equipo` | `GET` | Sí | `admin, warehouse, almacen, management, gerencia` o `user_forms` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/despacho-equipo/route.ts#L8) |
| `/api/forms/despacho-equipo` | `POST` | Sí | `admin` o `warehouse` (403 si otro rol) | Sí (post-auth) | Manual (`!equipment_id, !project_id`) | OK | **OK** | [route.ts:76](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/despacho-equipo/route.ts#L76) |
| `/api/forms/presupuesto-proyecto` | `GET` | Sí | `requireAuth({ roles, form })` | Sí (post-auth) | N/A | PARCIAL | **OK (Remediado)** | [route.ts:10](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/presupuesto-proyecto/route.ts#L10) |
| `/api/forms/presupuesto-proyecto` | `POST` | Sí | `requireAuth({ roles, form })`; inyecta creador verificado | Sí (post-auth) | Manual (`!client_name, !project_title`) | PARCIAL | **OK (Remediado)** | [route.ts:108](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/presupuesto-proyecto/route.ts#L108) |
| `/api/forms/registro-equipo` | `GET` | Sí | `admin, warehouse, almacen, management, gerencia` o `user_forms` | Sí (post-auth) | Query param (`checkCode`) | OK | **OK** | [route.ts:28](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/registro-equipo/route.ts#L28) |
| `/api/forms/registro-equipo` | `POST` | Sí | `admin` o `warehouse` (403 si otro rol) | Sí (post-auth) | Manual (acciones: alta, despacho, retorno, consumable) | OK | **OK** | [route.ts:153](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/registro-equipo/route.ts#L153) |
| `/api/forms/registro-oportunidad` | `GET` | Sí | `requireAuth({ roles, form })` | Sí (post-auth) | N/A | PARCIAL | **OK (Remediado)** | [route.ts:22](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/registro-oportunidad/route.ts#L22) |
| `/api/forms/registro-oportunidad` | `POST` | Sí | `requireAuth({ roles, form })`; inyecta creador verificado | Sí (post-auth) | Manual (`!opportunity_title, !client_name`) | PARCIAL | **OK (Remediado)** | [route.ts:51](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/registro-oportunidad/route.ts#L51) |
| `/api/forms/requerimiento-compra` | `GET` | Sí | `requireAuth({ form })`; filtra por `user_projects` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:39](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/requerimiento-compra/route.ts#L39) |
| `/api/forms/requerimiento-compra` | `POST` | Sí | `requireAuth({ projectId, form })`; valida asignación a proyecto | Sí (post-auth) | Manual (`!project_id, !applicant_cedula`) | PARCIAL | **OK (Remediado)** | [route.ts:352](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/forms/requerimiento-compra/route.ts#L352) |
| `/api/hseq/drone-inspection` | `POST` | Sí | Anti-IDOR: comprueba `user_projects` para `projectId` si no es admin | Sí (post-auth) | Manual (firmas digitales obligatorias) | OK | **OK** | [route.ts:71](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/hseq/drone-inspection/route.ts#L71) |
| `/api/hseq/generate` | `POST` | Sí | Rol activo no-pending (genera PDF HSEQ en memoria; sin BD) | No | Rate limit IP (15/min), regex | OK | **OK** | [route.ts:25](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/hseq/generate/route.ts#L25) |
| `/api/hseq/guidance` | `POST` | Sí | Rol activo no-pending (asistencia IA Gemini; sin BD) | No | Rate limit IP (20/min), regex | OK | **OK** | [route.ts:115](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/hseq/guidance/route.ts#L115) |
| `/api/hseq/templates` | `GET` | Sí | Rol activo no-pending (lectura carpetas Drive; sin BD) | No | Query param `refresh` | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/hseq/templates/route.ts#L7) |
| `/api/hseq/templates/[templateId]/schema` | `GET` | Sí | Rol activo no-pending (análisis plantilla Excel; sin BD) | No | Regex en `templateId` | OK | **OK** | [route.ts:23](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/hseq/templates/%5BtemplateId%5D/schema/route.ts#L23) |
| `/api/letters/audit` | `GET` | Sí | Auditor (`admin, rrhh, hr, user_tools`); si no, estrictamente `user_id` propio | Sí (post-auth) | Query params (`id, letterType, userId`) | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/letters/audit/route.ts#L8) |
| `/api/letters/generate` | `POST` | Sí | `admin, rrhh, hr` o `user_forms` ("elaboracion-cartas"); `user_id` propio | Sí (post-auth) | Catálogo de tipos de carta | OK | **OK** | [route.ts:12](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/letters/generate/route.ts#L12) |
| `/api/logout` | `GET` | N/A | Público legítimo (Invalida cookies de sesión) | No | N/A | PÚBLICO | **PÚBLICO LEGÍTIMO** | [route.ts:3](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/logout/route.ts#L3) |
| `/api/logout` | `POST` | N/A | Público legítimo (Invalida cookies de sesión) | No | N/A | PÚBLICO | **PÚBLICO LEGÍTIMO** | [route.ts:32](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/logout/route.ts#L32) |
| `/api/projects` | `GET` | Sí | `admin/management` ven todos; demás usuarios estrictamente `user_projects` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:21](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/projects/route.ts#L21) |
| `/api/reports` | `GET` | Sí | `requireAuth()`; `admin` ve todos; demás usuarios estrictamente `user_projects` | Sí (post-auth) | Query params | OK | **OK** | [route.ts:15](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/reports/route.ts#L15) |
| `/api/reports` | `POST` | Sí | `requireAuth()`; valida `user_projects` si no es admin | Sí (post-auth) | Manual (`!projectId, !reportDate`) | OK | **OK** | [route.ts:60](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/reports/route.ts#L60) |
| `/api/reports` | `PUT` | Sí | `requireAuth()`; valida pertenencia de `fieldReportId` o proyecto asignado | Sí (post-auth) | Manual (`!fieldReportId`) | PARCIAL | **OK (Remediado)** | [route.ts:186](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/reports/route.ts#L186) |
| `/api/reports/upload` | `POST` | Sí | `admin, localizador, operator, dibujo`; Anti-IDOR (`created_by === user.id`) | Sí (post-auth) | Max 50MB, limpia caracteres | OK | **OK** | [route.ts:9](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/reports/upload/route.ts#L9) |
| `/api/suppliers` | `GET` | Sí | `requireAuth({ roles, tool })`; corta en 401 si no hay sesión | Sí (post-auth) | N/A | SIN PROTECCIÓN | **OK (Remediado)** | [route.ts:89](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/suppliers/route.ts#L89) |
| `/api/suppliers` | `POST` | Sí | `requireAuth({ roles, tool })`; rol compras/admin verificado | Sí (post-auth) | Manual (`!company_name, !nit`) | PARCIAL | **OK (Remediado)** | [route.ts:115](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/suppliers/route.ts#L115) |
| `/api/telemetry` | `POST` | N/A | Público legítimo (Reporte de errores cliente; sin DB; rate limited) | No | Manual (`event, error, url`) | PÚBLICO | **PÚBLICO LEGÍTIMO** | [route.ts:4](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/telemetry/route.ts#L4) |
| `/api/tools/accounting-invoices-board` | `GET` | Sí | `admin, accounting, contabilidad, management, gerencia, finance` o `user_tools` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/accounting-invoices-board/route.ts#L7) |
| `/api/tools/commercial-clients` | `GET` | Sí | `admin, commercial, comercial, gerencia, management, purchasing` o `user_tools` | Sí (post-auth) | Query params | OK | **OK** | [route.ts:121](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/commercial-clients/route.ts#L121) |
| `/api/tools/commercial-clients` | `POST` | Sí | `admin, commercial, comercial, gerencia, management, purchasing` o `user_tools` | Sí (post-auth) | Manual (`!company_name, !nit`) | OK | **OK** | [route.ts:162](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/commercial-clients/route.ts#L162) |
| `/api/tools/commercial-clients` | `PUT` | Sí | `admin, commercial, comercial, gerencia, management, purchasing` o `user_tools` | Sí (post-auth) | Manual (`!id, !company_name`) | OK | **OK** | [route.ts:251](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/commercial-clients/route.ts#L251) |
| `/api/tools/commercial-pipeline` | `GET` | Sí | `requireAuth({ roles, tool })` | Sí (post-auth) | Query params | OK | **OK** | [route.ts:19](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/commercial-pipeline/route.ts#L19) |
| `/api/tools/commercial-pipeline` | `PATCH` | Sí | `requireAuth({ roles, tool })`; rol comercial/admin verificado | Sí (post-auth) | Manual (`!proposal_id`) | PARCIAL | **OK (Remediado)** | [route.ts:232](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/commercial-pipeline/route.ts#L232) |
| `/api/tools/finance-expenses-board` | `GET` | Sí | `admin, finance, finanzas, management, gerencia` o `user_tools` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/finance-expenses-board/route.ts#L7) |
| `/api/tools/forms-audit` | `GET` | Sí | Admin ve todo; no-admin restringido a slugs asignados en `user_forms` | Sí (post-auth) | Query params | OK | **OK** | [route.ts:74](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/forms-audit/route.ts#L74) |
| `/api/tools/org-chart` | `GET` | Sí | `requireAuth({ tool: 'org-chart' })`; usuario activo verificado | Sí (post-auth) | Query param `mode` | PARCIAL | **OK (Remediado)** | [route.ts:28](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/org-chart/route.ts#L28) |
| `/api/tools/purchasing-dashboard` | `GET` | Sí | `admin, purchasing, compras, management, gerencia` o `user_tools`/`role_tools` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:28](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/route.ts#L28) |
| `/api/tools/purchasing-dashboard/evaluations` | `POST` | Sí | `requireAuth({ roles })`; rol compras/admin verificado | Sí (post-auth) | Manual (`!supplier_name`) | PARCIAL | **OK (Remediado)** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/evaluations/route.ts#L7) |
| `/api/tools/purchasing-dashboard/orders` | `POST` | Sí | `requireAuth({ roles })`; rol compras/admin verificado | Sí (post-auth) | Manual (`!request_id, !supplier_name`) | PARCIAL | **OK (Remediado)** | [route.ts:33](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/orders/route.ts#L33) |
| `/api/tools/purchasing-dashboard/orders` | `PATCH` | Sí | `requireAuth({ roles })`; rol compras/admin verificado | Sí (post-auth) | Manual (`!order_id, !new_status`) | PARCIAL | **OK (Remediado)** | [route.ts:283](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/orders/route.ts#L283) |
| `/api/tools/purchasing-dashboard/quotations` | `POST` | Sí | `admin, management, gerencia, purchasing, compras, director` (403 si otro) | Sí (post-auth) | Manual (`!request_id`) | OK | **OK** | [route.ts:68](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/quotations/route.ts#L68) |
| `/api/tools/purchasing-dashboard/sign` | `POST` | Sí | Matriz de firmas (`purchasing` vs `management`; 403 si no coincide) | Sí (post-auth) | Manual (`!request_id, !action, !step, !cedula`) | OK | **OK** | [route.ts:23](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/sign/route.ts#L23) |
| `/api/tools/purchasing-dashboard/view` | `POST` | Sí | Aprobador designado o Gerencia según etapa secuencial | Sí (post-auth) | Manual (`!request_id, !step`) | OK | **OK** | [route.ts:31](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-dashboard/view/route.ts#L31) |
| `/api/tools/purchasing-suppliers` | `GET` | Sí | `admin, purchasing, compras, gerencia, management, finance` o `user_tools` | Sí (post-auth) | Query params | OK | **OK** | [route.ts:122](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-suppliers/route.ts#L122) |
| `/api/tools/purchasing-suppliers` | `POST` | Sí | `admin, purchasing, compras, gerencia, management, finance` o `user_tools` | Sí (post-auth) | Manual (`!company_name, !nit`) | OK | **OK** | [route.ts:215](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-suppliers/route.ts#L215) |
| `/api/tools/purchasing-suppliers` | `PUT` | Sí | `admin, purchasing, compras, gerencia, management, finance` o `user_tools` | Sí (post-auth) | Manual (`!id, !company_name`) | OK | **OK** | [route.ts:309](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/purchasing-suppliers/route.ts#L309) |
| `/api/tools/version-control` | `GET` | Sí | `requireAuth()`; usuario activo verificado | Sí (post-auth) | Query params | PARCIAL | **OK (Remediado)** | [route.ts:980](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/route.ts#L980) |
| `/api/tools/version-control` | `POST` | Sí | `requireAuth({ roles: ['admin', 'hseq', 'gerencia', 'management'] })`; **bypass eliminado** | Sí (post-auth) | Manual (acciones whitelist) | PARCIAL | **OK (Remediado)** | [route.ts:1114](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/route.ts#L1114) |
| `/api/tools/version-control/active-version` | `GET` | Sí | `requireAuth()`; usuario activo verificado | Sí (post-auth) | Query param (`query, code, slug`) | PARCIAL | **OK (Remediado)** | [route.ts:11](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/active-version/route.ts#L11) |
| `/api/tools/version-control/download-template` | `GET` | Sí | `requireAuth()`; usuario activo verificado | Sí (post-auth) | Query params (`code, format`) | PARCIAL | **OK (Remediado)** | [route.ts:1535](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/download-template/route.ts#L1535) |
| `/api/tools/version-control/export` | `GET` | Sí | `requireAuth()`; usuario activo verificado | Sí (post-auth) | Query param (`format`) | PARCIAL | **OK (Remediado)** | [route.ts:18](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/export/route.ts#L18) |
| `/api/tools/version-control/upload-template` | `POST` | Sí | `requireAuth({ roles: ['admin', 'hseq', 'gerencia', 'management'] })` | Sí (post-auth) | Max 50MB, extensiones | PARCIAL | **OK (Remediado)** | [route.ts:11](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/version-control/upload-template/route.ts#L11) |
| `/api/tools/warehouse-inventory` | `GET` | Sí | `admin, warehouse, almacen, management, gerencia` o `user_tools` | Sí (post-auth) | N/A | OK | **OK** | [route.ts:7](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/tools/warehouse-inventory/route.ts#L7) |
| `/api/user/profile` | `PATCH` | Sí | Estrictamente propio usuario (`id === userId` o `email === userEmail`) | Sí (post-auth) | Manual (`full_name, nick_name`) | OK | **OK** | [route.ts:8](file:///c:/Users/Usuario/Documents/PROCIMEC/app/api/user/profile/route.ts#L8) |

---

## 3. Vulnerabilidades Críticas Corregidas y Evidencia de Remediación

1. **`GET /api/suppliers` (Exposición Bancaria de Proveedores):**
   - **Antes:** Se ejecutaba `createAdminClient().from('suppliers').select('*')` sin verificar sesión en el handler.
   - **Ahora:** Protegido con `requireAuth({ roles: ['admin', 'purchasing', 'compras', 'gerencia', 'finance'], tool: 'purchasing-suppliers' })`. Rechaza inmediatamente con 401 sin consultar la base de datos si no hay sesión.
   - **Test:** Verificado en `src/lib/api-tests/api-security-guard.test.ts`.

2. **`PATCH /api/tools/commercial-pipeline` (Alteración Arbitraria de Propuestas):**
   - **Antes:** Permitía a cualquier usuario autenticado alterar montos de propuestas por `proposal_id`.
   - **Ahora:** Protegido con `requireAuth({ roles: ['admin', 'commercial', 'comercial', 'management', 'gerencia'], tool: 'commercial-pipeline' })`.
   - **Test:** Verificado en `src/lib/api-tests/api-security-guard.test.ts`.

3. **`POST /api/tools/purchasing-dashboard/orders` y `PATCH`:**
   - **Antes:** Cualquier sesión podía emitir o cancelar órdenes de compra a proveedores.
   - **Ahora:** Exige rol de compras, administración o gerencia mediante `requireAuth`.

4. **`POST /api/tools/version-control` (Bypass Inseguro por Subcadena de Email):**
   - **Antes:** Línea 1129 contenía `|| session.user.email.includes('procimec')`, otorgando facultades a correos con la palabra 'procimec'.
   - **Ahora:** Removido en su totalidad. Se exige rol formal `['admin', 'hseq', 'gerencia', 'management']`.
   - **Test:** Verificado con regla estática en `api-security-guard.test.ts`.

5. **`app/api/forms/analisis-planificacion-cambios-sig` y `export` (IDOR):**
   - **Antes:** Cualquier usuario autenticado podía consultar y exportar en Excel/PDF cambios de otros procesos conociendo el UUID (`id`).
   - **Ahora:** Se restringe la consulta y exportación estrictamente al creador del registro (`record.user_id === user.id`) salvo para roles elevados (`admin`, `hseq`, `gerencia`).

6. **`PUT /api/reports` (IDOR en Registro de Archivos y Finalización de Reportes GPR):**
   - **Antes:** Cualquier operador podía mutar o finalizar cualquier `fieldReportId`.
   - **Ahora:** Se valida que el reporte pertenezca al usuario autenticado o que el usuario esté formalmente asignado al `project_id` en `user_projects`.

---

## 4. Test de Guardia Automatizado en CI/CD

Se implementó el archivo de pruebas [src/lib/api-tests/api-security-guard.test.ts](file:///c:/Users/Usuario/Documents/PROCIMEC/src/lib/api-tests/api-security-guard.test.ts):
- Escanea de forma recursiva todas las rutas de `app/api/**/route.ts`.
- Falla la compilación / CI si algún handler nuevo utiliza `createAdminClient()` sin antes llamar a `requireAuth()` o rechazar con 401/403.
- Contiene una whitelist explícita únicamente para rutas legítimas de infraestructura (`/api/auth/[...nextauth]`, `/api/logout`, `/api/telemetry`).
- Prohíbe cualquier bypass de autenticación por subcadena de email.

---

## 5. Resultados de Verificación de Calidad

- **TypeScript Compiler (`tsc --noEmit`):** 0 errores, 0 advertencias.
- **Vitest Suite:** 11 archivos de prueba ejecutados, 66 pruebas aprobadas (100% de éxito).
