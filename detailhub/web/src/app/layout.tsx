import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'DetailHub',
  description: 'Gestão completa para estética e proteção automotiva.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0E1117' };

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
