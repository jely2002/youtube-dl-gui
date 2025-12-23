function getOS() {
  let userAgent = window.navigator.userAgent,
    platform = window.navigator.platform,
    macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
    windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
    iosPlatforms = ['iPhone', 'iPad', 'iPod'],
    os;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'MacOS Silicon';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'other';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'other';
  } else if (/Linux/.test(platform)) {
    os = 'Linux x64';
  } else {
    os = 'other';
  }
  return os;
}

async function httpGet(url) {
  return await new Promise((resolve) => {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
      if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
        resolve(xmlHttp.responseText);
      else if (xmlHttp.readyState === 4 && xmlHttp.status != null) {
        resolve(null);
      }
    };
    xmlHttp.open('GET', url, true);
    xmlHttp.send(null);
  });
}

function getAssetDownload(os, release) {
  const version = release.tag_name.substring(5);
  let assetName;
  switch (os) {
    case 'Windows':
      assetName = 'Open.Video.Downloader_' + version + '_x64-setup.exe';
      break;
    case 'MacOS Silicon':
      assetName = 'Open.Video.Downloader_' + version + '_aarch64.dmg';
      break;
    case 'Linux x64':
      assetName = 'Open.Video.Downloader_' + version + '_amd64.AppImage';
  }

  for (const asset of release.assets) {
    if (assetName === asset.name) {
      return asset.browser_download_url;
    }
  }
}

function setupMicrosoftButton(os) {
  if (os !== 'Windows') {
    return;
  }

  const msButton = document.getElementById('ms-download-button');
  msButton.style.display = 'block';
  const button = document.getElementById('download-button');
  button.style.display = 'none';
}

function setOtherVersionsText(os) {
  if (os === 'MacOS Silicon') {
    document.getElementById('other-versions').innerHTML = 'Other versions (MacOS Intel)';
  } else if (os === 'Linux x64') {
    document.getElementById('other-versions').innerHTML = 'Other versions (Linux ARM / deb / rpm)';
  } else if (os === 'Windows') {
    document.getElementById('other-versions').innerHTML = 'Other versions (Portable / Installer)';
  }
}

async function setDownloadButton() {
  const os = getOS();
  setOtherVersionsText(os);
  setupMicrosoftButton(os);
  const versionData = await httpGet('https://api.github.com/repos/jely2002/youtube-dl-gui/releases/latest');
  if (versionData == null) {
    const download = 'https://github.com/jely2002/youtube-dl-gui/releases/latest';
    document.getElementById('download-type').innerHTML = 'For ' + os;
    document.getElementById('download-button').addEventListener('click', () => {
      window.location.href = download;
    });
    document.getElementById('download-link').setAttribute('href', download);
  } else if (os !== 'other') {
    const release = JSON.parse(versionData);
    const download = getAssetDownload(os, release);
    document.getElementById('download-type').innerHTML = release.tag_name + ' - ' + os;
    document.getElementById('download-button').addEventListener('click', () => {
      window.location = download;
    });
    document.getElementById('download-link').setAttribute('href', download);
  } else {
    const download = 'https://github.com/jely2002/youtube-dl-gui/releases/latest';
    document.getElementById('download-type').style.display = 'none';
    document.getElementById('download-button').addEventListener('click', () => {
      window.location.href = download;
    });
    document.getElementById('download-link').setAttribute('href', download);
  }
}

(function () {
  setDownloadButton().then(() => console.log('Download button configured'));
  document.getElementById('hamburger').addEventListener('click', () => {
    const nav = document.getElementById('nav-list');
    const opened = nav.style.display !== 'none';
    console.log(opened);
    nav.style.display = opened ? 'none' : 'block';
  });
}());
