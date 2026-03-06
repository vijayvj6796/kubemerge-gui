package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	app := NewApp()

	// Setup system tray (unchanged)
	setupSystray(app)

	err := wails.Run(&options.App{
		Title: "KubeMerge",

		// Start as tiny FAB (widget mode).
		// WidgetFullGUI() / WidgetExpand() / WidgetCollapse() resize dynamically.
		Width:  52,
		Height: 52,

		// No MinWidth/MinHeight — letting them be 0 means the window can be
		// freely resized in both widget (52px) and full GUI (1100px) modes.
		MinWidth:  0,
		MinHeight: 0,
		MaxWidth:  0, // 0 = no limit
		MaxHeight: 0, // 0 = no limit

		// Frameless removes the OS title bar.
		// TitleBar.tsx in the React app provides a custom drag bar for full GUI.
		Frameless: true,

		// Start always-on-top for widget mode.
		// WidgetFullGUI() turns this off when switching to full GUI.
		AlwaysOnTop: true,

		// Transparent background — the React app draws its own backgrounds.
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},

		// Windows-specific: enables transparent/acrylic webview
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			DisablePinchZoom:     true,
		},

		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			app.StartInFloatingMode()
		},

		Bind: []interface{}{
			app,
		},

		// Hide to tray instead of closing.
		// The tray "Show Window" button calls ShowWindowFromTray()
		// which restores the correct size for the current mode.
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			runtime.WindowHide(ctx)
			return true
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
