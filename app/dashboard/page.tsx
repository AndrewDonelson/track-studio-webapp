'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  // Current Status
  total_songs: number;
  total_videos: number;
  queued_items: number;
  processing_items: number;
  completed_today: number;
  errors_today: number;
  
  // Analytics
  ytd_min_processing_time: string;
  ytd_max_processing_time: string;
  ytd_avg_processing_time: string;
  ytd_total_videos: number;
  ytd_success_rate: number;
  ytd_total_errors: number;
  
  // Recent Activity
  recent_videos: RecentVideo[];
  recent_errors: RecentError[];
  genre_distribution: GenreStats[];
}

interface RecentVideo {
  id: number;
  song_id: number;
  title: string;
  artist: string;
  processing_time: string;
  completed_at: string;
}

interface RecentError {
  id: number;
  song_id: number;
  title: string;
  error_message: string;
  failed_at: string;
}

interface GenreStats {
  genre: string;
  count: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<RecentError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = async () => {
    if (selectedError) {
      await navigator.clipboard.writeText(selectedError.error_message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
        <div className="flex justify-center items-center h-96">
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
        <div className="flex justify-center items-center h-96">
          <div className="text-xl text-red-500">{error || 'No data available'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">TrackStudio Dashboard</h1>

        {/* Current Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Total Songs</div>
            <div className="text-3xl font-bold">{stats.total_songs}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Total Videos</div>
            <div className="text-3xl font-bold text-blue-400">{stats.total_videos}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Queued Items</div>
            <div className="text-3xl font-bold text-yellow-400">{stats.queued_items}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Processing Now</div>
            <div className="text-3xl font-bold text-purple-400">{stats.processing_items}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Completed Today</div>
            <div className="text-3xl font-bold text-green-400">{stats.completed_today}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-2">Errors Today</div>
            <div className="text-3xl font-bold text-red-400">{stats.errors_today}</div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-bold mb-4">Year-to-Date Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">Total Videos</div>
              <div className="text-xl font-bold">{stats.ytd_total_videos}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">Min Time</div>
              <div className="text-xl font-bold text-green-400">{stats.ytd_min_processing_time}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">Avg Time</div>
              <div className="text-xl font-bold text-blue-400">{stats.ytd_avg_processing_time}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">Max Time</div>
              <div className="text-xl font-bold text-orange-400">{stats.ytd_max_processing_time}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">Success Rate</div>
              <div className="text-xl font-bold text-green-400">{stats.ytd_success_rate.toFixed(1)}%</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm mb-1">Total Errors</div>
              <div className="text-xl font-bold text-red-400">{stats.ytd_total_errors}</div>
            </div>
          </div>
        </div>

        {/* Genre Distribution */}
        {stats.genre_distribution && stats.genre_distribution.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-2xl font-bold mb-4">Genre Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.genre_distribution.map((genre, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{genre.count}</div>
                  <div className="text-sm text-gray-400">{genre.genre || 'Unknown'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Videos & Errors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Videos */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Recent Videos</h2>
            {stats.recent_videos && stats.recent_videos.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_videos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/videos/${video.id}`}
                    className="block p-3 bg-gray-700 rounded hover:bg-gray-600 transition"
                  >
                    <div className="font-semibold">{video.title}</div>
                    <div className="text-sm text-gray-400">{video.artist}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {video.processing_time} • {new Date(video.completed_at).toLocaleString()}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">No videos yet</div>
            )}
          </div>

          {/* Recent Errors */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Recent Errors</h2>
            {stats.recent_errors && stats.recent_errors.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_errors.map((error) => (
                  <div
                    key={error.id}
                    onClick={() => setSelectedError(error)}
                    className="p-3 bg-red-900/20 border border-red-800 rounded cursor-pointer hover:bg-red-900/30 transition"
                  >
                    <div className="font-semibold text-red-400">{error.title}</div>
                    <div className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {error.error_message.split('\n')[0].substring(0, 100)}
                      {error.error_message.length > 100 ? '...' : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(error.failed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">No errors 🎉</div>
            )}
          </div>
        </div>

        {/* Error Details Dialog */}
        {selectedError && (
          <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedError(null)}
          >
            <div 
              className="bg-gray-800 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-red-400 mb-2">Error Details</h3>
                  <div className="text-lg font-semibold">{selectedError.title}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Failed at: {new Date(selectedError.failed_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-gray-400 hover:text-white text-2xl leading-none px-2"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-gray-900 rounded p-4 font-mono text-sm whitespace-pre-wrap break-words">
                  {selectedError.error_message}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-700 flex justify-between">
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <span>✓</span>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Copy Error</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedError(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
