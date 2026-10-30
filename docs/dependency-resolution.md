# Dependency discovery and reuse

## Investigation (before implementation)

Baseline: fork `main` at c402ee3, app 3.2.1. `main` is development;
`release` is stable (CONTRIBUTING.md). The Tauri manager fetches and verifies
an Ed25519-signed manifest, downloads each stale/missing tool, and checks its
SHA-256. Metadata versions describe managed downloads, not executable versions.
It previously checked only existence and manifest-version equality, and its
platform fallback could select an arbitrary binary for another architecture.
The runner prepended the managed bin directory to PATH and launched `yt-dlp`
by name. No explicit dependency settings or system validation existed.

The managed tools are yt-dlp, FFmpeg, FFprobe, Deno, and AtomicParsley.
yt-dlp's unpackaged bundles also contain Python libraries/runtime files; these
must remain together. No separate Node/Python install is required by OVD.
System Python/pip/pipx launchers are usable if their complete yt-dlp install
passes validation; the app does not manage their Python installation.

PathsManager chooses installed app data, sibling `ovd-portable` data, or Snap
user data/common directories. A sibling `bin` marks a bundled Store layout.
MSIX metadata is locked. That directory must never receive downloads, metadata
writes, or runtime aliases. Strict Snap confinement cannot discover arbitrary
host installations; only executables visible inside the sandbox are usable.
AppImage, DEB, RPM, NSIS and macOS use the ordinary manager and user storage.

The release workflow and source manifest support x86_64/aarch64 on Windows,
Linux and macOS. AtomicParsley has Linux x64, Windows x64 (also explicitly
mapped for Windows ARM emulation), and macOS Intel assets. macOS ARM can use
that Intel asset only when Rosetta actually launches it; Linux ARM has no
AtomicParsley asset. FFmpeg is its existing thumbnail fallback there.

Related PRs reviewed: upstream #680 (Windows ARM), #593 (Store bundled paths),
#588 (portable paths), #672 (subprocess trees), and #762 (download/output args).
Targeted all-state searches found no existing system-dependency resolver PR.

## Design

The existing BinariesManager owns discovery, selection, updates and installation.
A backend-only resolver validates executables locally before contacting the
manifest server. Runtime consumers request the same resolved tool set. Settings
can pin absolute executable paths; an invalid pin fails closed and never silently
falls back. Empty settings restore automatic discovery.

Implementation details, validation policy and test evidence are recorded below
as the implementation is verified.

## Resolution and execution policy

Normal distributions use an absolute configured path, then system discovery,
then the existing managed executable, then a signed managed download. Invalid
pins fail closed; an empty value restores automatic selection. A broken system
tool records its rejection and permits fallback. Compatible versions need not
match the manifest. Managed metadata continues to track the downloaded package
release, separately from the version printed by the executable.

Discovery uses absolute PATH entries and fixed, nonrecursive installation
locations: standard Unix bin directories, `/opt/homebrew/bin` on macOS,
`~/.local/bin`, `~/.deno/bin`, and Windows Scoop, WinGet Links, Chocolatey and
Deno bin directories. Relative/empty PATH entries, the current working directory,
the managed bin directory and world-writable Unix candidate directories are
excluded from automatic discovery. Windows launches `.exe` files only; npm-style
`.cmd`, `.bat` and PowerShell shims are not executed. No shell, package manager,
elevation, global PATH changes or system installation writes are used.

Each candidate must be a regular executable file and launch on the actual OS
and architecture. This accepts native/universal binaries and functioning OS
translation, while rejecting wrong-format files, missing loaders, missing shared
libraries, quarantine failures and unavailable emulation. There is no guess based
on the filename or a static architecture header. Probes run on blocking workers,
with closed stdin, a five-second deadline per invocation, a 512 KiB limit per
output stream and process-group/job termination. Successful validation is cached
for up to 30 seconds; path target, length, modification time and Unix executable
permissions are checked on every resolution. Failed probes are not cached. Transient Unix executable-write locks (ETXTBSY)
are retried for up to 500 ms within the original invocation deadline.

Minimum policy and functional checks:

| Tool | Minimum | Additional validation |
| --- | --- | --- |
| yt-dlp | 2025.11.12 | Calendar version identity plus yt-dlp help identity and OVD CLI flags, including JS runtimes and progress templates |
| FFmpeg | 4.4 | libavformat identity, MP3/AAC/JPEG encoders and MP3/MP4/Matroska muxers |
| FFprobe | 4.4 | libavformat identity and structured metadata CLI support |
| Deno | 2.3 | Runs a local JS program with remote imports/npm/config disabled and the runtime flags used by yt-dlp |
| AtomicParsley | 0.9 or calendar release | Product identity and artwork CLI support |

FFmpeg upstream `N-`/`git-` builds are checked using libavformat >=58 plus
capabilities rather than requiring a stable numeric version string. The minimums
are compatibility floors, not download recommendations. Codec checks cover OVD's
basic default output; arbitrary custom filters/encoders and site-specific yt-dlp
optional Python packages can still fail at use time. Python-installed yt-dlp must
have the runtime and optional packages needed for the user's sites (normally the
`default` extras). Discovery does not install or alter those packages.

FFmpeg and FFprobe are validated independently, preferring a sibling pair and
requiring equal libavformat major versions. Alternate installed pairs are tried
before downloading. This is a conservative coherence policy; it may reject some
mixed-version pairs that could work for particular files. A genuinely missing
counterpart is downloaded individually. If that reveals a version mismatch,
only the pair is repaired; the entire dependency set is never redownloaded.
Explicit pins remain authoritative during pairing.

The runner launches the absolute yt-dlp executable, supplies the absolute Deno
path with `--js-runtimes`, and supplies the selected FFmpeg/FFprobe directory with
`--ffmpeg-location`. These explicit command-line paths take precedence over
external yt-dlp configuration while preserving its existing configuration-file
behavior. Validation itself ignores external yt-dlp configuration.

Split or renamed FFmpeg/FFprobe paths use private aliases in application data.
Unix uses symlinks; Windows copies the executable and adjacent DLLs without
requiring symlink privileges, checks conflicting DLLs, and probes the copied file.
DLL metadata participates in the Windows alias cache key. AtomicParsley uses the
selected directory first on the child process PATH, or a canonical alias for a
renamed executable. Runtime aliases are scoped to the process and removed on
normal manager shutdown; an abruptly terminated process may leave its directory.

## Updates, storage, and packaging

System/configured executables are never replaced or updated by OVD. Current
managed tools are reused; managed updates still follow the existing setting and
manifest metadata. Disabling updates does not disable discovery or installation
of missing required tools. All-valid system installations need no manifest
request. Failed remote update checks retain locally usable dependencies, and
remote checks do not hold the resolver lock needed by downloads.

Ed25519 manifest verification is unchanged. HTTP errors are rejected, downloaded
bytes still require the signed SHA-256, and each installation is extracted into
its own staging directory and validated before publication. Publication uses
same-filesystem renames with a backup and rollback on errors. A multi-file
bundle is not one filesystem-wide atomic transaction; existing in-flight
processes and abrupt power loss remain limitations. Metadata is replaced via a
temporary file. A single manager mutex serializes resolution, installation and
metadata updates; queued installation calls recheck state instead of reporting
false success or starting duplicate writes.

PathsManager's installed, portable and Snap data selection is unchanged. Neither
portable nor installed distributions write managed executables into system tool
directories. Both use the same resolver. Locked metadata or a bundled Store
layout disables external selection and all downloads/metadata writes; packaged
tools are still validated rather than assumed operational. A missing/broken
bundled required tool produces a diagnostic and requires package repair/update.
The UI shows the locked state even when all bundled tools are broken.

| Platform | Managed asset policy / exception |
| --- | --- |
| Windows x64 | Native assets; system `.exe` discovery, NSIS and portable use the same resolver |
| Windows ARM64 | Exact ARM64 assets; AtomicParsley explicitly maps to its existing emulated Windows asset |
| macOS Intel | Exact Intel assets; Homebrew/Finder PATH supplement |
| macOS ARM64 | Exact ARM64 or universal assets; AtomicParsley Intel fallback only if Rosetta launches it |
| Linux x64 | Exact assets; AppImage, DEB and RPM share ordinary app-data behavior |
| Linux ARM64 | Exact assets; no managed AtomicParsley asset; an installed compatible tool may be reused, otherwise yt-dlp retains its FFmpeg thumbnail fallback |
| MSIX/Store | Locked bundled executables; no external override or protected-directory writes |
| Strict Snap | Only tools visible and executable within confinement; no attempt to escape to host installations |

No platform-prefix asset guessing remains. There is no new mandatory package
manager or new production Cargo dependency.

## UI and significant files

Settings → System → Dependencies shows active version/source/path, validation
status, failed candidates, optional manual file selection, and Automatic reset.
Only saved settings affect resolution. A refresh is local and does not download
anything. Backend reports include structured source/status and locked state;
startup failures point to the settings panel. New UI strings live in the English
locale and use the existing translation fallback.

| Files | Purpose |
| --- | --- |
| `src-tauri/src/binaries/resolver.rs` | Local discovery, validation, selection, coherence, fingerprints, platform mapping |
| `src-tauri/src/binaries/runtime.rs` | Absolute runner paths and yt-dlp directory/API adaptation |
| `src-tauri/src/binaries/installer.rs` | Verified downloads, cleanup and rollback publication |
| `binaries_manager.rs`, binary commands/state | Integrates resolution with signed-manifest plans, updates, installation and diagnostics |
| `ytdlp_runner.rs`, `ytdlp_download.rs` | Both capture and streaming subprocess paths use the resolver |
| Config models/types, `SettingsDependencies.vue`, system tab, binaries store | Manual pins, status UI and startup diagnostics |
| `resolver/tests.rs`, fixture, manager tests, dependency UI/IPC unit tests | Deterministic backend, update-plan, command, recovery and UI tests |
| `tests/dependency-resolver`, dependency resolver workflow | Compiles production backend modules without Tauri/WebKit; six native OS/architecture CI targets |

## Verification and remaining limits

Local host: Linux x86_64, Node 24.22.1. Full frontend build and ESLint pass;
135 frontend unit tests and 21 Playwright E2E tests pass. Playwright's pinned
browser download was unavailable (invalid archive), so the E2E run used
Chromium 153 from an isolated temporary package instead of Chromium 148.
No application/package dependency was changed for that workaround.

Full backend `cargo test`: 154 passed. The independent production-module harness
has 30 passing tests. Tests create native fixture executables and temporary
Unicode/space-containing paths, do not depend on installed media tools, and use
loopback HTTP only for failure/hash/recovery testing. The integration test runs
the actual command builder and invokes both resolved FFmpeg/FFprobe paths.

The harness covers precedence, missing/invalid/configured/system/managed/bundled
sources, version floors/capabilities, launch errors, hangs/output limits,
independent and mixed FFmpeg pairs, nightly versions, portable/installed roots,
architecture mapping/emulation policy, Unix permissions and symlink changes,
file removal, concurrent checks, failed downloads and recovery, SHA rejection,
bundle publication, offline resolution and literal Unicode/space-containing
command arguments. Manager tests cover managed update planning and avoiding
system/pinned/bundled replacement. UI tests cover source/path/status display,
manual selection/reset, locked controls and disabled-update startup discovery.

Windows/macOS/ARM, actual Rosetta/emulation, real package-manager installations,
MSIX confinement, strict Snap, signed installer builds and live video downloads
have not been exercised locally. The added CI matrix runs the same native
fixture tests on all six targets; those results must be assessed separately.
A working version/help/capability probe is not a sandbox or a cryptographic
attestation of a user-installed binary. Normal PATH trust and the residual
validation-to-execution race still apply. Arbitrary custom codec selections,
site availability, browser impersonation packages and yt-dlp extractor changes
cannot be established completely by offline startup validation.

Full backend Clippy and rustfmt pass with the repository CI toolchain, Rust
1.94.1. The standalone harness passes Clippy on stable 1.99.1. Rust 1.99 adds
a lint in the unchanged `ytdlp_error.rs`; CI-pinned Clippy was used rather than
changing that unrelated parser or suppressing project warnings.
