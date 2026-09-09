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
        let clean = it
          .replace(/^[¿?0-9\.\-\s•|]+|[¿?]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        return `¿${clean}?`;
      })
      .filter((q) => q.length > 6)
      .join(', ');

    if (formattedQuestions.length > 15) {
      return `Durante la inspección técnica en campo para este formato de ${cleanTitle}, verifique y responda con atención a las pautas de la matriz: ${formattedQuestions}, garantizando las condiciones de seguridad requeridas para la labor.`;
    }
  }

  // Si por alguna razón no se extrajeron ítems, personalizar según el título
  const t = cleanTitle.toUpperCase();
  if (t.includes('DRONE') || t.includes('DRON')) {
    return 'Durante la inspección preoperacional de Drone para este formato, verifique y responda con atención: ¿El fuselaje, motores y hélices se encuentran sin fisuras ni holguras?, ¿las baterías del equipo y del control remoto cuentan con carga completa y temperatura óptima?, ¿la brújula, sensores anticolisión y GPS calibraron con éxito?, ¿la tarjeta de memoria y la cámara están operativas para la misión?, y ¿el área de despegue y aterrizaje está libre de obstáculos con condiciones de viento seguras?';
  }

  return `Durante la inspección técnica en campo para el formato ${cleanTitle}, verifique y responda atentamente a los puntos de verificación y condiciones seguras del equipo en sitio.`;
}

// Función auxiliar para llamar a Gemini con soporte para múltiples modelos
async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 350,
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

  // 1. Extraer ítems reales de la fila 10 para abajo y columnas A a E
  let leftColumnItems: string[] = [];
  let fullTextSummary = '';

  if (templateFileId && !templateFileId.startsWith('fallback-')) {
    try {
      const extraction = await extractTemplateTextSummary(templateFileId);
      leftColumnItems = extraction.leftColumnItems;
      fullTextSummary = extraction.fullTextSummary;
    } catch (extractErr) {
      console.warn('No se pudo extraer la matriz del Excel de Drive:', extractErr);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      paragraph: buildFallbackFromItems(leftColumnItems, code, title),
      source: 'fallback_no_key',
    });
  }

  // 2. Armar el prompt exacto solicitado por el usuario
  const itemsContext =
    leftColumnItems.length > 0
      ? `Ítems extraídos de la matriz del formato (de la fila 10 para abajo, columnas A a E):\n${leftColumnItems
          .map((it, idx) => `${idx + 1}. ${it}`)
          .join('\n')}`
      : fullTextSummary
      ? `Contenido de la plantilla:\n${fullTextSummary}`
      : `Formato de inspección: ${code} - ${title}`;

  const prompt = `Extráeme de este formato un párrafo con una serie de preguntas para que un operador del equipo llene el formulario de forma hablada.

Formato seleccionado: "${code || 'FOR-HSEQ'}" - "${title || 'Inspección'}" (Carpeta: "${folderName || 'General'}")

${itemsContext}

Instrucciones estrictas:
- Devuelve UN SOLO PÁRRAFO continuo de texto corrido.
- Formula entre 4 y 6 preguntas claras y concretas basadas exclusivamente en los ítems extraídos del formato.
- NO uses listas con viñetas, guiones, asteriscos ni saltos de línea.
- NO incluyas introducciones ni saludos. Devuelve única y exclusivamente el párrafo final.`;


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
