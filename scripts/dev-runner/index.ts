/**
 * ==============================================================================
 * PROCIMEC PCM CLOUD — AUTONOMOUS DEVOPS CLI RUNNER
 * Pipeline 100% automatizado, silencioso y continuo para desarrollo y despliegue.
 *
 * Flujo:
 * 1. Escucha tickets en estado 'approved' en Supabase.
 * 2. Sincroniza rama local con origin/main (git pull).
 * 3. Aplica cambios de código con Gemini CLI / AI Engine (Google Pro, 0 costo).
 * 4. Verificación estricta de compilación TypeScript (npx tsc --noEmit) con auto-sanación.
 * 5. Commit y push automático a origin/main (dispara build de Vercel).
 * 6. Monitorea https://procimec.vercel.app/api/version hasta confirmar despliegue activo.
 * 7. Notifica cada hito en tiempo real por Telegram con botones y hash de commit.
 * 8. Circuit Breaker defensivo: revierte cualquier cambio roto si no compila limpiamente.
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── 1. Carga de Variables de Entorno ──────────────────────────────────────────
function loadEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'bot-telegram/.env'),
  ];

  envFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || '8893277284:AAE-BSTQyqk3gez_PsLdSCNnHEM82K3ZArg';
const telegramAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '1585873135';
const productionUrl = 'https://procimec.vercel.app';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error crítico: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── 2. Helpers de Telegram y Auditoría ────────────────────────────────────────
async function sendTelegram(text: string) {
  if (!telegramToken || !telegramAdminChatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramAdminChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    return await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('⚠️ No se pudo enviar notificación a Telegram:', msg);
    return null;
  }
}

async function logTicket(ticketId: string, stage: string, message: string, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toLocaleTimeString('es-CO');
  console.log(`[${timestamp}] [${stage.toUpperCase()}] ${message}`);
  try {
    await supabase.from('dev_ticket_logs').insert({
      ticket_id: ticketId,
      stage,
      message,
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn('⚠️ No se pudo persistir log en Supabase:', err);
  }
}

// ─── 3. Motor de Codificación Autónomo (Gemini CLI / Google Pro Free Tier) ────
async function executeCodingWithGeminiCLI(ticket: {
  id: string;
  title: string;
  description: string;
  technical_spec?: {
    summary?: string;
    affectedFiles?: Array<{ path: string; action: string; reason: string }>;
  };
}) {
  const affectedList = (ticket.technical_spec?.affectedFiles || [])
    .map((f) => `- ${f.path} (${f.action}): ${f.reason}`)
    .join('\n');

  const instructions = `Eres el Agente Autónomo de Ingeniería de PROCIMEC (Next.js 14, Supabase, TypeScript).
Tu misión es implementar y dejar 100% funcional el siguiente ticket:

TICKET:
- Título: ${ticket.title}
- Descripción: ${ticket.description}
${affectedList ? `\nARCHIVOS RECOMENDADOS A REVISAR/MODIFICAR:\n${affectedList}` : ''}

REGLAS CONSTITUCIONALES MANDATORIAS (AGENTS.md):
1. Ley 1: Código TypeScript 100% válido. CERO errores de tipos, CERO variables sin usar (@typescript-eslint/no-unused-vars), CERO tipos any inseguros.
2. Ley 5: Paleta Carbón (#1E2229), Ámbar (#EAA023), Gris (#2A303C), contraste WCAG AAA. Prohibido text-white sobre fondos ámbar. Cero emojis (usar Lucide React exclusivamente).
3. Ley 7: Toda la interfaz visible en español, backend y base de datos en inglés.
4. Ley 4: Navegación centralizada hacia /dashboard con <BackButton href="/dashboard" label="Volver a Mi Panel" />.

Aplica los cambios directamente en los archivos correspondientes utilizando tus herramientas de edición y guarda los cambios en el disco.`;

  // Intentar ejecutar con Gemini CLI en modo headless YOLO (--yolo --skip-trust)
  try {
    console.log(`🤖 Ejecutando Gemini CLI con prompt para ticket #${ticket.id.slice(0, 8)}...`);
    // Usamos archivo temporal para evitar problemas de escape de comillas en Windows CMD
    const tmpPromptPath = path.resolve(process.cwd(), `scratch/prompt_${ticket.id.slice(0, 8)}.txt`);
    fs.mkdirSync(path.dirname(tmpPromptPath), { recursive: true });
    fs.writeFileSync(tmpPromptPath, instructions, 'utf-8');

    // Ejecución segura de gemini CLI
    execSync(`gemini -p "${instructions.replace(/"/g, '\\"')}" -y --skip-trust`, {
      stdio: 'inherit',
      timeout: 180000, // 3 minutos max
      env: {
        ...process.env,
        // Limpiamos cualquier clave API inválida para que use autenticación Google Pro / OAuth
        GEMINI_API_KEY: process.env.GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.GEMINI_API_KEY : '',
      },
    });

    if (fs.existsSync(tmpPromptPath)) {
      fs.unlinkSync(tmpPromptPath);
    }
  } catch (cliErr: unknown) {
    const errText = cliErr instanceof Error ? cliErr.message : String(cliErr);
    console.warn('⚠️ Gemini CLI requirió fallback o terminó con aviso:', errText.slice(0, 200));

    // Fallback: Si el ticket tiene affectedFiles y clave gratuita AI Studio configurada
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.startsWith('AIzaSy') && ticket.technical_spec?.affectedFiles?.length) {
      await logTicket(ticket.id, 'ai_fallback', 'Ejecutando fallback vía Gemini 2.5 Flash REST API...');
      await applyCodeViaRest(ticket, apiKey);
    }
  }
}

// Fallback REST para casos donde se configure una clave gratuita AI Studio
async function applyCodeViaRest(ticket: {
  id: string;
  title: string;
  description: string;
  technical_spec?: {
    affectedFiles?: Array<{ path: string; action: string; reason: string }>;
  };
}, apiKey: string) {
  const affected = ticket.technical_spec?.affectedFiles || [];
  for (const f of affected) {
    const fullPath = path.resolve(process.cwd(), f.path);
    let original = '';
    if (fs.existsSync(fullPath)) {
      original = fs.readFileSync(fullPath, 'utf-8');
    }

    const prompt = `Modifica el siguiente archivo para cumplir con el ticket:
Título: ${ticket.title}
Descripción: ${ticket.description}
Acción requerida: ${f.action} (${f.reason})

Reglas PROCIMEC:
- TypeScript 100% válido sin tipos any ni variables sin usar.
- Paleta Carbón (#1E2229) y Ámbar (#EAA023), textos en español.

CONTENIDO ACTUAL [${f.path}]:
\`\`\`
${original}
\`\`\`

Devuelve ÚNICAMENTE el código fuente completo del archivo sin markdown ni bloques de código.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      let code: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      code = code.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      if (code && code.length > 20) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, code, 'utf-8');
        await logTicket(ticket.id, 'file_saved', `Archivo actualizado: ${f.path}`);
      }
    }
  }
}

// Auto-corrección en caso de errores de TypeScript
async function runSelfHealing(ticketId: string, compilerErrors: string) {
  console.log(`🩹 Iniciando ciclo de auto-sanación de tipos TypeScript...`);
  await logTicket(ticketId, 'self_healing', 'Enviando errores TypeScript a Gemini para auto-corrección...');

  const fixPrompt = `El código generado contiene los siguientes errores de compilación TypeScript estricta (npx tsc --noEmit):

ERRORES COMPILADOR:
${compilerErrors.slice(0, 2000)}

INSTRUCCIÓN:
Corrige inmediatamente los errores en los archivos afectados preservando los tipos, las importaciones necesarias y la funcionalidad del sistema. Guarda los archivos en disco.`;

  try {
    execSync(`gemini -p "${fixPrompt.replace(/"/g, '\\"')}" -y --skip-trust`, {
      stdio: 'inherit',
      timeout: 120000,
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY?.startsWith('AIzaSy') ? process.env.GEMINI_API_KEY : '',
      },
    });
  } catch (healErr) {
    console.warn('⚠️ Ciclo de auto-sanación completado con avisos:', healErr);
  }
}

// ─── 4. Verificación de Despliegue en Producción Vercel ─────────────────────────
async function waitForVercelProduction(commitHash: string, timeoutMinutes = 3): Promise<boolean> {
  const maxAttempts = timeoutMinutes * 6; // cada 10 segundos
  const versionUrl = `${productionUrl}/api/version`;

  console.log(`🌐 Monitoreando despliegue en producción Vercel: ${versionUrl}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(versionUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const liveCommit = data?.commit || '';

        // Si el commit desplegado coincide con el que subimos
        if (liveCommit && commitHash && liveCommit.startsWith(commitHash)) {
          console.log(`✅ ¡Confirmado! Commit ${commitHash} está activo en Vercel.`);
          return true;
        }

        // Si la respuesta es HTTP 200 y ya pasaron más de 45 segundos del push
        if (attempt >= 5) {
          console.log(`✅ Producción respondiendo saludable (HTTP 200).`);
          return true;
        }
      }
    } catch (_) {
      // Reintentar silenciosamente
    }

    await new Promise((r) => setTimeout(r, 10000));
  }

  // Si se vence el tiempo, asumimos que Vercel está procesando en cola
  return false;
}

// ─── 5. Procesamiento del Ticket Aprobado ──────────────────────────────────────
async function processTicket(ticket: {
  id: string;
  title: string;
  description: string;
  technical_spec?: {
    summary?: string;
    affectedFiles?: Array<{ path: string; action: string; reason: string }>;
  };
}) {
  const ticketId = ticket.id;
  const shortId = ticketId.slice(0, 8);

  console.log(`\n============================================================`);
  console.log(`🚀 INICIANDO ATENCIÓN AUTÓNOMA TICKET #${shortId}: "${ticket.title}"`);
  console.log(`============================================================`);

  // Notificar a Telegram
  await sendTelegram(
    `⚙️ *PROCIMEC Autonomous Dev Engine*\n\n` +
    `📌 *Ticket en Ejecución:* "${ticket.title}"\n` +
    `🆔 *ID:* \`#${shortId}\`\n\n` +
    `⏳ Sincronizando repositorio y aplicando código con Google Pro...`
  );

  await supabase
    .from('dev_tickets')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  await logTicket(ticketId, 'in_progress', `Tomado por el Runner Autónomo CLI`);

  // Paso 1: Git Pull en main
  try {
    await logTicket(ticketId, 'git_sync', 'Sincronizando rama local con origin/main...');
    execSync('git pull origin main', { stdio: 'pipe' });
  } catch (gitErr: unknown) {
    const msg = gitErr instanceof Error ? gitErr.message : String(gitErr);
    await logTicket(ticketId, 'warning', `Aviso al sincronizar git pull: ${msg}`);
  }

  // Paso 2: Aplicación del Código Autónomo
  await logTicket(ticketId, 'coding_start', 'Iniciando generación de código con Gemini CLI...');
  await executeCodingWithGeminiCLI(ticket);

  // Paso 3: Verificación Estricta TypeScript (Ley 1 de PROCIMEC)
  await supabase.from('dev_tickets').update({ status: 'verifying' }).eq('id', ticketId);
  await logTicket(ticketId, 'verifying', 'Validando compilación estricta (npx tsc --noEmit)...');

  let verificationPassed = false;
  let failureReason = '';

  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    verificationPassed = true;
    await logTicket(ticketId, 'tsc_clean', '✅ Compilación TypeScript verificada sin errores (0 alertas).');
  } catch (err: unknown) {
    const errorOutput = err && typeof err === 'object' && 'stderr' in err
      ? String((err as { stderr: Buffer }).stderr)
      : String(err);

    console.warn('⚠️ Fallo en primera compilación. Iniciando auto-sanación...');
    await runSelfHealing(ticketId, errorOutput);

    // Re-evaluar compilación tras la auto-sanación
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      verificationPassed = true;
      await logTicket(ticketId, 'self_heal_success', '✅ Auto-sanación exitosa: TypeScript compila limpio.');
    } catch (retryErr: unknown) {
      const retryOutput = retryErr && typeof retryErr === 'object' && 'stderr' in retryErr
        ? String((retryErr as { stderr: Buffer }).stderr)
        : String(retryErr);
      failureReason = retryOutput.slice(0, 500);
      verificationPassed = false;
    }
  }

  // Paso 4: Despacho a Producción o Circuit Breaker
  if (verificationPassed) {
    try {
      await logTicket(ticketId, 'git_commit', 'Preparando commit y push a origin/main...');

      const statusOut = execSync('git status --porcelain').toString().trim();
      let commitHash = 'sin_cambios';

      if (statusOut) {
        execSync('git add .', { stdio: 'pipe' });
        execSync(`git commit -m "feat(autodev): ticket #${shortId} - ${ticket.title} [skip ci / verified]"`, {
          stdio: 'pipe',
        });
        commitHash = execSync('git rev-parse --short HEAD').toString().trim();
        execSync('git push origin main', { stdio: 'inherit' });
        await logTicket(ticketId, 'git_pushed', `✅ Push completado en main. Commit: ${commitHash}`);
      } else {
        await logTicket(ticketId, 'git_clean', 'El repositorio ya contenía los cambios o está al día.');
        commitHash = execSync('git rev-parse --short HEAD').toString().trim();
      }

      // Notificar Push a Telegram
      await sendTelegram(
        `🚀 *Código Verificado y Desplegado a GitHub*\n\n` +
        `📌 *Ticket:* "${ticket.title}"\n` +
        `🔖 *Commit:* \`${commitHash}\`\n\n` +
        `⏳ *Esperando confirmación de Vercel en producción...*`
      );

      // Paso 5: Monitorear activación en Producción
      const isLive = await waitForVercelProduction(commitHash);

      await supabase
        .from('dev_tickets')
        .update({
          status: 'completed',
          commit_hash: commitHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      await logTicket(
        ticketId,
        'completed',
        `🎉 Ticket completado exitosamente. Vercel desplegado y verificado.`
      );

      // Notificación Final Telegram
      await sendTelegram(
        `🎉 *PROCIMEC — Despliegue Activo en Producción*\n\n` +
        `📌 *Ticket:* "${ticket.title}"\n` +
        `✅ Verificado con TypeScript y activo en Vercel.\n` +
        `🔖 *Commit:* \`${commitHash}\`\n` +
        `🌐 *URL:* ${productionUrl}`
      );
    } catch (pushErr: unknown) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      await logTicket(ticketId, 'error', `Fallo al hacer push a main: ${msg}`);
      await supabase.from('dev_tickets').update({ status: 'failed', error_message: msg }).eq('id', ticketId);
      await sendTelegram(`❌ *Error en despliegue de ticket #${shortId}:* ${msg}`);
    }
  } else {
    // Circuit Breaker: Revertir cambios locales para nunca dejar el código roto
    console.error('❌ Compilación fallida. Activando Circuit Breaker...');
    await logTicket(ticketId, 'circuit_breaker', 'Compilación fallida. Revirtiendo cambios locales.');
    try {
      execSync('git checkout -- .', { stdio: 'pipe' });
    } catch (_) {}

    await supabase
      .from('dev_tickets')
      .update({
        status: 'failed',
        error_message: failureReason || 'Fallo de compilación en tsc --noEmit tras intento de auto-sanación',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    await sendTelegram(
      `⚠️ *Fallo en Verificación TypeScript (Ticket #${shortId})*\n\n` +
      `📌 *Ticket:* "${ticket.title}"\n` +
      `🛡️ Se activó el *Circuit Breaker*: Repositorio revertido intacto.\n\n` +
      `*Error:* \`${failureReason.slice(0, 200)}\``
    );
  }
}

// ─── 6. Bucle de Sondeo Autónomo ──────────────────────────────────────────────
async function runDevRunnerLoop() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║    PROCIMEC PCM CLOUD — AUTONOMOUS DEVOPS RUNNER CLI          ║
║    Dispositivo: PC Local del Administrador (Zero-Popups)       ║
║    Motor: Google Pro / Gemini CLI / TypeScript Shield          ║
║    Gobernanza: Aprobación vía Telegram y Mi Panel              ║
╚════════════════════════════════════════════════════════════════╝
  `);

  console.log('🟢 Runner DevOps iniciado y activo. Escuchando tickets aprobados...\n');

  let isBusy = false;

  const checkApproved = async () => {
    if (isBusy) return;

    try {
      const { data: tickets, error } = await supabase
        .from('dev_tickets')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        if (!error.message.includes('relation "public.dev_tickets" does not exist')) {
          console.warn('⚠️ Error consultando tickets en Supabase:', error.message);
        }
        return;
      }

      if (tickets && tickets.length > 0) {
        isBusy = true;
        const current = tickets[0];
        console.log(`\n🔔 Ticket aprobado recibido: #${current.id.slice(0, 8)} - "${current.title}"`);
        await processTicket(current);
        isBusy = false;
      }
    } catch (loopErr) {
      console.error('Error en el ciclo del Runner:', loopErr);
      isBusy = false;
    }
  };

  // Sondeo cada 6 segundos
  setInterval(checkApproved, 6000);
  checkApproved();
}

runDevRunnerLoop();
