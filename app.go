package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/util/homedir"
)

// Delete a context from the default kubeconfig (~/.kube/config)
func (a *App) DeleteContext(name string) error {
	home := homedir.HomeDir()
	path := filepath.Join(home, ".kube", "config")
	return deleteContextFromFile(path, name)
}

// Delete a context from a specific kubeconfig file
func (a *App) DeleteContextForPath(kubeconfigPath, name string) error {
	return deleteContextFromFile(kubeconfigPath, name)
}

// Helper: Remove context, and optionally its user/cluster if unused
func deleteContextFromFile(path, name string) error {
	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return err
	}
	ctx, exists := cfg.Contexts[name]
	if !exists {
		return fmt.Errorf("context '%s' does not exist", name)
	}
	// Remove context
	delete(cfg.Contexts, name)
	// Remove user if not used by any other context
	user := ctx.AuthInfo
	stillUsed := false
	for _, c := range cfg.Contexts {
		if c.AuthInfo == user {
			stillUsed = true
			break
		}
	}
	if !stillUsed {
		delete(cfg.AuthInfos, user)
	}
	// Remove cluster if not used by any other context
	cluster := ctx.Cluster
	stillUsed = false
	for _, c := range cfg.Contexts {
		if c.Cluster == cluster {
			stillUsed = true
			break
		}
	}
	if !stillUsed {
		delete(cfg.Clusters, cluster)
	}
	// If current context was deleted, unset it
	if cfg.CurrentContext == name {
		cfg.CurrentContext = ""
	}
	return clientcmd.WriteToFile(*cfg, path)
}

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

// Merge newKubeconfigPath into targetKubeconfigPath
func (a *App) MergeIntoTarget(targetKubeconfigPath, newKubeconfigPath string) (*MergeResult, error) {
	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(targetKubeconfigPath), 0755); err != nil {
		return nil, err
	}

	// Backup existing config if exists
	var backupPath string
	if _, err := os.Stat(targetKubeconfigPath); err == nil {
		ts := time.Now().Format("20060102_150405")
		backupPath = targetKubeconfigPath + ".bak-" + ts

		data, err := os.ReadFile(targetKubeconfigPath)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(backupPath, data, 0600); err != nil {
			return nil, err
		}
	}

	// Load existing config (if exists)
	var oldConfig *clientcmdapi.Config
	if _, err := os.Stat(targetKubeconfigPath); err == nil {
		oldConfig, err = clientcmd.LoadFromFile(targetKubeconfigPath)
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
	if err := clientcmd.WriteToFile(*oldConfig, targetKubeconfigPath); err != nil {
		return nil, err
	}

	allContexts := []string{}
	for ctx := range oldConfig.Contexts {
		allContexts = append(allContexts, ctx)
	}

	return &MergeResult{
		TargetConfigPath: targetKubeconfigPath,
		BackupPath:       backupPath,
		AddedClusters:    addedClusters,
		AddedContexts:    addedContexts,
		AddedUsers:       addedUsers,
		AllContexts:      allContexts,
		Message:          "Merge completed successfully.",
	}, nil
}

// For backward compatibility, keep this method but call the new one with the default path
func (a *App) MergeIntoDefault(newKubeconfigPath string) (*MergeResult, error) {
	home := homedir.HomeDir()
	if home == "" {
		return nil, fmt.Errorf("cannot detect home directory")
	}
	target := filepath.Join(home, ".kube", "config")
	return a.MergeIntoTarget(target, newKubeconfigPath)
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

// ---- Target selection (Windows/WSL/Linux) ----

type TargetSelection struct {
	Kind      string `json:"kind"`      // "windows", "wsl", or "linux"
	Distro    string `json:"distro"`    // e.g. "Ubuntu-24.04" (for WSL)
	LinuxUser string `json:"linuxUser"` // e.g. "vj" (for WSL)
}

func (a *App) GetOS() string {
	return goruntime.GOOS
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
	case "linux":
		return linuxKubeconfigPath()
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

func (a *App) GetDefaultWSLUser(distro string) (string, error) {
	return getDefaultWSLUser(distro)
}

func (a *App) TestFileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

// ---- Namespace Management (kubens-style) ----

// GetCurrentNamespaceForPath returns the namespace configured for a specific context
func (a *App) GetCurrentNamespaceForPath(kubeconfigPath, contextName string) (string, error) {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return "", fmt.Errorf("failed to load kubeconfig: %v", err)
	}

	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		return "", fmt.Errorf("context not found: %s", contextName)
	}

	// If no namespace is set, return "default"
	if ctx.Namespace == "" {
		return "default", nil
	}
	return ctx.Namespace, nil
}

// SetNamespaceForPath sets the namespace for a specific context
func (a *App) SetNamespaceForPath(kubeconfigPath, contextName, namespace string) error {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig: %v", err)
	}

	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		return fmt.Errorf("context not found: %s", contextName)
	}

	ctx.Namespace = namespace
	cfg.Contexts[contextName] = ctx

	return clientcmd.WriteToFile(*cfg, kubeconfigPath)
}

// ListNamespacesForPath lists all namespaces in the cluster for a given context
func (a *App) ListNamespacesForPath(kubeconfigPath, contextName string) ([]string, error) {
	// Build config for the specific context
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath}
	configOverrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextName,
	}

	config, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules,
		configOverrides,
	).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to build client config: %v", err)
	}

	// Create Kubernetes client
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %v", err)
	}

	// List namespaces (with timeout)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	namespaceList, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %v", err)
	}

	namespaces := []string{}
	for _, ns := range namespaceList.Items {
		namespaces = append(namespaces, ns.Name)
	}

	sort.Strings(namespaces)
	return namespaces, nil
}

// ClusterInfo holds information about a cluster
type ClusterInfo struct {
	Reachable     bool   `json:"reachable"`
	Version       string `json:"version"`
	Authenticated bool   `json:"authenticated"`
	ClusterName   string `json:"clusterName"`
	ServerURL     string `json:"serverUrl"`
	ErrorMessage  string `json:"errorMessage"`
}

// TestClusterConnectivity tests if a cluster is reachable and gets its version
func (a *App) TestClusterConnectivity(kubeconfigPath, contextName string) (ClusterInfo, error) {
	info := ClusterInfo{
		Reachable:     false,
		Version:       "",
		Authenticated: false,
		ClusterName:   contextName,
		ServerURL:     "",
		ErrorMessage:  "",
	}

	// Load kubeconfig
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		info.ErrorMessage = fmt.Sprintf("Failed to load kubeconfig: %v", err)
		return info, err
	}

	// Get context
	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		info.ErrorMessage = fmt.Sprintf("Context '%s' not found", contextName)
		return info, fmt.Errorf("context not found: %s", contextName)
	}

	// Get cluster info
	cluster, exists := cfg.Clusters[ctx.Cluster]
	if !exists {
		info.ErrorMessage = fmt.Sprintf("Cluster '%s' not found", ctx.Cluster)
		return info, fmt.Errorf("cluster not found: %s", ctx.Cluster)
	}
	info.ServerURL = cluster.Server

	// Create a clientset
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, contextName, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		info.ErrorMessage = fmt.Sprintf("Failed to create client config: %v", err)
		return info, err
	}

	// Set timeout for connectivity test
	restConfig.Timeout = 5 * time.Second

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		info.ErrorMessage = fmt.Sprintf("Failed to create clientset: %v", err)
		return info, err
	}

	// Test connectivity and authentication by getting server version
	versionInfo, err := clientset.Discovery().ServerVersion()
	if err != nil {
		info.ErrorMessage = fmt.Sprintf("Failed to reach cluster: %v", err)
		info.Reachable = false
		return info, err
	}

	// Success!
	info.Reachable = true
	info.Authenticated = true
	info.Version = versionInfo.String()

	return info, nil
}

// GetClusterInfoForCurrentContext gets cluster info for the currently active context
func (a *App) GetClusterInfoForCurrentContext(kubeconfigPath string) (ClusterInfo, error) {
	// Get current context
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return ClusterInfo{
			ErrorMessage: fmt.Sprintf("Failed to load kubeconfig: %v", err),
		}, err
	}

	if cfg.CurrentContext == "" {
		return ClusterInfo{
			ErrorMessage: "No current context set",
		}, fmt.Errorf("no current context")
	}

	return a.TestClusterConnectivity(kubeconfigPath, cfg.CurrentContext)
}

// ---- Namespace Management (kubens-style) ----

// GetCurrentNamespace gets the default namespace for a specific context
func (a *App) GetCurrentNamespace(kubeconfigPath, contextName string) (string, error) {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return "", fmt.Errorf("failed to load kubeconfig: %v", err)
	}

	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		return "", fmt.Errorf("context '%s' not found", contextName)
	}

	// Return namespace or "default" if not set
	if ctx.Namespace == "" {
		return "default", nil
	}
	return ctx.Namespace, nil
}

// ListNamespaces lists all namespaces in the cluster for the given context
func (a *App) ListNamespaces(kubeconfigPath, contextName string) ([]string, error) {
	// Load kubeconfig
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig: %v", err)
	}

	// Verify context exists
	_, exists := cfg.Contexts[contextName]
	if !exists {
		return nil, fmt.Errorf("context '%s' not found", contextName)
	}

	// Create a clientset
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, contextName, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create client config: %v", err)
	}

	// Set timeout
	restConfig.Timeout = 10 * time.Second

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %v", err)
	}

	// List namespaces
	namespaceList, err := clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %v", err)
	}

	// Extract namespace names
	namespaces := make([]string, 0, len(namespaceList.Items))
	for _, ns := range namespaceList.Items {
		namespaces = append(namespaces, ns.Name)
	}

	sort.Strings(namespaces)
	return namespaces, nil
}

// SwitchNamespace switches the default namespace for a context
func (a *App) SwitchNamespace(kubeconfigPath, contextName, namespace string) error {
	cfg, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig: %v", err)
	}

	ctx, exists := cfg.Contexts[contextName]
	if !exists {
		return fmt.Errorf("context '%s' not found", contextName)
	}

	// Update the namespace
	ctx.Namespace = namespace
	cfg.Contexts[contextName] = ctx

	// Save the kubeconfig
	return clientcmd.WriteToFile(*cfg, kubeconfigPath)
}
