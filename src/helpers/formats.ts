import { MediaFormat } from '../tauri/types/media';

export function sortFormats(formats: MediaFormat[]): MediaFormat[] {
  const clone = [...formats];
  return clone.sort(sortFormat);
}

export function sortFormat(a: MediaFormat, b: MediaFormat): number {
  if (a.height && b.height) {
    const heightDiff = b.height - a.height;
    return heightDiff !== 0 ? heightDiff : (b.fps ?? 0) - (a.fps ?? 0);
  } else if (a.asr && b.asr) {
    return b.asr - a.asr;
  } else {
    return b.id.localeCompare(a.id);
  }
}

export function nearestBy<T>(
  items: T[],
  score: (x: T) => number,
  tieBreak?: (a: T, b: T) => number,
): T | undefined {
  let best: T | undefined;
  let bestScore = Infinity;
  for (const it of items) {
    const s = score(it);
    if (s < bestScore || (s === bestScore && tieBreak && best && tieBreak(it, best) > 0)) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

export function approxAudio(formats: MediaFormat[], targetAsr?: number) {
  const audio = formats.filter(f => f.asr != null);
  if (!audio.length) return undefined;

  if (targetAsr == null) {
    return audio.reduce((best, f) => ((f.asr ?? 0) > (best.asr ?? 0) ? f : best), audio[0]);
  }

  return nearestBy(
    audio,
    f => Math.abs((f.asr ?? 0) - targetAsr),
    (a, b) => (a.asr ?? 0) - (b.asr ?? 0),
  );
}

export function approxVideo(
  formats: MediaFormat[],
  targetHeight?: number,
  targetFps?: number,
) {
  const video = formats.filter(f => f.height != null);
  if (!video.length) return undefined;

  if (targetHeight == null && targetFps == null) {
    return video.reduce((best, f) => {
      const [bh, bf] = [best.height ?? 0, best.fps ?? 0];
      const [h, fps] = [f.height ?? 0, f.fps ?? 0];
      if (h !== bh) return h > bh ? f : best;
      if (fps !== bf) return fps > bf ? f : best;
      return best;
    }, video[0]);
  }

  if (targetHeight != null) {
    const sameHeight = video.filter(f => f.height === targetHeight);
    if (sameHeight.length) {
      if (targetFps == null) {
        return sameHeight.reduce(
          (best, f) => ((f.fps ?? 0) > (best.fps ?? 0) ? f : best),
          sameHeight[0],
        );
      }

      return nearestBy(
        sameHeight,
        f => Math.abs((f.fps ?? 0) - targetFps),
        (a, b) => (a.fps ?? 0) - (b.fps ?? 0),
      );
    }
  }

  return nearestBy(
    video,
    (f) => {
      const dh = Math.abs((f.height ?? 0) - (targetHeight ?? 0));
      const df = targetFps == null ? 0 : Math.abs((f.fps ?? 0) - targetFps);
      return dh * 1000 + df;
    },
    (a, b) =>
      ((a.height ?? 0) - (b.height ?? 0))
      || ((a.fps ?? 0) - (b.fps ?? 0)),
  );
}
