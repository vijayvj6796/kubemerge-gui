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
		Title: "KubeMerge Widget",

		// Start as tiny FAB — JS calls WidgetExpand/WidgetCollapse/WidgetFullGUI
		// to resize dynamically based on mode
		Width:     52,
		Height:    52,
		MinWidth:  52,
		MinHeight: 52,
		MaxWidth:  1200,
		MaxHeight: 900,

		// Frameless = no OS title bar (we draw our own in full GUI mode)
		Frameless:   true,
		AlwaysOnTop: true,

		// Transparent so only the FAB circle / panel / full GUI content shows
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},

		// Windows-specific transparency
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

		// Hide to tray instead of closing (unchanged)
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			runtime.WindowHide(ctx)
			return true
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
