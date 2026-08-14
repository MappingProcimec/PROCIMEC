# GPR Field Reporter — PROCIMEC

> **Sistema PWA de registro digital de levantamientos con Radar de Penetración Terrestre (GPR)**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)

---

## 📋 Descripción

Aplicación web progresiva (PWA) mobile-first para que el equipo de campo de PROCIMEC registre, formalice y almacene digitalmente los datos obtenidos con equipos GPR. La app:

- ✅ Guarda datos del levantamiento en un formulario de **5 pasos**
- ✅ **Sube archivos a Google Drive** (RAW GPR, GPS, Fotografías)
- ✅ **Genera reporte Word (.docx)** automáticamente con soporte de facturación
- ✅ **Panel de administración** con gestión de proyectos y usuarios
- ✅ **Soporte offline** con guardado de borrador en localStorage
- ✅ **Roles**: Admin, Operador, Pendiente

---

## 🚀 Configuración Paso a Paso

### Paso 1 — Clonar y dependencias

```bash
git clone <tu-repo>
cd gpr-field-reporter
npm install
cp .env.local.example .env.local
```

---

### Paso 2 — Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto (o usa uno existente)
3. Ve a **APIs & Services → Credentials**
4. Clic en **Create Credentials → OAuth client ID**
5. Tipo de aplicación: **Web application**
6. URIs de origen autorizados:
   ```
   http://localhost:3000
   https://tu-app.vercel.app
   ```
7. URIs de redireccionamiento:
   ```
   http://localhost:3000/api/auth/callback/google
   https://tu-app.vercel.app/api/auth/callback/google
   ```
8. Copia el **Client ID** y **Client Secret** al `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   ```
9. Genera el NEXTAUTH_SECRET:
   ```bash
   openssl rand -base64 32
   ```

---

### Paso 3 — Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) → crea nuevo proyecto
2. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Ve a **SQL Editor** y ejecuta el schema completo:
   ```
   supabase/schema.sql
   ```
4. ⚠️ **Importante:** Deshabilita la autenticación de Supabase Auth si no la usas (usamos NextAuth directamente).

---

### Paso 4 — Configurar Google Drive (Service Account)

1. En Google Cloud Console, ve a **APIs & Services → Library**
2. Habilita la **Google Drive API**
3. Ve a **APIs & Services → Credentials → Create Credentials → Service Account**
4. Dale un nombre (ej: `gpr-drive-service`) y crea
5. En la service account, ve a **Keys → Add Key → Create new key → JSON**
6. Descarga el archivo JSON
7. Convierte a base64:
   ```bash
   # Linux/Mac:
   cat service-account-key.json | base64 -w 0
   
   # Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account-key.json"))
   ```
8. Pega el resultado en `.env.local`:
   ```env
   GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=eyJ0eXBlIjo...
   ```
9. **Crea la carpeta raíz en Drive:**
   - Crea manualmente una carpeta llamada `GPR_PROCIMEC` en Google Drive
   - Comparte esta carpeta con el email de la service account (con permisos de Editor)
   - Copia el ID de la carpeta de la URL: `https://drive.google.com/drive/folders/[ESTE_ES_EL_ID]`
   ```env
   GOOGLE_DRIVE_ROOT_FOLDER_ID=1AbCdEf...
   ```

---

### Paso 5 — Ejecutar localmente

```bash
npm run dev
```

Visita [http://localhost:3000](http://localhost:3000)

---

## 🌐 Despliegue en Vercel

1. Push tu código a GitHub:
   ```bash
   git add .
   git commit -m "Initial commit — GPR Field Reporter v1.0"
   git push origin main
   ```

2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa tu repo de GitHub

3. En **Environment Variables** en Vercel, agrega todas las variables de `.env.local.example`
   > ⚠️ Actualiza `NEXTAUTH_URL` con tu URL de Vercel: `https://gpr-field-reporter.vercel.app`

4. En Google Cloud Console, agrega la URL de Vercel a los **Authorized redirect URIs** de OAuth

5. Vercel desplegará automáticamente en cada push a `main`

---

## 📁 Estructura del Proyecto

```
gpr-field-reporter/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Login
│   ├── pending/                  # Rol pendiente
│   ├── projects/                 # Lista de proyectos
│   │   └── [projectId]/
│   │       ├── new-report/       # Formulario 5 pasos
│   │       └── reports/          # Historial de registros
│   ├── admin/                    # Panel administración
│   │   ├── dashboard/
│   │   ├── projects/
│   │   └── users/
│   └── api/                      # API Routes
│       ├── auth/[...nextauth]/
│       ├── reports/
│       ├── projects/
│       └── admin/
├── src/
│   ├── components/
│   │   ├── form-steps/           # Step1 - Step5
│   │   └── layout/               # Navbar, Stepper, FloatingDraftButton
│   ├── hooks/
│   │   └── useFormStore.ts       # Zustand store + borrador offline
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── drive.ts
│   │   ├── docx-generator.ts
│   │   └── validations.ts
│   ├── middleware.ts              # Protección de rutas por rol
│   └── types/
│       ├── index.ts
│       └── next-auth.d.ts
├── supabase/
│   └── schema.sql                # Schema completo con RLS
├── public/
│   └── manifest.json             # PWA manifest
├── .env.local.example
└── README.md
```

---

## 👥 Sistema de Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Dashboard completo, gestión de proyectos y usuarios, todos los registros |
| `operator` | Solo proyectos asignados, crear registros, descargar sus reportes |
| `pending` | Pantalla de espera — sin acceso hasta aprobación del admin |

**Flujo de onboarding:**
1. Usuario hace login con Google → rol `pending` automáticamente
2. Admin ve el usuario en "Gestión de Usuarios" con badge naranja de "Aprobación pendiente"
3. Admin asigna rol `operator` + proyectos
4. Usuario puede iniciar sesión normalmente

---

## 📄 Formato del Reporte Word

El `.docx` generado incluye:
1. **Portada** — PROCIMEC, datos del proyecto y cliente
2. **Sección 1** — Especificaciones técnicas del equipo
3. **Sección 2** — Tabla operativa ML/M² (soporte de facturación)
4. **Sección 3** — Hallazgos y anomalías detectadas
5. **Sección 4** — Registro de archivos con links Drive
6. **Sección 5** — Registro fotográfico (hasta 4 fotos embebidas)
7. **Sección 6** — Notas para posprocesamiento y CAD
8. **Sección 7** — Tabla de validación y firmas

---

## 🔑 Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |
| `NEXTAUTH_SECRET` | Secreto para cifrar JWT (min 32 chars) |
| `NEXTAUTH_URL` | URL base de la app |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID de carpeta raíz en Drive |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY` | JSON de service account en base64 |

---

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS v3 con paleta PROCIMEC personalizada
- **Autenticación:** NextAuth.js v4 con Google OAuth
- **Base de datos:** Supabase (PostgreSQL) con Row Level Security
- **Almacenamiento:** Google Drive API v3 con Service Account
- **Word:** Librería `docx` para generación de reportes
- **Estado:** Zustand con persistencia en localStorage (borrador offline)
- **PWA:** next-pwa con soporte de instalación en mobile

---

*PROCIMEC — GPR Field Reporter v1.0*
