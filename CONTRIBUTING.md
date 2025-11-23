# Contributing to Open Video Downloader

Thanks for taking an interest in contributing!  
Open Video Downloader (OVD) is built with **Tauri (Rust backend)** and a **Vue 3 + TypeScript front-end**.  
It wraps [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) into a simple desktop app for downloading videos from hundreds of supported sites.

This document explains how to set up a local environment, follow our conventions, and submit contributions.

## Branching and workflow

We follow a lightweight **Gitflow** style workflow:

- **`main`** — active development (think of it as nightly).
- **`release`** — stable branch used for tagged releases.
- Feature branches follow the format:
    - `feature/my-new-thing`
    - `bugfix/fixed-a-crash`
    - `chore/update-deps`, etc.

When a release is ready, we bump versions on `main` and merge into `release` to trigger the build and publishing pipeline.

## Commit style

We use **Conventional Commits**.  
Keep messages clear, descriptive, and scoped when possible:

```
feat(dispatcher): improve fairness algorithm
fix(header): handle invalid URL input gracefully
```

Try to avoid vague messages like “update stuff”.

## Development setup

You’ll need **Node.js (v24+)** and **Rust (latest stable)** installed.

Clone, install dependencies, and run the app:

```
npm install
npm run tauri dev
```

## Code style

- **Frontend:** ESLint handles formatting and code style automatically.  
  Run `npm run lint:fix` before committing.
- **Backend:** Use `cargo clippy` and `cargo fmt` before pushing.
- Keep code readable and consistent with the existing style.

## Testing

- Run `npm run test:unit` for unit tests.
- Run `npm run test:e2e` for end-to-end tests (Playwright).
- Rust tests can be run with `cargo test`.

New features and bug fixes should include tests for common cases.  
Full coverage isn’t required, but regressions should be caught by tests.

## Pull requests

1. Make sure your PR targets **`main`**.
2. Make sure all **CI checks pass** (lint, build, tests).
3. Get at least **one approval** before merging.
4. Link related **issues or milestones** if applicable.

Opening an issue before starting work is appreciated, it helps track progress and lets others find related discussions.

## Need help?

If you’re unsure where to start, open a draft PR or discussion.  
We’re happy to help point you in the right direction.

## License

By contributing, you agree that your code will be licensed under the same  
[AGPL-3.0 license](./LICENSE) as the rest of the project.
