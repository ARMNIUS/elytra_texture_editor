# Releasing Minecraft Texture Studio

## 1. Local Windows `.exe`

Tauri needs the MSVC toolchain on Windows:

- Rust (stable, `x86_64-pc-windows-msvc`): <https://rustup.rs/>
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload: <https://v2.tauri.app/start/prerequisites/>
- WebView2 runtime (preinstalled on current Windows 10/11; the installer can also download it)
- Node.js 20.19+ or 22.12+

Install the prerequisites, then from the repository root:

```powershell
npm ci
npm run build
npm run tauri build -- --bundles nsis
```

The installer is written to:

```
src-tauri\target\release\bundle\nsis\Minecraft Texture Studio_0.10.0_x64-setup.exe
```

A verified build on this machine produced a 2.03 MiB installer (portable binary: 8.67 MiB).
It is **unsigned**; Windows SmartScreen may warn on other machines until a code-signing
certificate is configured. The installer itself was generated with NSIS and Tauri's
package verification passed. GUI launch cannot be automated from the authoring sandbox,
so always smoke-test the installer manually.

`src-tauri/Cargo.lock` is committed to keep dependency versions reproducible. If you change
Rust dependencies, rebuild once and commit the updated lockfile.

The MSI target can be built with `--bundles msi` instead of `nsis` (NSIS is the requested
"full .exe" installer). Without the C++ Build Tools the Rust build fails at the linking
step; without administrator rights on the machine you cannot install them.

## 2. Build the `.exe` on GitHub Actions (recommended)

`.github/workflows/build-windows.yml` builds the installer on a GitHub-hosted Windows runner,
so no local Rust/MSVC installation is required:

1. Push the repository to GitHub (see below).
2. Open **Actions → Build Windows installer → Run workflow**, or push a version tag:
   ```powershell
   git tag v0.10.0
   git push origin v0.10.0
   ```
3. Download the `minecraft-texture-studio-windows-x64` artifact, or publish the draft release
   that is created automatically for tags.

## 3. Publish the source to GitHub

The repository must exist and be empty (no README, `.gitignore` or license) before the first push.

### Option A — GitHub CLI

```powershell
winget install --id GitHub.cli -e
gh auth login          # choose GitHub.com → HTTPS → login with a browser
gh repo create <repo-name> --public --source . --remote origin --push
```

### Option B — HTTPS with a personal access token

Create a fine-grained token with **Contents: read and write** for the target repository
(or a classic token with the `repo` scope), then:

```powershell
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Git Credential Manager asks for the token on the first push. Do not commit the token.

### Option C — SSH

```powershell
ssh-keygen -t ed25519 -C "your@email"
# add ~/.ssh/id_ed25519.pub at https://github.com/settings/keys
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

## 4. Release checklist

1. `npm run typecheck && npm test && npm run build`
2. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
   `index.html`, `README.md`, `AI_CONTEXT.md` and add a `CHANGELOG.md` entry.
3. Commit and push to `main`.
4. `git tag vX.Y.Z && git push origin vX.Y.Z`
5. Review the draft release on GitHub: the workflow attaches
   `Minecraft Texture Studio_X.Y.Z_x64-setup.exe`.
6. Smoke-test the installer on a clean Windows profile (install, launch, import a texture,
   save/open an `.mts` project).
