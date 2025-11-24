import { MediaGroupProgressPayload } from '../tauri/types/progress';

export function computeGroupPercentage(p?: MediaGroupProgressPayload): number {
  if (!p) return 0;
  if (p.done && p.total) {
    return (p.done / p.total) * 100;
  }
  return 0;
}

export function capitalizeFirstLetter(value?: string): string {
  return (value ?? '').charAt(0).toUpperCase() + String(value).slice(1);
}
