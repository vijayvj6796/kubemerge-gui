//go:build !windows

package main

import (
	"fmt"
	"path/filepath"

	"k8s.io/client-go/util/homedir"
)

func listWSLDistros() ([]string, error) {
	return nil, fmt.Errorf("WSL distros only available on Windows")
}

func windowsKubeconfigPath() (string, error) {
	return "", fmt.Errorf("windows kubeconfig path only available on Windows")
}

func wslKubeconfigUNC(distro, linuxUser string) (string, error) {
	return "", fmt.Errorf("WSL path only available on Windows")
}

func getDefaultWSLUser(distro string) (string, error) {
	return "", fmt.Errorf("WSL user detection only available on Windows")
}

// linuxKubeconfigPath returns the standard Linux kubeconfig path
func linuxKubeconfigPath() (string, error) {
	home := homedir.HomeDir()
	if home == "" {
		return "", fmt.Errorf("cannot detect home directory")
	}
	return filepath.Join(home, ".kube", "config"), nil
}
