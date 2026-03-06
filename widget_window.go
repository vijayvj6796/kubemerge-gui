package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

// WidgetCollapse shrinks window to just the FAB icon (52×52).
func (a *App) WidgetCollapse() {
	runtime.WindowSetSize(a.ctx, 52, 52)
	runtime.WindowSetAlwaysOnTop(a.ctx, true)
}

// WidgetExpand grows window to show the search panel (320×430).
func (a *App) WidgetExpand() {
	runtime.WindowSetSize(a.ctx, 320, 430)
	runtime.WindowSetAlwaysOnTop(a.ctx, true)
}

// WidgetFullGUI restores the window to full app mode.
// - Turns OFF always-on-top so it behaves like a normal window
// - Resizes large enough to show all panels without needing to drag
// - Centers on screen
// - Called from App.tsx when switching OUT of floating mode
func (a *App) WidgetFullGUI() {
	runtime.WindowSetAlwaysOnTop(a.ctx, false)
	runtime.WindowSetSize(a.ctx, 1200, 860)
	runtime.WindowCenter(a.ctx)
	a.floatingMode = false
}

// ShowWindowFromTray is called by the tray "Show Window" button.
// It restores the correct window size depending on current mode,
// which fixes the issue where tray show left the window at 52×52.
func (a *App) ShowWindowFromTray() {
	runtime.WindowShow(a.ctx)
	if a.floatingMode {
		// Widget mode — restore to FAB icon size, always on top
		runtime.WindowSetSize(a.ctx, 52, 52)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
	} else {
		// Full GUI mode — restore proper size, not always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
		runtime.WindowSetSize(a.ctx, 1200, 860)
		runtime.WindowCenter(a.ctx)
	}
}

// NOTE: GetTargetKubeconfig and SetTargetKubeconfig already live in tray_context.go
