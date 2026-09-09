import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Respuestas de respaldo de alta calidad según temática del formato
function getFallbackGuidance(code: string, title: string): string {
  const c = (code || '').toUpperCase();
  const t = (title || '').toUpperCase();

  if (c.includes('012') || t.includes('ALTURA')) {
    return 'Durante la inspección en campo para este formato de Trabajo en Alturas, verifique y responda con atención: ¿El arnés de cuerpo entero, las eslingas de posicionamiento y las líneas de vida se encuentran limpios, sin cortes, quemaduras ni costuras descosidas?, ¿los absorbedores de choque y mosquetones cuentan con doble seguro operativo y certificación visible?, ¿los puntos de anclaje estructurales fueron evaluados y garantizan la resistencia reglamentaria?, ¿el Localizador y el personal en sitio poseen su certificación vigente de trabajo en alturas y aptitud física?, y ¿las condiciones meteorológicas en la zona son estables, libres de lluvia, vientos fuertes o tormenta eléctrica?';
  }

  if (c.includes('005') || t.includes('EPP')) {
    return 'Para la inspección técnica de Elementos de Protección Personal (EPP), observe detenidamente e indique: ¿El casco dieléctrico cuenta con su tafilete y barbuquejo de 3 puntos en perfecto estado?, ¿las gafas de seguridad con protección UV están limpias y libres de fisuras o rayones?, ¿el calzado de seguridad con puntera certificada y suela antideslizante se encuentra en uso activo?, ¿los guantes de protección corresponden exactamente al riesgo mecánico, químico o eléctrico de la labor?, y ¿se dispone de protección auditiva y respiratoria adecuada según el nivel de ruido y material particulado del entorno?';
  }

  if (c.includes('021') || t.includes('PERMISO') || t.includes('VIA') || t.includes('VÍA') || t.includes('TRANSITO')) {
    return 'Durante la verificación de señalización y permisos de trabajo en vía, confirme y detalle: ¿Se instalaron todos los conos reflectivos, colombinas y vallas delimitando con suficiente distancia el área de trabajo y al personal?, ¿el paletero asignado cuenta con su dotación reglamentaria, chaleco de alta visibilidad y paleta pare/siga en mano?, ¿se valoraron los peligros del entorno como flujo vehicular pesado, excavaciones adyacentes o líneas energizadas?, ¿se dispone de extintor con manómetro en verde y botiquín de primeros auxilios dotado?, y ¿los permisos de trabajo y el plan de contingencia fueron coordinados y aprobados con la supervisión de obra?';
  }

  if (c.includes('008') || t.includes('VEHICUL') || t.includes('EQUIPO') || t.includes('PREOPERACIONAL')) {
    return 'En la inspección preoperacional de vehículo y equipos de exploración, compruebe y precise: ¿Los niveles de aceite de motor, refrigerante, líquido de frenos y dirección hidráulica se encuentran en el rango óptimo?, ¿todas las luces principales, direccionales, intermitentes, de freno y reversa operan al 100%?, ¿la presión, labrado y estado general de los neumáticos (incluyendo la llanta de repuesto) son seguros?, ¿el kit de carretera reglamentario, botiquín y extintor vigente se encuentran a bordo?, y ¿el Localizador cuenta con licencia de conducción y documentación técnica del vehículo al día?';
  }

  if (c.includes('LOC') || t.includes('GPR') || t.includes('GEORRADAR') || t.includes('ELECTROMAGNET')) {
    return 'Al realizar la verificación operativa del equipo de localización GPR y electromagnético, constate e informe: ¿La batería, cables de conexión, odómetro y antena se encuentran secos, limpios y sin señales de desgaste o fisuras?, ¿el software de adquisición de datos inicializa y calibra la velocidad del suelo correctamente?, ¿el área de exploración fue despejada de obstáculos superficiales o interferencias metálicas no registradas?, ¿el Localizador porta su chaleco reflectivo y calzado de seguridad en todo el recorrido?, y ¿se tienen identificados los puntos de referencia fijos para la georreferenciación precisa del trazado?';
  }

  // Respaldo general para cualquier otro formato FOR-*
  return `Durante la inspección técnica en campo para el formato ${code || 'HSEQ'} (${title || 'Inspección de Seguridad'}), verifique y responda de manera clara: ¿El área de trabajo se encuentra limpia, ordenada y libre de obstáculos o riesgos locativos?, ¿las herramientas y equipos utilizados cuentan con mantenimiento al día y operación segura?, ¿el personal cuenta con todos sus Elementos de Protección Personal correspondientes y en uso continuo?, ¿se realizó la charla de seguridad y evaluación de peligros previa al inicio de actividades?, y ¿se tiene identificado el plan de evacuación y los medios de comunicación en caso de emergencia?`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let code = '';
  let title = '';
  let folderName = '';

  try {
    const body = await req.json();
    code = body.code || '';
    title = body.title || '';
    folderName = body.folderName || '';
  } catch {
    // Body vacío o malformado
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      paragraph: getFallbackGuidance(code, title),
      source: 'fallback_rule',
    });
  }

  try {
    const prompt = `Actúa como un especialista senior en HSEQ (Seguridad, Salud en el Trabajo, Medio Ambiente y Calidad) de la empresa de ingeniería PROCIMEC.
El Localizador en campo va a diligenciar la inspección correspondiente al formato:
- Código de formato: "${code || 'FOR-HSEQ'}"
- Título o tema: "${title || 'Inspección en Campo'}"
- Carpeta de referencia: "${folderName || 'General'}"

Tu tarea es redactar UN SOLO PÁRRAFO continuo y fluido que contenga una serie de preguntas clave de verificación que el Localizador debe responder en su dictado por voz o por escrito.
Reglas estrictas de formato:
1. Debe ser exactamente UN SOLO PÁRRAFO de texto corrido.
2. Comienza con una frase orientadora como: "Durante la inspección en campo para este formato de [Tema], verifique y responda detalladamente: ..."
3. Integra entre 4 y 6 preguntas directas y concretas sobre condiciones del entorno, equipos, EPP, riesgos críticos y cumplimiento de seguridad aplicables a este formato.
4. NO uses viñetas, guiones, listas numeradas ni saltos de línea.
5. NO incluyas introducciones como "Aquí tienes el párrafo" ni saludos. Devuelve única y exclusivamente el párrafo de texto.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
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
          temperature: 0.3,
          maxOutputTokens: 350,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('Gemini API respondió con status:', res.status);
      return NextResponse.json({
        paragraph: getFallbackGuidance(code, title),
        source: 'fallback_api_error',
      });
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (rawText && rawText.length > 40) {
      // Limpiar posibles saltos de línea para garantizar un solo párrafo fluido
      const cleanParagraph = rawText.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
      return NextResponse.json({
        paragraph: cleanParagraph,
        source: 'gemini_ai',
      });
    }

    return NextResponse.json({
      paragraph: getFallbackGuidance(code, title),
      source: 'fallback_empty',
    });
  } catch (err) {
    console.error('Error al llamar a Gemini AI para pautas HSEQ:', err);
    return NextResponse.json({
      paragraph: getFallbackGuidance(code, title),
      source: 'fallback_exception',
    });
  }
}
