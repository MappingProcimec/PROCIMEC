import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const versionParam = searchParams.get('version');

    if (!code) {
      return NextResponse.json({ error: 'Código de formato requerido' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Consultar formato en base de datos
    let formatRecord: {
      code: string;
      name: string;
      process: string;
      current_version: string;
      effective_date: string;
      description?: string | null;
      roles_access?: string[];
      is_universal?: boolean;
    } | null = null;

    try {
      const { data } = await supabase
        .from('document_format_versions')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();
      if (data) formatRecord = data;
    } catch {
      // Ignorar error de tabla
    }

    const targetVersion = versionParam || formatRecord?.current_version || '1';
    const formatName = formatRecord?.name || `Formato ${code}`;
    const processName = formatRecord?.process || 'HSEQ & SIG';
    const effectiveDate = formatRecord?.effective_date || '2026-10-06';
    const description = formatRecord?.description || 'Plantilla oficial de registro operacional y auditoría del Sistema Integrado de Gestión.';

    // 2. Generar Documento PDF Oficial en Blanco
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // ─── Membrete Institucional Oficial ───────────────────────────────────────────
    doc.setDrawColor(21, 24, 29);
    doc.setLineWidth(0.4);
    doc.rect(14, 12, 182, 24); // Contenedor del encabezado

    // Franja divisoria izquierda para logo/identidad
    doc.line(54, 12, 54, 36);
    // Franja divisoria derecha para metadatos de control
    doc.line(148, 12, 148, 36);

    // Bloque Izquierdo: Identidad Corporativa
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 34, 41);
    doc.text('PROCIMEC', 20, 21);
    doc.setFontSize(7.5);
    doc.setTextColor(234, 160, 35);
    doc.text('PCM CLOUD • ENGINEERING', 17, 26);
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('NIT: 901.458.789-2', 22, 31);

    // Bloque Central: Título Oficial del Formato
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 41);
    const splitTitle = doc.splitTextToSize(formatName.toUpperCase(), 88);
    doc.text(splitTitle, 101, 19, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`PROCESO: ${processName.toUpperCase()}`, 101, 31, { align: 'center' });

    // Bloque Derecho: Control de Versiones
    doc.line(148, 20, 196, 20);
    doc.line(148, 28, 196, 28);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 34, 41);
    doc.text('CÓDIGO:', 150, 17);
    doc.setFont('Courier', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(code.toUpperCase(), 168, 17);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 34, 41);
    doc.text('VERSIÓN:', 150, 25);
    doc.setFont('Courier', 'bold');
    doc.text(targetVersion, 168, 25);

    doc.setFont('Helvetica', 'bold');
    doc.text('FECHA:', 150, 33);
    doc.setFont('Courier', 'bold');
    doc.text(effectiveDate, 168, 33);

    // ─── Información General del Registro ─────────────────────────────────────────
    autoTable(doc, {
      startY: 40,
      head: [['INFORMACIÓN GENERAL Y REGISTRO DE OPERACIÓN', '']],
      body: [
        ['Proyecto / Centro de Costos:', '___________________________________________________'],
        ['Cliente / Entidad:', '___________________________________________________'],
        ['Fecha de Ejecución:', 'Día: ____  Mes: ____  Año: 2026'],
        ['Lugar / Ubicación / Frente de Obra:', '___________________________________________________'],
        ['Responsable del Diligenciamiento:', '___________________________________________________'],
      ],
      theme: 'grid',
      styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [30, 34, 41], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold', fillColor: [248, 250, 252] },
        1: { cellWidth: 122 },
      },
    });

    // ─── Alcance y Descripción del Formato ─────────────────────────────────────────
    const currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    doc.setFillColor(245, 245, 247);
    doc.setDrawColor(220, 220, 225);
    doc.rect(14, currentY, 182, 16, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 34, 41);
    doc.text('ALCANCE Y PROPÓSITO DEL DOCUMENTO:', 17, currentY + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    const splitDesc = doc.splitTextToSize(description, 176);
    doc.text(splitDesc, 17, currentY + 10);

    // ─── Estructura de Campos Operacionales / Lista de Chequeo ─────────────────────
    const table2Y = currentY + 20;

    autoTable(doc, {
      startY: table2Y,
      head: [['Ítem', 'Descripción del Parámetro / Actividad', 'CUMPLE', 'NO CUMPLE', 'N/A', 'Observaciones Técnicas']],
      body: [
        ['1.1', 'Verificación de condiciones operativas y seguridad inicial', '[   ]', '[   ]', '[   ]', ''],
        ['1.2', 'Inspección de instrumental / soportes requeridos', '[   ]', '[   ]', '[   ]', ''],
        ['1.3', 'Alineación con especificaciones técnicas del proyecto', '[   ]', '[   ]', '[   ]', ''],
        ['1.4', 'Registro de mediciones / entregables ejecutados', '[   ]', '[   ]', '[   ]', ''],
        ['1.5', 'Reporte de novedades, desviaciones o hallazgos', '[   ]', '[   ]', '[   ]', ''],
        ['1.6', 'Cierre y firma de conformidad de la jornada', '[   ]', '[   ]', '[   ]', ''],
      ],
      theme: 'grid',
      styles: { font: 'Helvetica', fontSize: 7.5, cellPadding: 3, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 72 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 50 },
      },
    });

    // ─── Observaciones Generales ──────────────────────────────────────────────────
    const obsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    doc.setDrawColor(200, 200, 200);
    doc.rect(14, obsY, 182, 28);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, obsY, 182, 6, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 34, 41);
    doc.text('OBSERVACIONES GENERALES / NOVEDADES DE CAMPO:', 17, obsY + 4.5);

    doc.line(14, obsY + 13, 196, obsY + 13);
    doc.line(14, obsY + 20, 196, obsY + 20);

    // ─── Bloque Formal de Firmas en 3 Niveles ─────────────────────────────────────
    const signY = obsY + 34;

    autoTable(doc, {
      startY: signY,
      head: [['ELABORÓ / RESPONSABLE', 'REVISÓ / COORDINACIÓN HSEQ', 'APROBÓ / DIRECCIÓN OPERATIVA']],
      body: [
        ['\n\n\n__________________________________\nFirma:\nNombre:\nC.C.:', '\n\n\n__________________________________\nFirma:\nNombre:\nCargo:', '\n\n\n__________________________________\nFirma:\nNombre:\nCargo:'],
      ],
      theme: 'grid',
      styles: { font: 'Helvetica', fontSize: 7.5, cellPadding: 3, halign: 'center', lineColor: [200, 200, 200] },
      headStyles: { fillColor: [30, 34, 41], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60.6 },
        1: { cellWidth: 60.6 },
        2: { cellWidth: 60.6 },
      },
    });

    // ─── Pie de Página Institucional ──────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      'PROCIMEC INGENIERÍA S.A.S. • SISTEMA INTEGRADO DE GESTIÓN • DOCUMENTO CONTROLADO • PROHIBIDA SU REPRODUCCIÓN NO AUTORIZADA',
      105,
      288,
      { align: 'center' }
    );

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${code.toUpperCase()}_Plantilla_Oficial_v${targetVersion}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error al generar plantilla en blanco:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al generar plantilla' },
      { status: 500 }
    );
  }
}
