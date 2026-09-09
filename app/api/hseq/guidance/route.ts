import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractTemplateTextSummary } from '@/lib/hseq-drive';

// Generador de respaldo de alta fidelidad basado en los ítems reales de la columna izquierda
function buildFallbackFromItems(
  items: string[],
  code: string,
  title: string
): string {
  const cleanTitle = title || code || 'Inspección';

  if (items && items.length > 0) {
    const formattedQuestions = items
      .slice(0, 6)
      .map((it) => {
        const clean = it
          .replace(/^[¿?0-9\.\-\s•|]+|[¿?]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return `¿${clean}?`;
      })
      .filter((q) => q.length > 5)
      .join(', ');

    if (formattedQuestions.length > 15) {
      return `Durante la inspección técnica en campo para el formato ${code} (${cleanTitle}), verifique y responda con atención a las pautas de la matriz: ${formattedQuestions}, garantizando las condiciones de seguridad requeridas para la labor.`;
    }
  }

  // Si por alguna razón no se extrajeron ítems, personalizar según el título
  const t = cleanTitle.toUpperCase();
  if (t.includes('DRONE') || t.includes('DRON')) {
    return 'Durante la inspección preoperacional de Drone para este formato, verifique y responda con atención: ¿El fuselaje, motores y hélices se encuentran sin fisuras ni holguras?, ¿las baterías del equipo y del control remoto cuentan con carga completa y temperatura óptima?, ¿la brújula, sensores anticolisión y GPS calibraron con éxito?, ¿la tarjeta de memoria y la cámara están operativas para la misión?, y ¿el área de despegue y aterrizaje está libre de obstáculos con condiciones de viento seguras?';
  }

  return `Durante la inspección técnica en campo para el formato ${code} (${cleanTitle}), verifique y responda atentamente: ¿Se comprobaron todos los ítems de seguridad y estado de los equipos requeridos?, ¿el personal cuenta con sus Elementos de Protección Personal correspondientes?, ¿se evaluaron los riesgos de la zona y del entorno?, y ¿se dispone de los permisos y medidas de control antes del inicio?`;
}

// Función auxiliar para llamar a Gemini con soporte para múltiples modelos
async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 380,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 40) {
          return text.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } else {
        const errText = await res.text();
        console.warn(`Gemini (${model}) status ${res.status}:`, errText);
      }
    } catch (callErr) {
      console.warn(`Error llamando a Gemini (${model}):`, callErr);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let templateFileId = '';
  let code = '';
  let title = '';
  let folderName = '';

  try {
    const body = await req.json();
    templateFileId = body.templateFileId || '';
    code = body.code || '';
    title = body.title || '';
    folderName = body.folderName || '';
  } catch {
    // Body vacío
  }

  if (!code && !title && !templateFileId) {
    return NextResponse.json(
      { error: 'Debe especificar el formato a analizar' },
      { status: 400 }
    );
  }

  // 1. Extraer ítems reales de la columna izquierda de la matriz desde Google Drive
  let leftColumnItems: string[] = [];
  let fullTextSummary = '';

  if (templateFileId && !templateFileId.startsWith('fallback-')) {
    try {
      const extraction = await extractTemplateTextSummary(templateFileId);
      leftColumnItems = extraction.leftColumnItems;
      fullTextSummary = extraction.fullTextSummary;
    } catch (extractErr) {
      console.warn('No se pudo extraer la columna izquierda del Excel de Drive:', extractErr);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      paragraph: buildFallbackFromItems(leftColumnItems, code, title),
      source: 'fallback_no_key',
    });
  }

  // 2. Armar el prompt para Gemini centrado en los ítems de la columna izquierda
  const itemsContext =
    leftColumnItems.length > 0
      ? `Las preguntas y puntos de inspección extraídos directamente de la columna izquierda de la matriz del formato son:\n${leftColumnItems
          .map((it, idx) => `${idx + 1}. ${it}`)
          .join('\n')}`
      : fullTextSummary
      ? `Texto extraído de la plantilla:\n${fullTextSummary}`
      : `El formato es: ${code} - ${title} (Carpeta: ${folderName})`;

  const prompt = `Actúa como especialista senior en HSEQ de la empresa PROCIMEC.
El Localizador en campo acaba de seleccionar el siguiente formato de inspección oficial:
- Formato: "${code || 'FOR-HSEQ'}" - "${title || 'Inspección'}"
- Carpeta en Google Drive: "${folderName || 'General'}"

CONTENIDO REAL DE LA COLUMNA IZQUIERDA DE LA MATRIZ DE INSPECCIÓN:
"""
${itemsContext}
"""

TU TAREA:
Analiza detenidamente las preguntas y puntos de chequeo de la columna izquierda del formato indicado arriba (por ejemplo, si es drone, concéntrate en fuselaje, hélices, calibración, baterías, cámara y condiciones de vuelo; si es otro formato, en sus puntos exactos).
Redacta UN SOLO PÁRRAFO continuo y fluido que reúna una serie de preguntas de verificación directa basadas FIELMENTE en estos ítems de la matriz para que el Localizador las responda en el audio o por escrito.

REGLAS ESTRICTAS DE REDACCIÓN:
1. Exactamente UN SOLO PÁRRAFO de texto corrido.
2. Inicia con: "Durante la inspección en campo para este formato de ${title || code}, verifique y responda detalladamente: ..."
3. Integra entre 4 y 6 preguntas concretas y específicas derivadas de los ítems de la columna izquierda.
4. NO uses listas con viñetas, guiones, asteriscos ni saltos de línea.
5. NO incluyas introducciones ni saludos. Devuelve única y exclusivamente el párrafo final redactado.`;

  try {
    const aiParagraph = await callGemini(apiKey, prompt);

    if (aiParagraph) {
      return NextResponse.json({
        paragraph: aiParagraph,
        source: 'gemini_analyzed_left_column',
        itemsCount: leftColumnItems.length,
      });
    }

    // Si Gemini no respondió, usar generador estructurado a partir de los ítems de la columna izquierda
    return NextResponse.json({
      paragraph: buildFallbackFromItems(leftColumnItems, code, title),
      source: 'fallback_extracted_items',
      itemsCount: leftColumnItems.length,
    });
  } catch (err) {
    console.error('Error al procesar con IA:', err);
    return NextResponse.json({
      paragraph: buildFallbackFromItems(leftColumnItems, code, title),
      source: 'fallback_exception',
    });
  }
}
