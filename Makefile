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

PORT ?= 8081

# Deploy target host.  `?=` defers to the environment when it is already set, so
# `WDL_DEPLOY_SSH=other-host make deploy` still wins; `export` pushes the value
# into the recipe so `scripts/deploy-web.mjs` sees it either way.  Safe to keep
# in the repo — it is a `~/.ssh/config` alias, no host, user or secret in it.
export WDL_DEPLOY_SSH ?= dreamhost.ae.wex

.DEFAULT_GOAL := help

.PHONY: help install test build serve registry goldens aliases corpora \
        curation-sheet deploy deploy-dry clean

help: ## List the targets
	@grep -hE '^[a-z][a-z-]*:.*## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN { FS = ":.*## " } { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }'

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

curation-sheet: ## Emit curation-sheet.csv (the movement-modifier hand-pass sheet)
	node scripts/export-movement-curation.mjs curation-sheet.csv

corpora: ## Check SOURCES.json/.md still count the corpora right
	node scripts/describe-corpora.mjs

deploy: ## Deploy the static apps  (WDL_DEPLOY_SSH defaults to dreamhost.ae.wex)
	node scripts/deploy-web.mjs

deploy-dry: ## Same as deploy, but rsync runs with -n (no writes)
	node scripts/deploy-web.mjs --dry-run

clean: ## Remove build/ and scratch output
	rm -rf build pairs.json curation-sheet.csv
