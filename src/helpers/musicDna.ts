import { MusicDnaSettings } from '../tauri/types/config.ts';
import { MusicDnaSuggestion } from '../tauri/types/musicDna.ts';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(part => normalize(part))
    .filter(Boolean);
}

export function computeAffinity(
  suggestion: MusicDnaSuggestion,
  settings: MusicDnaSettings,
): number {
  const tags = suggestion.tags.map(normalize);
  const focusGenres = settings.focusGenres.map(normalize);
  const hasGenreMatch = focusGenres.some(genre => tags.includes(genre));
  const hasRegionMatch = tags.includes(normalize(settings.targetRegion));

  const genreScore = hasGenreMatch ? settings.weights.genre : 0;
  const regionScore = hasRegionMatch ? settings.weights.region : 0;
  const neutralScore = settings.weights.era + settings.weights.instrumentation + settings.weights.mood;
  return Math.min(1, genreScore + regionScore + neutralScore);
}

export function rankMusicDnaSuggestions(
  suggestions: MusicDnaSuggestion[],
  settings: MusicDnaSettings,
): MusicDnaSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const scoreA = (a.confidence * 0.65) + (computeAffinity(a, settings) * 0.35);
    const scoreB = (b.confidence * 0.65) + (computeAffinity(b, settings) * 0.35);
    return scoreB - scoreA;
  });
}
