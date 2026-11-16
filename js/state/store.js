import { createEmptyMetadata } from '../constants/metadataFields.js';
import { getExtension, stripExtension } from '../utils/formatters.js';
import { t } from '../i18n/i18n.js';

let nextId = 1;

class AppStore {
  constructor() {
    this.tracks = [];
    this.masterSettings = {
      format: 'flac',
      bitDepth: '24',
      sampleRate: 48000,
      bitrate: '320k',
      channels: 'original'
    };
    this.wasmStatus = 'idle'; // 'idle' | 'loading' | 'ready' | 'busy' | 'error'
    this.wasmStatusKey = 'wasm.idle';
    this.wasmStatusText = t('wasm.idle');
    this.isBatchConverting = false;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      fn(this);
    }
  }

  setWasmStatus(status, textOrKey) {
    this.wasmStatus = status;
    if (textOrKey && textOrKey.startsWith('wasm.')) {
      this.wasmStatusKey = textOrKey;
      this.wasmStatusText = t(textOrKey);
    } else {
      this.wasmStatusKey = `wasm.${status}`;
      this.wasmStatusText = textOrKey || t(`wasm.${status}`);
    }
    this.notify();
  }

  setMasterSettings(patch) {
    this.masterSettings = { ...this.masterSettings, ...patch };
    for (const track of this.tracks) {
      if (track.settings.useMaster) {
        track.settings = { ...this.masterSettings, useMaster: true };
      }
    }
    this.notify();
  }

  applyMasterToAllTracks() {
    for (const track of this.tracks) {
      track.settings = { ...this.masterSettings, useMaster: true };
    }
    this.notify();
  }

  addTracks(fileEntries) {
    const added = [];
    for (const file of fileEntries) {
      const id = `trk-${nextId++}`;
      const baseName = stripExtension(file.name);
      const ext = getExtension(file.name);
      const track = {
        id,
        file,
        originalName: file.name,
        originalSize: file.size,
        originalFormat: ext.toUpperCase() || 'AUDIO',
        duration: 0,
        sampleRate: 0,
        channels: 0,
        sourceUrl: URL.createObjectURL(file),
        metadata: createEmptyMetadata({ title: baseName }),
        settings: { ...this.masterSettings, useMaster: true },
        status: 'idle',
        progress: 0,
        error: null,
        convertedBlob: null,
        convertedUrl: null,
        convertedName: null,
        convertedFormat: null
      };
      this.tracks.push(track);
      added.push(track);
    }
    this.notify();
    return added;
  }

  getTrack(id) {
    return this.tracks.find((t) => t.id === id) || null;
  }

  updateTrack(id, patch) {
    const track = this.getTrack(id);
    if (!track) return;
    Object.assign(track, patch);
    this.notify();
  }

  updateTrackMetadata(id, metadataPatch) {
    const track = this.getTrack(id);
    if (!track) return;
    track.metadata = { ...track.metadata, ...metadataPatch };
    this.notify();
  }

  updateTrackSettings(id, settingsPatch) {
    const track = this.getTrack(id);
    if (!track) return;
    track.settings = { ...track.settings, ...settingsPatch, useMaster: false };
    this.notify();
  }

  removeTrack(id) {
    const idx = this.tracks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [removed] = this.tracks.splice(idx, 1);
    if (removed.sourceUrl) URL.revokeObjectURL(removed.sourceUrl);
    if (removed.convertedUrl) URL.revokeObjectURL(removed.convertedUrl);
    if (removed.metadata?.artwork?.url) URL.revokeObjectURL(removed.metadata.artwork.url);
    this.notify();
  }

  clearTracks() {
    for (const t of this.tracks) {
      if (t.sourceUrl) URL.revokeObjectURL(t.sourceUrl);
      if (t.convertedUrl) URL.revokeObjectURL(t.convertedUrl);
      if (t.metadata?.artwork?.url) URL.revokeObjectURL(t.metadata.artwork.url);
    }
    this.tracks = [];
    this.notify();
  }
}

export const store = new AppStore();
