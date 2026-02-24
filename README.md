# 👩‍💻 For Developers / Build from Source

1. Install dependencies (Linux example):
	```bash
	sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev build-essential
	```
2. Install Wails CLI:
	```bash
	go install github.com/wailsapp/wails/v2/cmd/wails@latest
	```
3. Clone this repository:
	```bash
	git clone https://github.com/YOUR_USERNAME/kubemerge-gui.git
	cd kubemerge-gui
	```
4. Install frontend dependencies:
	```bash
	cd frontend
	npm install
	cd ..
	```
5. Run in development mode:
	```bash
	wails dev
	```
6. Build a production binary:
	```bash
	wails build
	```

---
# ⚡ Quick Start (Download & Run)

1. Download the latest release for your OS from the [Releases](https://github.com/YOUR_USERNAME/kubemerge-gui/releases) page.
2. Unzip and run the binary:
	- **Windows:** `kubemerge-gui.exe`
	- **Linux:** `kubemerge-gui`
	- **macOS:** (coming soon)

**Linux users:** You may need to install dependencies:
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev build-essential
```

No installation required for Windows. Just double-click the `.exe` file.

---

# 🚀 KubeMerge GUI

A lightweight desktop utility built with **Go + Wails** to:

- 🔀 Safely merge kubeconfig files
- 💾 Automatically create backups
- 🔄 Switch Kubernetes contexts (kubectx-style)
- 📂 Manage contexts visually

---

## ✨ Features

- Select and merge kubeconfig files into your chosen target (Windows, Linux, or WSL)
- Automatic timestamp backup before merge
- Alphabetically sorted context list
- Switch context with one click
- Auto-load contexts on startup
- Clean dark UI

---

## 🛠 Built With

- Go
- Wails v2
- React + TypeScript
- client-go

---

## 📦 Installation (Development)

### 1️⃣ Install dependencies

Ubuntu:

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev build-essential
```

Install Wails:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

2️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/kubemerge-gui.git
cd kubemerge-gui
```

3️⃣ Run in Dev Mode

```bash
wails dev
```

🏗 Build Production Binary

```bash
wails build
```

Binary will be located in:

```
build/bin/
```

## ⚠️ Safety

Before merging, the app creates a backup:

```
~/.kube/config.bak-YYYYMMDD_HHMMSS
```

You can restore manually if needed.

## 🎯 Roadmap

- Restore backup button
- Search filter for contexts
- Namespace switch (kubens style)
- Multi-file merge
- macOS release build

## 📜 License
