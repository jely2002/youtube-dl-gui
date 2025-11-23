export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const out = { ...obj } as T & Record<string, unknown>;
  for (const k of keys) delete out[k as string];
  return out as Omit<T, K>;
}

export function firstKey<T extends object>(obj: T): keyof T | undefined {
  return Object.keys(obj)[0] as keyof T | undefined;
}
