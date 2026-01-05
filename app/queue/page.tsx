'use client';

import { useState, useEffect } from 'react';
import { api, QueueItem, ProgressEvent } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

interface ConfirmDialog {
  message: string;
  onConfirm: () => void;
}

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<number, ProgressEvent>>(() => {
    // Load progress from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queue_progress');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const showNotification = (type: NotificationType, message: string) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('queue_progress', JSON.stringify(progressMap));
    }
  }, [progressMap]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000); // Refresh every 5 seconds
    
    // Subscribe to progress events
    const eventSource = api.streamProgress((event) => {
      setProgressMap(prev => ({
        ...prev,
        [event.queue_id]: event
      }));
      
      // Refresh queue when a job completes
      if (event.status === 'completed' || event.status === 'failed') {
        loadQueue();
        // Clean up completed jobs from progress map after a delay
        setTimeout(() => {
          setProgressMap(prev => {
            const next = { ...prev };
            delete next[event.queue_id];
            return next;
          });
        }, 10000);
      }
    });

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const loadQueue = async () => {
    try {
      setLoading(false); // Don't show loading after first load
      const data = await api.getQueue();
      // API client now ensures we always get an array
      // Sort by ID descending (newest first)
      const sorted = [...data].sort((a, b) => b.id - a.id);
      setQueue(sorted);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
      setQueue([]); // Set empty array on error
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-900/30';
      case 'processing': return 'text-blue-400 bg-blue-900/30';
      case 'failed': return 'text-red-400 bg-red-900/30';
      case 'pending': return 'text-yellow-400 bg-yellow-900/30';
      default: return 'text-gray-400 bg-gray-700';
    }
  };

  const getProgressPercent = (item: QueueItem) => {
    const progress = progressMap[item.id];
    if (progress) {
      return progress.progress;
    }
    return item.progress || 0;
  };

  const getCurrentStep = (item: QueueItem) => {
    const progress = progressMap[item.id];
    if (progress) {
      return progress.current_step;
    }
    return item.current_step || '';
  };

  const handleCancel = async (queueId: number) => {
    showConfirm('Cancel this queue item? This will stop processing and clean up temporary files.', async () => {
      try {
        setCancelling(queueId);
        await api.deleteQueueItem(queueId);
        await loadQueue();
        showNotification('success', 'Queue item cancelled successfully');
      } catch (err) {
        showNotification('error', 'Failed to cancel: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setCancelling(null);
      }
    });
  };

  const handleDelete = async (queueId: number) => {
    try {
      setCancelling(queueId);
      await api.deleteQueueItem(queueId);
      await loadQueue();
      showNotification('success', 'Queue item deleted successfully');
    } catch (err) {
      showNotification('error', 'Failed to delete: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCancelling(null);
    }
  };

  const handleClearCompleted = async () => {
    const completedItems = queue.filter(q => q.status === 'completed' || q.status === 'failed');
    if (completedItems.length === 0) {
      showNotification('info', 'No completed or failed items to clear');
      return;
    }

    showConfirm(`Clear all ${completedItems.length} completed/failed items?`, async () => {
      try {
        setClearingAll(true);
        await Promise.all(completedItems.map(item => api.deleteQueueItem(item.id)));
        await loadQueue();
        showNotification('success', `Cleared ${completedItems.length} items successfully`);
      } catch (err) {
        showNotification('error', 'Failed to clear items: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setClearingAll(false);
      }
    });
  };

  const getElapsedTime = (startedAt: string) => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (loading && queue.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={loadQueue}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`px-6 py-4 rounded-lg shadow-lg border animate-slide-in-right ${
              notification.type === 'success'
                ? 'bg-green-900/90 border-green-500 text-green-100'
                : notification.type === 'error'
                ? 'bg-red-900/90 border-red-500 text-red-100'
                : 'bg-blue-900/90 border-blue-500 text-blue-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
              </span>
              <span>{notification.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">Confirm Action</h3>
            <p className="text-gray-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue</h1>
          <p className="text-gray-400 mt-1">
            {queue.filter(q => q.status === 'processing').length} processing • {' '}
            {queue.filter(q => q.status === 'pending').length} pending • {' '}
            {queue.filter(q => q.status === 'completed').length} completed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearCompleted}
            disabled={clearingAll || queue.filter(q => q.status === 'completed' || q.status === 'failed').length === 0}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearingAll ? 'Clearing...' : '🧹 Clear Completed'}
          </button>
          <button
            onClick={loadQueue}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Queue List */}
      {queue.length === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-gray-400">No items in queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const progress = getProgressPercent(item);
            const currentStep = getCurrentStep(item);
            
            return (
              <div
                key={item.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-xl">Song ID: {item.song_id}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">Queue ID: #{item.id}</p>
                  </div>
                  
                  {/* Cancel/Delete Button */}
                  {item.status === 'processing' || item.status === 'pending' ? (
                    <button
                      onClick={() => handleCancel(item.id)}
                      disabled={cancelling === item.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {cancelling === item.id ? '...' : '✕ Cancel'}
                    </button>
                  ) : item.status === 'completed' ? (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={cancelling === item.id}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {cancelling === item.id ? '...' : '🗑 Delete'}
                    </button>
                  ) : null}
                </div>

                {/* Progress Bar */}
                {item.status === 'processing' && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 font-medium">{currentStep || 'Processing...'}</span>
                      <div className="flex items-center gap-3">
                        {item.started_at && (
                          <span className="text-gray-500">⏱ {getElapsedTime(item.started_at)}</span>
                        )}
                        <span className="text-blue-400 font-bold">{progress}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {item.status === 'failed' && item.error_message && (
                  <div className="bg-red-900/20 border border-red-500 rounded p-3 text-sm text-red-300 mb-4">
                    <div className="font-medium mb-1">Error:</div>
                    <div className="font-mono text-xs">{item.error_message}</div>
                  </div>
                )}

                {/* Video Path */}
                {item.video_file_path && (
                  <div className="bg-gray-900 rounded p-3 mb-3">
                    <div className="text-xs text-gray-500 mb-1">Video Output:</div>
                    <div className="text-sm text-gray-300 font-mono break-all">
                      {item.video_file_path}
                    </div>
                  </div>
                )}

                {/* Processing Time */}
                {item.started_at && item.completed_at && (
                  <div className="text-sm text-gray-500">
                    Processing time: {' '}
                    {formatDuration(
                      Math.round(
                        (new Date(item.completed_at).getTime() - new Date(item.started_at).getTime()) / 1000
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
