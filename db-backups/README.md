# db-backups/

`make backups:pull` drops the VPS PocketBase SQLite snapshots here — an
`rsync` (no `--delete`) of `~/pb/pb_backups/` off the box, so this directory
accumulates history past the box's own 30-day prune.

The **contents are git-ignored** (`/db-backups/*` in the root `.gitignore`);
this README is the only tracked file, kept so the directory exists in a fresh
clone. The snapshots are `data-YYYY-MM-DD.db` files (SQLite); `make backups:pull`
also writes `pull.log` here if you wire it into a cron line (see
`deploy/README.md` §9).

To keep backups somewhere else, set `WDL_BACKUP_DIR` (absolute path) in `.env`
or the environment.

Restore steps: `deploy/README.md` §9, "Restore".
