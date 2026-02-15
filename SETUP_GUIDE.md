# 🚀 OpenClaw Manager — Setup Guide

## For End Users (Download Release)

If you downloaded a release build (`.msi`, `.exe`, `.dmg`, or `.AppImage`), just **open the app** — the built-in **Setup Wizard** will automatically:

1. ✅ Detect your operating system
2. ✅ Check for **Node.js** (>= 18) and **Git**
3. ✅ One-click install any missing prerequisites
4. ✅ Install **OpenClaw** and initialize configuration

No terminal required.

---

## For Developers (Build From Source)

### Prerequisites

| Requirement | Version | Download |
|-------------|---------|----------|
| **Node.js** | >= 18.0 | [nodejs.org](https://nodejs.org/) |
| **Rust** | >= 1.70 | [rustup.rs](https://rustup.rs/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

> [!TIP]
> Verify installations:
> ```bash
> node --version    # Should print v18.x or higher
> rustc --version   # Should print 1.70 or higher
> git --version
> ```

### Platform-Specific Dependencies

<details>
<summary><b>🪟 Windows</b></summary>

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select **"Desktop development with C++"** workload
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) *(pre-installed on Windows 10/11)*
</details>

<details>
<summary><b>🍎 macOS</b></summary>

```bash
xcode-select --install
```
</details>

<details>
<summary><b>🐧 Linux (Ubuntu/Debian)</b></summary>

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```
</details>

<details>
<summary><b>🐧 Linux (Fedora)</b></summary>

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libxdo-devel
```
</details>

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/MrFadiAi/openclaw-one-click-installer.git
cd openclaw-one-click-installer
```

### Step 2 — Install Dependencies

```bash
npm install
```

This installs all frontend (React, Vite, TailwindCSS) and Tauri CLI dependencies.

### Step 3 — Run in Development Mode

```bash
npm run tauri:dev
```

This will:
1. Start the **Vite** dev server (React frontend with hot-reload)
2. Compile the **Rust** backend (first run takes 3–5 minutes)
3. Open the native desktop application window

> [!NOTE]
> The first build compiles all Rust dependencies and can take **3–5 minutes**. Subsequent runs are much faster due to caching.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run frontend only in the browser (no Tauri) |
| `npm run build` | Build the frontend |
| `npm run tauri:dev` | Full desktop app with hot-reload |
| `npm run tauri:build` | Build release installer (`.msi` / `.exe` / `.dmg`) |
| `cd src-tauri && cargo check` | Check Rust code for errors |
| `cd src-tauri && cargo test` | Run Rust tests |

---

## App Features Overview

Once the app is running, you'll find these sections in the sidebar:

| Page | What It Does |
|------|-------------|
| **Overview** | Service status dashboard, quick actions (start/stop/restart), system requirements panel |
| **MCPs** | Manage MCP servers — add, edit, test, enable/disable. Installs mcporter. Auto-syncs to `~/.mcporter/mcporter.json` |
| **Skills** | Browse and install OpenClaw skills via ClawHub |
| **AI Config** | Configure AI providers (14+), set API keys, choose primary model |
| **Channels** | Set up messaging integrations (Telegram, Discord, Feishu, Slack, etc.) |
| **Testing** | Run system, AI, and channel connectivity diagnostics |
| **Logs** | View structured application logs with level filtering and export |
| **Settings** | General application settings |

---

## Build Output

After `npm run tauri:build`, the installer will be in:

```
src-tauri/target/release/bundle/
├── msi/    → .msi installer (Windows)
├── nsis/   → .exe installer (Windows)
├── dmg/    → .dmg image (macOS)
├── deb/    → .deb package (Linux)
└── appimage/ → .AppImage (Linux)
```

---

## Troubleshooting

### `npm install` fails with `ENOENT`
Make sure you're in the correct project directory.

### Tauri version mismatch
If you see errors about mismatched versions, run `npm install` to update dependencies.

### Rust compilation errors
Ensure you have the C++ Build Tools installed:
- **Windows**: Open Visual Studio Installer → select **"Desktop development with C++"**
- **macOS**: Run `xcode-select --install`

### WebView2 missing (Windows)
Download and install the [WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### macOS "Damaged, cannot be opened"
```bash
xattr -cr /Applications/OpenClaw\ Manager.app
```

Or go to **System Preferences** > **Privacy & Security** → click **Open Anyway**.
