export function resolvePlaylistIndex(
  playlistIndex: number | undefined,
  playlistCount: number | undefined,
  reversePlaylistNumbering: boolean,
): number | undefined {
  if (playlistIndex == null) return undefined;

  const normalizedIndex = playlistIndex + 1;
  if (!reversePlaylistNumbering || playlistCount == null || playlistCount < normalizedIndex) {
    return normalizedIndex;
  }

  return playlistCount - normalizedIndex + 1;
}
