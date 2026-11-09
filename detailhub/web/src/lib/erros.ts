/** Traduz erros do banco para mensagens que a pessoa entende. */
export function mensagemErro(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'Algo deu errado. Tente de novo.';
  const m = e.message ?? '';
  if (/row-level security|permission denied|42501/i.test(m) || e.code === '42501')
    return /Só o dono|Entre na sua conta|outro e-mail|nível/.test(m) ? m : 'Você não tem permissão para fazer isso.';
  if (/duplicate key|23505/.test(m) || e.code === '23505') return 'Já existe um cadastro com esses dados.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci minha senha".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  return m || 'Algo deu errado. Tente de novo.';
}
