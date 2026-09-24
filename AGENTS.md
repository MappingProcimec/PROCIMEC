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

## 4. Identidad Visual y Sistema de Diseño (Industrial Precision)
- **Paleta Oficial del Logo:** Los colores corporativos se basan estrictamente en el logotipo (`public/logo.png`): Primario en **Carbón Técnico (`#1E2229`)** y Acento en **Ámbar Geofísico de Radar (`#EAA023`)**. Prohibido usar azules arbitrarios o gradientes genéricos.
- **Directrices Anti-Slop:**
  - **Zero-Emoji:** Prohibido el uso de emojis en interfaces y componentes; utilizar exclusivamente iconos vectoriales de Lucide React (`strokeWidth={1.75}`).
  - **Microinteracciones y Física:** Botones con `:active:scale-[0.98]` y transición de 160ms (`cubic-bezier(0.23, 1, 0.32, 1)`). Prohibido animar desde `scale(0)` o usar `ease-in`.
  - **Tipografía Bimodal:** Inter para UI general y `JetBrains Mono` para coordenadas UTM, GHz, horas, códigos y metadatos.
  - **Mobile:** Contenedores con `min-h-[100dvh]` (nunca `h-screen`) y targets táctiles de mínimo `44x44px`.

## 5. Estándares de Rendimiento y Algoritmia
- **Indexación O(1):** Prohibido cruces de colecciones anidados O(N * M); indexar con `Map` (`indexBy`, `groupBy` en `@/lib/indexing`).
- **I/O Asíncrono Concurrente:** Evitar waterfalls; usar `Promise.allSettled` para llamadas a red independientes.
- **Consultas Acotadas:** Límites y proyecciones estrictas en Supabase para evitar transferencias no acotadas.

## 6. Ley de Construcción Modular por Capas (Roles, Formularios y Herramientas)
- **Principio de Aislamiento Secuencial (Cero Cambios Masivos):** Queda estrictamente prohibido intentar implementar múltiples roles, tablas de datos, herramientas y formularios de golpe. Toda nueva capacidad funcional debe construirse obligatoriamente en 3 capas secuenciales:
  1. **Capa 1 (Rol Base):** Habilitar identificador en `users.role` (PostgreSQL `CHECK`), insertar el rol en la tabla `roles` con su nombre formal en español, tipar en TypeScript (`Role`), habilitar en `/admin/users` y crear su ruta de aterrizaje y pantalla de bienvenida. Debe validarse el inicio de sesión y la asignación antes de avanzar.
  2. **Capa 2 (Formularios Operacionales del Rol - Captura de Información):** Diseñar las tablas de almacenamiento en Supabase, los formatos de captura en el catálogo `forms` con esquemas y validaciones Zod, vincularlos vía `role_forms` y verificar que aparezcan en "Mis Formularios". Los formularios recopilan y estructuran la información inicial requerida por el negocio.
  3. **Capa 3 (Herramientas Técnicas del Rol - Consolidación y Gestión):** Diseñar las herramientas de consulta, métricas, trazabilidad y administración que procesan la información recopilada por los formularios, registrarlas en el catálogo `tools`, vincularlas vía `role_tools` y verificar que aparezcan en "Mis Herramientas".
- **Convención Dual de Identidad:**
  - Código, URLs y base de datos relacional: Identificador canónico en minúsculas en inglés (`warehouse`, `purchasing`, `commercial`, `finance`, `accounting`, `management`, `operator`, `drawing`, `hseq`, `hr`, `admin`).
  - Tabla `roles` e interfaz visual: Nombre formal en español (`Almacén`, `Compras`, `Comercial`, `Finanzas`, `Contabilidad`, `Gerencia`).
- **Validación Obligatoria:** Ningún agente o desarrollador puede avanzar a la siguiente capa ni al siguiente rol sin visto bueno explícito del usuario en el entorno de despliegue.

Para especificaciones completas, consultar [PRODUCT.md](PRODUCT.md), [.agents/rules/procimec_design_system.md](.agents/rules/procimec_design_system.md), [.agents/rules/procimec_architecture.md](.agents/rules/procimec_architecture.md) y [.agents/rules/procimec_performance.md](.agents/rules/procimec_performance.md).


