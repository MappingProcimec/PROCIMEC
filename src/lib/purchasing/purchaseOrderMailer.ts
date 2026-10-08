import nodemailer from 'nodemailer';

export interface SendPurchaseOrderEmailParams {
  supplierEmail: string;
  supplierName: string;
  orderCode: string;
  projectName?: string;
  costCenter?: string;
  totalAmount: number;
  deliveryDeadline?: string;
  deliverySite?: string;
  paymentTerms?: string;
  items: Array<{
    item_no?: number;
    description: string;
    quantity: number | '';
    unit?: string;
    unit_price: number | '';
    total?: number;
  }>;
  notes?: string;
  buyerName?: string;
  buyerEmail?: string;
  pdfBuffer?: Buffer;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function sendPurchaseOrderEmail(params: SendPurchaseOrderEmailParams): Promise<{ ok: boolean; message?: string }> {
  const {
    supplierEmail,
    supplierName,
    orderCode,
    projectName = 'Operación General',
    costCenter = '',
    totalAmount,
    deliveryDeadline = 'Inmediata',
    deliverySite = 'Almacén Central / Obra asignada',
    paymentTerms = 'Contado',
    items,
    notes = '',
    buyerName = 'Área de Compras y Suministros',
    buyerEmail,
    pdfBuffer,
  } = params;

  if (!supplierEmail || !supplierEmail.includes('@')) {
    return { ok: false, message: 'Correo electrónico de proveedor no válido o no configurado.' };
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';

  if (!smtpUser || !smtpPass) {
    console.warn('[purchaseOrderMailer] Variables SMTP no configuradas. Simulando envío a:', supplierEmail);
    return { ok: true, message: 'SMTP no configurado en entorno; envío simulado correctamente.' };
  }

  const itemsRowsHtml = items
    .map(
      (it, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 10px; font-family: monospace; color: #64748b; text-align: center;">${it.item_no || idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${it.description}</td>
        <td style="padding: 8px 10px; text-align: center; font-family: monospace;">${it.quantity} ${it.unit || 'Und'}</td>
        <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #475569;">${formatCOP(Number(it.unit_price) || 0)}</td>
        <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">${formatCOP(Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0))}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Orden de Compra Oficial ${orderCode}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 640px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Header Corporativo -->
    <div style="background-color: #1E2229; padding: 24px; border-bottom: 4px solid #EAA023;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">PROCIMEC INGENIERÍA S.A.S.</h1>
            <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">NIT: 901.385.500-1 · Gestión de Compras y Suministros</p>
          </td>
          <td style="text-align: right;">
            <span style="display: inline-block; background-color: #EAA023; color: #1E2229; font-weight: 800; font-family: monospace; font-size: 13px; padding: 6px 12px; border-radius: 6px;">
              ${orderCode}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Saludo y Notificación -->
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">Estimados señores, <strong>${supplierName}</strong>:</h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #334155;">
        Por medio de la presente, <strong>PROCIMEC INGENIERÍA S.A.S.</strong> formaliza y emite la <strong>Orden de Compra ${orderCode}</strong> correspondiente a los bienes y servicios cotizados para el proyecto <strong>${costCenter ? `[${costCenter}] ` : ''}${projectName}</strong>.
      </p>

      <!-- Tabla de Condiciones -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 40%;">Lugar de Entrega:</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: bold;">${deliverySite}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Fecha Límite Pactada:</td>
            <td style="padding: 4px 0; color: #b45309; font-weight: bold;">${deliveryDeadline}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Condición de Pago:</td>
            <td style="padding: 4px 0; color: #0f172a;">${paymentTerms}</td>
          </tr>
          ${notes ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Observaciones de Entrega:</td>
            <td style="padding: 4px 0; color: #0f172a;">${notes}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Resumen de Ítems Adjudicados -->
      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
        Detalle de Bienes e Insumos Solicitados
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #1E2229; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 6px; text-align: center; width: 24px;">#</th>
            <th style="padding: 8px 10px; text-align: left;">Descripción</th>
            <th style="padding: 8px 6px; text-align: center; width: 60px;">Cant.</th>
            <th style="padding: 8px 10px; text-align: right; width: 90px;">Vlr. Unitario</th>
            <th style="padding: 8px 10px; text-align: right; width: 100px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td colspan="4" style="padding: 10px; text-align: right; font-size: 13px; color: #1E2229;">VALOR TOTAL DE LA ORDEN (COP):</td>
            <td style="padding: 10px; text-align: right; font-size: 15px; color: #0f172a; font-family: monospace;">${formatCOP(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Instrucciones de facturación -->
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; font-size: 12px; color: #92400e; margin-bottom: 20px; line-height: 1.5;">
        <strong>Instrucciones obligatorias de facturación:</strong><br>
        1. Facturar a nombre de <strong>PROCIMEC INGENIERÍA S.A.S.</strong> (NIT: 901.385.500-1).<br>
        2. Indicar en la factura el número de orden de compra: <strong>${orderCode}</strong>.<br>
        3. Adjuntar la remisión de entrega firmada a satisfacción por el responsable de obra o almacén.
      </div>

      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
        Se adjunta a este correo el documento oficial de la Orden de Compra en formato PDF. Agradecemos confirmar el recibido y el despacho correspondiente.
      </p>

      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; pt: 14px; font-size: 12px; color: #475569;">
        <strong>Emitido por:</strong> ${buyerName}<br>
        <strong>Contacto institucional:</strong> ${buyerEmail || smtpUser}
      </div>
    </div>

    <!-- Footer Oficial Institucional (AGENTS.md Ley 7) -->
    <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      <strong>PROCIMEC INGENIERÍA S.A.S.</strong> · NIT: 901.385.500-1 · Colombia<br>
      Este es un mensaje institucional automático generado desde la plataforma empresarial PCM CLOUD.
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

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `${orderCode}_${supplierName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    const recipients = [supplierEmail];
    if (buyerEmail && buyerEmail.includes('@') && buyerEmail !== supplierEmail) {
      // En copia al emisor de compras
      recipients.push(buyerEmail);
    }

    await transporter.sendMail({
      from: `"Compras PROCIMEC" <${smtpUser}>`,
      to: supplierEmail,
      cc: buyerEmail && buyerEmail.includes('@') ? buyerEmail : undefined,
      subject: `[PROCIMEC] Orden de Compra ${orderCode} — ${supplierName} | Proyecto ${projectName}`,
      html: htmlContent,
      attachments,
    });

    return { ok: true, message: `Orden de compra enviada exitosamente a ${supplierEmail}.` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[purchaseOrderMailer] Error enviando correo:', errorMsg);
    return { ok: false, message: errorMsg };
  }
}
