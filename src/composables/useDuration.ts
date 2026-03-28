import { computed, ComputedRef } from 'vue';
import { MediaItem } from '../tauri/types/media';

export function formatDuration(totalSeconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;

  const two = (n: number) => n.toString().padStart(2, '0');

  return hours > 0
    ? `${two(hours)}:${two(minutes)}:${two(seconds)}`
    : `${two(minutes)}:${two(seconds)}`;
}

export function useDuration(item: Pick<MediaItem, 'duration'>): ComputedRef<string> {
  return computed(() =>
    formatDuration(item.duration ?? 0),
  );
}
