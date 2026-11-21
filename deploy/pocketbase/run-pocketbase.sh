#!/bin/sh
# Keep PocketBase running WITHOUT systemd — the DreamHost managed-VPS path.
#
# Idempotent: exits immediately if a live process is already recorded in the
# pidfile, otherwise (re)starts it detached. Drive it from cron so it doubles as
# both boot-start and crash-restart:
#
#   crontab -e   # then add the two lines from deploy/pocketbase/crontab.fragment
#
# Assumes the layout from deploy/README.md: binary, pb_data/, pb_migrations/ all
# under $HOME/pb. Override PB_DIR / PB_PORT in the environment if yours differs.

set -eu

PB_DIR="${PB_DIR:-$HOME/pb}"
PB_PORT="${PB_PORT:-8090}"
PIDFILE="$PB_DIR/pocketbase.pid"
LOG="$PB_DIR/pocketbase.log"

if [ -e "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  exit 0
fi

cd "$PB_DIR"
nohup ./pocketbase serve \
  --http "127.0.0.1:$PB_PORT" \
  --dir "$PB_DIR/pb_data" \
  --migrationsDir "$PB_DIR/pb_migrations" \
  --origins "${PB_ORIGINS:-https://wex.androidempathy.com}" \
  >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "$(date -u +%FT%TZ) started pocketbase pid $(cat "$PIDFILE")" >> "$LOG"
