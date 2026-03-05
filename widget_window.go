package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

// WidgetCollapse shrinks window to just the FAB icon (52×52).
func (a *App) WidgetCollapse() {
	runtime.WindowSetSize(a.ctx, 52, 52)
}

// WidgetExpand grows window to show the search panel (320×430).
func (a *App) WidgetExpand() {
	runtime.WindowSetSize(a.ctx, 320, 430)
}

// WidgetFullGUI restores the window to full app size (380×500).
// Called from App.tsx when switching OUT of floating mode.
func (a *App) WidgetFullGUI() {
	runtime.WindowSetSize(a.ctx, 380, 500)
}
