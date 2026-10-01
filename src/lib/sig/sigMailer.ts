import nodemailer from 'nodemailer';
import { SigChangeData, generateSigChangePdf } from '@/lib/sig-templates';

export interface SendSigChangeEmailParams {
  submitterEmail: string;
  submitterName: string;
  recordId: string;
  changeData: SigChangeData;
  notifySubmitter?: boolean;
  notifyHseqLeader?: boolean;
}

export interface RenderSigChangeEmailParams {
  changeData: SigChangeData;
  submitterName: string;
  hasPdfAttachment?: boolean;
}

export const HSEQ_LEADER_EMAIL = 'liderhseq@procimecingenieria.com';

/**
 * Renderiza la plantilla HTML oficial del correo institucional para el control de cambios SIG
 */
export function renderSigChangeEmailHtml(params: RenderSigChangeEmailParams): string {
  const cleanDate = (params.changeData.identification_date || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const cleanPerson = (params.changeData.identifier_name || params.submitterName || 'Colaborador').trim();
  const originsText = (params.changeData.origins || []).join(', ') || 'Gestión del cambio';
  const elementsText = Array.isArray(params.changeData.required_elements)
    ? params.changeData.required_elements.join(', ')
    : (params.changeData.required_elements || 'No especificados');
  const activitiesCount = (params.changeData.activities || []).length;
  const risksCount = (params.changeData.risks || []).length;
  const hasPdf = params.hasPdfAttachment ?? true;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Análisis y Planificación de Cambio — FOR-SIG-001</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F1F5F9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #E2E8F0; max-width: 640px; width: 100%;">
          
          <!-- Banner Superior Carbón Técnico con Acento Ámbar -->
          <tr>
            <td style="background-color: #1E2229; padding: 24px 32px; border-bottom: 4px solid #EAA023;">
              <table width="100%">
                <tr>
                  <td>
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 18px; letter-spacing: 0.5px; font-weight: 700;">PROCIMEC INGENIERÍA S.A.S.</h1>
                    <p style="color: #EAA023; margin: 4px 0 0 0; font-size: 13px; font-weight: 600;">SISTEMA INTEGRADO DE GESTIÓN (SIG) — CONTROL DE CAMBIOS</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; background-color: #FEF9EC; border: 1px solid #FDE68A; color: #B45309; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px;">
                FORMATO OFICIAL: FOR-SIG-001 (VERSIÓN 1)
              </div>

              <h2 style="color: #0F172A; font-size: 18px; margin: 0 0 16px 0; font-weight: 700;">
                Registro de Análisis y Planificación del Cambio
              </h2>

              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Se ha registrado exitosamente un nuevo formato de gestión y control del cambio en la plataforma corporativa PCM CLOUD. A continuación se presenta el resumen técnico oficial:
              </p>

              <!-- Ficha de Datos del Registro -->
              <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; width: 35%; font-weight: 600;">Código Oficial:</td>
                  <td style="color: #0F172A; font-family: monospace; font-weight: 700;">${params.changeData.official_code || 'FOR-SIG-001'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Persona que Identifica:</td>
                  <td style="color: #0F172A; font-weight: 600;">${cleanPerson}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Cargo y Proceso:</td>
                  <td style="color: #0F172A;">${params.changeData.identifier_position || 'N/A'} — ${params.changeData.identifier_process || 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Fecha de Identificación:</td>
                  <td style="color: #0F172A; font-family: monospace;">${params.changeData.identification_date || cleanDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Procesos Afectados:</td>
                  <td style="color: #0F172A;">${params.changeData.affected_processes || 'Operaciones, HSEQ'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Elementos Requeridos:</td>
                  <td style="color: #0F172A;">${elementsText}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="color: #64748B; font-weight: 600;">Orígenes del Cambio:</td>
                  <td style="color: #0F172A;">${originsText}</td>
                </tr>
                <tr>
                  <td style="color: #64748B; font-weight: 600;">Plan de Acción y Riesgos:</td>
                  <td style="color: #0F172A;">${activitiesCount} actividades planificadas · ${risksCount} riesgos/oportunidades evaluados</td>
                </tr>
              </table>

              <!-- Bloque de Descripción -->
              <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid #EAA023; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                <strong style="color: #1E2229; font-size: 13px; display: block; margin-bottom: 6px;">Descripción del Cambio:</strong>
                <p style="color: #334155; font-size: 13px; line-height: 1.6; margin: 0;">
                  ${params.changeData.change_description || 'Sin descripción registrada.'}
                </p>
              </div>

              <!-- Bloque de Justificación -->
              <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid #1E2229; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <strong style="color: #1E2229; font-size: 13px; display: block; margin-bottom: 6px;">Justificación Técnica:</strong>
                <p style="color: #334155; font-size: 13px; line-height: 1.6; margin: 0;">
                  ${params.changeData.justification || 'Sin justificación registrada.'}
                </p>
              </div>

              <!-- Aprobación y Firmas -->
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #1E2229; margin-bottom: 8px; text-transform: uppercase;">
                  Cadena de Autorización y Firmas
                </div>
                <p style="font-size: 12px; color: #64748B; margin: 0 0 6px 0;">
                  <strong>Aprobador:</strong> ${params.changeData.approval_name || 'Pendiente de aprobación'} (${params.changeData.approval_position || 'Gerencia / Liderazgo'}) ${params.changeData.approval_signature ? '— ✓ Firmado digitalmente' : ''}
                </p>
                <p style="font-size: 12px; color: #64748B; margin: 0;">
                  <strong>Seguimiento:</strong> ${params.changeData.tracking_name || 'Pendiente de verificación'} (${params.changeData.tracking_position || 'Líder HSEQ'}) ${params.changeData.tracking_signature ? '— ✓ Firmado digitalmente' : ''}
                </p>
              </div>

              <!-- Botón CTA a la Consola de Auditoría -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://procimec.vercel.app/tools/forms-audit" target="_blank" style="background-color: #EAA023; color: #1E2229; font-weight: 700; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  🔍 Abrir en Consola de Auditoría General de Formularios
                </a>
              </div>

              ${hasPdf ? `
                <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #065F46;">
                  ✓ <strong>Archivo PDF Oficial Adjunto:</strong> Se adjunta a este correo el formato oficial <em>FOR-SIG-001_Analisis_Cambio.pdf</em> generado automáticamente con las firmas y plan de acción.
                </div>
              ` : ''}

              <!-- Pie de Firma Institucional -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; margin-top: 28px; text-align: center;">
                <p style="color: #64748B; font-size: 12px; margin: 0 0 4px 0;">
                  <strong>PROCIMEC INGENIERÍA S.A.S.</strong> · NIT: 802019658-9
                </p>
                <p style="color: #94A3B8; font-size: 11px; margin: 0;">
                  Este es un mensaje institucional generado automáticamente por la plataforma PCM CLOUD.
                </p>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Despacha la notificación por correo institucional para el control de cambios SIG
 */
export async function sendSigChangeNotificationEmail(
  params: SendSigChangeEmailParams
): Promise<{ ok: boolean; simulated?: boolean; message?: string }> {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  // Destinatarios configurables:
  // - Usuario que diligenció (si notifySubmitter !== false)
  // - Líder HSEQ (únicamente si notifyHseqLeader === true)
  const targetEmails: string[] = [];

  if (params.notifySubmitter !== false && params.submitterEmail) {
    targetEmails.push(params.submitterEmail.trim());
  }

  if (params.notifyHseqLeader && HSEQ_LEADER_EMAIL) {
    targetEmails.push(HSEQ_LEADER_EMAIL.trim());
  }

  const uniqueTargets = Array.from(new Set(targetEmails.filter(Boolean)));

  if (uniqueTargets.length === 0) {
    return {
      ok: true,
      message: 'No se seleccionaron destinatarios para el envío de correo.',
    };
  }

  const cleanDate = (params.changeData.identification_date || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const cleanPerson = (params.changeData.identifier_name || params.submitterName || 'Colaborador').trim();
  const subject = `[SIG PROCIMEC] Análisis y Planificación de Cambio — FOR-SIG-001 — ${cleanPerson} (${cleanDate})`;

  // Si no hay credenciales SMTP en el entorno, retornar simulación exitosa sin quebrar el flujo
  if (!smtpUser || !smtpPass) {
    console.warn('[sigMailer] Variables SMTP no configuradas (SMTP_USER/SMTP_PASS). Envío registrado de forma simulada para:', uniqueTargets.join(', '));
    return {
      ok: true,
      simulated: true,
      message: `Credenciales SMTP pendientes en variables de entorno. Envío simulado para: ${uniqueTargets.join(', ')}`,
    };
  }

  // Generar el PDF oficial en memoria para adjuntarlo al correo
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateSigChangePdf(params.changeData);
  } catch (pdfErr) {
    console.warn('[sigMailer] No se pudo generar buffer PDF para adjuntar:', pdfErr);
  }

  const html = renderSigChangeEmailHtml({
    changeData: params.changeData,
    submitterName: cleanPerson,
    hasPdfAttachment: Boolean(pdfBuffer),
  });

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `FOR-SIG-001_Analisis_Cambio_${cleanPerson.replace(/[^a-zA-Z0-9]/g, '_')}_${cleanDate}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from: `"PROCIMEC — Sistema Integrado de Gestión" <${smtpUser}>`,
      to: uniqueTargets.join(', '),
      subject,
      html,
      attachments,
    });

    console.log(`[SIG-MAILER] Notificación enviada exitosamente a: ${uniqueTargets.join(', ')}`);
    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[SIG-MAILER] Error despachando correo:', errorMsg);
    return { ok: false, message: errorMsg };
  }
}
