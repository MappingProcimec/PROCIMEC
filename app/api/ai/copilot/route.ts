import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import {
  extractFieldDataUseCase,
  auditHseqComplianceUseCase,
  generateGprSummaryUseCase,
} from '@/core/ai';

const copilotRequestSchema = z.object({
  action: z.enum(['extract_field_notes', 'audit_hseq', 'summarize_gpr']),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Blindaje de Sesión y Gobernanza (Ley 3 de PROCIMEC)
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado. Debe iniciar sesión para utilizar el copiloto de IA.' },
        { status: 401 }
      );
    }

    // 2. Control de Tasa (Rate Limiting preventivo)
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`copilot:${session.user.email || clientIp}`, 30, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes al copiloto. Por favor espera un momento.' },
        { status: 429 }
      );
    }

    // 3. Validación de Payload con Zod
    const body = await req.json().catch(() => null);
    const parsed = copilotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Estructura de solicitud no válida', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action, payload } = parsed.data;

    // 4. Despacho a Casos de Uso de Dominio (Arquitectura Hexagonal)
    if (action === 'extract_field_notes') {
      const rawText = String(payload.rawText || '');
      const projectContext = payload.projectContext as { name?: string; client?: string; location?: string } | undefined;
      const data = await extractFieldDataUseCase.execute({ rawText, projectContext });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'audit_hseq') {
      const formTitle = String(payload.formTitle || 'Inspección HSEQ');
      const formCode = payload.formCode ? String(payload.formCode) : undefined;
      const formData = (payload.formData as Record<string, unknown>) || {};
      const projectContext = payload.projectContext as { name?: string; client?: string } | undefined;

      const data = await auditHseqComplianceUseCase.execute({
        formTitle,
        formCode,
        formData,
        projectContext,
      });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'summarize_gpr') {
      const project = (payload.project as { name: string; client: string; description?: string }) || {
        name: 'Proyecto',
        client: 'Cliente',
      };
      const report = (payload.report as {
        report_date: string;
        localizador_name: string;
      }) || {
        report_date: new Date().toISOString().split('T')[0],
        localizador_name: session.user.name || 'Localizador',
      };

      const summary = await generateGprSummaryUseCase.execute(project, report);
      return NextResponse.json({ success: true, data: { summary } });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /api/ai/copilot] Error inesperado:', error);
    const message = error instanceof Error ? error.message : 'Error interno procesando la solicitud de IA';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
