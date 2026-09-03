# WDL — task runner.  `make` (or `make help`) lists the targets.
#
# Thin wrappers over the commands documented in
# docs/context/topics/running-it.md.  This file is the single memorable surface,
# not new build logic: every target's underlying `node scripts/*` form still
# runs directly if you want it.
#
# This repo is install-free by design — no node_modules, no lockfile; ohm-js is
# vendored into packages/core/src/grammar/vendor/.  Keep it that way: no target
# here may introduce a dependency or a package manager step.

# Load ./.env (git-ignored) when it exists, so the database and deploy targets
# pick up WDL_PB_URL / WDL_PB_ADMIN_* / WDL_DEPLOY_* without an inline
# `VAR=… make …` prefix.  Copy .env.example to .env and fill it in.  GNU Make
# parses the file: no quotes, no '#' mid-value, no '$'.  `export` (inside the
# guard, so nothing changes when .env is absent) pushes the values into every
# recipe's environment, where the `node scripts/*` commands read them.  The
# `?=` defaults below still fill in anything .env leaves unset.  Precedence:
# `make VAR=x <target>` (a make argument) overrides .env; .env overrides the
# `?=` defaults and a `VAR=x make` shell prefix.
ifneq (,$(wildcard ./.env))
include .env
export
endif

PORT ?= 8081

# Deploy target host.  `?=` defers to the environment when it is already set, so
# `WDL_DEPLOY_SSH=other-host make deploy` still wins; `export` pushes the value
# into the recipe so `scripts/deploy-web.mjs` sees it either way.  Safe to keep
# in the repo — it is a `~/.ssh/config` alias, no host, user or secret in it.
export WDL_DEPLOY_SSH ?= dreamhost.ae.wex

# Where `make backups:pull` drops the DB snapshots it fetches off the VPS.
# Repo-relative by default — `db-backups/` at the repo root, whose contents are
# git-ignored (the directory and its README are tracked).  No `--delete` on that
# rsync, so it keeps history past the box's own 30-day prune (deploy/README.md
# §9).  Set an absolute path in `.env` / the environment to keep backups
# elsewhere.
WDL_BACKUP_DIR ?= db-backups

.DEFAULT_GOAL := help

.PHONY: help install test build serve registry goldens aliases corpora \
        curation\:sheet curation\:check curation\:apply movements\:load movements\:dump \
        workouts\:load vocab\:load goals\:load deploy deploy\:dry deploy\:db backups\:pull clean

help: ## List the targets
	@grep -hE '^[a-z][a-z:\\-]*:.*## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN { FS = ":.*## " } { name = $$0; sub(/:[^:]*##.*/, "", name); gsub(/\\/, "", name); printf "  \033[36m%-15s\033[0m %s\n", name, $$2 }'

install: ## Nothing to install — this repo is install-free by design
	@echo "Nothing to install: no node_modules, no lockfile. ohm-js is vendored."

test: ## Run the core test suite
	npm --prefix packages/core test

build: ## Emit the core as browser modules into build/web/core/
	node scripts/build-web.mjs

serve: build ## Build, then serve the repo root  (override with PORT=NNNN)
	node scripts/serve.mjs $(PORT)

registry: ## Rebuild registry/ from its sources (the whole canonical pipeline)
	node scripts/build-canonical.ts

goldens: ## Regenerate the golden files, then show what moved
	node packages/core/test/golden/generate.ts
	@git --no-pager diff --stat -- \
		packages/core/test/golden registry/workouts.canonical.json || true

aliases: ## Report every name two records answer to, and who wins
	node scripts/check-aliases.mjs

curation\:sheet: ## Emit curation-sheet.csv (the movement-modifier hand-pass sheet)
	node scripts/export-movement-curation.mjs curation-sheet.csv

curation\:check: ## Dry-run a curated CSV against the registry — report only  (CSV=path)
	$(if $(CSV),,$(error set CSV=<curated.csv> — e.g. make curation:check CSV=chunk.csv))
	node scripts/import-movement-curation.mjs $(CSV)

curation\:apply: ## Land a curated CSV into registry/movements.json  (CSV=path)
	$(if $(CSV),,$(error set CSV=<curated.csv> — e.g. make curation:apply CSV=chunk.csv))
	node scripts/import-movement-curation.mjs $(CSV) --apply

corpora: ## Check SOURCES.json/.md still count the corpora right
	node scripts/describe-corpora.mjs

movements\:load: ## Ingest registry/movements.json -> the movements collection over /api  (idempotent; WDL_PB_URL / admin creds for prod)
	node scripts/movements-to-db.mjs

movements\:dump: ## Dump the movements collection -> registry/movements.json over /api  (reviewable diff; --dry-run / --check via ARGS=)
	node scripts/movements-from-db.mjs $(ARGS)

workouts\:load: ## Ingest examples/workouts/**/*.wdl -> the workouts collection over /api + regenerate fixtures  (idempotent; ARGS=--dry-run; superuser creds for prod)
	node scripts/workouts-to-db.mjs $(ARGS)

vocab\:load: ## Ingest registry/{equipment,patterns}.json -> the equipment + patterns collections over /api  (idempotent; ARGS=--dry-run; WDL_PB_URL / admin creds for prod)
	node scripts/vocab-to-db.mjs $(ARGS)

goals\:load: ## Ingest examples/goals/*.wdlg -> the goals collection over /api as global rows  (idempotent; ARGS=--dry-run; WDL_PB_URL / admin creds for prod)
	node scripts/goals-to-db.mjs $(ARGS)

deploy: ## Deploy the static apps  (WDL_DEPLOY_SSH defaults to dreamhost.ae.wex)
	node scripts/deploy-web.mjs

deploy\:dry: ## Same as deploy, but rsync runs with -n (no writes)
	node scripts/deploy-web.mjs --dry-run

deploy\:db: ## Sync deploy/pocketbase/pb_migrations/ to the VPS and restart PocketBase to apply
	rsync -av deploy/pocketbase/pb_migrations/*.js $(WDL_DEPLOY_SSH):pb/pb_migrations/
	ssh $(WDL_DEPLOY_SSH) 'systemctl --user restart pocketbase && sleep 2 && curl -fsS http://127.0.0.1:8090/api/health && echo'

backups\:pull: ## Pull the VPS DB backups off the box into db-backups/ (WDL_BACKUP_DIR; no --delete)
	mkdir -p $(WDL_BACKUP_DIR)
	rsync -av $(WDL_DEPLOY_SSH):pb/pb_backups/ $(WDL_BACKUP_DIR)/

clean: ## Remove build/ and scratch output
	rm -rf build pairs.json curation-sheet.csv
