# DetailHub

Sistema de gestão para estética e proteção automotiva, vendido para várias empresas.
Cada empresa tem seus dados isolados, a própria equipe e os próprios cargos.

## Estrutura

- `supabase/migrations/` — banco de dados (PostgreSQL no Supabase): tabelas, regras de segurança e funções.
- `supabase/tests/` — testes de segurança que rodam num PostgreSQL local.
- `scripts/test-db.sh` — sobe um banco temporário, aplica as migrações e roda os testes.

## Níveis de acesso

1. **Dono da plataforma** — cria empresas, define o teto de cada uma e o cargo de administrador.
2. **Administrador da empresa** — monta a equipe e os cargos dentro do teto.
3. **Administrador de área** — administra só a área dele (ex.: gerente financeiro).
4. **Equipe** — usa o sistema conforme o cargo.

Permissão efetiva de um cargo = permissões dele ∩ permissões efetivas do cargo pai ∩ teto da empresa.
Ninguém libera para outra pessoa uma permissão que não tem. Tudo isso é garantido pelo próprio banco
(Row Level Security), não só pelas telas.

## Rodar os testes

```bash
./scripts/test-db.sh
```

Precisa de PostgreSQL 15+ instalado (`initdb`, `pg_ctl`, `psql`).

## Sistema (telas)

`web/` — Next.js com login do Supabase (e-mail e senha, Google e convite).

- `/entrar` — entrar, criar conta, esqueci a senha e "Continuar com Google".
- `/convite/[código]` — aceitar convite (só funciona com o e-mail convidado).
- `/app` — empresas da pessoa; `/app/[empresa]` — módulos liberados pelo cargo.
- `/app/[empresa]/equipe` — cargos, permissões, pessoas e convites.
- `/plataforma` — painel do dono da plataforma (criar empresas, teto, convidar administrador).

```bash
cd web && cp .env.example .env.local   # preencha com os dados do Supabase
npm install && npm run dev
```
