# PROCIMEC — PCM CLOUD

> **Plataforma Empresarial Cloud de Gestión Integral, Geociencias, Cartografía Subterránea 3D, Modelado CAD/BIM, Aseguramiento HSEQ y Automatización Operativa**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Google Drive](https://img.shields.io/badge/Google_Drive-API_v3-4285F4?logo=googledrive)](https://developers.google.com/drive)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## 1. Visión y Propósito del Sistema

**PROCIMEC (PCM CLOUD)** es la plataforma tecnológica central de **Mapping Ingeniería** para la dirección, captura y aseguramiento de operaciones de ingeniería de precisión, especializada en:

* **3D Underground Utility Mapping:** Cartografía y modelado tridimensional de infraestructura subterránea y redes de servicios públicos (*utility surveys*).
* **Geofísica Aplicada / GPR (Ground Penetrating Radar):** Ensayos no destructivos (NDT) de alta frecuencia para auscultación estructural, detección de anomalías y localización milimétrica de tuberías y ductos.
* **Tecnologías Sin Zanja (Trenchless / No-Dig):** Detección y trazado de interferencias críticas para perforación horizontal dirigida y excavaciones seguras.
* **Aseguramiento HSEQ & Carpeta 24:** Inspección digital de maquinaria y drones, firmas digitales con geolocalización y alertas inmediatas ante anomalías críticas.
* **Oficina Técnica CAD/BIM:** Seguimiento diario de horas productivas, control de planos As-Built y radargramas procesados.
* **Gestión Operacional Integral:** Cadena de valor unificada en Almacén, Compras, Comercial, Finanzas, Contabilidad y Gerencia.

**Misión Central:** Erradicar riesgos críticos de rotura de servicios públicos (gasoductos, líneas de alta tensión, fibra óptica, acueductos), garantizar la trazabilidad inmutable de datos y centralizar la captura operativa bajo una única fuente canónica de verdad.

---

## 2. Ley Suprema de Identidad de Marca UI (Industrial Precision & Cero Spam Visual)

El sistema de diseño visual de **PROCIMEC / PCM CLOUD** está regido por la directriz estricta de **Industrial Precision**: estética sobria, instrumental de ingeniería y erradicación total del ruido visual amateur:

### 🎨 A. Paleta Oficial Sagrada (Derivada del Logo)
* **Carbón Técnico (`#1E2229` / `#15181D`):** Color corporativo maestro. Proporciona solidez estructural, alto contraste y fondo técnico.
* **Ámbar Geofísico de Radar (`#EAA023`):** Color exclusivo de acento. Representa la señal electromagnética de las antenas GPR, estados activos, aros de selección y elementos de foco.
* **Grafito Técnico (`#2A303C`):** Bordes sutiles, divisiones y superficies secundarias.
* **Prohibición Expresa:** Prohibido el uso de azules genéricos de plantilla, violetas o gradientes cliché de neón.

### 🚫 B. Ley de Cero Spam Visual (Anti-Visual Clutter)
* **Cero Contadores Ruidosos:** Prohibido incorporar badges que inflen números en menús o encabezados (e.g. `16 Formularios registrados`, `14 Herramientas activas`).
* **Cero Spans Superfluos en Hero:** Prohibido colocar etiquetas decorativas de catálogo o departamento sobre los títulos (e.g. `[FORMULARIO OPERATIVO]`, `[Catálogo: slug]`).
* **Hero Sobrio Canónico:** Todo formulario o herramienta inicia exclusivamente con:
  1. `<BackButton href="/dashboard" label="Volver a Mi Panel" />`
  2. Título formal `h1` con icono Lucide (`className="w-7 h-7 text-accent" strokeWidth={1.75}`)
  3. Descripción concisa de una sola línea (`text-white/70 text-sm mt-1`).

### 📋 C. Ergonomía de Formularios Industriales
* **Rejilla en 2 Columnas (`sm:grid-cols-2`):** Distribución balanceada que maximiza el ancho útil y elimina el scroll vertical innecesario.
* **Selectores de Puntuación (1 a 5):** Botones pastilla compactos en carbón con borde técnico y aro ámbar activo (`ring-1 ring-accent bg-accent/15`).
* **Chips de Prioridad Sobrios:** Basados en contraste neutro y aro ámbar de enfoque; cero arcoíris saturados.
* **Monedas y Datos Numéricos:** Prefijo monetario sobrio (`$ COP`), horas, coordenadas UTM, frecuencias GHz y códigos formateados estrictamente en `font-mono`.

### 🛡️ D. Directrices Anti-Slop
* **Zero-Emoji Policy (Estricto):** Cero emojis en componentes de software, botones o tablas; uso exclusivo de [Lucide Icons](https://lucide.dev) con trazo `strokeWidth={1.75}`.
* **Tipografía Bimodal:** `Inter` para interfaz general y `JetBrains Mono` (`font-mono`) para coordenadas UTM, frecuencias, horas, códigos y monedas.
* **Microinteracciones Físicas:** Respuesta táctil inmediata con `:active:scale-[0.98]` y transición de 160ms (`cubic-bezier(0.23, 1, 0.32, 1)`).
* **Mobile-First Real:** Alturas dinámicas con `min-h-[100dvh]` y zonas interactivas táctiles mínimas de `44x44px`.

---

## 3. Arquitectura del Hub Centralizado (`/dashboard`) y Separación Canónica

La plataforma opera bajo el **Principio de Hub Centralizado Único**:

```
                       ┌───────────────────────────────┐
                       │          /dashboard           │
                       │          ("Mi Panel")         │
                       └──────────────┬────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
     ┌──────────────────┐                           ┌──────────────────┐
     │ MIS FORMULARIOS  │                           │ MIS HERRAMIENTAS │
     │  (Inputs Puros)  │                           │ (Manejo/Cálculo) │
     └────────┬─────────┘                           └────────┬─────────┘
              │                                               │
              │  Retorno obligatorio                         │  Retorno obligatorio
              └────────────────► /dashboard ◄────────────────┘
                       (Prohibidos atajos cruzados)
```

### 📜 Ley del Hub Centralizado Único
1. **Hub Universal:** Queda prohibido crear páginas de inicio o portales aislados por rol (`/warehouse`, `/purchasing`, `/commercial`, etc.). Todos los roles ingresan y operan a través de `/dashboard` ("Mi Panel"), el cual renderiza dinámicamente:
   * **Mis Formularios:** Módulos de captura habilitados en `role_forms` o `user_forms`.
   * **Mis Herramientas:** Módulos de procesamiento habilitados en `role_tools` o `user_tools`.
2. **Prohibición de Atajos Cruzados:** Prohibido insertar botones de navegación directa ("accesos rápidos", enlaces cruzados) de un Formulario hacia una Herramienta o viceversa. El usuario debe retornar siempre a `/dashboard` mediante el `<BackButton href="/dashboard" label="Volver a Mi Panel" />`.

### 📜 Principio de Separación: Formularios (Inputs) vs. Herramientas (Manejo)
* **Formularios = Inputs de Captura:** Su única función es registrar información operativa primaria (formatos de entrada, inspecciones, checklists, firmas, novedades y soportes).
* **Herramientas = Manejo y Consolidación:** Son kárdex de inventario, tableros de productividad, visores geográficos, procesadores analíticos y módulos de auditoría. Jamás se crea una herramienta para captar información primaria sin su formulario correspondiente.

---

## 4. Ecosistema de Roles Corporativos

PROCIMEC estructura la operación de Mapping Ingeniería en **10 Roles Canónicos** más el Administrador General:

| Identificador BD | Nombre en Interfaz | Formularios Asignados (Inputs) | Herramientas Asignadas (Manejo) |
|---|---|---|---|
| `operator` | **Localizador GPR** | Reporte Diario GPR (`/projects/[id]/new-report`) | Visor Radargramas, Visor GIS, Procesador GSF |
| `drawing` | **Dibujo CAD / BIM** | Registro de Actividades CAD (`/forms/cad-register-form`) | Tablero Productividad CAD, Visor TXT/DWG |
| `warehouse` | **Almacén & Logística** | Registro Unificado Instrumental (`/forms/registro-equipo`) | Kárdex e Inventario Activo (`/tools/warehouse-inventory`) |
| `purchasing` | **Compras & Suministros** | Requisición, Evaluación Proveedor, Registro Factura | Organigrama IA, Asistencia |
| `commercial` | **Comercial & Licitaciones** | Cotización Servicios, Oportunidades, Minutas | Organigrama IA, Visor GIS, Evidencias |
| `finance` | **Finanzas & Tesorería** | Flujo de Caja Diario, Solicitud Pago, Arqueo Caja | Organigrama IA, Tablero Productividad |
| `accounting` | **Contabilidad & Fiscal** | Comprobante Egreso, Causación Factura, Conciliación | Organigrama IA, Tablero Productividad |
| `hseq` | **Seguridad HSEQ & SST** | Inspección Preoperacional Carpeta 24 (`/forms/hseq-report`) | Tablero de Evidencias HSEQ (`/tools/evidence-board`) |
| `hr` | **Gestión Humana & RRHH** | Elaboración Cartas Laborales (`/forms/elaboracion-cartas`) | Auditoría de Cartas (`/tools/cartas-audit`), Control Asistencia |
| `management` | **Alta Gerencia** | Supervisión Ejecutiva y Aprobaciones | Tableros Consolidados, Organigrama IA, Visores |
| `admin` | **Administrador General** | Acceso Pleno a Todos los Formularios | Gobernanza (`/admin`), Suite Completa de Herramientas |

---

## 5. Suite de Herramientas Técnicas (`/tools`)

1. **Kárdex e Inventario Activo (`/tools/warehouse-inventory`):** Control en tiempo real de instrumental geofísico (GPR Mala, antenas 400MHz/900MHz, GPS Leica, Drones), estados de calibración, despachos y devoluciones.
2. **Organigrama & Arquitectura Inteligente (`/tools/org-chart-ai`):** Visor DAG interactivo de estructura corporativa, cuadrillas de campo y pipeline técnico de datos en vivo con diagnóstico IA de cuellos de botella.
3. **Visor de Radargramas GPR (`/tools/radargrama`):** Inspección visual y análisis preliminar de cortes geofísicos con filtros DSP y capas dieléctricas.
4. **Tablero de Productividad CAD/BIM (`/tools/cad-productivity-board`):** Monitoreo analítico de horas trabajadas y metros lineales delineados con filtros dinámicos.
5. **Tablero de Evidencias HSEQ (`/tools/evidence-board`):** Repositorio seguro de inspecciones preoperacionales Carpeta 24 con sincronización automática en Google Drive.
6. **Auditoría de Cartas Laborales (`/tools/cartas-audit`):** Historial inmutable de certificaciones emitidas, códigos de validación y control de trazabilidad.
7. **Control de Asistencia (`/tools/attendance-tracker`):** Registro de ingreso y salida con verificación de geocerca para personal de campo y oficina.
8. **Visor GIS / Cartográfico (`/tools/gis-viewer`):** Superposición de polígonos de prospección sobre cartografía base.
9. **Procesador GSF (`/tools/gsf-processor`):** Parseo y conversión de formatos geofísicos.
10. **Visor TXT / DWG (`/tools/txt-dwg-viewer`):** Inspección de coordenadas de levantamiento topográfico.
11. **Chat Interno & Transcriptor IA (`/tools/internal-chat`, `/tools/meeting-transcriber`):** Mensajería técnica y extracción de tareas de comités de obra.

---

## 6. Arquitectura de Datos en Supabase (PostgreSQL)

Toda tabla de reportes y actividades operacionales cumple con la **Ley de Integridad Referencial Inmutable**:

```sql
CREATE TABLE public.operation_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved')),
    -- Campos operacionales específicos con restricciones CHECK
    CHECK (hours_worked >= 0 AND hours_worked <= 24)
);
```

* **RLS (Row Level Security):** Políticas basadas en pertenencia a proyectos (`user_projects`) y rol autenticado (`users.role`).
* **Realtime Channels:** Sincronización en vivo mediante WebSockets para tableros de productividad y organigrama.
* **Resolución Canónica:** Nombres de proyecto y correos de usuario son normalizados contra base de datos relacional; jamás se almacena texto informal del usuario.

---

## 7. Variables de Entorno Requeridas (`.env.local`)

```env
# --- NEXTAUTH (AUTENTICACIÓN CORPORATIVA) ---
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=genera_un_secreto_seguro_con_openssl_rand_base64_32

# --- GOOGLE OAUTH 2.0 ---
GOOGLE_CLIENT_ID=tu_cliente_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_cliente_secret

# --- SUPABASE (POSTGRESQL & BUCKETS) ---
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# --- GOOGLE DRIVE (SERVICE ACCOUNT) ---
GOOGLE_DRIVE_ROOT_FOLDER_ID=id_de_la_carpeta_raiz_en_drive
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=clave_json_de_la_cuenta_de_servicio_en_base64

# --- SERVICIOS DE CONVERSIÓN DE DOCUMENTOS (HSEQ) ---
CONVERTAPI_SECRET=tu_clave_convertapi_opcional
CLOUDCONVERT_API_KEY=tu_clave_cloudconvert_opcional

# --- NOTIFICACIONES Y ALERTAS POR CORREO (HSEQ & RRHH) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=notificaciones@procimec.com
SMTP_PASS=password_de_aplicacion_gmail
ALERT_EMAIL_RECIPIENT=ghprocimec@gmail.com
```

---

## 8. Gobernanza y Seguridad del Código

* **Exclusión Permanente del Bot de WhatsApp:** La carpeta `bot-whatsapp/` (tokens criptográficos de Baileys, credenciales y variables de entorno) debe permanecer **siempre** fuera del control de versiones en `.gitignore`.
* **Prohibición de Servidores Locales Autónomos:** Los agentes de IA tienen estrictamente prohibido ejecutar `npm run dev` o procesos en segundo plano sin orden expresa del usuario.
* **Despliegue Continuo:** Cada commit validado en la rama `main` dispara automáticamente la compilación y despliegue en Vercel.

---

© 2026 **PROCIMEC — PCM CLOUD | Mapping Ingeniería**. Todos los derechos reservados.
