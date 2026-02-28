package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ContextInfo holds information about a kubernetes context
type ContextInfo struct {
	Name      string `json:"name"`
	IsCurrent bool   `json:"isCurrent"`
	Cluster   string `json:"cluster"`
	Namespace string `json:"namespace"`
}

// SearchContexts searches for contexts matching the query
func (a *App) SearchContexts(query string) ([]ContextInfo, error) {
	contexts, err := a.GetAllContexts()
	if err != nil {
		return nil, err
	}

	currentContext, _ := a.GetCurrentContext()

	var results []ContextInfo
	lowerQuery := strings.ToLower(query)

	for _, ctx := range contexts {
		// If query is empty or context matches query
		if query == "" || strings.Contains(strings.ToLower(ctx), lowerQuery) {
			results = append(results, ContextInfo{
				Name:      ctx,
				IsCurrent: ctx == currentContext,
			})
		}
	}

	// Sort: current context first, then alphabetically
	sort.Slice(results, func(i, j int) bool {
		if results[i].IsCurrent {
			return true
		}
		if results[j].IsCurrent {
			return false
		}
		return results[i].Name < results[j].Name
	})

	return results, nil
}

// QuickSwitchContext is a convenience method for tray operations
func (a *App) QuickSwitchContext(contextName string) error {
	err := a.SwitchContext(contextName)
	if err != nil {
		return err
	}

	// Show a brief notification
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "context-switched", contextName)
	}

	return nil
}

// GetContextsWithCurrent returns all contexts with current context marked
func (a *App) GetContextsWithCurrent() ([]ContextInfo, error) {
	contexts, err := a.GetAllContexts()
	if err != nil {
		return nil, err
	}

	currentContext, _ := a.GetCurrentContext()

	var results []ContextInfo
	for _, ctx := range contexts {
		results = append(results, ContextInfo{
			Name:      ctx,
			IsCurrent: ctx == currentContext,
		})
	}

	return results, nil
}

// ShowContextSearchDialog opens a dialog for searching and switching contexts
func (a *App) ShowContextSearchDialog() error {
	if a.ctx == nil {
		return fmt.Errorf("app context not initialized")
	}

	// Show the main window to display the search
	runtime.WindowShow(a.ctx)

	// Emit event to trigger search UI in frontend
	runtime.EventsEmit(a.ctx, "show-context-search")

	return nil
}
