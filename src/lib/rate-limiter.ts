/**
 * Limitador de Tasa de Peticiones (Rate Limiter)
 * Protege endpoints computacionalmente intensivos (IA Gemini, generación de PDFs)
 * contra ataques de fuerza bruta y denegación de servicio (DoS).
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpieza periódica de registros antiguos cada 5 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeOldRecords(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const threshold = now - windowMs;
  rateLimitStore.forEach((record, key) => {
    record.timestamps = record.timestamps.filter((t: number) => t > threshold);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  });
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Verifica y aplica limitación de tasa por ventana deslizante (Sliding Window).
 *
 * @param key Identificador único del cliente (IP, ID de usuario o combinación de ruta:IP)
 * @param maxRequests Máximo número de peticiones permitidas en la ventana
 * @param windowSeconds Duración de la ventana en segundos
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const threshold = now - windowMs;

  purgeOldRecords(windowMs);

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filtrar marcas temporales que caen dentro de la ventana activa
  record.timestamps = record.timestamps.filter((t) => t > threshold);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, maxRequests - record.timestamps.length);

  return {
    allowed: true,
    limit: maxRequests,
    remaining,
    resetSeconds: windowSeconds,
  };
}

/**
 * Extrae la dirección IP cliente de los encabezados HTTP estándar de proxies/CDNs.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Limpia totalmente el almacén de rate limiting (útil para pruebas unitarias).
 */
export function resetRateLimiter(): void {
  rateLimitStore.clear();
}
