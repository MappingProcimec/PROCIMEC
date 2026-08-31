import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { headerAscii, headerHex, fileSizeBytes, filename } = body;

    const apiKey = process.env.GEMINI_API_KEY || '';

    const systemPrompt = `You are an expert Senior Geophysics & GPR (Ground Penetrating Radar) Digital Signal Processing Engineer.
Your task is to analyze a binary/ASCII header dump from a GPR radargram file (.gsf from ImpulseRadar, Geotech, or standard GPR systems).
We need to extract or compute the EXACT matrix dimensions and stride parameters so the radargram can be rendered without phase slant, aliasing, or distortion.

Key parameters needed:
1. numSamples: (Integer) Number of samples per trace. Typically 256, 512, 1024, 2048, or explicit in header (look for SAMPLES, POINTS, NS, etc.).
2. byteOffsetData: (Integer) Offset in bytes where trace data begins (often 512, 1024, 2048, or after ASCII header null terminator block).
3. traceHeaderBytes: (Integer) Header bytes prepended to EACH trace (e.g. 0, 16, 24, 28, 32, 64). In ImpulseRadar GSF, each trace may have a 0B, 24B, or 32B trace header.
4. dataType: (String) "int16" | "uint16" | "float32"
5. sampleIntervalNs: (Float) Time step dt in nanoseconds (e.g. 0.097656 ns).
6. traceDistanceStepM: (Float) Distance step dx in meters (e.g. 0.05 m).
7. antennaFreqMHz: (Float) Antenna center frequency in MHz (e.g. 450 MHz).
8. explanation: (String) Brief 1-sentence technical explanation of how you determined the parameters.

Calculate the resulting trace count using: totalTraces = floor((fileSizeBytes - byteOffsetData) / (numSamples * bytesPerSample + traceHeaderBytes)).
Ensure totalTraces is a clean integer with minimal remainder.

Return ONLY a valid JSON object matching the required schema with no extra text or markdown formatting outside JSON.`;

    const userContent = `Filename: ${filename || 'Profile.gsf'}
Total File Size: ${fileSizeBytes} bytes

--- ASCII HEADER DUMP (first 4096 bytes) ---
${headerAscii || ''}

--- HEX DUMP (first 512 bytes) ---
${headerHex || ''}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API Error:', errText);
      return NextResponse.json(
        { error: `Error en Gemini API: ${geminiRes.statusText}` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawOutput =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawOutput);
    } catch {
      // Strip any markdown fences
      const cleanJson = rawOutput.replace(/```json|```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    }

    return NextResponse.json({ success: true, data: parsedResult });
  } catch (error: unknown) {
    console.error('API Error in analyze-header:', error);
    return NextResponse.json({ error: (error as Error).message || 'Error interno' }, { status: 500 });
  }
}
