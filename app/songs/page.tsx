'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Song } from '@/lib/api';

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [videoMap, setVideoMap] = useState<Record<number, string>>({});
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
    loadCompletedVideos();
  }, []);

  const loadCompletedVideos = async () => {
    try {
      const queue = await api.getQueue();
      const videos: Record<number, string> = {};
      queue.forEach(item => {
        if (item.status === 'completed' && item.video_file_path) {
          // Extract just the filename from the full path
          const filename = item.video_file_path.split('/').pop() || '';
          videos[item.song_id] = filename;
        }
      });
      setVideoMap(videos);
    } catch (err) {
      console.error('Failed to load video paths:', err);
    }
  };

  const loadSongs = async () => {
    try {
      setLoading(true);
      const data = await api.getSongs();
      
      // Deduplicate songs by title + artist_name (keep the one with higher ID)
      const uniqueSongs = data.reduce((acc: Song[], song) => {
        const existing = acc.find(s => 
          s.title.toLowerCase() === song.title.toLowerCase() && 
          s.artist_name.toLowerCase() === song.artist_name.toLowerCase()
        );
        
        if (!existing) {
          acc.push(song);
        } else if (song.id > existing.id) {
          // Replace with newer version (higher ID)
          const index = acc.indexOf(existing);
          acc[index] = song;
        }
        
        return acc;
      }, []);
      
      setSongs(uniqueSongs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this song?')) return;

    try {
      setDeletingId(id);
      await api.deleteSong(id);
      setSongs(songs.filter(s => s.id !== id));
    } catch (err) {
      alert('Failed to delete song: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddToQueue = async (songId: number) => {
    try {
      await api.addToQueue(songId, 5);
      alert('Song added to queue!');
    } catch (err) {
      alert('Failed to add to queue: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const hasVideo = (song: Song) => {
    return videoMap[song.id] !== undefined;
  };

  const hasAudio = (song: Song) => {
    return (song.vocals_stem_path && song.vocals_stem_path.length > 0) || 
           (song.music_stem_path && song.music_stem_path.length > 0);
  };

  const isComplete = (song: Song) => {
    // A song is complete if it has been rendered and has a video file
    return videoMap[song.id] !== undefined;
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.artist_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading songs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={loadSongs}
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
          <h1 className="text-3xl font-bold">Songs</h1>
          <p className="text-gray-400 mt-1">
            {songs.length} total • {songs.filter(isComplete).length} complete • {songs.filter(hasAudio).length} with audio
          </p>
        </div>
        <Link
          href="/songs/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition font-medium"
        >
          + Create New Song
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by title or artist..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
      </div>

      {/* Songs Grid */}
      {filteredSongs.length === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-4xl mb-4">🎵</div>
          <p className="text-gray-400">
            {searchTerm ? 'No songs found matching your search' : 'No songs yet. Create your first song!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-2xl">{song.title}</h3>
                    <span className="text-sm px-2 py-1 bg-blue-900/30 text-blue-400 rounded">
                      ID: {song.id}
                    </span>
                    {hasVideo(song) && (
                      <span className="text-sm px-2 py-1 bg-green-900/30 text-green-400 rounded">
                        ✓ Video
                      </span>
                    )}
                    {hasAudio(song) && (
                      <span className="text-sm px-2 py-1 bg-purple-900/30 text-purple-400 rounded">
                        ♪ Audio
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-lg">{song.artist_name}</p>
                  {song.genre && (
                    <p className="text-gray-500 text-sm mt-1">{song.genre}</p>
                  )}
                </div>
              </div>

              {/* Song Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <div className="text-gray-500">Duration</div>
                  <div className="text-white font-medium">
                    {song.duration_seconds > 0
                      ? `${Math.floor(song.duration_seconds / 60)}:${(song.duration_seconds % 60).toFixed(0).padStart(2, '0')}`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">BPM</div>
                  <div className="text-white font-medium">
                    {song.bpm > 0 ? song.bpm.toFixed(1) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Key</div>
                  <div className="text-white font-medium">{song.key || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Tempo</div>
                  <div className="text-white font-medium">{song.tempo || 'N/A'}</div>
                </div>
              </div>

              {/* File Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 text-xs">
                <div className={`p-2 rounded ${song.vocals_stem_path ? 'bg-green-900/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                  {song.vocals_stem_path ? '✓ Vocals' : '✗ No vocals'}
                </div>
                <div className={`p-2 rounded ${song.music_stem_path ? 'bg-green-900/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                  {song.music_stem_path ? '✓ Music' : '✗ No music'}
                </div>
                <div className={`p-2 rounded ${isComplete(song) ? 'bg-blue-900/20 text-blue-400 font-semibold' : 'bg-gray-700 text-gray-500'}`}>
                  {isComplete(song) ? '✓ Video Ready' : '○ Not rendered'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/songs/${song.id}`}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                >
                  ✎ Edit
                </Link>
                {isComplete(song) ? (
                  <button
                    onClick={() => setPreviewVideo(videoMap[song.id])}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition"
                    title="Preview video"
                  >
                    ▶ Preview
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddToQueue(song.id)}
                    disabled={!hasAudio(song)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasAudio(song) ? 'No audio files available' : 'Add to render queue'}
                  >
                    ⚡ Render
                  </button>
                )}
                <button
                  onClick={() => handleDelete(song.id)}
                  disabled={deletingId === song.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition disabled:opacity-50"
                >
                  {deletingId === song.id ? '...' : '🗑 Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div 
            className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Video Preview</h3>
              <button
                onClick={() => setPreviewVideo(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <video 
                src={`http://localhost:8080/videos/${previewVideo}`}
                controls 
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: '70vh' }}
              >
                Your browser does not support video playback.
              </video>
              <div className="mt-4 text-sm text-gray-400">
                <strong>Filename:</strong> {previewVideo}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
