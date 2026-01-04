'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Song } from '@/lib/api';

export default function NewSongPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<'vocals' | 'music' | null>(null);
  const [audioElements, setAudioElements] = useState<{ vocals?: HTMLAudioElement; music?: HTMLAudioElement }>({});

  const [formData, setFormData] = useState<Partial<Song>>({
    title: '',
    artist_name: '',
    lyrics: '',
    spectrum_style: 'stereo',
    spectrum_color: 'white',
    spectrum_opacity: 0.5,
    vocals_stem_path: '',
    music_stem_path: '',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('trackstudio_new_song');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
      } catch (err) {
        console.error('Failed to load saved form data:', err);
      }
    }
  }, []);

  // Auto-save to localStorage whenever formData changes
  useEffect(() => {
    if (formData.title || formData.artist_name || formData.lyrics) {
      localStorage.setItem('trackstudio_new_song', JSON.stringify(formData));
    }
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const newSong = await api.createSong(formData);
      // Clear localStorage after successful save
      localStorage.removeItem('trackstudio_new_song');
      router.push(`/songs/${newSong.id}`);
    } catch (err) {
      alert('Failed to create song: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleFileSelect = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Get the full path (or at least the filename with path prefix)
        // In browser, we can't get real filesystem path, so we'll use file name
        // For now, construct expected path based on test files location
        const fullPath = `/home/andrew/Development/Fullstack-Projects/TrackStudio/test-files/land_of_love/${file.name}`;
        setFormData(prev => ({ ...prev, [fieldName]: fullPath }));
        
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create New Song</h1>
          <p className="text-gray-400 mt-1">Fill in the song details</p>
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
            <label className="block text-sm font-medium mb-2">Vocals Stem *</label>
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
            <label className="block text-sm font-medium mb-2">Music Stem *</label>
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
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Song'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/songs')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
