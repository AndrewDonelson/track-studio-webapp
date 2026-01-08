'use client';

import { useState, useEffect } from 'react';

const LOCAL_KEY = "trackstudio_settings";
import { api } from '@/lib/api';


interface Settings {
  id?: number;
  master_prompt: string;
  master_negative_prompt: string;
  brand_logo_path: string;
  data_storage_path: string;
  orchestrator_host?: string;
  ai_host?: string;
}

export default function SettingsPage() {
  // --- Test UI State ---

  const [testingImage, setTestingImage] = useState(false);
  const [testImageTarget, setTestImageTarget] = useState<'orchestrator' | 'direct' | null>(null);
  const [testImageResult, setTestImageResult] = useState<{status: string, output?: string, log?: string} | null>(null);

  const [testingTranscription, setTestingTranscription] = useState(false);
  const [testTranscriptionTarget, setTestTranscriptionTarget] = useState<'orchestrator' | 'direct' | null>(null);
  const [testTranscriptionResult, setTestTranscriptionResult] = useState<{status: string, output?: string, log?: string} | null>(null);

  // Log of all requests/responses for all tests
  const [testLog, setTestLog] = useState<Array<{
    test: string;
    request: any;
    response: any;
    timestamp: string;
  }>>([]);

  // --- Test Handlers (stubs for now) ---

  // Helper to fetch a file from public folder as text or blob
  const fetchPublicFile = async (filename: string, as: 'text' | 'blob' = 'text') => {
    const res = await fetch(`/test-files/${filename}`);
    if (!res.ok) throw new Error(`Failed to load ${filename}`);
    return as === 'text' ? res.text() : res.blob();
  };

  // Orchestrator: Test image generation using /public/test-files/image.txt as prompt

  // --- Direct API helpers ---
  // Get direct AI/WhisperX host from settings
  const getDirectHost = () => {
    let host = settings.ai_host?.trim();
    if (!host) throw new Error('AI Host not set in settings');
    if (!host.startsWith('http')) host = 'http://' + host;
    return host.replace(/\/$/, '');
  };

  // Direct: Test image generation (POST /generate or similar)
  const testDirectImage = async (prompt: string) => {
    const url = getDirectHost() + '/generate'; // Adjust endpoint as needed
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return text;
  };

  // Direct: Test transcription (POST /transcribe/sync)
  const testDirectTranscription = async (file: Blob) => {
    const url = getDirectHost() + '/transcribe/sync';
    const form = new FormData();
    form.append('file', new File([file], 'vocal.wav'));
    form.append('language', 'en');
    form.append('model', 'large-v2');
    const res = await fetch(url, { method: 'POST', body: form });
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return text;
  };

  const handleTestImage = async (target: 'orchestrator' | 'direct') => {
    setTestingImage(true);
    setTestImageTarget(target);
    setTestImageResult(null);
    let logEntry: any = { test: `Image Generation (${target})`, request: null, response: null, timestamp: new Date().toISOString() };
    try {
      const prompt = await fetchPublicFile('image.txt', 'text') as string;
      logEntry.request = { prompt };
      if (target === 'orchestrator') {
        // Submit image generation job
        const res = await api.createImagePrompt(0, { prompt });
        logEntry.response = { initial: res };
        // Poll for image result if queue_id or id is present
        let imageId = res.id;
        let pollCount = 0;
        let finalImage = res;
        // Poll every 2s up to 30s
        while (pollCount < 15) {
          // If image_path is set and not empty, job is done
          if (finalImage.image_path && finalImage.image_path !== "") break;
          // Optionally, poll by imageId or by songId for latest image
          await new Promise(r => setTimeout(r, 2000));
          try {
            finalImage = await api.getImagesBySong(0).then(arr => arr.find(img => img.id === imageId) || finalImage);
          } catch {}
          pollCount++;
        }
        setTestImageResult({
          status: finalImage.image_path && finalImage.image_path !== "" ? 'Success' : 'Timeout/Failed',
          output: JSON.stringify(finalImage, null, 2),
          log: finalImage.image_path && finalImage.image_path !== "" ? '' : 'Image not generated after polling.'
        });
        logEntry.response.final = finalImage;
      } else {
        const output = await testDirectImage(prompt);
        setTestImageResult({ status: 'Success', output, log: '' });
        logEntry.response = { output };
      }
    } catch (e: any) {
      setTestImageResult({ status: 'Error', output: '', log: e?.message || String(e) });
      logEntry.response = { error: e?.message || String(e) };
    } finally {
      setTestLog(prev => [...prev, logEntry]);
      setTestingImage(false);
      setTestImageTarget(null);
    }
  };

  // Orchestrator: Test transcription using /public/test-files/vocal.wav

  const handleTestTranscription = async (target: 'orchestrator' | 'direct') => {
    setTestingTranscription(true);
    setTestTranscriptionTarget(target);
    setTestTranscriptionResult(null);
    try {
      const blob = await fetchPublicFile('vocal.wav', 'blob') as Blob;
      if (target === 'orchestrator') {
        await api.uploadAudio(0, new File([blob], 'vocal.wav'));
        setTestTranscriptionResult({ status: 'Success', output: 'Uploaded vocal.wav to orchestrator.', log: '' });
      } else {
        const output = await testDirectTranscription(blob);
        setTestTranscriptionResult({ status: 'Success', output, log: '' });
      }
    } catch (e: any) {
      setTestTranscriptionResult({ status: 'Error', output: '', log: e?.message || String(e) });
    } finally {
      setTestingTranscription(false);
      setTestTranscriptionTarget(null);
    }
  };

  // --- Existing settings state ---
  const [settings, setSettings] = useState<Settings>({
    master_prompt: '',
    master_negative_prompt: '',
    brand_logo_path: '',
    data_storage_path: '~/track-studio-data',
    orchestrator_host: '',
    ai_host: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  useEffect(() => {
    // Load from localStorage first (for frontend API usage)
    const raw = localStorage.getItem(LOCAL_KEY);
    let localSettings: Settings = {
      master_prompt: '',
      master_negative_prompt: '',
      brand_logo_path: '',
      data_storage_path: '',
      orchestrator_host: '',
      ai_host: '',
    };
    if (raw) {
      try {
        localSettings = JSON.parse(raw) as Settings;
        setSettings((prev) => ({ ...prev, ...localSettings }));
      } catch {}
    }
    // Then load from backend and merge, preferring non-empty values from either source
    (async () => {
      try {
        const data = await api.getSettings();
        if (data && data.id) {
          // Set default master prompts if empty
          const updatedData: Settings = { ...data };
          if (!updatedData.master_prompt) {
            updatedData.master_prompt = `Cinematic photography, professional composition, photorealistic, ultra detailed, sharp focus, dramatic lighting, rich colors, depth of field, rule of thirds, 8K resolution, high-end camera quality, film grain texture, perfect exposure, color grading, natural skin tones, atmospheric mood, dynamic range, professional color correction, bokeh effect, pristine image quality`;
          }
          if (!updatedData.master_negative_prompt) {
            updatedData.master_negative_prompt = `text, letters, words, numbers, digits, symbols, typography, watermark, signature, logo, brand names, writing, captions, subtitles, titles, labels, tags, readable signs, store names, street signs, billboards, posters with text, written language, calligraphy, handwriting, printed text, ui elements, overlays, credit, copyright notice, alphabet characters, ugly, blurry, low quality, distorted, deformed, disfigured, cartoon, anime, CGI, artificial, fake, amateur, pixelated, grainy, noisy, oversaturated, undersaturated, washed out, glitch, artifacts`;
          }
          // Merge: prefer non-empty orchestrator_host/ai_host from localStorage, else backend
          setSettings((prev) => ({
            ...prev,
            ...updatedData,
            orchestrator_host: localSettings.orchestrator_host?.trim() || updatedData.orchestrator_host || '',
            ai_host: localSettings.ai_host?.trim() || updatedData.ai_host || '',
          }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // loadSettings is now inlined in useEffect and not needed as a separate function

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // Only save to localStorage if both hosts are non-empty and look like valid hostnames
    const orchestratorHost = settings.orchestrator_host?.trim();
    const aiHost = settings.ai_host?.trim();
    // Simple validation: must not be empty and must look like an IP/domain (not just whitespace)
    const isValidHost = (host: string | undefined) => !!host && /[a-zA-Z0-9.-]+/.test(host);
    if (isValidHost(orchestratorHost) && isValidHost(aiHost)) {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          orchestrator_host: orchestratorHost,
          ai_host: aiHost,
        })
      );
    }

    try {
      await api.saveSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    setUploading(true);
    setMessage(null);

    try {
      const result = await api.uploadLogo(logoFile);
      setSettings({ ...settings, brand_logo_path: result.path });
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
    } catch (error) {
      console.error('Failed to upload logo:', error);
      setMessage({ type: 'error', text: 'Failed to upload logo. Please try again.' });
    } finally {
      setUploading(false);
    }
  };


  // Helper to get orchestrator host from settings (with fallback)
  const getOrchestratorHost = () => {
    let host = settings.orchestrator_host?.trim();
    if (!host) return '';
    if (!host.startsWith('http')) host = 'http://' + host;
    return host.replace(/\/$/, '');
  };
  // Helper to get AI host from settings (with fallback)
  const getAIHost = () => {
    let host = settings.ai_host?.trim();
    if (!host) return '';
    if (!host.startsWith('http')) host = 'http://' + host;
    return host.replace(/\/$/, '');
  };

  // Status check component (generic)
  function HostStatus({ url, label, healthPath = '/health', parse }: { url: string, label: string, healthPath?: string, parse?: (data: any) => {service?: string, status?: string, error?: string} }) {
    const [status, setStatus] = useState<{service?: string, status?: string, error?: string} | null>(null);
    useEffect(() => {
      if (!url) return;
      let cancelled = false;
      fetch(url + healthPath)
        .then(async r => {
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text || r.statusText);
          }
          try {
            const data = await r.json();
            if (!cancelled) setStatus(parse ? parse(data) : data);
          } catch (e: any) {
            // Try to get text for more info
            let text = '';
            try { text = await r.text(); } catch {}
            if (!cancelled) setStatus({ error: 'Invalid JSON: ' + (text || e.message) });
          }
        })
        .catch(e => {
          // CORS/network errors
          let msg = e && e.message ? e.message : String(e);
          if (msg === 'Failed to fetch') {
            msg = 'Network error or CORS (check server and browser console)';
          }
          if (!cancelled) setStatus({ error: msg });
        });
      return () => { cancelled = true; };
    }, [url, healthPath, parse]);
    if (!url) return <span style={{ color: 'orange', marginLeft: 8 }}>Set {label} to check status.</span>;
    if (!status) return <span style={{ marginLeft: 8 }}>Checking...</span>;
    if (status.error) return <span style={{ color: 'red', marginLeft: 8 }}>{label} error: {status.error}</span>;
    return <span style={{ marginLeft: 8 }}><b>{status.service || label}</b> status is <b>{status.status}</b></span>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Configure TrackStudio application settings</p>
      </div>



      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-700 text-green-100'
              : 'bg-red-900/50 border border-red-700 text-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        {/* Orchestrator Host - separate row */}
        <div className="flex items-center justify-between gap-6 mb-2">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Orchestrator API Host
              <span className="text-gray-400 text-xs ml-2">(e.g. http://192.168.1.200:8080)</span>
            </label>
            <input
              type="text"
              value={settings.orchestrator_host || ''}
              onChange={e => setSettings({ ...settings, orchestrator_host: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://192.168.1.200:8080"
            />
          </div>
          <div className="min-w-[180px] text-sm text-right">
            <HostStatus url={getOrchestratorHost()} label="Orchestrator" />
          </div>
        </div>
        {/* AI Host - separate row */}
        <div className="flex items-center justify-between gap-6 mb-2">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              AI Models Host
              <span className="text-gray-400 text-xs ml-2">(e.g. http://192.168.1.76)</span>
            </label>
            <input
              type="text"
              value={settings.ai_host || ''}
              onChange={e => setSettings({ ...settings, ai_host: e.target.value })}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://192.168.1.76"
            />
          </div>
          <div className="min-w-[180px] text-sm text-right">
            <HostStatus url={getAIHost()} label="AI Models" healthPath="/api/health" parse={data => ({ service: data.service || 'AI Models', status: data.status })} />
          </div>
        </div>
        {/* Master Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Master Image Prompt
            <span className="text-gray-400 text-xs ml-2">(Base prompt for all image generation)</span>
          </label>
          <textarea
            value={settings.master_prompt}
            onChange={(e) => setSettings({ ...settings, master_prompt: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter master prompt for image generation..."
          />
        </div>

        {/* Master Negative Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Master Negative Prompt
            <span className="text-gray-400 text-xs ml-2">(What to avoid in all images)</span>
          </label>
          <textarea
            value={settings.master_negative_prompt}
            onChange={(e) => setSettings({ ...settings, master_negative_prompt: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter negative prompt..."
          />
        </div>

        {/* Brand Logo */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Brand Logo
            <span className="text-gray-400 text-xs ml-2">(Logo displayed in bottom-right of videos)</span>
          </label>
          <div className="space-y-3">
            {settings.brand_logo_path && (
              <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <img
                  src={`${api.baseURL.replace('api/v1', '')}${settings.brand_logo_path}`}
                  alt="Brand Logo"
                  className="w-16 h-16 object-contain bg-white rounded"
                />
                <div className="flex-1">
                  <div className="text-sm text-gray-400">Current Logo</div>
                  <div className="text-xs text-gray-500">{settings.brand_logo_path}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleUploadLogo}
                disabled={!logoFile || uploading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Upload PNG or JPG logo (recommended: 150x150px or larger, square aspect ratio)</p>
          </div>
        </div>

        {/* Data Storage Path */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Data Storage Path
            <span className="text-gray-400 text-xs ml-2">(Root directory for all generated files)</span>
          </label>
          <input
            type="text"
            value={settings.data_storage_path}
            onChange={(e) => setSettings({ ...settings, data_storage_path: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="~/track-studio-data"
          />
          <p className="mt-2 text-sm text-gray-400">
            This directory will contain:
          </p>
          <ul className="mt-1 text-sm text-gray-500 list-disc list-inside">
            <li>trackstudio.db (database)</li>
            <li>images/ (generated images)</li>
            <li>videos/ (rendered videos)</li>
            <li>audio/ (mixed audio files)</li>
            <li>temp/ (temporary files)</li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Run Tests Section */}
        <div className="mt-10 bg-gray-900 rounded-lg shadow-lg p-6 space-y-6 border border-blue-900">
          <h2 className="text-2xl font-bold mb-2 text-blue-300">Run Tests</h2>
          <p className="text-gray-400 mb-4">Quickly verify image generation and transcription with current configuration. Results and logs will be shown below.</p>

          {/* Test Image Generation */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <button
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg font-medium text-white"
                onClick={async () => await handleTestImage('orchestrator')}
                disabled={testingImage}
              >
                {testingImage && testImageTarget === 'orchestrator' ? 'Testing...' : 'Test Image Generation (Orchestrator)'}
              </button>
              <button
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg font-medium text-white"
                onClick={async () => await handleTestImage('direct')}
                disabled={testingImage}
              >
                {testingImage && testImageTarget === 'direct' ? 'Testing...' : 'Test Image Generation (Direct)'}
              </button>
            </div>
            {testImageResult && (
              <div className="mt-2 p-3 bg-gray-800 rounded border border-blue-800 text-blue-100 whitespace-pre-wrap text-xs">
                <b>Result:</b> {testImageResult.status}<br/>
                {testImageResult.output && <div><b>Output:</b><br/>{testImageResult.output}</div>}
                {testImageResult.log && <div><b>Log:</b><br/>{testImageResult.log}</div>}
              </div>
            )}
          </div>

          {/* Test Transcription */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <button
                className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg font-medium text-white"
                onClick={async () => await handleTestTranscription('orchestrator')}
                disabled={testingTranscription}
              >
                {testingTranscription && testTranscriptionTarget === 'orchestrator' ? 'Testing...' : 'Test Transcription (Orchestrator)'}
              </button>
              <button
                className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg font-medium text-white"
                onClick={async () => await handleTestTranscription('direct')}
                disabled={testingTranscription}
              >
                {testingTranscription && testTranscriptionTarget === 'direct' ? 'Testing...' : 'Test Transcription (Direct)'}
              </button>
            </div>
            {testTranscriptionResult && (
              <div className="mt-2 p-3 bg-gray-800 rounded border border-green-800 text-green-100 whitespace-pre-wrap text-xs">
                <b>Result:</b> {testTranscriptionResult.status}<br/>
                {testTranscriptionResult.output && <div><b>Output:</b><br/>{testTranscriptionResult.output}</div>}
                {testTranscriptionResult.log && <div><b>Log:</b><br/>{testTranscriptionResult.log}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Test Log Viewer */}
      <div style={{ marginTop: 32 }}>
        <h3>Test Log</h3>
        <ul style={{ maxHeight: 300, overflow: 'auto', background: '#f8f8f8', padding: 12, borderRadius: 8 }}>
          {testLog.map((entry, i) => (
            <li key={i} style={{ marginBottom: 16 }}>
              <div><b>{entry.test}</b> <span style={{ color: '#888', fontSize: 12 }}>{entry.timestamp}</span></div>
              <div><b>Request:</b> <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(entry.request, null, 2)}</pre></div>
              <div><b>Response:</b> <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(entry.response, null, 2)}</pre></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
