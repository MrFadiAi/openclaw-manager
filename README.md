# 🦞 OpenClaw Manager

High-performance cross-platform AI assistant management tool, built with **Tauri 2.0 + React + TypeScript + Rust**.

![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-1.70+-red)

## 📸 Interface Preview

### 📊 Dashboard Overview

Real-time monitoring of service status, one-click management of AI assistant services.

![Dashboard](pic/dashboard.png)

- Real-time service status monitoring (port, process ID, memory, uptime)
- Quick actions: Start / Stop / Restart / Diagnose
- Real-time log viewing with auto-refresh support

---

### 🤖 AI Model Configuration

Flexible configuration of multiple AI providers, supports custom API addresses.

![AI Configuration](pic/ai.png)

- Supports 14+ AI providers (Anthropic, OpenAI, DeepSeek, Moonshot, Gemini, etc.)
- Custom API endpoints, compatible with third-party services using OpenAI format
- One-click primary model setup, quick switching

---

### 📱 Message Channel Configuration

Connect to multiple instant messaging platforms to create an omnichannel AI assistant.

<table>
  <tr>
    <td width="50%">
      <img src="pic/telegram.png" alt="Telegram Configuration">
      <p align="center"><b>Telegram Bot</b></p>
    </td>
    <td width="50%">
      <img src="pic/feishu.png" alt="Feishu Configuration">
      <p align="center"><b>Feishu Bot</b></p>
    </td>
  </tr>
</table>

- **Telegram** - Bot Token configuration, private chat/group policies
- **Feishu** - App ID/Secret, WebSocket connection, multiple deployment regions
- **More Channels** - Discord, Slack, WhatsApp, iMessage, WeChat, DingTalk

---

## ✨ Features

| Module | Features |
|--------|----------|
| 📊 **Dashboard** | Real-time service status monitoring, process memory statistics, one-click start/stop/restart |
| 🤖 **AI Configuration** | 14+ AI providers, custom API addresses, quick model switching |
| 📱 **Message Channels** | Telegram, Discord, Slack, Feishu, WeChat, iMessage, DingTalk |
| ⚡ **Service Management** | Background service control, real-time logs, launch on startup |
| 🧪 **Testing & Diagnostics** | System environment check, AI connection test, channel connectivity test |

## 🍎 macOS Common Issues

### "Damaged, cannot be opened" Error

macOS Gatekeeper security mechanism may prevent running unsigned applications. Solutions:

**Method 1: Remove Quarantine Attribute (Recommended)**

```bash
# For .app file
xattr -cr /Applications/OpenClaw\ Manager.app

# Or for .dmg file (before installation)
xattr -cr ~/Downloads/OpenClaw-Manager.dmg
```

**Method 2: Allow via System Preferences**

1. Open **System Preferences** > **Privacy & Security**
2. Find the blocked application in the "Security" section
3. Click **Open Anyway**

**Method 3: Temporarily Disable Gatekeeper (Not Recommended)**

```bash
# Disable (requires administrator password)
sudo spctl --master-disable

# Re-enable after installation
sudo spctl --master-enable
```

### Permission Issues

If the application cannot properly access files or perform operations:

**Grant Full Disk Access**

1. Open **System Preferences** > **Privacy & Security** > **Full Disk Access**
2. Click the lock icon to unlock, add **OpenClaw Manager**

**Reset Permissions**

If permission settings become abnormal, you can try resetting:

```bash
# Reset Accessibility permissions database
sudo tccutil reset Accessibility

# Reset Full Disk Access permissions
sudo tccutil reset SystemPolicyAllFiles
```

## 🚀 Quick Start

### Requirements

- **Node.js** >= 18.0
- **Rust** >= 1.70
- **pnpm** (recommended) or npm

### macOS Additional Dependencies

```bash
xcode-select --install
```

### Windows Additional Dependencies

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Linux Additional Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libxdo-devel
```

### Installation and Running

```bash
# Clone the project
git clone https://github.com/miaoxworld/openclaw-manager.git
cd openclaw-manager

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build release version
npm run tauri:build
```

## 📁 Project Structure

```
openclaw-manager/
├── src-tauri/                 # Rust Backend
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── commands/          # Tauri Commands
│   │   │   ├── service.rs     # Service management
│   │   │   ├── config.rs      # Configuration management
│   │   │   ├── process.rs     # Process management
│   │   │   └── diagnostics.rs # Diagnostics features
│   │   ├── models/            # Data models
│   │   └── utils/             # Utility functions
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                       # React Frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── Layout/            # Layout components
│   │   ├── Dashboard/         # Dashboard
│   │   ├── AIConfig/          # AI configuration
│   │   ├── Channels/          # Channel configuration
│   │   ├── Service/           # Service management
│   │   ├── Testing/           # Testing & diagnostics
│   │   └── Settings/          # Settings
│   └── styles/
│       └── globals.css
│
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 🛠️ Tech Stack

| Layer | Technology | Description |
|-------|------------|-------------|
| Frontend Framework | React 18 | User Interface |
| State Management | Zustand | Lightweight state management |
| Styling | TailwindCSS | Atomic CSS |
| Animation | Framer Motion | Smooth animations |
| Icons | Lucide React | Beautiful icons |
| Backend | Rust | High-performance system calls |
| Cross-platform | Tauri 2.0 | Native application wrapper |

## 📦 Build Artifacts

After running `npm run tauri:build`, artifacts will be generated in `src-tauri/target/release/bundle/`:

| Platform | Format |
|----------|--------|
| macOS | `.dmg`, `.app` |
| Windows | `.msi`, `.exe` |
| Linux | `.deb`, `.AppImage` |

## 🎨 Design Philosophy

- **Dark Theme**: Eye-friendly, suitable for extended use
- **Modern UI**: Frosted glass effects, smooth animations
- **Responsive**: Adapts to different screen sizes
- **High Performance**: Rust backend, minimal memory footprint

## 🔧 Development Commands

```bash
# Development mode (hot reload)
npm run tauri:dev

# Run frontend only
npm run dev

# Build frontend
npm run build

# Build complete application
npm run tauri:build

# Check Rust code
cd src-tauri && cargo check

# Run Rust tests
cd src-tauri && cargo test
```

## 📝 Configuration Notes

### Tauri Configuration (tauri.conf.json)

- `app.windows` - Window configuration
- `bundle` - Packaging configuration
- `plugins.shell.scope` - Shell command whitelist
- `plugins.fs.scope` - File access whitelist

### Environment Variables

The application reads environment variable configuration from `~/.openclaw/env`.

## 🤝 Contributing Guide

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 🔗 Related Links

- [OpenClaw Manager](https://github.com/miaoxworld/openclaw-manager) - GUI version (this project)
- [OpenClawInstaller](https://github.com/miaoxworld/OpenClawInstaller) - Command line version
- [Tauri Official Documentation](https://tauri.app/)
- [React Official Documentation](https://react.dev/)

---

**Made with ❤️ by OpenClaw Team**
