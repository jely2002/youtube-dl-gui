import { MaybeRef, unref } from 'vue';

export function isValidUrl(input: MaybeRef<string | null>): boolean {
  const value = unref(input);
  if (!value) return false;

  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}
