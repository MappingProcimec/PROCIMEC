/**
 * Módulo de Telemetría y Observabilidad de Errores de Cliente
 * Envía eventos de error y excepciones de ejecución no controladas
 * al endpoint centralizado de auditoría en servidor.
 */

export interface TelemetryEvent {
  message: string;
  name?: string;
  stack?: string;
  route?: string;
  timestamp: string;
  userAgent?: string;
  context?: Record<string, unknown>;
}

/**
 * Registra un error del cliente hacia el backend de observabilidad de forma asíncrona y no bloqueante.
 */
export async function logClientError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const errObj = error instanceof Error ? error : new Error(String(error));

    const payload: TelemetryEvent = {
      name: errObj.name || 'ClientError',
      message: errObj.message || 'Unknown error occurred',
      stack: errObj.stack ? errObj.stack.slice(0, 2000) : undefined,
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
      userAgent: window.navigator.userAgent,
      context,
    };

    const body = JSON.stringify(payload);

    // Priorizar navigator.sendBeacon para no bloquear ni abortar si el usuario cambia de página
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const queued = navigator.sendBeacon('/api/telemetry', blob);
      if (queued) return;
    }

    // Fallback con fetch keepalive
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Ignorar silenciosamente si no hay red para no crear bucles de errores
    });
  } catch (loggingErr) {
    console.warn('[Telemetry] Fallo al despachar telemetría de error:', loggingErr);
  }
}
