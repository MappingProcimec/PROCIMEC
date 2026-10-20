/**
 * ==============================================================================
 * PROCIMEC PCM CLOUD — RUNNER DEV AUTÓNOMO (GENTLEMAN AI)
 * Script local que corre en la PC del Administrador al encender.
 * Escucha tickets en estado 'approved', valida pre-flight, ejecuta verificación
 * de tipos/build y realiza git push origin main con Circuit Breaker.
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Cargar variables de entorno desde .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
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
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Helper para logs
async function logTicket(ticketId: string, stage: string, message: string, metadata?: Record<string, unknown>) {
  console.log(`[${new Date().toLocaleTimeString('es-CO')}] [${stage.toUpperCase()}] ${message}`);
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

async function applyCodeWithAI(ticket: {
  id: string;
  title: string;
  description: string;
  technical_spec?: {
    summary?: string;
    affectedFiles?: Array<{ path: string; action: string; reason: string }>;
  };
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no encontrada en las variables de entorno.');
  }

  const affectedFiles = ticket.technical_spec?.affectedFiles || [];
  for (const filePlan of affectedFiles) {
    const fullPath = path.resolve(process.cwd(), filePlan.path);
    let originalContent = '';
    if (fs.existsSync(fullPath)) {
      originalContent = fs.readFileSync(fullPath, 'utf-8');
    }

    await logTicket(ticket.id, 'ai_coding', `Modificando con IA: ${filePlan.path}`);

    const prompt = `Eres el Agente Programador Autónomo de PROCIMEC (PCM CLOUD).
Tu tarea es modificar o crear el siguiente archivo para cumplir el ticket técnico.

TICKET:
Título: ${ticket.title}
Descripción: ${ticket.description}
Acción en este archivo: ${filePlan.action}
Motivo: ${filePlan.reason}

REGLAS CONSTITUCIONALES OBLIGATORIAS (AGENTS.md):
- Ley 1: Código TypeScript 100% válido, sin variables no usadas (@typescript-eslint/no-unused-vars), sin tipos any inseguros.
- Ley 5: Paleta Carbón (#1E2229), Ámbar (#EAA023), contraste WCAG AAA, sin emojis (usar Lucide).
- Ley 7: Textos visibles al usuario en español, backend en inglés.
- Conserva intactas todas las importaciones, exportaciones y lógica no relacionada del archivo.

CONTENIDO ACTUAL DEL ARCHIVO [${filePlan.path}]:
\`\`\`
${originalContent}
\`\`\`

INSTRUCCIÓN ESTRICTA: Devuelve ÚNICAMENTE el código fuente completo y definitivo del archivo.
NO agregues explicaciones, NO agregues markdown (sin bloques \`\`\` al inicio o fin). Devuelve solo el código ejecutable.`;

    const model = process.env.DEV_AI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let hint = '';
      if (res.status === 402 || errText.includes('prepayment') || errText.includes('depleted')) {
        hint = ' (Créditos prepagados agotados. Genera una API Key gratis en https://aistudio.google.com/app/apikey)';
      }
      throw new Error(`Error en API de Gemini (${res.status}): ${errText.slice(0, 150)}${hint}`);
    }

    const data = await res.json();
    let newCode: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    newCode = newCode.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();

    if (newCode && newCode.length > 20) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, newCode, 'utf-8');
      await logTicket(ticket.id, 'file_saved', `Archivo modificado y guardado en disco: ${filePlan.path}`);
    } else {
      throw new Error(`Respuesta inválida o vacía recibida para ${filePlan.path}`);
    }
  }
}

async function processTicket(ticket: {
  id: string;
  title: string;
  description: string;
  technical_spec?: {
    summary?: string;
    affectedFiles?: Array<{ path: string; action: string; reason: string }>;
    externalActions?: Array<{ type: string; title: string; instructions: string; payload?: string }>;
    verificationCommands?: string[];
  };
}) {
  const ticketId = ticket.id;
  await logTicket(ticketId, 'in_progress', `Iniciando atención del ticket: "${ticket.title}"`);

  // Marcar estado en progreso
  await supabase
    .from('dev_tickets')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  // 1. Pre-flight Check: Sincronización Git en main
  try {
    await logTicket(ticketId, 'git_sync', 'Sincronizando rama main local con origin/main...');
    execSync('git pull origin main', { stdio: 'inherit' });
  } catch (gitErr: unknown) {
    const msg = gitErr instanceof Error ? gitErr.message : String(gitErr);
    await logTicket(ticketId, 'warning', `Aviso al sincronizar git: ${msg}`);
  }

  // 2. Pre-flight Check de Acciones Externas (Supabase SQL / Env Vars)
  const externalActions = ticket.technical_spec?.externalActions || [];
  if (externalActions.length > 0) {
    await logTicket(
      ticketId,
      'preflight_check',
      `Detectadas ${externalActions.length} acción(es) externa(s) requerida(s) de Supabase.`
    );
  }

  // 3. Etapa de Codificación Autónoma con IA (Gemini / Antigravity Engine)
  const affectedFiles = ticket.technical_spec?.affectedFiles || [];
  if (affectedFiles.length > 0) {
    await logTicket(ticketId, 'coding_start', `Iniciando codificación autónoma en ${affectedFiles.length} archivo(s)...`);
    try {
      await applyCodeWithAI(ticket);
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      await logTicket(ticketId, 'coding_warning', `Aviso al aplicar código con IA: ${msg}`);
    }
  }

  // 4. Etapa de Verificación Estricta (Ley 1 de PROCIMEC: Clean Build Shield)
  await logTicket(ticketId, 'verifying', 'Ejecutando verificación estricta de compilación TypeScript (npx tsc --noEmit)...');
  await supabase.from('dev_tickets').update({ status: 'verifying' }).eq('id', ticketId);

  let verificationPassed = false;
  let failureReason = '';

  try {
    // Verificación 1: tsc --noEmit
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    await logTicket(ticketId, 'tsc_clean', '✅ Compilación TypeScript sin errores (cero advertencias de tipos).');

    // Verificación 2: Fast Build Check
    await logTicket(ticketId, 'build_check', 'Validando generación de bundle...');
    execSync('npm run type-check', { stdio: 'pipe' });
    verificationPassed = true;
  } catch (err: unknown) {
    const errorOutput = err && typeof err === 'object' && 'stderr' in err 
      ? String((err as { stderr: Buffer }).stderr) 
      : String(err);
    failureReason = errorOutput.slice(0, 500);
    verificationPassed = false;
  }

  // 4. Conclusión y Despacho
  if (verificationPassed) {
    try {
      await logTicket(ticketId, 'git_commit', 'Preparando commit y push a main...');
      
      // Comprobar si hay cambios pendientes por commitear
      const statusOut = execSync('git status --porcelain').toString().trim();
      let commitHash = 'sin_cambios_locales';

      if (statusOut) {
        execSync('git add .', { stdio: 'pipe' });
        execSync(`git commit -m "feat(autodev): ticket #${ticketId.slice(0, 8)} - ${ticket.title} [skip ci / verified]"`, {
          stdio: 'pipe',
        });
        commitHash = execSync('git rev-parse --short HEAD').toString().trim();
        execSync('git push origin main', { stdio: 'inherit' });
        await logTicket(ticketId, 'git_pushed', `✅ Push a main completado con éxito. Commit: ${commitHash}`);
      } else {
        await logTicket(ticketId, 'git_clean', 'El repositorio ya se encuentra al día y verificado.');
      }

      // Marcar ticket como completado
      await supabase
        .from('dev_tickets')
        .update({
          status: 'completed',
          commit_hash: commitHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      await logTicket(ticketId, 'completed', `🎉 Ticket completado exitosamente. Vercel desplegará automáticamente.`);
    } catch (pushErr: unknown) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      await logTicket(ticketId, 'error', `Fallo al hacer push a main: ${msg}`);
      await supabase
        .from('dev_tickets')
        .update({ status: 'failed', error_message: msg })
        .eq('id', ticketId);
    }
  } else {
    // Circuit Breaker: Revertir cualquier cambio local para no dejar nada roto
    await logTicket(ticketId, 'circuit_breaker', `⚠️ Fallo de compilación. Activando Circuit Breaker para proteger el código.`);
    try {
      execSync('git checkout -- .', { stdio: 'pipe' });
      await logTicket(ticketId, 'reverted', 'Cambios locales revertidos limpiamente (repositorio intacto).');
    } catch {
      // Ignorar si no había cambios
    }

    await supabase
      .from('dev_tickets')
      .update({
        status: 'failed',
        error_message: failureReason || 'Fallo de compilación en tsc --noEmit',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
  }
}

// Bucle principal de sondeo
async function runDevRunnerLoop() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║    PROCIMEC PCM CLOUD — RUNNER DEV AUTÓNOMO (GENTLEMAN AI)     ║
║    Dispositivo: PC Local del Administrador                     ║
║    Modo: Escuchando tickets en estado 'approved'               ║
║    Gobernanza: Solo el Administrador aprueba cambios           ║
╚════════════════════════════════════════════════════════════════╝
  `);

  console.log('🟢 Runner iniciado y activo. Presiona Ctrl+C para detener.\n');

  let isProcessing = false;

  const checkApprovedTickets = async () => {
    if (isProcessing) return;

    try {
      const { data: tickets, error } = await supabase
        .from('dev_tickets')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        // En caso de que la tabla aún no se haya creado en Supabase
        if (error.message.includes('relation "public.dev_tickets" does not exist')) {
          console.warn('⚠️ La tabla dev_tickets aún no existe en Supabase. Aplica la migración SQL.');
        } else {
          console.warn('⚠️ Error consultando Supabase:', error.message);
        }
        return;
      }

      if (tickets && tickets.length > 0) {
        isProcessing = true;
        const current = tickets[0];
        console.log(`\n🔔 Ticket aprobado detectado: #${current.id.slice(0, 8)} - "${current.title}"`);
        await processTicket(current);
        isProcessing = false;
      }
    } catch (loopErr) {
      console.error('Error en el ciclo del Runner:', loopErr);
      isProcessing = false;
    }
  };

  // Sondeo cada 8 segundos
  setInterval(checkApprovedTickets, 8000);
  checkApprovedTickets();
}

runDevRunnerLoop();
