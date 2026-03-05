package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	app := NewApp()

	// Setup system tray
	setupSystray(app)

	err := wails.Run(&options.App{
		Title:            "KubeMerge Widget",
		Width:            380,
		Height:           500,
		BackgroundColour: &options.RGBA{R: 11, G: 16, B: 32, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// Start in widget mode
			app.StartInFloatingMode()
		},
		Bind: []interface{}{
			app,
		},
		// Handle window close/hide
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			// Always hide to tray instead of closing
			runtime.WindowHide(ctx)
			return true // Prevent actual close - use tray to quit
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
