'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

interface VideoDetails {
  video_id: number;
  song_id: number;
  title: string;
  artist: string;
  genre: string | null;
  video_file_path: string;
  thumbnail_path: string | null;
  duration: number;
  bpm: number | null;
  key: string | null;
  tempo: string | null;
  rendered_at: string;
  file_size: number;
  resolution: string;
}

export default function VideoPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const videoId = parseInt(id);
  
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const allVideos = await api.getAllVideos();
      const videoData = allVideos.find((v) => v.id === videoId);
      
      if (!videoData) {
        throw new Error('Video not found');
      }

      const filename = videoData.video_file_path.split('/').pop() || '';

      setVideo({
        video_id: videoData.id,
        song_id: videoData.song_id,
        title: videoData.song_title || `Song ${videoData.song_id}`,
        artist: videoData.artist_name || 'Unknown Artist',
        genre: videoData.genre || null,
        video_file_path: filename,
        thumbnail_path: videoData.thumbnail_path,
        duration: videoData.duration_seconds || 0,
        bpm: videoData.bpm ?? null,
        key: videoData.key ?? null,
        tempo: videoData.tempo ?? null,
        rendered_at: videoData.rendered_at,
        file_size: videoData.file_size_bytes,
        resolution: videoData.resolution
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
                <div className="text-2xl font-bold">{video.bpm && video.bpm > 0 ? video.bpm.toFixed(1) : 'N/A'}</div>
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
            <h2 className="text-lg font-semibold mb-4">Video Info</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400">Resolution</div>
                <div className="font-medium">{video.resolution.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-gray-400">File Size</div>
                <div className="font-medium">{formatFileSize(video.file_size)}</div>
              </div>
              <div>
                <div className="text-gray-400">Rendered</div>
                <div className="font-medium">
                  {new Date(video.rendered_at).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Video ID</div>
                <div className="font-medium">#{video.video_id}</div>
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
