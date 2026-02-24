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
		// Remove CR/LF + non-printable junk
		l = strings.ReplaceAll(l, "\r", "")
		l = strings.ReplaceAll(l, "\u0000", "")
		l = strings.TrimSpace(l)

		// Keep only visible ASCII to avoid "garbled squares"
		cleaned := make([]rune, 0, len(l))
		for _, r := range l {
			if r >= 32 && r <= 126 { // printable ASCII
				cleaned = append(cleaned, r)
			}
		}
		l = strings.TrimSpace(string(cleaned))

		if l != "" {
			distros = append(distros, l)
		}
	}
	return distros, nil
}

func getDefaultWSLUser(distro string) (string, error) {
	distro = strings.TrimSpace(distro)
	if distro == "" {
		return "", fmt.Errorf("distro is required")
	}

	// Ask WSL who the current user is
	cmd := exec.Command("wsl.exe", "-d", distro, "-e", "sh", "-lc", "whoami")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to get default WSL user: %v (%s)", err, out.String())
	}

	u := out.String()
	u = strings.ReplaceAll(u, "\r", "")
	u = strings.ReplaceAll(u, "\n", "")
	u = strings.TrimSpace(u)
	if u == "" {
		return "", fmt.Errorf("could not detect WSL user")
	}
	return u, nil
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

// linuxKubeconfigPath is not applicable on Windows (use WSL instead)
func linuxKubeconfigPath() (string, error) {
	return "", fmt.Errorf("native Linux path not available on Windows; use WSL target instead")
}
