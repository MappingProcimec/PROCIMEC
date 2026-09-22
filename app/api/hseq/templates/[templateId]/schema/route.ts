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
import { parseExcelTemplateSchema, scanHseqTemplates, DynamicFormatSchema } from '@/lib/hseq-drive';

export const dynamic = 'force-dynamic';

// Caché en memoria para esquemas ya analizados
const schemaCache = new Map<string, { schema: DynamicFormatSchema; timestamp: number }>();
const SCHEMA_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

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
  if (forceRefresh) {
    schemaCache.delete(templateId);
  }

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
    const templates = await scanHseqTemplates(false);
    const matched = templates.find((t) => t.id === templateId);
    const candidateName = (matched?.name || matched?.title || templateId).toLowerCase();

    // Si coincide con Drone por nombre de archivo o título en Drive
    if (candidateName.includes('024') || candidateName.includes('drone')) {
      const droneCfg = getHseqFormatConfig('drone');
      const schema: DynamicFormatSchema = {
        id: templateId,
        formatType: 'drone',
        code: droneCfg.code,
        title: droneCfg.title,
        pdfTitle: droneCfg.pdfTitle,
        version: droneCfg.version,
        equipmentLabel: droneCfg.equipmentLabel,
        defaultEquipment: '',
        defaultSerial: '',
        sections: Array.from(DRONE_INSPECTION_SECTIONS),
        items: DRONE_INSPECTION_ITEMS,
        isDynamic: false,
      };

      schemaCache.set(templateId, { schema, timestamp: Date.now() });
      return NextResponse.json({ ok: true, schema, cached: false });
    }

    const schema = await parseExcelTemplateSchema(templateId, undefined, matched?.name || templateId);

    // Salvaguardas canónicas por formato oficial PROCIMEC:
    if (schema.code.includes('024') || schema.title.toLowerCase().includes('drone')) {
      schema.items = schema.items.map((it) => {
        if (it.code === '1.4' || it.description.toLowerCase().includes('corrosi')) {
          return { ...it, optimal: 'NO' as const };
        }
        return it;
      });
    } else if (schema.code.includes('027') || schema.title.toLowerCase().includes('gpr') || schema.title.toLowerCase().includes('georadar')) {
      // En Georadar GPR todas las respuestas óptimas son estrictamente 'SI'
      schema.items = schema.items.map((it) => ({ ...it, optimal: 'SI' as const }));
    } else if (schema.code.includes('026') || schema.title.toLowerCase().includes('gps') || schema.title.toLowerCase().includes('gnss')) {
      // En GPS Diferencial: 1.4 es 'SI', 3.1 es 'NO', 1.2 es 'NO', 2.2 es 'NO', resto 'SI'
      schema.items = schema.items.map((it) => {
        if (it.code === '1.4') return { ...it, optimal: 'SI' as const };
        if (it.code === '3.1' || it.code === '1.2' || it.code === '2.2') return { ...it, optimal: 'NO' as const };
        return { ...it, optimal: 'SI' as const };
      });
    }

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
