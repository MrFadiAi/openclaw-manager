# 🚀 OpenClaw Manager — Windows Setup Guide

## Prerequisites

Install the following before proceeding:

| Requirement | Version | Download |
|-------------|---------|----------|
| **Node.js** | >= 18.0 | [nodejs.org](https://nodejs.org/) |
| **Rust** | >= 1.70 | [rustup.rs](https://rustup.rs/) |
| **Microsoft C++ Build Tools** | Latest | [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |
| **WebView2** | Latest | [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) *(pre-installed on Windows 10/11)* |

> [!TIP]
> You can verify your installations by running:
> ```bash
> node --version
> rustc --version
> ```

---

## Step 1 — Open a Terminal in the Project Directory

**This is critical.** You must be inside the project folder before running any commands.

```bash
cd D:\Ai\openclaw-manager
```

> [!CAUTION]
> If you skip this step, `npm install` will fail with `ENOENT: no such file or directory` because it can't find `package.json`.

---

## Step 2 — Install Dependencies

```bash
npm install
```

This installs all frontend (React, Vite, TailwindCSS) and Tauri CLI dependencies.

---

## Step 3 — Run in Development Mode

```bash
npm run tauri:dev
```

This will:
1. Start the **Vite** dev server (React frontend with hot-reload)
2. Compile the **Rust** backend (first run takes a few minutes)
3. Open the native desktop application window

> [!NOTE]
> The first build compiles all Rust dependencies and can take **3–5 minutes**. Subsequent runs are much faster.

---

## Other Useful Commands

Run all commands from `D:\Ai\openclaw-manager`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Run frontend only in the browser (no Tauri) |
| `npm run build` | Build the frontend |
| `npm run tauri:build` | Build a release `.msi` / `.exe` installer |
| `cd src-tauri && cargo check` | Check Rust code for errors |
| `cd src-tauri && cargo test` | Run Rust tests |

---

## Troubleshooting

### `npm install` fails with `ENOENT`
Make sure you're in the correct directory:
```bash
cd D:\Ai\openclaw-manager
```

### Tauri version mismatch
If you see errors about mismatched versions (e.g., `tauri (v2.10.x) : @tauri-apps/api (v2.9.x)`), run:
```bash
npm install
```
This will update the dependency versions to match the installed Rust crate.


### Rust compilation errors
Ensure you have the C++ Build Tools installed. Open **Visual Studio Installer** → select **"Desktop development with C++"** workload.

### WebView2 missing
Download and install the [WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## Build Output

After `npm run tauri:build`, the installer will be in:
```
src-tauri/target/release/bundle/
├── msi/    → .msi installer
└── nsis/   → .exe installer
```
