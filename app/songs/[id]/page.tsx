'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Song, GeneratedImage, SongMetadataEnrichment } from '@/lib/api';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

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
  const [enrichmentData, setEnrichmentData] = useState<SongMetadataEnrichment | null>(null);
  const [hasVocalsOnServer, setHasVocalsOnServer] = useState(false);
  const [hasMusicOnServer, setHasMusicOnServer] = useState(false);
  const [renderLog, setRenderLog] = useState<string>('');
  const [loadingLog, setLoadingLog] = useState(false);

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
    karaoke_font_family: 'Ubuntu',
    karaoke_font_size: 96,
    karaoke_primary_color: '4169E1',
    karaoke_primary_border_color: 'FFFFFF',
    karaoke_highlight_color: 'FFD700',
    karaoke_highlight_border_color: 'FFFFFF',
    karaoke_alignment: 5,
    karaoke_margin_bottom: 0,
  });

  useEffect(() => {
    loadSong();
    loadImages();
    loadRenderLog();
  }, [songId]);

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

  // Helper function to safely parse JSON fields
  const safeJsonParse = (value: string | undefined | null, fallback: any = []): any => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error('JSON parse error for value:', value, err);
      return fallback;
    }
  };

  const loadSong = async () => {
    try {
      setLoading(true);
      const song = await api.getSong(songId);
      setFormData(song);
      setOriginalData(song);
      
      // Load enrichment data if available - check for any enrichment fields
      const hasEnrichmentData = song.genre_primary || song.genre_secondary || song.tags || 
                                song.mood || song.themes || song.style_descriptors || 
                                song.similar_artists || song.summary || song.target_audience || 
                                song.energy_level || song.vocal_style;
      
      if (hasEnrichmentData) {
        try {
          const enrichment: SongMetadataEnrichment = {
            genre_primary: song.genre_primary || '',
            genre_secondary: safeJsonParse(song.genre_secondary, []),
            tags: safeJsonParse(song.tags, []),
            style_descriptors: safeJsonParse(song.style_descriptors, []),
            mood: safeJsonParse(song.mood, []),
            themes: safeJsonParse(song.themes, []),
            similar_artists: safeJsonParse(song.similar_artists, []),
            summary: song.summary || '',
            target_audience: song.target_audience || '',
            energy_level: song.energy_level || '',
            vocal_style: song.vocal_style || ''
          };
          setEnrichmentData(enrichment);
          console.log('Loaded enrichment data:', enrichment);
        } catch (parseErr) {
          console.error('Failed to parse enrichment data:', parseErr);
          console.log('Raw song data:', { 
            genre_primary: song.genre_primary,
            genre_secondary: song.genre_secondary,
            tags: song.tags 
          });
        }
      }
      
      // Validate audio files exist on server
      try {
        const validation = await api.validateAudioPaths(songId);
        setHasVocalsOnServer(!!validation.vocals_ok);
        setHasMusicOnServer(!!validation.music_ok);
      } catch (err) {
        console.error('Failed to validate audio paths:', err);
        setHasVocalsOnServer(false);
        setHasMusicOnServer(false);
      }
      
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

  const loadRenderLog = async () => {
    try {
      setLoadingLog(true);
      const data = await api.getRenderLog(songId);
      setRenderLog(data.log || '');
    } catch (err) {
      console.error('Failed to load render log:', err);
      setRenderLog('');
    } finally {
      setLoadingLog(false);
    }
  };

  const copyLogToClipboard = () => {
    navigator.clipboard.writeText(renderLog);
    showNotification('success', 'Log copied to clipboard');
  };

  const handleAnalyzeAudio = async () => {
    try {
      setAnalyzing(true);
      showNotification('info', 'Analyzing audio and enriching metadata...');
      const result = await api.analyzeSong(songId);
      
      // Update form with analysis results AND enrichment data
      setFormData(prev => ({
        ...prev,
        duration_seconds: result.song.duration_seconds,
        bpm: result.song.bpm,
        key: result.song.key,
        tempo: result.song.tempo,
        genre: result.song.genre || prev.genre,
        // Save enrichment data into formData so it persists
        genre_primary: result.enrichment?.genre_primary || prev.genre_primary,
        genre_secondary: result.enrichment?.genre_secondary ? JSON.stringify(result.enrichment.genre_secondary) : prev.genre_secondary,
        tags: result.enrichment?.tags ? JSON.stringify(result.enrichment.tags) : prev.tags,
        style_descriptors: result.enrichment?.style_descriptors ? JSON.stringify(result.enrichment.style_descriptors) : prev.style_descriptors,
        mood: result.enrichment?.mood ? JSON.stringify(result.enrichment.mood) : prev.mood,
        themes: result.enrichment?.themes ? JSON.stringify(result.enrichment.themes) : prev.themes,
        similar_artists: result.enrichment?.similar_artists ? JSON.stringify(result.enrichment.similar_artists) : prev.similar_artists,
        summary: result.enrichment?.summary || prev.summary,
        target_audience: result.enrichment?.target_audience || prev.target_audience,
        energy_level: result.enrichment?.energy_level || prev.energy_level,
        vocal_style: result.enrichment?.vocal_style || prev.vocal_style,
      }));
      
      // Store enrichment data for display
      if (result.enrichment) {
        setEnrichmentData(result.enrichment);
        showNotification('success', 'Audio analysis and metadata enrichment complete!');
      } else {
        showNotification('success', 'Audio analysis complete!');
      }
      
      setHasChanges(true);
    } catch (err) {
      showNotification('error', 'Failed to analyze audio: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = async (type: 'vocals_stem_path' | 'music_stem_path') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.flac,.wav,.mp3,audio/flac,audio/wav,audio/mpeg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Validate file extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['flac', 'wav', 'mp3'].includes(ext || '')) {
          showNotification('error', 'Please select a FLAC, WAV, or MP3 file');
          return;
        }

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

        showNotification('success', `Selected: ${file.name}`);
        
        // Auto-upload the file immediately
        try {
          setUploading(true);
          showNotification('info', 'Uploading to server...');
          
          await api.uploadAudio(
            songId,
            type === 'vocals_stem_path' ? file : undefined,
            type === 'music_stem_path' ? file : undefined
          );

          // Update server status
          if (type === 'vocals_stem_path') {
            setHasVocalsOnServer(true);
            setVocalsFile(null);
          } else {
            setHasMusicOnServer(true);
            setMusicFile(null);
          }

          showNotification('success', `${type === 'vocals_stem_path' ? 'Vocals' : 'Music'} uploaded successfully!`);
          
          // Refresh validation
          const validation = await api.validateAudioPaths(songId);
          setHasVocalsOnServer(!!validation.vocals_ok);
          setHasMusicOnServer(!!validation.music_ok);
        } catch (err) {
          showNotification('error', 'Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
          // Keep the file selected so user can retry
        } finally {
          setUploading(false);
        }
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

      await api.uploadAudio(songId, vocalsFile || undefined, musicFile || undefined);

      // Update file existence flags
      if (vocalsFile) setHasVocalsOnServer(true);
      if (musicFile) setHasMusicOnServer(true);

      // Clear file state
      setVocalsFile(null);
      setMusicFile(null);

      showNotification('success', 'Audio files uploaded successfully!');
      
      // Refresh validation status
      try {
        const validation = await api.validateAudioPaths(songId);
        setHasVocalsOnServer(!!validation.vocals_ok);
        setHasMusicOnServer(!!validation.music_ok);
      } catch (err) {
        console.error('Failed to re-validate audio paths:', err);
      }
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
    } catch (err) {
      showNotification('error', 'Failed to save song: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: (type === 'number' || type === 'range') ? parseFloat(value) || 0 : value,
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

    const lines = formData.lyrics.split('\n');
    const cleanedLines: string[] = [];
    let currentParagraph: string[] = [];

    for (const line of lines) {
      const stripped = line.trim();
      
      // Empty lines mark paragraph boundaries
      if (!stripped) {
        if (currentParagraph.length > 0) {
          // Join the paragraph into one continuous line
          cleanedLines.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        cleanedLines.push(''); // Keep the paragraph break
        continue;
      }
      
      // Skip section tags
      if (stripped.startsWith('[') || stripped.startsWith('(')) {
        continue;
      }
      
      // Remove trailing commas that cause mid-phrase breaks
      const cleanedLine = stripped.replace(/,\s*$/, '');
      
      // Add to current paragraph
      currentParagraph.push(cleanedLine);
    }
    
    // Don't forget the last paragraph
    if (currentParagraph.length > 0) {
      cleanedLines.push(currentParagraph.join(' '));
    }
    
    // Join with line breaks and clean up multiple blank lines
    const finalLyrics = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    // Update lyrics_karaoke field
    setFormData(prev => ({
      ...prev,
      lyrics_karaoke: finalLyrics,
    }));
    
    setHasChanges(true);
    showNotification('success', 'Karaoke lyrics generated successfully!');
  };

  const handleRender = async () => {
    // Auto-save if there are changes
    if (hasChanges) {
      try {
        showNotification('info', 'Saving changes before rendering...');
        await api.updateSong(songId, formData);
        setHasChanges(false);
        setOriginalData(formData);
      } catch (err) {
        showNotification('error', 'Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
        return;
      }
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
      
      if (!lyrics.trim()) {
        showNotification('error', 'No lyrics found. Please add lyrics first.');
        setLoadingImages(false);
        return;
      }
      
      const lines = lyrics.split('\n');
      
      // Track which sections we've created prompts for
      const sectionsToGenerate: Array<{type: string, number: number, lyrics: string}> = [];
      let currentSection = { type: '', number: 1, lines: [] as string[] };
      
      let hasSeenChorus = false;
      let hasSeenPreChorus = false;
      
      // Helper function to normalize section markers by removing special characters
      const normalizeSectionLine = (line: string): string => {
        // Remove brackets, colons, parentheses, and extra whitespace
        return line.replace(/[\[\]\(\):]/g, '').trim();
      };
      
      // Helper function to check section type from normalized line
      const getSectionType = (normalized: string): { type: string; number: number } | null => {
        const lower = normalized.toLowerCase();
        
        // Check for intro
        if (lower === 'intro') {
          return { type: 'intro', number: 1 };
        }
        
        // Check for verse with optional number
        const verseMatch = lower.match(/^verse\s*(\d+)?$/);
        if (verseMatch) {
          const num = verseMatch[1] ? parseInt(verseMatch[1]) : 1;
          return { type: 'verse', number: num };
        }
        
        // Check for pre-chorus with optional number
        const preChorusMatch = lower.match(/^pre[\s-]?chorus\s*(\d+)?$/);
        if (preChorusMatch) {
          return { type: 'pre-chorus', number: 1 };
        }
        
        // Check for final chorus
        if (lower.match(/^final\s+chorus$/)) {
          return { type: 'final-chorus', number: 1 };
        }
        
        // Check for chorus
        if (lower === 'chorus') {
          return { type: 'chorus', number: 1 };
        }
        
        // Check for bridge
        if (lower === 'bridge') {
          return { type: 'bridge', number: 1 };
        }
        
        // Check for outro
        if (lower === 'outro') {
          return { type: 'outro', number: 1 };
        }
        
        return null;
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;
        
        // Normalize and check if this is a section marker
        const normalized = normalizeSectionLine(trimmed);
        const sectionInfo = getSectionType(normalized);
        
        if (sectionInfo) {
          // This is a section marker
          const { type, number } = sectionInfo;
          
          // Handle special cases for repeated sections
          if (type === 'pre-chorus') {
            if (!hasSeenPreChorus) {
              // First pre-chorus - save previous section and start new one
              if (currentSection.type && currentSection.lines.length > 0) {
                sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
              }
              currentSection = { type, number, lines: [] };
              hasSeenPreChorus = true;
            }
            // Skip repeated pre-chorus markers
            continue;
          } else if (type === 'chorus') {
            if (!hasSeenChorus) {
              // First chorus - save previous section and start new one
              if (currentSection.type && currentSection.lines.length > 0) {
                sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
              }
              currentSection = { type, number, lines: [] };
              hasSeenChorus = true;
            }
            // Skip repeated chorus markers
            continue;
          } else {
            // Regular section - save previous and start new
            if (currentSection.type && currentSection.lines.length > 0) {
              sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
            }
            currentSection = { type, number, lines: [] };
          }
        } else {
          // This is a lyrics line - add to current section
          if (!currentSection.type) {
            // If no section started yet, treat as verse 1
            currentSection = { type: 'verse', number: 1, lines: [] };
          }
          currentSection.lines.push(trimmed);
        }
      }
      
      // Add last section
      if (currentSection.type && currentSection.lines.length > 0) {
        sectionsToGenerate.push({ ...currentSection, lyrics: currentSection.lines.join('\n') });
      }
      
      console.log('Sections to generate:', sectionsToGenerate);
      
      if (sectionsToGenerate.length === 0) {
        showNotification('error', 'No valid sections found in lyrics. Please add section markers like [Verse 1], [Chorus], etc.');
        setLoadingImages(false);
        return;
      }
      
      // Generate prompts for each section
      let successCount = 0;
      for (const section of sectionsToGenerate) {
        if (!section.lyrics.trim()) {
          console.log(`Skipping empty section: ${section.type} ${section.number}`);
          continue;
        }
        
        try {
          console.log(`Generating prompt for ${section.type} ${section.number}:`, section.lyrics.substring(0, 50) + '...');
          
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
            disabled={analyzing || (!hasVocalsOnServer && !hasMusicOnServer)}
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
        <div className="grid grid-cols-5 gap-4">
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm mb-1">Whisper Engine</div>
            <div className="text-lg font-bold">
              {formData.whisper_engine === 'whisperx' ? (
                <span className="text-green-400" title="GPU-accelerated">WhisperX</span>
              ) : formData.whisper_engine === 'faster-whisper' ? (
                <span className="text-blue-400" title="CPU-based">Faster-Whisper</span>
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </div>
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
            <label className="block text-sm font-medium mb-2">Genre (Primary)</label>
            <select
              name="genre"
              value={formData.genre || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">Select Genre</option>
              <option value="Pop">Pop</option>
              <option value="Rock">Rock</option>
              <option value="Hip-Hop/Rap">Hip-Hop/Rap</option>
              <option value="Country">Country</option>
              <option value="R&B/Soul">R&B/Soul</option>
              <option value="Electronic/Dance">Electronic/Dance</option>
              <option value="Latin">Latin</option>
              <option value="Metal">Metal</option>
              <option value="Jazz">Jazz</option>
              <option value="Blues">Blues</option>
              <option value="Folk">Folk</option>
              <option value="Classical">Classical</option>
              <option value="Reggae">Reggae</option>
              <option value="Gospel/Christian">Gospel/Christian</option>
              <option value="Ballad">Ballad</option>
            </select>
            {enrichmentData && enrichmentData.genre_primary && enrichmentData.genre_primary !== formData.genre && (
              <div className="mt-2 text-sm text-blue-400">
                AI suggested: {enrichmentData.genre_primary}
              </div>
            )}
          </div>
        </div>

        {/* AI Metadata Enrichment Section */}
        {enrichmentData && (
          <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-700 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>✨</span> AI-Generated Metadata
            </h2>

            {/* Secondary Genres */}
            {enrichmentData.genre_secondary && enrichmentData.genre_secondary.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Secondary Genres</label>
                <div className="flex flex-wrap gap-2">
                  {enrichmentData.genre_secondary.map((genre, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-900/50 border border-purple-700 rounded-full text-sm">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {enrichmentData.summary && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Summary</label>
                <p className="text-gray-300 bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  {enrichmentData.summary}
                </p>
              </div>
            )}

            {/* Tags, Mood, Themes in a grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tags */}
              {enrichmentData.tags && enrichmentData.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {enrichmentData.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-900/50 border border-blue-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood */}
              {enrichmentData.mood && enrichmentData.mood.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Mood</label>
                  <div className="flex flex-wrap gap-1">
                    {enrichmentData.mood.map((mood, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-900/50 border border-green-700 rounded text-xs">
                        {mood}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Themes */}
              {enrichmentData.themes && enrichmentData.themes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Themes</label>
                  <div className="flex flex-wrap gap-1">
                    {enrichmentData.themes.map((theme, idx) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-900/50 border border-yellow-700 rounded text-xs">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Style Descriptors & Energy Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrichmentData.style_descriptors && enrichmentData.style_descriptors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Style</label>
                  <div className="flex flex-wrap gap-1">
                    {enrichmentData.style_descriptors.map((style, idx) => (
                      <span key={idx} className="px-2 py-1 bg-indigo-900/50 border border-indigo-700 rounded text-xs">
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {enrichmentData.energy_level && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Energy Level</label>
                  <div className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg">
                    {enrichmentData.energy_level}
                  </div>
                </div>
              )}
            </div>

            {/* Similar Artists */}
            {enrichmentData.similar_artists && enrichmentData.similar_artists.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Similar Artists</label>
                <div className="flex flex-wrap gap-2">
                  {enrichmentData.similar_artists.map((artist, idx) => (
                    <span key={idx} className="px-3 py-1 bg-pink-900/50 border border-pink-700 rounded-full text-sm">
                      {artist}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Target Audience & Vocal Style */}
            {(enrichmentData.target_audience || enrichmentData.vocal_style) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrichmentData.target_audience && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Target Audience</label>
                    <div className="text-gray-300 bg-gray-900/50 rounded-lg p-3 border border-gray-700 text-sm">
                      {enrichmentData.target_audience}
                    </div>
                  </div>
                )}

                {enrichmentData.vocal_style && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Vocal Style</label>
                    <div className="text-gray-300 bg-gray-900/50 rounded-lg p-3 border border-gray-700 text-sm">
                      {enrichmentData.vocal_style}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-700">
              This metadata was generated by AI based on lyrics, BPM, key, and tempo analysis
            </div>
          </div>
        )}

        {/* Visualization Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Visualization Settings</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">Spectrum Location</label>
            <select
              name="spectrum_style"
              value={formData.spectrum_style}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="stereo">Stereo (bars on left/right edges)</option>
              <option value="showfreqs">Equalizer Bars</option>
              <option value="showspectrum">Spectrum Display</option>
              <option value="showcqt">CQT Spectrum (Professional)</option>
              <option value="showwaves">Waveform</option>
              <option value="showvolume">Volume Meter</option>
              <option value="avectorscope">Vector Scope (Circle)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Spectrum Color</label>
            <div className="space-y-2">
              <select
                name="spectrum_color"
                value={formData.spectrum_color}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="rainbow">Rainbow Gradient</option>
                <option value="gray">Neutral Gray (Default)</option>
                <option value="white">White</option>
                <option value="red">Red</option>
                <option value="orange">Orange</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="cyan">Cyan</option>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="magenta">Magenta</option>
                <option value="pink">Pink</option>
                <option value="brown">Brown</option>
                <option value="lime">Lime</option>
                <option value="teal">Teal</option>
                <option value="navy">Navy</option>
                <option value="maroon">Maroon</option>
              </select>
            </div>
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

        {/* Karaoke Text Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Karaoke Text Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium mb-2">Font Family</label>
              <select
                name="karaoke_font_family"
                value={formData.karaoke_font_family || 'Arial'}
                onChange={handleChange}
                onBlur={handleBlur}
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
              <p className="text-xs text-gray-500 mt-1">Used for karaoke text display</p>
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
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={`#${formData.karaoke_primary_color || '4169E1'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_primary_color: hex }));
                    setHasChanges(true);
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_primary_color"
                  value={formData.karaoke_primary_color || '4169E1'}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="4169E1"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Default text color (before highlighting)</p>
            </div>

            {/* Primary Border Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Primary Border Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={`#${formData.karaoke_primary_border_color || 'FFFFFF'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_primary_border_color: hex }));
                    setHasChanges(true);
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_primary_border_color"
                  value={formData.karaoke_primary_border_color || 'FFFFFF'}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="FFFFFF"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Outline color for default text</p>
            </div>

            {/* Highlight Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Highlight Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={`#${formData.karaoke_highlight_color || 'FFD700'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_highlight_color: hex }));
                    setHasChanges(true);
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_highlight_color"
                  value={formData.karaoke_highlight_color || 'FFD700'}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="FFD700"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Color when text is actively being sung</p>
            </div>

            {/* Highlight Border Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Highlight Border Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={`#${formData.karaoke_highlight_border_color || 'FFFFFF'}`}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    setFormData(prev => ({ ...prev, karaoke_highlight_border_color: hex }));
                    setHasChanges(true);
                  }}
                  className="w-16 h-10 rounded border border-gray-700 cursor-pointer bg-gray-900"
                />
                <input
                  type="text"
                  name="karaoke_highlight_border_color"
                  value={formData.karaoke_highlight_border_color || 'FFFFFF'}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="FFFFFF"
                  maxLength={6}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Outline color for highlighted text</p>
            </div>

            {/* Text Alignment */}
            <div>
              <label className="block text-sm font-medium mb-2">Text Alignment</label>
              <select
                name="karaoke_alignment"
                value={formData.karaoke_alignment ?? 5}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value={5}>Center (Default)</option>
                <option value={2}>Bottom Center</option>
                <option value={8}>Top Center</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Vertical position of karaoke text</p>
            </div>

            {/* Bottom Margin */}
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
              <p className="text-xs text-gray-500 mt-1">Positive moves text down, negative moves up</p>
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
          
          {/* Upload Instructions */}
          {!hasVocalsOnServer && !hasMusicOnServer && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
              <p className="text-blue-300 text-sm">
                📤 Please upload <strong>Vocal</strong> and <strong>Instrumental</strong> stems for this song.
                The server will automatically rename them to the correct format.
              </p>
            </div>
          )}
          
          {/* Server Files Status */}
          <div className="flex gap-3 mb-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              hasVocalsOnServer ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-gray-700/50 text-gray-400 border border-gray-600'
            }`}>
              {hasVocalsOnServer ? '✓ Vocals on server' : '○ No vocals uploaded'}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              hasMusicOnServer ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-gray-700/50 text-gray-400 border border-gray-600'
            }`}>
              {hasMusicOnServer ? '✓ Instrumental on server' : '○ No instrumental uploaded'}
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
                        src={`${api.baseURL.replace('api/v1', '')}${image.image_path.replace('storage/', '')}?t=${imageTimestamps.get(image.id) || Date.now()}`}
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

        {/* Render Log Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Render Log</h2>
            {renderLog && (
              <button
                type="button"
                onClick={copyLogToClipboard}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition flex items-center gap-2"
              >
                <span>📋</span>
                <span>Copy Log</span>
              </button>
            )}
          </div>
          
          {loadingLog ? (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
              <div className="text-gray-500">Loading render log...</div>
            </div>
          ) : renderLog ? (
            <textarea
              value={renderLog}
              readOnly
              className="w-full h-96 bg-gray-900 border border-gray-700 rounded p-4 font-mono text-sm text-gray-300 resize-none"
              style={{ fontFamily: 'monospace' }}
            />
          ) : (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
              <div className="text-gray-500 mb-2">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-lg font-medium mb-1">No Render Log Available</div>
                <div className="text-sm">
                  Render log will appear here after video generation
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={hasChanges ? 'Save your changes' : 'No changes to save'}
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
            disabled={!hasVocalsOnServer && !hasMusicOnServer}
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
