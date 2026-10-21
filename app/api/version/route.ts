import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'PROCIMEC PCM CLOUD',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev',
    ref: process.env.VERCEL_GIT_COMMIT_REF || 'main',
    timestamp: new Date().toISOString(),
  });
}
