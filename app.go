package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/util/homedir"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) SelectKubeconfig() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select kubeconfig file",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "YAML Files",
				Pattern:     "*.yaml;*.yml;*config*",
			},
		},
	})

	if err != nil {
		return "", err
	}

	return path, nil
}

type MergeResult struct {
	TargetConfigPath string   `json:"targetConfigPath"`
	BackupPath       string   `json:"backupPath"`
	AddedClusters    []string `json:"addedClusters"`
	AddedContexts    []string `json:"addedContexts"`
	AddedUsers       []string `json:"addedUsers"`
	AllContexts      []string `json:"allContexts"`
	Message          string   `json:"message"`
}

func (a *App) MergeIntoDefault(newKubeconfigPath string) (*MergeResult, error) {

	home := homedir.HomeDir()
	if home == "" {
		return nil, fmt.Errorf("cannot detect home directory")
	}

	target := filepath.Join(home, ".kube", "config")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return nil, err
	}

	// Backup existing config if exists
	var backupPath string
	if _, err := os.Stat(target); err == nil {
		ts := time.Now().Format("20060102_150405")
		backupPath = target + ".bak-" + ts

		data, err := os.ReadFile(target)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(backupPath, data, 0600); err != nil {
			return nil, err
		}
	}

	// Load existing config (if exists)
	var oldConfig *clientcmdapi.Config
	if _, err := os.Stat(target); err == nil {
		oldConfig, err = clientcmd.LoadFromFile(target)
		if err != nil {
			return nil, err
		}
	} else {
		oldConfig = clientcmdapi.NewConfig()
	}

	// Load new config
	newConfig, err := clientcmd.LoadFromFile(newKubeconfigPath)
	if err != nil {
		return nil, err
	}

	addedClusters := []string{}
	addedContexts := []string{}
	addedUsers := []string{}

	// Merge clusters
	for name, cluster := range newConfig.Clusters {
		if _, exists := oldConfig.Clusters[name]; !exists {
			oldConfig.Clusters[name] = cluster
			addedClusters = append(addedClusters, name)
		}
	}

	// Merge users
	for name, user := range newConfig.AuthInfos {
		if _, exists := oldConfig.AuthInfos[name]; !exists {
			oldConfig.AuthInfos[name] = user
			addedUsers = append(addedUsers, name)
		}
	}

	// Merge contexts
	for name, ctx := range newConfig.Contexts {
		if _, exists := oldConfig.Contexts[name]; !exists {
			oldConfig.Contexts[name] = ctx
			addedContexts = append(addedContexts, name)
		}
	}

	// Write merged config
	if err := clientcmd.WriteToFile(*oldConfig, target); err != nil {
		return nil, err
	}

	allContexts := []string{}
	for ctx := range oldConfig.Contexts {
		allContexts = append(allContexts, ctx)
	}

	return &MergeResult{
		TargetConfigPath: target,
		BackupPath:       backupPath,
		AddedClusters:    addedClusters,
		AddedContexts:    addedContexts,
		AddedUsers:       addedUsers,
		AllContexts:      allContexts,
		Message:          "Merge completed successfully.",
	}, nil
}

func (a *App) GetCurrentContext() (string, error) {
	home := homedir.HomeDir()
	path := filepath.Join(home, ".kube", "config")

	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return "", err
	}

	return cfg.CurrentContext, nil
}

func (a *App) SwitchContext(name string) error {
	home := homedir.HomeDir()
	path := filepath.Join(home, ".kube", "config")

	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return err
	}

	if _, exists := cfg.Contexts[name]; !exists {
		return fmt.Errorf("context does not exist")
	}

	cfg.CurrentContext = name

	return clientcmd.WriteToFile(*cfg, path)
}

func (a *App) GetAllContexts() ([]string, error) {
	home := homedir.HomeDir()
	if home == "" {
		return nil, fmt.Errorf("cannot detect home directory")
	}
	path := filepath.Join(home, ".kube", "config")

	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return nil, err
	}

	contexts := []string{}
	for name := range cfg.Contexts {
		contexts = append(contexts, name)
	}
	sort.Strings(contexts)
	return contexts, nil
}

// ---- Target selection (Windows/WSL) ----

type TargetSelection struct {
	Kind      string `json:"kind"`      // "windows" or "wsl"
	Distro    string `json:"distro"`    // e.g. "Ubuntu-24.04"
	LinuxUser string `json:"linuxUser"` // e.g. "vj"
}

func (a *App) ListWSLDistros() ([]string, error) {
	return listWSLDistros()
}

func (a *App) ResolveTargetKubeconfig(sel TargetSelection) (string, error) {
	switch sel.Kind {
	case "windows":
		return windowsKubeconfigPath()
	case "wsl":
		return wslKubeconfigUNC(sel.Distro, sel.LinuxUser)
	default:
		return "", fmt.Errorf("unknown target kind: %s", sel.Kind)
	}
}

// ---- Path-based context APIs ----

func (a *App) GetAllContextsForPath(kubeconfigPath string) ([]string, error) {
	// 1) Validate path exists first
	if _, err := os.Stat(kubeconfigPath); err != nil {
		return nil, fmt.Errorf("kubeconfig not found at %s: %v", kubeconfigPath, err)
	}

	// 2) Now load kubeconfig
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig %s: %v", kubeconfigPath, err)
	}

	// 3) Collect contexts
	contexts := []string{}
	for name := range cfg.Contexts {
		contexts = append(contexts, name)
	}

	// Optional: sort here if you want:
	// sort.Strings(contexts)

	return contexts, nil
}

func (a *App) GetCurrentContextForPath(kubeconfigPath string) (string, error) {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return "", err
	}
	return cfg.CurrentContext, nil
}

func (a *App) SwitchContextForPath(kubeconfigPath, name string) error {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return err
	}

	if _, exists := cfg.Contexts[name]; !exists {
		return fmt.Errorf("context does not exist: %s", name)
	}

	cfg.CurrentContext = name
	return clientcmd.WriteToFile(*cfg, kubeconfigPath)
}
