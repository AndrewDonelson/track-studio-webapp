'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface VideoDetails {
  queue_id: number;
  song_id: number;
  title: string;
  artist: string;
  genre: string;
  lyrics: string;
  video_file_path: string;
  thumbnail_path: string;
  duration: number;
  bpm: number;
  key: string;
  tempo: string;
  completed_at: string;
  processing_time: number;
  file_size: number;
}

export default function VideoPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const queueId = parseInt(id);
  
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideo();
  }, [queueId]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const [queueItem, allSongs] = await Promise.all([
        api.getQueueItem(queueId),
        api.getSongs()
      ]);

      const song = allSongs.find((s) => s.id === queueItem.song_id);
      
      if (!song) {
        throw new Error('Song not found');
      }

      const filename = queueItem.video_file_path.split('/').pop() || '';
      
      // Calculate processing time
      let processingTime = 0;
      if (queueItem.started_at && queueItem.completed_at) {
        const start = new Date(queueItem.started_at).getTime();
        const end = new Date(queueItem.completed_at).getTime();
        processingTime = Math.round((end - start) / 1000);
      }

      setVideo({
        queue_id: queueItem.id,
        song_id: song.id,
        title: song.title,
        artist: song.artist_name,
        genre: song.genre,
        lyrics: song.lyrics,
        video_file_path: filename,
        thumbnail_path: queueItem.thumbnail_path || '',
        duration: song.duration_seconds,
        bpm: song.bpm,
        key: song.key,
        tempo: song.tempo,
        completed_at: queueItem.completed_at || '',
        processing_time: processingTime,
        file_size: queueItem.video_file_size || 0
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error: {error || 'Video not found'}</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => router.push('/videos')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition"
          >
            Back to Gallery
          </button>
          <button
            onClick={loadVideo}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/videos')}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
      >
        ← Back to Gallery
      </button>

      {/* Video Player */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <video
          src={`http://localhost:8080/videos/${video.video_file_path}`}
          controls
          autoPlay
          className="w-full aspect-video bg-black"
        >
          Your browser does not support video playback.
        </video>
      </div>

      {/* Video Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-2">{video.title}</h1>
            <p className="text-xl text-gray-300 mb-4">{video.artist}</p>
            
            {video.genre && (
              <span className="inline-block px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm">
                {video.genre}
              </span>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href={`/songs/${video.song_id}`}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition font-medium"
              >
                ✎ Edit Song
              </Link>
              <button
                onClick={() => {
                  const url = `http://localhost:8080/videos/${video.video_file_path}`;
                  window.open(url, '_blank');
                }}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition font-medium"
              >
                💾 Download Video
              </button>
            </div>
          </div>

          {/* Lyrics */}
          {video.lyrics && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Lyrics</h2>
              <div className="text-gray-300 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
                {video.lyrics}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Stats */}
        <div className="space-y-6">
          {/* Audio Analysis */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Audio Analysis</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-400">Duration</div>
                <div className="text-2xl font-bold">{formatDuration(video.duration)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">BPM</div>
                <div className="text-2xl font-bold">{video.bpm > 0 ? video.bpm.toFixed(1) : 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Key</div>
                <div className="text-2xl font-bold">{video.key || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Tempo</div>
                <div className="text-2xl font-bold">{video.tempo || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Rendering Info */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Rendering Info</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400">File Size</div>
                <div className="font-medium">{formatFileSize(video.file_size)}</div>
              </div>
              <div>
                <div className="text-gray-400">Processing Time</div>
                <div className="font-medium">{formatDuration(video.processing_time)}</div>
              </div>
              <div>
                <div className="text-gray-400">Completed</div>
                <div className="font-medium">
                  {new Date(video.completed_at).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Queue ID</div>
                <div className="font-medium">#{video.queue_id}</div>
              </div>
              <div>
                <div className="text-gray-400">Song ID</div>
                <div className="font-medium">#{video.song_id}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
