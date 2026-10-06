# CONSTITUCIÓN DE DESARROLLO PROCIMEC (AGENTS.md)

Este repositorio contiene la plataforma empresarial **PROCIMEC** (Next.js 14, Supabase PostgreSQL, WhatsApp Bot con Baileys y Google Gemini AI).

Todo agente de Inteligencia Artificial y desarrollador que opere en este workspace debe acatar estrictamente las **16 Leyes Fundamentales de Desarrollo de Software, Arquitectura y Operación**. Estas leyes regulan con rigor **CÓMO se programa, modela, diseña, prueba y despliega** el código del sistema:

---

## 📜 LEY 1: Disciplina de Entorno, Git y Despliegue Continuo (CI/CD sin Servidores Locales)
- **NO LEVANTAR SERVIDORES LOCALES:** Queda estrictamente prohibido ejecutar `npm run dev`, `npm start`, o servidores en segundo plano a menos que el usuario lo solicite explícita y textualmente. Las comprobaciones deben realizarse mediante análisis estático (`tsc --noEmit`, linters o compilación controlada).
- **NO ABRIR NAVEGADORES:** Prohibido iniciar subagentes de navegador o abrir instancias de Chrome/Edge sin instrucción textual del usuario.
- **PUSH AUTOMÁTICO A GITHUB:** Tras realizar cambios funcionales en el código, realizar commit descriptivo y ejecutar `git push origin main` inmediatamente (salvo instrucción expresa en contra).
- **EXCLUSIÓN PERMANENTE DE BOT-WHATSAPP:** La carpeta `bot-whatsapp/` (tokens criptográficos de sesión, claves de API, archivos `.env`) debe permanecer siempre fuera del repositorio en `.gitignore`.

---

## 📜 LEY 2: Arquitectura de Persistencia e Integridad Referencial Estricta (PostgreSQL / Supabase)
- **Estructura Estándar de Tablas de Operación:** Toda tabla de almacenamiento de operaciones o reportes debe poseer obligatoriamente:
  ```sql
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),  -- Integridad referencial: NUNCA texto libre
  user_id     UUID NOT NULL REFERENCES users(id),     -- Vínculo estricto al colaborador autenticado
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Marca de tiempo inmutable de auditoría
  status      TEXT NOT NULL DEFAULT 'submitted'       -- Flujo de estados ('draft', 'submitted', 'reviewed')
  ```
- **Restricciones Duras a Nivel de Motor:** Los campos con opciones fijas deben poseer `CHECK (columna IN ('A', 'B'))` en PostgreSQL.
- **Valores Predeterminados en Motor:** Las columnas con métricas estándar deben tener `DEFAULT` formal en base de datos.

---

## 📜 LEY 3: Normalización y Resolución Canónica en Entrada de Datos
- **Filtro Canónico Pre-Persistencia:** El backend jamás debe insertar texto informal o no validado del usuario.
- **Resolución Estricta contra Relaciones Activas:** Las entradas de proyecto se normalizan y comparan contra los proyectos activos asignados al usuario en `user_projects`. Se persiste exclusivamente el UUID oficial o el nombre oficial de la base de datos. Si no coincide, la operación se rechaza.
- **Inyección Segura de Identidad:** Campos de auditoría (`responsible`, `created_by`, `operator_name`) se resuelven obligatoriamente desde la sesión autenticada (`user.email`, `user.id`, `user.full_name`), jamás desde campos editables por el cliente.

---

## 📜 LEY 4: Estándares de Construcción UI/UX, Accesibilidad Fotométrica y Anti-Slop (PCM CLOUD)
Toda interfaz, formulario, herramienta y componente del ecosistema está regulado por esta ley:
- **Identidad Corporativa Dual (PROCIMEC & PCM CLOUD):**
  - Nombre Oficial: **PROCIMEC** (Mapping Ingeniería).
  - Plataforma de Servicios Cloud: **PCM CLOUD**.
  - Logotipo Institucional: Basado en `public/logo.png` (renderizado con `unoptimized` y fallback a `CORPORATE_LOGO_BASE64`).
- **Paleta Oficial Sagrada (Cero Azules Genéricos ni Degradados de Plantilla):**
  - **Carbón Técnico:** `#1E2229` (Fondo primario, superficies de alto contraste y solidez de ingeniería).
  - **Ámbar Geofísico de Radar:** `#EAA023` (Color exclusivo de acento, estados activos, enfoque y ondas de antena).
  - **Grafito de Precisión:** `#2A303C` / `#15181D` (Bordes técnicos y contenedores secundarios).
- **Ley Suprema de Contraste Cromático de Botones e Interactivos (WCAG AA/AAA):**
  - **Regla Sagrada del Ámbar y Warning (`#EAA023` / `#F59E0B` / `bg-accent` / `bg-amber-*`):**
    - **PROHIBIDO TERMINANTEMENTE EL USO DE `text-white`** sobre fondos o botones ámbar, dorados o de advertencia (contraste inaceptable de 2.18:1).
    - Es **ESTRICTAMENTE OBLIGATORIO** utilizar tipografía en carbón profundo de alto contraste: `text-primary-900 font-bold` (ratio superior a 7.38:1, WCAG AAA).
  - **Botones sobre Superficies Claras (`bg-white` / `bg-surface` / `bg-card`):**
    - Emplear texto e iconos oscuros (`text-primary-900` / `text-text-primary`) con bordes técnicos definidos (`border border-border`). Prohibido fijar texto o iconos blancos sobre fondos claros.
  - **Botones en Hero Oscuro (`page-hero`):**
    - El botón de llamada a la acción principal (CTA) debe ser `.btn-accent` (ámbar con texto carbón en negrita) para máximo realce y contraste luminoso.
- **Ley de Cero Spam Visual (Anti-Visual Clutter):**
  - Prohibido saturar barras de navegación o encabezados con contadores ruidosos (e.g. `16 Formularios registrados`, `14 Herramientas activas`).
  - Prohibido colocar píldoras o badges decorativos superfluos sobre los títulos (e.g. `[FORMULARIO OPERATIVO]`, `[Catálogo: slug]`).
  - **Hero Sobrio Canónico:** Todo formulario o herramienta inicia únicamente con:
    1. `<BackButton href="/dashboard" label="Volver a Mi Panel" />`
    2. Título formal `h1` con icono Lucide (`className="w-7 h-7 text-accent" strokeWidth={1.75}`)
    3. Descripción concisa de una sola línea (`text-white/70 text-sm mt-1`).
- **Ergonomía de Formularios Industriales:**
  - **Rejilla en 2 Columnas (`sm:grid-cols-2`):** Erradica scroll vertical excesivo; agrupa campos de manera densa y balanceada.
  - **Selectores de Puntuación (1 a 5):** Botones pastilla compactos en carbón con borde técnico y aro ámbar al estar seleccionados (`ring-1 ring-accent bg-accent/15`).
  - **Monedas y Códigos:** Moneda prefijada (`$ COP`) y valores numéricos estrictamente en `font-mono`.
- **Zero-Emoji Policy (Estricto):**
  - Prohibido el uso de emojis en interfaces, menús, botones, tablas y badges; utilizar exclusivamente iconos vectoriales de Lucide React (`strokeWidth={1.75}`).
- **Tipografía Bimodal:**
  - `Inter` para textos de interfaz, etiquetas de campo y botones.
  - `JetBrains Mono` (`font-mono`) obligatorio para coordenadas UTM, frecuencias (GHz/MHz), horas trabajadas, UUIDs, códigos de proyecto y valores monetarios.
- **Microinteracciones Físicas y Mobile-First:**
  - Botones con `:active:scale-[0.98]` y transición de 160ms (`cubic-bezier(0.23, 1, 0.32, 1)`). Prohibido animar desde `scale(0)` o usar `ease-in`.
  - Contenedores principales con `min-h-[100dvh]` (nunca `h-screen`) y touch targets mínimos de `44x44px`.

---

## 📜 LEY 5: Estándares de Rendimiento Algorítmico y Eficiencia de I/O
- **Indexación O(1) Mandatoria:** Prohibido anidamiento $O(N \times M)$ mediante `.find()` o `.filter()` dentro de bucles. Indexar colecciones previas en memoria mediante `Map` (`indexBy`, `groupBy` en `@/lib/indexing`).
- **I/O Asíncrono Concurrente:** Prohibido el waterfall secuencial de red en llamadas independientes; usar `Promise.allSettled()` o `Promise.all()`.
- **Consultas Acotadas a Base de Datos:** Límites y proyecciones estrictas en Supabase (`limit(50)` o paginación por cursor). Prohibido `select('*')` en tablas con binarios, firmas en base64 o JSONs voluminosos.

---

## 📜 LEY 6: Arquitectura Modular Secuencial en 3 Capas (Roles -> Inputs -> Manejo)
- **Principio de Hub Centralizado Único (`/dashboard`):** Queda estrictamente prohibido crear páginas o sub-rutas dedicadas por rol (como `/warehouse`, `/purchasing`, `/commercial`, etc.). Todos los colaboradores operan de manera unificada a través de `/dashboard` ("Mi Panel"), el cual renderiza dinámicamente "Mis Formularios" y "Mis Herramientas".
- **Principio de Aislamiento Secuencial en 3 Capas:**
  1. **Capa 1 (Rol Base):** Habilitar identificador en `users.role` (PostgreSQL `CHECK`), insertar el rol en la tabla `roles` con su nombre formal en español, tipar en TypeScript (`Role`) y habilitar en `/admin/users`. El usuario aterriza directamente en `/dashboard`.
  2. **Capa 2 (Formularios Operacionales del Rol - Inputs de Captura):** Los formularios son **estrictamente INPUTS**. Su única función es captar información operativa primaria (formatos de entrada, inspecciones, checklists, firmas y novedades). Diseñar tablas, esquemas Zod y vincular vía `role_forms`.
  3. **Capa 3 (Herramientas Técnicas del Rol - Manejo y Consolidación de Inputs):** Las herramientas son **el manejo, análisis y procesamiento de esos inputs** (kárdex, tableros de productividad, visores, módulos analíticos). Vincular vía `role_tools`. Prohibido crear herramientas para captar datos primarios.
- **Prohibición de Atajos Cruzados Form <-> Tool:**
  - Prohibido enlazar directamente un Formulario a una Herramienta o viceversa.
  - Todo flujo de retorno debe dirigirse a `/dashboard` mediante `<BackButton href="/dashboard" label="Volver a Mi Panel" />`.

---

## 📜 LEY 7: Dualidad Idiomática en Código (Frontend 100% Español | Backend 100% Inglés Canónico)
- **Frontend Estrictamente en Español (100% User-Facing):**
  - Todo elemento visible para el usuario final (títulos, encabezados, botones, etiquetas, placeholders, validaciones, toasts, modales, alertas, badges y opciones `<select>`) **DEBE ESTAR RIGUROSAMENTE EN ESPAÑOL**.
- **Backend, Supabase y Base de Datos en Inglés Canónico:**
  - Nombres de tablas (`users`, `roles`, `projects`, `forms`, `tools`, `field_reports`), columnas (`id`, `user_id`, `project_id`, `status`, `cost_center`), identificadores de rol en código (`admin`, `operator`, `warehouse`, `purchasing`, `commercial`, `finance`, `accounting`, `management`, `drawing`, `hseq`, `hr`), endpoints API y claves de estado permanecen inmutables en inglés.
- **Capa de Mapeo Desacoplada:** La traducción visual se gestiona en diccionarios y componentes de presentación, jamás alterando el esquema de base de datos.

---

## 📜 LEY 8: Espejo Fiel en Generación Documental (PDF = Espejo Fiel del Excel Oficial)
- **Prohibición de Formatos Libres o Inventados:** Queda estrictamente prohibido diseñar PDFs con distribuciones abstractas que no coincidan con la plantilla oficial de la empresa.
- **Réplica Fiel de la Plantilla Viva de Excel (.xlsx):**
  1. **Orientación de Página:** Mantener la orientación oficial (`landscape` o `portrait`).
  2. **Paleta y Franjas Institucionales:** Reproducir franjas doradas/ámbar de sección (`#FFC000`), subfranjas grises (`#D8D8D8`) y fondos neutros.
  3. **Cuadrícula y Bordes:** Mantener bordes finos negros (`#000000`) respetando columnas y proporciones.
  4. **Inyección Dinámica con Herencia de Formato:** Nuevas filas dinámicas en tablas deben heredar al 100% fuentes (Arial), alineación (`vertical: middle`, `wrapText: true`), alturas de fila y bordes de la fila modelo original.
  5. **Firmas Digitales Estampadas:** Toda firma digital debe estamparse dentro de su celda oficial designada.
  6. **Casillas de Verificación:** Marcas canónicas `[X]` / `[ ]` en sus columnas exactas.

---

## 📜 LEY 9: Máquinas de Estados y Gobernanza de Permisos en Flujos de Firma y Aprobación (RBAC Workflows)
- **Prohibición de Descarga Prematura:** Ningún formulario que represente una solicitud, orden o requerimiento oficial puede permitir la descarga de PDF en estado borrador (`draft`) o antes de su primer envío formal. La descarga solo se habilita tras su radicación y con su consecutivo oficial.
- **Separación Inquebrantable entre "Visto" y "Firma":**
  - La acción de visualizar un detalle o solicitud solo estampa `viewed_at` y `viewed_by` como metadatos de auditoría.
  - El estado de aprobación del flujo solo muta cuando el usuario legalmente facultado estampa su firma digital.
- **Cronología Lógica Estricta:** La hora de visualización de una fase debe preceder o coincidir con la firma (`viewed_at <= signed_at`).
- **Gobernanza de Roles en Botones Interactivos:** Ningún botón de acción (firmar, aprobar, cotizar, rechazar) puede habilitarse si el rol del usuario autenticado no coincide estrictamente con la autoridad requerida en esa fase del flujo.

---

## 📜 LEY 10: Gobernanza de Migraciones y Compatibilidad Retroactiva en Base de Datos (Zero-Downtime Schemas)
- **Idempotencia Obligatoria:** Todo script SQL generado para Supabase debe ser 100% idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, verificaciones con bloques anónimos `DO $$`).
- **Prohibición de Cambios Destructivos en Caliente:** Jamás eliminar o renombrar columnas o tablas en producción de forma abrupta. Cualquier evolución de esquema (ej. sustitución de identificadores) debe realizarse en fases de transición (adición de columna, migración de datos y vistas de compatibilidad) para evitar la rotura de versiones en ejecución.
- **Declaración Explícita de Migración:** Todo cambio en el código que requiera modificaciones en Supabase debe acompañarse obligatoriamente del bloque SQL exacto y un aviso explícito para el administrador antes de dar por cerrada la tarea.

---

## 📜 LEY 11: Desacoplamiento de I/O para Archivos Masivos y Protocolos de Notificación
- **Prohibición de Adjuntos Pesados en Correos:** Ninguna notificación transaccional por correo SMTP puede adjuntar archivos que superen los **15MB** (para evitar rebotes y bloqueos en pasarelas de correo).
- **Subida Desacoplada a Storage:** Los archivos masivos de campo (radargramas, ortofotos, archivos vectoriales CAD, fotografías de obra) deben subirse mediante URLs firmadas directas a Supabase Storage o Google Drive, desacopladas de la petición transaccional del formulario.
- **Notificación por Enlaces Seguros:** Los correos de notificación hacia dirección de obra o clientes solo deben transportar enlaces seguros, autenticados y con caducidad para la descarga directa desde el almacenamiento en la nube.

---

## 📜 LEY 12: Arquitectura de Hub Centralizado de Navegación y Jerarquía de Vistas
- **Jerarquía Visual Sagrada en `/dashboard`:** La vista principal de operaciones posee un orden estructural inalterable:
  1. **Saludo Humanizado Personalizado:** `Hola [frase aleatoria operativa], [Nick/Nombre]` en carbón y ámbar.
  2. **Bloque 1 — Mis Formularios:** Agrupados por categorías operacionales con iconos Lucide y secciones desplegables.
  3. **Bloque 2 — Mis Herramientas:** Agrupadas con idéntico estándar visual y funcional.
  4. **Bloque 3 — Actividades Recientes:** Listado de auditoría acotado a un límite estricto de 100 registros con filtros instantáneos.
- **Precedencia Estricta de Permisos de Usuario sobre Roles:** Las asignaciones específicas en `user_forms` o `user_tools` tienen prioridad sobre las de rol (`role_forms` / `role_tools`). Si a un usuario se le revoca una herramienta o formulario puntual en su configuración, la vista no debe renderizarlo.
- **Cierre de Sesión Limpio:** El flujo de cierre de sesión debe invalidar cookies, limpiar tokens de almacenamiento local y redirigir limpiamente a la raíz `/login` o `/` sin recargas cíclicas.

---

## 📜 LEY 13: Blindaje Criptográfico y Validación Biométrica/Telefónica en Integraciones Omnicanal (Bots)
- **Autenticación Estricta por Número E.164:** En bots conversacionales (WhatsApp con Baileys), la autorización y asignación de formularios se realiza exclusivamente mediante el número telefónico verificado contra la columna `users.phone`. Prohibido utilizar el nombre visible de WhatsApp (`pushName`) como credencial de autorización.
- **Catálogo Espejo Guiado por Esquemas:** El bot no posee formularios cableados en código fuente; consume directamente la definición en formato JSONB de la tabla `forms` en Supabase.
- **Aislamiento Total de Secretos:** Credenciales criptográficas, tokens de sesión y claves de API del bot deben permanecer permanentemente fuera del control de versiones.

---

## 📜 LEY 14: Automatización de Alertas Preventivas y Normalización Institucional
- **Razón Social Canónica:** La denominación legal oficial de la entidad en correos, pies de firma, contratos y reportes descargables es estrictamente:
  **PROCIMEC INGENIERÍA S.A.S.**
- **Ventana de Alertas Preventivas HSEQ/Operaciones:** Todo formulario o módulo que registre fechas de vencimiento legal o metrológico (SOAT, tecnicomecánica, licencias operativas, calibraciones) debe incluir lógica automática para disparar notificaciones de alerta preventiva en la ventana de **60 a 1 día previo al vencimiento**.
- **Emisión Segura de Correo:** Todo correo saliente debe generarse bajo la plantilla visual corporativa sobria de la compañía y utilizar variables de entorno autenticadas (`GMAIL_USER`).

---

## 📜 LEY 15: Higiene de Código, Prevención de Rutas Huérfanas y Compilación Cero-Errores (Clean Build & CI/CD)
- **Prohibición de Código y Rutas Huérfanas:** Al consolidar, renombrar o deprecar rutas (ej. eliminación de subpaneles obsoletos), deben removerse todas las referencias residuales en enlaces de navegación, botones y componentes. Prohibido dejar rutas muertas o enlaces rotos.
- **Compilación Limpia Pre-Push:** Antes de realizar el commit y push automático a `main`, el código debe compilar limpiamente sin variables sin usar (`no-unused-vars`), sin tipos `any` inseguros y sin advertencias que incrementen tiempos de compilación en Vercel.
- **Optimización de Paquetes:** Importar exclusivamente submódulos específicos de librerías para evitar sobrecargar los bundles de cliente.

---

## 📜 LEY 16: Eficiencia de Cómputo Serverless y Gobernanza de Cuotas Cloud (Vercel & Supabase Free Tier)
Todo desarrollo, refactorización y adición de módulos debe ser fotométricamente eficiente en cómputo para operar sin costos ni riesgos de corte en los planes gratuitos de Vercel (Hobby: 4h Fluid Active CPU) y Supabase (Free: 500MB DB / 1GB Storage / 5GB Egress):
- **Cero Agregación Masiva en Serverless Functions:** Queda estrictamente prohibido realizar bucles iterativos (`while`, `for`, `.reduce()`) en Node.js sobre colecciones masivas de base de datos para calcular totales, horas o métricas. Toda agregación estadística debe resolverse dentro del motor PostgreSQL mediante funciones RPC (`SECURITY DEFINER`) o consultas agregadas directas (`SUM()`, `COUNT()`).
- **Disciplina Estricta en React Query / SWR:**
  - **Prohibido `staleTime: 0` indiscriminado:** Toda consulta reactiva debe tener un `staleTime` mínimo de 60 segundos (`staleTime: 60 * 1000`) a menos que sea un flujo transaccional crítico.
  - **Desactivación de `refetchOnWindowFocus`:** Salvo justificación explícita de seguridad, `refetchOnWindowFocus` debe estar en `false` para erradicar llamadas fantasma cada vez que el usuario cambia de ventana o pestaña.
  - **Prohibido Polling Ciego en Segundo Plano:** Prohibido implementar `refetchInterval` menores a 60 segundos sin `refetchIntervalInBackground: false`. Si una vista cuenta con suscripción vía Supabase Realtime (WebSockets), el polling por intervalo queda totalmente prohibido.
- **Prefetching Quirúrgico en Enlaces (`next/link`):**
  - En dashboards, modales y cuadrículas con alta densidad de enlaces, es obligatorio usar `<Link prefetch={false}>` para evitar que Next.js dispare decenas de peticiones de pre-renderizado y ejecuciones innecesarias del Middleware.
- **Blindaje de Almacenamiento y Egress en Supabase:**
  - **Prohibido Guardar Archivos o Imágenes en Base64 en Columnas de Texto:** La base de datos es exclusivamente para datos estructurados. Toda imagen o archivo debe subirse a Supabase Storage o Google Drive y persistirse únicamente como URL string.
  - **Compresión Pre-Subida en Cliente:** Todo módulo de captura de fotografías (evidencias HSEQ, almacén, firmas) debe comprimir las imágenes en el cliente (formato WebP o JPEG con compresión) antes de subirlas al bucket.

---

Para especificaciones detalladas de interfaz y rendimiento, consultar:
- [procimec_design_system.md](file:///.agents/rules/procimec_design_system.md)
- [procimec_architecture.md](file:///.agents/rules/procimec_architecture.md)
- [procimec_performance.md](file:///.agents/rules/procimec_performance.md)
- [PRODUCT.md](file:///PRODUCT.md)
