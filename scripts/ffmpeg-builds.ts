export interface BuildRelease {
  tag_name: string;
  published_at: string;
  draft?: boolean;
  assets: { name: string; browser_download_url: string }[];
}

// The /latest ZIP is replaced independently of our signed manifest. Select a
// dated release and derive archive entries from that exact asset instead.
export function windowsArmBuild(releases: BuildRelease[]) {
  for (const release of releases) {
    if (release.draft || !/^autobuild-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(release.tag_name)) continue;
    const asset = release.assets.find(a => /^ffmpeg-N-\d+-g[0-9a-f]+-winarm64-gpl\.zip$/.test(a.name));
    if (!asset) continue;
    const url = new URL(asset.browser_download_url);
    if (url.origin !== 'https://github.com' || url.pathname !== `/yt-dlp/FFmpeg-Builds/releases/download/${release.tag_name}/${asset.name}`) continue;
    return { url: asset.browser_download_url, directory: asset.name.slice(0, -4) };
  }
  throw new Error('No dated Windows ARM64 FFmpeg release asset found');
}
