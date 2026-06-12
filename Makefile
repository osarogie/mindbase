.PHONY: dev build run run-templ run-react desktop mobile-sync templ tools clean bun-install libmindbase cli icons editor-ui react-ui ui-css legacy-web

VAULT ?= ./vault
ADDR ?= :8780

# Sync pinned Go tools from go.mod (air, templ, task)
tools:
	go mod download
	@echo "Go tools:"
	@go tool templ version
	@go tool air -v
	@go tool task --version

templ:
	go tool templ generate ./internal/ui/templates/...

libmindbase:
	chmod +x scripts/build-libmindbase.sh
	./scripts/build-libmindbase.sh

build: templ editor-ui ui-css react-ui
	go build -o bin/mindbase ./cmd/mindbase

editor-ui: bun-install
	bun run editor-ui:build

ui-css: bun-install
	bun run ui-css

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

run-templ: build
	./bin/mindbase -vault $(VAULT) -addr $(ADDR) -ui templ

run-react: react-ui
	go build -o bin/mindbase ./cmd/mindbase
	./bin/mindbase -vault $(VAULT) -addr $(ADDR) -ui react

# Hot reload: air rebuilds on .go/.templ changes (runs templ generate first)
dev:
	go tool air

bun-install:
	bun install

icons:
	node scripts/generate-icons.mjs

desktop: libmindbase
	chmod +x macos/scripts/*.sh
	./macos/scripts/build-app.sh

mobile-prebuild: libmindbase bun-install
	bun run mobile:prebuild

mobile-prebuild-clean: libmindbase bun-install
	bun run mobile:prebuild:clean

legacy-web: bun-install
	bun run web:build

react-ui: bun-install
	bun run web:build
	rm -rf internal/webui/dist
	cp -R web/dist internal/webui/dist

clean:
	rm -rf bin/mind bin/mindbase tmp web/dist node_modules mobile/node_modules macos/build web/node_modules bun.lock
