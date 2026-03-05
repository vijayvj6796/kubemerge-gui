package main

import (
	"log"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// StartInFloatingMode initializes the app in floating widget mode
func (a *App) StartInFloatingMode() error {
	if a.ctx == nil {
		return nil
	}

	log.Println("Starting in floating widget mode")
	a.floatingMode = true

	// Small delay to ensure window is ready
	time.Sleep(100 * time.Millisecond)

	// Set to widget size
	runtime.WindowSetSize(a.ctx, 380, 500)
	runtime.WindowSetPosition(a.ctx, 100, 100)
	runtime.WindowSetAlwaysOnTop(a.ctx, true)
	runtime.WindowSetTitle(a.ctx, "KubeMerge Widget")
	runtime.WindowShow(a.ctx)

	// Let frontend know we're in floating mode
	runtime.EventsEmit(a.ctx, "set-floating-mode", true)

	// Start keeping widget visible
	go a.keepWidgetVisible()

	return nil
}

// ToggleFloatingMode toggles between full GUI and floating widget mode
func (a *App) ToggleFloatingMode() error {
	if a.ctx == nil {
		return nil
	}

	// Toggle the state
	a.floatingMode = !a.floatingMode
	log.Printf("Toggling mode - floating: %v", a.floatingMode)

	// Apply the mode
	return a.SetFloatingMode(a.floatingMode)
}

// SetFloatingMode sets the window to floating widget mode or full GUI mode
func (a *App) SetFloatingMode(enabled bool) error {
	if a.ctx == nil {
		return nil
	}

	a.floatingMode = enabled

	if enabled {
		log.Println("Switching to floating widget mode")
		// Show the window first
		runtime.WindowShow(a.ctx)

		// Small delay for smooth transition
		time.Sleep(50 * time.Millisecond)

		// Resize to widget size
		runtime.WindowSetSize(a.ctx, 380, 500)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		runtime.WindowSetTitle(a.ctx, "KubeMerge Widget")

		// Start a goroutine to keep widget visible
		go a.keepWidgetVisible()
	} else {
		log.Println("Switching to full GUI mode")
		// Show and resize to normal size
		runtime.WindowShow(a.ctx)

		// Small delay for smooth transition
		time.Sleep(50 * time.Millisecond)

		runtime.WindowSetSize(a.ctx, 900, 600)
		runtime.WindowCenter(a.ctx)
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
		runtime.WindowSetTitle(a.ctx, "KubeMerge GUI")
	}

	// Notify frontend of mode change
	runtime.EventsEmit(a.ctx, "set-floating-mode", enabled)
	return nil
}

// keepWidgetVisible ensures the widget stays visible when in floating mode
func (a *App) keepWidgetVisible() {
	// No longer forcing window to show repeatedly
	// This was causing the "keeps opening" issue
	// Widget will stay visible through normal window management
}
