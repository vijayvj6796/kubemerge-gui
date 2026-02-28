package main

import (
	"path/filepath"

	"k8s.io/client-go/util/homedir"
)

// SetTargetKubeconfig sets the target kubeconfig path for tray operations
func (a *App) SetTargetKubeconfig(path string) {
	a.targetKubeconfig = path
}

// GetTargetKubeconfig gets the current target kubeconfig path
// Falls back to default if not set
func (a *App) GetTargetKubeconfig() string {
	if a.targetKubeconfig != "" {
		return a.targetKubeconfig
	}
	// Default to ~/.kube/config
	home := homedir.HomeDir()
	return filepath.Join(home, ".kube", "config")
}

// GetAllContextsForTray gets all contexts from the current target kubeconfig
func (a *App) GetAllContextsForTray() ([]string, error) {
	path := a.GetTargetKubeconfig()
	return a.GetAllContextsForPath(path)
}

// GetCurrentContextForTray gets current context from the current target kubeconfig
func (a *App) GetCurrentContextForTray() (string, error) {
	path := a.GetTargetKubeconfig()
	return a.GetCurrentContextForPath(path)
}

// SwitchContextForTray switches context in the current target kubeconfig
func (a *App) SwitchContextForTray(name string) error {
	path := a.GetTargetKubeconfig()
	return a.SwitchContextForPath(path, name)
}
