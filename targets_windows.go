//go:build windows

package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"k8s.io/client-go/util/homedir"
)

type TargetKind string

const (
	TargetWindows TargetKind = "windows"
	TargetWSL     TargetKind = "wsl"
)

// Windows kubeconfig path
func windowsKubeconfigPath() (string, error) {
	home := homedir.HomeDir()
	if home == "" {
		return "", fmt.Errorf("cannot detect windows home dir")
	}
	return filepath.Join(home, ".kube", "config"), nil
}

// Lists WSL distros via `wsl.exe -l -q`
func listWSLDistros() ([]string, error) {
	cmd := exec.Command("wsl.exe", "-l", "-q")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to list WSL distros: %v (%s)", err, out.String())
	}

	lines := strings.Split(out.String(), "\n")
	var distros []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l != "" {
			distros = append(distros, l)
		}
	}
	return distros, nil
}

// Builds a Windows path to WSL file via \\wsl$\<Distro>\home\<LinuxUser>\.kube\config
func wslKubeconfigUNC(distro, linuxUser string) (string, error) {
	distro = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(distro, "\r", ""), "\t", ""))
	linuxUser = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(linuxUser, "\r", ""), "\t", ""))

	if distro == "" {
		return "", fmt.Errorf("distro is required")
	}
	if linuxUser == "" {
		return "", fmt.Errorf("linuxUser is required")
	}

	return fmt.Sprintf(`\\wsl$\%s\home\%s\.kube\config`, distro, linuxUser), nil
}
