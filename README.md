<img src="https://raw.githubusercontent.com/jely2002/youtube-dl-gui/master/web-resources/icon.png" alt="logo" width="55" height="50" align="left"/>

# youtube-dl-gui
A cross-platform GUI for youtube-dl made in Electron and node.js

<img src="ytdlgui_demo.gif" alt="demo" width="500"/>

**Features:**
- Download videos in all qualities up to 8K (if available)
- Download (parts of) playlists
- Download and extract audio (mp3)
- Download private videos
- Lightning fast download speeds (cache & multiple processes)
- Shows an estimated download size before downloading the videos
- The app wil automatically update to the latest version. (macOS only has an update notification)

## How to use
Download the .exe if you are on Windows, .dmg if you are on macOSX or the .AppImage on Linux, then just open them and you're good to go!
The releases can be found [here](https://github.com/jely2002/youtube-dl-gui/releases).

The default download location is your downloads folder, although this can easily be changed.

## I have an issue!
Please see if the answer is in the frequently answered questions.
#### FAQ
##### 1.  I can't open a video I downloaded
Sometimes a video gets downloaded in a format that isn't supported by all media players. This can be fixed by watching the video in VLC media player, or by transcoding it to another format.
##### 2.  The download appears to be stuck on 'Merging audio and video...'
The progress bar shows the amount of data that is downloaded from YouTube. The audio and video gets downloaded seperately and then merged together, this can take a considerable amount of time with large files. So please be patient.
##### 3. How do I download private videos?
Please take a look at the tutorial on this subject. It can be found in the [wiki](https://github.com/jely2002/youtube-dl-gui/wiki/Tutorial:-Private-videos-&-playlists).

##### Didn't find an answer in the FAQ? 
Please open up an issue [right here](https://github.com/jely2002/youtube-dl-gui/issues) and describe the problem you're facing, I'll try to help you as soon as possible. 

## Planned features
- None at this time

Feel free to [request a new feature](https://github.com/jely2002/youtube-dl-gui/issues).

## Liablity & Copyright notice
Youtube-dl-gui and its maintainers cannot be held liable for misuse of this application, as stated in the [GPL-3.0 license (section 16)](https://github.com/jely2002/youtube-dl-gui/blob/a5308119a1a2352ec54e95d69cb60dcc3fee80d1/LICENSE#L600).
The maintainers of Youtube-dl-gui do not in any way condone the use of this application in practices that violate local laws such as but not limited to the DMCA. The maintainers of this application call upon the personal responsibility of its users to use this application in a fair way, as it is intended to be used.
