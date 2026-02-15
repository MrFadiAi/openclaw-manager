# 🚀 How to Publish a New Release

## Quick Steps

### 1. Update the version number in **both** files:

- `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `package.json` → `"version": "X.Y.Z"`

### 2. Commit the version bump:

```bash
git add -A
git commit -m "release: vX.Y.Z"
git push origin main
```

### 3. Create and push a tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**That's it!** GitHub Actions will automatically build for Windows, macOS (ARM + Intel), and Linux, then publish a release with all installers.

---

## Where to find the release

👉 https://github.com/MrFadiAi/openclaw-one-click-installer/releases

Builds take **~10–15 minutes**. You can watch progress in the **Actions** tab.

---

## Example: releasing v0.1.0

```bash
# 1. Edit versions in tauri.conf.json and package.json to "0.1.0"

# 2. Commit
git add -A
git commit -m "release: v0.1.0"
git push origin main

# 3. Tag & push
git tag v0.1.0
git push origin v0.1.0
```

---

## Re-run a release manually

Go to **Actions** → **Release** → **Run workflow** (top right) if you need to re-trigger without a new tag.
