import type { AttendanceRecord } from '@/types';

interface PdfUser {
  full_name: string;
  email: string;
  role?: string;
}

export async function generateAttendancePDF(
  records: AttendanceRecord[],
  user: PdfUser,
  periodLabel: string,
  startDate: string,
  endDate: string
) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  // ── 1. Encabezado Corporativo ──
  // Barra decorativa superior
  doc.setFillColor(27, 43, 75); // Azul oscuro institucional PROCIMEC
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Logo / Título de la empresa
  doc.setTextColor(27, 43, 75);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PROCIMEC', margin, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Mapping Ingeniería S.A.S. — Sistema de Gestión Operativa', margin, y + 5);

  // Badge del reporte
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - margin - 55, y - 4, 55, 12, 2, 2, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE ASISTENCIA', pageWidth - margin - 52, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, pageWidth - margin - 52, y + 6);

  y += 16;

  // ── 2. Cuadro de Información del Colaborador y Período ──
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 3, 3, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('COLABORADOR:', margin + 4, y + 6);
  doc.text('CORREO ELECTRÓNICO:', margin + 4, y + 12);
  doc.text('PERÍODO EVALUADO:', margin + 4, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(user.full_name || 'Sin nombre registrado', margin + 35, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(user.email || '—', margin + 45, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // Azul primary
  doc.text(`${periodLabel} (${startDate} al ${endDate})`, margin + 38, y + 18);

  y += 28;

  // ── 3. Tabla de Asistencia ──
  // Encabezado de la tabla
  const colX = {
    fecha: margin,
    entrada: margin + 32,
    salida: margin + 74,
    horas: margin + 116,
    novedades: margin + 134,
  };

  doc.setFillColor(27, 43, 75);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA / DÍA', colX.fecha + 3, y + 5);
  doc.text('ENTRADA', colX.entrada + 2, y + 5);
  doc.text('SALIDA', colX.salida + 2, y + 5);
  doc.text('HORAS', colX.horas + 2, y + 5);
  doc.text('UBICACIÓN / NOVEDADES / SALIDAS A CAMPO', colX.novedades + 2, y + 5);

  y += 8;

  // Filas de datos
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  const getDayName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[d.getDay()];
    } catch {
      return '';
    }
  };

  let totalWorkedHours = 0;
  let totalDaysAttended = 0;
  let totalFieldTrips = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  if (records.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text('No se encontraron registros de asistencia para el período seleccionado.', margin + 4, y + 6);
    y += 12;
  } else {
    records.forEach((rec, idx) => {
      // Salto de página si se acerca al pie
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 16;
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');

      // Línea inferior sutil
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 8, pageWidth - margin, y + 8);

      // Fecha y día
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      const dayName = getDayName(rec.date);
      doc.text(`${rec.date} (${dayName})`, colX.fecha + 3, y + 5.5);

      // Entrada
      doc.setFont('helvetica', 'normal');
      const inTime = formatTime(rec.check_in_time);
      const inLocType = rec.check_in_is_office ? '🏢 Oficina' : '📍 Campo';
      doc.setTextColor(22, 101, 52); // Verde
      doc.text(`${inTime} ${rec.check_in_time ? inLocType : ''}`, colX.entrada + 2, y + 5.5);

      // Salida
      const outTime = formatTime(rec.check_out_time);
      const outLocType = rec.check_out_is_office ? '🏢 Oficina' : '📍 Campo';
      doc.setTextColor(rec.check_out_time ? 180 : 156, rec.check_out_time ? 83 : 163, rec.check_out_time ? 9 : 175);
      doc.text(`${outTime} ${rec.check_out_time ? outLocType : ''}`, colX.salida + 2, y + 5.5);

      // Horas
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const hWorked = Number(rec.total_hours) || 0;
      doc.text(`${hWorked.toFixed(1)} h`, colX.horas + 2, y + 5.5);

      if (hWorked > 0 || rec.check_in_time) {
        totalDaysAttended++;
        totalWorkedHours += hWorked;
      }

      // Novedades / Salidas a campo
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const trips = Array.isArray(rec.field_trips) ? rec.field_trips : [];
      totalFieldTrips += trips.length;

      let noveltyText = '';
      if (trips.length > 0) {
        noveltyText = `🚧 Salida a obra: ${trips.map((t) => t.destination).join(', ')}`;
      } else if (rec.notes) {
        noveltyText = rec.notes;
      } else if (rec.check_in_location) {
        noveltyText = rec.check_in_location.length > 40 ? `${rec.check_in_location.slice(0, 38)}…` : rec.check_in_location;
      } else {
        noveltyText = 'Sin novedades';
      }

      // Truncar texto largo si es necesario
      if (noveltyText.length > 45) {
        noveltyText = `${noveltyText.slice(0, 43)}…`;
      }
      doc.text(noveltyText, colX.novedades + 2, y + 5.5);

      y += 8;
    });
  }

  y += 4;

  // ── 4. Resumen Estadístico ──
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 16;
  }

  const avgPerDay = totalDaysAttended > 0 ? (totalWorkedHours / totalDaysAttended).toFixed(1) : '0.0';

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'FD');

  const cardW = (pageWidth - (margin * 2)) / 4;

  // Métricas
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('DÍAS ASISTIDOS', margin + (cardW * 0) + 4, y + 5);
  doc.text('TOTAL HORAS', margin + (cardW * 1) + 4, y + 5);
  doc.text('PROMEDIO DIARIO', margin + (cardW * 2) + 4, y + 5);
  doc.text('SALIDAS A OBRA', margin + (cardW * 3) + 4, y + 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalDaysAttended} días`, margin + (cardW * 0) + 4, y + 11.5);
  doc.setTextColor(37, 99, 235);
  doc.text(`${totalWorkedHours.toFixed(1)} h`, margin + (cardW * 1) + 4, y + 11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${avgPerDay} h/día`, margin + (cardW * 2) + 4, y + 11.5);
  doc.setTextColor(217, 119, 6);
  doc.text(`${totalFieldTrips} salidas`, margin + (cardW * 3) + 4, y + 11.5);

  y += 24;

  // ── 5. Firmas de Formalización ──
  if (y > pageHeight - 30) {
    doc.addPage();
    y = 16;
  }

  const signWidth = 60;
  const leftSignX = margin + 15;
  const rightSignX = pageWidth - margin - signWidth - 15;

  doc.setDrawColor(148, 163, 184);
  doc.line(leftSignX, y + 12, leftSignX + signWidth, y + 12);
  doc.line(rightSignX, y + 12, rightSignX + signWidth, y + 12);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Firma del Colaborador', leftSignX + (signWidth / 2), y + 16, { align: 'center' });
  doc.text('Firma Supervisor / Dirección', rightSignX + (signWidth / 2), y + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(user.full_name || 'Colaborador', leftSignX + (signWidth / 2), y + 19, { align: 'center' });
  doc.text('PROCIMEC — Mapping Ingeniería', rightSignX + (signWidth / 2), y + 19, { align: 'center' });

  // Pie de página
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Documento interno generado por el Sistema PWA PROCIMEC para control de asistencia y verificación de jornada laboral.',
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  // Descarga del PDF
  const safeName = (user.full_name || 'Colaborador').replace(/\s+/g, '_');
  doc.save(`Asistencia_PROCIMEC_${safeName}_${startDate}_${endDate}.pdf`);
}
