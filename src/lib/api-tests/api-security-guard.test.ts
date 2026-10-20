import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ============================================================================
// PARTE 1: TEST DE GUARDIA ESTÁTICO (CI SHIELD)
// Verifica que NINGÚN handler en app/api/**/route.ts use createAdminClient()
// sin haber llamado a requireAuth() (o getServerSession con rechazo 401 previo).
// ============================================================================

const WHITELIST_EXPLICITA: Record<string, string> = {
  // Manejador OAuth oficial del protocolo NextAuth. Administra el handshake seguro de tokens.
  'app/api/auth/[...nextauth]/route.ts': 'Protocolo oficial NextAuth (handshake y callbacks OAuth)',
  // Cierre de sesión público: borra cookies httpOnly de sesión y refresca estado en cliente. No toca DB.
  'app/api/logout/route.ts': 'Endpoint público de invalidación de cookies de sesión sin acceso a base de datos',
  // Beacon de telemetría de errores del cliente en producción. No tiene acceso a base de datos ni datos sensibles.
  'app/api/telemetry/route.ts': 'Ingesta pública de errores JS/telemetría con rate-limiting en memoria y sin acceso a BD',
};

function getAllRouteFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllRouteFiles(fullPath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Guardia de Seguridad de Rutas API (CI Security Guard)', () => {
  const apiDir = path.resolve(process.cwd(), 'app', 'api');
  const routeFiles = getAllRouteFiles(apiDir);

  it('debe encontrar todos los handlers en app/api y tener una muestra válida', () => {
    expect(routeFiles.length).toBeGreaterThan(50);
  });

  it('ninguna ruta debe usar createAdminClient() sin protección de autenticación', () => {
    const violations: { file: string; reason: string }[] = [];

    for (const filePath of routeFiles) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const relativePath = normalizedPath.substring(normalizedPath.indexOf('app/api/'));

      if (WHITELIST_EXPLICITA[relativePath]) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Si usa createAdminClient, debe verificar autenticación antes de invocar la base de datos
      if (content.includes('createAdminClient')) {
        const hasRequireAuth = content.includes('requireAuth(');
        const hasSessionCheck =
          content.includes('getServerSession(') &&
          (content.includes('status: 401') || content.includes('status: 403'));
        const hasTokenCheck =
          content.includes('getToken(') &&
          (content.includes('status: 401') || content.includes('status: 403'));

        if (!hasRequireAuth && !hasSessionCheck && !hasTokenCheck) {
          violations.push({
            file: relativePath,
            reason: 'Usa createAdminClient() pero no llama a requireAuth() ni rechaza con 401/403 ante falta de sesión',
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('ninguna ruta debe contener bypass inseguro por coincidencia de subcadena en email', () => {
    const bypassViolations: string[] = [];

    for (const filePath of routeFiles) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const relativePath = normalizedPath.substring(normalizedPath.indexOf('app/api/'));
      const content = fs.readFileSync(filePath, 'utf-8');

      // Prohibir email.includes('procimec') u otros patrones de bypass inseguro
      if (/email.*\.includes\(['"]procimec['"]\)/i.test(content)) {
        bypassViolations.push(relativePath);
      }
    }

    expect(bypassViolations).toEqual([]);
  });
});

// ============================================================================
// PARTE 2: TESTS DE COMPORTAMIENTO (BEHAVIORAL TESTS)
// ============================================================================

describe('Tests de Comportamiento de Rutas Protegidas y Mitigaciones', () => {
  it('GET /api/suppliers rechaza con 401 a peticiones sin sesión y no consulta proveedores', async () => {
    // Importamos dinámicamente el handler corregido
    const { GET } = await import('@/app/api/suppliers/route');

    const req = new Request('http://localhost:3000/api/suppliers', { method: 'GET' }) as any;
    const res = await GET(req);

    // Sin sesión mockeada, requireAuth() debe cortar la ejecución inmediatamente en 401
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/No autorizado|sesión/i);
  });

  it('PATCH /api/tools/commercial-pipeline rechaza a usuarios sin sesión o rol comercial', async () => {
    const { PATCH } = await import('@/app/api/tools/commercial-pipeline/route');

    const req = new Request('http://localhost:3000/api/tools/commercial-pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: 'prop-123', total_amount: 5000000 }),
    }) as any;

    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });
});
