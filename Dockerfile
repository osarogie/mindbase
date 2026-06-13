# syntax=docker/dockerfile:1
#
# Production image: builds the React UI, embeds it into a static Go binary,
# and ships it on a minimal Alpine runtime. ~20 MB final image, no CGO.

# --- Stage 1: build the React web UI ---------------------------------------
FROM oven/bun:1 AS web
WORKDIR /app

# Restrict the bun workspace to the web-facing packages so the heavy
# React Native / Expo mobile deps are never installed in the image.
COPY package.json bun.lock ./
COPY web/package.json web/package.json
COPY editor-ui/package.json editor-ui/package.json
RUN bun -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.workspaces=['web','editor-ui'];fs.writeFileSync('package.json',JSON.stringify(p,null,2))" \
 && bun install

COPY tsconfig.json tsconfig.json
COPY editor-ui editor-ui
COPY web web
RUN bun run --cwd web build

# --- Stage 2: build the Go server (static) ---------------------------------
FROM golang:1.25-alpine AS server
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Embed the freshly built React UI.
RUN rm -rf internal/webui/dist && mkdir -p internal/webui
COPY --from=web /app/web/dist internal/webui/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/mindbase ./cmd/mindbase

# --- Stage 3: runtime ------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget \
 && adduser -D -u 10001 mindbase \
 && mkdir -p /vault && chown mindbase:mindbase /vault
COPY --from=server /out/mindbase /usr/local/bin/mindbase
USER mindbase
WORKDIR /app
EXPOSE 8780
VOLUME ["/vault"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:8780/api/health >/dev/null 2>&1 || exit 1
ENTRYPOINT ["mindbase"]
CMD ["-vault", "/vault", "-addr", ":8780", "-ui", "react"]
