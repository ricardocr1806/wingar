#!/usr/bin/env bash
# Sobe um PostgreSQL temporário, aplica as migrações e roda os testes de segurança.
# Uso: ./scripts/test-db.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"; PORTA="${PGPORT_TESTE:-54329}"
COMO=(); if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; COMO=(runuser -u postgres --); fi
limpar(){ "${COMO[@]}" "$PGBIN/pg_ctl" -D "$DIR/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap limpar EXIT
"${COMO[@]}" "$PGBIN/initdb" -D "$DIR/db" -U postgres -A trust >/dev/null
"${COMO[@]}" "$PGBIN/pg_ctl" -D "$DIR/db" -o "-p $PORTA -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
PSQL=("${COMO[@]}" "$PGBIN/psql" -h "$DIR" -p "$PORTA" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$RAIZ/supabase/tests/00_auth_local.sql"
for m in "$RAIZ"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$m"; done
for t in "$RAIZ"/supabase/tests/[1-9]*.sql; do
  echo "== $(basename "$t")"
  "${PSQL[@]}" -f "$t" 2>&1 | sed -nE 's/^.*(NOTICE|ERROR):  /\1 /p'
done
echo "Todos os testes passaram."
