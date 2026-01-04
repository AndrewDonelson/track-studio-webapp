'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface VideoItem {
  id: number;
  song_id: number;
  title: string;
  artist: string;
  genre: string;
  video_file_path: string;
  thumbnail_path: string;
  duration: number;
  bpm: number;
  key: string;
  tempo: string;
  flag: string | null;
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

  // Filters and sorting
  const [tempoFilter, setTempoFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [flagFilter, setFlagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
          genre: song?.genre || '',
          video_file_path: filename,
          thumbnail_path: qItem.thumbnail_path || '',
          duration: song?.duration_seconds || 0,
          bpm: song?.bpm || 0,
          key: song?.key || '',
          tempo: song?.tempo || '',
          flag: qItem.flag || null,
          completed_at: qItem.completed_at || ''
        };
      });

      // Keep only the latest video for each unique song
      const uniqueVideos = new Map<number, VideoItem>();
      videoItems.forEach(video => {
        const existing = uniqueVideos.get(video.song_id);
        if (!existing || new Date(video.completed_at) > new Date(existing.completed_at)) {
          uniqueVideos.set(video.song_id, video);
        }
      });

      // Convert to array and sort by completion date (newest first)
      const uniqueVideoItems = Array.from(uniqueVideos.values());
      uniqueVideoItems.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      setVideos(uniqueVideoItems);
      setFilteredVideos(uniqueVideoItems);
      setDisplayedVideos(uniqueVideoItems.slice(0, VIDEOS_PER_PAGE));
      setHasMore(uniqueVideoItems.length > VIDEOS_PER_PAGE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  // Search and autocomplete
  useEffect(() => {
    let filtered = videos;

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (video) =>
          video.title.toLowerCase().includes(term) ||
          video.artist.toLowerCase().includes(term)
      );

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
    } else {
      setSuggestions([]);
    }

    // Tempo filter
    if (tempoFilter !== 'all') {
      filtered = filtered.filter(video => {
        if (tempoFilter === 'slow') return video.bpm > 0 && video.bpm < 90;
        if (tempoFilter === 'medium') return video.bpm >= 90 && video.bpm < 120;
        if (tempoFilter === 'fast') return video.bpm >= 120 && video.bpm < 150;
        if (tempoFilter === 'very-fast') return video.bpm >= 150;
        return true;
      });
    }

    // Genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(video => video.genre === genreFilter);
    }

    // Key filter
    if (keyFilter !== 'all') {
      filtered = filtered.filter(video => video.key === keyFilter);
    }

    // Flag filter
    if (flagFilter !== 'all') {
      if (flagFilter === 'flagged') {
        filtered = filtered.filter(video => video.flag !== null);
      } else if (flagFilter === 'unflagged') {
        filtered = filtered.filter(video => video.flag === null);
      } else {
        filtered = filtered.filter(video => video.flag === flagFilter);
      }
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
        case 'oldest':
          return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'artist-asc':
          return a.artist.localeCompare(b.artist);
        default:
          return 0;
      }
    });

    setFilteredVideos(filtered);

    // Reset pagination when filters change
    setPage(1);
    setDisplayedVideos(filtered.slice(0, VIDEOS_PER_PAGE));
    setHasMore(filtered.length > VIDEOS_PER_PAGE);
  }, [searchTerm, videos, tempoFilter, genreFilter, keyFilter, flagFilter, sortBy]);

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

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFlagVideo = async (videoId: number, flag: string | null) => {
    try {
      await api.updateQueueFlag(videoId, flag);
      
      // Update local state
      setVideos(videos.map(v => v.id === videoId ? { ...v, flag } : v));
      
      const flagLabel = flag 
        ? flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'cleared';
      showNotification(`Video flag ${flagLabel}`, 'success');
    } catch (err) {
      showNotification('Failed to update flag', 'error');
    }
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
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in-right ${
            notification.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

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

      {/* Filters and Sort */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Tempo Filter */}
        <select
          value={tempoFilter}
          onChange={(e) => setTempoFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Tempos</option>
          <option value="slow">Slow (&lt;90 BPM)</option>
          <option value="medium">Medium (90-119 BPM)</option>
          <option value="fast">Fast (120-149 BPM)</option>
          <option value="very-fast">Very Fast (≥150 BPM)</option>
        </select>

        {/* Genre Filter */}
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Genres</option>
          <option value="Rock">Rock</option>
          <option value="Pop">Pop</option>
          <option value="Hip-Hop">Hip-Hop</option>
          <option value="Electronic">Electronic</option>
          <option value="R&B">R&B</option>
          <option value="Country">Country</option>
          <option value="Jazz">Jazz</option>
          <option value="Classical">Classical</option>
          <option value="Metal">Metal</option>
          <option value="Folk">Folk</option>
          <option value="Blues">Blues</option>
          <option value="Reggae">Reggae</option>
          <option value="Indie">Indie</option>
          <option value="Alternative">Alternative</option>
          <option value="Soul">Soul</option>
          <option value="Funk">Funk</option>
          <option value="Punk">Punk</option>
          <option value="Gospel">Gospel</option>
          <option value="Latin">Latin</option>
          <option value="World">World</option>
        </select>

        {/* Key Filter */}
        <select
          value={keyFilter}
          onChange={(e) => setKeyFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Keys</option>
          <option value="C major">C major</option>
          <option value="C minor">C minor</option>
          <option value="C# major">C# major</option>
          <option value="C# minor">C# minor</option>
          <option value="D major">D major</option>
          <option value="D minor">D minor</option>
          <option value="D# major">D# major</option>
          <option value="D# minor">D# minor</option>
          <option value="E major">E major</option>
          <option value="E minor">E minor</option>
          <option value="F major">F major</option>
          <option value="F minor">F minor</option>
          <option value="F# major">F# major</option>
          <option value="F# minor">F# minor</option>
          <option value="G major">G major</option>
          <option value="G minor">G minor</option>
          <option value="G# major">G# major</option>
          <option value="G# minor">G# minor</option>
          <option value="A major">A major</option>
          <option value="A minor">A minor</option>
          <option value="A# major">A# major</option>
          <option value="A# minor">A# minor</option>
          <option value="B major">B major</option>
          <option value="B minor">B minor</option>
        </select>

        {/* Flag Filter */}
        <select
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Flags</option>
          <option value="unflagged">Unflagged</option>
          <option value="flagged">Any Flag</option>
          <option value="image_issue">Image Issue</option>
          <option value="lyrics_issue">Lyrics Issue</option>
          <option value="timing_issue">Timing Issue</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
          <option value="artist-asc">Artist A-Z</option>
        </select>
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

                  {/* Flag indicator */}
                  {video.flag && (
                    <div className="text-xs">
                      <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded border border-yellow-600/30">
                        🚩 {video.flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {/* Flag Dropdown */}
                    <select
                      value={video.flag || ''}
                      onChange={(e) => handleFlagVideo(video.id, e.target.value || null)}
                      className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Flag video issue"
                    >
                      <option value="">🏴 No Flag</option>
                      <option value="image_issue">🖼️ Image Issue</option>
                      <option value="lyrics_issue">🎤 Lyrics Issue</option>
                      <option value="timing_issue">⏱️ Timing Issue</option>
                    </select>

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
