# Native dependency and application validation

The `Dependency resolver` workflow runs on main, on pull requests targeting
main, and through manual dispatch. Documentation-only pushes do not restart the
six native builds. Validation builds do not use release signing credentials.

## Evidence categories

- **Native fixtures:** production resolver/installer/extractor/runtime modules run
  with small generated test executables. These establish regression behavior,
  not compatibility with the real upstream tools or the entire GUI application.
- **Real native backend:** an Ed25519-verified upstream manifest and SHA256-checked
  downloads feed the production extraction, validation, publication, resolver,
  process-control, and runtime adapter code. PE/ELF/Mach-O architecture is recorded;
  permitted OS translation is reported separately from native execution.
- **Compiled application:** the full Tauri executable is built with the opt-in
  `dependency-validation` feature. Its headless entry point runs the same real
  backend scenarios, before GUI/plugin initialization. This is actual execution
  of the compiled application's dependency backend, not a GUI or IPC test.
- **Packaging/layout:** the compiled app is run with the actual portable marker,
  and from the native package. Windows uses an unsigned NSIS silent installation;
  macOS executes the generated `.app`; Linux extracts a native `.deb` and executes
  its binary (it does not register that package with the OS package manager).

Each platform's `validation-*` artifact contains signed manifest provenance,
asset selection, header architecture, detected versions and paths, successful
checks and any error. Never infer that all behavior passed from a compiled
binary, a dispatched workflow, or fixture success alone. Inspect job steps,
logs, and reports. GUI scenarios, updater behavior and system integration can
remain unverified even when these backend checks pass.

## Six native targets

| Runner | Rust target | Native package |
| --- | --- | --- |
| Windows x64 | x86_64-pc-windows-msvc | NSIS + portable files |
| Windows ARM64 | aarch64-pc-windows-msvc | NSIS + portable files |
| macOS Intel | x86_64-apple-darwin | app |
| macOS Apple Silicon | aarch64-apple-darwin | app |
| Linux x64 | x86_64-unknown-linux-gnu | deb |
| Linux ARM64 | aarch64-unknown-linux-gnu | deb |

Both Node and Rust assert that they are executing the requested native target.
The workflow uses Rust 1.94.1, matching application CI. CI application builds
turn off release LTO and debug information and use 16 codegen units; they are
unsigned validation builds, not byte-for-byte release-profile reproductions.

## Real-tool scenarios

1. Select the exact platform asset (only the existing documented macOS
   AtomicParsley Intel fallback is allowed when an ARM asset is absent).
2. Verify the manifest signature and each download hash; inspect binary headers.
3. Extract with production ZIP/tar functions, retain bundle runtime files,
   validate staged executable capabilities, and publish to managed storage.
4. Seed an isolated PATH with those real tools and exercise environment discovery.
5. Reject a real invalid executable and use managed fallback; reject an invalid
   explicit pin without silently falling back; check locked bundled resolution.
6. Put real FFmpeg and FFprobe in separate paths, use the runtime alias adapter,
   encode a short AAC source, download it through yt-dlp from a local HTTP server,
   convert it to MP3 and verify its codec with FFprobe. No public media website
   or account is needed.
7. Repeat through the full application in normal and portable storage layouts,
   then through its generated native package.

The current signed manifest maps an ARM-only AtomicParsley macOS archive to its
Intel key. Native Intel validation rejects that optional asset and explicitly
reports partial coverage; its hash is never replaced or bypassed. The required
four tools continue through all execution and packaging checks. Linux ARM64 also
has no managed AtomicParsley asset in the currently signed manifest;
that optional dependency is reported unavailable, not fabricated or silently
substituted. Windows ARM64 assets can contain Intel executables; such successful
execution is classified as OS translation, not native ARM validation. Apple
Silicon explicitly installs Rosetta for the documented optional fallback.

## Scope still requiring separate evidence

GUI rendering and interaction on ARM/macOS/Linux, frontend-to-Rust IPC and OS
keychain behavior are not exercised by the headless entry point. Signing,
notarization, SmartScreen/Gatekeeper trust, updater installation, MSIX/Store
registration, Snap, AppImage, RPM and DMG installation are not claimed by this
workflow. Existing path unit tests model bundled/MSIX/Snap storage rules, while
live checks exercise locked resolver behavior. These are not MSIX/Snap installs.
