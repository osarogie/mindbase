package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/osarogie/mindbase/internal/api"
	"github.com/osarogie/mindbase/internal/cli"
	"github.com/osarogie/mindbase/internal/httpserver"
	"github.com/osarogie/mindbase/internal/vault"
)

func main() {
	if len(os.Args) > 1 && cli.IsCommand(os.Args[1]) {
		os.Exit(cli.Run("mindbase", os.Args[1:]))
	}

	vaultPath := flag.String("vault", "./vault", "Path to vault directory")
	addr := flag.String("addr", ":8780", "HTTP listen address")
	tlsCert := flag.String("tls-cert", "", "TLS certificate file (enables HTTPS and optional HTTP/3)")
	tlsKey := flag.String("tls-key", "", "TLS private key file")
	http3 := flag.Bool("http3", true, "Serve HTTP/3 over QUIC when TLS is enabled")
	webDir := flag.String("web", "", "Path to React web/dist (overrides embedded UI)")
	uiMode := flag.String("ui", "auto", "Web UI: auto (React if built, else templ), react, templ")
	portFile := flag.String("portfile", "", "Write listening address to this file when ready")
	embed := flag.Bool("embed", false, "Embedded mode for native apps (minimal stderr logging)")
	flag.Parse()

	mode := api.UIMode(strings.ToLower(strings.TrimSpace(*uiMode)))
	switch mode {
	case api.UIAuto, api.UIReact, api.UITempl:
	default:
		fmt.Fprintf(os.Stderr, "invalid -ui %q (use auto, react, or templ)\n", *uiMode)
		os.Exit(1)
	}

	if (*tlsCert == "") != (*tlsKey == "") {
		fmt.Fprintln(os.Stderr, "tls-cert and tls-key must both be set")
		os.Exit(1)
	}

	if *embed {
		log.SetOutput(os.NewFile(0, os.DevNull))
	}

	v, err := vault.Open(*vaultPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open vault: %v\n", err)
		os.Exit(1)
	}

	srv, err := api.New(v, mode, *webDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "create server: %v\n", err)
		os.Exit(1)
	}
	defer srv.Close()
	srv.SetRuntimeInfo(api.RuntimeInfo{
		HTTP3: *http3 && *tlsCert != "",
		TLS:   *tlsCert != "",
	})
	// Connector sync is on-demand via POST /api/connectors/sync (no background daemon).

	ln, err := httpserver.Listen(httpserver.Options{
		Addr:     *addr,
		Handler:  srv.Router(),
		CertFile: *tlsCert,
		KeyFile:  *tlsKey,
		HTTP3:    *http3,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}

	actual := ln.Addr().String()
	if *portFile != "" {
		if err := os.WriteFile(*portFile, []byte(actual), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "portfile: %v\n", err)
			os.Exit(1)
		}
		defer os.Remove(*portFile)
	}

	if !*embed {
		ui := "templ+htmx"
		if srv.UsesReactUI() {
			ui = "react"
		}
		scheme := "http"
		if *tlsCert != "" {
			scheme = "https"
		}
		extra := ""
		if *http3 && *tlsCert != "" {
			extra = " http3=udp"
		}
		log.Printf("mindbase vault=%s addr=%s://%s ui=%s%s", v.Root, scheme, actual, ui, extra)
	}

	go func() {
		for err := range ln.Err() {
			fmt.Fprintf(os.Stderr, "server: %v\n", err)
			os.Exit(1)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	if !*embed {
		fmt.Println("\nshutting down...")
	}
	ctx, cancel := httpserver.ShutdownContext(context.Background())
	defer cancel()
	_ = ln.Shutdown(ctx)
}
