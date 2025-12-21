import { describe, it, expect } from 'vitest';
import { MediaFormat } from '../../src/tauri/types/media.ts';
import { approxAudio, approxVideo, nearestBy } from '../../src/helpers/formats.ts';

describe('nearestBy', () => {
  it('selects the item with the smallest score', () => {
    const items = [1, 5, 10];
    const out = nearestBy(items, x => Math.abs(x - 6));
    expect(out).toBe(5);
  });

  it('tie-breaks when scores are equal', () => {
    const items = [4, 6];
    const out = nearestBy(
      items,
      x => Math.abs(x - 5),
      (a, b) => a - b,
    );
    expect(out).toBe(6);
  });

  it('returns undefined for empty list', () => {
    expect(nearestBy([], x => x)).toBeUndefined();
  });
});

describe('approxAudio', () => {
  const audioFormats: MediaFormat[] = [
    { id: '64', videoCodecs: [], abr: 64 },
    { id: '128', videoCodecs: [], abr: 128 },
    { id: '192', videoCodecs: [], abr: 192 },
    { id: '256', videoCodecs: [], abr: 256 },
  ];

  it('returns highest ABR when no target is given', () => {
    const out = approxAudio(audioFormats);
    expect(out?.abr).toBe(256);
  });

  it('returns exact match when target exists', () => {
    const out = approxAudio(audioFormats, 192);
    expect(out?.abr).toBe(192);
  });

  it('returns nearest ABR when exact match does not exist', () => {
    const out = approxAudio(audioFormats, 150);
    expect(out?.abr).toBe(128);
  });

  it('breaks ties by choosing higher ABR', () => {
    const formats: MediaFormat[] = [
      { id: '100', abr: 100, videoCodecs: [] },
      { id: '120', abr: 120, videoCodecs: [] },
    ];
    const out = approxAudio(formats, 110);
    expect(out?.abr).toBe(120);
  });

  it('returns undefined when no audio formats exist', () => {
    expect(approxAudio([], 128)).toBeUndefined();
  });
});

describe('approxVideo', () => {
  const videoFormats: MediaFormat[] = [
    { id: '360p30', videoCodecs: [], height: 360, fps: 30 },
    { id: '480p30', videoCodecs: [], height: 480, fps: 30 },
    { id: '720p30', videoCodecs: [], height: 720, fps: 30 },
    { id: '720p60', videoCodecs: [], height: 720, fps: 60 },
    { id: '1080p30', videoCodecs: [], height: 1080, fps: 30 },
    { id: '1080p60', videoCodecs: [], height: 1080, fps: 60 },
  ];

  it('returns highest quality (max height, max fps) when no target is given', () => {
    const out = approxVideo(videoFormats);
    expect(out?.height).toBe(1080);
    expect(out?.fps).toBe(60);
  });

  it('returns exact height match with highest fps when only targetHeight is given', () => {
    const out = approxVideo(videoFormats, 720);
    expect(out?.height).toBe(720);
    expect(out?.fps).toBe(60);
  });

  it('returns exact height + nearest fps when both are given', () => {
    const out = approxVideo(videoFormats, 720, 50);
    expect(out?.height).toBe(720);
    expect(out?.fps).toBe(60);
  });

  it('returns nearest height when no exact height match exists', () => {
    const out = approxVideo(videoFormats, 800);
    expect(out?.height).toBe(720);
  });

  it('returns nearest combination when targetHeight and targetFps both differ', () => {
    const out = approxVideo(videoFormats, 1000, 40);
    expect(out?.height).toBe(1080);
    expect(out?.fps).toBe(30);
  });

  it('returns undefined when no video formats exist', () => {
    expect(approxVideo([], 1080)).toBeUndefined();
  });
});
