import nodemailer from 'nodemailer';

export interface HseqAlertVariation {
  code: string;
  description: string;
  response: string;
  expected: string;
}

export interface HseqAlertData {
  formatCode: string;
  formatTitle: string;
  projectName: string;
  costCenter?: string;
  location?: string;
  inspectionDate: string;
  equipmentBrandModel: string;
  equipmentSerial: string;
  operatorName: string;
  sstaName: string;
  variations: HseqAlertVariation[];
  criticalPoint?: string;
  generalObservations?: string;
  pdfUrl?: string;
  excelUrl?: string;
}

export const HSEQ_RECIPIENT_EMAIL = process.env.HSEQ_ALERT_EMAIL || 'ghprocimec@gmail.com';

export async function sendHseqAlertEmail(data: HseqAlertData): Promise<{ ok: boolean; message?: string; simulated?: boolean }> {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  const subject = `🚨 ALERTA HSEQ [${data.formatCode}]: Variación de Seguridad en ${data.projectName}`;

  // Formato HTML elegante y profesional
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-top: 8px; }
        .content { padding: 24px; }
        .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #991b1b; }
        .grid { display: table; width: 100%; margin-bottom: 20px; }
        .row { display: table-row; }
        .cell { display: table-cell; padding: 8px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .cell-label { font-weight: 700; color: #64748b; width: 35%; }
        .cell-value { font-weight: 600; color: #0f172a; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px; font-size: 12px; }
        .table th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #475569; border: 1px solid #e2e8f0; }
        .table td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
        .tag-danger { background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
        .tag-success { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
        .btn-container { text-align: center; margin: 24px 0 10px; }
        .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 ALERTA DE SEGURIDAD HSEQ</h1>
          <p>Se ha detectado una variación no conforme o punto crítico en la inspección</p>
          <div class="badge">${data.formatCode} — ${data.formatTitle}</div>
        </div>

        <div class="content">
          <div class="alert-box">
            <strong>⚠️ Atención Inmediata:</strong> Una o más respuestas difieren del patrón de seguridad establecido en el catálogo o se reportó un punto crítico que compromete la operación normal.
          </div>

          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; color: #334155;">
            📌 Datos del Registro
          </h3>
          <div class="grid">
            <div class="row">
              <div class="cell cell-label">Proyecto:</div>
              <div class="cell cell-value">${data.projectName} (${data.costCenter || 'S/C'})</div>
            </div>
            <div class="row">
              <div class="cell cell-label">Ubicación:</div>
              <div class="cell cell-value">${data.location || 'En campo'}</div>
            </div>
            <div class="row">
              <div class="cell cell-label">Fecha y Hora:</div>
              <div class="cell cell-value">${data.inspectionDate}</div>
            </div>
            <div class="row">
              <div class="cell cell-label">Equipo / Modelo:</div>
              <div class="cell cell-value">${data.equipmentBrandModel} (S/N: ${data.equipmentSerial || 'N/A'})</div>
            </div>
            <div class="row">
              <div class="cell cell-label">Localizador / Operador:</div>
              <div class="cell cell-value">📍 ${data.operatorName}</div>
            </div>
            <div class="row">
              <div class="cell cell-label">Responsable SSTA:</div>
              <div class="cell cell-value">🛡️ ${data.sstaName}</div>
            </div>
          </div>

          ${
            data.variations.length > 0
              ? `
            <h3 style="font-size: 14px; font-weight: 800; margin: 18px 0 6px; text-transform: uppercase; color: #b91c1c;">
              ❌ Ítems con Variación Detectada (${data.variations.length})
            </h3>
            <p style="font-size: 12px; color: #64748b; margin: 0 0 10px;">
              Los siguientes puntos no coinciden con la condición segura predeterminada:
            </p>
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 15%;">Ítem</th>
                  <th>Descripción del Parámetro</th>
                  <th style="width: 20%; text-align: center;">Respuesta</th>
                  <th style="width: 20%; text-align: center;">Esperado</th>
                </tr>
              </thead>
              <tbody>
                ${data.variations
                  .map(
                    (v) => `
                  <tr>
                    <td style="font-weight: 700; font-family: monospace;">${v.code}</td>
                    <td>${v.description}</td>
                    <td style="text-align: center;"><span class="tag-danger">${v.response}</span></td>
                    <td style="text-align: center;"><span class="tag-success">${v.expected}</span></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
              : ''
          }

          ${
            data.criticalPoint && data.criticalPoint.toLowerCase() !== 'ninguno' && data.criticalPoint.toLowerCase() !== 'ninguna'
              ? `
            <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <strong style="color: #9f1239; font-size: 13px;">⚠️ Punto Crítico Declarado por el Colaborador:</strong>
              <p style="margin: 6px 0 0; font-size: 13px; color: #881337;">${data.criticalPoint}</p>
            </div>
          `
              : ''
          }

          ${
            data.generalObservations
              ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <strong style="color: #475569; font-size: 13px;">📝 Observaciones Generales:</strong>
              <p style="margin: 6px 0 0; font-size: 13px; color: #334155;">${data.generalObservations}</p>
            </div>
          `
              : ''
          }

          ${
            data.pdfUrl
              ? `
            <div class="btn-container">
              <a href="${data.pdfUrl}" class="btn" target="_blank">
                📄 Ver Evidencia y PDF Oficial en Google Drive
              </a>
            </div>
          `
              : ''
          }
        </div>

        <div class="footer">
          PROCIMEC — Sistema de Gestión Integrada HSEQ | Mapping Ingeniería<br>
          Notificación automática enviada a <strong>${HSEQ_RECIPIENT_EMAIL}</strong>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!smtpUser || !smtpPass) {
    console.warn(`⚠️ [HSEQ-MAILER] Alerta HSEQ preparada para <${HSEQ_RECIPIENT_EMAIL}> (${data.variations.length} variaciones, crítico: "${data.criticalPoint || 'Ninguno'}").`);
    console.warn('⚠️ [HSEQ-MAILER] Para el despacho SMTP directo, agregue SMTP_USER y SMTP_PASS en .env.local.');
    return {
      ok: true,
      simulated: true,
      message: 'Alerta HSEQ registrada y simulada (credenciales SMTP pendientes en variables de entorno)',
    };
  }

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

    await transporter.sendMail({
      from: `"PROCIMEC HSEQ Alert" <${smtpUser}>`,
      to: HSEQ_RECIPIENT_EMAIL,
      subject,
      html,
    });

    console.log(`✅ [HSEQ-MAILER] Correo de alerta enviado exitosamente a ${HSEQ_RECIPIENT_EMAIL}`);
    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('❌ [HSEQ-MAILER] Error despachando correo de alerta:', errorMsg);
    return { ok: false, message: errorMsg };
  }
}
