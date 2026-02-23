//go:build !windows

package main

import "fmt"

func listWSLDistros() ([]string, error) {
	return nil, fmt.Errorf("WSL distros only available on Windows")
}

func windowsKubeconfigPath() (string, error) {
	return "", fmt.Errorf("windows kubeconfig path only available on Windows")
}

func wslKubeconfigUNC(distro, linuxUser string) (string, error) {
	return "", fmt.Errorf("WSL path only available on Windows")
}
