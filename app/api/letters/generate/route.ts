import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { HrLetterType, HrLetterData } from '@/types';
import { generateHrLetterDocx, HR_LETTER_TYPES } from '@/lib/letters/docxTemplateEngine';
import { generateHrLetterPdf } from '@/lib/letters/letterPdfGenerator';
import { sendHrLetterEmail } from '@/lib/letters/letterMailer';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      letterType,
      data,
    }: {
      letterType: HrLetterType;
      data: HrLetterData;
    } = body;

    if (!letterType || !HR_LETTER_TYPES[letterType]) {
      return NextResponse.json(
        { error: 'Tipo de carta inválido o no especificado.' },
        { status: 400 }
      );
    }

    const meta = HR_LETTER_TYPES[letterType];
    const supabase = createAdminClient();

    // 1. Obtener usuario autenticado o fallback
    let userId = session?.user?.id;
    let userEmail = session?.user?.email || 'contacto@procimecingenieria.com';
    let userFullName = session?.user?.name || 'Colaborador PROCIMEC';

    if (!userId && userEmail) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('email', userEmail)
        .single();
      if (dbUser) {
        userId = dbUser.id;
        userFullName = dbUser.full_name || userFullName;
      }
    }

    // 2. Generar Radicado Consecutivo Oficial (ej. PRC-RH-2026-0012)
    const currentYear = new Date().getFullYear();
    let sequenceNumber = Math.floor(1000 + Math.random() * 9000); // Fallback aleatorio seguro

    try {
      const { count } = await supabase
        .from('hr_letters')
        .select('id', { count: 'exact', head: true });
      if (typeof count === 'number') {
        sequenceNumber = count + 1;
      }
    } catch {
      // Ignorar si la tabla no está creada aún
    }

    const radicadoFormatted = `PRC-RH-${currentYear}-${String(sequenceNumber).padStart(4, '0')}`;
    const letterDateFormatted =
      data.carta_fecha ||
      new Date().toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    // Enriquecer datos con radicado y fecha oficial
    const enrichedData: HrLetterData = {
      ...data,
      carta_radicado: data.carta_radicado || radicadoFormatted,
      carta_fecha: letterDateFormatted,
      firma_tel: data.firma_tel || '300 530 6039',
    };

    // 3. Resolución Canónica de Proyecto si viene project_id
    let canonicalProjectId: string | null = null;
    if (enrichedData.project_id) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name, cost_center')
        .eq('id', enrichedData.project_id)
        .single();

      if (projectData) {
        canonicalProjectId = projectData.id;
        enrichedData.proy_nombre = projectData.name;
      }
    }

    // 4. Generación en vuelo de Word (.docx)
    const { docxBuffer, renderedText } = await generateHrLetterDocx(
      letterType,
      enrichedData
    );

    // 5. Generación en vuelo de PDF oficial
    const pdfBuffer = await generateHrLetterPdf(letterType, enrichedData);

    const docxBase64 = docxBuffer.toString('base64');
    const pdfBase64 = pdfBuffer.toString('base64');

    // 6. Despacho por Correo Electrónico
    let emailSent = false;
    let emailMessage = '';
    try {
      const emailResult = await sendHrLetterEmail({
        recipientEmail: userEmail,
        recipientName: userFullName,
        letterType,
        letterTitle: meta.title,
        radicado: enrichedData.carta_radicado,
        data: enrichedData,
        docxBuffer,
        pdfBuffer,
      });
      emailSent = emailResult.ok;
      emailMessage = emailResult.message || '';
    } catch (mailErr: unknown) {
      console.warn('[api/letters/generate] Error en envío de correo:', mailErr);
    }

    // 7. Persistir en la tabla `hr_letters` de Supabase
    let letterId = '';
    try {
      if (userId) {
        const { data: inserted, error: insertErr } = await supabase
          .from('hr_letters')
          .insert({
            user_id: userId,
            project_id: canonicalProjectId,
            letter_type: letterType,
            letter_title: meta.title,
            radicado: enrichedData.carta_radicado,
            employee_name: enrichedData.emp_nombre || null,
            employee_document: enrichedData.emp_documento || null,
            recipient_name: enrichedData.dest_nombre || null,
            recipient_entity: enrichedData.dest_empresa || null,
            letter_data: enrichedData,
            rendered_text: renderedText,
            docx_base64: docxBase64,
            pdf_base64: pdfBase64,
            email_recipient: userEmail,
            email_sent: emailSent,
            email_sent_at: emailSent ? new Date().toISOString() : null,
            status: 'submitted',
          })
          .select('id')
          .single();

        if (!insertErr && inserted) {
          letterId = inserted.id;
        } else if (insertErr) {
          console.warn('[api/letters/generate] Aviso Supabase insert:', insertErr.message);
        }
      }
    } catch (dbErr: unknown) {
      console.warn('[api/letters/generate] Error registrando en base de datos:', dbErr);
    }

    return NextResponse.json({
      success: true,
      letterId,
      radicado: enrichedData.carta_radicado,
      letterTitle: meta.title,
      letterType,
      date: enrichedData.carta_fecha,
      renderedText,
      docxBase64,
      pdfBase64,
      emailSent,
      emailMessage,
      userEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/letters/generate] Error fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
