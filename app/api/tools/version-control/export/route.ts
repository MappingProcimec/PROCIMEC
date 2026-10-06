import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import ExcelJS from 'exceljs';
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
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    // 1. Obtener datos llamando al endpoint interno o directo a Supabase
    const supabase = createAdminClient();
    const { data: dbFormats } = await supabase
      .from('document_format_versions')
      .select('*')
      .order('process', { ascending: true })
      .order('code', { ascending: true });

    // Fallback si no hay registros en la tabla
    let formats = dbFormats ?? [];
    if (formats.length === 0) {
      // Reutilizar petición GET local
      const origin = req.nextUrl.origin;
      const res = await fetch(`${origin}/api/tools/version-control`, {
        headers: { cookie: req.headers.get('cookie') || '' },
      });
      if (res.ok) {
        const json = await res.json();
        formats = json.data ?? [];
      }
    }

    const currentDateStr = new Date().toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // ────────────────────────────────────────────────────────────────────────
    // EXPORTACIÓN EXCEL (.xlsx)
    // ────────────────────────────────────────────────────────────────────────
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Listado Maestro Formatos', {
        views: [{ showGridLines: true }],
      });

      // Filas de Encabezado Institucional
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
      worksheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2229' } };
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 28;

      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = 'SISTEMA INTEGRADO DE GESTIÓN (SIG) — LISTADO MAESTRO DE CONTROL DE DOCUMENTOS Y FORMATOS';
      worksheet.getCell('A2').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E2229' } };
      worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAA023' } };
      worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 24;

      worksheet.mergeCells('A3:H3');
      worksheet.getCell('A3').value = `Fecha de Emisión del Listado: ${currentDateStr} | Total de Formatos Auditados: ${formats.length} | Estado General: VIGENTE`;
      worksheet.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } };
      worksheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
      worksheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(3).height = 18;

      // Encabezados de Columna
      const headers = [
        'Ítem',
        'Código Oficial',
        'Nombre del Formato / Documento',
        'Proceso / Área del SIG',
        'Roles con Acceso Autorizado',
        'Versión Vigente',
        'Fecha de Versión',
        'Estado Oficial',
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A303C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF15181D' } },
          bottom: { style: 'medium', color: { argb: 'FFEAA023' } },
          left: { style: 'thin', color: { argb: 'FF15181D' } },
          right: { style: 'thin', color: { argb: 'FF15181D' } },
        };
      });

      // Llenado de Filas
      formats.forEach((f, idx) => {
        const rolesText = f.is_universal
          ? 'Todos los Roles (Universal)'
          : Array.isArray(f.roles_access)
          ? f.roles_access.join(', ')
          : 'Todos';

        const row = worksheet.addRow([
          idx + 1,
          f.code,
          f.name,
          f.process,
          rolesText,
          `Versión ${f.current_version}`,
          f.effective_date,
          f.status === 'active' ? 'ACTIVO' : 'OBSOLETO',
        ]);

        row.height = 20;

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF9FAFB';

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };

          if (colNumber === 1 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          if (colNumber === 2) {
            cell.font = { name: 'Courier New', size: 9, bold: true, color: { argb: 'FFB45309' } };
          }
        });
      });

      // Anchos de Columna
      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 18;
      worksheet.getColumn(3).width = 44;
      worksheet.getColumn(4).width = 28;
      worksheet.getColumn(5).width = 30;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 16;
      worksheet.getColumn(8).width = 14;

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Listado_Maestro_Formatos_PROCIMEC_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // EXPORTACIÓN PDF (.pdf)
    // ────────────────────────────────────────────────────────────────────────
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Encabezado
    doc.setFillColor(30, 34, 41); // Carbón Técnico #1E2229
    doc.rect(10, 10, 277, 18, 'F');

    doc.setFillColor(234, 160, 35); // Ámbar #EAA023
    doc.rect(10, 28, 277, 3, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('PROCIMEC INGENIERÍA S.A.S.  •  PCM CLOUD', 15, 18);

    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(234, 160, 35);
    doc.text('SISTEMA INTEGRADO DE GESTIÓN (SIG) — LISTADO MAESTRO DE FORMATOS Y CONTROL DE VERSIONES', 15, 24);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(`Fecha: ${currentDateStr} | Total: ${formats.length} formatos`, 245, 18);

    // Tabla de Formatos
    const tableData = formats.map((f, idx) => [
      idx + 1,
      f.code,
      f.name,
      f.process,
      f.is_universal ? 'Todos los Roles' : (Array.isArray(f.roles_access) ? f.roles_access.join(', ') : 'Todos'),
      `v${f.current_version}`,
      f.effective_date,
      f.status === 'active' ? 'VIGENTE' : 'OBSOLETO',
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Código', 'Nombre del Formato', 'Proceso SIG', 'Roles con Acceso', 'Versión', 'Fecha Versión', 'Estado']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'Helvetica',
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 34, 41],
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [42, 48, 60],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
        2: { cellWidth: 70 },
        3: { cellWidth: 45 },
        4: { cellWidth: 50 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        // Pie de página
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Listado Maestro de Control de Versiones • PROCIMEC INGENIERÍA S.A.S. • Página ${data.pageNumber}`,
          14,
          202
        );
      },
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Listado_Maestro_Formatos_PROCIMEC_${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error en exportación de control de versiones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al exportar control de versiones' },
      { status: 500 }
    );
  }
}
