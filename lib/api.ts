// API client for TrackStudio orchestrator
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export interface Song {
  id: number;
  album_id: number | null;
  title: string;
  artist_name: string;
  genre: string;
  lyrics: string;
  lyrics_display: string;
  lyrics_sections: string;
  duration_seconds: number;
  bpm: number;
  key: string;
  tempo: string;
  vocals_stem_path: string;
  music_stem_path: string;
  mixed_audio_path: string;
  metadata_file_path: string;
  vocal_timing: string;
  brand_logo_path: string;
  copyright_text: string;
  background_style: string;
  spectrum_style: string;
  spectrum_color: string;
  spectrum_opacity: number;
  target_resolution: string;
  show_metadata: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: number;
  song_id: number;
  status: string;
  priority: number;
  current_step: string;
  progress: number;
  error_message: string;
  retry_count: number;
  video_file_path: string;
  video_file_size: number;
  thumbnail_path: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ProgressEvent {
  queue_id: number;
  status: string;
  progress: number;
  current_step: string;
  error_message?: string;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Songs
  async getSongs(): Promise<Song[]> {
    const res = await fetch(`${this.baseURL}/songs`);
    if (!res.ok) throw new Error('Failed to fetch songs');
    const data = await res.json();
    return data.songs || [];
  }

  async getSong(id: number): Promise<Song> {
    const res = await fetch(`${this.baseURL}/songs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch song');
    return res.json();
  }

  async createSong(song: Partial<Song>): Promise<Song> {
    const res = await fetch(`${this.baseURL}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) throw new Error('Failed to create song');
    return res.json();
  }

  async updateSong(id: number, song: Partial<Song>): Promise<Song> {
    const res = await fetch(`${this.baseURL}/songs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) throw new Error('Failed to update song');
    return res.json();
  }

  async deleteSong(id: number): Promise<void> {
    const res = await fetch(`${this.baseURL}/songs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete song');
  }

  // Queue
  async getQueue(): Promise<QueueItem[]> {
    const res = await fetch(`${this.baseURL}/queue`);
    if (!res.ok) throw new Error('Failed to fetch queue');
    const data = await res.json();
    // Handle various response formats
    const queue = data.queue_items || data.items || data.queue || data;
    // Ensure we always return an array
    return Array.isArray(queue) ? queue : [];
  }

  async getQueueItem(id: number): Promise<QueueItem> {
    const res = await fetch(`${this.baseURL}/queue/${id}`);
    if (!res.ok) throw new Error('Failed to fetch queue item');
    return res.json();
  }

  async addToQueue(songId: number, priority: number = 0): Promise<QueueItem> {
    const res = await fetch(`${this.baseURL}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId, priority }),
    });
    if (!res.ok) throw new Error('Failed to add to queue');
    return res.json();
  }

  async updateQueueItem(id: number, updates: Partial<QueueItem>): Promise<QueueItem> {
    const res = await fetch(`${this.baseURL}/queue/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update queue item');
    return res.json();
  }

  async deleteQueueItem(id: number): Promise<void> {
    const res = await fetch(`${this.baseURL}/queue/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete queue item');
  }

  // Progress streaming
  streamProgress(onProgress: (event: ProgressEvent) => void): EventSource {
    const eventSource = new EventSource(`${this.baseURL}/progress/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch (error) {
        console.error('Failed to parse progress event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    return eventSource;
  }
}

export const api = new APIClient();
