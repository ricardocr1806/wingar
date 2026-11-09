'use client';
import { createBrowserClient } from '@supabase/ssr';
import { COOKIE_DOMAIN, SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabaseBrowser = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { cookieOptions: COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : undefined });
