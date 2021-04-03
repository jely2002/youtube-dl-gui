<img src="https://raw.githubusercontent.com/jely2002/youtube-dl-gui/v2.0.0/renderer/img/icon.png" alt="logo" align="left" height="100"/>

# youtube-dl-gui ![version badge](https://img.shields.io/github/v/release/jely2002/youtube-dl-gui?label=latest-release) ![downloads badge](https://img.shields.io/github/downloads/jely2002/youtube-dl-gui/total) ![CI badge](https://img.shields.io/github/workflow/status/jely2002/youtube-dl-gui/CI?label=CI) ![coverage badge](https://img.shields.io/codecov/c/github/jely2002/youtube-dl-gui)
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
1. Download the [applicable installer or executable](https://github.com/jely2002/youtube-dl-gui/releases/latest) for your system.
2. If you are on windows, make sure that the [Microsoft Visual C++ 2010 Redistributable Package (x86)](https://www.microsoft.com/en-us/download/details.aspx?id=5555) is installed. 
3. Paste a link into the box up top.
4. Wait for the app to gather all required metadata.
5. Press download, and the video(s) will get downloaded to your downloads folder.

Want to know more about the features this app offers? Head over to the [wiki](https://github.com/jely2002/youtube-dl-gui/wiki/).

## Something is not working!
Please see if the answer is in the frequently answered questions.
### FAQ
#### 1.  I can't open a video I downloaded
Sometimes a video gets downloaded in a format that isn't supported by all media players. This can be fixed by watching the video in VLC media player, or by transcoding it to another format.
#### 2. How do I download private videos?
Please take a look at the tutorial on this subject. It can be found in the [wiki](https://github.com/jely2002/youtube-dl-gui/wiki/Private-videos-&-playlists-2.0.0).
#### 3. What do all the settings do?
For more information on what all the settings do, take a look at the [wiki page](https://github.com/jely2002/youtube-dl-gui/wiki/Settings) about this subject.
#### 4. How do I build from source?
First, clone the repository using `git clone https://github.com/jely2002/youtube-dl-gui.git`.

Then navigate to the directory and install the npm modules by executing: `npm install`.

The last step is to build using electron-builder [(documentation)](https://www.electron.build/cli). For example, the command to build a windows installer is: `npx electron-builder --win`. The output files can be found in the 'dist' folder.

Please be aware that this app is only tested on windows, linux and macOS. If you decide to build for another platform/archtype it may or may not work. Builds other than those available in the releases come with absolutely no warranty.

### Didn't find an answer in the FAQ? There is more information in the [wiki](https://github.com/jely2002/youtube-dl-gui/wiki/), be sure to have a look!<br>
Still haven't found your answer? [Open up an issue](https://github.com/jely2002/youtube-dl-gui/issues), and describe the problem you're facing.

## Planned features
- White mode
- Show progress in app-icon
- Notify user when the download has finished

Feel free to [request a new feature](https://github.com/jely2002/youtube-dl-gui/issues).

## Demo gif
<img src="ytdlgui_demo.gif" alt="demo" width="500"/>  


## Liability & License notice
Youtube-dl-gui and its maintainers cannot be held liable for misuse of this application, as stated in the [AGPL-3.0 license (section 16)](https://github.com/jely2002/youtube-dl-gui/blob/master/LICENSE).  
The maintainers of youtube-dl-gui do not in any way condone the use of this application in practices that violate local laws such as but not limited to the DMCA. The maintainers of this application call upon the personal responsibility of its users to use this application in a fair way, as it is intended to be used.
