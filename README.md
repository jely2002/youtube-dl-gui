<img src="https://raw.githubusercontent.com/StefanLobbenmeier/youtube-dl-gui/v2.0.0/renderer/img/icon.png" alt="logo" align="left" height="100"/>

# Open Video Downloader (youtube-dl-gui)
[![version badge](https://img.shields.io/github/v/release/StefanLobbenmeier/youtube-dl-gui?label=latest-release)](https://github.com/StefanLobbenmeier/youtube-dl-gui/releases/latest)
[![license](https://img.shields.io/github/license/StefanLobbenmeier/youtube-dl-gui)](https://github.com/StefanLobbenmeier/youtube-dl-gui/blob/master/LICENSE)
[![coverage badge](https://img.shields.io/codecov/c/github/StefanLobbenmeier/youtube-dl-gui)](https://app.codecov.io/gh/StefanLobbenmeier/youtube-dl-gui)
[![downloads](https://img.shields.io/github/downloads/StefanLobbenmeier/youtube-dl-gui/total)](https://github.com/StefanLobbenmeier/youtube-dl-gui/releases/latest)
[![CI badge](https://img.shields.io/github/actions/workflow/status/StefanLobbenmeier/youtube-dl-gui/continuous-integration.yaml)](https://github.com/StefanLobbenmeier/youtube-dl-gui/actions)

https://github.com/StefanLobbenmeier/youtube-dl-gui

A cross-platform GUI for youtube-dl made in Electron and node.js


### Features:
- Download from all kind of platforms: YouTube, vimeo, twitter & many more
- Download multiple videos/playlists/channels in one go
- Select the resolution and format you want to download in
- Download private videos (currently only tested on YouTube)
- Multithreaded, up to 32 videos can be downloaded synchronously
- Shows how much size the download will use up on your system
- The app automatically keeps ytdl up-to-date

Be sure to check out [a demo gif of the application](#Demo-gif)!

## How to use
1. Download the [applicable installer or executable](https://github.com/StefanLobbenmeier/youtube-dl-gui/releases/latest) for your system.
2. If you are on windows, make sure that the [Microsoft Visual C++ 2010 Redistributable Package (x86)](https://download.microsoft.com/download/1/6/5/165255E7-1014-4D0A-B094-B6A430A6BFFC/vcredist_x86.exe) is installed. 
3. Paste a link into the box up top.
4. Wait for the app to gather all required metadata.
5. Press download, and the video(s) will get downloaded to your downloads folder.

Want to know more about the features this app offers? Head over to the [wiki](https://github.com/StefanLobbenmeier/youtube-dl-gui/wiki/).

## Supporting the project
I appreciate any help. That may include:
- testing and raising issues if you encounter any
- contributing via a pull request
- donating to the project ([ko-fi](https://ko-fi.com/stefanlobbenmeier))

## Something is not working!
Please see if the answer is in the [frequently answered questions](https://github.com/StefanLobbenmeier/youtube-dl-gui/wiki/FAQ) or in the [wiki](https://github.com/StefanLobbenmeier/youtube-dl-gui/wiki/).

Still haven't found your answer? [Open up an issue](https://github.com/StefanLobbenmeier/youtube-dl-gui/issues), and describe the problem you're facing.

## Building from source
First, clone the repository using `git clone https://github.com/StefanLobbenmeier/youtube-dl-gui.git`.

Then navigate to the directory and install the npm modules by executing: `npm install`.

The last step is to build using electron-builder [(documentation)](https://www.electron.build/cli). For example, the command to build a windows installer is: `npx electron-builder --win`. The output files can be found in the 'dist' folder.

Please be aware that this app is only tested on windows, linux and macOS. If you decide to build for another platform/archtype it may or may not work. Builds other than those available in the releases come with absolutely no support.

## Planned features
- Select individual audio and video codecs (advanced mode)
- List all audio qualities
- Support for downloading livestreams

Feel free to [request a new feature](https://github.com/StefanLobbenmeier/youtube-dl-gui/issues).

## Demo gif
<img src="ytdlgui_demo.gif" alt="demo" width="500"/>  

## Credit
Big thanks to the original author [jely2002](https://github.com/jely2002), who unfortunately stopped maintaining the original repository: https://github.com/jely2002/youtube-dl-gui

## Liability & License notice
Youtube-dl-gui and its maintainers cannot be held liable for misuse of this application, as stated in the [AGPL-3.0 license (section 16)](https://github.com/StefanLobbenmeier/youtube-dl-gui/blob/master/LICENSE).  
The maintainers of youtube-dl-gui do not in any way condone the use of this application in practices that violate local laws such as but not limited to the DMCA. The maintainers of this application call upon the personal responsibility of its users to use this application in a fair way, as it is intended to be used.
