export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const out = { ...obj } as T & Record<string, unknown>;
  for (const k of keys) delete out[k as string];
  return out as Omit<T, K>;
}

export function firstKey<T extends object>(obj: T): keyof T | undefined {
  return Object.keys(obj)[0] as keyof T | undefined;
}

/**
 * A title for a new item that no other item in the queue already has, by adding a number:
 * "Title", "Title (2)", ... Two items with one title would be saved under one file name, and
 * the second would then be skipped as already downloaded. Only the very same address added
 * again keeps the title it had: a second, needless copy is a safer mistake than a video
 * silently not downloaded.
 */
export function uniqueTitle(title: string, url: string, others: Array<{ title?: string; url: string }>): string {
  const taken = new Set(others.filter(other => other.url !== url).map(other => other.title));
  if (!taken.has(title)) return title;
  for (let n = 2; ; n++) {
    const numbered = `${title} (${n})`;
    if (!taken.has(numbered)) return numbered;
  }
}
