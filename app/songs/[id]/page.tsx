'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Song } from '@/lib/api';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await api.updateSong(songId, formData);
      setHasChanges(false);
      setOriginalData(formData);
      router.push('/songs');
    } catch (err) {
      alert('Failed to save song: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
      if (!confirm('You have unsaved changes. Save before rendering?')) {
        return;
      }
      try {
        await api.updateSong(songId, formData);
        setHasChanges(false);
        setOriginalData(formData);
      } catch (err) {
        alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
        return;
      }
    }
    
    try {
      await api.addToQueue(songId, 5);
      alert('Song added to render queue!');
      router.push('/queue');
    } catch (err) {
      alert('Failed to add to queue: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleFileSelect = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Construct expected full path
        const fullPath = `/home/andrew/Development/Fullstack-Projects/TrackStudio/test-files/land_of_love/${file.name}`;
        setFormData(prev => ({ ...prev, [fieldName]: fullPath }));
        setHasChanges(true);
        
        // Create audio element for preview using blob URL
        const blobUrl = URL.createObjectURL(file);
        const audio = new Audio(blobUrl);
        const type = fieldName === 'vocals_stem_path' ? 'vocals' : 'music';
        setAudioElements(prev => ({ ...prev, [type]: audio }));
      }
    };
    input.click();
  };

  const handlePlayAudio = (path: string | undefined, type: 'vocals' | 'music') => {
    if (!path) return;
    
    const audio = audioElements[type];
    if (!audio) {
      alert('Please select an audio file first');
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
        alert('Cannot play audio file');
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
                placeholder="No file selected"
                readOnly
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
                placeholder="No file selected"
                readOnly
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
            </div>
          </div>
        </div>

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
