'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Song } from '@/lib/api';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

export default function NewSongPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [vocalsFile, setVocalsFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);

  const showNotification = (type: NotificationType, message: string) => {
    const id = Date.now() + Math.random(); // Use timestamp + random for unique ID
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const [formData, setFormData] = useState<Partial<Song>>({
    title: '',
    artist_name: '',
    lyrics: '',
    spectrum_style: 'stereo',
    spectrum_color: 'white',
    spectrum_opacity: 0.5,
    vocals_stem_path: '',
    music_stem_path: '',
    // Karaoke defaults
    karaoke_font_family: 'Ubuntu',
    karaoke_font_size: 96,
    karaoke_primary_color: '4169E1',
    karaoke_primary_border_color: 'FFFFFF',
    karaoke_highlight_color: 'FFD700',
    karaoke_highlight_border_color: 'FFFFFF',
    karaoke_alignment: 5,
    karaoke_margin_bottom: 0,
  });

  // Load Google Font dynamically when font family changes
  useEffect(() => {
    if (formData.karaoke_font_family && formData.karaoke_font_family !== 'Arial') {
      const fontName = formData.karaoke_font_family.replace(/ /g, '+');
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      return () => {
        // Cleanup: remove the link when component unmounts or font changes
        document.head.removeChild(link);
      };
    }
  }, [formData.karaoke_font_family]);

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
      
      // Generate karaoke lyrics if song lyrics exist but karaoke doesn't
      let karaokeToSave = formData.lyrics_karaoke;
      if (formData.lyrics && !karaokeToSave) {
        showNotification('info', 'Generating karaoke lyrics...');
        
        // Generate karaoke lyrics inline
        let lines = formData.lyrics.split('\n');
        const formatted: string[] = [];

        // Remove section labels and bracketed lines
        lines = lines.filter(line => {
          const trimmed = line.trim().toLowerCase();
          if (trimmed.startsWith('verse') || 
              trimmed.startsWith('chorus') || 
              trimmed.startsWith('pre-chorus') || 
              trimmed.startsWith('bridge') || 
              trimmed.startsWith('intro') || 
              trimmed.startsWith('outro') ||
              trimmed.startsWith('[') || 
              trimmed.startsWith('(')) {
            return false;
          }
          return true;
        });

        // Process each line
        for (let line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.length === 0) {
            formatted.push('');
            continue;
          }

          if (trimmed.length > 30) {
            const commaIndex = trimmed.indexOf(',');
            const middlePoint = Math.floor(trimmed.length / 2);
            
            if (commaIndex > 0 && Math.abs(commaIndex - middlePoint) <= 10) {
              const firstPart = trimmed.substring(0, commaIndex).trim();
              const secondPart = trimmed.substring(commaIndex + 1).trim();
              formatted.push(firstPart.replace(/[.,!?;:]$/, ''));
              formatted.push(secondPart.replace(/[.,!?;:]$/, ''));
            } else {
              formatted.push(trimmed.replace(/[.,!?;:]$/, ''));
            }
          } else {
            formatted.push(trimmed.replace(/[.,!?;:]$/, ''));
          }
        }

        // Join paragraphs
        const paragraphs: string[] = [];
        let currentParagraph: string[] = [];
        
        for (const line of formatted) {
          if (line === '') {
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph.join('\n'));
              currentParagraph = [];
            }
          } else {
            currentParagraph.push(line);
          }
        }
        
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
        }
        
        karaokeToSave = paragraphs.join('\n\n');
      }
      
      // Create the song with all data including karaoke lyrics (without file paths yet)
      const songDataToSave = {
        ...formData,
        lyrics_karaoke: karaokeToSave || formData.lyrics, // Fallback to regular lyrics
        vocals_stem_path: '', // Will be set after upload
        music_stem_path: '', // Will be set after upload
      };
      
      showNotification('info', 'Creating song...');
      const newSong = await api.createSong(songDataToSave);
      
      // Upload audio files if provided
      if (vocalsFile || musicFile) {
        try {
          setUploading(true);
          showNotification('info', 'Uploading audio files...');
          await api.uploadAudio(newSong.id, vocalsFile || undefined, musicFile || undefined);
          showNotification('success', 'Audio files uploaded!');
        } catch (uploadErr) {
          showNotification('error', 'Warning: Failed to upload audio files: ' + (uploadErr instanceof Error ? uploadErr.message : 'Unknown error'));
        } finally {
          setUploading(false);
        }
      }
      
      // Clear localStorage after successful save
      localStorage.removeItem('trackstudio_new_song');
      
      showNotification('success', 'Song created! Redirecting to edit page...');
      
      // Redirect to edit page after a short delay
      setTimeout(() => router.push(`/songs/${newSong.id}`), 500);
    } catch (err) {
      showNotification('error', 'Failed to create song: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: (type === 'number' || type === 'range') ? parseFloat(value) || 0 : value,
    }));
  };

  const formatLyrics = () => {
    if (!formData.lyrics) return;

    const lines = formData.lyrics.split('\n');
    const formatted: string[] = [];

    // Simply remove lines starting with [ or (
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip lines starting with [ or (
      if (trimmed.startsWith('[') || trimmed.startsWith('(')) {
        continue;
      }
      
      // Keep everything else as-is
      formatted.push(line);
    }

    // Join lines back together
    const finalLyrics = formatted.join('\n');

    // Update lyrics_karaoke field
    setFormData(prev => ({
      ...prev,
      lyrics_karaoke: finalLyrics,
    }));
    
    showNotification('success', 'Karaoke lyrics generated successfully!');
  };

  const handleFileSelect = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const type = fieldName === 'vocals_stem_path' ? 'vocals' : 'music';
        
        // Store the file for upload
        if (type === 'vocals') {
          setVocalsFile(file);
        } else {
          setMusicFile(file);
        }
        
        // Update form with filename
        setFormData(prev => ({ ...prev, [fieldName]: file.name }));
        
        showNotification('success', `${type === 'vocals' ? 'Vocals' : 'Music'} file selected: ${file.name}`);
      }
    };
    input.click();
  };

  const handleClearStem = (fieldName: 'vocals_stem_path' | 'music_stem_path') => {
    const type = fieldName === 'vocals_stem_path' ? 'vocals' : 'music';
    
    // Clear the file and path
    if (type === 'vocals') {
      setVocalsFile(null);
    } else {
      setMusicFile(null);
    }
    
    setFormData(prev => ({ ...prev, [fieldName]: '' }));
    
    showNotification('info', `${type === 'vocals' ? 'Vocals' : 'Music'} stem cleared`);
  };

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

          <div>
            <label className="block text-sm font-medium mb-2">Genre</label>
            <select
              name="genre"
              value={formData.genre || ''}
              onChange={handleChange}
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-xl font-semibold mb-4">Lyrics</h2>
          
          {/* Song Lyrics (with sections) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Song Lyrics (with sections like [Verse], [Chorus])
            </label>
            <textarea
              name="lyrics"
              value={formData.lyrics || ''}
              onChange={handleChange}
              rows={10}
              placeholder="Enter song lyrics with section labels like [Verse 1], [Chorus], etc."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={formatLyrics}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
              >
                Generate Karaoke Lyrics →
              </button>
              <p className="text-gray-500 text-sm">
                Line count: {(formData.lyrics || '').split('\n').length}
              </p>
            </div>
          </div>

          {/* Karaoke Lyrics (for display) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Karaoke Lyrics (display version - no section labels)
            </label>
            <textarea
              name="lyrics_karaoke"
              value={formData.lyrics_karaoke || ''}
              onChange={handleChange}
              rows={10}
              placeholder="Click 'Generate Karaoke Lyrics' above to auto-format from song lyrics"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-gray-500 text-sm mt-2">
              Line count: {(formData.lyrics_karaoke || '').split('\n').length}
            </p>
          </div>
        </div>

        {/* Karaoke Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Karaoke Text Settings</h2>
          <p className="text-gray-400 text-sm mb-4">
            Customize the appearance of karaoke lyrics in the video
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium mb-2">Font Family</label>
              <select
                name="karaoke_font_family"
                value={formData.karaoke_font_family || 'Arial'}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Oswald">Oswald</option>
                <option value="Raleway">Raleway</option>
                <option value="Poppins">Poppins</option>
                <option value="Ubuntu">Ubuntu</option>
                <option value="Bebas Neue">Bebas Neue</option>
                <option value="Nunito">Nunito</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Merriweather">Merriweather</option>
                <option value="PT Sans">PT Sans</option>
                <option value="Source Sans Pro">Source Sans Pro</option>
                <option value="Noto Sans">Noto Sans</option>
                <option value="Inter">Inter</option>
                <option value="Work Sans">Work Sans</option>
                <option value="Quicksand">Quicksand</option>
                <option value="Anton">Anton</option>
                <option value="Bitter">Bitter</option>
                <option value="Archivo">Archivo</option>
                <option value="Karla">Karla</option>
                <option value="Titillium Web">Titillium Web</option>
                <option value="Arimo">Arimo</option>
                <option value="Arial">Arial</option>
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Font Size: {formData.karaoke_font_size || 96}px
              </label>
              <input
                type="range"
                name="karaoke_font_size"
                min="48"
                max="200"
                step="4"
                value={formData.karaoke_font_size || 96}
                onChange={handleChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>48px</span>
                <span>200px</span>
              </div>
            </div>

            {/* Primary Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Primary Text Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={`#${formData.karaoke_primary_color || '4169E1'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_primary_color: hex }));
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_primary_color"
                  value={formData.karaoke_primary_color || '4169E1'}
                  onChange={handleChange}
                  placeholder="4169E1 (Royal Blue)"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
            </div>

            {/* Primary Border Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Primary Border Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={`#${formData.karaoke_primary_border_color || 'FFFFFF'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_primary_border_color: hex }));
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_primary_border_color"
                  value={formData.karaoke_primary_border_color || 'FFFFFF'}
                  onChange={handleChange}
                  placeholder="FFFFFF (White)"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
            </div>

            {/* Highlight Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Highlight (Active) Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={`#${formData.karaoke_highlight_color || 'FFD700'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_highlight_color: hex }));
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_highlight_color"
                  value={formData.karaoke_highlight_color || 'FFD700'}
                  onChange={handleChange}
                  placeholder="FFD700 (Gold)"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
            </div>

            {/* Highlight Border Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Highlight Border Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={`#${formData.karaoke_highlight_border_color || 'FFFFFF'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_highlight_border_color: hex }));
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_highlight_border_color"
                  value={formData.karaoke_highlight_border_color || 'FFFFFF'}
                  onChange={handleChange}
                  placeholder="FFFFFF (White)"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
            </div>

            {/* Alignment */}
            <div>
              <label className="block text-sm font-medium mb-2">Text Alignment</label>
              <select
                name="karaoke_alignment"
                value={formData.karaoke_alignment || 5}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value={5}>Center</option>
                <option value={2}>Bottom Center</option>
                <option value={8}>Top Center</option>
              </select>
            </div>

            {/* Margin Bottom */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Vertical Offset: {formData.karaoke_margin_bottom ?? 0}px
              </label>
              <input
                type="range"
                name="karaoke_margin_bottom"
                min="-200"
                max="200"
                step="10"
                value={formData.karaoke_margin_bottom ?? 0}
                onChange={handleChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>-200px (Up)</span>
                <span>0px</span>
                <span>+200px (Down)</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-8 flex items-end justify-center min-h-[200px]">
            <div 
              className="text-center"
              style={{ 
                fontFamily: formData.karaoke_font_family || 'Arial',
                fontSize: `${formData.karaoke_font_size || 96}px`,
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  color: `#${formData.karaoke_highlight_color || 'FFD700'}`,
                  textShadow: `
                    -2px -2px 0 #${formData.karaoke_highlight_border_color || 'FFFFFF'},
                    2px -2px 0 #${formData.karaoke_highlight_border_color || 'FFFFFF'},
                    -2px 2px 0 #${formData.karaoke_highlight_border_color || 'FFFFFF'},
                    2px 2px 0 #${formData.karaoke_highlight_border_color || 'FFFFFF'}
                  `,
                  fontWeight: 'bold'
                }}
              >
                This is your
              </span>
              {' '}
              <span
                style={{
                  color: `#${formData.karaoke_primary_color || '4169E1'}`,
                  textShadow: `
                    -2px -2px 0 #${formData.karaoke_primary_border_color || 'FFFFFF'},
                    2px -2px 0 #${formData.karaoke_primary_border_color || 'FFFFFF'},
                    -2px 2px 0 #${formData.karaoke_primary_border_color || 'FFFFFF'},
                    2px 2px 0 #${formData.karaoke_primary_border_color || 'FFFFFF'}
                  `,
                  fontWeight: 'bold'
                }}
              >
                karaoke lyrics
              </span>
            </div>
          </div>
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
                readOnly
                placeholder="No file selected"
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
            <label className="block text-sm font-medium mb-2">Music Stem *</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="music_stem_path"
                value={formData.music_stem_path || ''}
                readOnly
                placeholder="No file selected"
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
