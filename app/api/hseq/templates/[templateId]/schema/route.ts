import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getHseqFormatConfig,
  ESTACION_TOTAL_ITEMS,
  DRONE_INSPECTION_ITEMS,
  ESTACION_TOTAL_SECTIONS,
  DRONE_INSPECTION_SECTIONS,
} from '@/lib/hseq-definitions';
import { parseExcelTemplateSchema, DynamicFormatSchema } from '@/lib/hseq-drive';

export const dynamic = 'force-dynamic';

// Caché en memoria para esquemas ya analizados
const schemaCache = new Map<string, { schema: DynamicFormatSchema; timestamp: number }>();
const SCHEMA_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: 'Falta el identificador del formato' }, { status: 400 });
  }

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';

  // 1. Caso Drone conocido
  if (
    templateId === 'hseq-drone-preoperational' ||
    templateId.toLowerCase().includes('drone') ||
    templateId.includes('024')
  ) {
    const droneCfg = getHseqFormatConfig('drone');
    return NextResponse.json({
      ok: true,
      schema: {
        id: 'hseq-drone-preoperational',
        formatType: 'drone',
        code: droneCfg.code,
        title: droneCfg.title,
        pdfTitle: droneCfg.pdfTitle,
        version: droneCfg.version,
        equipmentLabel: droneCfg.equipmentLabel,
        defaultEquipment: droneCfg.defaultEquipment,
        defaultSerial: droneCfg.defaultSerial,
        sections: Array.from(DRONE_INSPECTION_SECTIONS),
        items: DRONE_INSPECTION_ITEMS,
        isDynamic: false,
      },
    });
  }

  // 2. Caso Estación Total conocida
  if (
    templateId === 'hseq-estacion-total' ||
    templateId.toLowerCase().includes('estacion') ||
    templateId.toLowerCase().includes('estación') ||
    templateId.includes('025')
  ) {
    const etCfg = getHseqFormatConfig('estacion');
    return NextResponse.json({
      ok: true,
      schema: {
        id: 'hseq-estacion-total',
        formatType: 'estacion_total',
        code: etCfg.code,
        title: etCfg.title,
        pdfTitle: etCfg.pdfTitle,
        version: etCfg.version,
        equipmentLabel: etCfg.equipmentLabel,
        defaultEquipment: etCfg.defaultEquipment,
        defaultSerial: etCfg.defaultSerial,
        sections: Array.from(ESTACION_TOTAL_SECTIONS),
        items: ESTACION_TOTAL_ITEMS,
        isDynamic: false,
      },
    });
  }

  // 3. Revisar caché en memoria
  const cached = schemaCache.get(templateId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < SCHEMA_CACHE_TTL) {
    return NextResponse.json({
      ok: true,
      schema: cached.schema,
      cached: true,
    });
  }

  // 4. Analizar dinámicamente el archivo Excel de Google Drive
  try {
    const schema = await parseExcelTemplateSchema(templateId);

    schemaCache.set(templateId, {
      schema,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      schema,
      cached: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar el esquema del formato';
    console.error(`Error extrayendo esquema de plantilla ${templateId}:`, err);

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}
