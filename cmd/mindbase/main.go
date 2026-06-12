package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/osarogie/mindbase/internal/api"
	"github.com/osarogie/mindbase/internal/vault"
)

func main() {
	vaultPath := flag.String("vault", "./vault", "Path to vault directory")
	addr := flag.String("addr", ":8080", "HTTP listen address")
	webDir := flag.String("web", "", "Legacy React web/dist path (optional; default uses templ UI)")
	portFile := flag.String("portfile", "", "Write listening address to this file when ready")
	embed := flag.Bool("embed", false, "Embedded mode for native apps (minimal stderr logging)")
	flag.Parse()

	if *embed {
		log.SetOutput(os.NewFile(0, os.DevNull))
	}

	v, err := vault.Open(*vaultPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open vault: %v\n", err)
		os.Exit(1)
	}

	srv, err := api.New(v, *webDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "create server: %v\n", err)
		os.Exit(1)
	}
	defer srv.Close()
	srv.StartConnectors()

	ln, err := net.Listen("tcp", *addr)
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
		if *webDir != "" {
			ui = "legacy-react"
		}
		log.Printf("mindbase vault=%s addr=%s ui=%s", v.Root, actual, ui)
	}

	server := &http.Server{Handler: srv.Router()}
	go func() {
		if err := server.Serve(ln); err != nil && err != http.ErrServerClosed {
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
}
