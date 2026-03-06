# ⚡ KubeMerge GUI

A lightweight desktop utility for DevOps engineers to manage Kubernetes kubeconfig files — merge configs, switch contexts, switch namespaces, and test cluster connectivity. Works on **Windows**, **Linux**, and **Windows + WSL**.

Built with **Go + Wails v2 + React + TypeScript**.

---

## ⚡ Quick Start (Download & Run)

1. Go to the [Releases](https://github.com/vijayvj6796/kubemerge-gui/releases) page
2. Download the binary for your OS:
   - **Windows:** `kubemerge-gui.exe` — just double-click, no installation needed
   - **Linux:** `kubemerge-gui` — run from terminal

**Linux users** — install system dependencies first:
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev build-essential
```

**Windows users** — WebView2 is required (pre-installed on Windows 11 and most updated Windows 10 machines). If missing, download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## ✨ Features

- 🔀 **Merge kubeconfigs** — safely merge a new kubeconfig into your target, with automatic timestamped backup before every merge
- 🔄 **Switch contexts** — `kubectx`-style switching with live search
- 📦 **Switch namespaces** — `kubens`-style namespace switching per context
- 💠 **Floating widget** — a tiny draggable K8s icon that lives on top of all windows; click to open a quick context/namespace switcher without touching the full app
- 🔌 **Cluster connectivity test** — check if a cluster is reachable, view server version and authentication status
- 📋 **Context details** — view cluster URL, user, namespace, and certificate expiry per context
- ⚠️ **Certificate expiry warnings** — alerts when certs expire in 30 / 7 days or are already expired
- 🗑️ **Delete contexts** — removes a context and cascades cleanup of orphaned users/clusters
- 🔲 **System tray** — runs silently in the tray; browse and switch contexts directly from the tray menu with A–Z filtering and pagination
- ⌨️ **Keyboard shortcuts** — `Ctrl+K`, `Ctrl+N`, `Ctrl+M`, `Ctrl+F`, `Esc`
- 🪟 **WSL support** — on Windows, targets kubeconfigs inside WSL distros (e.g. Ubuntu)

---

## 🖥️ Supported Platforms

| Platform | Status |
|---|---|
| Windows 10 / 11 | ✅ Supported |
| Linux (Ubuntu, Debian, etc.) | ✅ Supported |
| Windows + WSL | ✅ Supported |
| macOS | ⚠️ Not tested (may work, no binary provided yet) |

---

## 💠 Floating Widget

The app starts as a small floating K8s icon — no title bar, no background, just the icon sitting above all your other windows.

| Action | Result |
|---|---|
| **Click** the icon | Opens the quick context + namespace switcher |
| **Drag** the icon | Moves the widget anywhere on screen |
| **Drag** the panel header | Also moves the widget |
| **Esc** or click **✕** | Collapses back to the icon |
| Tray → **Full GUI Mode** | Opens the full application window |
| Tray → **Widget Mode** | Returns to the floating icon |

---

## 🪟 Windows + WSL Setup

If your clusters are configured inside WSL (i.e. you use `kubectl` from Ubuntu on WSL):

1. Open KubeMerge GUI and switch to **Full GUI Mode** from the tray
2. In the **Target & Context** panel, select **WSL**
3. Pick your distro (e.g. `Ubuntu-24.04`)
4. Enter your WSL Linux username
5. Click **Load Target**

KubeMerge will read and write your kubeconfig at:
```
\\wsl$\<distro>\home\<username>\.kube\config
```

The floating widget also uses this WSL path — context switches from the widget will correctly update your WSL cluster.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Quick context switcher |
| `Ctrl+N` | Quick namespace switcher |
| `Ctrl+M` | Merge selected kubeconfig |
| `Ctrl+F` | Focus search in open dropdown |
| `Esc` | Close open dropdown |

---

## 🔒 Safety & Privacy

- **Automatic backup** before every merge: `~/.kube/config.bak-YYYYMMDD_HHMMSS`
- No data is sent anywhere — the app talks only to your local kubeconfig file and (when you ask it to) your own clusters
- No cloud account, no login, no telemetry

---

## 👩‍💻 Build from Source

### 1. Install system dependencies

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev build-essential
```

**Windows:** Install [Go](https://go.dev/dl/) and [Node.js](https://nodejs.org/) — no extra system libs needed.

### 2. Install Go and Wails CLI
```bash
# Go 1.21+ required — https://go.dev/dl/

go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 3. Clone and run
```bash
git clone https://github.com/vijayvj6796/kubemerge-gui.git
cd kubemerge-gui

# Install frontend dependencies
cd frontend && npm install && cd ..

# Dev mode (hot reload)
wails dev

# Production build
wails build
# → build/bin/kubemerge-gui.exe  (Windows)
# → build/bin/kubemerge-gui      (Linux)
```

---

## 📁 Project Structure

```
kubemerge-gui/
├── main.go              # App entry point, Wails window config
├── app.go               # Core Go methods (merge, contexts, namespaces, cluster info)
├── tray.go              # System tray setup and menu
├── tray_context.go      # Kubeconfig path helpers for tray
├── widget_window.go     # Window resize helpers (expand/collapse/full GUI)
├── wsl.go               # WSL distro detection and UNC path resolution
├── build/               # App icons
└── frontend/
    └── src/
        ├── App.tsx                    # Main React app
        ├── App.css                    # Global styles
        └── components/
            ├── FloatingWidget.tsx     # Floating K8s icon + quick switcher
            ├── TitleBar.tsx           # Custom drag bar for frameless window
            ├── ContextDropdown.tsx    # Context switcher dropdown
            └── ContextSearchModal.tsx # Full-screen context search modal
```

---

## 🛠 Built With

- [Go](https://golang.org/)
- [Wails v2](https://wails.io/)
- [React](https://react.dev/) + TypeScript
- [client-go](https://github.com/kubernetes/client-go)

---

## 🎯 Roadmap

- [ ] Restore backup with one click
- [ ] Multi-file merge
- [ ] macOS release build
- [ ] Context rename
- [ ] Context export / import

---

## 🐛 Troubleshooting

**Context switch from widget doesn't update WSL cluster**
→ Load the WSL target first via Full GUI Mode → Target & Context → WSL → Load Target. The widget inherits that path.

**Tray "Show Window" shows a blank/tiny window**
→ Use Tray → Full GUI Mode to restore the correct window size.

**`wails generate module` fails with duplicate method**
→ `SetTargetKubeconfig` and `GetTargetKubeconfig` already exist in `tray_context.go` — do not add them to `widget_window.go`.

**WebView2 missing on Windows**
→ Download from https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## 📜 License

---

Made with ❤️ by [Cipheronic](https://github.com/vijayvj6796)
