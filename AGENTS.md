# CONSTITUCIÓN DE DESARROLLO PROCIMEC (AGENTS.md)

Este repositorio contiene la plataforma empresarial **PROCIMEC** (Next.js 14, Supabase PostgreSQL, WhatsApp Bot con Baileys y Google Gemini AI).

Todo agente de Inteligencia Artificial y desarrollador que opere en este workspace debe acatar estrictamente las **8 Leyes Fundamentales de Desarrollo de Software, Arquitectura y Operación**. Estas leyes regulan con rigor **CÓMO se programa, modela, diseña, prueba y despliega** el código del sistema:

---

## 📜 LEY 1: Disciplina de Entorno, CI/CD y Calidad de Código (Clean Build & Push)
*(Consolida reglas operativas de entorno, git, higiene y compilación)*
- **Cero Servidores Locales ni Navegadores:** Queda estrictamente prohibido ejecutar `npm run dev`, `npm start` o levantar servidores en segundo plano a menos que el usuario lo solicite explícita y textualmente. Prohibido abrir subagentes de navegador o navegadores automatizados sin orden expresa. Comprobación obligatoria mediante análisis estático (`tsc --noEmit`).
- **Compilación Cero-Errores Pre-Push:** Antes de cualquier commit, el código debe compilar limpiamente sin variables sin usar (`no-unused-vars`), sin tipos `any` inseguros y sin advertencias.
- **Push Automático a GitHub:** Tras realizar cambios funcionales validados, realizar commit descriptivo y ejecutar `git push origin main` de inmediato (salvo orden expresa en contra).
- **Aislamiento Criptográfico de Bots:** La carpeta `bot-whatsapp/` (claves de API, credenciales, `.env`, tokens criptográficos de Baileys) debe permanecer permanentemente excluida en `.gitignore` y jamás tocar el control de versiones.
- **Prohibición de Rutas y Código Huérfano:** Al consolidar o deprecar módulos, remover todas las referencias residuales en menús, botones y componentes. Optimizar bundles importando submódulos específicos.

---

## 📜 LEY 2: Persistencia, Integridad Relacional y Gobernanza de Base de Datos (PostgreSQL / Supabase)
*(Consolida arquitectura de tablas, claves foráneas y migraciones sin caída)*
- **Estructura Estándar de Tablas de Operación:** Toda tabla de reportes u operaciones debe poseer obligatoriamente:
  ```sql
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),  -- Integridad referencial: NUNCA texto libre
  user_id     UUID NOT NULL REFERENCES users(id),     -- Vínculo estricto al colaborador autenticado
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Marca de tiempo inmutable de auditoría
  status      TEXT NOT NULL DEFAULT 'submitted'       -- Flujo de estados ('draft', 'submitted', 'reviewed')
  ```
- **Restricciones Duras y Valores por Defecto:** Opciones fijas con `CHECK (columna IN ('A', 'B'))` y métricas con `DEFAULT` formal a nivel de motor PostgreSQL.
- **Idempotencia Estricta de Migraciones (Zero-Downtime):** Todo script SQL en `supabase/migrations/` debe ser 100% idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, bloques `DO $$`).
- **Cero Cambios Destructivos en Caliente:** Jamás borrar ni renombrar columnas o tablas en producción abruptamente. Realizar transiciones compatibles y declarar explícitamente el bloque SQL al administrador antes de cerrar tareas.

---

## 📜 LEY 3: Seguridad, Gobernanza RBAC, Workflows de Firma y Omnicanalidad
*(Consolida validación de entradas, firmas digitales y control en bots)*
- **Filtro Canónico e Inyección Segura de Identidad:** El backend jamás inserta texto libre no validado. Campos de autoría (`responsible`, `created_by`, `operator_name`) se resuelven exclusivamente desde la sesión autenticada (`user.id`, `user.email`), nunca desde payloads editables por el cliente. Entradas de proyectos se normalizan contra `user_projects`.
- **Máquinas de Estados y Gobernanza en Botones:**
  - **Prohibida la descarga prematura:** Ningún PDF oficial se descarga en estado borrador (`draft`) o sin consecutivo formal.
  - **Separación inquebrantable entre "Visto" y "Firma":** La visualización solo estampa `viewed_at` y `viewed_by`; el estado de aprobación muta únicamente al estampar la firma legal. La cronología debe cumplir `viewed_at <= signed_at`.
  - Botones de acción (aprobar, firmar, cotizar) deshabilitados si el rol autenticado no coincide con la autoridad requerida.
- **Blindaje Omnicanal (WhatsApp Bot):** Autenticación y asignación de formularios guiada rigurosamente por el número en formato E.164 (`users.phone`), nunca por `pushName`. Consumo guiado por esquemas JSONB dinámicos de la tabla `forms`.

---

## 📜 LEY 4: Arquitectura de Navegación, Hub Centralizado y Secuencia en 3 Capas
*(Consolida estructura de vistas, Mi Panel y jerarquía modular)*
- **Principio de Hub Centralizado Único (`/dashboard`):** Prohibido crear subrutas o paneles separados por rol (`/warehouse`, `/purchasing`, etc.). Todos los colaboradores operan desde `/dashboard` ("Mi Panel"), el cual renderiza dinámicamente formularios y herramientas según permisos.
- **Jerarquía Visual Sagrada en `/dashboard`:**
  1. **Saludo Humanizado Personalizado:** `Hola [frase aleatoria operativa], [Nick/Nombre]` en carbón y ámbar.
  2. **Bloque 1 — Mis Formularios:** Agrupados por categorías con iconos Lucide y modales/desplegables.
  3. **Bloque 2 — Mis Herramientas:** Agrupadas con idéntico estándar visual y funcional.
  4. **Bloque 3 — Actividades Recientes:** Auditoría acotada a un límite de 25 a 100 registros con filtros instantáneos.
- **Aislamiento Secuencial en 3 Capas (Roles -> Inputs -> Manejo):**
  - **Capa 1 (Rol Base):** `users.role` + registro formal en `roles`. Aterriza en `/dashboard`.
  - **Capa 2 (Formularios Operacionales = Inputs):** Captura primaria de información operativa (inspecciones, firmas, checklists).
  - **Capa 3 (Herramientas Técnicas = Consolidación y Procesamiento):** Manejo y análisis de inputs (kárdex, tableros, visores).
  - **Cero Atajos Cruzados Form <-> Tool:** Retorno siempre hacia `/dashboard` mediante `<BackButton href="/dashboard" label="Volver a Mi Panel" />`. Asignaciones específicas (`user_forms`, `user_tools`) priman sobre las de rol. Logout limpio sin loops.

---

## 📜 LEY 5: Estándares de Diseño UI/UX, Accesibilidad Fotométrica y Anti-Slop (PCM CLOUD)
*(Consolida identidad visual, contraste WCAG AAA, sobriedad y ergonomía)*
- **Identidad Corporativa Dual:** **PROCIMEC** (Mapping Ingeniería) y **PCM CLOUD**. Logotipo en `public/logo.png` con fallback a `CORPORATE_LOGO_BASE64`.
- **Paleta Oficial Sagrada (Cero Azules Genéricos ni Degradados de Plantilla):**
  - **Carbón Técnico:** `#1E2229` (Fondo primario, superficies de alto contraste y solidez).
  - **Ámbar Geofísico de Radar:** `#EAA023` (Color exclusivo de acento, estados activos y enfoque).
  - **Grafito de Precisión:** `#2A303C` / `#15181D` (Bordes técnicos y contenedores secundarios).
- **Ley Suprema de Contraste Cromático (WCAG AA/AAA):**
  - **Prohibido `text-white` sobre fondos o botones ámbar/dorados (`#EAA023`, `#F59E0B`, `bg-accent`):** Es obligatorio usar tipografía carbón oscuro de alto contraste: `text-primary-900 font-bold` (ratio > 7.38:1, WCAG AAA).
  - **Superficies Claras:** Botones sobre blanco o card con texto oscuro (`text-primary-900`) y bordes definidos. Prohibido texto blanco en fondos claros.
  - **Hero Oscuro:** Botón CTA principal en `.btn-accent` (ámbar con texto carbón en negrita).
- **Anti-Visual Clutter y Sobriedad Institucional:** Cero contadores ruidosos en barras de navegación, cero píldoras o badges decorativos superfluos sobre los títulos. Encabezados inician con `<BackButton>`, título `h1` con icono Lucide (`strokeWidth={1.75}`) y descripción concisa de una línea en `text-white/70`.
- **Zero-Emoji Policy (Estricto):** Prohibido el uso de emojis; utilizar exclusivamente iconos vectoriales de Lucide React (`strokeWidth={1.75}`).
- **Tipografía Bimodal:** `Inter` para interfaz y botones; `JetBrains Mono` (`font-mono`) obligatorio para UTM, frecuencias (MHz/GHz), horas, UUIDs, códigos y montos monetarios (`$ COP`).
- **Ergonomía Industrial y Mobile-First:** Formularios en 2 columnas (`sm:grid-cols-2`), selectores de puntuación 1 a 5 con pastillas carbón y aro ámbar (`ring-1 ring-accent`), contenedores con `min-h-[100dvh]`, touch targets mínimos de `44x44px` y microinteracciones `:active:scale-[0.98]` (160ms).

---

## 📜 LEY 6: Eficiencia de Cómputo Serverless, Algoritmos y Cuotas Cloud Free (Vercel & Supabase)
*(Consolida rendimiento algorítmico, I/O, serverless compute y gobernanza de cuotas gratuitas)*
- **Cero Agregación Masiva en Serverless (Vercel Active CPU Shield):** Queda estrictamente prohibido realizar bucles iterativos (`while`, `for`, `.reduce()`) en Node.js sobre colecciones masivas de base de datos para calcular sumas, horas o métricas. Toda agregación estadística debe resolverse dentro del motor PostgreSQL mediante funciones RPC (`SECURITY DEFINER`) o consultas agregadas directas (`SUM()`, `COUNT()`).
- **Rendimiento Algorítmico O(1) e I/O Concurrente:** Prohibido anidamiento $O(N \times M)$ con `.find()` o `.filter()` dentro de bucles; indexar colecciones en memoria con `Map`. Ejecutar consultas independientes de forma concurrente (`Promise.all()`). Prohibido `select('*')` en tablas con binarios o JSONs voluminosos.
- **Disciplina Estricta en React Query / SWR:**
  - **Prohibido `staleTime: 0` indiscriminado:** Toda consulta reactiva debe tener `staleTime` mínimo de 60 segundos (`staleTime: 60 * 1000`) salvo flujos transaccionales críticos.
  - **Desactivación de `refetchOnWindowFocus`:** Obligatorio en `false` para erradicar peticiones fantasma cada vez que el usuario cambia de ventana o pestaña.
  - **Prohibido Polling Ciego en Segundo Plano:** Prohibido implementar `refetchInterval` menores a 60 segundos sin `refetchIntervalInBackground: false`. Si la vista cuenta con suscripción vía Supabase Realtime (WebSockets), el polling por intervalo queda totalmente prohibido.
- **Prefetching Quirúrgico en Enlaces:** En dashboards, modales y cuadrículas con alta densidad de enlaces, es obligatorio usar `<Link prefetch={false}>` para evitar precargas innecesarias y consumo masivo en el Middleware.
- **Blindaje de Almacenamiento y Egress en Supabase:**
  - **Prohibido Guardar Base64 en Columnas de Texto:** La base de datos es exclusivamente para datos estructurados. Toda imagen debe subirse a Storage o Google Drive y persistirse como URL.
  - **Compresión Pre-Subida en Cliente:** Toda captura de fotografías (evidencias HSEQ, almacén, firmas) debe comprimirse en el navegador (WebP, calidad 75-80%) antes de enviarse al bucket.

---

## 📜 LEY 7: Fidelidad Documental, Notificaciones y Dualidad Idiomática
*(Consolida generación de reportes espejo, reglas de correo, alertas y lenguaje)*
- **Dualidad Idiomática Rigurosa:**
  - **Frontend 100% en Español (User-Facing):** Todo texto visible para el usuario (títulos, etiquetas, placeholders, botones, modales, toasts, badges, selectores) debe estar rigurosamente en español.
  - **Backend y Base de Datos en Inglés Canónico:** Tablas (`users`, `roles`, `projects`, `forms`, `tools`), columnas, identificadores de rol (`admin`, `operator`, `warehouse`, etc.) y endpoints permanecen inmutables en inglés. Mapeo visual desacoplado en componentes.
- **Espejo Fiel en Documentación (PDF = Réplica Exacta de Excel .xlsx):** Prohibido inventar diseños abstractos. Los PDFs generados deben calcar la plantilla oficial viva de Excel: orientación (landscape/portrait), franjas doradas (`#FFC000`), subfranjas grises (`#D8D8D8`), cuadrícula con bordes negros finos, firmas digitales estampadas en sus celdas y casillas `[X]` / `[ ]`. Nuevas filas heredan tipografía Arial y bordes de la fila modelo original.
- **Razón Social Canónica Institucional:** La denominación legal oficial obligatoria en todo pie de firma, correo, contrato y reporte descargable es estrictamente:
  **PROCIMEC INGENIERÍA S.A.S.**
- **Desacoplamiento de I/O para Archivos Masivos:** Prohibido enviar archivos superiores a **15MB** como adjuntos en correos transaccionales SMTP. Archivos pesados deben residir en la nube y compartirse mediante enlaces seguros con autenticación y caducidad.
- **Ventana de Alertas Preventivas HSEQ/Operaciones:** Todo módulo que gestione vencimientos metrológicos o legales (SOAT, tecnicomecánica, calibraciones, licencias) debe emitir alertas preventivas automáticas en la ventana de **60 a 1 día previo al vencimiento** bajo plantilla institucional sobria (`GMAIL_USER`).

---

## 📜 LEY 8: Gobernanza de Control de Versiones, Gestión Documental y Listado Maestro Obligatorio (HSEQ / ISO 9001 & 45001)
*(Consolida codificación institucional, gobernanza de versiones y actualización mandatoria)*
- **Registro Obligatorio en el Listado Maestro (`/tools/version-control`):** Queda estrictamente prohibido crear, desplegar o modificar cualquier formulario o formato operativo (en código, base de datos o interfaz) sin registrar o actualizar de forma simultánea e inmediata su versión en la herramienta oficial de HSEQ **Control de Versiones y Gestión Documental** (`document_format_versions` y `format_version_history`).
- **Nomenclatura Canónica Institucional de Código:** Todo formato debe poseer obligatoriamente un código formal con prefijo `FOR-` seguido del identificador del proceso (ej. `FOR-HSEQ-...`, `FOR-SIG-...`, `FOR-GPR-...`, `FOR-CAD-...`, `FOR-ALM-...`, `FOR-COM-...`, `FOR-CMR-...`, `FOR-FIN-...`, `FOR-CNT-...`, `FOR-TH-...`). Queda prohibido publicar formatos sin código formalizado.
- **Incremento Obligatorio de Versión por Modificación:** Cada vez que se altere la estructura de captura, se agreguen o eliminen campos, se modifiquen listas de chequeo o se modifiquen plantillas de exportación, es mandatorio incrementar el número de versión (ej. de v1 a v2) y estampar la fecha de entrada en vigencia (`effective_date`) con su respectiva justificación técnica de control de cambios.
- **Declaración de Proceso y Matriz de Acceso RBAC:** Cada registro en el listado maestro debe estipular inequívocamente el proceso del SIG al que pertenece y la lista de roles autorizados para su diligenciamiento o si su alcance es transversal (`is_universal = true`).
- **Disponibilidad de Plantillas Oficiales Vigentes:** Todo formato registrado debe permitir la descarga inmediata de su versión vigente y de sus versiones históricas en formato PDF o XLSX/DOCX con membrete institucional formal de PROCIMEC INGENIERÍA S.A.S.

---

Para especificaciones detalladas de interfaz y rendimiento, consultar:
- [procimec_design_system.md](file:///.agents/rules/procimec_design_system.md)
- [procimec_architecture.md](file:///.agents/rules/procimec_architecture.md)
- [procimec_performance.md](file:///.agents/rules/procimec_performance.md)
- [PRODUCT.md](file:///PRODUCT.md)

