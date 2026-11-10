'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

/** Quando a pessoa chega pelo link do e-mail, a sessão vem no fim do endereço (#access_token=...). Aqui ela é guardada e a página recarrega já logada. */
export function SessaoDoLink() {
  const [entrando, setEntrando] = useState(false);
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token');
    if (!access_token || !refresh_token) return;
    setEntrando(true);
    supabaseBrowser().auth.setSession({ access_token, refresh_token }).finally(() => {
      window.location.replace(window.location.pathname + window.location.search);
    });
  }, []);
  return entrando ? <p className="msg ok" role="status">Entrando…</p> : null;
}
