package main

import (
	"os"

	"github.com/osarogie/mindbase/internal/cli"
)

func main() {
	name := "mind"
	if len(os.Args) > 0 {
		name = baseName(os.Args[0])
	}
	os.Exit(cli.Run(name, os.Args[1:]))
}

func baseName(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' || path[i] == '\\' {
			return path[i+1:]
		}
	}
	return path
}
