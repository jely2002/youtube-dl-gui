<img src="https://raw.githubusercontent.com/jely2002/youtube-dl-gui/v2.0.0/renderer/img/icon.png" alt="logo" align="left" height="100"/>

# Open Video Downloader (youtube-dl-gui) <br> ![version badge](https://img.shields.io/github/v/release/jely2002/youtube-dl-gui?label=latest-release) ![GitHub](https://img.shields.io/github/license/jely2002/youtube-dl-gui) ![downloads](https://img.shields.io/github/downloads/jely2002/youtube-dl-gui/total) 
[https://jely2002.github.io/youtube-dl-gui](https://jely2002.github.io/youtube-dl-gui)

Open Video Downloader is a simple, cross-platform desktop application that lets you download videos, audio, subtitles and metadata from hundreds of supported websites, not just YouTube.  
It provides an easy-to-use interface around [yt-dlp](https://github.com/yt-dlp/yt-dlp) so you don’t have to touch the command line.


## Features

- **Cross-platform:** works on Windows, macOS and Linux.
- **Audio or video downloads:** grab full videos or extract only the audio track.
- **Subtitles and metadata:** automatically saves available captions and video information.
- **Quality control:** choose your preferred resolution, frame rate, and output format like MP4 or MKV.
- **Playlists:** download entire playlists in one go.
- **Custom output:** set your download location and control filenames using presets or custom templates.
- **Smart queueing:** OVD balances multiple downloads automatically so your computer doesn’t slow down.
- **Authentication:** supports browser cookie files, basic auth and video passwords.
- **Automatic updates:** both the app and yt-dlp are kept up to date automatically.
- **Light and dark mode:** adapts to your system theme with clear progress and error handling.

## Download

The latest versions for **Windows**, **macOS** and **Linux** are available on the  
[GitHub Releases page](https://github.com/jely2002/youtube-dl-gui/releases).

Download the installer or archive for your platform and follow the normal installation steps.  
No command-line setup is required.

#### What file do I download?
| Your Computer                         | Download                                       |
|---------------------------------------|------------------------------------------------|
| **Windows**                           | `Open.Video.Downloader_x.x.x_x64-setup.exe`    |
| **Mac (Intel)**                       | `Open.Video.Downloader_x.x.x_x64.dmg`          |
| **Mac (Apple Silicon – M1, M2 … M5)** | `Open.Video.Downloader_x.x.x_aarch64.dmg`      |
| **Linux generic (x64)**               | `Open.Video.Downloader_x.x.x_amd64.AppImage`   |
| **Linux generic (aarch64)**           | `Open.Video.Downloader_x.x.x_aarch64.AppImage` |
| **Linux Debian/Ubuntu (x64)**         | `Open.Video.Downloader_x.x.x_amd64.deb`        |
| **Linux Debian/Ubuntu (aarch64)**     | `Open.Video.Downloader_x.x.x_aarch64.deb`      |
| **Linux Fedora/RHEL (x64)**           | `Open.Video.Downloader_x.x.x_amd64.rpm`        |
| **Linux Fedora/RHEL (aarch64)**       | `Open.Video.Downloader_x.x.x_aarch64.rpm`      |

## How it works

Open Video Downloader uses a front-end built with Vue 3 and a Rust backend powered by [Tauri](https://tauri.app/).  
When you add a video or playlist, the app communicates with yt-dlp to fetch information, process options and start the download.  
The download progress and any errors are displayed in the app.

## Contributing

Developers are welcome to contribute.  
You’ll need Node.js (v24+) and Rust installed.

```
npm install
npm run tauri dev
```

For more details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License and disclaimer

Open Video Downloader is distributed under the [AGPL-3.0 license](./LICENSE).

#### Use this application responsibly
The maintainers of Open Video Downloader cannot be held liable for misuse of this application, as stated in the AGPL-3.0 license (section 16).  
We do not condone the use of this software to violate local laws or platform terms of service (including the DMCA).  
Users are personally responsible for ensuring they use this software fairly and within legal boundaries.
