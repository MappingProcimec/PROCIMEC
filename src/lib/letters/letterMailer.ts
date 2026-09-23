import nodemailer from 'nodemailer';
import { HrLetterType, HrLetterData } from '@/types';
import { HR_LETTER_TYPES } from './docxTemplateEngine';

export interface SendHrLetterEmailParams {
  recipientEmail: string;
  recipientName: string;
  letterType: HrLetterType;
  letterTitle: string;
  radicado: string;
  data: HrLetterData;
  docxBuffer: Buffer;
  pdfBuffer: Buffer;
}

export const HR_ARCHIVE_EMAIL = 'ghumana@procimecingenieria.com';

export async function sendHrLetterEmail(
  params: SendHrLetterEmailParams
): Promise<{ ok: boolean; simulated?: boolean; message?: string }> {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  const meta = HR_LETTER_TYPES[params.letterType];
  const targetEmails = Array.from(
    new Set([params.recipientEmail, HR_ARCHIVE_EMAIL].filter(Boolean))
  );

  const cleanSubject = `[RRHH PROCIMEC] ${params.letterTitle} — Radicado: ${params.radicado} (${params.data.emp_nombre || params.recipientName})`;

  // Si no hay credenciales SMTP en el entorno, retornar respuesta simulada registrada de forma segura
  if (!smtpUser || !smtpPass) {
    console.warn('[letterMailer] Variables SMTP no configuradas. Envío simulado con éxito.');
    return {
      ok: true,
      simulated: true,
      message: 'Credenciales SMTP pendientes en variables de entorno. Envío registrado de forma simulada.',
    };
  }

  const safeFilenameBase = `${params.radicado}_${meta.title.replace(/[\s/]/g, '_')}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${params.letterTitle}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
    .container { max-width: 640px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background-color: #1E2229; padding: 28px 32px; border-bottom: 4px solid #EAA023; }
    .header h1 { margin: 0; font-size: 18px; color: #FFFFFF; letter-spacing: -0.02em; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 12px; color: #94A3B8; }
    .body-content { padding: 32px; }
    .title-badge { display: inline-block; background-color: #FEF9EC; border: 1px solid #FDE68A; color: #B45309; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; }
    .main-title { font-size: 20px; font-weight: 700; color: #1E2229; margin: 0 0 16px; }
    .greeting { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; }
    .details-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #E2E8F0; }
    .details-table tr:last-child td { border-bottom: none; }
    .details-table .label { font-weight: 600; color: #475569; width: 38%; }
    .details-table .value { color: #0F172A; font-family: monospace; font-size: 12px; }
    .notice-box { background-color: #F1F5F9; border-left: 4px solid #1E2229; padding: 14px 18px; border-radius: 4px; font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 28px; }
    .footer { background-color: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PROCIMEC INGENIERÍA SAS</h1>
      <p>Gestión del Talento Humano &middot; Plataforma Operacional Oficial</p>
    </div>
    <div class="body-content">
      <span class="title-badge">${meta.badge}</span>
      <h2 class="main-title">${params.letterTitle}</h2>
      <p class="greeting">
        Estimado(a) <strong>${params.recipientName}</strong>,<br>
        Se ha completado con éxito la elaboración y emisión de su documento formal de Recursos Humanos a través de la plataforma PROCIMEC. Adjunto a este mensaje encontrará el documento en sus dos formatos oficiales:
      </p>

      <table class="details-table">
        <tr>
          <td class="label">Número de Radicado</td>
          <td class="value"><strong>${params.radicado}</strong></td>
        </tr>
        <tr>
          <td class="label">Tipo de Documento</td>
          <td class="value">${meta.title}</td>
        </tr>
        <tr>
          <td class="label">Colaborador / Empleado</td>
          <td class="value">${params.data.emp_nombre || 'N/A'} (C.C. ${params.data.emp_documento || 'N/A'})</td>
        </tr>
        <tr>
          <td class="label">Fecha de Expedición</td>
          <td class="value">${params.data.carta_fecha}</td>
        </tr>
        ${params.data.proy_nombre ? `
        <tr>
          <td class="label">Proyecto Asignado</td>
          <td class="value">${params.data.proy_nombre}</td>
        </tr>` : ''}
        ${params.data.dest_empresa ? `
        <tr>
          <td class="label">Entidad Destinataria</td>
          <td class="value">${params.data.dest_empresa}</td>
        </tr>` : ''}
      </table>

      <div class="notice-box">
        <strong>Archivos adjuntos disponibles:</strong><br>
        1. <strong>Documento Word (.docx)</strong>: Formato editable preservando tablas y membretes.<br>
        2. <strong>Documento Oficial (.pdf)</strong>: Versión autenticada lista para impresión, radicación externa o trámite institucional.
      </div>
    </div>
    <div class="footer">
      Este es un correo automático generado por PROCIMEC INGENIERÍA SAS &middot; NIT: 802019658-9 &middot; Barranquilla / Bogotá D.C.
    </div>
  </div>
</body>
</html>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Gestión Humana PROCIMEC" <${smtpUser}>`,
      to: targetEmails.join(', '),
      subject: cleanSubject,
      html: htmlContent,
      attachments: [
        {
          filename: `${safeFilenameBase}.docx`,
          content: params.docxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        {
          filename: `${safeFilenameBase}.pdf`,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return { ok: true, simulated: false };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[letterMailer] Error enviando correo:', errorMsg);
    return { ok: false, message: errorMsg };
  }
}
