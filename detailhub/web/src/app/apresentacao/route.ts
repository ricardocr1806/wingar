import type { NextRequest } from 'next/server';
import { servirApresentacao } from '@/lib/apresentacao';

export async function GET(req: NextRequest) {
  return servirApresentacao(req, req.nextUrl.searchParams.get('empresa') ?? '');
}
