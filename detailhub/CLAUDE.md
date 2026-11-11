# DetailHub — regras de trabalho

O sistema está em produção: a Wingard (wingard.detailhub.com.br) opera com dados reais.
Toda mudança pedida é publicada mantendo intacto tudo o que os clientes já lançaram.

## Antes de publicar
1. `./scripts/test-db.sh` — todos os testes de segurança do banco precisam passar.
2. `cd web && node scripts/gerar-apresentacao.mjs` sem avisos de "trecho não encontrado" e `npx tsc --noEmit -p .`.
3. Mudanças na tela que mexem em dados: teste no navegador (Playwright) que abrir o sistema
   não envia alterações falsas e que o que foi salvo continua lá depois de recarregar.

## Dados do cliente (nunca perder)
- Os dados ficam no Supabase: `registros` (atendimentos, clientes, catálogo, config) e `contas_pagar`.
- Migrações só **adicionam** (novas tabelas/colunas com valor padrão). Nunca `drop`, `truncate`,
  `delete` em massa ou mudança de tipo destrutiva em tabela com dados de cliente.
- Os ids dos registros são a ligação com o banco: não mudar o formato dos ids existentes
  (`N<código>` do histórico, `C0001…` dos clientes do histórico) nem a ordem de `HISTDATA` em `private/wingard.html`.
- Ao mudar o formato de um dado salvo, a tela precisa continuar lendo o formato antigo.
- Abas abertas se atualizam sozinhas quando sai versão nova (`scripts/sincronizar-na-apresentacao.js`),
  só depois de salvar tudo o que estava pendente.

## Publicar
`cd web && npm run deploy` (Cloudflare Workers). Migrações: API do Supabase (`/database/migrations`).
Dados de clientes (planilhas, histórico, `private/`, `src/generated/`) nunca vão para o GitHub.
