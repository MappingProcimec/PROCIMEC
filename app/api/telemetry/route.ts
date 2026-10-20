import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  // Limitar ráfagas de telemetría a 60 reportes/min por IP
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`telemetry_${clientIp}`, 60, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Demasiadas trazas de telemetría' }, { status: 429 });
  }

  try {
    const raw = await req.text();
    if (!raw || raw.length > 10000) {
      return NextResponse.json({ error: 'Carga inválida' }, { status: 400 });
    }

    const data = JSON.parse(raw);
    const sanitizedError = {
      severity: 'ERROR',
      timestamp: data.timestamp || new Date().toISOString(),
      name: String(data.name || 'ClientError').slice(0, 100),
      message: String(data.message || '').slice(0, 500),
      route: String(data.route || '').slice(0, 200),
      clientIp,
    };

    // Registro estructurado en servidor (visible en logs de Vercel/Node)
    console.error('[CLIENT TELEMETRY EVENT]', JSON.stringify(sanitizedError));

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }
}
