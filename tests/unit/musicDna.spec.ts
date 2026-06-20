import { describe, expect, it } from 'vitest';
import { computeAffinity, rankMusicDnaSuggestions, splitCsv } from '../../src/helpers/musicDna.ts';
import { defaultMusicDnaSettings } from '../../src/tauri/types/config.ts';
import type { MusicDnaSuggestion } from '../../src/tauri/types/musicDna.ts';

describe('music dna helpers', () => {
  it('splits CSV settings safely', () => {
    expect(splitCsv(' Rock, Iraqi , ,Alt ')).toEqual(['rock', 'iraqi', 'alt']);
  });

  it('boosts affinity when genre and region tags match', () => {
    const suggestion: MusicDnaSuggestion = {
      title: 'Song',
      artist: 'Artist',
      rationale: 'Matched',
      confidence: 0.5,
      tags: ['Rock', 'Iraq'],
      url: null,
    };

    const score = computeAffinity(suggestion, defaultMusicDnaSettings);
    expect(score).toBeGreaterThan(0.6);
  });

  it('ranks by confidence plus affinity', () => {
    const settings = structuredClone(defaultMusicDnaSettings);
    settings.focusGenres = ['rock', 'iraqi'];
    settings.targetRegion = 'iraq';

    const suggestions: MusicDnaSuggestion[] = [
      {
        title: 'A',
        artist: 'A',
        rationale: 'A',
        confidence: 0.7,
        tags: ['pop'],
        url: null,
      },
      {
        title: 'B',
        artist: 'B',
        rationale: 'B',
        confidence: 0.65,
        tags: ['rock', 'iraq'],
        url: null,
      },
    ];

    const ranked = rankMusicDnaSuggestions(suggestions, settings);
    expect(ranked[0]?.title).toBe('B');
  });
});
