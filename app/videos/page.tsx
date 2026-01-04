'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface VideoItem {
  id: number;
  song_id: number;
  title: string;
  artist: string;
  video_file_path: string;
  thumbnail_path: string;
  duration: number;
  bpm: number;
  key: string;
  completed_at: string;
}

export default function VideosGalleryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoItem[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastVideoRef = useRef<HTMLDivElement | null>(null);

  const VIDEOS_PER_PAGE = 12;

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const [queueData, songsData] = await Promise.all([
        api.getQueue(),
        api.getSongs()
      ]);

      // Get completed queue items with video files
      const completedQueue = queueData.filter(
        (item) => item.status === 'completed' && item.video_file_path
      );

      // Map to video items with song details
      const videoItems: VideoItem[] = completedQueue.map((qItem) => {
        const song = songsData.find((s) => s.id === qItem.song_id);
        const filename = qItem.video_file_path.split('/').pop() || '';
        
        return {
          id: qItem.id,
          song_id: qItem.song_id,
          title: song?.title || `Song ${qItem.song_id}`,
          artist: song?.artist_name || 'Unknown Artist',
          video_file_path: filename,
          thumbnail_path: qItem.thumbnail_path || '',
          duration: song?.duration_seconds || 0,
          bpm: song?.bpm || 0,
          key: song?.key || '',
          completed_at: qItem.completed_at || ''
        };
      });

      // Sort by completion date (newest first)
      videoItems.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      setVideos(videoItems);
      setFilteredVideos(videoItems);
      setDisplayedVideos(videoItems.slice(0, VIDEOS_PER_PAGE));
      setHasMore(videoItems.length > VIDEOS_PER_PAGE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  // Search and autocomplete
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredVideos(videos);
      setSuggestions([]);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = videos.filter(
        (video) =>
          video.title.toLowerCase().includes(term) ||
          video.artist.toLowerCase().includes(term)
      );
      setFilteredVideos(filtered);

      // Generate autocomplete suggestions
      const uniqueSuggestions = new Set<string>();
      videos.forEach((video) => {
        if (video.title.toLowerCase().includes(term)) {
          uniqueSuggestions.add(video.title);
        }
        if (video.artist.toLowerCase().includes(term)) {
          uniqueSuggestions.add(video.artist);
        }
      });
      setSuggestions(Array.from(uniqueSuggestions).slice(0, 5));
    }

    // Reset pagination when search changes
    setPage(1);
    setDisplayedVideos(filteredVideos.slice(0, VIDEOS_PER_PAGE));
    setHasMore(filteredVideos.length > VIDEOS_PER_PAGE);
  }, [searchTerm, videos]);

  // Update displayed videos when filtered changes
  useEffect(() => {
    setDisplayedVideos(filteredVideos.slice(0, page * VIDEOS_PER_PAGE));
    setHasMore(filteredVideos.length > page * VIDEOS_PER_PAGE);
  }, [filteredVideos, page]);

  // Infinite scroll observer
  const loadMoreVideos = useCallback(() => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMoreVideos();
      }
    });

    if (lastVideoRef.current) {
      observerRef.current.observe(lastVideoRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loadMoreVideos]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading && videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading videos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={loadVideos}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Gallery</h1>
          <p className="text-gray-400 mt-1">
            {filteredVideos.length} completed video{filteredVideos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/songs"
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          📝 Manage Songs
        </Link>
      </div>

      {/* Search with Autocomplete */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search videos by title or artist..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-3 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
        
        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchTerm(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-700 transition first:rounded-t-lg last:rounded-b-lg"
              >
                🔍 {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video Grid */}
      {displayedVideos.length === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-4xl mb-4">🎬</div>
          <p className="text-gray-400">
            {searchTerm ? 'No videos found matching your search' : 'No completed videos yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedVideos.map((video, idx) => (
              <div
                key={video.id}
                ref={idx === displayedVideos.length - 1 ? lastVideoRef : null}
                className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition group"
              >
                {/* Thumbnail */}
                <Link href={`/videos/${video.id}`} className="block relative aspect-video bg-gray-900">
                  <video
                    src={`http://localhost:8080/videos/${video.video_file_path}`}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
                    </div>
                  </div>
                  {video.duration > 0 && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-medium">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <Link href={`/videos/${video.id}`}>
                    <h3 className="font-semibold text-lg line-clamp-2 hover:text-blue-400 transition">
                      {video.title}
                    </h3>
                  </Link>
                  <p className="text-gray-400 text-sm">{video.artist}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(video.completed_at)}</span>
                    <div className="flex gap-2">
                      {video.bpm > 0 && (
                        <span className="px-2 py-1 bg-gray-700 rounded">
                          {video.bpm.toFixed(0)} BPM
                        </span>
                      )}
                      {video.key && (
                        <span className="px-2 py-1 bg-gray-700 rounded">
                          {video.key}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/videos/${video.id}`}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-center text-sm transition"
                    >
                      ▶ Watch
                    </Link>
                    <Link
                      href={`/songs/${video.song_id}`}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                      title="Edit song"
                    >
                      ✎
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Loading indicator for infinite scroll */}
          {hasMore && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="text-gray-400 mt-2">Loading more videos...</p>
            </div>
          )}

          {!hasMore && displayedVideos.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              No more videos to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
