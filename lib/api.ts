// API client for TrackStudio orchestrator
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export interface Song {
  id: number;
  album_id: number | null;
  title: string;
  artist_name: string;
  genre: string;
  lyrics: string;
  lyrics_karaoke?: string;
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
  flag: string | null;
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

export interface GeneratedImage {
  id: number;
  song_id: number;
  queue_id?: number;
  image_path: string;
  prompt: string;
  negative_prompt: string;
  image_type: string;
  sequence_number?: number;
  width: number;
  height: number;
  model: string;
  created_at: string;
}

class APIClient {
  private baseURL: string;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private isHealthy: boolean = true;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const healthURL = this.baseURL.replace('/api/v1', '/health');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const res = await fetch(healthURL, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isHealthy = res.ok;
      this.lastHealthCheck = Date.now();
      return res.ok;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  private async ensureHealthy(): Promise<void> {
    // Check if we need to do a health check
    const now = Date.now();
    if (now - this.lastHealthCheck > this.healthCheckInterval || !this.isHealthy) {
      const healthy = await this.checkHealth();
      if (!healthy) {
        throw new Error('Orchestrator API is not available. Please check if the server is running on port 8080.');
      }
    } else if (!this.isHealthy) {
      throw new Error('Orchestrator API is not available. Please check if the server is running on port 8080.');
    }
  }

  // Songs
  async getSongs(): Promise<Song[]> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs`);
    if (!res.ok) throw new Error('Failed to fetch songs');
    const data = await res.json();
    return data.songs || [];
  }

  async getSong(id: number): Promise<Song> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch song');
    return res.json();
  }

  async createSong(song: Partial<Song>): Promise<Song> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) throw new Error('Failed to create song');
    return res.json();
  }

  async updateSong(id: number, song: Partial<Song>): Promise<Song> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) throw new Error('Failed to update song');
    return res.json();
  }

  async deleteSong(id: number): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete song');
  }

  async analyzeSong(id: number): Promise<Song> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}/analyze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to analyze audio');
    const data = await res.json();
    return data.song;
  }

  async uploadAudio(id: number, vocalsFile?: File, musicFile?: File): Promise<Song> {
    await this.ensureHealthy();
    const formData = new FormData();
    
    if (vocalsFile) {
      formData.append('vocals', vocalsFile);
    }
    
    if (musicFile) {
      formData.append('music', musicFile);
    }
    
    const res = await fetch(`${this.baseURL}/songs/${id}/upload-audio`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) throw new Error('Failed to upload audio files');
    const data = await res.json();
    return data.song;
  }

  // Queue
  async getQueue(): Promise<QueueItem[]> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue`);
    if (!res.ok) throw new Error('Failed to fetch queue');
    const data = await res.json();
    // Handle various response formats
    const queue = data.queue_items || data.items || data.queue || data;
    // Ensure we always return an array
    return Array.isArray(queue) ? queue : [];
  }

  async getQueueItem(id: number): Promise<QueueItem> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue/${id}`);
    if (!res.ok) throw new Error('Failed to fetch queue item');
    return res.json();
  }

  async addToQueue(songId: number, priority: number = 0): Promise<QueueItem> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId, priority }),
    });
    if (!res.ok) throw new Error('Failed to add to queue');
    return res.json();
  }

  async updateQueueItem(id: number, updates: Partial<QueueItem>): Promise<QueueItem> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update queue item');
    return res.json();
  }

  async deleteQueueItem(id: number): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete queue item');
  }

  async updateQueueFlag(id: number, flag: string | null): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/queue/${id}/flag`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag }),
    });
    if (!res.ok) throw new Error('Failed to update queue flag');
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

  // Images
  async getImagesBySong(songId: number): Promise<GeneratedImage[]> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${songId}/images`);
    if (!res.ok) throw new Error('Failed to fetch images');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async createImagePrompt(songId: number, imageData: Partial<GeneratedImage>): Promise<GeneratedImage> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${songId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData),
    });
    if (!res.ok) throw new Error('Failed to create image prompt');
    return await res.json();
  }

  async updateImagePrompt(imageId: number, prompt: string, negativePrompt: string): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/images/${imageId}/prompt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, negative_prompt: negativePrompt }),
    });
    if (!res.ok) throw new Error('Failed to update image prompt');
  }

  async regenerateImage(imageId: number): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/images/${imageId}/regenerate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to regenerate image');
  }

  async generatePromptFromLyrics(
    lyricsText: string,
    sectionType: string,
    genre: string,
    backgroundStyle: string
  ): Promise<{ prompt: string; negative_prompt: string }> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/images/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lyrics: lyricsText,
        section_type: sectionType,
        genre,
        background_style: backgroundStyle,
      }),
    });
    if (!res.ok) throw new Error('Failed to generate prompt');
    return await res.json();
  }

  async deleteAllImagesBySong(songId: number): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${songId}/images`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete images');
  }
}

export const api = new APIClient();
