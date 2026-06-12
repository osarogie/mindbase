.PHONY: dev build run desktop mobile-sync templ tools clean pnpm-install libmindbase cli

VAULT ?= ./vault
ADDR ?= :8780

# Sync pinned Go tools from go.mod (air, templ)
tools:
	go mod download
	@echo "Go tools:"
	@go tool templ version
	@go tool air -v

templ:
	go tool templ generate ./internal/ui/templates/...

libmindbase:
	chmod +x scripts/build-libmindbase.sh
	./scripts/build-libmindbase.sh

build: templ
	go build -o bin/mindbase ./cmd/mindbase

cli:
	go build -o bin/mind ./cmd/mind

install-cli: cli
	@mkdir -p $(HOME)/.local/bin
	@install -m 755 bin/mind $(HOME)/.local/bin/mind
	@ln -sf mind $(HOME)/.local/bin/mindbase 2>/dev/null || cp bin/mind $(HOME)/.local/bin/mindbase
	@echo "Installed mind + mindbase (CLI) to $(HOME)/.local/bin"
	@echo "Note: repo server binary is bin/mindbase from 'make build'"

run: build
	./bin/mindbase -vault $(VAULT) -addr $(ADDR)

# Hot reload: air rebuilds on .go/.templ changes (runs templ generate first)
dev:
	go tool air

pnpm-install:
	pnpm install

desktop: libmindbase
	chmod +x macos/scripts/*.sh
	./macos/scripts/build-app.sh

mobile-prebuild: libmindbase pnpm-install
	pnpm mobile:prebuild

legacy-web: pnpm-install
	pnpm web:build

clean:
	rm -rf bin/mind bin/mindbase tmp web/dist node_modules mobile/node_modules macos/build web/node_modules pnpm-lock.yaml
