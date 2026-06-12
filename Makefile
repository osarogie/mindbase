.PHONY: dev build run desktop mobile-sync templ tools clean pnpm-install

VAULT ?= ./vault
ADDR ?= :8080

# Sync pinned Go tools from go.mod (air, templ)
tools:
	go mod download
	@echo "Go tools:"
	@go tool templ version
	@go tool air -v

templ:
	go tool templ generate ./internal/ui/templates/...

build: templ
	go build -o bin/mindbase ./cmd/mindbase

run: build
	./bin/mindbase -vault $(VAULT) -addr $(ADDR)

# Hot reload: air rebuilds on .go/.templ changes (runs templ generate first)
dev:
	go tool air

pnpm-install:
	pnpm install

desktop: build
	chmod +x macos/scripts/*.sh
	./macos/scripts/build-app.sh

mobile-sync: build pnpm-install
	pnpm mobile:sync

legacy-web: pnpm-install
	pnpm web:build

clean:
	rm -rf bin tmp web/dist node_modules mobile/node_modules macos/build web/node_modules pnpm-lock.yaml
