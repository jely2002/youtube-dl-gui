export interface MusicDnaRequest {
  songUrl: string;
  title?: string;
  artist?: string;
  description?: string;
  durationSeconds?: number;
}

export interface MusicDnaSuggestion {
  title: string;
  artist: string;
  url?: string | null;
  rationale: string;
  confidence: number;
  tags: string[];
}

export interface MusicDnaResponse {
  suggestions: MusicDnaSuggestion[];
  lowConfidence: boolean;
  sourceModel: string;
}
