import { normalize } from 'path';

export function canonicalize(p: string): string {
  if (p.includes('://')) return p;
  return normalize(p).replace(/\\/g, '/');
}
