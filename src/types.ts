export interface Analysis {
  id: string;
  name: string;
  source_type: 'file' | 'youtube';
  file_name: string | null;
  file_path: string | null;
  file_size: number;
  youtube_url: string | null;
  youtube_title: string | null;
  youtube_thumbnail: string | null;
  duration_seconds: number;
  genre: string;
  language: string;
  sensitivity: 'low' | 'normal' | 'high';
  detect_unknown: number;
  detailed_intervals: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_step: number;
  step_label: string;
  progress: number;
  total_segments: number;
  analyzed_segments: number;
  identified_tracks_count: number;
  unidentified_tracks_count: number;
  avg_confidence: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Track {
  id: number;
  analysis_id: string;
  track_number: number;
  title: string;
  artist: string;
  album: string | null;
  release_year: string | null;
  genre: string | null;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  confidence: number;
  is_identified: number;
  is_manual: number;
  mbid: string | null;
  acoustid_id: string | null;
  notes: string | null;
}

export interface Segment {
  id: number;
  analysis_id: string;
  segment_index: number;
  start_sec: number;
  end_sec: number;
  fingerprint: string | null;
  matched_title: string | null;
  matched_artist: string | null;
  matched_album: string | null;
  matched_mbid: string | null;
  confidence: number;
  status: 'pending' | 'completed';
}

export interface DashboardData {
  stats: {
    totalAnalyses: number;
    totalIdentifiedTracks: number;
    totalDurationSeconds: number;
    recognitionRate: number;
    avgConfidence: number;
  };
  recentAnalyses: Analysis[];
  recentActivity: (Track & { analysis_name: string })[];
  chartData: {
    label: string;
    analyses: number;
    tracks: number;
  }[];
}
