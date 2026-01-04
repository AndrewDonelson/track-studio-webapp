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
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<'vocals' | 'music' | null>(null);
  const [audioElements, setAudioElements] = useState<{ vocals?: HTMLAudioElement; music?: HTMLAudioElement }>({});
  const [vocalsFile, setVocalsFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<Partial<Song>>({});
  const [hasVideo, setHasVideo] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editNegativePrompt, setEditNegativePrompt] = useState('');
  const [regeneratingImages, setRegeneratingImages] = useState<Set<number>>(new Set());
  const [imageTimestamps, setImageTimestamps] = useState<Map<number, number>>(new Map());
  const [generatingPrompts, setGeneratingPrompts] = useState<Set<number>>(new Set());

  const showNotification = (type: NotificationType, message: string) => {
    const id = Date.now() + Math.random(); // Unique ID using timestamp + random
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
      
      // Sort images by song structure order
      // Intro -> Verse 1 -> Pre-Chorus -> Chorus -> Verse 2 -> Bridge -> Verse 3 -> Final Chorus -> Outro
      const sectionOrder: { [key: string]: number } = {
        'intro': 1,
        'verse': 2,
        'pre-chorus': 3,
        'chorus': 4,
        'bridge': 5,
        'final-chorus': 6,
        'outro': 7
      };
      
      const sortedImages = images.sort((a, b) => {
        const orderA = sectionOrder[a.image_type] || 999;
        const orderB = sectionOrder[b.image_type] || 999;
        
        // First sort by section type
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // Then by sequence number within the same section type (for verses)
        return (a.sequence_number || 0) - (b.sequence_number || 0);
      });
      
      setGeneratedImages(sortedImages);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleAnalyzeAudio = async () => {
    try {
      setAnalyzing(true);
      showNotification('info', 'Analyzing audio...');
      const updatedSong = await api.analyzeSong(songId);
      
      // Update form with analysis results
      setFormData(prev => ({
        ...prev,
        duration_seconds: updatedSong.duration_seconds,
        bpm: updatedSong.bpm,
        key: updatedSong.key,
        tempo: updatedSong.tempo,
        genre: updatedSong.genre || prev.genre,
      }));
      
      showNotification('success', 'Audio analysis complete!');
    } catch (err) {
      showNotification('error', 'Failed to analyze audio: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = (type: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Store the file
        if (type === 'vocals_stem_path') {
          setVocalsFile(file);
        } else {
          setMusicFile(file);
        }

        // Create audio element for preview
        const audio = new Audio(URL.createObjectURL(file));
        setAudioElements(prev => ({
          ...prev,
          [type === 'vocals_stem_path' ? 'vocals' : 'music']: audio,
        }));

        setHasChanges(true);
        showNotification('success', `Selected: ${file.name}`);
      }
    };
    input.click();
  };

  const handlePlayAudio = (stemType: 'vocals' | 'music') => {
    const audio = audioElements[stemType];
    if (!audio) return;

    if (playingAudio === stemType) {
      audio.pause();
      setPlayingAudio(null);
    } else {
      // Pause other audio if playing
      if (playingAudio) {
        const otherAudio = audioElements[playingAudio];
        if (otherAudio) otherAudio.pause();
      }
      audio.play();
      setPlayingAudio(stemType);
      
      // Reset when audio ends
      audio.onended = () => setPlayingAudio(null);
    }
  };

  const handleClearStem = (type: 'vocals_stem_path' | 'music_stem_path') => {
    const stemType = type === 'vocals_stem_path' ? 'vocals' : 'music';
    
    if (type === 'vocals_stem_path') {
      setVocalsFile(null);
    } else {
      setMusicFile(null);
    }
    
    if (audioElements[stemType]) {
      audioElements[stemType]?.pause();
      setAudioElements(prev => ({ ...prev, [stemType]: undefined }));
    }
    
    if (playingAudio === stemType) {
      setPlayingAudio(null);
    }

    setHasChanges(true);
    showNotification('info', `Cleared ${type === 'vocals_stem_path' ? 'vocals' : 'music'} selection`);
  };

  const handleUploadFiles = async () => {
    if (!vocalsFile && !musicFile) {
      showNotification('error', 'Please select at least one audio file to upload');
      return;
    }

    try {
      setUploading(true);
      showNotification('info', 'Uploading audio files...');

      const updatedSong = await api.uploadAudio(songId, vocalsFile, musicFile);

      // Update form with server paths
      setFormData(prev => ({
        ...prev,
        vocals_stem_path: updatedSong.vocals_stem_path || prev.vocals_stem_path,
        music_stem_path: updatedSong.music_stem_path || prev.music_stem_path,
      }));

      // Clear file state
      setVocalsFile(null);
      setMusicFile(null);

      showNotification('success', 'Audio files uploaded successfully!');
    } catch (err) {
      showNotification('error', 'Failed to upload files: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
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

  const formatLyrics = () => {
    if (!formData.lyrics) return;

    let lines = formData.lyrics.split('\n');
    const formatted: string[] = [];

    // Step 1 & 2: Remove section labels and bracketed lines
    lines = lines.filter(line => {
      const trimmed = line.trim().toLowerCase();
      // Remove lines starting with section labels
      if (trimmed.startsWith('verse') || 
          trimmed.startsWith('chorus') || 
          trimmed.startsWith('pre-chorus') || 
          trimmed.startsWith('bridge') || 
          trimmed.startsWith('intro') || 
          trimmed.startsWith('outro')) {
        return false;
      }
      // Remove lines starting with [ or (
      if (trimmed.startsWith('[') || trimmed.startsWith('(')) {
        return false;
      }
      return true;
    });

    // Step 3: Process each line for length and split if needed
    for (let line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0) {
        formatted.push('');
        continue;
      }

      if (trimmed.length > 30) {
        // Look for comma to split line
        const commaIndex = trimmed.indexOf(',');
        const middlePoint = Math.floor(trimmed.length / 2);
        
        // If there's a comma within reasonable range of middle (±10 chars)
        if (commaIndex > 0 && Math.abs(commaIndex - middlePoint) <= 10) {
          // Split at comma
          const firstPart = trimmed.substring(0, commaIndex).trim();
          const secondPart = trimmed.substring(commaIndex + 1).trim();
          
          // Remove ending punctuation from both parts
          formatted.push(firstPart.replace(/[.,!?;:]$/, ''));
          formatted.push(secondPart.replace(/[.,!?;:]$/, ''));
        } else {
          // No suitable comma, just remove ending punctuation
          formatted.push(trimmed.replace(/[.,!?;:]$/, ''));
        }
      } else {
        // Line is fine, just remove ending punctuation
        formatted.push(trimmed.replace(/[.,!?;:]$/, ''));
      }
    }

    // Step 4: Ensure paragraphs are separated by single empty line
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
    
    // Add last paragraph if exists
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join('\n'));
    }

    // Step 5: Join paragraphs with single empty line
    const finalLyrics = paragraphs.join('\n\n');

    // Update lyrics_karaoke field
    setFormData(prev => ({
      ...prev,
      lyrics_karaoke: finalLyrics,
    }));
    
    setHasChanges(true);
    showNotification('success', 'Karaoke lyrics generated successfully!');
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

  const handleGenerateAllPrompts = async () => {
    try {
      setLoadingImages(true);
      showNotification('info', 'Analyzing lyrics and generating prompts...');
      
      // Parse lyrics to find sections
      const lyrics = formData.lyrics || '';
      const lines = lyrics.split('\n');
      
      // Track which sections we've created prompts for
      const sectionsToGenerate: Array<{type: string, number: number, lyrics: string}> = [];
      let currentSection = { type: '', number: 1, lines: [] as string[] };
      
      // Section patterns
      const patterns = {
        intro: /^\[?intro\]?$/i,
        verse: /^\[?verse\s*(\d+)?\]?$/i,
        preChorus: /^\[?pre-?chorus\s*(\d+)?\]?$/i,
        chorus: /^\[?chorus\]?$/i,
        finalChorus: /^\[?final\s+chorus\]?$/i,
        bridge: /^\[?bridge\]?$/i,
        outro: /^\[?outro\]?$/i
      };
      
      let hasSeenChorus = false;
      let hasSeenPreChorus = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for section markers
        if (patterns.intro.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          currentSection = { type: 'intro', number: 1, lines: [] };
        } else if (patterns.verse.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          const match = trimmed.match(patterns.verse);
          const verseNum = match && match[1] ? parseInt(match[1]) : sectionsToGenerate.filter(s => s.type === 'verse').length + 1;
          currentSection = { type: 'verse', number: verseNum, lines: [] };
        } else if (patterns.preChorus.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          if (!hasSeenPreChorus) {
            currentSection = { type: 'pre-chorus', number: 1, lines: [] };
            hasSeenPreChorus = true;
          } else {
            // Skip creating another pre-chorus section
            currentSection = { type: '', number: 0, lines: [] };
          }
        } else if (patterns.finalChorus.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          currentSection = { type: 'final-chorus', number: 1, lines: [] };
        } else if (patterns.chorus.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          if (!hasSeenChorus) {
            currentSection = { type: 'chorus', number: 1, lines: [] };
            hasSeenChorus = true;
          } else {
            // Skip creating another chorus section
            currentSection = { type: '', number: 0, lines: [] };
          }
        } else if (patterns.bridge.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          currentSection = { type: 'bridge', number: 1, lines: [] };
        } else if (patterns.outro.test(trimmed)) {
          if (currentSection.type) {
            sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
          }
          currentSection = { type: 'outro', number: 1, lines: [] };
        } else if (trimmed && currentSection.type) {
          // Add lyrics line to current section
          currentSection.lines.push(trimmed);
        }
      }
      
      // Add last section
      if (currentSection.type) {
        sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
      }
      
      // Generate prompts for each section
      let successCount = 0;
      for (const section of sectionsToGenerate) {
        try {
          const response = await api.generatePromptFromLyrics(
            section.lyrics,
            section.type,
            formData.genre || '',
            formData.background_style || ''
          );
          
          await api.createImagePrompt(songId, {
            song_id: songId,
            prompt: response.prompt,
            negative_prompt: response.negative_prompt,
            image_type: section.type,
            sequence_number: section.number,
            width: 1920,
            height: 1080,
            model: 'stable-diffusion-xl'
          } as Partial<GeneratedImage>);
          
          successCount++;
        } catch (err) {
          console.error(`Failed to generate prompt for ${section.type} ${section.number}:`, err);
        }
      }
      
      showNotification('success', `Generated ${successCount} image prompts successfully!`);
      loadImages();
      
    } catch (err) {
      showNotification('error', 'Failed to generate prompts: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingImages(false);
    }
  };

  const handleReAnalyzePrompts = async () => {
    setConfirmDialog({
      message: 'This will delete all existing prompts and images, and regenerate them from your lyrics. Continue?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setLoadingImages(true);
          showNotification('info', 'Deleting old prompts...');
          
          // Delete all existing prompts for this song
          await api.deleteAllImagesBySong(songId);
          
          // Clear local state
          setGeneratedImages([]);
          
          // Generate new prompts
          await handleGenerateAllPrompts();
          
        } catch (err) {
          showNotification('error', 'Failed to re-analyze: ' + (err instanceof Error ? err.message : 'Unknown error'));
          setLoadingImages(false);
        }
      }
    });
  };

  const handleGenerateAllMissingImages = async () => {
    try {
      // Find all images without image_path
      const missingImages = generatedImages.filter(img => !img.image_path || img.image_path === '');
      
      if (missingImages.length === 0) {
        showNotification('info', 'All images have already been generated!');
        return;
      }

      showNotification('info', `Generating ${missingImages.length} missing images...`);
      
      // Trigger regeneration for each missing image
      for (const image of missingImages) {
        setRegeneratingImages(prev => new Set(prev).add(image.id));
        await api.regenerateImage(image.id);
      }

      // Start polling for all images
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        try {
          const images = await api.getImagesBySong(songId);
          const stillMissing = images.filter(img => 
            missingImages.some(mi => mi.id === img.id) && 
            (!img.image_path || img.image_path === '')
          );

          if (stillMissing.length === 0) {
            // All images are ready
            clearInterval(pollInterval);
            setRegeneratingImages(new Set());
            await loadImages();
            showNotification('success', `All ${missingImages.length} images generated successfully!`);
          } else if (Date.now() - startTime > 180000) {
            // Timeout after 3 minutes
            clearInterval(pollInterval);
            setRegeneratingImages(new Set());
            showNotification('warning', `${stillMissing.length} images are still generating. Check back later.`);
          }
        } catch (err) {
          console.error('Error polling for images:', err);
        }
      }, 3000);
      
    } catch (err) {
      showNotification('error', 'Failed to generate images: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
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
      // Mark image as regenerating
      setRegeneratingImages(prev => new Set(prev).add(imageId));
      
      await api.regenerateImage(imageId);
      showNotification('success', 'Generating image...');
      
      // Poll every 3 seconds to check if image is ready (more frequent for better responsiveness)
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          console.log(`Polling for image ${imageId}, attempt ${pollCount}`);
          
          // Force fresh data by adding cache-bust parameter
          const images = await api.getImagesBySong(songId);
          const updatedImage = images.find(img => img.id === imageId);
          
          console.log(`Image ${imageId} path:`, updatedImage?.image_path);
          
          // Check if image path exists and is not empty
          if (updatedImage && updatedImage.image_path && updatedImage.image_path !== '') {
            console.log(`Image ${imageId} is ready!`);
            clearInterval(pollInterval);
            
            // Update timestamp to force cache bust on image display
            setImageTimestamps(prev => {
              const next = new Map(prev);
              next.set(imageId, Date.now());
              return next;
            });
            
            // Mark as complete
            setRegeneratingImages(prev => {
              const next = new Set(prev);
              next.delete(imageId);
              return next;
            });
            
            // Reload all images to update the display
            await loadImages();
            
            showNotification('success', 'Image generated successfully!');
          }
        } catch (err) {
          console.error('Error polling for image:', err);
        }
      }, 3000);
      
      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setRegeneratingImages(prev => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
        showNotification('warning', 'Image generation is taking longer than expected. Please check back later.');
      }, 120000); // 2 minutes
      
    } catch (err) {
      setRegeneratingImages(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      showNotification('error', 'Failed to start generation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleGeneratePrompt = async (image: GeneratedImage) => {
    try {
      setGeneratingPrompts(prev => new Set(prev).add(image.id));
      
      // Parse lyrics to find the section text
      const lyrics = formData.lyrics || '';
      const sections = lyrics.split('\n\n').filter(s => s.trim());
      
      let sectionText = '';
      if (image.image_type === 'verse' && image.sequence_number) {
        // Find verse by number
        const verseIndex = image.sequence_number - 1;
        if (verseIndex >= 0 && verseIndex < sections.length) {
          sectionText = sections[verseIndex];
        }
      } else if (image.image_type === 'chorus') {
        // Find first chorus (usually after first verse)
        sectionText = sections.find(s => s.toLowerCase().includes('chorus')) || sections[1] || '';
      } else if (image.image_type === 'bridge') {
        // Find bridge section
        sectionText = sections.find(s => s.toLowerCase().includes('bridge')) || sections[sections.length - 2] || '';
      } else if (image.image_type === 'intro') {
        sectionText = sections[0] || '';
      } else if (image.image_type === 'outro') {
        sectionText = sections[sections.length - 1] || '';
      }
      
      if (!sectionText) {
        showNotification('error', 'Could not find lyrics for this section');
        setGeneratingPrompts(prev => {
          const next = new Set(prev);
          next.delete(image.id);
          return next;
        });
        return;
      }
      
      showNotification('info', 'Generating prompt from lyrics...');
      
      // Call API to generate prompt
      const result = await api.generatePromptFromLyrics(
        sectionText,
        image.image_type,
        formData.genre || '',
        formData.background_style || ''
      );
      
      // Set the generated prompt for editing
      setEditingImageId(image.id);
      setEditPrompt(result.prompt);
      setEditNegativePrompt(result.negative_prompt || '');
      
      setGeneratingPrompts(prev => {
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
      
      showNotification('success', 'Prompt generated! Review and save it.');
      
    } catch (err) {
      setGeneratingPrompts(prev => {
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
      showNotification('error', 'Failed to generate prompt: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
        <div className="flex gap-3">
          {(vocalsFile || musicFile) && (
            <button
              type="button"
              onClick={handleUploadFiles}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Upload selected audio files to server"
            >
              {uploading ? 'Uploading...' : '⬆️ Upload Files'}
            </button>
          )}
          <button
            type="button"
            onClick={handleAnalyzeAudio}
            disabled={analyzing || !formData.vocals_stem_path && !formData.music_stem_path}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Analyze audio files to detect BPM, key, tempo, and genre"
          >
            {analyzing ? 'Analyzing...' : '🎵 Analyze Audio'}
          </button>
          <button
            onClick={() => router.push('/songs')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
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
              onBlur={handleBlur}
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
              onBlur={handleBlur}
              rows={10}
              placeholder="Click 'Generate Karaoke Lyrics' above to auto-format from song lyrics"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-gray-500 text-sm mt-2">
              Line count: {(formData.lyrics_karaoke || '').split('\n').length}
            </p>
          </div>
        </div>

        {/* Audio Files */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Audio Files</h2>
          
          {/* Server Files Status */}
          <div className="flex gap-3 mb-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              formData.vocals_stem_path ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-red-900/30 text-red-400 border border-red-700'
            }`}>
              {formData.vocals_stem_path ? '✓ vocals.wav' : '✗ vocals.wav'}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              formData.music_stem_path ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-red-900/30 text-red-400 border border-red-700'
            }`}>
              {formData.music_stem_path ? '✓ instrumental.wav' : '✗ instrumental.wav'}
            </div>
          </div>

          {/* Vocals Stem */}
          <div>
            <label className="block text-sm font-medium mb-2">Vocals Stem</label>
            <div className="flex gap-2">
              {vocalsFile ? (
                <div className="flex-1 px-4 py-2 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-between">
                  <span className="text-blue-300 text-sm">📎 {vocalsFile.name}</span>
                  <span className="text-xs text-blue-400">Ready to upload</span>
                </div>
              ) : (
                <div className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg flex items-center text-gray-500 text-sm">
                  {formData.vocals_stem_path ? 'File on server' : 'No file selected'}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleFileSelect('vocals_stem_path')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition whitespace-nowrap"
              >
                📁 {vocalsFile ? 'Change' : 'Select'}
              </button>
              {vocalsFile && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePlayAudio('vocals')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  >
                    {playingAudio === 'vocals' ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearStem('vocals_stem_path')}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    title="Clear selection"
                  >
                    🗑 Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Music Stem */}
          <div>
            <label className="block text-sm font-medium mb-2">Music Stem (Instrumental)</label>
            <div className="flex gap-2">
              {musicFile ? (
                <div className="flex-1 px-4 py-2 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-between">
                  <span className="text-blue-300 text-sm">📎 {musicFile.name}</span>
                  <span className="text-xs text-blue-400">Ready to upload</span>
                </div>
              ) : (
                <div className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg flex items-center text-gray-500 text-sm">
                  {formData.music_stem_path ? 'File on server' : 'No file selected'}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleFileSelect('music_stem_path')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition whitespace-nowrap"
              >
                📁 {musicFile ? 'Change' : 'Select'}
              </button>
              {musicFile && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePlayAudio('music')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  >
                    {playingAudio === 'music' ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearStem('music_stem_path')}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    title="Clear selection"
                  >
                    🗑 Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Image Prompts Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Image Prompts {generatedImages.length > 0 && `(${generatedImages.length})`}</h2>
              <p className="text-gray-400 text-sm mt-1">
                {generatedImages.length === 0 
                  ? 'Generate prompts from your lyrics before creating images'
                  : 'Review and edit prompts. Click Regenerate to create new images.'}
              </p>
            </div>
            <div className="flex gap-2">
              {generatedImages.length > 0 && generatedImages.some(img => !img.image_path || img.image_path === '') && (
                <button
                  type="button"
                  onClick={handleGenerateAllMissingImages}
                  disabled={loadingImages || regeneratingImages.size > 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regeneratingImages.size > 0 ? 'Generating...' : `🎨 Generate Missing (${generatedImages.filter(img => !img.image_path || img.image_path === '').length})`}
                </button>
              )}
              {generatedImages.length > 0 && formData.lyrics && (
                <button
                  type="button"
                  onClick={handleReAnalyzePrompts}
                  disabled={loadingImages}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingImages ? 'Re-Analyzing...' : '🔄 Re-Analyze'}
                </button>
              )}
              {generatedImages.length === 0 && formData.lyrics && (
                <button
                  type="button"
                  onClick={handleGenerateAllPrompts}
                  disabled={loadingImages}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingImages ? 'Generating...' : '✨ Generate All Prompts'}
                </button>
              )}
            </div>
          </div>
          
          {loadingImages ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-3"></div>
              <div className="text-gray-400">Loading prompts...</div>
            </div>
          ) : generatedImages.length === 0 ? (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
              <div className="text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-lg font-medium mb-2">No Image Prompts Yet</div>
                <div className="text-sm">
                  {formData.lyrics 
                    ? 'Click "Generate All Prompts" to create AI prompts from your lyrics'
                    : 'Add lyrics to your song first, then generate image prompts'}
                </div>
              </div>
            </div>
          ) : (
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
                    {image.image_path && image.image_path !== '' ? (
                      <img
                        src={`http://localhost:8080/${image.image_path.replace('storage/', '')}?t=${imageTimestamps.get(image.id) || Date.now()}`}
                        alt={`${image.image_type} ${image.sequence_number}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`${image.image_path && image.image_path !== '' ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-gray-500 text-center p-4`}>
                      <div>
                        <div className="text-4xl mb-2">📝</div>
                        <div>Prompt ready to generate</div>
                        <div className="text-sm mt-1">{image.width}x{image.height}</div>
                      </div>
                    </div>
                    
                    {/* Regenerating Spinner Overlay */}
                    {regeneratingImages.has(image.id) && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        <p className="text-white mt-3 text-sm">Regenerating...</p>
                      </div>
                    )}
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
                      {image.prompt ? (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Prompt:</div>
                          <div className="text-sm text-gray-300 line-clamp-2">{image.prompt}</div>
                        </div>
                      ) : (
                        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3 text-center">
                          <div className="text-xs text-yellow-400 mb-2">⚠️ No prompt available</div>
                          {generatingPrompts.has(image.id) ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                              Generating prompt...
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGeneratePrompt(image)}
                              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition"
                            >
                              ✨ Generate Prompt from Lyrics
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditImage(image)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
                          disabled={!image.prompt}
                        >
                          ✏️ Edit Prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateImage(image.id)}
                          className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!image.prompt || regeneratingImages.has(image.id)}
                        >
                          {image.image_path && image.image_path !== '' ? '🔄 Regenerate' : '✨ Generate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
