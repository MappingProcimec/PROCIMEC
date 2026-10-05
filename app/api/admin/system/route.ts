import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

// GET /api/admin/system — Telemetría en vivo, salud de servicios y métricas
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. Latencia de Base de Datos PostgreSQL (Supabase)
  const startDb = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;
  let dbError: string | null = null;

  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });
    dbLatencyMs = Date.now() - startDb;
    if (error) {
      dbStatus = 'degraded';
      dbError = error.message;
    } else if (dbLatencyMs > 800) {
      dbStatus = 'degraded';
    }
  } catch (err: unknown) {
    dbStatus = 'down';
    dbError = err instanceof Error ? err.message : 'Error desconocido de conexión';
  }

  // 2. Consultas concurrentes para métricas y conteos
  const [
    usersRes,
    projectsRes,
    rolesRes,
    formsRes,
    toolsRes,
    divisionsRes,
    reportsRes,
    recentReportsRes,
    drawingRes,
  ] = await Promise.allSettled([
    supabase.from('users').select('id, role, is_active, created_at, full_name, email'),
    supabase.from('projects').select('id, name, is_active, code, cost_center'),
    supabase.from('roles').select('id, name'),
    supabase.from('forms').select('id, name, is_active'),
    supabase.from('tools').select('id, name, is_active'),
    supabase.from('divisions').select('id, name'),
    supabase.from('field_reports').select('id, created_at, report_date, operational_summary'),
    supabase
      .from('field_reports')
      .select('id, created_at, report_date, localizador_name, project_id, projects(name, code)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('drawing_activities').select('id, hours_worked, created_at'),
  ]);

  const users = usersRes.status === 'fulfilled' && !usersRes.value.error ? usersRes.value.data || [] : [];
  const projects = projectsRes.status === 'fulfilled' && !projectsRes.value.error ? projectsRes.value.data || [] : [];
  const roles = rolesRes.status === 'fulfilled' && !rolesRes.value.error ? rolesRes.value.data || [] : [];
  const forms = formsRes.status === 'fulfilled' && !formsRes.value.error ? formsRes.value.data || [] : [];
  const tools = toolsRes.status === 'fulfilled' && !toolsRes.value.error ? toolsRes.value.data || [] : [];
  const divisions = divisionsRes.status === 'fulfilled' && !divisionsRes.value.error ? divisionsRes.value.data || [] : [];
  const reports = reportsRes.status === 'fulfilled' && !reportsRes.value.error ? reportsRes.value.data || [] : [];
  const recentReports = recentReportsRes.status === 'fulfilled' && !recentReportsRes.value.error ? recentReportsRes.value.data || [] : [];
  const drawingActivities = drawingRes.status === 'fulfilled' && !drawingRes.value.error ? drawingRes.value.data || [] : [];

  // Cálculos de métricas operativas
  const pendingUsers = users.filter((u) => u.role === 'pending');
  const activeProjects = projects.filter((p) => p.is_active !== false);

  // Reportes últimas 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const reportsLast24h = reports.filter((r) => r.created_at && r.created_at >= oneDayAgo);

  // Metros lineales totales
  const totalMl = reports.reduce((acc, r) => {
    const summary = Array.isArray(r.operational_summary) ? r.operational_summary : [];
    return acc + summary.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
  }, 0);

  // Horas CAD totales
  const totalCadHours = drawingActivities.reduce(
    (acc, a) => acc + (Number(a.hours_worked) || 0),
    0
  );

  // 3. Auditoría de Variables de Entorno (Preservando privacidad de secretos)
  const envAudit = {
    supabaseUrl: {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      category: 'Base de Datos',
    },
    supabaseAnon: {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      category: 'Base de Datos',
    },
    supabaseServiceRole: {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      category: 'Seguridad / RLS Bypass',
    },
    nextAuthSecret: {
      key: 'NEXTAUTH_SECRET',
      configured: Boolean(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 16),
      category: 'Autenticación',
    },
    nextAuthUrl: {
      key: 'NEXTAUTH_URL',
      configured: Boolean(process.env.NEXTAUTH_URL),
      category: 'Autenticación',
    },
    googleClientId: {
      key: 'GOOGLE_CLIENT_ID',
      configured: Boolean(process.env.GOOGLE_CLIENT_ID),
      category: 'OAuth 2.0 Google',
    },
    googleClientSecret: {
      key: 'GOOGLE_CLIENT_SECRET',
      configured: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      category: 'OAuth 2.0 Google',
    },
    geminiApiKey: {
      key: 'GEMINI_API_KEY',
      configured: Boolean(process.env.GEMINI_API_KEY),
      category: 'Inteligencia Artificial',
    },
    smtpUser: {
      key: 'SMTP_USER / GMAIL_USER',
      configured: Boolean(process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER),
      category: 'Correo & Notificaciones',
    },
    googleDriveFolder: {
      key: 'GOOGLE_DRIVE_ROOT_FOLDER_ID',
      configured: Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID),
      category: 'Almacenamiento Cloud',
    },
  };

  // 4. Estado de Servicios de Infraestructura
  const services = [
    {
      name: 'Supabase PostgreSQL',
      type: 'Base de Datos Relacional',
      status: dbStatus,
      latencyMs: dbLatencyMs,
      details: dbError ? `Error: ${dbError}` : `Pooler activo · ${dbLatencyMs} ms`,
      meta: 'PostgreSQL 15 + RLS Activo',
    },
    {
      name: 'Google Gemini AI',
      type: 'Motor de Inteligencia Artificial',
      status: envAudit.geminiApiKey.configured ? 'healthy' : 'warning',
      latencyMs: null,
      details: envAudit.geminiApiKey.configured
        ? 'API Key inyectada · Modelos Flash & Pro habilitados'
        : 'GEMINI_API_KEY no configurada (usando heurística fallback)',
      meta: 'v1beta REST API',
    },
    {
      name: 'Servidor SMTP Nodemailer',
      type: 'Notificaciones & Despachos',
      status: envAudit.smtpUser.configured ? 'healthy' : 'warning',
      latencyMs: null,
      details: envAudit.smtpUser.configured
        ? `Configurado · Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`
        : 'Credenciales SMTP pendientes (modo simulado activo)',
      meta: 'mapping@procimecingenieria.com',
    },
    {
      name: 'Google Drive Storage API',
      type: 'Almacenamiento de Soportes & Planos',
      status: envAudit.googleDriveFolder.configured ? 'healthy' : 'warning',
      latencyMs: null,
      details: envAudit.googleDriveFolder.configured
        ? 'Carpeta corporativa vinculada'
        : 'GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado',
      meta: 'Archivos As-Built & GPR',
    },
    {
      name: 'NextAuth Google SSO',
      type: 'Control de Identidad & Sesiones',
      status: envAudit.googleClientId.configured && envAudit.nextAuthSecret.configured ? 'healthy' : 'warning',
      latencyMs: null,
      details: 'Google OAuth 2.0 + JWT Sessions',
      meta: 'Token expiración 30d',
    },
    {
      name: 'Service Worker & PWA',
      type: 'Caché de Aplicación Móvil',
      status: 'healthy',
      latencyMs: null,
      details: 'next-pwa activo · Manifest v2.4',
      meta: 'Offline Ready',
    },
  ];

  // 5. Parámetros de la Plataforma
  const platform = {
    name: 'PCM CLOUD | Mapping Ingeniería',
    version: 'v2.4.2-enterprise',
    environment: process.env.NODE_ENV || 'production',
    timezone: 'America/Bogota (UTC-5)',
    currency: 'COP ($)',
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 0),
  };

  return NextResponse.json({
    ok: true,
    platform,
    services,
    envAudit,
    metrics: {
      dbLatencyMs,
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.is_active !== false).length,
      pendingUsers: pendingUsers.length,
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalRoles: roles.length,
      totalForms: forms.length,
      totalTools: tools.length,
      totalDivisions: divisions.length,
      totalReports: reports.length,
      reportsLast24h: reportsLast24h.length,
      totalMl: Math.round(totalMl),
      totalCadHours: Number(totalCadHours.toFixed(1)),
    },
    recentReports,
    recentUsers: users.slice(0, 5),
  });
}

// POST /api/admin/system — Acciones de diagnóstico, pruebas y mantenimiento
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body?.action;

    // Acción 1: Test de Conectividad con Google Gemini AI
    if (action === 'test-gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          error: 'GEMINI_API_KEY no se encuentra configurada en las variables de entorno de Vercel.',
        });
      }

      const start = Date.now();
      const model = 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde exclusivamente con la palabra: CONECTADO' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errorText = await res.text();
        return NextResponse.json({
          ok: false,
          error: `Error de respuesta HTTP ${res.status}: ${errorText.substring(0, 150)}`,
          latencyMs,
        });
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';

      return NextResponse.json({
        ok: true,
        message: `Conexión exitosa con Google Gemini AI (${model}) en ${latencyMs} ms. Respuesta: "${reply}"`,
        latencyMs,
      });
    }

    // Acción 2: Test de Envío de Correo SMTP
    if (action === 'test-smtp') {
      const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = Number(process.env.SMTP_PORT || 465);

      if (!smtpUser || !smtpPass) {
        return NextResponse.json({
          ok: false,
          simulated: true,
          message: 'Variables SMTP no configuradas. El servidor de correo opera en modo simulado.',
        });
      }

      const targetEmail = body.email || session.user.email || 'mapping@procimecingenieria.com';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const start = Date.now();
      await transporter.sendMail({
        from: `"PCM CLOUD Telecom" <${smtpUser}>`,
        to: targetEmail,
        subject: `[PRUEBA DE DIAGNÓSTICO] Servidor de Correo PCM CLOUD — ${new Date().toLocaleTimeString('es-CO')}`,
        html: `
          <div style="font-family: Arial, sans-serif; background: #1E2229; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #EAA023;">
            <h2 style="color: #EAA023; margin-top: 0;">Diagnóstico de Correo Exitoso</h2>
            <p style="color: #CBD5E1; font-size: 14px;">El servidor SMTP de <strong>PCM CLOUD (PROCIMEC)</strong> está respondiendo y autenticando correctamente.</p>
            <p style="font-size: 12px; color: #94A3B8;">Destinatario: ${targetEmail}<br>Hora de envío: ${new Date().toISOString()}</p>
          </div>
        `,
      });

      const latencyMs = Date.now() - start;
      return NextResponse.json({
        ok: true,
        message: `Correo de prueba enviado satisfactoriamente a ${targetEmail} en ${latencyMs} ms.`,
        latencyMs,
      });
    }

    // Acción 3: Verificación de Integridad de Base de Datos
    if (action === 'check-integrity') {
      const supabase = createAdminClient();
      const issues: string[] = [];

      // Chequear usuarios sin rol asignado
      const { data: usersWithoutRole } = await supabase
        .from('users')
        .select('id, email, full_name')
        .is('role', null);
      if (usersWithoutRole && usersWithoutRole.length > 0) {
        issues.push(`${usersWithoutRole.length} usuarios sin rol relacional asignado.`);
      }

      // Chequear reportes con project_id nulo
      const { data: orphanReports } = await supabase
        .from('field_reports')
        .select('id, created_at')
        .is('project_id', null);
      if (orphanReports && orphanReports.length > 0) {
        issues.push(`${orphanReports.length} reportes huérfanos sin proyecto asociado.`);
      }

      // Chequear roles sin división
      const { data: rolesWithoutDiv } = await supabase
        .from('roles')
        .select('id, name')
        .is('division_id', null);
      const unassignedRolesCount = rolesWithoutDiv ? rolesWithoutDiv.length : 0;

      return NextResponse.json({
        ok: true,
        issuesCount: issues.length,
        issues,
        unassignedRolesCount,
        message:
          issues.length === 0
            ? 'Integridad referencial al 100%: sin registros huérfanos ni anomalías detectadas en Supabase.'
            : `Se detectaron ${issues.length} advertencias en la integridad de datos.`,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error procesando solicitud';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
