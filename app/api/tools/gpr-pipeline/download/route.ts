import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth({ req: request });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'txt';
  const name = searchParams.get('name') || 'entregable';

  let contentType = 'text/plain';
  let content = `PROCIMEC INGENIERÍA S.A.S.\nEntregable: ${name}\nTipo: ${type.toUpperCase()}\nFecha: ${new Date().toISOString()}`;
  let ext = type;

  if (type === 'dwg' || type === 'dxf') {
    contentType = 'application/octet-stream';
    content = `999\nDXF Generado por PROCIMEC PCM CLOUD\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n`;
    ext = 'dxf';
  } else if (type === 'rvt' || type === 'ifc') {
    contentType = 'application/octet-stream';
    content = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('PROCIMEC BIM MODEL LOD 300'),'2;1');\nFILE_NAME('${name}.ifc','${new Date().toISOString()}',('PROCIMEC INGENIERIA'),('Mapping'),'','','');\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n`;
    ext = 'ifc';
  } else if (type === 'docx') {
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (type === 'pdf') {
    contentType = 'application/pdf';
  }

  const filename = `${name}.${ext}`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
