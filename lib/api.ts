// API client for TrackStudio orchestrator

const LOCAL_KEY = "trackstudio_settings";
function getOrchestratorBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.orchestrator_host) {
          // Ensure trailing /api/v1 if not present
          let url = parsed.orchestrator_host;
          if (!url.endsWith('/api/v1')) {
            url = url.replace(/\/$/, '') + '/api/v1';
          }
          return url;
        }
      } catch {}
    }
    // Fallback: use current hostname if not set
    const host = window.location.hostname;
    return `http://${host}:8080/api/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
}

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
  whisper_engine?: string;
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
  
  // Karaoke customization
  karaoke_font_family?: string;
  karaoke_font_size?: number;
  karaoke_primary_color?: string;
  karaoke_primary_border_color?: string;
  karaoke_highlight_color?: string;
  karaoke_highlight_border_color?: string;
  karaoke_alignment?: number;
  karaoke_margin_bottom?: number;
  
  // AI-powered metadata enrichment
  genre_primary?: string;
  genre_secondary?: string;  // JSON array
  tags?: string;  // JSON array
  style_descriptors?: string;  // JSON array
  mood?: string;  // JSON array
  themes?: string;  // JSON array
  similar_artists?: string;  // JSON array
  summary?: string;
  target_audience?: string;
  energy_level?: string;
  vocal_style?: string;
  metadata_enriched_at?: string;
  metadata_version?: number;
  
  created_at: string;
  updated_at: string;
}

export interface SongMetadataEnrichment {
  genre_primary: string;
  genre_secondary: string[];
  tags: string[];
  style_descriptors: string[];
  mood: string[];
  themes: string[];
  similar_artists: string[];
  summary: string;
  target_audience: string;
  energy_level: string;
  vocal_style: string;
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

export interface Video {
  id: number;
  song_id: number;
  video_file_path: string;
  thumbnail_path: string | null;
  resolution: string;
  duration_seconds: number | null;
  file_size_bytes: number;
  fps: number;
  background_style: string | null;
  spectrum_color: string | null;
  has_karaoke: boolean;
  status: string;
  rendered_at: string;
  created_at: string;
  genre?: string | null;
  bpm?: number | null;
  key?: string | null;
  tempo?: string | null;
  flag?: string | null;
  song_title?: string;
  artist_name?: string;
}

export interface Settings {
  id?: number;
  master_prompt: string;
  master_negative_prompt: string;
  brand_logo_path: string;
  data_storage_path: string;
}

class APIClient {
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private isHealthy: boolean = true;

  get baseURL(): string {
    return getOrchestratorBaseUrl();
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

  async analyzeSong(id: number): Promise<{song: Song, analysis: any, enrichment?: SongMetadataEnrichment}> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}/analyze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to analyze audio');
    return await res.json();
  }

  async validateAudioPaths(id: number): Promise<{
    song_id: number;
    title: string;
    valid: boolean;
    vocals_ok?: string;
    vocals_missing?: string;
    music_ok?: string;
    music_missing?: string;
    mixed_ok?: string;
    mixed_missing?: string;
  }> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${id}/validate-paths`);
    if (!res.ok) throw new Error('Failed to validate audio paths');
    return res.json();
  }

  async uploadAudio(id: number, vocalsFile?: File, musicFile?: File): Promise<void> {
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
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to upload audio files' }));
      throw new Error(error.error || 'Failed to upload audio files');
    }
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

  // ========== Videos APIs ==========
  
  async getAllVideos(): Promise<Video[]> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/videos`);
    if (!res.ok) throw new Error('Failed to fetch videos');
    return await res.json();
  }

  async getVideosBySong(songId: number): Promise<Video[]> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/videos/song/${songId}`);
    if (!res.ok) throw new Error('Failed to fetch videos for song');
    return await res.json();
  }

  async deleteVideo(id: number): Promise<void> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/videos/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete video');
  }

  // ========== Settings APIs ==========
  
  async getSettings(): Promise<Settings> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return await res.json();
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return await res.json();
  }

  // ========== Metadata Enrichment APIs ==========
  
  async enrichSongMetadata(songId: number, forceRefresh: boolean = false): Promise<{message: string, song_id: number, enrichment: SongMetadataEnrichment}> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/songs/${songId}/enrich-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force_refresh: forceRefresh }),
    });
    if (!res.ok) throw new Error('Failed to enrich metadata');
    return await res.json();
  }

  async enrichBatch(songIds: number[], forceRefresh: boolean = false): Promise<{total: number, success: number, errors: number, results: any[]}> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/enrichment/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ song_ids: songIds, force_refresh: forceRefresh }),
    });
    if (!res.ok) throw new Error('Failed to enrich batch');
    return await res.json();
  }

  async getEnrichmentStatus(): Promise<{total_songs: number, enriched_count: number, unenriched_count: number, unenriched_songs: any[]}> {
    await this.ensureHealthy();
    const res = await fetch(`${this.baseURL}/enrichment/status`);
    if (!res.ok) throw new Error('Failed to get enrichment status');
    return await res.json();
  }
}

export const api = new APIClient();
