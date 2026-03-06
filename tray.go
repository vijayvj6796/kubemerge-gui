package main

import (
	_ "embed"
	"fmt"
	"log"
	goruntime "runtime"
	"strings"
	"time"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/appicon.png
var iconDataPNG []byte

//go:embed build/windows/icon.ico
var iconDataICO []byte

var app *App

type contextMenuItem struct {
	item        *systray.MenuItem
	contextName string
	stopCh      chan struct{} // Channel to signal the goroutine to stop
}

var contextMenuItems []*contextMenuItem
var currentPage int = 0
var itemsPerPage int = 15
var totalPages int = 0
var allContextsCache []string
var filteredContextsCache []string
var currentAlphabetFilter string = "" // Empty means no filter
var showAllMode bool = false
var mPrevPage *systray.MenuItem
var mNextPage *systray.MenuItem
var mPageInfo *systray.MenuItem
var mFirstPage *systray.MenuItem
var mLastPage *systray.MenuItem
var mShowAll *systray.MenuItem
var mAlphabetFilter *systray.MenuItem

func setupSystray(appInstance *App) {
	app = appInstance
	go systray.Run(onReady, onExit)
}

func onReady() {
	// Use ICO format for Windows, PNG for others
	iconData := iconDataPNG
	if goruntime.GOOS == "windows" {
		iconData = iconDataICO
	}

	systray.SetIcon(iconData)
	systray.SetTitle("KubeMerge")
	systray.SetTooltip("KubeMerge GUI - Kubernetes Context Manager")

	mShow := systray.AddMenuItem("📱 Show Window", "Show the window")
	mHide := systray.AddMenuItem("🔽 Hide Window", "Hide the window")
	// App starts in widget mode, so initial menu shows option to go to Full GUI
	mWidgetMode := systray.AddMenuItem("📱 Full GUI Mode", "Switch to full application view")
	systray.AddSeparator()

	// Context search and switching
	mSearchContext := systray.AddMenuItem("🔍 Search & Switch Context...", "Open window to search and switch context")
	mFloatingWidget := systray.AddMenuItem("💠 Toggle Widget View", "Show/hide the floating widget in main window")
	mRefreshContexts := systray.AddMenuItem("↻ Refresh Contexts", "Reload context list")
	systray.AddSeparator()

	// Alphabet filter submenu
	mAlphabetFilter = systray.AddMenuItem("🔤 Filter by Name", "Filter contexts alphabetically")
	mFilterAll := mAlphabetFilter.AddSubMenuItem("All (No Filter)", "Show all contexts")
	mFilterAD := mAlphabetFilter.AddSubMenuItem("A-D", "Show contexts starting with A-D")
	mFilterEH := mAlphabetFilter.AddSubMenuItem("E-H", "Show contexts starting with E-H")
	mFilterIL := mAlphabetFilter.AddSubMenuItem("I-L", "Show contexts starting with I-L")
	mFilterMP := mAlphabetFilter.AddSubMenuItem("M-P", "Show contexts starting with M-P")
	mFilterQT := mAlphabetFilter.AddSubMenuItem("Q-T", "Show contexts starting with Q-T")
	mFilterUZ := mAlphabetFilter.AddSubMenuItem("U-Z", "Show contexts starting with U-Z")
	mFilter09 := mAlphabetFilter.AddSubMenuItem("0-9", "Show contexts starting with numbers")

	// Show All / Pagination toggle
	mShowAll = systray.AddMenuItem("📋 Show All Contexts", "Toggle between paginated and show-all mode")
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
				if app != nil && app.ctx != nil {
					app.ShowWindowFromTray()
				}
			case <-mHide.ClickedCh:
				if app.ctx != nil {
					// Don't allow hiding in floating mode
					if !app.floatingMode {
						runtime.WindowHide(app.ctx)
					} else {
						log.Println("Cannot hide window in floating mode - use 'Normal Mode' first")
					}
				}
			case <-mWidgetMode.ClickedCh:
				if app != nil && app.ctx != nil {
					// Toggle floating mode
					err := app.ToggleFloatingMode()
					if err != nil {
						log.Printf("Error toggling floating mode: %v", err)
					} else {
						// Update menu item text based on state
						if app.floatingMode {
							mWidgetMode.SetTitle("📱 Full GUI Mode")
							mWidgetMode.SetTooltip("Switch to full application view")
						} else {
							mWidgetMode.SetTitle("🎯 Widget Mode")
							mWidgetMode.SetTooltip("Switch to compact floating widget")
						}
					}
				}
			case <-mSearchContext.ClickedCh:
				if app != nil && app.ctx != nil {
					err := app.ShowContextSearchDialog()
					if err != nil {
						log.Printf("Error showing search dialog: %v", err)
					}
				}
			case <-mFloatingWidget.ClickedCh:
				if app != nil && app.ctx != nil {
					err := app.ToggleFloatingWidget()
					if err != nil {
						log.Printf("Error toggling floating widget: %v", err)
					}
				}
			case <-mRefreshContexts.ClickedCh:
				currentPage = 0 // Reset to first page on refresh
				go refreshContextMenu()
			case <-mShowAll.ClickedCh:
				showAllMode = !showAllMode
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterAll.ClickedCh:
				currentAlphabetFilter = ""
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterAD.ClickedCh:
				currentAlphabetFilter = "A-D"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterEH.ClickedCh:
				currentAlphabetFilter = "E-H"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterIL.ClickedCh:
				currentAlphabetFilter = "I-L"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterMP.ClickedCh:
				currentAlphabetFilter = "M-P"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterQT.ClickedCh:
				currentAlphabetFilter = "Q-T"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilterUZ.ClickedCh:
				currentAlphabetFilter = "U-Z"
				currentPage = 0
				go refreshContextMenu()
			case <-mFilter09.ClickedCh:
				currentAlphabetFilter = "0-9"
				currentPage = 0
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

	contexts, err := app.GetAllContextsForTray()
	if err != nil {
		log.Printf("Error getting contexts: %v", err)
		return
	}

	currentContext, _ := app.GetCurrentContextForTray()

	// Cache all contexts
	allContextsCache = contexts

	// Apply alphabet filter if set
	filteredContextsCache = applyAlphabetFilter(contexts, currentAlphabetFilter)
	contexts = filteredContextsCache

	// Calculate total pages (or show all)
	if showAllMode {
		totalPages = 1
		itemsPerPage = len(contexts) // Show all items
		if itemsPerPage == 0 {
			itemsPerPage = 1
		}
	} else {
		itemsPerPage = 15 // Reset to default pagination size
		totalPages = (len(contexts) + itemsPerPage - 1) / itemsPerPage
		if totalPages == 0 {
			totalPages = 1
		}
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
		if item.stopCh != nil {
			close(item.stopCh) // Signal the monitoring goroutine to stop
		}
		item.item.Hide()
	}
	contextMenuItems = make([]*contextMenuItem, 0)

	// Update tooltip with current context
	if currentContext != "" {
		systray.SetTooltip("KubeMerge - Current: " + currentContext)
	}

	// Update page info and show all button
	filterInfo := ""
	if currentAlphabetFilter != "" {
		filterInfo = fmt.Sprintf(" [Filter: %s]", currentAlphabetFilter)
	}

	if showAllMode {
		mPageInfo.SetTitle(fmt.Sprintf("📄 Showing All (%d of %d total)%s", len(contexts), len(allContextsCache), filterInfo))
		mShowAll.SetTitle("📋 Enable Pagination")
		mShowAll.SetTooltip("Switch back to paginated view")
	} else {
		mPageInfo.SetTitle(fmt.Sprintf("📄 Page %d/%d (%d of %d total)%s", currentPage+1, totalPages, len(contexts), len(allContextsCache), filterInfo))
		mShowAll.SetTitle("📋 Show All Contexts")
		mShowAll.SetTooltip("Disable pagination and show all contexts at once")
	}

	// Enable/disable navigation buttons
	if showAllMode {
		// Disable pagination controls in show-all mode
		mFirstPage.Disable()
		mPrevPage.Disable()
		mNextPage.Disable()
		mLastPage.Disable()
	} else {
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
		stopCh := make(chan struct{})
		contextMenuItems = append(contextMenuItems, &contextMenuItem{
			item:        menuItem,
			contextName: ctx,
			stopCh:      stopCh,
		})
		// Start monitoring this menu item
		go monitorSingleContextClick(menuItem, ctx, stopCh)
	}

	if showAllMode {
		log.Printf("Showing all %d contexts (filtered from %d total)", len(contexts), len(allContextsCache))
	} else {
		log.Printf("Showing page %d of %d (%d-%d of %d contexts)",
			currentPage+1, totalPages, startIdx+1, endIdx, len(contexts))
	}
}

// applyAlphabetFilter filters contexts based on the alphabet range
func applyAlphabetFilter(contexts []string, filter string) []string {
	if filter == "" {
		return contexts
	}

	filtered := []string{}
	for _, ctx := range contexts {
		if len(ctx) == 0 {
			continue
		}
		firstChar := strings.ToUpper(string(ctx[0]))

		switch filter {
		case "A-D":
			if firstChar >= "A" && firstChar <= "D" {
				filtered = append(filtered, ctx)
			}
		case "E-H":
			if firstChar >= "E" && firstChar <= "H" {
				filtered = append(filtered, ctx)
			}
		case "I-L":
			if firstChar >= "I" && firstChar <= "L" {
				filtered = append(filtered, ctx)
			}
		case "M-P":
			if firstChar >= "M" && firstChar <= "P" {
				filtered = append(filtered, ctx)
			}
		case "Q-T":
			if firstChar >= "Q" && firstChar <= "T" {
				filtered = append(filtered, ctx)
			}
		case "U-Z":
			if firstChar >= "U" && firstChar <= "Z" {
				filtered = append(filtered, ctx)
			}
		case "0-9":
			if firstChar >= "0" && firstChar <= "9" {
				filtered = append(filtered, ctx)
			}
		}
	}

	return filtered
}

// monitorSingleContextClick monitors clicks for a single context menu item
func monitorSingleContextClick(menuItem *systray.MenuItem, contextName string, stopCh chan struct{}) {
	for {
		select {
		case <-stopCh:
			// Stop monitoring when signaled
			log.Printf("Stopping monitor for context: %s", contextName)
			return
		case <-menuItem.ClickedCh:
			// Switch context
			log.Printf("Context menu item clicked: %s", contextName)
			err := app.SwitchContextForTray(contextName)
			if err != nil {
				log.Printf("Error switching context to %s: %v", contextName, err)
			} else {
				log.Printf("Successfully switched to context: %s", contextName)
				// Update tooltip to show current context
				systray.SetTooltip("KubeMerge - Current: " + contextName)
				// Refresh menu to show checkmark
				time.Sleep(200 * time.Millisecond) // Brief delay for visual feedback
				refreshContextMenu()
				return // Exit after switching since menu will be recreated
			}
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
