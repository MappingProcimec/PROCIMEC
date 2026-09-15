# PROCIMEC — PCM CLOUD

> **Plataforma Empresarial de Gestión Geofísica, Cartografía Subterránea 3D, Modelado CAD/BIM, Aseguramiento HSEQ y Automatización Operativa**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Google Drive](https://img.shields.io/badge/Google_Drive-API_v3-4285F4?logo=googledrive)](https://developers.google.com/drive)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## 1. Visión y Propósito del Sistema

**PROCIMEC (PCM CLOUD)** es la solución tecnológica integral de **Mapping Ingeniería** para la gestión de proyectos de ingeniería de precisión, orientada a:

* **3D Underground Mapping:** Cartografía y modelado tridimensional de infraestructura subterránea y redes de servicios públicos (*utility surveys*).
* **Geofísica Aplicada / GPR (Ground Penetrating Radar):** Ensayos no destructivos (NDT) de alta frecuencia para auscultación estructural, detección de anomalías y localización milimétrica de tuberías y ductos.
* **Tecnologías Sin Zanja (Trenchless / No-Dig):** Detección y trazado de interferencias para perforación horizontal dirigida y obras civiles de alto impacto.
* **Aseguramiento HSEQ & Oficina Técnica CAD/BIM:** Digitalización preoperacional de maquinaria, generación de evidencias certificadas, control de productividad y auditoría operativa continua.

**Objetivo Central:** Mitigar riesgos críticos de rotura o perforación accidental de servicios públicos (gasoductos, redes eléctricas de alta tensión, fibra óptica, acueductos), optimizar costos en obra civil y unificar la captura de datos de campo y oficina bajo una única fuente de verdad canónica.

---

## 2. Módulos y Capacidades de la Plataforma

### 📡 A. Módulo de Campo GPR (PWA Mobile-First)
* **Formulario Guiado de 5 Pasos:** Registro estandarizado de información general, parámetros técnicos del equipo GPR (antena, frecuencia en MHz/GHz, profundidad teórica), soporte de facturación (ML y M²), hallazgos/anomalías y documentación fotográfica.
* **Modo Offline-First:** Persistencia inmediata de borradores en almacenamiento local (`localStorage` + Zustand) para resistir pérdidas de señal en túneles o zanjas viales.
* **Sincronización Cloud Automática:** Carga directa y organizada de archivos RAW GPR, coordenadas GPS y fotografías de alta resolución a Google Drive mediante cuenta de servicio dedicada.
* **Generación de Reportes Word (.docx):** Compilación instantánea de informes técnicos oficiales con membrete, tablas operativas de medición, evidencias embebidas y firmas de validación.

### 📐 B. Módulo de Dibujo CAD / BIM & Productividad Técnica
* **Registro de Actividades CAD (`/dibujo/nueva-actividad`):** Captura diaria de horas hombre, entregables generados (planos As-Built, modelos BIM, radargramas procesados) y asignación estricta de proyectos.
* **Tablero de Productividad en Vivo (`/dibujo/tablero`):** Panel interactivo con filtros directos por columna, ordenamiento multicriterio ascendente/descendente y métricas de desempeño del equipo de modelado.

### 🛡️ C. Módulo HSEQ & Carpeta 24 (Inspecciones Preoperacionales)
* **Formatos Oficiales de Maquinaria y Equipos:** Inspecciones digitales para Drones, Estación Total y equipos geofísicos especializados.
* **Motor Fiel de Plantillas Excel (.xlsx) a PDF:** Llenado automatizado sobre plantillas reglamentarias de la empresa respetando logos, formato condicional y ajuste milimétrico a 1 página (ExcelJS + ConvertAPI / CloudConvert con fallback local de contingencia).
* **Validación de Respuestas de Seguridad & Alertas:** Detección de preguntas de seguridad críticas (respuestas trampa en "NO" u observaciones críticas) con notificación inmediata vía correo electrónico institucional (`ghprocimec@gmail.com`).
* **Firma Digital Táctil:** Lienzo de captura de firma con bloqueo de scroll nativo en pantallas móviles para máxima ergonomía en campo.
* **Tablero de Evidencias HSEQ (`/tools/evidence-board`):** Visor unificado de archivos PDF y Excel almacenados permanentemente en buckets seguros de Supabase y Google Drive.

### 🛠️ D. Suite de Herramientas Especializadas de Ingeniería (`/tools` y `/herramientas`)
* **Visualizador de Radargramas GPR (`/herramientas/radargrama`):** Inspección visual y análisis preliminar de cortes geofísicos.
* **Visor GIS / Cartográfico (`/tools/gis-viewer`):** Superposición de capas geoespaciales y verificación de polígonos de levantamiento.
* **Procesador GSF (`/tools/gsf-processor`):** Tratamiento y parseo de formatos de prospección geofísica.
* **Visor TXT / DWG (`/tools/txt-dwg-viewer`):** Comprobación de nubes de puntos y entidades vectoriales.
* **Control de Asistencia (`/tools/attendance-tracker`):** Registro de cuadrillas y personal técnico en campo.
* **Transcriptor de Reuniones Técnicas (`/tools/meeting-transcriber`):** Resumen de comités de obra e hitos operacionales.
* **Organigrama Dinámico con IA (`/tools/org-chart-ai`):** Modelado y jerarquía organizacional.
* **Generador de Scripts de Respaldo (`/tools/backup-script-gen`):** Utilidades de contingencia para respaldos locales.
* **Chat Interno Operacional (`/tools/internal-chat`):** Canal de comunicación técnica entre cuadrillas y oficina central.

### ⚙️ E. Panel de Administración y Gobernanza (`/admin`)
* **Control de Acceso Basado en Roles (RBAC):** Jerarquía de permisos (`admin`, `operator`, `cad_modeler`, `hseq`, `viewer`, `pending`).
* **Asignación Canónica de Proyectos:** Vinculación estricta entre usuarios y proyectos en la tabla relacional `user_projects`.
* **Catálogo de Formularios y Divisiones:** Administración de divisiones de negocio (`/admin/divisions`) y esquemas JSONB dinámicos (`/admin/forms`).

### 💬 F. Asistente Conversacional WhatsApp (Baileys + Google Gemini AI)
* Registro de actividades y reportes en lenguaje natural mediante WhatsApp.
* Cumplimiento estricto de las leyes de arquitectura canónica y validación de esquemas (ejecutado de forma aislada en servidor dedicado).

---

## 3. Principios de Arquitectura e Integridad de Datos

Toda extensión o modificación funcional en PROCIMEC debe respetar las **Tres Leyes Universales de Arquitectura**:

### 📜 Ley 1: Estructura Estándar de Tablas de Operación
Toda tabla en Supabase que registre actividades, reportes o evidencias operacionales debe contener obligatoriamente:
```sql
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
project_id  UUID NOT NULL REFERENCES projects(id),  -- Integridad referencial: NUNCA texto libre
user_id     UUID NOT NULL REFERENCES users(id),     -- Vínculo al colaborador autenticado
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),     -- Timestamp inmutable de auditoría
status      TEXT NOT NULL DEFAULT 'submitted'       -- Flujo de estado ('draft', 'submitted', 'reviewed')
```
* Restricciones de valores fijos mediante cláusulas `CHECK (...)`.
* Valores predeterminados en BD (`hours_worked DEFAULT 8.5`, `report_date DEFAULT CURRENT_DATE`).

### 📜 Ley 2: Catálogo de Esquemas (Fuente Única de Verdad)
Los formularios no cablean reglas dispersas. La tabla `forms` en Supabase almacena la definición en formato `schema JSONB` (`target_table`, `rules`, `fields`), consumida equitativamente por la aplicación Next.js y el Bot de WhatsApp.

### 📜 Ley 3: El Guardián Canónico de Proyectos
* Las entradas de proyecto ingresadas por el usuario se resuelven contra los proyectos activos asignados en `user_projects`.
* Se persiste únicamente el **nombre oficial en mayúsculas** o el **UUID oficial** de la base de datos.
* Los responsables se asignan al correo oficial (`user.email`) o ID del colaborador autenticado, bloqueando discrepancias de identidad.

---

## 4. Sistema de Diseño: Industrial Precision

El sistema de diseño visual de PROCIMEC está calibrado para máxima legibilidad bajo condiciones industriales y de obra:

* **Paleta Oficial del Logo:**
  * **Carbón Técnico:** `#1E2229` (Fondo primario, superficies de alto contraste y solidez estructural).
  * **Ámbar Geofísico de Radar:** `#EAA023` (Color de acento, estados activos, indicadores de antena y radar).
  * **Neutros Técnicos:** Bordes y superficies en escala Slate/Zinc (`#0F1115`, `#2A2F38`, `#383F4D`).
* **Directrices Anti-Slop:**
  * **Cero Emojis:** Prohibido el uso de emojis decorativos en la interfaz; uso exclusivo de iconos vectoriales de [Lucide React](https://lucide.dev) con `strokeWidth={1.75}`.
  * **Tipografía Bimodal:** `Inter` para jerarquías tipográficas de UI y `JetBrains Mono` para datos técnicos (coordenadas UTM, frecuencias GHz, metadatos y códigos).
  * **Mobile First Riguroso:** Alturas en contenedores `min-h-[100dvh]` (para prevenir saltos al abrir el teclado en smartphones) y zonas de pulsación táctil mínimas de `44x44px`.
  * **Física y Microinteracciones:** Botones y tarjetas con respuesta táctil inmediata `:active:scale-[0.98]` y transiciones de 160ms (`cubic-bezier(0.23, 1, 0.32, 1)`).

---

## 5. Estructura del Repositorio

```
PROCIMEC/
├── .agents/                      # Reglas de gobierno, arquitectura y diseño para IA y desarrolladores
│   └── rules/
│       ├── always_push.md
│       ├── procimec_architecture.md
│       └── procimec_design_system.md
├── app/                          # Next.js 14 App Router
│   ├── page.tsx                  # Landing / Acceso
│   ├── login/                    # Pantalla de autenticación corporativa
│   ├── pending/                  # Vista de usuario pendiente de asignación
│   ├── projects/                 # Explorador de proyectos asignados
│   ├── forms/                    # Formularios dinámicos y reportes HSEQ
│   │   ├── [formSlug]/           # Motor de formularios basados en esquemas
│   │   └── hseq-report/          # Inspección preoperacional Carpeta 24
│   ├── dibujo/                   # Módulo de Oficina Técnica CAD/BIM
│   │   ├── nueva-actividad/      # Formulario de registro de dibujo
│   │   └── tablero/              # Tablero interactivo de productividad
│   ├── herramientas/             # Herramientas de visualización directa
│   │   └── radargrama/           # Visor de radargramas GPR
│   ├── tools/                    # Suite de herramientas avanzadas
│   │   ├── cad-productivity-board/
│   │   ├── evidence-board/       # Tablero de evidencias HSEQ
│   │   ├── gis-viewer/           # Visor de capas cartográficas
│   │   ├── gsf-processor/        # Procesador de archivos GSF
│   │   ├── txt-dwg-viewer/       # Visor técnico DWG/TXT
│   │   ├── attendance-tracker/   # Registro de asistencia
│   │   ├── meeting-transcriber/  # Transcriptor técnico
│   │   ├── org-chart-ai/         # Organigrama interactivo
│   │   ├── internal-chat/        # Chat operacional
│   │   └── docx-generator/       # Generador avanzado Word
│   ├── admin/                    # Panel administrativo
│   │   ├── dashboard/            # Métricas consolidadas
│   │   ├── projects/             # Gestión de obras y clientes
│   │   ├── users/                # Gestión de colaboradores y roles
│   │   ├── divisions/            # Catálogo de divisiones
│   │   └── forms/                # Diseñador de esquemas de formulario
│   └── api/                      # Rutas de API y Webhooks
│       ├── auth/                 # Handlers de NextAuth
│       ├── reports/              # Persistencia y generación de reportes
│       ├── hseq/                 # Generación de PDFs/Excel y alertas de correo
│       └── admin/                # Endpoints administrativos
├── src/                          # Librerías centrales y componentes compartidos
│   ├── components/               # Componentes UI (Design System Industrial)
│   ├── hooks/                    # Custom Hooks y stores Zustand
│   ├── lib/                      # Supabase client, Google Drive, convertidores y validaciones
│   └── types/                    # Tipados TypeScript estrictos
├── supabase/                     # Esquemas SQL, migraciones y políticas RLS
│   └── schema.sql
├── public/                       # Activos estáticos, logotipos e iconos PWA
├── bot-whatsapp/                 # Bot de WhatsApp (permanente en .gitignore)
├── PRODUCT.md                    # Definición de negocio y especificaciones de producto
├── AGENTS.md                     # Reglas de desarrollo y directrices obligatorias de agentes
└── README.md                     # Documentación general del repositorio
```

---

## 6. Variables de Entorno Requeridas (`.env.local`)

Crea un archivo `.env.local` en la raíz basándote en la siguiente plantilla:

```env
# --- NEXTAUTH (AUTENTICACIÓN) ---
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

# --- NOTIFICACIONES Y ALERTAS POR CORREO (HSEQ) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=notificaciones@procimec.com
SMTP_PASS=password_de_aplicacion_gmail
ALERT_EMAIL_RECIPIENT=ghprocimec@gmail.com
```

---

## 7. Instalación y Validación

### Requisitos Previos
* **Node.js:** Versión `>= 18.18.0`
* **npm:** Versión `>= 9.0.0`
* Proyecto activo en **Supabase** con el esquema ejecutado
* Cuenta de servicio en **Google Cloud Console** con Google Drive API habilitada

### Pasos de Instalación
```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd PROCIMEC

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local   # o crear manualmente .env.local

# 4. Validar compilación estática y tipado estricto
npm run build
```

> **Nota Operativa:** De acuerdo con la constitución del repositorio (`AGENTS.md`), no se deben levantar servidores locales ni procesos en segundo plano de manera autónoma sin solicitud explícita del operador.

---

## 8. Gobernanza y Seguridad del Código

* **Exclusión Permanente del Bot de WhatsApp:** La carpeta `bot-whatsapp/` contiene tokens de sesión, credenciales privadas y configuraciones locales de Baileys. **Bajo ninguna circunstancia** debe incluirse en el control de versiones ni subirse a repositorios públicos o privados (protegido en `.gitignore`).
* **Políticas RLS en Supabase:** El acceso a los datos operativos está regulado por Row Level Security; ningún usuario externo puede modificar reportes ajenos sin permisos administrativos o de asignación de proyecto.
* **Integración Continua:** Los despliegues de producción en Vercel se disparan automáticamente tras cada validación y push a la rama `main`.

---

© 2026 **PROCIMEC — Mapping Ingeniería**. Todos los derechos reservados.
