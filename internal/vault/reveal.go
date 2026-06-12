package vault

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

func (v *Vault) NoteAbsPath(rel string) (string, error) {
	return v.ResolveNotePath(rel)
}

func (v *Vault) DatabaseAbsPath(name string) (string, error) {
	return v.ResolveDatabasePath(name)
}

func RevealInFinder(absPath string) error {
	if absPath == "" {
		return fmt.Errorf("empty path")
	}
	if _, err := os.Stat(absPath); err != nil {
		return err
	}
	if runtime.GOOS == "darwin" {
		return exec.Command("open", "-R", absPath).Start()
	}
	return fmt.Errorf("reveal in finder is only supported on macOS")
}
