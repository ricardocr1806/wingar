import type { NextRequest } from 'next/server';
import { servirApresentacao } from '@/lib/apresentacao';

// Usado pelo endereço próprio da empresa: wingard.detailhub.com.br/ → /apresentacao/wingard
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return servirApresentacao(req, slug);
}
