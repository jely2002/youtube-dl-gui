# AGENTS

## Overview
This project uses Vue 3 with TypeScript for the frontend and Rust for the backend.
Vue code lives in `src/` and `src/components`, while the Rust Tauri backend lives in `src-tauri/`.

## Testing
Before committing changes, run the following commands:

### JavaScript/TypeScript
- `npm run lint:fix` to apply ESLint fixes and formatting.
- `npm run test:unit` to run unit tests.
- `npm run test:e2e` to run end-to-end tests.
- `npm run build` to ensure the app builds.

To run e2e tests locally, install Playwright browsers and required system packages:

- `npx playwright install --with-deps`

### Rust (inside `src-tauri/`)
- `cargo fmt --all` to format Rust code.
- `cargo clippy --all-targets -- -D warnings` to lint.
- `cargo test` to run backend tests.

Rust linting and tests may fail in this environment because the `glib-2.0` system library is missing.

## Searching
Use `rg` for searching the codebase; avoid recursive `grep` or `ls` commands.

## Commit style
Write commit messages in the form `type: summary`, e.g. `fix: update progress bar logic`.
