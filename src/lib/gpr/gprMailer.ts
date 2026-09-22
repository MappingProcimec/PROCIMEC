import nodemailer from 'nodemailer';
import { ProjectContext, GprReportContext } from './geminiGprSummary';
import { ReportFile } from '@/types';

export interface GprEmailPayload {
  recipients: string[];
  project: ProjectContext;
  report: GprReportContext;
  aiSummary: string;
  pdfBuffer?: Buffer;
  pdfReportUrl?: string;
  files: ReportFile[];
}

export const GPR_DEFAULT_ARCHIVE_EMAIL = 'mapping@procimecingenieria.com';

export async function sendGprReportEmail(payload: GprEmailPayload): Promise<{ ok: boolean; simulated?: boolean; message?: string }> {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  // Asegurar destinatarios únicos y válidos
  const targetEmails = Array.from(
    new Set([GPR_DEFAULT_ARCHIVE_EMAIL, ...(payload.recipients || [])].filter(Boolean))
  );

  const totalMl = (payload.report.operational_summary || []).reduce((acc, row) => acc + (Number(row.ml) || 0), 0);
  const totalM2 = (payload.report.operational_summary || []).reduce((acc, row) => acc + (Number(row.m2) || 0), 0);

  const cleanProject = payload.project.name || 'Proyecto';
  const subject = `[GPR] Reporte Diario de Campo — Proyecto: ${cleanProject} — ${payload.report.report_date} (${payload.report.localizador_name})`;

  // Si no hay credenciales configuradas en el entorno
  if (!smtpUser || !smtpPass) {
    console.warn('Aviso: Variables SMTP no configuradas en el entorno (SMTP_USER/SMTP_PASS). Envío simulado.');
    return {
      ok: true,
      simulated: true,
      message: 'Credenciales SMTP pendientes en variables de entorno. Envío registrado de forma simulada.',
    };
  }

  // Generar filas de archivos para el correo
  const fileRowsHtml = payload.files.length > 0
    ? payload.files.map((file) => {
        const fileUrl = file.storage_url || file.drive_webview_url || '#';
        const typeLabel = file.file_type === 'raw_gpr' ? 'Datos Crudos GPR/PPR' : file.file_type === 'gps' ? 'Posicionamiento GPS (.txt)' : 'Fotografía de Campo';
        const sizeMb = file.size_bytes ? (file.size_bytes / (1024 * 1024)).toFixed(2) + ' MB' : '';

        return `
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-size: 13px; color: #1E293B; font-weight: 500;">
              ${file.original_name}
              ${file.caption ? `<br><span style="font-size: 11px; color: #64748B;">Nota: ${file.caption}</span>` : ''}
            </td>
            <td style="padding: 10px; font-size: 12px; color: #64748B;">${typeLabel} ${sizeMb ? `(${sizeMb})` : ''}</td>
            <td style="padding: 10px; text-align: right;">
              <a href="${fileUrl}" target="_blank" style="background-color: #EAA023; color: #1E2229; padding: 6px 12px; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block;">
                Descargar Archivo
              </a>
            </td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="3" style="padding: 10px; color: #64748B; font-size: 12px;">No se adjuntaron archivos adicionales en este levantamiento.</td></tr>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F1F5F9; padding: 24px 0;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <!-- Banner Superior -->
              <tr>
                <td style="background-color: #1E2229; padding: 24px 32px; border-bottom: 4px solid #EAA023;">
                  <table width="100%">
                    <tr>
                      <td>
                        <h1 style="color: #FFFFFF; margin: 0; font-size: 18px; letter-spacing: 0.5px;">PROCIMEC MAPPING E INGENIERÍA S.A.S.</h1>
                        <p style="color: #EAA023; margin: 4px 0 0 0; font-size: 13px; font-weight: 600;">REPORTE OFICIAL DE OPERACIÓN EN CAMPO — GPR</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Contenido Principal -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="color: #0F172A; font-size: 18px; margin: 0 0 16px 0;">Registro Técnico de Levantamiento Geofísico</h2>

                  <!-- Ficha de Datos del Proyecto -->
                  <table width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569; width: 140px;"><strong>Proyecto:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #0F172A;"><strong>${payload.project.name}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569;"><strong>Cliente:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #0F172A;">${payload.project.client || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569;"><strong>Ubicación:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #0F172A;">${payload.project.location || 'Frente de obra'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569;"><strong>Fecha / Horario:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #0F172A;">${payload.report.report_date} ${payload.report.report_time ? `(${payload.report.report_time})` : ''}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569;"><strong>Localizador:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #0F172A;">${payload.report.localizador_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-size: 13px; color: #475569;"><strong>Volumetría:</strong></td>
                      <td style="padding: 4px 0; font-size: 13px; color: #D97706; font-weight: bold;">${totalMl.toFixed(1)} ML · ${totalM2.toFixed(1)} M²</td>
                    </tr>
                  </table>

                  <!-- Síntesis Técnica Google Gemini AI -->
                  ${payload.aiSummary ? `
                    <div style="background-color: #1E2229; border: 1px solid #EAA023; border-radius: 8px; padding: 18px; margin-bottom: 24px; color: #FFFFFF;">
                      <div style="color: #EAA023; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        ✦ SÍNTESIS TÉCNICA OPERACIONAL (GOOGLE GEMINI AI)
                      </div>
                      <p style="color: #E2E8F0; font-size: 13px; line-height: 1.6; margin: 0;">
                        ${payload.aiSummary}
                      </p>
                    </div>
                  ` : ''}

                  <!-- Botón Descargar PDF Diario -->
                  ${payload.pdfReportUrl ? `
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${payload.pdfReportUrl}" target="_blank" style="background-color: #1E2229; color: #FFFFFF; border: 2px solid #EAA023; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
                        📄 Descargar Reporte Diario Completo en PDF
                      </a>
                    </div>
                  ` : ''}

                  <!-- AVISO DE CADUCIDAD / TEMPORALIDAD (30 DÍAS) -->
                  <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 6px; margin: 24px 0;">
                    <p style="color: #92400E; font-size: 13px; font-weight: bold; margin: 0 0 4px 0;">
                      ⚠️ AVISO DE DISPONIBILIDAD TEMPORAL DE ARCHIVOS CRUDOS (30 DÍAS)
                    </p>
                    <p style="color: #78350F; font-size: 12px; margin: 0; line-height: 1.5;">
                      Los enlaces de descarga directa para los datos crudos de radar (GPR/PPR), archivos de posicionamiento GPS y fotografías estarán disponibles en los servidores en la nube durante los próximos <strong>30 días</strong> a partir de esta fecha. Se recomienda encarecidamente al responsable de gabinete técnico descargar y archivar los archivos en la estación local de trabajo o servidor definitivo de la empresa.
                    </p>
                  </div>

                  <!-- Tabla de Archivos de Campo -->
                  <h3 style="color: #0F172A; font-size: 15px; margin: 24px 0 12px 0;">Archivos de Campo Registrados (Sección 3):</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                    <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                      <th style="padding: 10px; font-size: 12px; text-align: left; color: #475569;">Nombre de Archivo</th>
                      <th style="padding: 10px; font-size: 12px; text-align: left; color: #475569;">Tipo</th>
                      <th style="padding: 10px; font-size: 12px; text-align: right; color: #475569;">Acción</th>
                    </tr>
                    ${fileRowsHtml}
                  </table>
                </td>
              </tr>

              <!-- Pie de página del Correo -->
              <tr>
                <td style="background-color: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; text-align: center;">
                  <p style="color: #64748B; font-size: 11px; margin: 0;">
                    Este es un mensaje automático generado por la plataforma <strong>PROCIMEC</strong>.<br>
                    Copia archivada para: <em>${targetEmails.join(', ')}</em>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

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

    // Adjuntar el PDF oficial directamente si el buffer está presente
    if (payload.pdfBuffer) {
      const cleanDate = (payload.report.report_date || 'fecha').replace(/[^0-9\-]/g, '');
      const cleanProjCode = (payload.project.code || payload.project.cost_center || 'PRJ').replace(/[^a-zA-Z0-9\-_]/g, '');
      attachments.push({
        filename: `Reporte_Diario_GPR_${cleanProjCode}_${cleanDate}.pdf`,
        content: payload.pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from: `"PROCIMEC Mapping — Operaciones" <${smtpUser}>`,
      to: targetEmails.join(', '),
      subject,
      html,
      attachments,
    });

    console.log(`[GPR-MAILER] Correo de reporte enviado exitosamente a: ${targetEmails.join(', ')}`);
    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[GPR-MAILER] Error despachando correo de reporte:', errorMsg);
    return { ok: false, message: errorMsg };
  }
}
