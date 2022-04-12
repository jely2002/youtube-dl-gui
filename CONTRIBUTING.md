# Prerequisites

- node.js (from https://nodejs.org/en/ or the package manager of your choice)
  - for CI node.js 12 is used, but node.js 16 and 17 should work as well
- node npm and npx are on the path (check that you can run `node -v`, `npm -v`  and `npx -v`)

# Build locally

- `npm install` to download the dependencies
- `npm run start` to download the binaries to the binaries folder (only needed once)
- `npx electron-builder` to build the electron app to the dist/ folder
  - `npx electron-builder -m` for macos
  - `npx electron-builder -w` for windows
  - `npx electron-builder -l` for linux app image
