'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Song, GeneratedImage } from '@/lib/api';

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

export default function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const songId = parseInt(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<'vocals' | 'music' | null>(null);
  const [audioElements, setAudioElements] = useState<{ vocals?: HTMLAudioElement; music?: HTMLAudioElement }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<Partial<Song>>({});
  const [hasVideo, setHasVideo] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [notificationId, setNotificationId] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editNegativePrompt, setEditNegativePrompt] = useState('');

  const showNotification = (type: NotificationType, message: string) => {
    const id = notificationId;
    setNotificationId(id + 1);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  const [formData, setFormData] = useState<Partial<Song>>({
    title: '',
    artist_name: '',
    lyrics: '',
    duration_seconds: 0,
    bpm: 0,
    key: '',
    tempo: '',
    spectrum_style: 'stereo',
    spectrum_color: 'white',
    spectrum_opacity: 0.5,
    vocals_stem_path: '',
    music_stem_path: '',
    mixed_audio_path: '',
  });

  useEffect(() => {
    loadSong();
    loadImages();
  }, [songId]);

  const loadSong = async () => {
    try {
      setLoading(true);
      const song = await api.getSong(songId);
      setFormData(song);
      setOriginalData(song);
      
      // Check if this song has a completed video
      const queue = await api.getQueue();
      const completed = queue.find(q => q.song_id === songId && q.status === 'completed' && q.video_file_path);
      setHasVideo(!!completed);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      setLoadingImages(true);
      const images = await api.getImagesBySong(songId);
      setGeneratedImages(images);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await api.updateSong(songId, formData);
      setHasChanges(false);
      setOriginalData(formData);
      showNotification('success', 'Song saved successfully!');
      setTimeout(() => router.push('/songs'), 1000);
    } catch (err) {
      showNotification('error', 'Failed to save song: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
    
    setHasChanges(true);
  };

  const handleBlur = async () => {
    // Auto-save on blur (when field loses focus)
    if (!formData.title || !formData.artist_name) return; // Skip if required fields empty
    
    try {
      await api.updateSong(songId, formData);
      // Silent save - no alert
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Don't show error to user for auto-save failures
    }
  };

  const handleRender = async () => {
    if (hasChanges) {
      showConfirm('You have unsaved changes. Save before rendering?', async () => {
        try {
          await api.updateSong(songId, formData);
          setHasChanges(false);
          setOriginalData(formData);
          proceedToRender();
        } catch (err) {
          showNotification('error', 'Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      });
      return;
    }
    
    proceedToRender();
  };

  const proceedToRender = async () => {
    try {
      await api.addToQueue(songId, 5);
      showNotification('success', 'Song added to render queue!');
      setTimeout(() => router.push('/queue'), 1000);
    } catch (err) {
      showNotification('error', 'Failed to add to queue: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleFileSelect = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Browser can't access full filesystem path for security reasons
        // Prompt user to enter the full path manually
        const fileName = file.name;
        const fullPath = prompt(
          `Enter the full path to the file:\n\nFilename: ${fileName}`,
          `/home/andrew/Music/Tristan Hart/TrackStudio-Stem-Files/${fileName}`
        );
        
        if (fullPath) {
          setFormData(prev => ({ ...prev, [fieldName]: fullPath }));
          setHasChanges(true);
          
          // Create audio element for preview using blob URL
          const blobUrl = URL.createObjectURL(file);
          const audio = new Audio(blobUrl);
          const type = fieldName === 'vocals_stem_path' ? 'vocals' : 'music';
          setAudioElements(prev => ({ ...prev, [type]: audio }));
        }
      }
    };
    input.click();
  };

  const handleClearStem = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const type = fieldName === 'vocals_stem_path' ? 'vocals' : 'music';
    
    // Stop and remove audio element if playing
    const audio = audioElements[type];
    if (audio) {
      audio.pause();
      if (playingAudio === type) {
        setPlayingAudio(null);
      }
    }
    
    // Clear the path and audio element
    setFormData(prev => ({ ...prev, [fieldName]: '' }));
    setAudioElements(prev => {
      const newElements = { ...prev };
      delete newElements[type];
      return newElements;
    });
    setHasChanges(true);
    
    showNotification('info', `${type === 'vocals' ? 'Vocals' : 'Music'} stem cleared`);
  };

  const handleEditImage = (image: GeneratedImage) => {
    setEditingImageId(image.id);
    setEditPrompt(image.prompt);
    setEditNegativePrompt(image.negative_prompt);
  };

  const handleSaveImagePrompt = async (imageId: number) => {
    try {
      await api.updateImagePrompt(imageId, editPrompt, editNegativePrompt);
      showNotification('success', 'Image prompt updated');
      setEditingImageId(null);
      loadImages();
    } catch (err) {
      showNotification('error', 'Failed to update prompt: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleRegenerateImage = async (imageId: number) => {
    try {
      await api.regenerateImage(imageId);
      showNotification('success', 'Image regeneration queued');
    } catch (err) {
      showNotification('error', 'Failed to regenerate: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handlePlayAudio = (path: string | undefined, type: 'vocals' | 'music') => {
    if (!path) return;
    
    const audio = audioElements[type];
    if (!audio) {
      showNotification('info', 'Please select an audio file first');
      return;
    }
    
    if (playingAudio === type) {
      // Pause
      audio.pause();
      setPlayingAudio(null);
    } else {
      // Stop other audio if playing
      if (playingAudio) {
        const otherAudio = audioElements[playingAudio];
        if (otherAudio) otherAudio.pause();
      }
      
      // Play this audio
      audio.play().catch(err => {
        console.error('Audio play error:', err);
        showNotification('error', 'Cannot play audio file');
      });
      setPlayingAudio(type);
      
      audio.onended = () => setPlayingAudio(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading song...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={() => router.push('/songs')}
          className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition"
        >
          Back to Songs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Song</h1>
          <p className="text-gray-400 mt-1">Song ID: {songId}</p>
        </div>
        <button
          onClick={() => router.push('/songs')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          Cancel
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Audio Analysis Info (Read-only) */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Duration</div>
            <div className="text-2xl font-bold">
              {formData.duration_seconds ? `${Math.floor(formData.duration_seconds / 60)}:${String(Math.floor(formData.duration_seconds % 60)).padStart(2, '0')}` : '--:--'}
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">BPM</div>
            <div className="text-2xl font-bold">{formData.bpm ? formData.bpm.toFixed(2) : '--'}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Key</div>
            <div className="text-2xl font-bold">{formData.key || '--'}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Tempo</div>
            <div className="text-2xl font-bold">{formData.tempo || '--'}</div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Artist Name *</label>
            <input
              type="text"
              name="artist_name"
              value={formData.artist_name}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Genre</label>
            <select
              name="genre"
              value={formData.genre || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Genre</option>
              <option value="Rock">Rock</option>
              <option value="Pop">Pop</option>
              <option value="Hip-Hop">Hip-Hop</option>
              <option value="R&B">R&B</option>
              <option value="Country">Country</option>
              <option value="Electronic">Electronic</option>
              <option value="Dance">Dance</option>
              <option value="Jazz">Jazz</option>
              <option value="Blues">Blues</option>
              <option value="Classical">Classical</option>
              <option value="Metal">Metal</option>
              <option value="Indie">Indie</option>
              <option value="Folk">Folk</option>
              <option value="Reggae">Reggae</option>
              <option value="Soul">Soul</option>
              <option value="Funk">Funk</option>
              <option value="Alternative">Alternative</option>
              <option value="Punk">Punk</option>
              <option value="Gospel">Gospel</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Visualization Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Visualization Settings</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">Spectrum Style</label>
            <select
              name="spectrum_style"
              value={formData.spectrum_style}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="stereo">Stereo (bars on edges)</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
              <option value="circle">Circle</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Spectrum Color</label>
            <select
              name="spectrum_color"
              value={formData.spectrum_color}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="white">White</option>
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Spectrum Opacity: {(formData.spectrum_opacity || 0.5).toFixed(2)}
            </label>
            <input
              type="range"
              name="spectrum_opacity"
              min="0"
              max="1"
              step="0.05"
              value={formData.spectrum_opacity || 0.5}
              onChange={handleChange}
              className="w-full"
            />
          </div>
        </div>

        {/* Lyrics */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lyrics</h2>
          <textarea
            name="lyrics"
            value={formData.lyrics || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={15}
            placeholder="Enter song lyrics here..."
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-gray-500 text-sm mt-2">
            Line count: {(formData.lyrics || '').split('\n').length}
          </p>
        </div>

        {/* Audio Files */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Audio Files</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">Vocals Stem</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="vocals_stem_path"
                value={formData.vocals_stem_path || ''}
                onChange={handleChange}
                placeholder="Enter full path or click Select File"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => handleFileSelect('vocals_stem_path')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition whitespace-nowrap"
              >
                📁 Select File
              </button>
              <button
                type="button"
                onClick={() => handlePlayAudio(formData.vocals_stem_path, 'vocals')}
                disabled={!formData.vocals_stem_path}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {playingAudio === 'vocals' ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                onClick={() => handleClearStem('vocals_stem_path')}
                disabled={!formData.vocals_stem_path}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear vocals stem"
              >
                🗑 Clear
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Music Stem</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="music_stem_path"
                value={formData.music_stem_path || ''}
                onChange={handleChange}
                placeholder="Enter full path or click Select File"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => handleFileSelect('music_stem_path')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition whitespace-nowrap"
              >
                📁 Select File
              </button>
              <button
                type="button"
                onClick={() => handlePlayAudio(formData.music_stem_path, 'music')}
                disabled={!formData.music_stem_path}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {playingAudio === 'music' ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                onClick={() => handleClearStem('music_stem_path')}
                disabled={!formData.music_stem_path}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear music stem"
              >
                🗑 Clear
              </button>
            </div>
          </div>
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Generated Images ({generatedImages.length})</h2>
            <p className="text-gray-400 text-sm mb-4">
              Review and edit the prompts used to generate images. You can regenerate individual images after editing their prompts.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((image) => (
                <div key={image.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
                  {/* Image Info Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium capitalize">{image.image_type}</div>
                      {image.sequence_number && (
                        <div className="text-sm text-gray-500">#{image.sequence_number}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{image.model}</div>
                  </div>

                  {/* Image Preview */}
                  <div className="relative aspect-video bg-gray-800 rounded overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                      🖼️ {image.width}x{image.height}
                    </div>
                  </div>

                  {/* Prompt Editor */}
                  {editingImageId === image.id ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Prompt</label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Negative Prompt</label>
                        <textarea
                          value={editNegativePrompt}
                          onChange={(e) => setEditNegativePrompt(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveImagePrompt(image.id)}
                          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm transition"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingImageId(null)}
                          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {image.prompt && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Prompt:</div>
                          <div className="text-sm text-gray-300 line-clamp-2">{image.prompt}</div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditImage(image)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
                        >
                          ✏️ Edit Prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateImage(image.id)}
                          className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm transition"
                        >
                          🔄 Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingImages && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
            <div className="text-gray-400">Loading images...</div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/songs')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
          
          {/* Render Button */}
          <button
            type="button"
            onClick={handleRender}
            disabled={!formData.vocals_stem_path && !formData.music_stem_path}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title={hasVideo && !hasChanges ? 'Already rendered - will re-render with current settings' : hasChanges ? 'Will save changes before rendering' : 'Add to render queue'}
          >
            <span>⚡</span>
            <span>
              {hasVideo && !hasChanges ? 'Re-render Video' : hasChanges ? 'Save & Render' : 'Render Video'}
            </span>
          </button>
          {hasChanges && (
            <p className="text-yellow-400 text-sm text-center">
              ⚠️ You have unsaved changes. Click Render to save and queue.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
