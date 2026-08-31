import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const er = formData.get('er') as string || 'null';
    const ventanaNs = formData.get('ventanaNs') as string || 'null';
    const dx = formData.get('dx') as string || 'null';
    const longitud = formData.get('longitud') as string || 'null';
    const cmap = formData.get('cmap') as string || 'seismic';
    const conFiltros = formData.get('conFiltros') as string || 'false';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo .gsf' }, { status: 400 });
    }

    // Save temporary file to OS temp dir
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpr-'));
    const tempFilePath = path.join(tempDir, file.name);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    const scriptPath = path.join(process.cwd(), 'scripts', 'visualizador_gpr_gsf.py');

    // Run Python script
    const pyResult = await new Promise<string>((resolve, reject) => {
      const pyProcess = spawn('python', [
        scriptPath,
        '--json-api',
        tempFilePath,
        er,
        ventanaNs,
        dx,
        longitud,
        cmap,
        conFiltros,
      ]);

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pyProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });
    });

    // Cleanup temp file
    try {
      await fs.unlink(tempFilePath);
      await fs.rmdir(tempDir);
    } catch {
      // ignore
    }

    // Extract JSON between markers
    const startTag = '__GPR_JSON_START__';
    const endTag = '__GPR_JSON_END__';
    const startIndex = pyResult.indexOf(startTag);
    const endIndex = pyResult.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error(`Respuesta inválida de Python: ${pyResult}`);
    }

    const jsonStr = pyResult.substring(startIndex + startTag.length, endIndex).trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al ejecutar el script Python de GPR';
    console.error('Error en /api/gpr/process-py:', error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
