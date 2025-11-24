import { MediaFormat, MediaItem } from './media';

export type Group = {
  id: string;
  total: number;
  processed: number;
  errored: number;
  isCombined: boolean;
  items: Record<string, MediaItem>;
  entries?: never[];
  url?: string;
  title?: string;
  thumbnail?: string;
  description?: string;
  uploader?: string;
  extractor?: string;
  views?: number;
  comments?: number;
  likes?: number;
  dislikes?: number;
  rating?: number;
  duration?: number;
  audioCodecs: string[];
  formats: MediaFormat[];
  filesize: number;
};
