package main

import (
	_ "embed"
	"fmt"
	"log"
	"strings"
	"time"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/appicon.png
var iconData []byte

var app *App

type contextMenuItem struct {
	item        *systray.MenuItem
	contextName string
}

var contextMenuItems []*contextMenuItem
var currentPage int = 0
var itemsPerPage int = 15
var totalPages int = 0
var allContextsCache []string
var mPrevPage *systray.MenuItem
var mNextPage *systray.MenuItem
var mPageInfo *systray.MenuItem
var mFirstPage *systray.MenuItem
var mLastPage *systray.MenuItem

func setupSystray(appInstance *App) {
	app = appInstance
	go systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(iconData)
	systray.SetTitle("KubeMerge")
	systray.SetTooltip("KubeMerge GUI - Kubernetes Context Manager")

	mShow := systray.AddMenuItem("📱 Show Window", "Show the main window")
	mHide := systray.AddMenuItem("🔽 Hide Window", "Hide the main window")
	systray.AddSeparator()

	// Context search and switching
	mSearchContext := systray.AddMenuItem("🔍 Search & Switch Context...", "Open window to search and switch context")
	mRefreshContexts := systray.AddMenuItem("↻ Refresh Contexts", "Reload context list")
	systray.AddSeparator()

	mContextsTitle := systray.AddMenuItem("--- Contexts ---", "")
	mContextsTitle.Disable()

	// Pagination controls
	mFirstPage = systray.AddMenuItem("⏮️ First Page", "Jump to first page")
	mPrevPage = systray.AddMenuItem("⬅️ Previous", "Show previous page")
	mPageInfo = systray.AddMenuItem("Page 1 of 1", "Current page")
	mNextPage = systray.AddMenuItem("➡️ Next", "Show next page")
	mLastPage = systray.AddMenuItem("⏭️ Last Page", "Jump to last page")
	mPageInfo.Disable()
	systray.AddSeparator()

	// Dynamic context menu items will be added here
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("❌ Quit", "Quit the application")

	// Initial context load
	go refreshContextMenu()

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mShow.ClickedCh:
				if app.ctx != nil {
					runtime.WindowShow(app.ctx)
				}
			case <-mHide.ClickedCh:
				if app.ctx != nil {
					runtime.WindowHide(app.ctx)
				}
			case <-mSearchContext.ClickedCh:
				if app != nil && app.ctx != nil {
					err := app.ShowContextSearchDialog()
					if err != nil {
						log.Printf("Error showing search dialog: %v", err)
					}
				}
			case <-mRefreshContexts.ClickedCh:
				currentPage = 0 // Reset to first page on refresh
				go refreshContextMenu()
			case <-mFirstPage.ClickedCh:
				currentPage = 0
				go refreshContextMenu()
			case <-mPrevPage.ClickedCh:
				if currentPage > 0 {
					currentPage--
					go refreshContextMenu()
				}
			case <-mNextPage.ClickedCh:
				if currentPage < totalPages-1 {
					currentPage++
					go refreshContextMenu()
				}
			case <-mLastPage.ClickedCh:
				if totalPages > 0 {
					currentPage = totalPages - 1
					go refreshContextMenu()
				}
			case <-mQuit.ClickedCh:
				if app.ctx != nil {
					runtime.Quit(app.ctx)
				}
				systray.Quit()
				return
			}
		}
	}()

	// Auto-refresh contexts every 30 seconds
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			refreshContextMenu()
		}
	}()
}

func refreshContextMenu() {
	if app == nil {
		return
	}

	contexts, err := app.GetAllContexts()
	if err != nil {
		log.Printf("Error getting contexts: %v", err)
		return
	}

	currentContext, _ := app.GetCurrentContext()

	// Cache all contexts
	allContextsCache = contexts

	// Calculate total pages
	totalPages = (len(contexts) + itemsPerPage - 1) / itemsPerPage
	if totalPages == 0 {
		totalPages = 1
	}

	// Auto-jump to page containing current context on first load or refresh
	if currentContext != "" {
		for i, ctx := range contexts {
			if ctx == currentContext {
				currentPage = i / itemsPerPage
				break
			}
		}
	}

	// Ensure current page is valid
	if currentPage >= totalPages {
		currentPage = totalPages - 1
	}
	if currentPage < 0 {
		currentPage = 0
	}

	// Clear old menu items
	for _, item := range contextMenuItems {
		item.item.Hide()
	}
	contextMenuItems = make([]*contextMenuItem, 0)

	// Update tooltip with current context
	if currentContext != "" {
		systray.SetTooltip("KubeMerge - Current: " + currentContext)
	}

	// Update page info
	mPageInfo.SetTitle(fmt.Sprintf("📄 Page %d of %d (%d contexts)", currentPage+1, totalPages, len(contexts)))

	// Enable/disable navigation buttons
	if currentPage > 0 {
		mFirstPage.Enable()
		mPrevPage.Enable()
	} else {
		mFirstPage.Disable()
		mPrevPage.Disable()
	}

	if currentPage < totalPages-1 {
		mNextPage.Enable()
		mLastPage.Enable()
	} else {
		mNextPage.Disable()
		mLastPage.Disable()
	}

	// Calculate start and end indices for current page
	startIdx := currentPage * itemsPerPage
	endIdx := startIdx + itemsPerPage
	if endIdx > len(contexts) {
		endIdx = len(contexts)
	}

	// Get contexts for current page
	pageContexts := contexts[startIdx:endIdx]

	// Add context menu items for current page
	for _, ctx := range pageContexts {
		title := "   " + ctx
		if ctx == currentContext {
			title = "✓ " + ctx
		}

		menuItem := systray.AddMenuItem(title, "Switch to context: "+ctx)
		contextMenuItems = append(contextMenuItems, &contextMenuItem{
			item:        menuItem,
			contextName: ctx,
		})
		// Start monitoring this menu item
		go monitorSingleContextClick(menuItem, ctx)
	}

	log.Printf("Showing page %d of %d (%d-%d of %d contexts)",
		currentPage+1, totalPages, startIdx+1, endIdx, len(contexts))
}

// monitorSingleContextClick monitors clicks for a single context menu item
func monitorSingleContextClick(menuItem *systray.MenuItem, contextName string) {
	for {
		<-menuItem.ClickedCh
		// Switch context
		log.Printf("Context menu item clicked: %s", contextName)
		err := app.SwitchContext(contextName)
		if err != nil {
			log.Printf("Error switching context to %s: %v", contextName, err)
		} else {
			log.Printf("Successfully switched to context: %s", contextName)
			// Update tooltip to show current context
			systray.SetTooltip("KubeMerge - Current: " + contextName)
			// Refresh menu to show checkmark
			time.Sleep(200 * time.Millisecond) // Brief delay for visual feedback
			refreshContextMenu()
		}
	}
}

func filterContexts(contexts []string, filter string) []string {
	if filter == "" {
		return contexts
	}

	filtered := []string{}
	lowerFilter := strings.ToLower(filter)

	for _, ctx := range contexts {
		if strings.Contains(strings.ToLower(ctx), lowerFilter) {
			filtered = append(filtered, ctx)
		}
	}

	return filtered
}

func onExit() {
	log.Println("System tray exited")
}
