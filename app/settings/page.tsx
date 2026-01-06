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
    // Load from backend
    loadSettings();
    // Load from localStorage (for frontend API usage)
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      if (data && data.id) {
        // Set default master prompts if empty
        const updatedData = { ...data };
        if (!updatedData.master_prompt) {
          updatedData.master_prompt = `Cinematic photography, professional composition, photorealistic, ultra detailed, sharp focus, dramatic lighting, rich colors, depth of field, rule of thirds, 8K resolution, high-end camera quality, film grain texture, perfect exposure, color grading, natural skin tones, atmospheric mood, dynamic range, professional color correction, bokeh effect, pristine image quality`;
        }
        if (!updatedData.master_negative_prompt) {
          updatedData.master_negative_prompt = `text, letters, words, numbers, digits, symbols, typography, watermark, signature, logo, brand names, writing, captions, subtitles, titles, labels, tags, readable signs, store names, street signs, billboards, posters with text, written language, calligraphy, handwriting, printed text, ui elements, overlays, credit, copyright notice, alphabet characters, ugly, blurry, low quality, distorted, deformed, disfigured, cartoon, anime, CGI, artificial, fake, amateur, pixelated, grainy, noisy, oversaturated, undersaturated, washed out, glitch, artifacts`;
        }
        setSettings(updatedData);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // Save to localStorage for frontend API usage
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        orchestrator_host: settings.orchestrator_host,
        ai_host: settings.ai_host,
      })
    );

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
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch('http://localhost:8080/api/v1/settings/upload-logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
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
        {/* Orchestrator Host */}
        <div>
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
        {/* AI Host */}
        <div>
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
                  src={`http://localhost:8080/${settings.brand_logo_path}`}
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
      </div>
    </div>
  );
}
