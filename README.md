
# 🚀 KubeMerge GUI

A lightweight desktop utility built with **Go + Wails** to:

- 🔀 Safely merge kubeconfig files
- 💾 Automatically create backups
- 🔄 Switch Kubernetes contexts (kubectx-style)
- 📂 Manage contexts visually

---

## ✨ Features

- Select and merge kubeconfig files into `~/.kube/config`
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
- Windows & macOS release builds

## 📜 License
